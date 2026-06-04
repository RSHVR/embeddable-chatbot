const realSleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function waitForOwnerReply(opts) {
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? realSleep;
  const isAborted = opts.isAborted ?? (() => false);
  const start = now();
  while (now() - start < opts.timeoutMs) {
    if (isAborted()) return { reply: null, timedOut: false };
    const reply = await opts.checkReply();
    if (reply) return { reply, timedOut: false };
    await sleep(opts.intervalMs);
  }
  return { reply: null, timedOut: true };
}
