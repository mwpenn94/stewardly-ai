import { describe, it, expect, beforeEach } from "vitest";
import {
  checkRateLimit,
  trackAICost,
  getAICostSummary,
  estimateCost,
  validateModel,
  registerPrompt,
  getActivePrompt,
  resolvePrompt,
  listPrompts,
  logAIRequest,
  getRecentAIRequests,
  handleAIError,
  AIServiceError,
} from "./shared/aiMiddleware";

describe("Intelligence Engine — AI Middleware v4.0+", () => {
  describe("Rate Limiting", () => {
    it("allows requests within burst capacity", () => {
      const result = checkRateLimit("test-user-rl-1", "test-op");
      expect(result.allowed).toBe(true);
    });

    it("enforces rate limits after burst exhaustion", () => {
      const userId = "test-user-rl-exhaust-" + Date.now();
      // Exhaust burst capacity (20 tokens)
      for (let i = 0; i < 20; i++) {
        checkRateLimit(userId, "test-exhaust");
      }
      const result = checkRateLimit(userId, "test-exhaust");
      expect(result.allowed).toBe(false);
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it("uses separate buckets per operation", () => {
      const userId = "test-user-rl-sep-" + Date.now();
      const r1 = checkRateLimit(userId, "op-a");
      const r2 = checkRateLimit(userId, "op-b");
      expect(r1.allowed).toBe(true);
      expect(r2.allowed).toBe(true);
    });
  });

  describe("Cost Tracking", () => {
    it("tracks AI cost entries", () => {
      trackAICost({
        userId: "test-cost-1",
        operation: "chat",
        model: "gpt-4o",
        inputTokens: 500,
        outputTokens: 200,
        estimatedCostUsd: estimateCost("gpt-4o", 500, 200),
        timestamp: Date.now(),
        durationMs: 1200,
        success: true,
      });

      const summary = getAICostSummary("test-cost-1", 1);
      expect(summary.totalRequests).toBeGreaterThanOrEqual(1);
      expect(summary.totalCostUsd).toBeGreaterThan(0);
    });

    it("estimates cost correctly for known models", () => {
      const cost = estimateCost("gpt-4o", 1000, 1000);
      // gpt-4o: $0.0025/1K input + $0.01/1K output = $0.0125
      expect(cost).toBeCloseTo(0.0125, 4);
    });

    it("uses default cost for unknown models", () => {
      const cost = estimateCost("unknown-model", 1000, 1000);
      expect(cost).toBeGreaterThan(0);
    });

    it("provides daily cost breakdown", () => {
      trackAICost({
        userId: "test-daily",
        operation: "analysis",
        model: "gpt-4o-mini",
        inputTokens: 100,
        outputTokens: 50,
        estimatedCostUsd: estimateCost("gpt-4o-mini", 100, 50),
        timestamp: Date.now(),
        durationMs: 500,
        success: true,
      });

      const summary = getAICostSummary("test-daily", 1);
      expect(summary.dailyCosts.length).toBeGreaterThanOrEqual(1);
      expect(summary.byModel).toBeDefined();
      expect(summary.byOperation).toBeDefined();
    });

    it("calculates success rate correctly", () => {
      const userId = "test-success-rate-" + Date.now();
      trackAICost({
        userId, operation: "test", model: "gpt-4o",
        inputTokens: 100, outputTokens: 50,
        estimatedCostUsd: 0.01, timestamp: Date.now(),
        durationMs: 500, success: true,
      });
      trackAICost({
        userId, operation: "test", model: "gpt-4o",
        inputTokens: 100, outputTokens: 0,
        estimatedCostUsd: 0, timestamp: Date.now(),
        durationMs: 500, success: false,
      });

      const summary = getAICostSummary(userId, 1);
      expect(summary.successRate).toBe(0.5);
    });
  });

  describe("Model Validation", () => {
    it("accepts known models", () => {
      expect(validateModel("gpt-4o")).toBe("gpt-4o");
      expect(validateModel("gpt-4o-mini")).toBe("gpt-4o-mini");
      expect(validateModel("claude-3.5-sonnet")).toBe("claude-3.5-sonnet");
    });

    it("resolves 'auto' to default model", () => {
      expect(validateModel("auto")).toBe("gpt-4o");
    });

    it("falls back gracefully for unknown models", () => {
      expect(validateModel("nonexistent-model")).toBe("gpt-4o");
    });

    it("handles empty string", () => {
      expect(validateModel("")).toBe("gpt-4o");
    });
  });

  describe("Prompt Versioning", () => {
    it("registers and retrieves prompts", () => {
      const prompt = registerPrompt("test-prompt", "Hello {{name}}, welcome to {{app}}!", ["name", "app"]);
      expect(prompt.version).toBe(1);
      expect(prompt.active).toBe(true);

      const active = getActivePrompt("test-prompt");
      expect(active?.name).toBe("test-prompt");
      expect(active?.version).toBe(1);
    });

    it("versions prompts correctly", () => {
      registerPrompt("versioned-prompt", "v1 template", []);
      registerPrompt("versioned-prompt", "v2 template", []);
      const active = getActivePrompt("versioned-prompt");
      expect(active?.version).toBe(2);
      expect(active?.template).toBe("v2 template");
    });

    it("resolves template variables", () => {
      registerPrompt("resolve-test", "Hello {{name}}, your role is {{role}}.", ["name", "role"]);
      const resolved = resolvePrompt("resolve-test", { name: "Alice", role: "advisor" });
      expect(resolved).toBe("Hello Alice, your role is advisor.");
    });

    it("lists all registered prompts", () => {
      registerPrompt("list-test-a", "template a", []);
      registerPrompt("list-test-b", "template b", []);
      const list = listPrompts();
      expect(list.length).toBeGreaterThanOrEqual(2);
      const names = list.map(p => p.name);
      expect(names).toContain("list-test-a");
      expect(names).toContain("list-test-b");
    });

    it("returns empty string for unknown prompt", () => {
      const resolved = resolvePrompt("nonexistent-prompt", {});
      expect(resolved).toBe("");
    });
  });

  describe("Request Logging", () => {
    it("logs and retrieves AI requests", () => {
      const userId = "test-log-" + Date.now();
      logAIRequest({
        id: "req-1",
        userId,
        operation: "chat",
        model: "gpt-4o",
        startTime: Date.now() - 1000,
        endTime: Date.now(),
        status: "success",
        inputPreview: "Hello world",
      });

      const recent = getRecentAIRequests(userId, 10);
      expect(recent.length).toBeGreaterThanOrEqual(1);
      expect(recent[0].operation).toBe("chat");
    });

    it("filters by userId", () => {
      const userId = "test-filter-" + Date.now();
      logAIRequest({
        id: "req-filter-1",
        userId,
        operation: "analysis",
        model: "gpt-4o",
        startTime: Date.now(),
        status: "success",
      });
      logAIRequest({
        id: "req-filter-2",
        userId: "other-user",
        operation: "chat",
        model: "gpt-4o",
        startTime: Date.now(),
        status: "success",
      });

      const myRequests = getRecentAIRequests(userId, 100);
      expect(myRequests.every(r => r.userId === userId)).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("classifies rate limit errors", () => {
      expect(() => handleAIError(new Error("rate_limit exceeded"), "chat"))
        .toThrow(/rate limit/i);
    });

    it("classifies context length errors", () => {
      expect(() => handleAIError(new Error("context_length exceeded"), "analysis"))
        .toThrow(/too long/i);
    });

    it("classifies timeout errors", () => {
      expect(() => handleAIError(new Error("ETIMEDOUT"), "generation"))
        .toThrow(/timed out/i);
    });

    it("handles AIServiceError correctly", () => {
      const err = new AIServiceError("test error", "TEST_ERR", true, 5000);
      expect(() => handleAIError(err, "test")).toThrow();
    });

    it("handles unknown errors gracefully", () => {
      expect(() => handleAIError("something weird", "test"))
        .toThrow(/unexpected error/i);
    });
  });
});
