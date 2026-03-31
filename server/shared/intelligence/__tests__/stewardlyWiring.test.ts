/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Stewardly Wiring — Backward Compatibility Test Suite
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Tests that the stewardlyWiring adapter layer correctly translates between
 * the platform-agnostic shared modules and the legacy Stewardly API shapes.
 *
 * Key areas tested:
 *   1. Boolean include flag → excludeSources translation
 *   2. Flat-field AssembledContext mapping (documentContext, memoryContext, etc.)
 *   3. getQuickContext backward-compat (string return, overrides passthrough)
 *   4. assembleDeepContext backward-compat (legacy request → legacy response)
 *   5. contextualLLM backward-compat (same params shape)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// We test the internal translation functions by importing the wiring module
// and exercising its public API against mock registries.

// ─── MOCK SETUP ─────────────────────────────────────────────────────────────

// We need to mock the stewardlyContextSources and the platform assembler
// to isolate the translation logic.

// Mock the stewardlyContextSources module
vi.mock("../stewardlyContextSources", () => ({
  stewardlyContextSources: {
    documents: vi.fn(async () => "doc chunk 1\ndoc chunk 2"),
    knowledgeBase: vi.fn(async () => "KB article: Tax Planning"),
    userProfile: vi.fn(async () => "User Profile:\n- Age: 35\n- Job: Engineer"),
    suitability: vi.fn(async () => "Risk tolerance: moderate"),
    memory: vi.fn(async () => "User prefers index funds"),
    graph: vi.fn(async () => "Connected: spouse, advisor"),
    pipelineData: vi.fn(async () => "SOFR: 4.5%"),
    conversationHistory: vi.fn(async () => "Previous: discussed retirement"),
    integrations: vi.fn(async () => "Plaid: checking $5,000"),
    calculators: vi.fn(async () => "Retirement calc: on track"),
    insights: vi.fn(async () => "Insight: increase savings rate"),
    clientRelationships: vi.fn(async () => "Advisor: John Smith"),
    activityLog: vi.fn(async () => "Last login: 2 hours ago"),
    tags: vi.fn(async () => "Tags: retirement, tax-planning"),
    gapFeedback: vi.fn(async () => "Gap: estate planning knowledge"),
  },
}));

// Mock the stewardlyMemoryStore
vi.mock("../stewardlyMemoryStore", () => ({
  stewardlyMemoryStore: {
    getMemories: vi.fn(async () => []),
    saveMemory: vi.fn(async () => 1),
    getEpisodes: vi.fn(async () => []),
    saveEpisode: vi.fn(async () => 1),
  },
}));

// Mock _core/llm (will fail to import, triggering the fallback)
vi.mock("../../../_core/llm", () => {
  throw new Error("Not in Stewardly monorepo");
});

// Mock openai (also fail, so we get the "no provider" fallback)
vi.mock("openai", () => {
  throw new Error("Not installed");
});

// Now import the wiring module
import {
  assembleDeepContext,
  assembleContext,
  getQuickContext,
  getQuickContextWithMetadata,
  contextualLLM,
  getMemoryEngine,
} from "../stewardlyWiring";
import type {
  LegacyContextRequest,
  LegacyAssembledContext,
} from "../stewardlyWiring";

// ─── TESTS ──────────────────────────────────────────────────────────────────

