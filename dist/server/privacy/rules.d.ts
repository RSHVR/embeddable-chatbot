/**
 * Configurable privacy leak rules.
 * The fast, deterministic first line of defense before the LLM judge.
 */
export interface PrivacyConfig {
  /** Owner names to flag if they appear in a visitor-facing response, e.g. ['veer']. */
  ownerNames?: string[];
  /** Protocol keyword the owner texts to release the response. Default 'SEND'. */
  sendKeyword?: string;
  /** Extra leak patterns appended to the built-in set. */
  extraLeakPatterns?: RegExp[];
}
export interface PrivacyVerdict {
  approved: boolean;
  reason?: string;
}
export declare function quickPrivacyCheck(
  response: string,
  config?: PrivacyConfig,
): PrivacyVerdict;
export declare function classifyOwnerReply(
  reply: string,
  config?: PrivacyConfig,
): {
  isSend: boolean;
};
