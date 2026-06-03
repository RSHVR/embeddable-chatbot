import { Annotation } from "@langchain/langgraph";
import type { ChatMessage } from "../types";

const lastWins = <T>(def: () => T) => ({
  reducer: (_x: T, y: T) => y,
  default: def,
});

export const ChatState = Annotation.Root({
  sessionId: Annotation<string>(lastWins(() => "")),
  history: Annotation<ChatMessage[]>(lastWins(() => [])),
  userMessage: Annotation<string>(lastWins(() => "")),
  draftResponse: Annotation<string>(lastWins(() => "")),
  privateContexts: Annotation<string[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  hadSMSInteraction: Annotation<boolean>(lastWins(() => false)),
  receivedSEND: Annotation<boolean>(lastWins(() => false)),
  smsTimedOut: Annotation<boolean>(lastWins(() => false)),
  rewriteCount: Annotation<number>(lastWins(() => 0)),
  gateBlockCount: Annotation<number>(lastWins(() => 0)),
  feedback: Annotation<string | undefined>(lastWins(() => undefined)),
  finalResponse: Annotation<string>(lastWins(() => "")),
});

export type ChatStateT = typeof ChatState.State;
