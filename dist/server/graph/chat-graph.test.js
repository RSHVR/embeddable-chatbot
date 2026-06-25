import { describe, it, expect, vi } from "vitest";
import { createChatGraph } from "./chat-graph";
import { createEscalation } from "../agent/sms-tool";
import { SAFE_FALLBACK_MESSAGE } from "./nodes";
function build(opts) {
  let call = 0;
  const runAgent = vi.fn(async () => {
    const i = call++;
    return {
      text: opts.agentTexts[Math.min(i, opts.agentTexts.length - 1)],
      escalation: opts.escalations?.[i] ?? createEscalation(),
    };
  });
  let judged = 0;
  const privacyReview = {
    invoke: vi.fn(async () => ({
      approved: opts.approvals[Math.min(judged++, opts.approvals.length - 1)],
      rejectionReason: "leak",
    })),
  };
  return createChatGraph({
    runAgent,
    privacyReview,
    maxRewrites: 3,
    maxGateBlocks: 3,
  });
}
const init = {
  sessionId: "s",
  history: [],
  userMessage: "hours?",
  privateContexts: [],
  hadSMSInteraction: false,
  receivedSEND: false,
  smsTimedOut: false,
  rewriteCount: 0,
  gateBlockCount: 0,
};
describe("chat graph", () => {
  it("clean path: agentTurn -> gate -> privacyReview -> finalize", async () => {
    const g = build({ agentTexts: ["We open at 9am."], approvals: [true] });
    const out = await g.invoke(init);
    expect(out.finalResponse).toBe("We open at 9am.");
  });
  it("rewrite path: rejected once, then approved", async () => {
    const g = build({
      agentTexts: ["leaky", "clean"],
      approvals: [false, true],
    });
    const out = await g.invoke(init);
    expect(out.finalResponse).toBe("clean");
    expect(out.rewriteCount).toBe(1);
  });
  it("rewrite cap: always rejected -> safeFallback", async () => {
    const g = build({
      agentTexts: ["leaky"],
      approvals: [false, false, false],
    });
    const out = await g.invoke(init, { recursionLimit: 50 });
    expect(out.finalResponse).toBe(SAFE_FALLBACK_MESSAGE);
  });
  it("SMS gate: blocks until SEND then proceeds", async () => {
    const noSend = {
      ...createEscalation(),
      hadSMSInteraction: true,
      privateContexts: ["secret"],
    };
    const withSend = {
      ...createEscalation(),
      hadSMSInteraction: true,
      receivedSEND: true,
    };
    const g = build({
      agentTexts: ["waiting...", "final answer"],
      approvals: [true],
      escalations: [noSend, withSend],
    });
    const out = await g.invoke(init, { recursionLimit: 50 });
    expect(out.receivedSEND).toBe(true);
    expect(out.finalResponse).toBe("final answer");
  });
});
