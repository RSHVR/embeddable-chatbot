/**
 * Supabase helper for chat persistence
 *
 * Copy this file to your project: src/lib/server/supabase.ts
 *
 * Required environment variables:
 * - SUPABASE_URL
 * - SUPABASE_SECRET_KEY
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
	if (!supabaseInstance) {
		supabaseInstance = createClient(env.SUPABASE_URL!, env.SUPABASE_SECRET_KEY!);
	}
	return supabaseInstance;
}

export interface ChatMessage {
	sender: 'user' | 'bot';
	text: string;
}

export async function saveChat(sessionId: string, messages: ChatMessage[]): Promise<void> {
	const { error } = await getSupabase()
		.from('chats')
		.upsert(
			{
				session_id: sessionId,
				messages: messages,
				updated_at: new Date().toISOString()
			},
			{ onConflict: 'session_id' }
		);

	if (error) {
		console.error('Error saving chat:', error);
		throw error;
	}
}

export async function loadChat(sessionId: string): Promise<ChatMessage[] | null> {
	const { data, error } = await getSupabase()
		.from('chats')
		.select('messages')
		.eq('session_id', sessionId)
		.single();

	if (error) {
		if (error.code === 'PGRST116') {
			// No rows found - this is fine for new sessions
			return null;
		}
		console.error('Error loading chat:', error);
		return null;
	}
	return data?.messages || null;
}
