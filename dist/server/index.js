import { createChatGraph } from "./graph/chat-graph";
import { createRunAgent } from "./agent/run-agent";
import { createJudge } from "./privacy/judge";
import { createPrivacyReviewGraph } from "./graph/privacy-review";
export const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant. Be friendly, concise, and helpful.

Guidelines:
- Keep responses brief (1-3 sentences when possible)
- Be conversational and approachable
- If you don't know something, be honest about it
- Ask clarifying questions when needed`;
export const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";
export const DEFAULT_JUDGE_MODEL = "claude-3-5-haiku-20241022";
/** Bridge a finished graph result onto the SSE protocol the widget expects. */
export function streamGraphResultToSSE(result, opts = {}) {
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
export function createChatHandler(options) {
  const model = options.model ?? DEFAULT_MODEL;
  const judgeModel = options.judgeModel ?? DEFAULT_JUDGE_MODEL;
  const systemPrompt = options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
  const privacy = options.privacy ?? {};
  const maxRewrites = options.maxRewrites ?? 3;
  const maxGateBlocks = options.maxGateBlocks ?? 3;
  return async (request) => {
    try {
      const { message, sessionId, history } = await request.json();
      if (!message || typeof message !== "string") {
        return json({ error: "Message is required" }, 400);
      }
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const judgeClient = new Anthropic({ apiKey: options.apiKey });
      const judge = createJudge({
        client: judgeClient,
        model: judgeModel,
      });
      const privacyReview = createPrivacyReviewGraph({
        judge,
        config: privacy,
      });
      const encoder = new TextEncoder();
      let waitingEmitted = false;
      const readable = new ReadableStream({
        async start(controller) {
          const emit = (obj) =>
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
          const runAgent = createRunAgent({
            apiKey: options.apiKey,
            model,
            systemPrompt,
            maxTurns: options.maxToolTurns ?? 10,
            smsDepsFor: (accumulator) => ({
              ...(options.smsDepsFor
                ? options.smsDepsFor(sessionId, accumulator, onWaiting)
                : disabledSmsDeps()),
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
                history: history ?? [],
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
              const out = [
                ...(history ?? []),
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
function disabledSmsDeps() {
  return {
    sendSMS: async () => ({ success: false, error: "SMS not configured" }),
    createPending: async () => ({ id: "disabled" }),
    checkReply: async () => null,
    clearReply: async () => {},
    markTimeout: async () => {},
  };
}
function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
