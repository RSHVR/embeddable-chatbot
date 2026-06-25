import { describe, it, expect, vi } from "vitest";
import { createJudge, parseVerdict, type JudgeClient } from "./judge";

function fakeAnthropic(text: string, throws = false): JudgeClient {
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

  it("parses real-world fenced + prose output as APPROVED (regression)", async () => {
    // Exact shape claude-haiku-4-5 returned in live testing.
    const raw =
      '```json\n{"approved": true}\n```\n\nThe response contains only public business information and reveals nothing private.';
    const judge = createJudge({ client: fakeAnthropic(raw), model: "m" });
    const v = await judge("We open at 9am.", ["owner is on vacation"]);
    expect(v.approved).toBe(true);
  });
});

describe("parseVerdict", () => {
  it("parses bare JSON", () => {
    expect(parseVerdict('{"approved": true}').approved).toBe(true);
  });
  it("parses fenced JSON", () => {
    expect(
      parseVerdict('```json\n{"approved": false, "reason": "leak"}\n```')
        .approved,
    ).toBe(false);
  });
  it("parses fenced JSON followed by prose", () => {
    const raw =
      '```json\n{"approved": true}\n```\n\nExplanation: nothing leaked here.';
    expect(parseVerdict(raw).approved).toBe(true);
  });
  it("parses JSON embedded in prose", () => {
    const raw =
      'Here is my verdict: {"approved": false, "reason": "reveals status"} done.';
    const v = parseVerdict(raw);
    expect(v.approved).toBe(false);
    expect(v.reason).toBe("reveals status");
  });
  it("throws when no JSON object is present", () => {
    expect(() => parseVerdict("I cannot help with that.")).toThrow();
  });
});
