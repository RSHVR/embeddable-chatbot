# CLAUDE.md — embeddable-chatbot

Project-specific guidance for working in this repo. (Global prefs live in `~/.claude/CLAUDE.md`.)

## What this is

An embeddable SvelteKit chat widget powered by Claude. The server-side chat handler is
re-architected onto **LangGraph.js** (orchestration) + the **Claude Agent SDK** (model turns).

## Architecture (server)

The chat handler is a LangGraph `StateGraph` (`src/lib/server/graph/`):

```
START → agentTurn → gate → privacyReview (subgraph) → finalize | safeFallback | (loop back to agentTurn)
```

- **agentTurn** (`agent/run-agent.ts`) runs one Claude Agent SDK `query()`. Locked down:
  `settingSources: []`, custom `systemPrompt`, and `allowedTools` = ONLY the in-process
  `notify_owner_sms` tool — the bot cannot read files or run bash.
- **gate** (`graph/nodes.ts`) blocks the visitor-facing reply until the owner texts the
  release keyword (`SEND`), or times out.
- **privacyReview** (`graph/privacy-review.ts`) is a subgraph: `quickCheck` (regex/keyword,
  `privacy/rules.ts`) → `llmJudge` (`privacy/judge.ts`). Leak rules are configurable via
  `PrivacyConfig` (owner names, send keyword, extra patterns).
- The SMS owner-conversation lives inside the agent tool handler (`agent/sms-tool.ts`),
  which `await`s a Supabase poll (`agent/wait-for-reply.ts`).
- `index.ts` builds the graph per request and bridges the result to the existing SSE
  protocol (`data:{text}`, `{type:'waiting'}`, `[DONE]`). No frontend changes.

Design spec: `docs/superpowers/specs/2026-06-02-…-design.md`.
Plan: `docs/superpowers/plans/2026-06-02-langgraph-agent-sdk-chatbot.md`.

## Verification loop (before committing)

1. `pnpm test` — unit tests (no network; model/Twilio/Supabase are mocked).
2. `pnpm check` — svelte-check typecheck. NOTE: there are pre-existing type errors in the
   `.svelte` UI components (Chat/ChatInput/ChatPopup) unrelated to the server; don't let
   them mask new errors in your changes.
3. `RUN_LIVE_TESTS=1 pnpm test:live` — optional live integration tests (needs `ANTHROPIC_API_KEY`).

## Non-obvious gotchas (learned the hard way)

- **Vitest version is pinned to `^3.2`, NOT 4.** Vitest 4 requires Vite 6+, but this repo is
  SvelteKit 2 / Vite 5. Vitest 3.2 supports Vite 5 and has the `test.projects` API used in
  `vitest.config.ts` (unit + live projects).
- **Agent SDK streaming input only accepts USER messages.** You cannot replay prior assistant
  turns as input. `run-agent.ts` renders the conversation into a single transcript prompt
  (`renderPrompt`) instead.
- **LangGraph `Command.goto` is normalized to an array** (`['nodeName']`), not a string —
  unwrap it in tests.
- **The privacy judge is fail-closed by design**: API/parse errors → REJECT (the old handler
  failed open). Keep it that way; the requirement is "never leak".
- **Judge output is messy; parse it robustly.** The judge LLM returns fenced JSON
  (` ```json ... ``` `) with trailing prose. `JSON.parse` on the raw text fails →
  fail-closed → wrongly rejects every clean response. `parseVerdict` strips fences and
  isolates the JSON object; keep using it. Also: judge model must be current
  (`claude-haiku-4-5-20251001`); `claude-3-5-haiku-20241022` is retired (`not_found_error`).
- **No prettier config in the repo.** Committed style is single-quote/tabs, but an environment
  formatter may rewrite touched files to double-quote/2-space. Stage only files you actually
  changed; don't sweep formatter churn into commits.
- **`dist/` is committed.** Rebuild it with `pnpm run package` when finalizing server changes
  so the published `./server` entry matches source.
- **Agent SDK spawns a subprocess per `query()`** — this targets a Node runtime
  (`adapter-node`), not edge/Workers.
