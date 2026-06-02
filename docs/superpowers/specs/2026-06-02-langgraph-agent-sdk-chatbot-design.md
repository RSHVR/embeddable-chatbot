# Design: Leak-proof chatbot on LangGraph.js + Claude Agent SDK

**Date:** 2026-06-02
**Branch:** `feat/langgraph-agent-sdk`
**Status:** Approved design — pending implementation plan

## Goal

A perfectly functioning embeddable chatbot that **never leaks private information** to
the visitor, with a **local test suite**, re-architected onto **LangGraph.js**
(`@langchain/langgraph@^1`) for orchestration and the **Claude Agent SDK**
(`@anthropic-ai/claude-agent-sdk@^0.3`) for model execution.

## Context: what exists today

- SvelteKit library/widget. Core logic is a hand-rolled agentic `while` loop in
  `src/lib/server/index.ts` (`createChatHandler`) calling the raw `@anthropic-ai/sdk`
  `beta.messages.create` with the `context-management-2025-06-27` beta.
- Privacy is enforced by: `quickPrivacyCheck` (regex/keyword fast-check), an LLM
  `judgeResponse`, a "gate" that blocks the visitor-facing reply until the owner
  texts back `SEND`, a hard block on `PRIVATE CONVERSATION` text, and a rewrite loop.
- Two-way SMS via Twilio REST (`src/lib/server/tools/sms-notify.ts`) with state in
  Supabase (`src/lib/server/sms-state.ts`, table `pending_sms`).
- Streaming SSE protocol consumed by the Svelte widget: `data: {text}`,
  `{type:'waiting'}`, `{type:'message_complete'}`, `{type:'error'}`, `[DONE]`.
- **No tests, no test runner. No LangGraph/LangChain. No Agent SDK installed.**

## Decisions (locked with the user)

1. **Model layer:** Claude Agent SDK runs inside LangGraph nodes. LangGraph owns the
   high-level state machine (gate → privacy review → rewrite); the Agent SDK owns each
   model turn and its internal tool loop. Replaces raw `beta.messages` +
   `context-management` beta with the Agent SDK's built-in loop & compaction.
2. **Runtime:** Node server (e.g. `adapter-node`). Drop Cloudflare Workers compat shims.
3. **Tests:** Broad unit coverage (Vitest), plus optional **live** integration tests
   gated behind `RUN_LIVE_TESTS=1` + `ANTHROPIC_API_KEY`.
4. **Leak rules:** Keep the regex/keyword fast-check, but lift owner-specific bits
   (owner name, the `SEND` keyword) into **handler config** instead of hardcoding.
   The LLM judge remains the deep second check.
5. **Branch:** `feat/langgraph-agent-sdk`, PR at the end.

## Architecture

Two layers, clean boundary:

```
ParentGraph (one visitor turn)
  START
   └─ agentTurn ──────────► Claude Agent SDK query()
   │     - systemPrompt = configured prompt ONLY
   │     - settingSources: []  (no CLAUDE.md / filesystem settings)
   │     - allowedTools: ONLY the in-process notify_owner_sms tool
   │     - in-process SMS tool handler awaits Supabase poll for owner reply
   │     - PostToolUse hook records owner replies → privateContexts, flips
   │       receivedSEND / smsTimedOut on graph state
   ▼
  gateCheck
   ├─(hadSMS && !receivedSEND && !smsTimedOut && gateBlockCount<3)─► agentTurn (force-continue owner convo)
   ├─(gateBlockCount>=3)──────────────────────────────────────────► safeFallback → END
   │  (else: allowed to consider responding)
   ▼
  privacyReview  ◄═══ SUBGRAPH ═══►  START → quickCheck → llmJudge → verdict → END
   │                                  (regex/keyword)  (LLM, only if privateContexts>0)
   ├─(rejected && rewriteCount<N)──► rewrite → agentTurn
   ├─(rejected && rewriteCount>=N)─► safeFallback → END   (generic safe message)
   └─(approved)────────────────────► finalize → END
```

### Why this shape

- The **privacy-review subgraph** is the heart of the leak-prevention requirement:
  a pure, deterministic, isolated unit. Input `{draftResponse, privateContexts, config}`,
  output `{approved, reason}`. Most heavily tested; reasoned about in isolation.
- Gate and rewrite become **explicit nodes + conditional edges** rather than `continue`
  statements buried in a long `while` loop — readable and testable.
- The Agent SDK is **locked down**: no filesystem settings, custom system prompt only,
  and the _only_ exposed tool is the in-process SMS tool. The bot cannot read files or
  run shell commands — privacy by construction.

### SMS escalation lives inside `agentTurn` (one subgraph, not two)

The SMS owner-conversation stays inside the Agent SDK tool handler (async `await` on the
Supabase poll). The Agent SDK natively drives the multi-turn owner loop; modelling it as
a second LangGraph subgraph would require interrupting/resuming `query()` mid-flight —
more complexity for no benefit (YAGNI). A `PostToolUse` hook surfaces owner replies and
`SEND` detection onto the parent graph state for the gate to act on. Result: exactly one
subgraph (privacy review), which is honest rather than forced.

