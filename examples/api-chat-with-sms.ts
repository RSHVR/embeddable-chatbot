/**
 * Chat API endpoint with Twilio SMS integration
 *
 * This example shows how to set up a chatbot that can notify the business owner
 * via SMS and use their replies to inform responses — using the LangGraph +
 * Claude Agent SDK chat handler.
 *
 * Copy this file to your project: src/routes/api/chat/+server.ts
 *
 * Required environment variables:
 * - ANTHROPIC_API_KEY
 * - SUPABASE_URL
 * - SUPABASE_SECRET_KEY
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_AUTH_TOKEN
 * - TWILIO_PHONE_NUMBER
 * - OWNER_PHONE_NUMBER
 *
 * Required Supabase table (run this SQL):
 * ```sql
 * CREATE TABLE pending_sms (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   session_id TEXT NOT NULL,
 *   tool_use_id TEXT NOT NULL,
 *   message_to_owner TEXT NOT NULL,
 *   owner_reply TEXT,
 *   status TEXT NOT NULL DEFAULT 'pending',
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   replied_at TIMESTAMPTZ,
 *   conversation_context JSONB
 * );
 *
 * CREATE INDEX idx_pending_sms_session ON pending_sms(session_id);
 * CREATE INDEX idx_pending_sms_status ON pending_sms(status) WHERE status = 'pending';
 * ```
 */

import { env } from "$env/dynamic/private";
import { createClient } from "@supabase/supabase-js";
import { createChatHandler } from "embeddable-chatbot/server";
import { sendSMS, type TwilioConfig } from "$lib/server/tools/sms-notify";
import { createSMSState } from "$lib/server/sms-state";
import type { RequestHandler } from "./$types";

// =============================================================================
// CUSTOMIZE THIS: Update the system prompt for your use case
// =============================================================================
const SYSTEM_PROMPT = `You are a helpful sales assistant for [Your Company]. Your goal is to qualify leads and help visitors understand our offerings.

<lead_qualification>
When you've gathered enough information about a visitor (name, interest, needs), you can notify the business owner for personalized assistance using the notify_owner_sms tool.

Consider using the SMS tool when:
- A lead seems highly qualified (ready to buy, specific budget, urgent timeline)
- The visitor has a question only the owner can answer
- The visitor requests to speak with someone
</lead_qualification>

<persona>
- Be friendly, professional, and helpful
- Ask qualifying questions naturally in conversation
- Keep responses conversational and not too long
</persona>`;
// =============================================================================

export const POST: RequestHandler = async ({ request }) => {
  if (!env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "Chat service not configured" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    return new Response(JSON.stringify({ error: "Database not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY);
  const smsState = createSMSState({ supabase });

  const twilio: TwilioConfig = {
    accountSid: env.TWILIO_ACCOUNT_SID || "",
    authToken: env.TWILIO_AUTH_TOKEN || "",
    fromNumber: env.TWILIO_PHONE_NUMBER || "",
    toNumber: env.OWNER_PHONE_NUMBER || "",
  };
  const twilioConfigured = Boolean(
    twilio.accountSid &&
    twilio.authToken &&
    twilio.fromNumber &&
    twilio.toNumber,
  );

  const handler = createChatHandler({
    apiKey: env.ANTHROPIC_API_KEY,
    systemPrompt: SYSTEM_PROMPT,
    privacy: { ownerNames: ["veer"], sendKeyword: "SEND" },
    replyCheckInterval: 2000, // poll for the owner's reply every 2s
    replyTimeout: 300_000, // give up after 5 minutes
    // Wire the in-process SMS tool to Twilio (send) + Supabase (state).
    // Omit `smsDepsFor` entirely to disable SMS escalation.
    smsDepsFor: twilioConfigured
      ? (sessionId) => ({
          sendSMS: (message) => sendSMS(twilio, message),
          createPending: async (message) => {
            const rec = await smsState.createPendingSMS(
              sessionId,
              `tool-${sessionId}`,
              message,
            );
            return { id: rec.id };
          },
          checkReply: async () => {
            const replied = await smsState.checkForReply(sessionId);
            return replied?.owner_reply ?? null;
          },
          clearReply: async () => {
            await smsState.clearCurrentReply(sessionId);
          },
          markTimeout: async () => {
            await smsState.markSMSTimeout(sessionId);
          },
        })
      : undefined,
    onSave: async (sessionId, messages) => {
      const { error } = await supabase.from("chats").upsert(
        {
          session_id: sessionId,
          messages,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "session_id" },
      );
      if (error) console.error("Error saving chat:", error);
    },
  });

  return handler(request);
};
