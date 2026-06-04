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
      messages: {
        role: "user";
        content: string;
      }[];
    }) => Promise<{
      content: Array<{
        type: string;
        text?: string;
      }>;
    }>;
  };
}
export declare function createJudge(opts: {
  client: JudgeClient;
  model: string;
}): JudgeFn;
