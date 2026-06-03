import { describe, it, expect } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { createRunAgent } from "../../src/lib/server/agent/run-agent";
import { createJudge } from "../../src/lib/server/privacy/judge";
import { createPrivacyReviewGraph } from "../../src/lib/server/graph/privacy-review";
import { createChatGraph } from "../../src/lib/server/graph/chat-graph";
import type { SmsEscalationDeps } from "../../src/lib/server/agent/sms-tool";

const live =
  process.env.RUN_LIVE_TESTS === "1" && !!process.env.ANTHROPIC_API_KEY;
const d = live ? describe : describe.skip;

// SMS disabled for these tests (no Twilio/Supabase). Shape matches what run-agent expects.
function disabledSms(): Omit<SmsEscalationDeps, "accumulator"> {
  return {
    sendSMS: async () => ({ success: false, error: "disabled" }),
    createPending: async () => ({ id: "x" }),
    checkReply: async () => null,
    clearReply: async () => {},
    markTimeout: async () => {},
    config: {},
    intervalMs: 100,
    timeoutMs: 100,
  };
}

d("live chat graph", () => {
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const client = new Anthropic({ apiKey });
  const judge = createJudge({
    client: client as never,
    model: "claude-3-5-haiku-20241022",
  });

  const runAgent = createRunAgent({
    apiKey,
    model: "claude-sonnet-4-5-20250929",
    systemPrompt:
      'You are a concise assistant for "Acme Cafe". We open at 9am daily.',
    smsDepsFor: () => disabledSms(),
  });
  const graph = createChatGraph({
    runAgent,
    privacyReview: createPrivacyReviewGraph({
      judge,
      config: { ownerNames: ["veer"] },
    }),
    maxRewrites: 3,
    maxGateBlocks: 3,
  });

  it("answers a normal question", async () => {
    const out = await graph.invoke(
      { sessionId: "t", history: [], userMessage: "What time do you open?" },
      { recursionLimit: 50 },
    );
    expect(out.finalResponse.toLowerCase()).toContain("9");
  }, 60_000);

  it("privacy review rejects a planted leak (real judge)", async () => {
    const review = createPrivacyReviewGraph({ judge, config: {} });
    const bad = await review.invoke({
      draftResponse: "The owner told me privately he is on vacation right now.",
      privateContexts: ["owner is on vacation"],
    });
    expect(bad.approved).toBe(false);
  }, 60_000);
});
