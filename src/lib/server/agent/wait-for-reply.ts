export interface WaitForReplyOptions {
  /** Returns the owner reply if present, else null. Polled repeatedly. */
  checkReply: () => Promise<string | null>;
  intervalMs: number;
  timeoutMs: number;
  /** Returns current epoch ms. Injectable for tests. Defaults to Date.now. */
  now?: () => number;
  /** Sleep helper. Injectable for tests. Defaults to setTimeout. */
  sleep?: (ms: number) => Promise<void>;
  /** Optional cooperative cancellation (e.g. client disconnected). */
  isAborted?: () => boolean;
}

export interface WaitForReplyResult {
  reply: string | null;
  timedOut: boolean;
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function waitForOwnerReply(
  opts: WaitForReplyOptions,
): Promise<WaitForReplyResult> {
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
