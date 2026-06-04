import { Command } from "@langchain/langgraph";
import type { ChatStateT } from "./state";
import type { RunAgentFn } from "../agent/run-agent";
export declare const SAFE_FALLBACK_MESSAGE =
  "Sorry, I hit a technical issue. Could you please rephrase your question?";
interface PrivacyReviewGraph {
  invoke: (input: {
    draftResponse: string;
    privateContexts: string[];
  }) => Promise<{
    approved: boolean;
    rejectionReason?: string;
  }>;
}
export interface NodeDeps {
  runAgent: RunAgentFn;
  privacyReview: PrivacyReviewGraph;
  maxRewrites: number;
  maxGateBlocks: number;
}
export declare function createNodes(deps: NodeDeps): {
  agentTurn: (state: ChatStateT) => Promise<{
    draftResponse: string;
    privateContexts: string[];
    hadSMSInteraction: boolean;
    receivedSEND: boolean;
    smsTimedOut: boolean;
    feedback: undefined;
  }>;
  gate: (state: ChatStateT) => Promise<
    | Command<unknown, Record<string, unknown>, "privacyReview">
    | Command<
        unknown,
        {
          gateBlockCount: number;
        },
        "safeFallback"
      >
    | Command<
        unknown,
        {
          gateBlockCount: number;
          feedback: string;
        },
        "agentTurn"
      >
  >;
  privacyReview: (state: ChatStateT) => Promise<
    | Command<unknown, Record<string, unknown>, "finalize">
    | Command<
        unknown,
        {
          rewriteCount: number;
        },
        "safeFallback"
      >
    | Command<
        unknown,
        {
          rewriteCount: number;
          feedback: string;
        },
        "agentTurn"
      >
  >;
  finalize: (state: ChatStateT) => Promise<{
    finalResponse: string;
  }>;
  safeFallback: (_state: ChatStateT) => Promise<{
    finalResponse: string;
  }>;
};
export {};
