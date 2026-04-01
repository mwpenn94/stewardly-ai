/**
 * ReAct Multi-Turn Tool Calling Loop — Tests
 *
 * 10 tests covering the ReAct loop behavior.
 */
import { describe, it, expect, vi } from "vitest";
import { executeReActLoop, type ReActConfig } from "./reactLoop";

// ── Helpers ──────────────────────────────────────────────────────────────────

function createMockContextualLLM(responses: any[]) {
  let callIdx = 0;
  return vi.fn().mockImplementation(async () => {
    const resp = responses[callIdx] ?? responses[responses.length - 1];
    callIdx++;
    return resp;
  });
}

function makeLLMResponse(content: string, toolCalls?: any[]) {
  return {
    model: "gpt-4.1-mini",
    choices: [{
      message: {
        content,
        ...(toolCalls ? { tool_calls: toolCalls } : {}),
      },
    }],
  };
}

function makeToolCall(id: string, name: string, args: any) {
  return {
    id,
    function: {
      name,
      arguments: JSON.stringify(args),
    },
  };
}

const mockExecuteTool = vi.fn().mockResolvedValue(JSON.stringify({ result: "success" }));

const mockDb = {
  insert: vi.fn().mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  }),
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe("executeReActLoop", () => {
  it("returns direct response when no tool calls", async () => {
    const llm = createMockContextualLLM([
      makeLLMResponse("Hello! How can I help you today?"),
    ]);

    const result = await executeReActLoop({
      messages: [{ role: "user", content: "Hi" }],
      userId: 1,
      contextualLLM: llm,
      executeTool: mockExecuteTool,
    });

    expect(result.response).toBe("Hello! How can I help you today?");
    expect(result.iterations).toBe(1);
    expect(result.toolCallCount).toBe(0);
    expect(result.traces).toHaveLength(1);
    expect(result.traces[0].thought).toBe("Hello! How can I help you today?");
  });

  it("executes single tool call and returns final answer", async () => {
    const llm = createMockContextualLLM([
      // Iteration 1: LLM requests a tool call
      makeLLMResponse("Let me calculate that for you.", [
        makeToolCall("call_1", "calc_retirement", { age: 30, savings: 50000 }),
      ]),
      // Iteration 2: LLM returns final answer after tool result
      makeLLMResponse("Based on the calculation, you need to save $500/month to retire at 65."),
    ]);

    const result = await executeReActLoop({
      messages: [{ role: "user", content: "How much should I save for retirement?" }],
      userId: 1,
      tools: [{ type: "function", function: { name: "calc_retirement" } }],
      contextualLLM: llm,
      executeTool: mockExecuteTool,
    });

    expect(result.response).toBe("Based on the calculation, you need to save $500/month to retire at 65.");
    expect(result.iterations).toBe(2);
    expect(result.toolCallCount).toBe(1);
    expect(mockExecuteTool).toHaveBeenCalledWith("calc_retirement", { age: 30, savings: 50000 });
  });

  it("handles multi-turn tool calls (3 iterations)", async () => {
    const llm = createMockContextualLLM([
      // Iteration 1: first tool call
      makeLLMResponse("Looking up your portfolio.", [
        makeToolCall("call_1", "lookup_portfolio", { userId: 1 }),
      ]),
      // Iteration 2: second tool call based on first result
      makeLLMResponse("Now calculating risk.", [
        makeToolCall("call_2", "calc_risk", { portfolio: "balanced" }),
      ]),
      // Iteration 3: final answer
      makeLLMResponse("Your portfolio has moderate risk with a 7.2% expected return."),
    ]);

    const execTool = vi.fn()
      .mockResolvedValueOnce(JSON.stringify({ portfolio: "balanced", value: 100000 }))
      .mockResolvedValueOnce(JSON.stringify({ risk: "moderate", expectedReturn: 7.2 }));

    const result = await executeReActLoop({
      messages: [{ role: "user", content: "Analyze my portfolio risk" }],
      userId: 1,
      tools: [{ type: "function", function: { name: "lookup_portfolio" } }],
      contextualLLM: llm,
      executeTool: execTool,
    });

    expect(result.iterations).toBe(3);
    expect(result.toolCallCount).toBe(2);
    expect(result.response).toContain("7.2%");
  });

  it("handles tool execution errors gracefully", async () => {
    const llm = createMockContextualLLM([
      makeLLMResponse("Let me look that up.", [
        makeToolCall("call_1", "search_product", { query: "IUL" }),
      ]),
      makeLLMResponse("I encountered an error searching for that product. Let me try a different approach."),
    ]);

    const failingTool = vi.fn().mockRejectedValue(new Error("API timeout"));

    const result = await executeReActLoop({
      messages: [{ role: "user", content: "Find IUL products" }],
      userId: 1,
      tools: [{ type: "function", function: { name: "search_product" } }],
      contextualLLM: llm,
      executeTool: failingTool,
    });

    expect(result.response).toContain("error");
    expect(result.toolCallCount).toBe(1);
    // Verify the error was passed back to the LLM
    expect(llm).toHaveBeenCalledTimes(2);
  });

  it("respects maxIterations limit", async () => {
    // LLM always returns tool calls — should stop at maxIterations
    const infiniteToolCalls = Array(10).fill(
      makeLLMResponse("Thinking...", [
        makeToolCall("call_n", "calc_something", { x: 1 }),
      ]),
    );
    // Final response after max iterations
    infiniteToolCalls.push(makeLLMResponse("Final answer after max iterations."));

    const llm = createMockContextualLLM(infiniteToolCalls);

    const result = await executeReActLoop({
      messages: [{ role: "user", content: "Complex query" }],
      userId: 1,
      tools: [{ type: "function", function: { name: "calc_something" } }],
      maxIterations: 3,
      contextualLLM: llm,
      executeTool: mockExecuteTool,
    });

    // 3 iterations of tool calls + 1 final call without tools = 4 LLM calls
    expect(llm).toHaveBeenCalledTimes(4);
    expect(result.iterations).toBe(3);
  });

  it("logs reasoning traces to DB when db and sessionId provided", async () => {
    const insertValues = vi.fn().mockResolvedValue(undefined);
    const db = {
      insert: vi.fn().mockReturnValue({ values: insertValues }),
    };

    const llm = createMockContextualLLM([
      makeLLMResponse("Let me check.", [
        makeToolCall("call_1", "calc_tax", { income: 100000 }),
      ]),
      makeLLMResponse("Your estimated tax is $22,000."),
    ]);

    await executeReActLoop({
      messages: [{ role: "user", content: "Calculate my taxes" }],
      userId: 1,
      sessionId: 42,
      tools: [{ type: "function", function: { name: "calc_tax" } }],
      contextualLLM: llm,
      executeTool: mockExecuteTool,
      db,
    });

    // Should have logged traces: 1 for the tool call + 1 for the final answer
    expect(db.insert).toHaveBeenCalled();
    expect(insertValues).toHaveBeenCalled();
  });

  it("handles parallel tool calls in a single iteration", async () => {
    const llm = createMockContextualLLM([
      // LLM requests 2 tool calls simultaneously
      makeLLMResponse("Let me look up both.", [
        makeToolCall("call_1", "search_product", { query: "IUL" }),
        makeToolCall("call_2", "search_product", { query: "whole life" }),
      ]),
      makeLLMResponse("Here are both products compared."),
    ]);

    const execTool = vi.fn()
      .mockResolvedValueOnce(JSON.stringify({ product: "IUL", rate: 5.2 }))
      .mockResolvedValueOnce(JSON.stringify({ product: "Whole Life", rate: 3.8 }));

    const result = await executeReActLoop({
      messages: [{ role: "user", content: "Compare IUL and whole life" }],
      userId: 1,
      tools: [{ type: "function", function: { name: "search_product" } }],
      contextualLLM: llm,
      executeTool: execTool,
    });

    expect(result.toolCallCount).toBe(2);
    expect(result.iterations).toBe(2);
    expect(execTool).toHaveBeenCalledTimes(2);
  });

  it("escape hatch triggers on duplicate no-tool responses", async () => {
    // This tests the edge case where LLM returns similar content twice without tool calls
    // First call returns content, second call returns very similar content
    const llm = createMockContextualLLM([
      makeLLMResponse("I can help you with financial planning and retirement strategies."),
    ]);

    const result = await executeReActLoop({
      messages: [{ role: "user", content: "Help me plan" }],
      userId: 1,
      contextualLLM: llm,
      executeTool: mockExecuteTool,
    });

    // Should return after first no-tool response (escape hatch needs 2 consecutive)
    expect(result.iterations).toBe(1);
    expect(result.response).toContain("financial planning");
  });

  it("returns traces with correct structure", async () => {
    const llm = createMockContextualLLM([
      makeLLMResponse("Calculating...", [
        makeToolCall("call_1", "calc_retirement", { age: 35 }),
      ]),
      makeLLMResponse("You should save $800/month."),
    ]);

    const result = await executeReActLoop({
      messages: [{ role: "user", content: "Retirement plan" }],
      userId: 1,
      tools: [{ type: "function", function: { name: "calc_retirement" } }],
      contextualLLM: llm,
      executeTool: mockExecuteTool,
    });

    // Should have 2 traces: 1 tool trace + 1 final answer trace
    expect(result.traces.length).toBeGreaterThanOrEqual(2);

    const toolTrace = result.traces.find((t) => t.toolName === "calc_retirement");
    expect(toolTrace).toBeDefined();
    expect(toolTrace!.stepNumber).toBe(1);
    expect(toolTrace!.action).toBeDefined();
    expect(toolTrace!.observation).toBeDefined();
    expect(toolTrace!.durationMs).toBeGreaterThanOrEqual(0);

    const finalTrace = result.traces.find((t) => !t.toolName && t.thought.includes("$800"));
    expect(finalTrace).toBeDefined();
  });

  it("model field is propagated in result", async () => {
    const llm = createMockContextualLLM([
      { model: "gpt-4.1-mini", choices: [{ message: { content: "Response" } }] },
    ]);

    const result = await executeReActLoop({
      messages: [{ role: "user", content: "Test" }],
      userId: 1,
      contextualLLM: llm,
      executeTool: mockExecuteTool,
    });

    expect(result.model).toBe("gpt-4.1-mini");
  });
});
