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
export declare function createSMSState(options: SMSStateOptions): {
    createPendingSMS: (sessionId: string, toolUseId: string, message: string, context?: Record<string, unknown>) => Promise<PendingSMS>;
    getPendingSMS: (sessionId: string) => Promise<PendingSMS | null>;
    getMostRecentPendingSMS: () => Promise<PendingSMS | null>;
    updateSMSReply: (id: string, reply: string) => Promise<PendingSMS>;
    markSMSTimeout: (sessionId: string) => Promise<void>;
    checkForReply: (sessionId: string) => Promise<PendingSMS | null>;
    clearCurrentReply: (sessionId: string) => Promise<void>;
};
export type SMSState = ReturnType<typeof createSMSState>;
