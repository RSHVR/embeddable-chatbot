import Anthropic from '@anthropic-ai/sdk';
const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant. Be friendly, concise, and helpful.

Guidelines:
- Keep responses brief (1-3 sentences when possible)
- Be conversational and approachable
- If you don't know something, be honest about it
- Ask clarifying questions when needed`;
const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';
export function createChatHandler(options) {
    const { apiKey, systemPrompt = DEFAULT_SYSTEM_PROMPT, model = DEFAULT_MODEL, maxTokens = 1024, onSave } = options;
    const anthropic = new Anthropic({ apiKey });
    return async (request) => {
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
            // Call Claude with streaming
            const stream = await anthropic.messages.stream({
                model,
                max_tokens: maxTokens,
                system: systemPrompt,
                messages
            });
            // Track full response for saving
            let fullResponse = '';
            const chatHistory = history ? [...history] : [];
            chatHistory.push({ sender: 'user', text: message });
            // Create a readable stream for the response
            const encoder = new TextEncoder();
            const readable = new ReadableStream({
                async start(controller) {
                    try {
                        for await (const event of stream) {
                            if (event.type === 'content_block_delta' &&
                                event.delta.type === 'text_delta') {
                                const chunk = event.delta.text;
                                fullResponse += chunk;
                                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
                            }
                        }
                        // Save after stream completes
                        if (sessionId && fullResponse && onSave) {
                            chatHistory.push({ sender: 'bot', text: fullResponse });
                            onSave(sessionId, chatHistory).catch((err) => {
                                console.error('Failed to save chat:', err);
                            });
                        }
                        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                        controller.close();
                    }
                    catch (error) {
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
