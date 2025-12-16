import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT, MODEL } from '$lib/server/chat-context';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import { saveChat, type ChatMessage } from '$lib/supabase';

const anthropic = new Anthropic({
	apiKey: ANTHROPIC_API_KEY
});

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { message, sessionId, history } = await request.json();

		if (!message || typeof message !== 'string') {
			return json({ error: 'Message is required' }, { status: 400 });
		}

		// Convert chat history to Claude message format
		const messages: Anthropic.MessageParam[] = [];

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

		// Call Claude with streaming
		const stream = await anthropic.messages.stream({
			model: MODEL,
			max_tokens: 1024,
			system: SYSTEM_PROMPT,
			messages
		});

		// Track full response for saving to Supabase
		let fullResponse = '';
		const chatHistory: ChatMessage[] = history ? [...history] : [];
		chatHistory.push({ sender: 'user', text: message });

		// Create a readable stream for the response
		const encoder = new TextEncoder();
		const readable = new ReadableStream({
			async start(controller) {
				try {
					for await (const event of stream) {
						if (
							event.type === 'content_block_delta' &&
							event.delta.type === 'text_delta'
						) {
							const chunk = event.delta.text;
							fullResponse += chunk;
							controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
						}
					}

					// Save to Supabase after stream completes
					if (sessionId && fullResponse) {
						chatHistory.push({ sender: 'bot', text: fullResponse });
						saveChat(sessionId, chatHistory).catch(err => {
							console.error('Failed to save chat:', err);
						});
					}

					controller.enqueue(encoder.encode('data: [DONE]\n\n'));
					controller.close();
				} catch (error) {
					console.error('Stream error:', error);
					controller.error(error);
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
		return json({ error: 'Failed to process chat message' }, { status: 500 });
	}
};
