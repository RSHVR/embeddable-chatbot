import { type PrivacyConfig } from "../privacy/rules";
/** Per-turn accumulator the agentTurn node reads back into graph state. */
export interface Escalation {
  hadSMSInteraction: boolean;
  receivedSEND: boolean;
  smsTimedOut: boolean;
  privateContexts: string[];
}
export declare function createEscalation(): Escalation;
export interface SmsEscalationDeps {
  sendSMS: (message: string) => Promise<{
    success: boolean;
    sid?: string;
    error?: string;
  }>;
  createPending: (message: string) => Promise<{
    id: string;
  }>;
  checkReply: () => Promise<string | null>;
  clearReply: () => Promise<void>;
  markTimeout: () => Promise<void>;
  config: PrivacyConfig;
  accumulator: Escalation;
  intervalMs: number;
  timeoutMs: number;
  onWaiting?: () => void;
  isAborted?: () => boolean;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}
/**
 * The integrator-facing slice of escalation deps: just the IO wiring (Twilio + Supabase).
 * The chat handler supplies `config`, `accumulator`, `onWaiting`, and the timeouts itself.
 */
export type SmsIODeps = Pick<
  SmsEscalationDeps,
  "sendSMS" | "createPending" | "checkReply" | "clearReply" | "markTimeout"
> &
  Partial<Pick<SmsEscalationDeps, "isAborted" | "now" | "sleep">>;
/** Core escalation logic, decoupled from the Agent SDK wrapper for testing. */
export declare function runSmsEscalation(
  input: {
    message: string;
    context_summary?: string;
  },
  deps: SmsEscalationDeps,
): Promise<string>;
/** Build the in-process Agent SDK MCP server exposing the single SMS tool. */
export declare function createSmsToolServer(
  deps: SmsEscalationDeps,
): import("@anthropic-ai/claude-agent-sdk").McpSdkServerConfigWithInstance;
export declare const SMS_TOOL_NAME = "mcp__owner-sms__notify_owner_sms";
