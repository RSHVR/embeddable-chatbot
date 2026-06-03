# LangGraph + Agent SDK Chatbot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-architect the embeddable chatbot onto LangGraph.js orchestration + Claude Agent SDK model execution, with a leak-proof privacy-review subgraph and a full Vitest test suite.

**Architecture:** A parent LangGraph `StateGraph` owns the turn lifecycle (agentTurn → gate → privacyReview → rewrite/finalize/safeFallback). Each model turn runs via the Claude Agent SDK `query()` locked down to a single in-process SMS tool. The privacy review (regex fast-check + LLM judge) is a self-contained, heavily-tested subgraph. All external deps (Agent SDK runner, LLM judge, Twilio, Supabase) are injected so unit tests run with no network.

**Tech Stack:** TypeScript, SvelteKit (Node target), `@langchain/langgraph@^1`, `@anthropic-ai/claude-agent-sdk@^0.3`, `@anthropic-ai/sdk` (judge only), `zod`, Vitest.

**Design spec:** `docs/superpowers/specs/2026-06-02-langgraph-agent-sdk-chatbot-design.md`

**Conventions for every task:** use `pnpm`. Commit messages have NO Claude attribution. Run from repo root.

---

## Task 1: Dependencies + Vitest infrastructure

**Files:**

- Modify: `package.json` (deps + scripts)
- Create: `vitest.config.ts`
- Create: `src/lib/server/smoke.test.ts` (temporary smoke test, deleted in Task 12)

- [ ] **Step 1: Install dependencies**

```bash
pnpm add @langchain/langgraph @anthropic-ai/claude-agent-sdk zod
pnpm add -D vitest @vitest/coverage-v8
```

Expected: all resolve; `@anthropic-ai/sdk` already present (keep it).

- [ ] **Step 2: Create Vitest config with unit + live projects**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: ["tests/live/**"],
        },
      },
      {
        test: {
          name: "live",
          environment: "node",
          include: ["tests/live/**/*.live.test.ts"],
        },
      },
    ],
  },
});
```

- [ ] **Step 3: Add test scripts to package.json**

In `package.json` `"scripts"`, add:

```json
"test": "vitest run --project unit",
"test:watch": "vitest --project unit",
"test:live": "vitest run --project live",
"test:coverage": "vitest run --project unit --coverage"
```

- [ ] **Step 4: Write the smoke test**

Create `src/lib/server/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("vitest smoke", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run and verify it passes**

Run: `pnpm test`
Expected: 1 passed (smoke).

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts src/lib/server/smoke.test.ts
git commit -m "test: add Vitest with unit/live projects + deps"
```

---

## Task 2: Configurable privacy rules

**Files:**

- Create: `src/lib/server/privacy/rules.ts`
- Test: `src/lib/server/privacy/rules.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/server/privacy/rules.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  quickPrivacyCheck,
  classifyOwnerReply,
  type PrivacyConfig,
} from "./rules";

const cfg: PrivacyConfig = { ownerNames: ["veer"], sendKeyword: "SEND" };

describe("quickPrivacyCheck", () => {
  it("approves a clean response", () => {
    expect(quickPrivacyCheck("We open at 9am.", cfg).approved).toBe(true);
  });
  it("rejects PRIVATE CONVERSATION tags", () => {
    expect(
      quickPrivacyCheck("<PRIVATE CONVERSATION>x</PRIVATE CONVERSATION>", cfg)
        .approved,
    ).toBe(false);
  });
  it("rejects the SEND protocol keyword (uppercase only)", () => {
    expect(quickPrivacyCheck("The owner said SEND", cfg).approved).toBe(false);
    expect(quickPrivacyCheck("I will send you details", cfg).approved).toBe(
      true,
    );
  });
  it("rejects leak phrases", () => {
    for (const r of [
      "he said yes",
      "she said no",
      "apparently he is busy",
      "I checked with the team",
    ]) {
      expect(quickPrivacyCheck(r, cfg).approved).toBe(false);
    }
  });
  it("rejects configured owner names", () => {
    expect(quickPrivacyCheck("Veer told me to tell you", cfg).approved).toBe(
      false,
    );
  });
  it("does not flag owner name when not configured", () => {
    expect(quickPrivacyCheck("Veer is a nice name", {}).approved).toBe(true);
  });
  it("honors extra leak patterns", () => {
    const c: PrivacyConfig = { extraLeakPatterns: [/\bsecret\b/i] };
    expect(quickPrivacyCheck("this is a secret", c).approved).toBe(false);
  });
});

