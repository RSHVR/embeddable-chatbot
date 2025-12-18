/**
 * Twilio Webhook Endpoint
 *
 * Receives incoming SMS replies from the business owner and updates
 * the pending SMS record in Supabase.
 *
 * Configure this URL in your Twilio phone number settings:
 * https://your-domain.com/api/webhooks/twilio
 *
 * Required environment variables:
 * - TWILIO_AUTH_TOKEN (for signature validation)
 * - OWNER_PHONE_NUMBER (to validate sender)
 * - SUPABASE_URL
 * - SUPABASE_SECRET_KEY
 */

import { env } from '$env/dynamic/private';
import { createClient } from '@supabase/supabase-js';
import { validateTwilioSignature, parseTwilioWebhook } from '$lib/server/tools/sms-notify.js';
import { createSMSState } from '$lib/server/sms-state.js';
import type { RequestEvent } from '@sveltejs/kit';

export async function POST({ request, url }: RequestEvent): Promise<Response> {
	try {
		// Parse the webhook body
		const bodyText = await request.text();
		const params = parseTwilioWebhook(bodyText);

		// Validate Twilio signature (security)
		const signature = request.headers.get('X-Twilio-Signature') || '';
		const webhookUrl = url.toString();

		if (env.TWILIO_AUTH_TOKEN) {
			const isValid = await validateTwilioSignature(
				env.TWILIO_AUTH_TOKEN,
				signature,
				webhookUrl,
				params
			);

			if (!isValid) {
				console.error('Invalid Twilio signature');
				return new Response('Invalid signature', { status: 403 });
			}
		}

		// Extract SMS details
		const from = params.From || '';
		const body = params.Body || '';

		// Validate sender is the owner
		const ownerNumber = env.OWNER_PHONE_NUMBER || '';
		if (ownerNumber && from !== ownerNumber) {
			console.log(`SMS from unknown number: ${from}`);
			// Return 200 to Twilio but ignore the message
			return new Response(twimlResponse('Message received'), {
				headers: { 'Content-Type': 'text/xml' }
			});
		}

		// Initialize Supabase and SMS state
		if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
			console.error('Supabase credentials not configured');
			return new Response('Server configuration error', { status: 500 });
		}

		const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY);
		const smsState = createSMSState({ supabase });

		// Find the most recent pending SMS
		const pendingSMS = await smsState.getMostRecentPendingSMS();

		if (!pendingSMS) {
			console.log('No pending SMS found for reply');
			return new Response(twimlResponse('No pending conversation found'), {
				headers: { 'Content-Type': 'text/xml' }
			});
		}

		// Update with the reply
		await smsState.updateSMSReply(pendingSMS.id, body);

		console.log(`SMS reply received for session ${pendingSMS.session_id}: ${body.substring(0, 50)}...`);

		// Return TwiML response (optional confirmation)
		return new Response(twimlResponse('Reply received, thanks!'), {
			headers: { 'Content-Type': 'text/xml' }
		});
	} catch (error) {
		console.error('Webhook error:', error);
		return new Response('Internal server error', { status: 500 });
	}
}

/**
 * Generate TwiML response
 */
function twimlResponse(message?: string): string {
	if (message) {
		return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(message)}</Message>
</Response>`;
	}
	return `<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>`;
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}
