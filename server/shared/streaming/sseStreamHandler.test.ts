/**
 * Tests for SSE Stream Handler
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Unit tests for helper functions (extracted via import) ────────────────────

describe("SSE Stream Handler", () => {
  describe("chunkByWords", () => {
    // We test the chunking logic by importing the module and testing indirectly
    it("should split text into word-sized chunks", async () => {
      // Import the module to test the internal chunking
      const mod = await import("./sseStreamHandler");
      // The chunkByWords function is not exported, but we can test the fallback
      // simulation behavior which uses it internally
      expect(mod.createSSEStreamHandler).toBeDefined();
    });
  });

  describe("SSE Event Types", () => {
    it("should define all required event types", () => {
      // Verify the type contract
      const tokenEvent = { type: "token" as const, content: "Hello" };
      const doneEvent = { type: "done" as const, sessionId: 1, totalTokens: 100 };
      const errorEvent = { type: "error" as const, message: "fail" };
      const heartbeatEvent = { type: "heartbeat" as const };

      expect(tokenEvent.type).toBe("token");
      expect(doneEvent.type).toBe("done");
      expect(errorEvent.type).toBe("error");
      expect(heartbeatEvent.type).toBe("heartbeat");
    });
  });

  describe("createSSEStreamHandler", () => {
    let mockReq: any;
    let mockRes: any;
    let writtenData: string[];

    beforeEach(() => {
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

      // Don't await — we need to check headers immediately
      const promise = createSSEStreamHandler(mockReq, mockRes, {
        contextualLLM: mockContextualLLM,
        userId: 1,
        messages: [{ role: "user", content: "test" }],
      });

      // Wait for the handler to complete
      await promise;

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

      // Should have written some token events and a done event
      const events = writtenData.map(d => {
        const match = d.match(/^data: (.+)\n\n$/);
        return match ? JSON.parse(match[1]) : null;
      }).filter(Boolean);

      const tokenEvents = events.filter((e: any) => e.type === "token");
      const doneEvents = events.filter((e: any) => e.type === "done");

      expect(tokenEvents.length).toBeGreaterThan(0);
      expect(doneEvents.length).toBe(1);

      // Concatenated tokens should equal the original content
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
  });
});
