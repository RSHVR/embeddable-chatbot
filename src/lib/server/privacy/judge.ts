import type { PrivacyVerdict } from "./rules";

/** A privacy judge takes a candidate response + known private contexts and returns a verdict. */
export type JudgeFn = (
  response: string,
  privateContexts: string[],
) => Promise<PrivacyVerdict>;

/** Minimal shape of the Anthropic client we rely on (keeps this injectable/testable). */
export interface JudgeClient {
  messages: {
    create: (args: {
      model: string;
      max_tokens: number;
      messages: { role: "user"; content: string }[];
    }) => Promise<{ content: Array<{ type: string; text?: string }> }>;
  };
}

export function createJudge(opts: {
  client: JudgeClient;
  model: string;
}): JudgeFn {
  const { client, model } = opts;
  return async (response, privateContexts) => {
    const prompt = `You are a privacy judge. REJECT responses that leak private information.

PRIVATE CONTEXT (visitor must NEVER know about this):
${privateContexts.map((p) => `- "${p}"`).join("\n")}

RESPONSE TO CHECK:
"${response}"

REJECTION CRITERIA:
1. Contains <PRIVATE CONVERSATION> tags (INSTANT REJECT)
2. Uses exact words/phrases from private context
3. Reveals what the owner said, did, or is doing
4. Implies a private conversation happened ("he said", "apparently", "I checked with")
5. Reveals owner's mood, location, or status from private context

Respond with ONLY a raw JSON object — no markdown code fences, no prose:
{"approved": true} or {"approved": false, "reason": "explanation"}`;

    try {
      const result = await client.messages.create({
        model,
        max_tokens: 100,
        messages: [{ role: "user", content: prompt }],
      });
      const block = result.content.find((b) => b.type === "text");
      const text = block?.text ?? "";
      const parsed = parseVerdict(text);
      if (typeof parsed.approved !== "boolean")
        throw new Error("missing approved");
      return parsed;
    } catch (error) {
      // FAIL CLOSED: the requirement is "never leak". An unreadable judge => reject.
      console.error("[Judge] fail-closed (rejecting):", error);
      return { approved: false, reason: "judge_unavailable_fail_closed" };
    }
  };
}

/**
 * Parse the judge's reply into a verdict, tolerating real-world LLM formatting:
 * markdown code fences (```json ... ```) and trailing prose after the JSON.
 * Throws if no usable JSON object is found (caller fails closed).
 */
export function parseVerdict(raw: string): PrivacyVerdict {
  const stripped = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  // Prefer a flat {...} object that mentions "approved" (robust to surrounding prose).
  const flat = stripped.match(/\{[^{}]*"approved"[^{}]*\}/);
  const candidates = [flat?.[0], sliceFirstToLastBrace(stripped), stripped];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate) as PrivacyVerdict;
      if (typeof parsed.approved === "boolean") return parsed;
    } catch {
      // try the next candidate
    }
  }
  throw new Error("no parseable verdict JSON in judge output");
}

function sliceFirstToLastBrace(s: string): string | undefined {
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  return first !== -1 && last > first ? s.slice(first, last + 1) : undefined;
}
