import { Command } from "@langchain/langgraph";
export const SAFE_FALLBACK_MESSAGE =
  "Sorry, I hit a technical issue. Could you please rephrase your question?";
const GATE_BLOCK_FEEDBACK = `BLOCKED: You cannot respond to the visitor yet. The owner has NOT released the response.
You MUST use notify_owner_sms to continue the conversation with the owner. The visitor is waiting patiently.`;
export function createNodes(deps) {
  const agentTurn = async (state) => {
    const { text, escalation } = await deps.runAgent({
      history: state.history,
      userMessage: state.userMessage,
      feedback: state.feedback,
    });
    return {
      draftResponse: text,
      privateContexts: escalation.privateContexts,
      hadSMSInteraction:
        state.hadSMSInteraction || escalation.hadSMSInteraction,
      receivedSEND: state.receivedSEND || escalation.receivedSEND,
      smsTimedOut: state.smsTimedOut || escalation.smsTimedOut,
      feedback: undefined,
    };
  };
  const gate = async (state) => {
    const canRespond =
      !state.hadSMSInteraction || state.receivedSEND || state.smsTimedOut;
    if (canRespond) return new Command({ goto: "privacyReview" });
    const n = state.gateBlockCount + 1;
    if (n >= deps.maxGateBlocks) {
      return new Command({
        update: { gateBlockCount: n },
        goto: "safeFallback",
      });
    }
    return new Command({
      update: { gateBlockCount: n, feedback: GATE_BLOCK_FEEDBACK },
      goto: "agentTurn",
    });
  };
  const privacyReview = async (state) => {
    const verdict = await deps.privacyReview.invoke({
      draftResponse: state.draftResponse,
      privateContexts: state.privateContexts,
    });
    if (verdict.approved) return new Command({ goto: "finalize" });
    const n = state.rewriteCount + 1;
    if (n >= deps.maxRewrites) {
      return new Command({ update: { rewriteCount: n }, goto: "safeFallback" });
    }
    const feedback = `REJECTED: Your response leaked private information. Reason: ${verdict.rejectionReason ?? "unknown"}.
Rewrite completely. Do NOT reference any private conversation. Respond as if you naturally know the answer.`;
    return new Command({
      update: { rewriteCount: n, feedback },
      goto: "agentTurn",
    });
  };
  const finalize = async (state) => ({
    finalResponse: state.draftResponse,
  });
  const safeFallback = async (_state) => ({
    finalResponse: SAFE_FALLBACK_MESSAGE,
  });
  return { agentTurn, gate, privacyReview, finalize, safeFallback };
}
