/**
 * Chat API endpoint with Twilio SMS integration
 *
 * This example shows how to set up a chatbot that can notify the business owner
 * via SMS and use their replies to inform responses.
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

import { env } from '$env/dynamic/private';
import { createClient } from '@supabase/supabase-js';
import { createChatHandler, type ToolExecutionResult } from 'embeddable-chatbot/server';
import { smsNotifyOwnerTool, executeSMSTool, type SMSToolInput, type TwilioConfig } from '$lib/server/tools/sms-notify';
import { createSMSState } from '$lib/server/sms-state';
import type { RequestHandler } from './$types';

// =============================================================================
// CUSTOMIZE THIS: Update the system prompt for your use case
// =============================================================================
const SYSTEM_PROMPT = `You are a helpful sales assistant for [Your Company]. Your goal is to qualify leads and help visitors understand our offerings.

<lead_qualification>
When you've gathered enough information about a visitor (name, interest, needs), you can notify the business owner for personalized assistance using the notify_owner_sms tool.

Consider using the SMS tool when:
- A lead seems highly qualified (e.g., ready to buy, specific budget, urgent timeline)
- The visitor has a question only the owner can answer
- You need human judgment for a complex inquiry
- The visitor requests to speak with someone
</lead_qualification>

<persona>
- Be friendly, professional, and helpful
- Ask qualifying questions naturally in conversation
- Keep responses conversational and not too long
- Don't be pushy - let the conversation flow naturally
</persona>

<instructions>
- Gather visitor information through natural conversation
- Use the SMS tool when you have a qualified lead or need owner input
- When waiting for owner reply, the system will show "Checking with a team member..."
- Once you receive the owner's reply, use it to craft your response to the visitor
</instructions>`;
// =============================================================================

export const POST: RequestHandler = async ({ request }) => {
	// Validate required environment variables
	if (!env.ANTHROPIC_API_KEY) {
		console.error('ANTHROPIC_API_KEY is not set');
		return new Response(JSON.stringify({ error: 'Chat service not configured' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
		console.error('Supabase credentials not configured');
		return new Response(JSON.stringify({ error: 'Database not configured' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	// Initialize Supabase client
	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY);
	const smsState = createSMSState({ supabase });

	// Twilio configuration
	const twilioConfig: TwilioConfig = {
		accountSid: env.TWILIO_ACCOUNT_SID || '',
		authToken: env.TWILIO_AUTH_TOKEN || '',
		fromNumber: env.TWILIO_PHONE_NUMBER || '',
		toNumber: env.OWNER_PHONE_NUMBER || ''
	};

	// Check if Twilio is configured
	const twilioConfigured = Boolean(
		twilioConfig.accountSid &&
		twilioConfig.authToken &&
		twilioConfig.fromNumber &&
		twilioConfig.toNumber
	);

	// Tool executor function
	async function handleToolExecution(
		toolName: string,
		input: Record<string, unknown>,
		sessionId: string,
		toolUseId: string
	): Promise<ToolExecutionResult> {
		if (toolName === 'notify_owner_sms') {
			if (!twilioConfigured) {
				return {
					result: 'SMS notifications are not configured. Please ask the user for their contact information instead.'
				};
			}

			const smsInput = input as SMSToolInput;

			// Create pending SMS record
			await smsState.createPendingSMS(
				sessionId,
				toolUseId,
				smsInput.message,
				smsInput.context_summary ? { summary: smsInput.context_summary } : undefined
			);

			// Send the SMS
			const sendResult = await executeSMSTool(smsInput, twilioConfig);

			if (sendResult.includes('Failed')) {
				return { result: sendResult };
			}

			// Return with async wait handling
			return {
				result: sendResult,
				waitForReply: true,
				checkReply: async () => {
					const replied = await smsState.checkForReply(sessionId);
					return replied?.owner_reply || null;
				}
			};
		}

		// Unknown tool
		return {
			result: `Unknown tool: ${toolName}`
		};
	}

	// Save chat function
	async function saveChat(sessionId: string, messages: Array<{ sender: 'user' | 'bot'; text: string }>) {
		const { error } = await supabase
			.from('chats')
			.upsert({
				session_id: sessionId,
				messages: messages,
				updated_at: new Date().toISOString()
			}, { onConflict: 'session_id' });

		if (error) {
			console.error('Error saving chat:', error);
		}
	}

	// Create handler with SMS tool
	const handler = createChatHandler({
		apiKey: env.ANTHROPIC_API_KEY,
		systemPrompt: SYSTEM_PROMPT,
		tools: twilioConfigured ? [smsNotifyOwnerTool] : [],
		onToolExecute: handleToolExecution,
		onSave: saveChat,
		// Configure timeouts for SMS replies
		replyCheckInterval: 2000, // Check every 2 seconds
		replyTimeout: 300000 // 5 minute timeout
	});

	return handler(request);
};
