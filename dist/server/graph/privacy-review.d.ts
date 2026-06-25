import { type PrivacyConfig } from "../privacy/rules";
import type { JudgeFn } from "../privacy/judge";
export declare function createPrivacyReviewGraph(deps: {
  judge: JudgeFn;
  config: PrivacyConfig;
}): import("@langchain/langgraph").CompiledStateGraph<
  {
    draftResponse: string;
    privateContexts: string[];
    approved: boolean;
    rejectionReason: string | undefined;
  },
  {
    draftResponse?: string | undefined;
    privateContexts?:
      | string[]
      | import("@langchain/langgraph").OverwriteValue<string[]>
      | undefined;
    approved?:
      | boolean
      | import("@langchain/langgraph").OverwriteValue<boolean>
      | undefined;
    rejectionReason?:
      | string
      | import("@langchain/langgraph").OverwriteValue<string | undefined>
      | undefined;
  },
  "__start__" | "quickCheck" | "llmJudge",
  {
    draftResponse: {
      (
        annotation: import("@langchain/langgraph").SingleReducer<
          string,
          string
        >,
      ): import("@langchain/langgraph").BaseChannel<
        string,
        string | import("@langchain/langgraph").OverwriteValue<string>,
        unknown
      >;
      (): import("@langchain/langgraph").LastValue<string>;
      Root: <S extends import("@langchain/langgraph").StateDefinition>(
        sd: S,
      ) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    privateContexts: import("@langchain/langgraph").BaseChannel<
      string[],
      string[] | import("@langchain/langgraph").OverwriteValue<string[]>,
      unknown
    >;
    approved: import("@langchain/langgraph").BaseChannel<
      boolean,
      boolean | import("@langchain/langgraph").OverwriteValue<boolean>,
      unknown
    >;
    rejectionReason: import("@langchain/langgraph").BaseChannel<
      string | undefined,
      | string
      | import("@langchain/langgraph").OverwriteValue<string | undefined>
      | undefined,
      unknown
    >;
  },
  {
    draftResponse: {
      (
        annotation: import("@langchain/langgraph").SingleReducer<
          string,
          string
        >,
      ): import("@langchain/langgraph").BaseChannel<
        string,
        string | import("@langchain/langgraph").OverwriteValue<string>,
        unknown
      >;
      (): import("@langchain/langgraph").LastValue<string>;
      Root: <S extends import("@langchain/langgraph").StateDefinition>(
        sd: S,
      ) => import("@langchain/langgraph").AnnotationRoot<S>;
    };
    privateContexts: import("@langchain/langgraph").BaseChannel<
      string[],
      string[] | import("@langchain/langgraph").OverwriteValue<string[]>,
      unknown
    >;
    approved: import("@langchain/langgraph").BaseChannel<
      boolean,
      boolean | import("@langchain/langgraph").OverwriteValue<boolean>,
      unknown
    >;
    rejectionReason: import("@langchain/langgraph").BaseChannel<
      string | undefined,
      | string
      | import("@langchain/langgraph").OverwriteValue<string | undefined>
      | undefined,
      unknown
    >;
  },
  import("@langchain/langgraph").StateDefinition,
  {
    quickCheck: import("@langchain/langgraph").UpdateType<{
      draftResponse: {
        (
          annotation: import("@langchain/langgraph").SingleReducer<
            string,
            string
          >,
        ): import("@langchain/langgraph").BaseChannel<
          string,
          string | import("@langchain/langgraph").OverwriteValue<string>,
          unknown
        >;
        (): import("@langchain/langgraph").LastValue<string>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(
          sd: S,
        ) => import("@langchain/langgraph").AnnotationRoot<S>;
      };
      privateContexts: import("@langchain/langgraph").BaseChannel<
        string[],
        string[] | import("@langchain/langgraph").OverwriteValue<string[]>,
        unknown
      >;
      approved: import("@langchain/langgraph").BaseChannel<
        boolean,
        boolean | import("@langchain/langgraph").OverwriteValue<boolean>,
        unknown
      >;
      rejectionReason: import("@langchain/langgraph").BaseChannel<
        string | undefined,
        | string
        | import("@langchain/langgraph").OverwriteValue<string | undefined>
        | undefined,
        unknown
      >;
    }>;
    llmJudge: {
      approved: boolean;
      rejectionReason: string | undefined;
    };
  },
  unknown,
  unknown,
  []
>;
