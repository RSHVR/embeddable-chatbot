import { describe, it, expect, vi } from "vitest";
import { createEscalation, runSmsEscalation } from "./sms-tool";

const noSleep = async () => {};

function deps(reply: string | null) {
  return {
    sendSMS: vi.fn(async () => ({ success: true, sid: "SM1" })),
    createPending: vi.fn(async () => ({ id: "p1" })),
    checkReply: vi.fn(async () => reply),
    clearReply: vi.fn(async () => {}),
    markTimeout: vi.fn(async () => {}),
  };
}

describe("runSmsEscalation", () => {
  it("classifies SEND and flags receivedSEND", async () => {
    const acc = createEscalation();
    const d = deps("please SEND it");
    const res = await runSmsEscalation(
      { message: "lead question" },
      {
        ...d,
        config: { sendKeyword: "SEND" },
        accumulator: acc,
        intervalMs: 1,
        timeoutMs: 1000,
        now: clock(),
        sleep: noSleep,
      },
    );
    expect(acc.hadSMSInteraction).toBe(true);
    expect(acc.receivedSEND).toBe(true);
    expect(acc.privateContexts).toEqual([]);
    expect(res).toContain("SEND");
  });

  it("wraps a non-SEND reply as PRIVATE CONVERSATION and records context", async () => {
    const acc = createEscalation();
    const d = deps("tell them we open at 9");
    const res = await runSmsEscalation(
      { message: "q" },
      {
        ...d,
        config: {},
        accumulator: acc,
        intervalMs: 1,
        timeoutMs: 1000,
        now: clock(),
        sleep: noSleep,
      },
    );
    expect(acc.privateContexts).toEqual(["tell them we open at 9"]);
    expect(acc.receivedSEND).toBe(false);
    expect(res).toContain("PRIVATE CONVERSATION");
    expect(d.clearReply).toHaveBeenCalled();
  });

  it("flags smsTimedOut when no reply arrives", async () => {
    const acc = createEscalation();
    const d = deps(null);
    const res = await runSmsEscalation(
      { message: "q" },
      {
        ...d,
        config: {},
        accumulator: acc,
        intervalMs: 1,
        timeoutMs: 1,
        now: clock([0, 5]),
        sleep: noSleep,
      },
    );
    expect(acc.smsTimedOut).toBe(true);
    expect(res.toLowerCase()).toContain("did not respond");
  });

  it("returns an error string when sending fails (no wait)", async () => {
    const acc = createEscalation();
    const d = {
      ...deps("x"),
      sendSMS: vi.fn(async () => ({ success: false, error: "boom" })),
    };
    const res = await runSmsEscalation(
      { message: "q" },
      {
        ...d,
        config: {},
        accumulator: acc,
        intervalMs: 1,
        timeoutMs: 1000,
        now: clock(),
        sleep: noSleep,
      },
    );
    expect(res.toLowerCase()).toContain("failed");
    expect(d.checkReply).not.toHaveBeenCalled();
  });
});

function clock(values = [0, 1, 2, 3]) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}
