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
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * Extract text content from Claude response
 */
function extractTextFromContent(content) {
    return content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('');
}
/**
 * Extract tool use blocks from Claude response
 */
function extractToolUses(content) {
    return content.filter((block) => block.type === 'tool_use');
}
export function createChatHandler(options) {
    const { apiKey, systemPrompt = DEFAULT_SYSTEM_PROMPT, model = DEFAULT_MODEL, maxTokens = 1024, tools, onToolExecute, onSave, maxToolRounds = 10, replyCheckInterval = 2000, replyTimeout = 300000 } = options;
    return async (request) => {
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
            const messages = [];
            if (history && Array.isArray(history)) {
                for (const msg of history) {
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
            const chatHistory = history ? [...history] : [];
            chatHistory.push({ sender: 'user', text: message });
            // Create a readable stream for the response
            const encoder = new TextEncoder();
            let controllerClosed = false;
            // Safe enqueue that won't throw if controller is closed
            const safeEnqueue = (controller, data) => {
                if (controllerClosed)
                    return false;
                try {
                    controller.enqueue(encoder.encode(data));
                    return true;
                }
                catch {
                    controllerClosed = true;
                    return false;
                }
            };
            const safeClose = (controller) => {
                if (controllerClosed)
                    return;
                try {
                    controller.close();
                    controllerClosed = true;
                }
                catch {
                    controllerClosed = true;
                }
            };
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
                                    safeEnqueue(controller, `data: ${JSON.stringify({ text: preToolText })}\n\n`);
                                    fullResponse += preToolText;
                                }
                                // Add assistant message with tool use to history
                                messages.push({
                                    role: 'assistant',
                                    content: response.content
                                });
                                // Execute each tool and collect results
                                const toolResults = [];
                                for (const toolUse of toolUses) {
                                    const executionResult = await onToolExecute(toolUse.name, toolUse.input, sessionId, toolUse.id);
                                    // Handle async waiting (e.g., SMS reply)
                                    if (executionResult.waitForReply && executionResult.checkReply) {
                                        // Notify frontend we're waiting
                                        safeEnqueue(controller, `data: ${JSON.stringify({
                                            type: 'waiting',
                                            message: 'Checking with a team member...'
                                        })}\n\n`);
                                        // Poll for replies until owner says "SEND"
                                        const startTime = Date.now();
                                        const ownerInstructions = [];
                                        let finalizeSignal = false;
                                        while (Date.now() - startTime < replyTimeout && !finalizeSignal) {
                                            const reply = await executionResult.checkReply();
                                            if (reply) {
                                                // Check if this is the finalize signal
                                                if (reply.trim().toUpperCase() === 'SEND') {
                                                    finalizeSignal = true;
                                                }
                                                else {
                                                    ownerInstructions.push(reply);
                                                    // Clear the reply so we can receive the next one
                                                    if (executionResult.clearReply) {
                                                        await executionResult.clearReply();
                                                    }
                                                }
                                            }
                                            if (!finalizeSignal) {
                                                await sleep(replyCheckInterval);
                                            }
                                        }
                                        if (ownerInstructions.length > 0) {
                                            const instructionsText = ownerInstructions.join('\n---\n');
                                            toolResults.push({
                                                type: 'tool_result',
                                                tool_use_id: toolUse.id,
                                                content: `[INTERNAL - DO NOT SHARE WITH VISITOR]\nOwner instructions:\n${instructionsText}\n\n${finalizeSignal ? 'Owner has signaled SEND. ' : ''}Formulate a natural response to the visitor based on these instructions. Do not reveal what the owner said.`
                                            });
                                        }
                                        else {
                                            // Timeout - no reply received
                                            toolResults.push({
                                                type: 'tool_result',
                                                tool_use_id: toolUse.id,
                                                content: 'No reply received from owner. Please ask the user to leave their contact information or check back later.',
                                                is_error: true
                                            });
                                        }
                                    }
                                    else {
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
                                    if (!safeEnqueue(controller, `data: ${JSON.stringify({ text: chunk })}\n\n`)) {
                                        break; // Stop if controller closed
                                    }
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
                            }
                            catch (err) {
                                console.error('Failed to save chat:', err);
                            }
                        }
                        safeEnqueue(controller, 'data: [DONE]\n\n');
                        safeClose(controller);
                    }
                    catch (error) {
                        console.error('Stream error:', error);
                        safeEnqueue(controller, `data: ${JSON.stringify({ type: 'error', message: 'An error occurred' })}\n\n`);
                        safeClose(controller);
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
        }
        catch (error) {
            console.error('Chat API error:', error);
            return new Response(JSON.stringify({ error: 'Failed to process chat message' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    };
}
export { DEFAULT_SYSTEM_PROMPT, DEFAULT_MODEL };