## Components & files

| File                                            | Purpose                                                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `src/lib/server/graph/state.ts`                 | `Annotation.Root` state schema + reducers                                                         |
| `src/lib/server/graph/privacy-review.ts`        | Privacy-review **subgraph** (quickCheck → llmJudge → verdict)                                     |
| `src/lib/server/graph/nodes.ts`                 | Parent nodes: `agentTurn`, `gateCheck`, `rewrite`, `safeFallback`, `finalize`                     |
| `src/lib/server/graph/chat-graph.ts`            | Parent `StateGraph` wiring (edges, conditional routing, compile)                                  |
| `src/lib/server/agent/sms-tool.ts`              | In-process Agent SDK tool (`createSdkMcpServer` + `tool()`) wrapping existing `sendSMS`/SMS state |
| `src/lib/server/privacy/rules.ts`               | Configurable leak rules (owner name, SEND keyword, leak patterns); pure `quickPrivacyCheck`       |
| `src/lib/server/index.ts`                       | `createChatHandler` rewritten: builds graph, runs it, bridges to existing SSE protocol            |
| `src/lib/server/sms-state.ts`                   | Unchanged (Supabase state)                                                                        |
| `src/lib/server/tools/sms-notify.ts`            | Reused for `sendSMS`, Twilio signature, webhook parsing                                           |
| `vitest.config.ts` (or `vite.config.ts` `test`) | Vitest config with `unit` + `live` projects                                                       |
| `src/lib/server/**/*.test.ts`                   | Unit tests                                                                                        |
| `tests/live/*.live.test.ts`                     | Gated live integration tests                                                                      |

### State schema (`Annotation.Root`)

`sessionId: string`, `history: ChatMessage[]`, `userMessage: string`,
`draftResponse: string`, `privateContexts: string[]` (reducer: append),
`hadSMSInteraction: boolean`, `receivedSEND: boolean`, `smsTimedOut: boolean`,
`rewriteCount: number`, `gateBlockCount: number`, `rejectionReason?: string`,
`finalResponse: string`.

### Configurable leak rules (`privacy/rules.ts`)

```ts
export interface PrivacyConfig {
  ownerNames?: string[]; // e.g. ['veer'] — matched as \bname\b
  sendKeyword?: string; // default 'SEND'
  extraLeakPatterns?: RegExp[]; // appended to the built-in set
}
```

Built-in patterns retained: `<PRIVATE CONVERSATION>` tags, the `SEND` keyword,
`he said|she said|owner said|apparently|i checked with|i asked … and`, plus any owner
names from config. `quickPrivacyCheck(response, config)` is pure and synchronous.

### Streaming bridge

The graph executes server-side; `createChatHandler` returns the same SSE
`ReadableStream` as today. Visitor-facing text is streamed **only after**
`privacyReview` approves (or a safe fallback fires). `waiting`/`message_complete`
events are emitted from node transitions. **No frontend changes.**

## Error handling

- Agent SDK `query()` error → emit `{type:'error'}` SSE, close stream (parity with today).
- LLM judge error → **fail safe = reject** (the current code fails open/approve; we will
  flip to fail-closed because the requirement is "never leak"). On repeated judge failure
  the rewrite cap routes to `safeFallback`.
- SMS poll timeout → `smsTimedOut=true`; gate allows a graceful "I'll follow up" response.
- Rewrite/gate caps (`N=3`) → `safeFallback` returns a generic safe message; never leak.
- Supabase/Twilio errors inside the SMS tool → tool returns an error result string; the
  agent is instructed to ask the visitor for contact info.

## Testing strategy

**Vitest**, two projects:

- `unit` (default, no network): privacy subgraph (every leak pattern; SEND detection;
  PRIVATE CONVERSATION hard block; judge approve/reject parsing; fail-closed on judge
  error; rewrite cap → safe fallback), `gateCheck` routing matrix, Twilio signature
  validation, webhook parsing, parent-graph wiring with a **stubbed** `agentTurn`.
- `live` (gated `RUN_LIVE_TESTS=1` + `ANTHROPIC_API_KEY`): real Agent SDK round-trip —
  (a) a normal question gets answered; (b) a planted private context never appears in the
  visitor-facing output.

The model and Supabase/Twilio are injected as dependencies so unit tests mock them.

## Risks / trade-offs

- **Agent SDK spawns a subprocess** (Claude Code CLI) per `query()` — heavier than a single
  API call; relevant for cold-start/concurrency on the Node host. Accepted (Node target).
- **Loss of `context-management-2025-06-27` beta** — replaced by Agent SDK built-in
  compaction. Similar, not identical.
- **`dist/` is committed and currently dirty.** Rebuild as the final step so the published
  package matches source.
- **Behavioural parity:** the rewrite of `createChatHandler` must preserve the SSE contract
  and the hard privacy guarantees; covered by unit tests on the bridge + gate.

## Out of scope (YAGNI)

- LangGraph checkpointers/persistence (no resume-across-requests requirement).
- A second subgraph for SMS.
- Frontend/widget changes.
- Switching the model provider away from Anthropic.
