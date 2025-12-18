import type Anthropic from '@anthropic-ai/sdk';
import type { Tool, MessageParam, ContentBlock, ToolUseBlock, ToolResultBlockParam } from '@anthropic-ai/sdk/resources/messages';

export interface ChatMessage {
	sender: 'user' | 'bot';
	text: string;
}

/**
 * Result of executing a tool
 */
export interface ToolExecutionResult {
	result: string;
	/** If true, the handler will wait for an external event (e.g., SMS reply) before continuing */
	waitForReply?: boolean;
	/** Callback to check if the reply has arrived */
	checkReply?: () => Promise<string | null>;
}

/**
 * Tool executor function type
 */
export type ToolExecutor = (
	toolName: string,
	input: Record<string, unknown>,
	sessionId: string,
	toolUseId: string
) => Promise<ToolExecutionResult>;

export interface ChatHandlerOptions {
	apiKey: string;
	systemPrompt?: string;
	model?: string;
	maxTokens?: number;
	/** Tools available to the agent */
	tools?: Tool[];
	/** Custom tool executor - called when Claude uses a tool */
	onToolExecute?: ToolExecutor;
	/** Save chat history callback */
	onSave?: (sessionId: string, history: ChatMessage[]) => Promise<void>;
	/** Maximum number of tool execution rounds (default: 10) */
	maxToolRounds?: number;
	/** How often to check for async replies in ms (default: 2000) */
	replyCheckInterval?: number;
	/** Maximum time to wait for async reply in ms (default: 300000 = 5 min) */
	replyTimeout?: number;
}

const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant. Be friendly, concise, and helpful.

