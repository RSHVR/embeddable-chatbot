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
export function createSMSState(options) {
    const { supabase } = options;
    /**
     * Create a pending SMS record when the agent sends a message to the owner
     */
    async function createPendingSMS(sessionId, toolUseId, message, context) {
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
        return data;
    }
    /**
     * Get the most recent pending SMS for a session
     */
    async function getPendingSMS(sessionId) {
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
        return data;
    }
    /**
     * Get the most recent pending SMS (for webhook matching)
     */
    async function getMostRecentPendingSMS() {
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
        return data;
    }
    /**
     * Update a pending SMS with the owner's reply
     */
    async function updateSMSReply(id, reply) {
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
        return data;
    }
    /**
     * Mark a pending SMS as timed out
     */
    async function markSMSTimeout(sessionId) {
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
    async function checkForReply(sessionId) {
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
        return data;
    }
    /**
     * Clear the current reply so we can receive the next one (for multi-turn conversations)
     * Sets the record back to pending state so the next SMS can be captured
     */
    async function clearCurrentReply(sessionId) {
        const { error } = await supabase
            .from('pending_sms')
            .update({
            owner_reply: null,
            replied_at: null,
            status: 'pending'
        })
            .eq('session_id', sessionId)
            .eq('status', 'replied');
        if (error) {
            console.error('Error clearing current reply:', error);
        }
    }
    return {
        createPendingSMS,
        getPendingSMS,
        getMostRecentPendingSMS,
        updateSMSReply,
        markSMSTimeout,
        checkForReply,
        clearCurrentReply
    };
}
