/**
 * SMS State Management for Twilio Integration
 *
 * Manages pending SMS records in Supabase for two-way communication
 * between the chatbot agent and business owner.
 *
 * Required Supabase table:
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

import type { SupabaseClient } from '@supabase/supabase-js';

export interface PendingSMS {
	id: string;
	session_id: string;
	tool_use_id: string;
	message_to_owner: string;
	owner_reply: string | null;
	status: 'pending' | 'replied' | 'timeout';
	created_at: string;
	replied_at: string | null;
	conversation_context: Record<string, unknown> | null;
}

export interface SMSStateOptions {
	supabase: SupabaseClient;
}

export function createSMSState(options: SMSStateOptions) {
	const { supabase } = options;

	/**
	 * Create a pending SMS record when the agent sends a message to the owner
	 */
	async function createPendingSMS(
		sessionId: string,
		toolUseId: string,
		message: string,
		context?: Record<string, unknown>
	): Promise<PendingSMS> {
		const { data, error } = await supabase
			.from('pending_sms')
			.insert({
				session_id: sessionId,
				tool_use_id: toolUseId,
				message_to_owner: message,
				conversation_context: context || null
			})
			.select()
			.single();

		if (error) {
			console.error('Error creating pending SMS:', error);
			throw new Error(`Failed to create pending SMS: ${error.message}`);
		}

		return data as PendingSMS;
	}

	/**
	 * Get the most recent pending SMS for a session
	 */
	async function getPendingSMS(sessionId: string): Promise<PendingSMS | null> {
		const { data, error } = await supabase
			.from('pending_sms')
			.select('*')
			.eq('session_id', sessionId)
			.eq('status', 'pending')
			.order('created_at', { ascending: false })
			.limit(1)
			.single();

		if (error) {
			if (error.code === 'PGRST116') {
				// No rows found
				return null;
			}
			console.error('Error getting pending SMS:', error);
			return null;
		}

		return data as PendingSMS;
	}

	/**
	 * Get the most recent pending SMS (for webhook matching)
	 */
	async function getMostRecentPendingSMS(): Promise<PendingSMS | null> {
		const { data, error } = await supabase
			.from('pending_sms')
			.select('*')
			.eq('status', 'pending')
			.order('created_at', { ascending: false })
			.limit(1)
			.single();

		if (error) {
			if (error.code === 'PGRST116') {
				return null;
			}
			console.error('Error getting most recent pending SMS:', error);
			return null;
		}

		return data as PendingSMS;
	}

	/**
	 * Update a pending SMS with the owner's reply
	 */
	async function updateSMSReply(id: string, reply: string): Promise<PendingSMS> {
		const { data, error } = await supabase
			.from('pending_sms')
			.update({
				owner_reply: reply,
				status: 'replied',
				replied_at: new Date().toISOString()
			})
			.eq('id', id)
			.select()
			.single();

		if (error) {
			console.error('Error updating SMS reply:', error);
			throw new Error(`Failed to update SMS reply: ${error.message}`);
		}

		return data as PendingSMS;
	}

	/**
	 * Mark a pending SMS as timed out
	 */
	async function markSMSTimeout(sessionId: string): Promise<void> {
		const { error } = await supabase
			.from('pending_sms')
			.update({ status: 'timeout' })
			.eq('session_id', sessionId)
			.eq('status', 'pending');

		if (error) {
			console.error('Error marking SMS timeout:', error);
		}
	}

	/**
	 * Check if a session has a replied SMS (for polling)
	 */
	async function checkForReply(sessionId: string): Promise<PendingSMS | null> {
		const { data, error } = await supabase
			.from('pending_sms')
			.select('*')
			.eq('session_id', sessionId)
			.eq('status', 'replied')
			.order('replied_at', { ascending: false })
			.limit(1)
			.single();

		if (error) {
			if (error.code === 'PGRST116') {
				return null;
			}
			console.error('Error checking for reply:', error);
			return null;
		}

		return data as PendingSMS;
	}

	return {
		createPendingSMS,
		getPendingSMS,
		getMostRecentPendingSMS,
		updateSMSReply,
		markSMSTimeout,
		checkForReply
	};
}

export type SMSState = ReturnType<typeof createSMSState>;
