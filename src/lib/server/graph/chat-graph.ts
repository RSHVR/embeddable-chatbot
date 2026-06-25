import { StateGraph, START, END } from "@langchain/langgraph";
import { ChatState } from "./state";
import { createNodes, type NodeDeps } from "./nodes";

export function createChatGraph(deps: NodeDeps) {
  const n = createNodes(deps);
  return new StateGraph(ChatState)
    .addNode("agentTurn", n.agentTurn)
    .addNode("gate", n.gate, {
      ends: ["agentTurn", "privacyReview", "safeFallback"],
    })
    .addNode("privacyReview", n.privacyReview, {
      ends: ["agentTurn", "finalize", "safeFallback"],
    })
    .addNode("finalize", n.finalize)
    .addNode("safeFallback", n.safeFallback)
    .addEdge(START, "agentTurn")
    .addEdge("agentTurn", "gate")
    .addEdge("finalize", END)
    .addEdge("safeFallback", END)
    .compile();
}
