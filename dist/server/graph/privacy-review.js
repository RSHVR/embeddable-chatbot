import {
  StateGraph,
  Annotation,
  START,
  END,
  Command,
} from "@langchain/langgraph";
import { quickPrivacyCheck } from "../privacy/rules";
const ReviewState = Annotation.Root({
  draftResponse: Annotation,
  privateContexts: Annotation({
    reducer: (_x, y) => y,
    default: () => [],
  }),
  approved: Annotation({
    reducer: (_x, y) => y,
    default: () => false,
  }),
  rejectionReason: Annotation({
    reducer: (_x, y) => y,
    default: () => undefined,
  }),
});
export function createPrivacyReviewGraph(deps) {
  const { judge, config } = deps;
  const quickCheck = async (state) => {
    const verdict = quickPrivacyCheck(state.draftResponse, config);
    if (!verdict.approved) {
      return new Command({
        update: { approved: false, rejectionReason: verdict.reason },
        goto: END,
      });
    }
    if (state.privateContexts.length === 0) {
      return new Command({
        update: { approved: true, rejectionReason: undefined },
        goto: END,
      });
    }
    return new Command({ goto: "llmJudge" });
  };
  const llmJudge = async (state) => {
    const verdict = await judge(state.draftResponse, state.privateContexts);
    return { approved: verdict.approved, rejectionReason: verdict.reason };
  };
  return new StateGraph(ReviewState)
    .addNode("quickCheck", quickCheck, { ends: ["llmJudge", END] })
    .addNode("llmJudge", llmJudge)
    .addEdge(START, "quickCheck")
    .addEdge("llmJudge", END)
    .compile();
}
