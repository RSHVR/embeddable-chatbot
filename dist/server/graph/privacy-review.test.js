import { describe, it, expect, vi } from "vitest";
import { createPrivacyReviewGraph } from "./privacy-review";
const approveJudge = async () => ({ approved: true });
const rejectJudge = async () => ({
  approved: false,
  reason: "leaked",
});
describe("privacy-review subgraph", () => {
  it("approves clean response with no private context WITHOUT calling judge", async () => {
    const judge = vi.fn(approveJudge);
    const g = createPrivacyReviewGraph({ judge, config: {} });
    const out = await g.invoke({
      draftResponse: "We open at 9.",
      privateContexts: [],
    });
    expect(out.approved).toBe(true);
    expect(judge).not.toHaveBeenCalled();
  });
  it("rejects at quickCheck before reaching judge", async () => {
    const judge = vi.fn(approveJudge);
    const g = createPrivacyReviewGraph({
      judge,
      config: { sendKeyword: "SEND" },
    });
    const out = await g.invoke({
      draftResponse: "owner said SEND",
      privateContexts: ["x"],
    });
    expect(out.approved).toBe(false);
    expect(judge).not.toHaveBeenCalled();
  });
  it("calls judge when quickCheck passes AND private context exists", async () => {
    const judge = vi.fn(rejectJudge);
    const g = createPrivacyReviewGraph({ judge, config: {} });
    const out = await g.invoke({
      draftResponse: "A clean looking line.",
      privateContexts: ["secret"],
    });
    expect(judge).toHaveBeenCalledOnce();
    expect(out.approved).toBe(false);
    expect(out.rejectionReason).toBe("leaked");
  });
});