describe("stewardlyWiring — backward compatibility", () => {

  // ── assembleDeepContext with legacy request ────────────────────────────

  describe("assembleDeepContext (legacy API)", () => {
    it("should accept a legacy ContextRequest with boolean flags", async () => {
      const result = await assembleDeepContext({
        userId: 1,
        query: "retirement planning",
        contextType: "chat",
      });

      // Should return flat-field shape
      expect(result).toHaveProperty("documentContext");
      expect(result).toHaveProperty("knowledgeBaseContext");
      expect(result).toHaveProperty("userProfileContext");
      expect(result).toHaveProperty("suitabilityContext");
      expect(result).toHaveProperty("memoryContext");
      expect(result).toHaveProperty("graphContext");
      expect(result).toHaveProperty("pipelineDataContext");
      expect(result).toHaveProperty("conversationContext");
      expect(result).toHaveProperty("integrationContext");
      expect(result).toHaveProperty("calculatorContext");
      expect(result).toHaveProperty("insightContext");
      expect(result).toHaveProperty("clientContext");
      expect(result).toHaveProperty("activityContext");
      expect(result).toHaveProperty("tagContext");
      expect(result).toHaveProperty("gapFeedbackContext");
      expect(result).toHaveProperty("fullContextPrompt");
      expect(result).toHaveProperty("sourcesUsed");
      expect(result).toHaveProperty("retrievalQuality");
    });

    it("should populate flat fields from registry sources", async () => {
      const result = await assembleDeepContext({
        userId: 1,
        query: "test query",
        contextType: "analysis",
      });

      expect(result.documentContext).toContain("doc chunk");
      expect(result.knowledgeBaseContext).toContain("KB article");
      expect(result.userProfileContext).toContain("User Profile");
      expect(result.memoryContext).toContain("index funds");
      expect(result.graphContext).toContain("Connected");
      expect(result.insightContext).toContain("increase savings");
      expect(result.integrationContext).toContain("Plaid");
      expect(result.tagContext).toContain("retirement");
      expect(result.gapFeedbackContext).toContain("estate planning");
    });

    it("should have all 15 sources in sourcesUsed when all return data", async () => {
      const result = await assembleDeepContext({
        userId: 1,
        query: "test",
        contextType: "chat",
      });

      expect(result.sourcesUsed.length).toBe(15);
    });

    it("should return a non-empty fullContextPrompt", async () => {
      const result = await assembleDeepContext({
        userId: 1,
        query: "test",
        contextType: "chat",
      });

      expect(result.fullContextPrompt.length).toBeGreaterThan(0);
      expect(typeof result.fullContextPrompt).toBe("string");
    });

    it("should return valid retrievalQuality", async () => {
      const result = await assembleDeepContext({
        userId: 1,
        query: "test",
        contextType: "chat",
      });

      expect(["high", "medium", "low"]).toContain(result.retrievalQuality);
    });

    it("should exclude sources when boolean flags are set to false", async () => {
      const result = await assembleDeepContext({
        userId: 1,
        query: "test",
        contextType: "chat",
        includeDocuments: false,
        includeMemories: false,
      });

      // Documents and memory should be empty (excluded)
      expect(result.documentContext).toBe("");
      expect(result.memoryContext).toBe("");

      // Other sources should still have data
      expect(result.knowledgeBaseContext).toContain("KB article");
      expect(result.userProfileContext).toContain("User Profile");
    });

    it("should NOT exclude sources when boolean flags are undefined (default include)", async () => {
      // Only explicitly false flags should exclude; undefined = include
      const result = await assembleDeepContext({
        userId: 1,
        query: "test",
        contextType: "chat",
        // includeDocuments is NOT set (undefined) — should still include
      });

      expect(result.documentContext).toContain("doc chunk");
    });

    it("should handle all boolean flags being false", async () => {
      const result = await assembleDeepContext({
        userId: 1,
        query: "test",
        contextType: "chat",
        includeDocuments: false,
        includeKnowledgeBase: false,
        includeMemories: false,
        includeConversationHistory: false,
        includePipelineData: false,
        includeIntegrations: false,
        includeCalculators: false,
        includeInsights: false,
        includeClientData: false,
        includeActivityLog: false,
        includeFinancialData: false,
      });

      // Most fields should be empty
      expect(result.documentContext).toBe("");
      expect(result.knowledgeBaseContext).toBe("");
      expect(result.memoryContext).toBe("");
      expect(result.conversationContext).toBe("");

      // userProfile, suitability, graph, tags, gapFeedback have no boolean flags
      // so they should still be populated
      expect(result.userProfileContext).toContain("User Profile");
      expect(result.suitabilityContext).toContain("Risk tolerance");
      expect(result.graphContext).toContain("Connected");
      expect(result.tagContext).toContain("Tags");
      expect(result.gapFeedbackContext).toContain("Gap");
    });

    it("should also accept platform-style ContextRequest with excludeSources", async () => {
      const result = await assembleDeepContext({
        userId: 1,
        query: "test",
        contextType: "chat",
        excludeSources: ["documents", "memory"],
      });

      expect(result.documentContext).toBe("");
      expect(result.memoryContext).toBe("");
      expect(result.knowledgeBaseContext).toContain("KB article");
    });
  });

  // ── getQuickContext backward compat ────────────────────────────────────

  describe("getQuickContext (legacy API)", () => {
    it("should return a plain string", async () => {
      const result = await getQuickContext(1, "retirement", "chat");
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("should accept 3 args (userId, query, contextType)", async () => {
      // This is the most common call pattern in production
      const result = await getQuickContext(1, "test query", "analysis");
      expect(typeof result).toBe("string");
    });

    it("should accept 4 args with legacy overrides", async () => {
      const result = await getQuickContext(1, "test", "chat", {
        includeDocuments: false,
        maxTokenBudget: 4000,
      });
      expect(typeof result).toBe("string");
    });

    it("should accept 4 args with platform overrides", async () => {
      const result = await getQuickContext(1, "test", "chat", {
        maxTokenBudget: 4000,
      });
      expect(typeof result).toBe("string");
    });
  });

  // ── getQuickContextWithMetadata ───────────────────────────────────────

  describe("getQuickContextWithMetadata", () => {
    it("should return contextPrompt and metadata", async () => {
      const result = await getQuickContextWithMetadata(1, "test", "chat");
      expect(result).toHaveProperty("contextPrompt");
      expect(result).toHaveProperty("metadata");
      expect(result.metadata).toHaveProperty("contextSourceHitRate");
      expect(result.metadata).toHaveProperty("sourcesHit");
      expect(result.metadata).toHaveProperty("retrievalQuality");
      expect(result.metadata).toHaveProperty("assemblyDurationMs");
    });

    it("should have contextSourceHitRate between 0 and 1", async () => {
      const result = await getQuickContextWithMetadata(1, "test", "chat");
      expect(result.metadata.contextSourceHitRate).toBeGreaterThanOrEqual(0);
      expect(result.metadata.contextSourceHitRate).toBeLessThanOrEqual(1);
    });
  });

  // ── assembleContext (platform API) ────────────────────────────────────

  describe("assembleContext (platform API)", () => {
    it("should return platform-style AssembledContext with sourceContexts", async () => {
      const result = await assembleContext({
        userId: 1,
        query: "test",
        contextType: "chat",
      });

      expect(result).toHaveProperty("sourceContexts");
      expect(result).toHaveProperty("fullContextPrompt");
      expect(result).toHaveProperty("metadata");
      expect(typeof result.sourceContexts).toBe("object");
      expect(result.sourceContexts.documents).toContain("doc chunk");
    });
  });

  // ── LegacyAssembledContext type shape ─────────────────────────────────

  describe("LegacyAssembledContext shape", () => {
    it("should have totalChunksRetrieved as a number (compat field)", async () => {
      const result = await assembleDeepContext({
        userId: 1,
        query: "test",
        contextType: "chat",
      });

      expect(typeof result.totalChunksRetrieved).toBe("number");
      // Platform layer doesn't track chunk counts, so this is 0
      expect(result.totalChunksRetrieved).toBe(0);
    });

    it("should have sourcesUsed as an array of strings", async () => {
      const result = await assembleDeepContext({
        userId: 1,
        query: "test",
        contextType: "chat",
      });

      expect(Array.isArray(result.sourcesUsed)).toBe(true);
      result.sourcesUsed.forEach((s: string) => {
        expect(typeof s).toBe("string");
      });
    });
  });

  // ── contextualLLM backward compat ─────────────────────────────────────

  describe("contextualLLM (backward compat)", () => {
    it("should accept the same params shape as the original", async () => {
      // contextualLLM will fail because no LLM provider is available in test,
      // but we can verify it accepts the right params shape
      try {
        await contextualLLM({
          userId: 1,
          contextType: "chat",
          query: "test",
          messages: [{ role: "user", content: "hello" }],
          model: "gpt-4o-mini",
          temperature: 0.7,
        });
      } catch (e: any) {
        // Expected: "No LLM provider available"
        expect(e.message).toContain("No LLM provider available");
      }
    });

    it("should accept null userId (no context injection)", async () => {
      try {
        await contextualLLM({
          userId: null,
          messages: [{ role: "user", content: "hello" }],
        });
      } catch (e: any) {
        expect(e.message).toContain("No LLM provider available");
      }
    });
  });

  // ── SourceFetchOptions passthrough at wiring level ────────────────────

  describe("SourceFetchOptions passthrough", () => {
    it("getQuickContext should pass conversationId through to source fetchers", async () => {
      const { stewardlyContextSources } = await import("../stewardlyContextSources");
      const docsMock = stewardlyContextSources.documents as ReturnType<typeof vi.fn>;
      const convMock = stewardlyContextSources.conversationHistory as ReturnType<typeof vi.fn>;

      // Clear previous call records
      docsMock.mockClear();
      convMock.mockClear();

      await getQuickContext(1, "test", "chat", {
        conversationId: 99,
        specificDocIds: [5, 10],
        category: "financial",
      });

      // Verify conversationId was passed to conversationHistory source
      expect(convMock).toHaveBeenCalled();
      const convCallOpts = convMock.mock.calls[0][2]; // 3rd arg = SourceFetchOptions
      expect(convCallOpts).toBeDefined();
      expect(convCallOpts.conversationId).toBe(99);

      // Verify specificDocIds and category were passed to documents source
      expect(docsMock).toHaveBeenCalled();
      const docsCallOpts = docsMock.mock.calls[0][2];
      expect(docsCallOpts).toBeDefined();
      expect(docsCallOpts.specificDocIds).toEqual([5, 10]);
      expect(docsCallOpts.category).toBe("financial");
    });

    it("getQuickContextWithMetadata should pass overrides through to source fetchers", async () => {
      const { stewardlyContextSources } = await import("../stewardlyContextSources");
      const convMock = stewardlyContextSources.conversationHistory as ReturnType<typeof vi.fn>;
      convMock.mockClear();

      await getQuickContextWithMetadata(1, "test", "chat", {
        conversationId: 77,
      });

      expect(convMock).toHaveBeenCalled();
      const convCallOpts = convMock.mock.calls[0][2];
      expect(convCallOpts).toBeDefined();
      expect(convCallOpts.conversationId).toBe(77);
    });

    it("getQuickContext without overrides should pass undefined SourceFetchOptions fields", async () => {
      const { stewardlyContextSources } = await import("../stewardlyContextSources");
      const convMock = stewardlyContextSources.conversationHistory as ReturnType<typeof vi.fn>;
      convMock.mockClear();

      await getQuickContext(1, "test", "chat");

      expect(convMock).toHaveBeenCalled();
      const convCallOpts = convMock.mock.calls[0][2];
      expect(convCallOpts).toBeDefined();
      expect(convCallOpts.conversationId).toBeUndefined();
      expect(convCallOpts.specificDocIds).toBeUndefined();
      expect(convCallOpts.category).toBeUndefined();
    });
  });

  // ── getMemoryEngine ───────────────────────────────────────────────────

  describe("getMemoryEngine", () => {
    it("should return a memory engine with expected methods", async () => {
      const engine = await getMemoryEngine();
      expect(engine).toHaveProperty("extractMemoriesFromMessage");
      expect(engine).toHaveProperty("saveExtractedMemories");
      expect(engine).toHaveProperty("assembleMemoryContext");
      expect(engine).toHaveProperty("getEpisodes");
      expect(typeof engine.extractMemoriesFromMessage).toBe("function");
    });

    it("should return the same cached instance on second call", async () => {
      const engine1 = await getMemoryEngine();
      const engine2 = await getMemoryEngine();
      expect(engine1).toBe(engine2);
    });
  });
});
