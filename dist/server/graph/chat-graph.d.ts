import { type NodeDeps } from "./nodes";
export declare function createChatGraph(
  deps: NodeDeps,
): import("@langchain/langgraph").CompiledStateGraph<
  {
    sessionId: string;
    history: import("..").ChatMessage[];
    userMessage: string;
    draftResponse: string;
    privateContexts: string[];
    hadSMSInteraction: boolean;
    receivedSEND: boolean;
    smsTimedOut: boolean;
    rewriteCount: number;
    gateBlockCount: number;
    feedback: string | undefined;
    finalResponse: string;
  },
  {
    sessionId?:
      | string
      | import("@langchain/langgraph").OverwriteValue<string>
      | undefined;
    history?:
      | import("..").ChatMessage[]
      | import("@langchain/langgraph").OverwriteValue<
          import("..").ChatMessage[]
        >
      | undefined;
    userMessage?:
      | string
      | import("@langchain/langgraph").OverwriteValue<string>
      | undefined;
    draftResponse?:
      | string
      | import("@langchain/langgraph").OverwriteValue<string>
      | undefined;
    privateContexts?:
      | string[]
      | import("@langchain/langgraph").OverwriteValue<string[]>
      | undefined;
    hadSMSInteraction?:
      | boolean
      | import("@langchain/langgraph").OverwriteValue<boolean>
      | undefined;
    receivedSEND?:
      | boolean
      | import("@langchain/langgraph").OverwriteValue<boolean>
      | undefined;
    smsTimedOut?:
      | boolean
      | import("@langchain/langgraph").OverwriteValue<boolean>
      | undefined;
    rewriteCount?:
      | number
      | import("@langchain/langgraph").OverwriteValue<number>
      | undefined;
    gateBlockCount?:
      | number
      | import("@langchain/langgraph").OverwriteValue<number>
      | undefined;
    feedback?:
      | string
      | import("@langchain/langgraph").OverwriteValue<string | undefined>
      | undefined;
    finalResponse?:
      | string
      | import("@langchain/langgraph").OverwriteValue<string>
      | undefined;
  },
  | "privacyReview"
  | "safeFallback"
  | "agentTurn"
  | "finalize"
  | "__start__"
  | "gate",
  {
    sessionId: import("@langchain/langgraph").BaseChannel<
      string,
      string | import("@langchain/langgraph").OverwriteValue<string>,
      unknown
    >;
    history: import("@langchain/langgraph").BaseChannel<
      import("..").ChatMessage[],
      | import("..").ChatMessage[]
      | import("@langchain/langgraph").OverwriteValue<
          import("..").ChatMessage[]
        >,
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
  },
  {
    sessionId: import("@langchain/langgraph").BaseChannel<
      string,
      string | import("@langchain/langgraph").OverwriteValue<string>,
      unknown
    >;
    history: import("@langchain/langgraph").BaseChannel<
      import("..").ChatMessage[],
      | import("..").ChatMessage[]
      | import("@langchain/langgraph").OverwriteValue<
          import("..").ChatMessage[]
        >,
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
  },
  import("@langchain/langgraph").StateDefinition,
  {
    agentTurn: {
      draftResponse: string;
      privateContexts: string[];
      hadSMSInteraction: boolean;
      receivedSEND: boolean;
      smsTimedOut: boolean;
      feedback: undefined;
    };
    gate: import("@langchain/langgraph").UpdateType<{
      sessionId: import("@langchain/langgraph").BaseChannel<
        string,
        string | import("@langchain/langgraph").OverwriteValue<string>,
        unknown
      >;
      history: import("@langchain/langgraph").BaseChannel<
        import("..").ChatMessage[],
        | import("..").ChatMessage[]
        | import("@langchain/langgraph").OverwriteValue<
            import("..").ChatMessage[]
          >,
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
    privacyReview: import("@langchain/langgraph").UpdateType<{
      sessionId: import("@langchain/langgraph").BaseChannel<
        string,
        string | import("@langchain/langgraph").OverwriteValue<string>,
        unknown
      >;
      history: import("@langchain/langgraph").BaseChannel<
        import("..").ChatMessage[],
        | import("..").ChatMessage[]
        | import("@langchain/langgraph").OverwriteValue<
            import("..").ChatMessage[]
          >,
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
    finalize: {
      finalResponse: string;
    };
    safeFallback: {
      finalResponse: string;
    };
  },
  unknown,
  unknown,
  []
>;
