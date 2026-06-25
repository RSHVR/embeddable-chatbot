import { describe, it, expect } from "vitest";
import { StateGraph, START, END } from "@langchain/langgraph";
import { ChatState } from "./state";

// Test the reducer/defaults through LangGraph's public API rather than its internals.
describe("ChatState reducers", () => {
  it("appends privateContexts across nodes (does not overwrite)", async () => {
    const g = new StateGraph(ChatState)
      .addNode("addOne", async () => ({ privateContexts: ["b"] }))
      .addEdge(START, "addOne")
      .addEdge("addOne", END)
      .compile();
    const out = await g.invoke({ privateContexts: ["a"] });
    expect(out.privateContexts).toEqual(["a", "b"]);
  });

  it("privateContexts defaults to an empty array", async () => {
    const g = new StateGraph(ChatState)
      .addNode("noop", async () => ({}))
      .addEdge(START, "noop")
      .addEdge("noop", END)
      .compile();
    const out = await g.invoke({ userMessage: "hi" });
    expect(out.privateContexts).toEqual([]);
  });

  it("scalar fields use last-wins semantics", async () => {
    const g = new StateGraph(ChatState)
      .addNode("setCount", async () => ({ rewriteCount: 2 }))
      .addEdge(START, "setCount")
      .addEdge("setCount", END)
      .compile();
    const out = await g.invoke({ rewriteCount: 1 });
    expect(out.rewriteCount).toBe(2);
  });
});
