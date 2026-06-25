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
export declare function waitForOwnerReply(
  opts: WaitForReplyOptions,
): Promise<WaitForReplyResult>;
