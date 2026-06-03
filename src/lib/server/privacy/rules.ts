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

const BASE_LEAK_PATTERNS: RegExp[] = [
  /\bhe said\b/i,
  /\bshe said\b/i,
  /\bowner said\b/i,
  /\bapparently\b/i,
  /\bi checked with\b/i,
  /\bi asked\b.*\band\b/i,
];

export interface PrivacyVerdict {
  approved: boolean;
  reason?: string;
}

export function quickPrivacyCheck(
  response: string,
  config: PrivacyConfig = {},
): PrivacyVerdict {
  const sendKeyword = config.sendKeyword ?? "SEND";

  if (
    response.includes("<PRIVATE CONVERSATION>") ||
    response.includes("</PRIVATE CONVERSATION>")
  ) {
    return {
      approved: false,
      reason: "Response contains <PRIVATE CONVERSATION> tags",
    };
  }

  // Protocol keyword as a standalone uppercase token (lowercase "send" is fine).
  const sendRe = new RegExp(`\\b${escapeRegExp(sendKeyword)}\\b`);
  if (sendRe.test(response)) {
    return {
      approved: false,
      reason: `Response contains "${sendKeyword}" protocol keyword`,
    };
  }

  const ownerPatterns = (config.ownerNames ?? []).map(
    (n) => new RegExp(`\\b${escapeRegExp(n)}\\b`, "i"),
  );
  const patterns = [
    ...BASE_LEAK_PATTERNS,
    ...ownerPatterns,
    ...(config.extraLeakPatterns ?? []),
  ];

  for (const pattern of patterns) {
    if (pattern.test(response)) {
      return {
        approved: false,
        reason: `Response may leak private info: matched "${pattern.source}"`,
      };
    }
  }
  return { approved: true };
}

export function classifyOwnerReply(
  reply: string,
  config: PrivacyConfig = {},
): { isSend: boolean } {
  const sendKeyword = config.sendKeyword ?? "SEND";
  const re = new RegExp(`\\b${escapeRegExp(sendKeyword)}\\b`, "i");
  return { isSend: re.test(reply) };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
