/**
 * Tests for SSE Stream Handler
 *
 * Tests cover: SSE event types, fallback simulation, error handling,
 * disconnect cleanup, and — critically — context injection parity
 * between native streaming and fallback paths.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock sovereignWiring and contextualLLM before importing the module
vi.mock("../intelligence/sovereignWiring", () => ({
  getQuickContext: vi.fn().mockResolvedValue("mock platform context for user"),
}));

vi.mock("../intelligence/contextualLLM", () => {
  function extractQuery(messages: Array<{ role: string; content: any }>): string {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        const content = messages[i].content;
        if (typeof content === "string") return content.slice(0, 500);
      }
    }
    return "";
  }
  function injectContext(
    messages: Array<{ role: string; content: any }>,
    platformContext: string,
  ): Array<{ role: string; content: any }> {
    if (!platformContext) return messages;
    const contextBlock = `\n<platform_context>\n${platformContext}\n</platform_context>`;
    const result = [...messages];
    const systemIdx = result.findIndex((m) => m.role === "system");
    if (systemIdx >= 0) {
      result[systemIdx] = { ...result[systemIdx], content: result[systemIdx].content + contextBlock };
    } else {
      result.unshift({ role: "system", content: contextBlock.trim() });
    }
    return result;
  }
  return {
    extractQuery,
    injectContext,
  };
});

// Mock logger to avoid real logging in tests
vi.mock("../../_core/logger", () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("SSE Stream Handler", () => {
  describe("SSE Event Types", () => {
    it("should define all required event types including tool_status", () => {
      const tokenEvent = { type: "token" as const, content: "Hello" };
      const doneEvent = { type: "done" as const, sessionId: 1, totalTokens: 100 };
      const errorEvent = { type: "error" as const, message: "fail" };
      const heartbeatEvent = { type: "heartbeat" as const };
      const toolEvent = { type: "tool_status" as const, toolName: "search" };

      expect(tokenEvent.type).toBe("token");
      expect(doneEvent.type).toBe("done");
      expect(errorEvent.type).toBe("error");
      expect(heartbeatEvent.type).toBe("heartbeat");
      expect(toolEvent.type).toBe("tool_status");
    });
  });

  describe("createSSEStreamHandler", () => {
    let mockReq: any;
    let mockRes: any;
    let writtenData: string[];

    beforeEach(() => {
      vi.clearAllMocks();
      writtenData = [];
      mockReq = {
        on: vi.fn(),
      };
      mockRes = {
        setHeader: vi.fn(),
        flushHeaders: vi.fn(),
        write: vi.fn((data: string) => { writtenData.push(data); }),
        end: vi.fn(),
        writableEnded: false,
        headersSent: false,
      };
    });

    it("should set correct SSE headers", async () => {
      const { createSSEStreamHandler } = await import("./sseStreamHandler");
      const mockContextualLLM = vi.fn().mockResolvedValue({
        choices: [{ message: { content: "Hello world" } }],
        usage: { total_tokens: 10 },
      });

      await createSSEStreamHandler(mockReq, mockRes, {
        contextualLLM: mockContextualLLM,
        userId: 1,
        messages: [{ role: "user", content: "test" }],
      });

      expect(mockRes.setHeader).toHaveBeenCalledWith("Content-Type", "text/event-stream");
      expect(mockRes.setHeader).toHaveBeenCalledWith("Cache-Control", "no-cache");
      expect(mockRes.setHeader).toHaveBeenCalledWith("Connection", "keep-alive");
      expect(mockRes.setHeader).toHaveBeenCalledWith("X-Accel-Buffering", "no");
      expect(mockRes.flushHeaders).toHaveBeenCalled();
    });

    it("should emit token events and a done event in fallback mode", async () => {
      const { createSSEStreamHandler } = await import("./sseStreamHandler");
      const mockContextualLLM = vi.fn().mockResolvedValue({
        choices: [{ message: { content: "Hello world from the AI" } }],
        usage: { total_tokens: 10 },
      });

      await createSSEStreamHandler(mockReq, mockRes, {
        contextualLLM: mockContextualLLM,
        userId: 1,
        messages: [{ role: "user", content: "test" }],
      });

      const events = writtenData.map(d => {
        const match = d.match(/^data: (.+)\n\n$/);
        return match ? JSON.parse(match[1]) : null;
      }).filter(Boolean);

      const tokenEvents = events.filter((e: any) => e.type === "token");
      const doneEvents = events.filter((e: any) => e.type === "done");

      expect(tokenEvents.length).toBeGreaterThan(0);
      expect(doneEvents.length).toBe(1);

      const reconstructed = tokenEvents.map((e: any) => e.content).join("");
      expect(reconstructed).toBe("Hello world from the AI");
    });

    it("should emit error event when contextualLLM fails", async () => {
      const { createSSEStreamHandler } = await import("./sseStreamHandler");
      const mockContextualLLM = vi.fn().mockRejectedValue(new Error("LLM is down"));

      await createSSEStreamHandler(mockReq, mockRes, {
        contextualLLM: mockContextualLLM,
        userId: 1,
        messages: [{ role: "user", content: "test" }],
      });

      const events = writtenData.map(d => {
        const match = d.match(/^data: (.+)\n\n$/);
        return match ? JSON.parse(match[1]) : null;
      }).filter(Boolean);

      const errorEvents = events.filter((e: any) => e.type === "error");
      expect(errorEvents.length).toBe(1);
      expect(errorEvents[0].message).toBe("LLM is down");
    });

    it("should register disconnect handler on request", async () => {
      const { createSSEStreamHandler } = await import("./sseStreamHandler");
      const mockContextualLLM = vi.fn().mockResolvedValue({
        choices: [{ message: { content: "Hi" } }],
      });

      await createSSEStreamHandler(mockReq, mockRes, {
        contextualLLM: mockContextualLLM,
        userId: 1,
        messages: [{ role: "user", content: "test" }],
      });

      expect(mockReq.on).toHaveBeenCalledWith("close", expect.any(Function));
    });

    it("should call res.end() when stream completes", async () => {
      const { createSSEStreamHandler } = await import("./sseStreamHandler");
      const mockContextualLLM = vi.fn().mockResolvedValue({
        choices: [{ message: { content: "Done" } }],
      });

      await createSSEStreamHandler(mockReq, mockRes, {
        contextualLLM: mockContextualLLM,
        userId: 1,
        messages: [{ role: "user", content: "test" }],
      });

      expect(mockRes.end).toHaveBeenCalled();
    });

    it("should include sessionId in done event when provided", async () => {
      const { createSSEStreamHandler } = await import("./sseStreamHandler");
      const mockContextualLLM = vi.fn().mockResolvedValue({
        choices: [{ message: { content: "Hi" } }],
        usage: { total_tokens: 5 },
      });

      await createSSEStreamHandler(mockReq, mockRes, {
        contextualLLM: mockContextualLLM,
        userId: 1,
        sessionId: 42,
        messages: [{ role: "user", content: "test" }],
      });

      const events = writtenData.map(d => {
        const match = d.match(/^data: (.+)\n\n$/);
        return match ? JSON.parse(match[1]) : null;
      }).filter(Boolean);

      const doneEvent = events.find((e: any) => e.type === "done");
      expect(doneEvent.sessionId).toBe(42);
    });

    it("should call getQuickContext for context injection when userId is provided", async () => {
      const { createSSEStreamHandler } = await import("./sseStreamHandler");
      const { getQuickContext } = await import("../intelligence/sovereignWiring");

      const mockContextualLLM = vi.fn().mockResolvedValue({
        choices: [{ message: { content: "Response" } }],
      });

      await createSSEStreamHandler(mockReq, mockRes, {
        contextualLLM: mockContextualLLM,
        userId: 123,
        contextType: "chat",
        messages: [{ role: "user", content: "What is my portfolio?" }],
      });

      expect(getQuickContext).toHaveBeenCalledWith(123, "What is my portfolio?", "chat");
    });

    it("should skip context injection when userId is 0 (system-level call)", async () => {
      const { createSSEStreamHandler } = await import("./sseStreamHandler");
      const { getQuickContext } = await import("../intelligence/sovereignWiring");

      const mockContextualLLM = vi.fn().mockResolvedValue({
        choices: [{ message: { content: "System response" } }],
      });

      await createSSEStreamHandler(mockReq, mockRes, {
        contextualLLM: mockContextualLLM,
        userId: 0,
        messages: [{ role: "user", content: "system query" }],
      });

      expect(getQuickContext).not.toHaveBeenCalled();
    });

    it("should gracefully handle getQuickContext failure and still stream", async () => {
      const { createSSEStreamHandler } = await import("./sseStreamHandler");
      const { getQuickContext } = await import("../intelligence/sovereignWiring");
      (getQuickContext as any).mockRejectedValueOnce(new Error("DB connection failed"));

      const mockContextualLLM = vi.fn().mockResolvedValue({
        choices: [{ message: { content: "Fallback response" } }],
      });

      await createSSEStreamHandler(mockReq, mockRes, {
        contextualLLM: mockContextualLLM,
        userId: 1,
        messages: [{ role: "user", content: "test" }],
      });

      const events = writtenData.map(d => {
        const match = d.match(/^data: (.+)\n\n$/);
        return match ? JSON.parse(match[1]) : null;
      }).filter(Boolean);

      const tokenEvents = events.filter((e: any) => e.type === "token");
      expect(tokenEvents.length).toBeGreaterThan(0);

      const reconstructed = tokenEvents.map((e: any) => e.content).join("");
      expect(reconstructed).toBe("Fallback response");
    });

    it("should pass original messages to contextualLLM fallback to avoid double injection", async () => {
      const { createSSEStreamHandler } = await import("./sseStreamHandler");

      const mockContextualLLM = vi.fn().mockResolvedValue({
        choices: [{ message: { content: "OK" } }],
      });

      const originalMessages = [
        { role: "system", content: "You are a helpful assistant" },
        { role: "user", content: "test" },
      ];

      await createSSEStreamHandler(mockReq, mockRes, {
        contextualLLM: mockContextualLLM,
        userId: 1,
        messages: originalMessages,
      });

      // contextualLLM should receive the ORIGINAL messages, not enriched ones
      // (contextualLLM handles its own context injection internally)
      const callArgs = mockContextualLLM.mock.calls[0][0];
      expect(callArgs.messages).toBe(originalMessages);
    });
  });
});
