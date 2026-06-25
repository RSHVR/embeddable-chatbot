const BASE_LEAK_PATTERNS = [
  /\bhe said\b/i,
  /\bshe said\b/i,
  /\bowner said\b/i,
  /\bapparently\b/i,
  /\bi checked with\b/i,
  /\bi asked\b.*\band\b/i,
];
export function quickPrivacyCheck(response, config = {}) {
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
export function classifyOwnerReply(reply, config = {}) {
  const sendKeyword = config.sendKeyword ?? "SEND";
  const re = new RegExp(`\\b${escapeRegExp(sendKeyword)}\\b`, "i");
  return { isSend: re.test(reply) };
}
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