describe("classifyOwnerReply", () => {
  it("detects SEND anywhere, case-insensitive", () => {
    expect(classifyOwnerReply("ok SEND it", cfg).isSend).toBe(true);
    expect(classifyOwnerReply("send", cfg).isSend).toBe(true);
  });
  it("treats normal replies as private", () => {
    expect(classifyOwnerReply("tell them 9am", cfg).isSend).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test src/lib/server/privacy/rules.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement rules.ts**

Create `src/lib/server/privacy/rules.ts`:

```ts
/**
 * Configurable privacy leak rules.
 * The fast, deterministic first line of defense before the LLM judge.
 */
export interface PrivacyConfig {
  /** Owner names to flag if they appear in a visitor-facing response, e.g. ['veer']. */
  ownerNames?: string[];
  /** Protocol keyword the owner texts to release the response. Default 'SEND'. */
  sendKeyword?: string;
  /** Extra leak patterns appended to the built-in set. */
  extraLeakPatterns?: RegExp[];
}

const BASE_LEAK_PATTERNS: RegExp[] = [
  /\bhe said\b/i,
  /\bshe said\b/i,
  /\bowner said\b/i,
  /\bapparently\b/i,
  /\bi checked with\b/i,
  /\bi asked\b.*\band\b/i,
];

export interface PrivacyVerdict {
  approved: boolean;
  reason?: string;
}

export function quickPrivacyCheck(
  response: string,
  config: PrivacyConfig = {},
): PrivacyVerdict {
  const sendKeyword = config.sendKeyword ?? "SEND";

  if (
    response.includes("<PRIVATE CONVERSATION>") ||
    response.includes("</PRIVATE CONVERSATION>")
  ) {
    return {
      approved: false,
      reason: "Response contains <PRIVATE CONVERSATION> tags",
    };
  }

  // Protocol keyword as a standalone uppercase token (lowercase "send" is fine).
  const sendRe = new RegExp(`\\b${escapeRegExp(sendKeyword)}\\b`);
  if (sendRe.test(response)) {
    return {
      approved: false,
      reason: `Response contains "${sendKeyword}" protocol keyword`,
    };
  }

  const ownerPatterns = (config.ownerNames ?? []).map(
    (n) => new RegExp(`\\b${escapeRegExp(n)}\\b`, "i"),
  );
  const patterns = [
    ...BASE_LEAK_PATTERNS,
    ...ownerPatterns,
    ...(config.extraLeakPatterns ?? []),
  ];

  for (const pattern of patterns) {
    if (pattern.test(response)) {
      return {
        approved: false,
        reason: `Response may leak private info: matched "${pattern.source}"`,
      };
    }
  }
  return { approved: true };
}

export function classifyOwnerReply(
  reply: string,
  config: PrivacyConfig = {},
): { isSend: boolean } {
  const sendKeyword = config.sendKeyword ?? "SEND";
  const re = new RegExp(`\\b${escapeRegExp(sendKeyword)}\\b`, "i");
  return { isSend: re.test(reply) };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test src/lib/server/privacy/rules.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/privacy/rules.ts src/lib/server/privacy/rules.test.ts
git commit -m "feat: configurable privacy leak rules + owner-reply classification"
```

---

## Task 3: LLM privacy judge (fail-closed)

**Files:**

- Create: `src/lib/server/privacy/judge.ts`
- Test: `src/lib/server/privacy/judge.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/server/privacy/judge.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { createJudge, type JudgeFn } from "./judge";

function fakeAnthropic(text: string, throws = false) {
  return {
    messages: {
      create: vi.fn(async () => {
        if (throws) throw new Error("api down");
        return {
          content: [{ type: "text", text }],
          usage: { input_tokens: 1, output_tokens: 1 },
        };
      }),
    },
  } as unknown as ConstructorParameters<typeof Object>[0];
}

describe("createJudge", () => {
  it("approves when the model returns approved:true", async () => {
    const judge: JudgeFn = createJudge({
      client: fakeAnthropic('{"approved": true}') as any,
      model: "m",
    });
    const v = await judge("clean", ["secret"]);
    expect(v.approved).toBe(true);
  });
  it("rejects when the model returns approved:false", async () => {
    const judge = createJudge({
      client: fakeAnthropic('{"approved": false, "reason": "leak"}') as any,
      model: "m",
    });
    const v = await judge("leaky", ["secret"]);
    expect(v.approved).toBe(false);
    expect(v.reason).toBe("leak");
  });
  it("FAILS CLOSED on API error (rejects)", async () => {
    const judge = createJudge({
      client: fakeAnthropic("", true) as any,
      model: "m",
    });
    const v = await judge("x", ["secret"]);
    expect(v.approved).toBe(false);
  });
  it("FAILS CLOSED on unparseable output (rejects)", async () => {
    const judge = createJudge({
      client: fakeAnthropic("not json") as any,
      model: "m",
    });
    const v = await judge("x", ["secret"]);
    expect(v.approved).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test src/lib/server/privacy/judge.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement judge.ts**

Create `src/lib/server/privacy/judge.ts`:

```ts
import type { PrivacyVerdict } from "./rules";

/** A privacy judge takes a candidate response + known private contexts and returns a verdict. */
export type JudgeFn = (
  response: string,
  privateContexts: string[],
) => Promise<PrivacyVerdict>;

/** Minimal shape of the Anthropic client we rely on (keeps this injectable/testable). */
export interface JudgeClient {
  messages: {
    create: (args: {
      model: string;
      max_tokens: number;
      messages: { role: "user"; content: string }[];
    }) => Promise<{ content: Array<{ type: string; text?: string }> }>;
  };
}

export function createJudge(opts: {
  client: JudgeClient;
  model: string;
}): JudgeFn {
  const { client, model } = opts;
  return async (response, privateContexts) => {
    // If there is nothing private to protect, the caller should have approved already.
    const prompt = `You are a privacy judge. REJECT responses that leak private information.

PRIVATE CONTEXT (visitor must NEVER know about this):
${privateContexts.map((p) => `- "${p}"`).join("\n")}

RESPONSE TO CHECK:
"${response}"

REJECTION CRITERIA:
1. Contains <PRIVATE CONVERSATION> tags (INSTANT REJECT)
2. Uses exact words/phrases from private context
3. Reveals what the owner said, did, or is doing
4. Implies a private conversation happened ("he said", "apparently", "I checked with")
5. Reveals owner's mood, location, or status from private context

Respond with JSON only:
{"approved": true} or {"approved": false, "reason": "explanation"}`;

    try {
      const result = await client.messages.create({
        model,
        max_tokens: 100,
        messages: [{ role: "user", content: prompt }],
      });
      const block = result.content.find((b) => b.type === "text");
      const text = block?.text ?? "";
      const parsed = JSON.parse(text) as PrivacyVerdict;
      if (typeof parsed.approved !== "boolean")
        throw new Error("missing approved");
      return parsed;
    } catch (error) {
      // FAIL CLOSED: the requirement is "never leak". An unreadable judge => reject.
      console.error("[Judge] fail-closed (rejecting):", error);
      return { approved: false, reason: "judge_unavailable_fail_closed" };
    }
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test src/lib/server/privacy/judge.test.ts`
Expected: PASS (4 cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/privacy/judge.ts src/lib/server/privacy/judge.test.ts
git commit -m "feat: fail-closed LLM privacy judge (injectable client)"
```

---

## Task 4: Privacy-review subgraph

**Files:**

- Create: `src/lib/server/graph/privacy-review.ts`
- Test: `src/lib/server/graph/privacy-review.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/server/graph/privacy-review.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { createPrivacyReviewGraph } from "./privacy-review";
import type { JudgeFn } from "../privacy/judge";

const approveJudge: JudgeFn = async () => ({ approved: true });
const rejectJudge: JudgeFn = async () => ({
  approved: false,
  reason: "leaked",
});

describe("privacy-review subgraph", () => {
  it("approves clean response with no private context WITHOUT calling judge", async () => {
    const judge = vi.fn(approveJudge);
    const g = createPrivacyReviewGraph({ judge, config: {} });
    const out = await g.invoke({
      draftResponse: "We open at 9.",
      privateContexts: [],
    });
    expect(out.approved).toBe(true);
    expect(judge).not.toHaveBeenCalled();
  });
  it("rejects at quickCheck before reaching judge", async () => {
    const judge = vi.fn(approveJudge);
    const g = createPrivacyReviewGraph({
      judge,
      config: { sendKeyword: "SEND" },
    });
    const out = await g.invoke({
      draftResponse: "owner said SEND",
      privateContexts: ["x"],
    });
    expect(out.approved).toBe(false);
    expect(judge).not.toHaveBeenCalled();
  });
  it("calls judge when quickCheck passes AND private context exists", async () => {
    const judge = vi.fn(rejectJudge);
    const g = createPrivacyReviewGraph({ judge, config: {} });
    const out = await g.invoke({
      draftResponse: "A clean looking line.",
      privateContexts: ["secret"],
    });
    expect(judge).toHaveBeenCalledOnce();
    expect(out.approved).toBe(false);
    expect(out.rejectionReason).toBe("leaked");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test src/lib/server/graph/privacy-review.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement privacy-review.ts**

Create `src/lib/server/graph/privacy-review.ts`:

```ts
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
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test src/lib/server/graph/privacy-review.test.ts`
Expected: PASS (3 cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/graph/privacy-review.ts src/lib/server/graph/privacy-review.test.ts
git commit -m "feat: privacy-review subgraph (quickCheck -> judge -> verdict)"
```

---

## Task 5: Parent graph state schema

**Files:**

- Create: `src/lib/server/graph/state.ts`
- Test: `src/lib/server/graph/state.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/server/graph/state.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ChatState } from "./state";

describe("ChatState reducers", () => {
  it("appends privateContexts", () => {
    const spec = ChatState.spec.privateContexts;
    const reducer = spec.reducer!;
    expect(reducer(["a"], ["b"])).toEqual(["a", "b"]);
  });
  it("privateContexts defaults to empty array", () => {
    expect(ChatState.spec.privateContexts.default!()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test src/lib/server/graph/state.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement state.ts**

Create `src/lib/server/graph/state.ts`:

```ts
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
```

- [ ] **Step 4: Create the shared types module**

Create `src/lib/server/types.ts`:

```ts
export interface ChatMessage {
  sender: "user" | "bot";
  text: string;
}
```

- [ ] **Step 5: Run to verify pass**

Run: `pnpm test src/lib/server/graph/state.test.ts`
Expected: PASS (2 cases).

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/graph/state.ts src/lib/server/graph/state.test.ts src/lib/server/types.ts
git commit -m "feat: parent graph state schema + shared ChatMessage type"
```

---

## Task 6: SMS reply poller

**Files:**

- Create: `src/lib/server/agent/wait-for-reply.ts`
- Test: `src/lib/server/agent/wait-for-reply.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/server/agent/wait-for-reply.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { waitForOwnerReply } from "./wait-for-reply";

const noSleep = async () => {};

describe("waitForOwnerReply", () => {
  it("returns the reply once it arrives", async () => {
    const checkReply = vi
      .fn<[], Promise<string | null>>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("hello");
    const out = await waitForOwnerReply({
      checkReply,
      intervalMs: 1,
      timeoutMs: 10_000,
      now: makeClock([0, 1, 2, 3]),
      sleep: noSleep,
    });
    expect(out).toEqual({ reply: "hello", timedOut: false });
    expect(checkReply).toHaveBeenCalledTimes(3);
  });

  it("times out when no reply arrives", async () => {
    const checkReply = vi.fn(async () => null);
    const out = await waitForOwnerReply({
      checkReply,
      intervalMs: 1,
      timeoutMs: 5,
      now: makeClock([0, 2, 4, 6]),
      sleep: noSleep,
    });
    expect(out).toEqual({ reply: null, timedOut: true });
  });

  it("aborts early when isAborted returns true", async () => {
    const checkReply = vi.fn(async () => null);
    const out = await waitForOwnerReply({
      checkReply,
      intervalMs: 1,
      timeoutMs: 10_000,
      now: makeClock([0, 1]),
      sleep: noSleep,
      isAborted: () => true,
    });
    expect(out.reply).toBeNull();
    expect(checkReply).not.toHaveBeenCalled();
  });
});

function makeClock(values: number[]) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test src/lib/server/agent/wait-for-reply.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement wait-for-reply.ts**

Create `src/lib/server/agent/wait-for-reply.ts`:

```ts
export interface WaitForReplyOptions {
  /** Returns the owner reply if present, else null. Polled repeatedly. */
  checkReply: () => Promise<string | null>;
  intervalMs: number;
  timeoutMs: number;
  /** Returns current epoch ms. Injectable for tests. Defaults to Date.now. */
  now?: () => number;
  /** Sleep helper. Injectable for tests. Defaults to setTimeout. */
  sleep?: (ms: number) => Promise<void>;
  /** Optional cooperative cancellation (e.g. client disconnected). */
  isAborted?: () => boolean;
}

export interface WaitForReplyResult {
  reply: string | null;
  timedOut: boolean;
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function waitForOwnerReply(
  opts: WaitForReplyOptions,
): Promise<WaitForReplyResult> {
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? realSleep;
  const isAborted = opts.isAborted ?? (() => false);
  const start = now();

  while (now() - start < opts.timeoutMs) {
    if (isAborted()) return { reply: null, timedOut: false };
    const reply = await opts.checkReply();
    if (reply) return { reply, timedOut: false };
    await sleep(opts.intervalMs);
  }
  return { reply: null, timedOut: true };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test src/lib/server/agent/wait-for-reply.test.ts`
Expected: PASS (3 cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/agent/wait-for-reply.ts src/lib/server/agent/wait-for-reply.test.ts
git commit -m "feat: injectable owner-reply poller"
```

---

## Task 7: In-process SMS tool + escalation accumulator

**Files:**

- Create: `src/lib/server/agent/sms-tool.ts`
- Test: `src/lib/server/agent/sms-tool.test.ts`

This wraps the existing `sendSMS` (Twilio) + SMS state in a single in-process Agent SDK
tool, and records owner replies / SEND into a per-turn accumulator.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/server/agent/sms-tool.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { createEscalation, runSmsEscalation } from "./sms-tool";

const noSleep = async () => {};

function deps(reply: string | null) {
  return {
    sendSMS: vi.fn(async () => ({ success: true, sid: "SM1" })),
    createPending: vi.fn(async () => ({ id: "p1" })),
    checkReply: vi.fn(async () => reply),
    clearReply: vi.fn(async () => {}),
    markTimeout: vi.fn(async () => {}),
  };
}

describe("runSmsEscalation", () => {
  it("classifies SEND and flags receivedSEND", async () => {
    const acc = createEscalation();
    const d = deps("please SEND it");
    const res = await runSmsEscalation(
      { message: "lead question" },
      {
        ...d,
        config: { sendKeyword: "SEND" },
        accumulator: acc,
        intervalMs: 1,
        timeoutMs: 1000,
        now: clock(),
        sleep: noSleep,
      },
    );
    expect(acc.hadSMSInteraction).toBe(true);
    expect(acc.receivedSEND).toBe(true);
    expect(acc.privateContexts).toEqual([]);
    expect(res).toContain("SEND");
  });

  it("wraps a non-SEND reply as PRIVATE CONVERSATION and records context", async () => {
    const acc = createEscalation();
    const d = deps("tell them we open at 9");
    const res = await runSmsEscalation(
      { message: "q" },
      {
        ...d,
        config: {},
        accumulator: acc,
        intervalMs: 1,
        timeoutMs: 1000,
        now: clock(),
        sleep: noSleep,
      },
    );
    expect(acc.privateContexts).toEqual(["tell them we open at 9"]);
    expect(acc.receivedSEND).toBe(false);
    expect(res).toContain("PRIVATE CONVERSATION");
    expect(d.clearReply).toHaveBeenCalled();
  });

  it("flags smsTimedOut when no reply arrives", async () => {
    const acc = createEscalation();
    const d = deps(null);
    const res = await runSmsEscalation(
      { message: "q" },
      {
        ...d,
        config: {},
        accumulator: acc,
        intervalMs: 1,
        timeoutMs: 1,
        now: clock([0, 5]),
        sleep: noSleep,
      },
    );
    expect(acc.smsTimedOut).toBe(true);
    expect(res.toLowerCase()).toContain("did not respond");
  });

  it("returns an error string when sending fails (no wait)", async () => {
    const acc = createEscalation();
    const d = {
      ...deps("x"),
      sendSMS: vi.fn(async () => ({ success: false, error: "boom" })),
    };
    const res = await runSmsEscalation(
      { message: "q" },
      {
        ...d,
        config: {},
        accumulator: acc,
        intervalMs: 1,
        timeoutMs: 1000,
        now: clock(),
        sleep: noSleep,
      },
    );
    expect(res.toLowerCase()).toContain("failed");
    expect(d.checkReply).not.toHaveBeenCalled();
  });
});

function clock(values = [0, 1, 2, 3]) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test src/lib/server/agent/sms-tool.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement sms-tool.ts**

Create `src/lib/server/agent/sms-tool.ts`:

```ts
import { z } from "zod";
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { classifyOwnerReply, type PrivacyConfig } from "../privacy/rules";
import { waitForOwnerReply } from "./wait-for-reply";

/** Per-turn accumulator the agentTurn node reads back into graph state. */
export interface Escalation {
  hadSMSInteraction: boolean;
  receivedSEND: boolean;
  smsTimedOut: boolean;
  privateContexts: string[];
}

export function createEscalation(): Escalation {
  return {
    hadSMSInteraction: false,
    receivedSEND: false,
    smsTimedOut: false,
    privateContexts: [],
  };
}

export interface SmsEscalationDeps {
  sendSMS: (
    message: string,
  ) => Promise<{ success: boolean; sid?: string; error?: string }>;
  createPending: (message: string) => Promise<{ id: string }>;
  checkReply: () => Promise<string | null>;
  clearReply: () => Promise<void>;
  markTimeout: () => Promise<void>;
  config: PrivacyConfig;
  accumulator: Escalation;
  intervalMs: number;
  timeoutMs: number;
  onWaiting?: () => void;
  isAborted?: () => boolean;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const GATE_RESULT = (sendKeyword: string) =>
  `Owner signaled ${sendKeyword}. Formulate your final response to the visitor now. NEVER reveal private conversation content.`;

/** Core escalation logic, decoupled from the Agent SDK wrapper for testing. */
export async function runSmsEscalation(
  input: { message: string; context_summary?: string },
  deps: SmsEscalationDeps,
): Promise<string> {
  const { accumulator: acc, config } = deps;
  acc.hadSMSInteraction = true;

  const body = input.context_summary
    ? `[${input.context_summary}]\n\n${input.message}`
    : input.message;
  await deps.createPending(body);
  const sent = await deps.sendSMS(body);
  if (!sent.success) {
    return `Failed to send SMS: ${sent.error ?? "unknown error"}. Ask the visitor for contact info to follow up later.`;
  }

  deps.onWaiting?.();
  const { reply, timedOut } = await waitForOwnerReply({
    checkReply: deps.checkReply,
    intervalMs: deps.intervalMs,
    timeoutMs: deps.timeoutMs,
    isAborted: deps.isAborted,
    now: deps.now,
    sleep: deps.sleep,
  });

  if (!reply) {
    if (timedOut) {
      acc.smsTimedOut = true;
      await deps.markTimeout();
    }
    return "Owner did not respond. Ask the visitor for contact info to follow up later.";
  }

  if (classifyOwnerReply(reply, config).isSend) {
    acc.receivedSEND = true;
    await deps.clearReply();
    return GATE_RESULT(config.sendKeyword ?? "SEND");
  }

  acc.privateContexts.push(reply);
  await deps.clearReply();
  return `<PRIVATE CONVERSATION>
${reply}
</PRIVATE CONVERSATION>

IMPORTANT: Owner has NOT signaled release yet. Use notify_owner_sms again to continue.
DO NOT respond to the visitor yet — they are waiting. Only respond AFTER the owner releases.`;
}

/** Build the in-process Agent SDK MCP server exposing the single SMS tool. */
export function createSmsToolServer(deps: SmsEscalationDeps) {
  return createSdkMcpServer({
    name: "owner-sms",
    version: "1.0.0",
    tools: [
      tool(
        "notify_owner_sms",
        "Send an SMS to the business owner for real-time input. The conversation pauses until the owner replies. Include all relevant context in your message.",
        {
          message: z
            .string()
            .describe(
              "Message to the owner with full context about the visitor and their need.",
            ),
          context_summary: z
            .string()
            .optional()
            .describe("Brief summary of the conversation context."),
        },
        async (args) => {
          const text = await runSmsEscalation(args, deps);
          return { content: [{ type: "text", text }] };
        },
      ),
    ],
  });
}

export const SMS_TOOL_NAME = "mcp__owner-sms__notify_owner_sms";
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test src/lib/server/agent/sms-tool.test.ts`
Expected: PASS (4 cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/agent/sms-tool.ts src/lib/server/agent/sms-tool.test.ts
git commit -m "feat: in-process SMS escalation tool + accumulator"
```

---

## Task 8: Agent SDK runner

**Files:**

- Create: `src/lib/server/agent/run-agent.ts`
- Test: `src/lib/server/agent/run-agent.test.ts`

The runner is the only module that imports `query` from the Agent SDK. We unit-test the
message-extraction + prompt-building helpers (pure), and cover the real `query()` call in
live tests (Task 11).

- [ ] **Step 1: Write the failing tests (pure helpers)**

Create `src/lib/server/agent/run-agent.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { extractResultText, buildPromptMessages } from "./run-agent";
import type { ChatMessage } from "../types";

describe("buildPromptMessages", () => {
  it("maps history + new user message, appending feedback as a final user turn", () => {
    const history: ChatMessage[] = [
      { sender: "user", text: "hi" },
      { sender: "bot", text: "hello" },
    ];
    const msgs = buildPromptMessages(
      history,
      "what are your hours?",
      "REJECTED: rewrite please",
    );
    expect(msgs[0]).toMatchObject({ role: "user", content: "hi" });
    expect(msgs[1]).toMatchObject({ role: "assistant", content: "hello" });
    expect(msgs[2]).toMatchObject({
      role: "user",
      content: "what are your hours?",
    });
    expect(msgs[3]).toMatchObject({
      role: "user",
      content: "REJECTED: rewrite please",
    });
  });
  it("omits the feedback turn when not provided", () => {
    const msgs = buildPromptMessages([], "hello");
    expect(msgs).toHaveLength(1);
  });
});

describe("extractResultText", () => {
  it("returns the success result string", () => {
    const text = extractResultText([
      { type: "assistant", message: {} },
      { type: "result", subtype: "success", result: "We open at 9am." },
    ] as any);
    expect(text).toBe("We open at 9am.");
  });
  it("returns empty string when no success result present", () => {
    expect(
      extractResultText([
        { type: "result", subtype: "error_max_turns" },
      ] as any),
    ).toBe("");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test src/lib/server/agent/run-agent.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement run-agent.ts**

Create `src/lib/server/agent/run-agent.ts`:

```ts
import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { ChatMessage } from "../types";
import {
  createEscalation,
  createSmsToolServer,
  SMS_TOOL_NAME,
  type Escalation,
  type SmsEscalationDeps,
} from "./sms-tool";

export interface PromptMessage {
  type: "user";
  message: { role: "user" | "assistant"; content: string };
}

/** Build the Agent SDK streaming-input messages from history + new turn (+ optional feedback). */
export function buildPromptMessages(
  history: ChatMessage[],
  userMessage: string,
  feedback?: string,
): { role: "user" | "assistant"; content: string }[] {
  const msgs = history.map((m) => ({
    role: m.sender === "user" ? ("user" as const) : ("assistant" as const),
    content: m.text,
  }));
  msgs.push({ role: "user", content: userMessage });
  if (feedback) msgs.push({ role: "user", content: feedback });
  return msgs;
}

/** Pull the final assistant text out of the Agent SDK message stream. */
export function extractResultText(messages: SDKMessage[]): string {
  for (const m of messages) {
    if (m.type === "result" && m.subtype === "success") return m.result;
  }
  return "";
}

export interface RunAgentResult {
  text: string;
  escalation: Escalation;
}

export type RunAgentFn = (input: {
  history: ChatMessage[];
  userMessage: string;
  feedback?: string;
}) => Promise<RunAgentResult>;

export interface RunAgentConfig {
  apiKey: string;
  model: string;
  systemPrompt: string;
  maxTurns?: number;
  /** Factory producing the SMS escalation deps for a fresh accumulator each turn. */
  smsDepsFor: (
    accumulator: Escalation,
  ) => Omit<SmsEscalationDeps, "accumulator">;
}

export function createRunAgent(config: RunAgentConfig): RunAgentFn {
  return async ({ history, userMessage, feedback }) => {
    const accumulator = createEscalation();
    const smsServer = createSmsToolServer({
      ...config.smsDepsFor(accumulator),
      accumulator,
    });
    const turns = buildPromptMessages(history, userMessage, feedback);

    async function* generate() {
      for (const t of turns) {
        yield { type: "user" as const, message: t };
      }
    }

    const collected: SDKMessage[] = [];
    for await (const message of query({
      prompt: generate(),
      options: {
        model: config.model,
        systemPrompt: config.systemPrompt,
        settingSources: [], // no CLAUDE.md / filesystem settings
        mcpServers: { "owner-sms": smsServer },
        allowedTools: [SMS_TOOL_NAME], // ONLY the SMS tool — no fs/bash access
        maxTurns: config.maxTurns ?? 10,
        env: { ...process.env, ANTHROPIC_API_KEY: config.apiKey },
      },
    })) {
      collected.push(message);
    }
    return { text: extractResultText(collected), escalation };

    // note: `escalation` resolves to `accumulator` (captured above)
    function escalationRef() {
      return accumulator;
    }
  };
}
```

> **Implementation note for the worker:** the trailing `return { text, escalation }` must
> reference the `accumulator` variable directly. Replace the stray helper with:
> `return { text: extractResultText(collected), escalation: accumulator };` and delete the
> `escalationRef` stub. (It is written this way so you SEE the intended wiring; fix it to the
> one-liner.)

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test src/lib/server/agent/run-agent.test.ts`
Expected: PASS (4 cases). The pure helpers don't invoke `query()`.

- [ ] **Step 5: Typecheck this module**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no errors in `run-agent.ts` (fix the `escalation` reference per the note).

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/agent/run-agent.ts src/lib/server/agent/run-agent.test.ts
git commit -m "feat: Claude Agent SDK runner (locked-down, SMS-tool-only)"
```

---

## Task 9: Parent graph nodes

**Files:**

- Create: `src/lib/server/graph/nodes.ts`
- Test: `src/lib/server/graph/nodes.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/server/graph/nodes.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { END } from "@langchain/langgraph";
import { createNodes, SAFE_FALLBACK_MESSAGE } from "./nodes";
import { createEscalation } from "../agent/sms-tool";
import type { RunAgentFn } from "../agent/run-agent";

function nodes(over: Partial<Parameters<typeof createNodes>[0]> = {}) {
  const runAgent: RunAgentFn = vi.fn(async () => ({
    text: "draft",
    escalation: createEscalation(),
  }));
  const privacyReview = {
    invoke: vi.fn(async () => ({ approved: true })),
  } as any;
  return createNodes({
    runAgent,
    privacyReview,
    maxRewrites: 3,
    maxGateBlocks: 3,
    ...over,
  });
}

const base = {
  sessionId: "s",
  history: [],
  userMessage: "hi",
  draftResponse: "",
  privateContexts: [],
  hadSMSInteraction: false,
  receivedSEND: false,
  smsTimedOut: false,
  rewriteCount: 0,
  gateBlockCount: 0,
  feedback: undefined,
  finalResponse: "",
};

describe("agentTurn", () => {
  it("writes draftResponse + escalation flags", async () => {
    const esc = {
      ...createEscalation(),
      hadSMSInteraction: true,
      privateContexts: ["p"],
    };
    const n = nodes({
      runAgent: vi.fn(async () => ({ text: "hello", escalation: esc })) as any,
    });
    const out = await n.agentTurn(base);
    expect(out).toMatchObject({
      draftResponse: "hello",
      hadSMSInteraction: true,
      privateContexts: ["p"],
    });
  });
});

describe("gate", () => {
  it("routes to privacyReview when no SMS interaction", async () => {
    const n = nodes();
    const cmd = await n.gate(base);
    expect(cmd.goto).toBe("privacyReview");
  });
  it("routes back to agentTurn (with feedback) when SMS used and no SEND", async () => {
    const n = nodes();
    const cmd = await n.gate({ ...base, hadSMSInteraction: true });
    expect(cmd.goto).toBe("agentTurn");
    expect(cmd.update.gateBlockCount).toBe(1);
    expect(typeof cmd.update.feedback).toBe("string");
  });
  it("routes to safeFallback after max gate blocks", async () => {
    const n = nodes();
    const cmd = await n.gate({
      ...base,
      hadSMSInteraction: true,
      gateBlockCount: 2,
    });
    expect(cmd.goto).toBe("safeFallback");
  });
  it("routes to privacyReview when SEND received", async () => {
    const n = nodes();
    const cmd = await n.gate({
      ...base,
      hadSMSInteraction: true,
      receivedSEND: true,
    });
    expect(cmd.goto).toBe("privacyReview");
  });
});

describe("privacyReview node", () => {
  it("routes to finalize when approved", async () => {
    const n = nodes();
    const cmd = await n.privacyReview({ ...base, draftResponse: "clean" });
    expect(cmd.goto).toBe("finalize");
  });
  it("routes back to agentTurn with feedback when rejected and under cap", async () => {
    const pr = {
      invoke: vi.fn(async () => ({ approved: false, rejectionReason: "leak" })),
    } as any;
    const n = nodes({ privacyReview: pr });
    const cmd = await n.privacyReview({
      ...base,
      draftResponse: "leaky",
      privateContexts: ["x"],
    });
    expect(cmd.goto).toBe("agentTurn");
    expect(cmd.update.rewriteCount).toBe(1);
    expect(cmd.update.feedback).toContain("leak");
  });
  it("routes to safeFallback when rejected at cap", async () => {
    const pr = {
      invoke: vi.fn(async () => ({ approved: false, rejectionReason: "leak" })),
    } as any;
    const n = nodes({ privacyReview: pr });
    const cmd = await n.privacyReview({
      ...base,
      draftResponse: "leaky",
      privateContexts: ["x"],
      rewriteCount: 2,
    });
    expect(cmd.goto).toBe("safeFallback");
  });
});

describe("finalize / safeFallback", () => {
  it("finalize copies draft to finalResponse", async () => {
    const n = nodes();
    expect(
      (await n.finalize({ ...base, draftResponse: "done" })).finalResponse,
    ).toBe("done");
  });
  it("safeFallback sets the generic safe message", async () => {
    const n = nodes();
    expect((await n.safeFallback(base)).finalResponse).toBe(
      SAFE_FALLBACK_MESSAGE,
    );
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test src/lib/server/graph/nodes.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement nodes.ts**

Create `src/lib/server/graph/nodes.ts`:

```ts
import { Command, END } from "@langchain/langgraph";
import type { ChatStateT } from "./state";
import type { RunAgentFn } from "../agent/run-agent";

export const SAFE_FALLBACK_MESSAGE =
  "Sorry, I hit a technical issue. Could you please rephrase your question?";

const GATE_BLOCK_FEEDBACK = `BLOCKED: You cannot respond to the visitor yet. The owner has NOT released the response.
You MUST use notify_owner_sms to continue the conversation with the owner. The visitor is waiting patiently.`;

interface PrivacyReviewGraph {
  invoke: (input: {
    draftResponse: string;
    privateContexts: string[];
  }) => Promise<{ approved: boolean; rejectionReason?: string }>;
}

export interface NodeDeps {
  runAgent: RunAgentFn;
  privacyReview: PrivacyReviewGraph;
  maxRewrites: number;
  maxGateBlocks: number;
}

export function createNodes(deps: NodeDeps) {
  const agentTurn = async (state: ChatStateT) => {
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

  const gate = async (state: ChatStateT) => {
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

  const privacyReview = async (state: ChatStateT) => {
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

  const finalize = async (state: ChatStateT) => ({
    finalResponse: state.draftResponse,
  });
  const safeFallback = async (_state: ChatStateT) => ({
    finalResponse: SAFE_FALLBACK_MESSAGE,
  });

  return { agentTurn, gate, privacyReview, finalize, safeFallback };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test src/lib/server/graph/nodes.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/graph/nodes.ts src/lib/server/graph/nodes.test.ts
git commit -m "feat: parent graph nodes (agentTurn, gate, privacyReview, finalize, safeFallback)"
```

---

## Task 10: Parent graph wiring

**Files:**

- Create: `src/lib/server/graph/chat-graph.ts`
- Test: `src/lib/server/graph/chat-graph.test.ts`

- [ ] **Step 1: Write the failing tests (end-to-end graph with stubs)**

Create `src/lib/server/graph/chat-graph.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { createChatGraph } from "./chat-graph";
import { createEscalation } from "../agent/sms-tool";
import { SAFE_FALLBACK_MESSAGE } from "./nodes";

function build(opts: {
  agentTexts: string[];
  approvals: boolean[];
  escalations?: ReturnType<typeof createEscalation>[];
}) {
  let call = 0;
  const runAgent = vi.fn(async () => {
    const i = call++;
    return {
      text: opts.agentTexts[Math.min(i, opts.agentTexts.length - 1)],
      escalation: opts.escalations?.[i] ?? createEscalation(),
    };
  });
  let judged = 0;
  const privacyReview = {
    invoke: vi.fn(async () => ({
      approved: opts.approvals[Math.min(judged++, opts.approvals.length - 1)],
      rejectionReason: "leak",
    })),
  } as any;
  return createChatGraph({
    runAgent,
    privacyReview,
    maxRewrites: 3,
    maxGateBlocks: 3,
  });
}

const init = {
  sessionId: "s",
  history: [],
  userMessage: "hours?",
  privateContexts: [],
  hadSMSInteraction: false,
  receivedSEND: false,
  smsTimedOut: false,
  rewriteCount: 0,
  gateBlockCount: 0,
};

describe("chat graph", () => {
  it("clean path: agentTurn -> gate -> privacyReview -> finalize", async () => {
    const g = build({ agentTexts: ["We open at 9am."], approvals: [true] });
    const out = await g.invoke(init);
    expect(out.finalResponse).toBe("We open at 9am.");
  });

  it("rewrite path: rejected once, then approved", async () => {
    const g = build({
      agentTexts: ["leaky", "clean"],
      approvals: [false, true],
    });
    const out = await g.invoke(init);
    expect(out.finalResponse).toBe("clean");
    expect(out.rewriteCount).toBe(1);
  });

  it("rewrite cap: always rejected -> safeFallback", async () => {
    const g = build({
      agentTexts: ["leaky"],
      approvals: [false, false, false],
    });
    const out = await g.invoke(init);
    expect(out.finalResponse).toBe(SAFE_FALLBACK_MESSAGE);
  });

  it("SMS gate: blocks until SEND then proceeds", async () => {
    const noSend = {
      ...createEscalation(),
      hadSMSInteraction: true,
      privateContexts: ["secret"],
    };
    const withSend = {
      ...createEscalation(),
      hadSMSInteraction: true,
      receivedSEND: true,
    };
    const g = build({
      agentTexts: ["waiting...", "final answer"],
      approvals: [true],
      escalations: [noSend, withSend],
    });
    const out = await g.invoke(init);
    expect(out.receivedSEND).toBe(true);
    expect(out.finalResponse).toBe("final answer");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test src/lib/server/graph/chat-graph.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement chat-graph.ts**

Create `src/lib/server/graph/chat-graph.ts`:

```ts
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
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test src/lib/server/graph/chat-graph.test.ts`
Expected: PASS (4 cases). If the rewrite-cap test loops unexpectedly, confirm `maxRewrites`/`maxGateBlocks` recursion limit; add `{ recursionLimit: 25 }` to `invoke` if LangGraph raises GraphRecursionError.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/graph/chat-graph.ts src/lib/server/graph/chat-graph.test.ts
git commit -m "feat: parent chat graph wiring"
```

---

## Task 11: Rewrite createChatHandler + SSE bridge

**Files:**

- Modify: `src/lib/server/index.ts` (full rewrite)
- Test: `src/lib/server/index.test.ts`

The handler builds graph deps from options, runs the graph, and bridges the result onto the
**existing SSE protocol** the Svelte widget expects. We test the SSE bridge with an injected
graph runner so no network is needed.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/server/index.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { streamGraphResultToSSE } from "./index";

async function collectSSE(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const dec = new TextDecoder();
  let out = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    out += dec.decode(value);
  }
  return out;
}

describe("streamGraphResultToSSE", () => {
  it("streams final text in chunks and terminates with [DONE]", async () => {
    const stream = streamGraphResultToSSE(
      { finalResponse: "Hello there friend" },
      { chunkSize: 5, delayMs: 0 },
    );
    const out = await collectSSE(stream);
    expect(out).toContain('data: {"text":"Hello');
    expect(out).toContain("[DONE]");
    // reassembled text equals the original
    const text = [...out.matchAll(/data: (\{"text":.*?\})\n\n/g)]
      .map((m) => JSON.parse(m[1]).text)
      .join("");
    expect(text).toBe("Hello there friend");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test src/lib/server/index.test.ts`
Expected: FAIL (export not found).

- [ ] **Step 3: Rewrite index.ts**

Replace the entire contents of `src/lib/server/index.ts` with:

```ts
import { createChatGraph } from "./graph/chat-graph";
import { createRunAgent, type RunAgentFn } from "./agent/run-agent";
import { createJudge } from "./privacy/judge";
import { createPrivacyReviewGraph } from "./graph/privacy-review";
import type { Escalation, SmsEscalationDeps } from "./agent/sms-tool";
import type { PrivacyConfig } from "./privacy/rules";
import type { ChatMessage } from "./types";

export const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant. Be friendly, concise, and helpful.

Guidelines:
- Keep responses brief (1-3 sentences when possible)
- Be conversational and approachable
- If you don't know something, be honest about it
- Ask clarifying questions when needed`;

export const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";
export const DEFAULT_JUDGE_MODEL = "claude-3-5-haiku-20241022";

export interface ChatHandlerOptions {
  apiKey: string;
  systemPrompt?: string;
  model?: string;
  judgeModel?: string;
  privacy?: PrivacyConfig;
  maxRewrites?: number;
  maxGateBlocks?: number;
  maxToolTurns?: number;
  replyCheckInterval?: number;
  replyTimeout?: number;
  /** Build SMS escalation deps for a session (Twilio + Supabase wiring). Omit to disable SMS. */
  smsDepsFor?: (
    sessionId: string,
    accumulator: Escalation,
    onWaiting: () => void,
  ) => Omit<SmsEscalationDeps, "accumulator" | "onWaiting">;
  onSave?: (sessionId: string, history: ChatMessage[]) => Promise<void>;
}

/** Bridge a finished graph result onto the SSE protocol the widget expects. */
export function streamGraphResultToSSE(
  result: { finalResponse: string },
  opts: { chunkSize?: number; delayMs?: number } = {},
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const chunkSize = opts.chunkSize ?? 20;
  const delayMs = opts.delayMs ?? 10;
  const text = result.finalResponse;
  return new ReadableStream({
    async start(controller) {
      for (let i = 0; i < text.length; i += chunkSize) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ text: text.slice(i, i + chunkSize) })}\n\n`,
          ),
        );
        if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

export function createChatHandler(options: ChatHandlerOptions) {
  const model = options.model ?? DEFAULT_MODEL;
  const judgeModel = options.judgeModel ?? DEFAULT_JUDGE_MODEL;
  const systemPrompt = options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
  const privacy = options.privacy ?? {};
  const maxRewrites = options.maxRewrites ?? 3;
  const maxGateBlocks = options.maxGateBlocks ?? 3;

  return async (request: Request): Promise<Response> => {
    try {
      const { message, sessionId, history } = await request.json();
      if (!message || typeof message !== "string") {
        return json({ error: "Message is required" }, 400);
      }

      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const judgeClient = new Anthropic({ apiKey: options.apiKey });
      const judge = createJudge({
        client: judgeClient as never,
        model: judgeModel,
      });
      const privacyReview = createPrivacyReviewGraph({
        judge,
        config: privacy,
      });

      const encoder = new TextEncoder();
      let waitingEmitted = false;

      const readable = new ReadableStream<Uint8Array>({
        async start(controller) {
          const emit = (obj: unknown) =>
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(obj)}\n\n`),
            );
          const onWaiting = () => {
            if (!waitingEmitted) {
              waitingEmitted = true;
              emit({
                type: "waiting",
                message: "Checking with a team member...",
              });
            }
          };

          const runAgent: RunAgentFn = createRunAgent({
            apiKey: options.apiKey,
            model,
            systemPrompt,
            maxTurns: options.maxToolTurns ?? 10,
            smsDepsFor: (accumulator) => ({
              ...(options.smsDepsFor
                ? options.smsDepsFor(sessionId, accumulator, onWaiting)
                : disabledSmsDeps(privacy)),
              onWaiting,
              intervalMs: options.replyCheckInterval ?? 2000,
              timeoutMs: options.replyTimeout ?? 300_000,
              config: privacy,
              accumulator,
            }),
          });

          const graph = createChatGraph({
            runAgent,
            privacyReview,
            maxRewrites,
            maxGateBlocks,
          });

          try {
            const result = await graph.invoke(
              {
                sessionId: sessionId ?? "",
                history: (history as ChatMessage[]) ?? [],
                userMessage: message,
              },
              { recursionLimit: 50 },
            );
            const text = result.finalResponse;
            for (let i = 0; i < text.length; i += 20) {
              emit({ text: text.slice(i, i + 20) });
              await new Promise((r) => setTimeout(r, 10));
            }
            if (sessionId && options.onSave) {
              const out: ChatMessage[] = [
                ...((history as ChatMessage[]) ?? []),
                { sender: "user", text: message },
                { sender: "bot", text },
              ];
              try {
                await options.onSave(sessionId, out);
              } catch (e) {
                console.error("onSave failed:", e);
              }
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch (error) {
            console.error("Graph error:", error);
            emit({ type: "error", message: "An error occurred" });
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    } catch (error) {
      console.error("Chat API error:", error);
      return json({ error: "Failed to process chat message" }, 500);
    }
  };
}

function disabledSmsDeps(
  config: PrivacyConfig,
): Omit<SmsEscalationDeps, "accumulator" | "onWaiting"> {
  return {
    sendSMS: async () => ({ success: false, error: "SMS not configured" }),
    createPending: async () => ({ id: "disabled" }),
    checkReply: async () => null,
    clearReply: async () => {},
    markTimeout: async () => {},
    config,
    intervalMs: 2000,
    timeoutMs: 1000,
  };
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export type { ChatMessage } from "./types";
export type { PrivacyConfig } from "./privacy/rules";
export type { Escalation, SmsEscalationDeps } from "./agent/sms-tool";
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test src/lib/server/index.test.ts`
Expected: PASS (1 case).

- [ ] **Step 5: Run the full unit suite**

Run: `pnpm test`
Expected: ALL unit tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/index.ts src/lib/server/index.test.ts
git commit -m "feat: rewrite chat handler on LangGraph + Agent SDK with SSE bridge"
```

---

## Task 12: Runtime switch, live tests, route wiring, dist rebuild, verification

**Files:**

- Modify: `src/routes/api/chat/+server.ts` (wire SMS deps + privacy config)
- Modify: `svelte.config.js` (adapter-node) and `package.json` (add `@sveltejs/adapter-node`)
- Modify: `.env.example` (document required vars)
- Create: `tests/live/chat.live.test.ts`
- Delete: `src/lib/server/smoke.test.ts`
- Modify: `CLAUDE.md` (create if absent) with lessons
- Rebuild: `dist/`

- [ ] **Step 1: Switch to adapter-node**

```bash
pnpm add -D @sveltejs/adapter-node
```

Edit `svelte.config.js`: replace `import adapter from '@sveltejs/adapter-auto';` with
`import adapter from '@sveltejs/adapter-node';`.

- [ ] **Step 2: Wire the route with SMS + privacy config**

Replace `src/routes/api/chat/+server.ts` with:

```ts
import type { RequestHandler } from "./$types";
import { createChatHandler } from "$lib/server";
import { SYSTEM_PROMPT, MODEL } from "$lib/server/chat-context";
import { ANTHROPIC_API_KEY } from "$env/static/private";

const handler = createChatHandler({
  apiKey: ANTHROPIC_API_KEY,
  systemPrompt: SYSTEM_PROMPT,
  model: MODEL,
  privacy: { ownerNames: ["veer"], sendKeyword: "SEND" },
  // To enable SMS escalation, provide smsDepsFor wired to Twilio + Supabase.
  // See examples/api-chat-with-sms.ts for the full wiring.
});

export const POST: RequestHandler = async ({ request }) => handler(request);
```

- [ ] **Step 3: Write the gated live integration tests**

Create `tests/live/chat.live.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createRunAgent } from "../../src/lib/server/agent/run-agent";
import { createEscalation } from "../../src/lib/server/agent/sms-tool";
import { createJudge } from "../../src/lib/server/privacy/judge";
import { createPrivacyReviewGraph } from "../../src/lib/server/graph/privacy-review";
import { createChatGraph } from "../../src/lib/server/graph/chat-graph";

const live =
  process.env.RUN_LIVE_TESTS === "1" && !!process.env.ANTHROPIC_API_KEY;
const d = live ? describe : describe.skip;

function disabledSms() {
  return {
    sendSMS: async () => ({ success: false, error: "disabled" }),
    createPending: async () => ({ id: "x" }),
    checkReply: async () => null,
    clearReply: async () => {},
    markTimeout: async () => {},
    config: {},
    intervalMs: 100,
    timeoutMs: 100,
  };
}

d("live chat graph", () => {
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const runAgent = createRunAgent({
    apiKey,
    model: "claude-sonnet-4-5-20250929",
    systemPrompt:
      'You are a concise assistant for "Acme Cafe". We open at 9am daily.',
    smsDepsFor: (acc) => ({ ...disabledSms(), accumulator: acc }),
  });
  const judge = createJudge({
    client: new (require("@anthropic-ai/sdk").default)({ apiKey }) as never,
    model: "claude-3-5-haiku-20241022",
  });
  const graph = createChatGraph({
    runAgent,
    privacyReview: createPrivacyReviewGraph({
      judge,
      config: { ownerNames: ["veer"] },
    }),
    maxRewrites: 3,
    maxGateBlocks: 3,
  });

  it("answers a normal question", async () => {
    const out = await graph.invoke(
      { sessionId: "t", history: [], userMessage: "What time do you open?" },
      { recursionLimit: 50 },
    );
    expect(out.finalResponse.toLowerCase()).toContain("9");
  }, 60_000);

  it("does not leak a planted private context", async () => {
    // Run the privacy review directly with a planted secret to assert the guard rejects leaks.
    const review = createPrivacyReviewGraph({ judge, config: {} });
    const bad = await review.invoke({
      draftResponse: "The owner told me privately he is on vacation.",
      privateContexts: ["owner is on vacation"],
    });
    expect(bad.approved).toBe(false);
  }, 60_000);
});
```

- [ ] **Step 4: Run unit suite (live skipped by default)**

Run: `pnpm test`
Expected: all unit pass; live suite shows as skipped.

- [ ] **Step 5: Optionally run live tests**

Run: `RUN_LIVE_TESTS=1 pnpm test:live`
Expected: PASS (requires `ANTHROPIC_API_KEY`). If skipped/failed for env reasons, note it; do not block on it.

- [ ] **Step 6: Update .env.example**

Ensure `.env.example` documents: `ANTHROPIC_API_KEY`, and (for SMS) `TWILIO_ACCOUNT_SID`,
`TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `OWNER_PHONE_NUMBER`, plus Supabase vars. Add a
comment that `RUN_LIVE_TESTS=1` enables live tests.

- [ ] **Step 7: Delete the smoke test**

```bash
git rm src/lib/server/smoke.test.ts
```

- [ ] **Step 8: Full verification loop**

```bash
pnpm exec tsc --noEmit -p tsconfig.json   # typecheck (or `pnpm exec svelte-check` if configured)
pnpm test                                  # unit
```

Expected: typecheck clean, all unit tests pass. Fix any type errors before continuing.
(If the repo has no lint script, skip lint and note it.)

- [ ] **Step 9: Rebuild dist**

```bash
pnpm run package
```

Expected: `dist/` regenerated from current source.

- [ ] **Step 10: Update CLAUDE.md with lessons**

Create or update `CLAUDE.md` with: the LangGraph+Agent-SDK architecture summary; "run `pnpm test`
before committing; `RUN_LIVE_TESTS=1 pnpm test:live` needs an API key"; "the privacy judge is
fail-closed by design"; "rebuild `dist/` via `pnpm run package` after server changes".

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: adapter-node, live tests, route wiring, dist rebuild, docs"
```

---

## Final: open the PR

- [ ] Run the full suite once more (`pnpm test` + typecheck).
- [ ] Push the branch and open a PR via `gh pr create` summarizing the architecture change,
      the leak-prevention guarantees, and the test strategy. Link the design spec.

---

## Self-review notes (author)

- **Spec coverage:** subgraph (Task 4) ✓, configurable rules (Task 2) ✓, fail-closed judge
  (Task 3, deviation from old fail-open, intentional) ✓, gate/rewrite nodes (Task 9) ✓,
  Agent SDK locked-down runner (Task 8) ✓, SSE bridge / no frontend change (Task 11) ✓,
  Vitest unit+live (Tasks 1, 12) ✓, Node target / drop CF shims (Task 12) ✓, dist rebuild
  (Task 12) ✓.
- **Deviation from spec:** SMS bookkeeping uses a per-turn **accumulator** returned by the
  runner instead of a `PostToolUse` hook — functionally identical, simpler, and unit-testable.
  Recorded here intentionally.
- **Known fix-up:** Task 8 Step 3 contains a deliberately-flagged `escalation` reference the
  worker must collapse to `escalation: accumulator`. Do not skip the note.
- **Recursion safety:** parent graph can loop (gate→agentTurn, privacyReview→agentTurn); caps
  (`maxGateBlocks`, `maxRewrites`) guarantee termination; `recursionLimit` set on `invoke`.
