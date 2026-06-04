import type { Escalation, SmsIODeps } from "./agent/sms-tool";
import type { PrivacyConfig } from "./privacy/rules";
import type { ChatMessage } from "./types";
export declare const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful AI assistant. Be friendly, concise, and helpful.\n\nGuidelines:\n- Keep responses brief (1-3 sentences when possible)\n- Be conversational and approachable\n- If you don't know something, be honest about it\n- Ask clarifying questions when needed";
export declare const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";
export declare const DEFAULT_JUDGE_MODEL = "claude-3-5-haiku-20241022";
export interface ChatHandlerOptions {
  apiKey: string;
  systemPrompt?: string;
  model?: string;
  judgeModel?: string;
  privacy?: PrivacyConfig;
  maxRewrites?: number;
  maxGateBlocks?: number;
  maxToolTurns?: number;
  replyCheckInterval?: number;
  replyTimeout?: number;
  /** Build SMS IO deps for a session (Twilio + Supabase wiring). Omit to disable SMS. */
  smsDepsFor?: (
    sessionId: string,
    accumulator: Escalation,
    onWaiting: () => void,
  ) => SmsIODeps;
  onSave?: (sessionId: string, history: ChatMessage[]) => Promise<void>;
}
/** Bridge a finished graph result onto the SSE protocol the widget expects. */
export declare function streamGraphResultToSSE(
  result: {
    finalResponse: string;
  },
  opts?: {
    chunkSize?: number;
    delayMs?: number;
  },
): ReadableStream<Uint8Array>;
export declare function createChatHandler(
  options: ChatHandlerOptions,
): (request: Request) => Promise<Response>;
export type { ChatMessage } from "./types";
export type { PrivacyConfig } from "./privacy/rules";
export type {
  Escalation,
  SmsEscalationDeps,
  SmsIODeps,
} from "./agent/sms-tool";
export type { RunAgentFn } from "./agent/run-agent";
