import { type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { ChatMessage } from "../types";
import { type Escalation, type SmsEscalationDeps } from "./sms-tool";
/**
 * Render the conversation into a single prompt string for the Agent SDK.
 *
 * The Agent SDK's streaming input only accepts USER messages, so prior assistant
 * turns can't be replayed structurally. For a stateless-per-request server that
 * receives full history each call, we render a transcript and append the new turn
 * (plus any privacy/gate feedback) as the live instruction.
 */
export declare function renderPrompt(
  history: ChatMessage[],
  userMessage: string,
  feedback?: string,
): string;
/** Pull the final assistant text out of the Agent SDK message stream. */
export declare function extractResultText(messages: SDKMessage[]): string;
export interface RunAgentResult {
  text: string;
  escalation: Escalation;
}
export type RunAgentFn = (input: {
  history: ChatMessage[];
  userMessage: string;
  feedback?: string;
}) => Promise<RunAgentResult>;
export interface RunAgentConfig {
  apiKey: string;
  model: string;
  systemPrompt: string;
  maxTurns?: number;
  /** Factory producing the SMS escalation deps for a fresh accumulator each turn. */
  smsDepsFor: (
    accumulator: Escalation,
  ) => Omit<SmsEscalationDeps, "accumulator">;
}
export declare function createRunAgent(config: RunAgentConfig): RunAgentFn;
