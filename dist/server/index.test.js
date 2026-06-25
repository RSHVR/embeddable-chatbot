import { describe, it, expect } from "vitest";
import { streamGraphResultToSSE } from "./index";
async function collectSSE(stream) {
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
    const text = [...out.matchAll(/data: (\{"text":.*?\})\n\n/g)]
      .map((m) => JSON.parse(m[1]).text)
      .join("");
    expect(text).toBe("Hello there friend");
  });
  it("emits exactly one [DONE] terminator", async () => {
    const out = await collectSSE(
      streamGraphResultToSSE({ finalResponse: "hi" }, { delayMs: 0 }),
    );
    expect(out.match(/\[DONE\]/g)).toHaveLength(1);
  });
});
