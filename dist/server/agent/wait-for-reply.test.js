import { describe, it, expect, vi } from "vitest";
import { waitForOwnerReply } from "./wait-for-reply";
const noSleep = async () => {};
describe("waitForOwnerReply", () => {
  it("returns the reply once it arrives", async () => {
    const checkReply = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("hello");
    const out = await waitForOwnerReply({
      checkReply,
      intervalMs: 1,
      timeoutMs: 10_000,
      now: makeClock([0, 1, 2, 3]),
      sleep: noSleep,
    });
    expect(out).toEqual({ reply: "hello", timedOut: false });
    expect(checkReply).toHaveBeenCalledTimes(3);
  });
  it("times out when no reply arrives", async () => {
    const checkReply = vi.fn(async () => null);
    const out = await waitForOwnerReply({
      checkReply,
      intervalMs: 1,
      timeoutMs: 5,
      now: makeClock([0, 2, 4, 6]),
      sleep: noSleep,
    });
    expect(out).toEqual({ reply: null, timedOut: true });
  });
  it("aborts early when isAborted returns true", async () => {
    const checkReply = vi.fn(async () => null);
    const out = await waitForOwnerReply({
      checkReply,
      intervalMs: 1,
      timeoutMs: 10_000,
      now: makeClock([0, 1]),
      sleep: noSleep,
      isAborted: () => true,
    });
    expect(out.reply).toBeNull();
    expect(checkReply).not.toHaveBeenCalled();
  });
});
function makeClock(values) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}
