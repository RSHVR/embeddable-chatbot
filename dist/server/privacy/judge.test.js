import { describe, it, expect, vi } from "vitest";
import { createJudge } from "./judge";
function fakeAnthropic(text, throws = false) {
  return {
    messages: {
      create: vi.fn(async () => {
        if (throws) throw new Error("api down");
        return { content: [{ type: "text", text }] };
      }),
    },
  };
}
describe("createJudge", () => {
  it("approves when the model returns approved:true", async () => {
    const judge = createJudge({
      client: fakeAnthropic('{"approved": true}'),
      model: "m",
    });
    const v = await judge("clean", ["secret"]);
    expect(v.approved).toBe(true);
  });
  it("rejects when the model returns approved:false", async () => {
    const judge = createJudge({
      client: fakeAnthropic('{"approved": false, "reason": "leak"}'),
      model: "m",
    });
    const v = await judge("leaky", ["secret"]);
    expect(v.approved).toBe(false);
    expect(v.reason).toBe("leak");
  });
  it("FAILS CLOSED on API error (rejects)", async () => {
    const judge = createJudge({ client: fakeAnthropic("", true), model: "m" });
    const v = await judge("x", ["secret"]);
    expect(v.approved).toBe(false);
  });
  it("FAILS CLOSED on unparseable output (rejects)", async () => {
    const judge = createJudge({
      client: fakeAnthropic("not json"),
      model: "m",
    });
    const v = await judge("x", ["secret"]);
    expect(v.approved).toBe(false);
  });
});
