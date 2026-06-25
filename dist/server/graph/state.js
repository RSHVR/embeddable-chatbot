import { Annotation } from "@langchain/langgraph";
const lastWins = (def) => ({
  reducer: (_x, y) => y,
  default: def,
});
export const ChatState = Annotation.Root({
  sessionId: Annotation(lastWins(() => "")),
  history: Annotation(lastWins(() => [])),
  userMessage: Annotation(lastWins(() => "")),
  draftResponse: Annotation(lastWins(() => "")),
  privateContexts: Annotation({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  hadSMSInteraction: Annotation(lastWins(() => false)),
  receivedSEND: Annotation(lastWins(() => false)),
  smsTimedOut: Annotation(lastWins(() => false)),
  rewriteCount: Annotation(lastWins(() => 0)),
  gateBlockCount: Annotation(lastWins(() => 0)),
  feedback: Annotation(lastWins(() => undefined)),
  finalResponse: Annotation(lastWins(() => "")),
});
