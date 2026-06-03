import { describe, it, expect } from "vitest";
import { extractResultText, renderPrompt } from "./run-agent";
import type { ChatMessage } from "../types";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

describe("renderPrompt", () => {
  it("renders history transcript + new turn + feedback note", () => {
    const history: ChatMessage[] = [
      { sender: "user", text: "hi" },
      { sender: "bot", text: "hello" },
    ];
    const prompt = renderPrompt(
      history,
      "what are your hours?",
      "REJECTED: rewrite please",
    );
    expect(prompt).toContain("Previous conversation:");
    expect(prompt).toContain("Visitor: hi");
    expect(prompt).toContain("Assistant: hello");
    expect(prompt).toContain("Visitor: what are your hours?");
    expect(prompt).toContain("REJECTED: rewrite please");
    expect(prompt).toContain("not visible to the visitor");
  });
  it("omits the transcript and feedback when not present", () => {
    const prompt = renderPrompt([], "hello");
    expect(prompt).not.toContain("Previous conversation:");
    expect(prompt).not.toContain("SYSTEM NOTE");
    expect(prompt).toBe("Visitor: hello");
  });
});

describe("extractResultText", () => {
  it("returns the success result string", () => {
    const messages = [
      { type: "assistant", message: {} },
      { type: "result", subtype: "success", result: "We open at 9am." },
    ] as unknown as SDKMessage[];
    expect(extractResultText(messages)).toBe("We open at 9am.");
  });
  it("returns empty string when no success result present", () => {
    const messages = [
      { type: "result", subtype: "error_max_turns" },
    ] as unknown as SDKMessage[];
    expect(extractResultText(messages)).toBe("");
  });
});
