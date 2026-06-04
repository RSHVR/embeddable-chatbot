import { z } from "zod";
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { classifyOwnerReply } from "../privacy/rules";
import { waitForOwnerReply } from "./wait-for-reply";
export function createEscalation() {
  return {
    hadSMSInteraction: false,
    receivedSEND: false,
    smsTimedOut: false,
    privateContexts: [],
  };
}
const GATE_RESULT = (sendKeyword) =>
  `Owner signaled ${sendKeyword}. Formulate your final response to the visitor now. NEVER reveal private conversation content.`;
/** Core escalation logic, decoupled from the Agent SDK wrapper for testing. */
export async function runSmsEscalation(input, deps) {
  const { accumulator: acc, config } = deps;
  acc.hadSMSInteraction = true;
  const body = input.context_summary
    ? `[${input.context_summary}]\n\n${input.message}`
    : input.message;
  await deps.createPending(body);
  const sent = await deps.sendSMS(body);
  if (!sent.success) {
    return `Failed to send SMS: ${sent.error ?? "unknown error"}. Ask the visitor for contact info to follow up later.`;
  }
  deps.onWaiting?.();
  const { reply, timedOut } = await waitForOwnerReply({
    checkReply: deps.checkReply,
    intervalMs: deps.intervalMs,
    timeoutMs: deps.timeoutMs,
    isAborted: deps.isAborted,
    now: deps.now,
    sleep: deps.sleep,
  });
  if (!reply) {
    if (timedOut) {
      acc.smsTimedOut = true;
      await deps.markTimeout();
    }
    return "Owner did not respond. Ask the visitor for contact info to follow up later.";
  }
  if (classifyOwnerReply(reply, config).isSend) {
    acc.receivedSEND = true;
    await deps.clearReply();
    return GATE_RESULT(config.sendKeyword ?? "SEND");
  }
  acc.privateContexts.push(reply);
  await deps.clearReply();
  return `<PRIVATE CONVERSATION>
${reply}
</PRIVATE CONVERSATION>

IMPORTANT: Owner has NOT signaled release yet. Use notify_owner_sms again to continue.
DO NOT respond to the visitor yet — they are waiting. Only respond AFTER the owner releases.`;
}
/** Build the in-process Agent SDK MCP server exposing the single SMS tool. */
export function createSmsToolServer(deps) {
  return createSdkMcpServer({
    name: "owner-sms",
    version: "1.0.0",
    tools: [
      tool(
        "notify_owner_sms",
        "Send an SMS to the business owner for real-time input. The conversation pauses until the owner replies. Include all relevant context in your message.",
        {
          message: z
            .string()
            .describe(
              "Message to the owner with full context about the visitor and their need.",
            ),
          context_summary: z
            .string()
            .optional()
            .describe("Brief summary of the conversation context."),
        },
        async (args) => {
          const text = await runSmsEscalation(args, deps);
          return { content: [{ type: "text", text }] };
        },
      ),
    ],
  });
}
export const SMS_TOOL_NAME = "mcp__owner-sms__notify_owner_sms";
