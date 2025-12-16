export declare const supabase: import("@supabase/supabase-js").SupabaseClient<any, "public", "public", any, any>;
export interface ChatMessage {
    sender: 'user' | 'bot';
    text: string;
}
export interface ChatSession {
    id: string;
    session_id: string;
    messages: ChatMessage[];
    created_at: string;
    updated_at: string;
}
export declare function saveChat(sessionId: string, messages: ChatMessage[]): Promise<any>;
export declare function loadChat(sessionId: string): Promise<ChatMessage[] | null>;
