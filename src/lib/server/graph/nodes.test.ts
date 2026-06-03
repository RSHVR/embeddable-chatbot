import { describe, it, expect, vi } from "vitest";
import { createNodes, SAFE_FALLBACK_MESSAGE } from "./nodes";
import { createEscalation } from "../agent/sms-tool";
import type { RunAgentFn } from "../agent/run-agent";
import type { ChatStateT } from "./state";

function nodes(over: Partial<Parameters<typeof createNodes>[0]> = {}) {
  const runAgent: RunAgentFn = vi.fn(async () => ({
    text: "draft",
    escalation: createEscalation(),
  }));
  const privacyReview = { invoke: vi.fn(async () => ({ approved: true })) };
  return createNodes({
    runAgent,
    privacyReview,
    maxRewrites: 3,
    maxGateBlocks: 3,
    ...over,
  });
}

// LangGraph normalizes Command.goto to an array; unwrap to the single destination.
function goto(cmd: { goto?: unknown }): unknown {
  return Array.isArray(cmd.goto) ? cmd.goto[0] : cmd.goto;
}

// Command.update is a loose union; read it as a plain record in assertions.
function update(cmd: { update?: unknown }): Record<string, unknown> {
  return (cmd.update ?? {}) as Record<string, unknown>;
}

const base: ChatStateT = {
  sessionId: "s",
  history: [],
  userMessage: "hi",
  draftResponse: "",
  privateContexts: [],
  hadSMSInteraction: false,
  receivedSEND: false,
  smsTimedOut: false,
  rewriteCount: 0,
  gateBlockCount: 0,
  feedback: undefined,
  finalResponse: "",
};

describe("agentTurn", () => {
  it("writes draftResponse + escalation flags", async () => {
    const esc = {
      ...createEscalation(),
      hadSMSInteraction: true,
      privateContexts: ["p"],
    };
    const n = nodes({
      runAgent: vi.fn(async () => ({ text: "hello", escalation: esc })),
    });
    const out = await n.agentTurn(base);
    expect(out).toMatchObject({
      draftResponse: "hello",
      hadSMSInteraction: true,
      privateContexts: ["p"],
    });
  });
});

describe("gate", () => {
  it("routes to privacyReview when no SMS interaction", async () => {
    expect(goto(await nodes().gate(base))).toBe("privacyReview");
  });
  it("routes back to agentTurn (with feedback) when SMS used and no SEND", async () => {
    const cmd = await nodes().gate({ ...base, hadSMSInteraction: true });
    expect(goto(cmd)).toBe("agentTurn");
    expect(update(cmd).gateBlockCount).toBe(1);
    expect(typeof update(cmd).feedback).toBe("string");
  });
  it("routes to safeFallback after max gate blocks", async () => {
    expect(
      goto(
        await nodes().gate({
          ...base,
          hadSMSInteraction: true,
          gateBlockCount: 2,
        }),
      ),
    ).toBe("safeFallback");
  });
  it("routes to privacyReview when SEND received", async () => {
    expect(
      goto(
        await nodes().gate({
          ...base,
          hadSMSInteraction: true,
          receivedSEND: true,
        }),
      ),
    ).toBe("privacyReview");
  });
});

describe("privacyReview node", () => {
  it("routes to finalize when approved", async () => {
    expect(
      goto(await nodes().privacyReview({ ...base, draftResponse: "clean" })),
    ).toBe("finalize");
  });
  it("routes back to agentTurn with feedback when rejected and under cap", async () => {
    const pr = {
      invoke: vi.fn(async () => ({ approved: false, rejectionReason: "leak" })),
    };
    const cmd = await nodes({ privacyReview: pr }).privacyReview({
      ...base,
      draftResponse: "leaky",
      privateContexts: ["x"],
    });
    expect(goto(cmd)).toBe("agentTurn");
    expect(update(cmd).rewriteCount).toBe(1);
    expect(update(cmd).feedback).toContain("leak");
  });
  it("routes to safeFallback when rejected at cap", async () => {
    const pr = {
      invoke: vi.fn(async () => ({ approved: false, rejectionReason: "leak" })),
    };
    const cmd = await nodes({ privacyReview: pr }).privacyReview({
      ...base,
      draftResponse: "leaky",
      privateContexts: ["x"],
      rewriteCount: 2,
    });
    expect(goto(cmd)).toBe("safeFallback");
  });
});

describe("finalize / safeFallback", () => {
  it("finalize copies draft to finalResponse", async () => {
    expect(
      (await nodes().finalize({ ...base, draftResponse: "done" }))
        .finalResponse,
    ).toBe("done");
  });
  it("safeFallback sets the generic safe message", async () => {
    expect((await nodes().safeFallback(base)).finalResponse).toBe(
      SAFE_FALLBACK_MESSAGE,
    );
  });
});
