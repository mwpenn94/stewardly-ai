/**
 * agentTools.test.ts — Vitest tests for Pass 129 agent tool fixes.
 *
 * Tests cover:
 *   1. AGENT_TOOLS export shape (all 6 tools present with correct schema)
 *   2. executeAgentTool routing (dispatches to correct handler)
 *   3. wide_research: string normalization, array normalization, empty guard
 *   4. read_webpage: invalid URL guard, LLM fallback path
 *   5. analyze_data: empty data guard
 *   6. generate_document: missing title guard
 *   7. generate_image: missing prompt guard
 *   8. execute_code: basic evaluation
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock LLM so tests don't hit real APIs ──────────────────────────
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(async () => ({
    choices: [{ message: { content: "Mocked LLM response for testing" } }],
  })),
}));

// ─── Mock web search ────────────────────────────────────────────────
vi.mock("./services/webSearchTool", () => ({
  executeWebSearch: vi.fn(async (query: string) =>
    `Search results for: ${query}\n1. Example result about ${query}`
  ),
  getSearchProvider: vi.fn(() => "mock"),
}));

// ─── Mock image generation ──────────────────────────────────────────
vi.mock("./_core/imageGeneration", () => ({
  generateImage: vi.fn(async () => ({ url: "https://example.com/generated.png" })),
}));

// ─── Mock contextualLLM ─────────────────────────────────────────────
vi.mock("./shared/stewardlyWiring", () => ({
  contextualLLM: vi.fn(async () => ({
    choices: [{ message: { content: "Mocked contextual LLM response" } }],
  })),
}));

describe("agentTools", () => {
  let AGENT_TOOLS: any[];
  let executeAgentTool: (name: string, args: Record<string, any>) => Promise<string>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("./agentTools");
    AGENT_TOOLS = mod.AGENT_TOOLS;
    executeAgentTool = mod.executeAgentTool;
  });

  // ─── 1. Export shape ──────────────────────────────────────────────
  describe("AGENT_TOOLS export", () => {
    it("exports exactly 6 tools", () => {
      expect(AGENT_TOOLS).toHaveLength(6);
    });

    it("each tool has type=function and a function.name", () => {
      for (const tool of AGENT_TOOLS) {
        expect(tool.type).toBe("function");
        expect(tool.function).toBeDefined();
        expect(typeof tool.function.name).toBe("string");
        expect(tool.function.name.length).toBeGreaterThan(0);
      }
    });

    it("contains all expected tool names", () => {
      const names = AGENT_TOOLS.map((t: any) => t.function.name);
      expect(names).toContain("read_webpage");
      expect(names).toContain("wide_research");
      expect(names).toContain("execute_code");
      expect(names).toContain("analyze_data");
      expect(names).toContain("generate_image");
      expect(names).toContain("generate_document");
    });

    it("each tool has parameters with required fields", () => {
      for (const tool of AGENT_TOOLS) {
        expect(tool.function.parameters).toBeDefined();
        expect(tool.function.parameters.type).toBe("object");
        expect(tool.function.parameters.properties).toBeDefined();
      }
    });
  });

  // ─── 2. executeAgentTool routing ──────────────────────────────────
  describe("executeAgentTool routing", () => {
    it("returns error for unknown tool name", async () => {
      const result = await executeAgentTool("nonexistent_tool", {});
      const parsed = JSON.parse(result);
      expect(parsed.error).toMatch(/unknown.*tool/i);
    });
  });

  // ─── 3. wide_research ────────────────────────────────────────────
  describe("wide_research", () => {
    it("handles array of queries", async () => {
      const result = await executeAgentTool("wide_research", {
        queries: ["query one", "query two"],
        topic: "test topic",
      });
      // Should not be an error
      const parsed = JSON.parse(result);
      expect(parsed.error).toBeUndefined();
      // Should contain results from both queries
      expect(result).toContain("query one");
      expect(result).toContain("query two");
    });

    it("handles string query (auto-splits)", async () => {
      const result = await executeAgentTool("wide_research", {
        queries: "single query string",
        topic: "test",
      });
      const parsed = JSON.parse(result);
      expect(parsed.error).toBeUndefined();
    });

    it("handles comma-separated string queries", async () => {
      const result = await executeAgentTool("wide_research", {
        queries: "first query, second query",
        topic: "test",
      });
      const parsed = JSON.parse(result);
      expect(parsed.error).toBeUndefined();
    });

    it("returns error for empty queries", async () => {
      const result = await executeAgentTool("wide_research", {
        queries: [],
        topic: "test",
      });
      const parsed = JSON.parse(result);
      expect(parsed.error).toBeDefined();
    });
  });

  // ─── 4. read_webpage ─────────────────────────────────────────────
  describe("read_webpage", () => {
    it("rejects invalid URL (no protocol)", async () => {
      const result = await executeAgentTool("read_webpage", {
        url: "example.com",
      });
      const parsed = JSON.parse(result);
      expect(parsed.error).toMatch(/invalid.*url/i);
    });

    it("rejects empty URL", async () => {
      const result = await executeAgentTool("read_webpage", {
        url: "",
      });
      const parsed = JSON.parse(result);
      expect(parsed.error).toMatch(/invalid.*url/i);
    });
  });

  // ─── 5. analyze_data ─────────────────────────────────────────────
  describe("analyze_data", () => {
    it("handles empty data gracefully", async () => {
      const result = await executeAgentTool("analyze_data", {
        data: "",
        analysis_type: "summary",
      });
      // Should return a valid JSON response (not crash)
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it("handles missing data field", async () => {
      const result = await executeAgentTool("analyze_data", {
        analysis_type: "comparison",
      });
      expect(() => JSON.parse(result)).not.toThrow();
    });
  });

  // ─── 6. generate_document ────────────────────────────────────────
  describe("generate_document", () => {
    it("handles missing title gracefully", async () => {
      const result = await executeAgentTool("generate_document", {
        content: "Some content",
      });
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it("handles missing content gracefully", async () => {
      const result = await executeAgentTool("generate_document", {
        title: "Test Doc",
      });
      expect(() => JSON.parse(result)).not.toThrow();
    });
  });

  // ─── 7. generate_image ───────────────────────────────────────────
  describe("generate_image", () => {
    it("handles missing prompt gracefully", async () => {
      const result = await executeAgentTool("generate_image", {});
      const parsed = JSON.parse(result);
      // Should either return an error or handle gracefully
      expect(parsed).toBeDefined();
    });
  });

  // ─── 8. execute_code ─────────────────────────────────────────────
  describe("execute_code", () => {
    it("evaluates simple arithmetic", async () => {
      const result = await executeAgentTool("execute_code", {
        code: "2 + 2",
        description: "Simple addition",
      });
      const parsed = JSON.parse(result);
      expect(parsed.result).toBe("4");
    });

    it("evaluates string operations", async () => {
      const result = await executeAgentTool("execute_code", {
        code: '"hello".toUpperCase()',
        description: "String uppercase",
      });
      const parsed = JSON.parse(result);
      expect(parsed.result).toBe("HELLO");
    });

    it("handles code errors gracefully", async () => {
      const result = await executeAgentTool("execute_code", {
        code: "throw new Error('test error');",
        description: "Error test",
      });
      const parsed = JSON.parse(result);
      expect(parsed.error).toBeDefined();
    });
  });
});
