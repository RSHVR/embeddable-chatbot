import type { ChatMessage } from "../types";
export declare const ChatState: import("@langchain/langgraph").AnnotationRoot<{
  sessionId: import("@langchain/langgraph").BaseChannel<
    string,
    string | import("@langchain/langgraph").OverwriteValue<string>,
    unknown
  >;
  history: import("@langchain/langgraph").BaseChannel<
    ChatMessage[],
    | ChatMessage[]
    | import("@langchain/langgraph").OverwriteValue<ChatMessage[]>,
    unknown
  >;
  userMessage: import("@langchain/langgraph").BaseChannel<
    string,
    string | import("@langchain/langgraph").OverwriteValue<string>,
    unknown
  >;
  draftResponse: import("@langchain/langgraph").BaseChannel<
    string,
    string | import("@langchain/langgraph").OverwriteValue<string>,
    unknown
  >;
  privateContexts: import("@langchain/langgraph").BaseChannel<
    string[],
    string[] | import("@langchain/langgraph").OverwriteValue<string[]>,
    unknown
  >;
  hadSMSInteraction: import("@langchain/langgraph").BaseChannel<
    boolean,
    boolean | import("@langchain/langgraph").OverwriteValue<boolean>,
    unknown
  >;
  receivedSEND: import("@langchain/langgraph").BaseChannel<
    boolean,
    boolean | import("@langchain/langgraph").OverwriteValue<boolean>,
    unknown
  >;
  smsTimedOut: import("@langchain/langgraph").BaseChannel<
    boolean,
    boolean | import("@langchain/langgraph").OverwriteValue<boolean>,
    unknown
  >;
  rewriteCount: import("@langchain/langgraph").BaseChannel<
    number,
    number | import("@langchain/langgraph").OverwriteValue<number>,
    unknown
  >;
  gateBlockCount: import("@langchain/langgraph").BaseChannel<
    number,
    number | import("@langchain/langgraph").OverwriteValue<number>,
    unknown
  >;
  feedback: import("@langchain/langgraph").BaseChannel<
    string | undefined,
    | string
    | import("@langchain/langgraph").OverwriteValue<string | undefined>
    | undefined,
    unknown
  >;
  finalResponse: import("@langchain/langgraph").BaseChannel<
    string,
    string | import("@langchain/langgraph").OverwriteValue<string>,
    unknown
  >;
}>;
export type ChatStateT = typeof ChatState.State;
