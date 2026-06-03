import type { RequestHandler } from "./$types";
import { createChatHandler } from "$lib/server";
import { SYSTEM_PROMPT, MODEL } from "$lib/server/chat-context";
import { ANTHROPIC_API_KEY } from "$env/static/private";

const handler = createChatHandler({
  apiKey: ANTHROPIC_API_KEY,
  systemPrompt: SYSTEM_PROMPT,
  model: MODEL,
  privacy: { ownerNames: ["veer"], sendKeyword: "SEND" },
  // To enable SMS escalation, provide `smsDepsFor` wired to Twilio + Supabase.
  // See examples/api-chat-with-sms.ts for the full wiring.
});

export const POST: RequestHandler = async ({ request }) => handler(request);
