import { query } from "@anthropic-ai/claude-agent-sdk";
import {
  createEscalation,
  createSmsToolServer,
  SMS_TOOL_NAME,
} from "./sms-tool";
/**
 * Render the conversation into a single prompt string for the Agent SDK.
 *
 * The Agent SDK's streaming input only accepts USER messages, so prior assistant
 * turns can't be replayed structurally. For a stateless-per-request server that
 * receives full history each call, we render a transcript and append the new turn
 * (plus any privacy/gate feedback) as the live instruction.
 */
export function renderPrompt(history, userMessage, feedback) {
  const parts = [];
  if (history.length > 0) {
    const transcript = history
      .map((m) => `${m.sender === "user" ? "Visitor" : "Assistant"}: ${m.text}`)
      .join("\n");
    parts.push(`Previous conversation:\n${transcript}`);
  }
  parts.push(`Visitor: ${userMessage}`);
  if (feedback)
    parts.push(`[SYSTEM NOTE — not visible to the visitor]\n${feedback}`);
  return parts.join("\n\n");
}
/** Pull the final assistant text out of the Agent SDK message stream. */
export function extractResultText(messages) {
  for (const m of messages) {
    if (m.type === "result" && m.subtype === "success") return m.result;
  }
  return "";
}
export function createRunAgent(config) {
  return async ({ history, userMessage, feedback }) => {
    const accumulator = createEscalation();
    const smsServer = createSmsToolServer({
      ...config.smsDepsFor(accumulator),
      accumulator,
    });
    const prompt = renderPrompt(history, userMessage, feedback);
    const collected = [];
    for await (const message of query({
      prompt,
      options: {
        model: config.model,
        systemPrompt: config.systemPrompt,
        settingSources: [], // no CLAUDE.md / filesystem settings
        mcpServers: { "owner-sms": smsServer },
        allowedTools: [SMS_TOOL_NAME], // ONLY the SMS tool — no fs/bash access
        maxTurns: config.maxTurns ?? 10,
        env: { ...process.env, ANTHROPIC_API_KEY: config.apiKey },
      },
    })) {
      collected.push(message);
    }
    return { text: extractResultText(collected), escalation: accumulator };
  };
}
