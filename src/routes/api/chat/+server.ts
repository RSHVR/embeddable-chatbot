import type { RequestHandler } from './$types';
import { createChatHandler } from '$lib/server';
import { SYSTEM_PROMPT, MODEL } from '$lib/server/chat-context';
import { ANTHROPIC_API_KEY } from '$env/static/private';

const handler = createChatHandler({
	apiKey: ANTHROPIC_API_KEY,
	systemPrompt: SYSTEM_PROMPT,
	model: MODEL
});

export const POST: RequestHandler = async ({ request }) => {
	return handler(request);
};