Guidelines:
- Keep responses brief (1-3 sentences when possible)
- Be conversational and approachable
- If you don't know something, be honest about it
- Ask clarifying questions when needed`;

const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';

/**
 * Sleep helper for polling
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract text content from Claude response
 */
function extractTextFromContent(content: ContentBlock[]): string {
	return content
		.filter((block) => block.type === 'text')
		.map((block) => (block as { type: 'text'; text: string }).text)
		.join('');
}

/**
 * Extract tool use blocks from Claude response
 */
function extractToolUses(content: ContentBlock[]): ToolUseBlock[] {
	return content.filter((block): block is ToolUseBlock => block.type === 'tool_use');
}

export function createChatHandler(options: ChatHandlerOptions) {
	const {
		apiKey,
		systemPrompt = DEFAULT_SYSTEM_PROMPT,
		model = DEFAULT_MODEL,
		maxTokens = 1024,
		tools,
		onToolExecute,
		onSave,
		maxToolRounds = 10,
		replyCheckInterval = 2000,
		replyTimeout = 300000
	} = options;

	return async (request: Request): Promise<Response> => {
		// Dynamic import for Cloudflare Workers compatibility
		// See: https://github.com/anthropics/anthropic-sdk-typescript/issues/392
		const { default: Anthropic } = await import('@anthropic-ai/sdk');
		const anthropic = new Anthropic({ apiKey });

		try {
			const { message, sessionId, history } = await request.json();

			if (!message || typeof message !== 'string') {
				return new Response(JSON.stringify({ error: 'Message is required' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			// Convert chat history to Claude message format
			const messages: MessageParam[] = [];

			if (history && Array.isArray(history)) {
				for (const msg of history as ChatMessage[]) {
					messages.push({
						role: msg.sender === 'user' ? 'user' : 'assistant',
						content: msg.text
					});
				}
			}

			// Add the new user message
			messages.push({
				role: 'user',
				content: message
			});

			// Track chat history for saving
			const chatHistory: ChatMessage[] = history ? [...history] : [];
			chatHistory.push({ sender: 'user', text: message });

			// Create a readable stream for the response
			const encoder = new TextEncoder();
			const readable = new ReadableStream({
				async start(controller) {
					try {
						let fullResponse = '';
						let toolRound = 0;

						// Agentic loop - continue until we get a final response
						while (toolRound < maxToolRounds) {
							toolRound++;

							// Call Claude (with or without tools)
							const response = await anthropic.messages.create({
								model,
								max_tokens: maxTokens,
								system: systemPrompt,
								messages,
								...(tools && tools.length > 0 ? { tools } : {})
							});

							// Check if Claude wants to use tools
							if (response.stop_reason === 'tool_use' && onToolExecute) {
								const toolUses = extractToolUses(response.content);

								// Stream any text that came before tool use
								const preToolText = extractTextFromContent(response.content);
								if (preToolText) {
									controller.enqueue(
										encoder.encode(`data: ${JSON.stringify({ text: preToolText })}\n\n`)
									);
									fullResponse += preToolText;
								}

								// Add assistant message with tool use to history
								messages.push({
									role: 'assistant',
									content: response.content
								});

								// Execute each tool and collect results
								const toolResults: ToolResultBlockParam[] = [];

								for (const toolUse of toolUses) {
									const executionResult = await onToolExecute(
										toolUse.name,
										toolUse.input as Record<string, unknown>,
										sessionId,
										toolUse.id
									);

									// Handle async waiting (e.g., SMS reply)
									if (executionResult.waitForReply && executionResult.checkReply) {
										// Notify frontend we're waiting
										controller.enqueue(
											encoder.encode(
												`data: ${JSON.stringify({
													type: 'waiting',
													message: 'Checking with a team member...'
												})}\n\n`
											)
										);

										// Poll for reply
										const startTime = Date.now();
										let reply: string | null = null;

										while (Date.now() - startTime < replyTimeout) {
											reply = await executionResult.checkReply();
											if (reply) break;
											await sleep(replyCheckInterval);
										}

										if (reply) {
											toolResults.push({
												type: 'tool_result',
												tool_use_id: toolUse.id,
												content: `Owner replied: ${reply}`
											});
										} else {
											// Timeout - no reply received
											toolResults.push({
												type: 'tool_result',
												tool_use_id: toolUse.id,
												content:
													'No reply received from owner. Please ask the user to leave their contact information or check back later.',
												is_error: true
											});
										}
									} else {
										// Immediate tool result
										toolResults.push({
											type: 'tool_result',
											tool_use_id: toolUse.id,
											content: executionResult.result
										});
									}
								}

								// Add tool results to messages
								messages.push({
									role: 'user',
									content: toolResults
								});

								// Continue loop to get Claude's response to tool results
								continue;
							}

							// No tool use - stream the final response
							const finalText = extractTextFromContent(response.content);
							if (finalText) {
								// Stream in chunks for better UX
								const chunkSize = 20;
								for (let i = 0; i < finalText.length; i += chunkSize) {
									const chunk = finalText.slice(i, i + chunkSize);
									controller.enqueue(
										encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`)
									);
									fullResponse += chunk;
									// Small delay for streaming effect
									await sleep(10);
								}
							}

							// Exit the loop - we have a final response
							break;
						}

						// Save after completion
						if (sessionId && fullResponse && onSave) {
							chatHistory.push({ sender: 'bot', text: fullResponse });
							try {
								await onSave(sessionId, chatHistory);
							} catch (err) {
								console.error('Failed to save chat:', err);
							}
						}

						controller.enqueue(encoder.encode('data: [DONE]\n\n'));
						controller.close();
					} catch (error) {
						console.error('Stream error:', error);
						controller.enqueue(
							encoder.encode(
								`data: ${JSON.stringify({ type: 'error', message: 'An error occurred' })}\n\n`
							)
						);
						controller.close();
					}
				}
			});

			return new Response(readable, {
				headers: {
					'Content-Type': 'text/event-stream',
					'Cache-Control': 'no-cache',
					Connection: 'keep-alive'
				}
			});
		} catch (error) {
			console.error('Chat API error:', error);
			return new Response(JSON.stringify({ error: 'Failed to process chat message' }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			});
		}
	};
}

export { DEFAULT_SYSTEM_PROMPT, DEFAULT_MODEL };
export type { Tool, ToolExecutionResult, ToolExecutor, ChatHandlerOptions };
