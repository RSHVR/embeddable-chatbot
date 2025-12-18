import type { Tool } from '@anthropic-ai/sdk/resources/messages';
export interface ChatMessage {
    sender: 'user' | 'bot';
    text: string;
}
/**
 * Result of executing a tool
 */
export interface ToolExecutionResult {
    result: string;
    /** If true, the handler will wait for an external event (e.g., SMS reply) before continuing */
    waitForReply?: boolean;
    /** Callback to check if the reply has arrived */
    checkReply?: () => Promise<string | null>;
}
/**
 * Tool executor function type
 */
export type ToolExecutor = (toolName: string, input: Record<string, unknown>, sessionId: string, toolUseId: string) => Promise<ToolExecutionResult>;
export interface ChatHandlerOptions {
    apiKey: string;
    systemPrompt?: string;
    model?: string;
    maxTokens?: number;
    /** Tools available to the agent */
    tools?: Tool[];
    /** Custom tool executor - called when Claude uses a tool */
    onToolExecute?: ToolExecutor;
    /** Save chat history callback */
    onSave?: (sessionId: string, history: ChatMessage[]) => Promise<void>;
    /** Maximum number of tool execution rounds (default: 10) */
    maxToolRounds?: number;
    /** How often to check for async replies in ms (default: 2000) */
    replyCheckInterval?: number;
    /** Maximum time to wait for async reply in ms (default: 300000 = 5 min) */
    replyTimeout?: number;
}
declare const DEFAULT_SYSTEM_PROMPT = "You are a helpful AI assistant. Be friendly, concise, and helpful.\n\nGuidelines:\n- Keep responses brief (1-3 sentences when possible)\n- Be conversational and approachable\n- If you don't know something, be honest about it\n- Ask clarifying questions when needed";
declare const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";
export declare function createChatHandler(options: ChatHandlerOptions): (request: Request) => Promise<Response>;
export { DEFAULT_SYSTEM_PROMPT, DEFAULT_MODEL };
export type { Tool, ToolExecutionResult, ToolExecutor, ChatHandlerOptions };
