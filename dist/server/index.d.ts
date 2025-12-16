import { type ChatMessage } from '../supabase';
export interface ChatHandlerOptions {
    apiKey: string;
    systemPrompt?: string;
    model?: string;
    maxTokens?: number;
    onSave?: (sessionId: string, history: ChatMessage[]) => Promise<void>;
}
declare const DEFAULT_SYSTEM_PROMPT = "You are a helpful AI assistant. Be friendly, concise, and helpful.\n\nGuidelines:\n- Keep responses brief (1-3 sentences when possible)\n- Be conversational and approachable\n- If you don't know something, be honest about it\n- Ask clarifying questions when needed";
declare const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";
export declare function createChatHandler(options: ChatHandlerOptions): (request: Request) => Promise<Response>;
export { DEFAULT_SYSTEM_PROMPT, DEFAULT_MODEL };
export type { ChatMessage };
