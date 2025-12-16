import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
export const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
export async function saveChat(sessionId, messages) {
    const { data, error } = await supabase
        .from('chats')
        .upsert({
        session_id: sessionId,
        messages: messages,
        updated_at: new Date().toISOString()
    }, { onConflict: 'session_id' })
        .select()
        .single();
    if (error) {
        console.error('Error saving chat:', error);
        return null;
    }
    return data;
}
export async function loadChat(sessionId) {
    const { data, error } = await supabase
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
