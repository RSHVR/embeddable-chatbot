import {
  StateGraph,
  Annotation,
  START,
  END,
  Command,
} from "@langchain/langgraph";
import { quickPrivacyCheck, type PrivacyConfig } from "../privacy/rules";
import type { JudgeFn } from "../privacy/judge";

const ReviewState = Annotation.Root({
  draftResponse: Annotation<string>,
  privateContexts: Annotation<string[]>({
    reducer: (_x, y) => y,
    default: () => [],
  }),
  approved: Annotation<boolean>({
    reducer: (_x, y) => y,
    default: () => false,
  }),
  rejectionReason: Annotation<string | undefined>({
    reducer: (_x, y) => y,
    default: () => undefined,
  }),
});

export function createPrivacyReviewGraph(deps: {
  judge: JudgeFn;
  config: PrivacyConfig;
}) {
  const { judge, config } = deps;

  const quickCheck = async (state: typeof ReviewState.State) => {
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

  const llmJudge = async (state: typeof ReviewState.State) => {
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
