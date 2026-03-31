/**
 * ═══════════════════════════════════════════════════════════════════════════
 * @platform/intelligence — Test Suite
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  normalizeQualityScore,
  BASE_MEMORY_CATEGORIES,
  EXTENDED_MEMORY_CATEGORIES,
} from "../types";
import type {
  ContextSourceRegistry,
  AssemblyMetadata,
} from "../types";
import {
  assembleDeepContext,
  assembleQuickContext,
} from "../deepContextAssembler";
import {
  createContextualLLM,
  extractQuery,
  injectContext,
} from "../contextualLLM";
import { createMemoryEngine } from "../memoryEngine";
import type { MemoryStore, StoredMemory, StoredEpisode } from "../memoryEngine";

// ─── QUALITY SCORE NORMALIZATION ─────────────────────────────────────────────

describe("normalizeQualityScore", () => {
  it("should pass through scores already in [0, 1]", () => {
    expect(normalizeQualityScore(0)).toBe(0);
    expect(normalizeQualityScore(0.5)).toBe(0.5);
    expect(normalizeQualityScore(1)).toBe(1);
    expect(normalizeQualityScore(0.85)).toBe(0.85);
  });

  it("should normalize scores on 0-100 scale to [0, 1]", () => {
    expect(normalizeQualityScore(85)).toBe(0.85);
    expect(normalizeQualityScore(100)).toBe(1);
    expect(normalizeQualityScore(50)).toBe(0.5);
    expect(normalizeQualityScore(1.5)).toBeCloseTo(0.015);
  });

  it("should clamp negative scores to 0", () => {
    expect(normalizeQualityScore(-5)).toBe(0);
    expect(normalizeQualityScore(-0.1)).toBe(0);
  });

  it("should clamp scores above 100 to 1", () => {
    expect(normalizeQualityScore(150)).toBe(1);
    expect(normalizeQualityScore(200)).toBe(1);
  });

  it("should handle edge case of exactly 1", () => {
    // 1 is not > 1, so it passes through as-is
    expect(normalizeQualityScore(1)).toBe(1);
  });
});

// ─── MEMORY CATEGORIES ──────────────────────────────────────────────────────

describe("Memory Categories", () => {
  it("should include base categories", () => {
    expect(BASE_MEMORY_CATEGORIES).toContain("fact");
    expect(BASE_MEMORY_CATEGORIES).toContain("preference");
    expect(BASE_MEMORY_CATEGORIES).toContain("goal");
    expect(BASE_MEMORY_CATEGORIES).toContain("relationship");
    expect(BASE_MEMORY_CATEGORIES).toContain("financial");
    expect(BASE_MEMORY_CATEGORIES).toContain("temporal");
  });

  it("should include extended categories", () => {
    expect(EXTENDED_MEMORY_CATEGORIES).toContain("amp_engagement");
    expect(EXTENDED_MEMORY_CATEGORIES).toContain("ho_domain_trajectory");
  });

  it("extended should be a superset of base", () => {
    for (const cat of BASE_MEMORY_CATEGORIES) {
      expect(EXTENDED_MEMORY_CATEGORIES).toContain(cat);
    }
  });
});

// ─── DEEP CONTEXT ASSEMBLER ─────────────────────────────────────────────────

describe("assembleDeepContext", () => {
  const mockRegistry: ContextSourceRegistry = {
    documents: vi.fn(async () => "Document content about retirement planning"),
    knowledgeBase: vi.fn(async () => "KB article about 401k contributions"),
    userProfile: vi.fn(async () => "USER PROFILE:\n  Name: John\n  Age: 35"),
    memory: vi.fn(async () => "KNOWN ABOUT THIS USER:\n  FACT: Married with 2 kids"),
    emptySource: vi.fn(async () => ""),
    failingSource: vi.fn(async () => {
      throw new Error("Source failed");
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should assemble context from all sources", async () => {
    const result = await assembleDeepContext(mockRegistry, {
      userId: 1,
      query: "retirement planning",
      contextType: "chat",
    });

    expect(result.fullContextPrompt).toContain("Document content");
    expect(result.fullContextPrompt).toContain("KB article");
    expect(result.fullContextPrompt).toContain("USER PROFILE");
    expect(result.fullContextPrompt).toContain("KNOWN ABOUT THIS USER");
  });

  it("should compute contextSourceHitRate correctly", async () => {
    const result = await assembleDeepContext(mockRegistry, {
      userId: 1,
      query: "test",
      contextType: "chat",
    });

    // 4 sources return data, 1 empty, 1 fails = 4/6
    expect(result.metadata.sourcesQueried.length).toBe(6);
    expect(result.metadata.sourcesHit.length).toBe(4);
    expect(result.metadata.contextSourceHitRate).toBeCloseTo(4 / 6, 2);
  });

  it("should handle all sources failing gracefully", async () => {
    const failRegistry: ContextSourceRegistry = {
      a: vi.fn(async () => { throw new Error("fail"); }),
      b: vi.fn(async () => ""),
    };

    const result = await assembleDeepContext(failRegistry, {
      userId: 1,
      query: "test",
      contextType: "chat",
    });

    expect(result.metadata.contextSourceHitRate).toBe(0);
    expect(result.fullContextPrompt).toBe("");
    expect(result.metadata.retrievalQuality).toBe("low");
  });

  it("should respect includeSources filter", async () => {
    const result = await assembleDeepContext(mockRegistry, {
      userId: 1,
      query: "test",
      contextType: "chat",
      includeSources: ["documents", "memory"],
    });

    expect(result.metadata.sourcesQueried).toEqual(["documents", "memory"]);
    expect(result.metadata.sourcesQueried).not.toContain("knowledgeBase");
  });

  it("should respect excludeSources filter", async () => {
    const result = await assembleDeepContext(mockRegistry, {
      userId: 1,
      query: "test",
      contextType: "chat",
      excludeSources: ["failingSource", "emptySource"],
    });

    expect(result.metadata.sourcesQueried).not.toContain("failingSource");
    expect(result.metadata.sourcesQueried).not.toContain("emptySource");
  });

  it("should include assembly duration in metadata", async () => {
    const result = await assembleDeepContext(mockRegistry, {
      userId: 1,
      query: "test",
      contextType: "chat",
    });

    expect(result.metadata.assemblyDurationMs).toBeGreaterThanOrEqual(0);
  });

  it("should truncate context to fit token budget", async () => {
    const largeRegistry: ContextSourceRegistry = {
      huge: vi.fn(async () => "x".repeat(100000)),
    };

    const result = await assembleDeepContext(largeRegistry, {
      userId: 1,
      query: "test",
      contextType: "chat",
      maxTokenBudget: 100,
    });

    // 100 tokens * 4 chars = 400 chars max
    expect(result.fullContextPrompt.length).toBeLessThan(500);
  });

  it("should pass SourceFetchOptions (conversationId, category, specificDocIds) to source fetchers", async () => {
    const capturedOpts: unknown[] = [];
    const registry: ContextSourceRegistry = {
      documents: vi.fn(async (_userId, _query, opts) => {
        capturedOpts.push({ source: "documents", opts });
        return "doc content";
      }),
      conversationHistory: vi.fn(async (_userId, _query, opts) => {
        capturedOpts.push({ source: "conversationHistory", opts });
        return "conv content";
      }),
      other: vi.fn(async (_userId, _query, opts) => {
        capturedOpts.push({ source: "other", opts });
        return "other content";
      }),
    };

    await assembleDeepContext(registry, {
      userId: 1,
      query: "test",
      contextType: "chat",
      conversationId: 42,
      specificDocIds: [10, 20],
      category: "financial",
    });

    expect(capturedOpts.length).toBe(3);
    // All sources receive the same SourceFetchOptions
    for (const captured of capturedOpts) {
      const { opts } = captured as { source: string; opts: any };
      expect(opts.conversationId).toBe(42);
      expect(opts.specificDocIds).toEqual([10, 20]);
      expect(opts.category).toBe("financial");
    }
  });

  it("should pass undefined SourceFetchOptions fields when not provided", async () => {
    let capturedOpts: unknown = null;
    const registry: ContextSourceRegistry = {
      test: vi.fn(async (_userId, _query, opts) => {
        capturedOpts = opts;
        return "content";
      }),
    };

    await assembleDeepContext(registry, {
      userId: 1,
      query: "test",
      contextType: "chat",
    });

    expect(capturedOpts).toBeDefined();
    expect((capturedOpts as any).conversationId).toBeUndefined();
    expect((capturedOpts as any).specificDocIds).toBeUndefined();
    expect((capturedOpts as any).category).toBeUndefined();
  });
});

describe("assembleQuickContext", () => {
  it("should return contextPrompt and metadata", async () => {
    const registry: ContextSourceRegistry = {
      test: vi.fn(async () => "test context"),
    };

    const result = await assembleQuickContext(registry, 1, "hello", "chat");

    expect(result.contextPrompt).toContain("test context");
    expect(result.metadata).toBeDefined();
    expect(result.metadata.contextSourceHitRate).toBe(1);
  });
});

// ─── CONTEXTUAL LLM ─────────────────────────────────────────────────────────

describe("extractQuery", () => {
  it("should extract the last user message", () => {
    const messages = [
      { role: "system", content: "You are helpful" },
      { role: "user", content: "First question" },
      { role: "assistant", content: "First answer" },
      { role: "user", content: "Second question" },
    ];

    expect(extractQuery(messages)).toBe("Second question");
  });

  it("should return empty string if no user messages", () => {
    const messages = [
      { role: "system", content: "You are helpful" },
      { role: "assistant", content: "Hello" },
    ];

    expect(extractQuery(messages)).toBe("");
  });

  it("should truncate long messages to 500 chars", () => {
    const messages = [{ role: "user", content: "x".repeat(1000) }];
    expect(extractQuery(messages).length).toBe(500);
  });

  it("should handle OpenAI array content blocks", () => {
    const messages = [
      { role: "user", content: [{ type: "text", text: "Array content question" }] },
    ];
    expect(extractQuery(messages as any)).toBe("Array content question");
  });

  it("should return empty string for array content without text part", () => {
    const messages = [
      { role: "user", content: [{ type: "image_url", image_url: { url: "http://example.com" } }] },
    ];
    expect(extractQuery(messages as any)).toBe("");
  });
});

describe("injectContext", () => {
  it("should append to existing system message", () => {
    const messages = [
      { role: "system", content: "You are helpful" },
      { role: "user", content: "Hello" },
    ];

    const result = injectContext(messages, "Context data");

    expect(result[0].content).toContain("You are helpful");
    expect(result[0].content).toContain("Context data");
    expect(result[0].content).toContain("platform_context");
  });

  it("should prepend system message if none exists", () => {
    const messages = [{ role: "user", content: "Hello" }];

    const result = injectContext(messages, "Context data");

    expect(result[0].role).toBe("system");
    expect(result[0].content).toContain("Context data");
    expect(result.length).toBe(2);
  });

  it("should not mutate original messages", () => {
    const messages = [
      { role: "system", content: "Original" },
      { role: "user", content: "Hello" },
    ];

    injectContext(messages, "Context data");

    expect(messages[0].content).toBe("Original");
  });
});

describe("createContextualLLM", () => {
  it("should inject context and call LLM", async () => {
    const mockInvoke = vi.fn(async () => ({
      choices: [{ message: { content: "Response", role: "assistant" }, finish_reason: "stop" }],
      model: "test",
    }));

    const registry: ContextSourceRegistry = {
      test: vi.fn(async () => "test context"),
    };

    const contextualLLM = createContextualLLM({
      registry,
      invokeLLM: mockInvoke,
    });

    const result = await contextualLLM({
      userId: 1,
      contextType: "chat",
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(mockInvoke).toHaveBeenCalled();
    expect(result.choices[0].message.content).toBe("Response");
    expect(result.metadata?.contextSourceHitRate).toBeDefined();
  });

  it("should skip context when skipContext is true", async () => {
    const mockInvoke = vi.fn(async () => ({
      choices: [{ message: { content: "Response", role: "assistant" }, finish_reason: "stop" }],
      model: "test",
    }));

    const registry: ContextSourceRegistry = {
      test: vi.fn(async () => "test context"),
    };

    const contextualLLM = createContextualLLM({
      registry,
      invokeLLM: mockInvoke,
    });

    await contextualLLM({
      userId: 1,
      contextType: "chat",
      messages: [{ role: "user", content: "Hello" }],
      skipContext: true,
    });

    // Registry should not have been called
    expect(registry.test).not.toHaveBeenCalled();
  });

  it("should normalize quality scores in response metadata", async () => {
    const mockInvoke = vi.fn(async () => ({
      choices: [{ message: { content: "Response", role: "assistant" }, finish_reason: "stop" }],
      model: "test",
      metadata: { qualityScore: 85 },
    }));

    const contextualLLM = createContextualLLM({
      registry: {},
      invokeLLM: mockInvoke,
    });

    const result = await contextualLLM({
      userId: 1,
      contextType: "chat",
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(result.metadata?.qualityScore).toBe(0.85);
  });
});

// ─── MEMORY ENGINE ──────────────────────────────────────────────────────────

describe("createMemoryEngine", () => {
  const mockStore: MemoryStore = {
    getMemories: vi.fn(async () => [
      { id: 1, userId: 1, category: "fact", content: "User is 35 years old", source: "auto", confidence: 0.9, updatedAt: new Date() },
      { id: 2, userId: 1, category: "preference", content: "Prefers charts over text", source: "auto", confidence: 0.8, updatedAt: new Date() },
    ] as StoredMemory[]),
    insertMemories: vi.fn(async () => {}),
    getEpisodes: vi.fn(async () => [
      { id: 1, userId: 1, conversationId: 1, summary: "Discussed retirement planning", keyTopics: ["retirement"], emotionalTone: "curious", createdAt: new Date() },
    ] as StoredEpisode[]),
    insertEpisode: vi.fn(async () => {}),
  };

  const mockLLM = vi.fn(async () => ({
    choices: [{
      message: {
        content: JSON.stringify([
          { category: "fact", content: "User has a dog named Max", confidence: 0.9 },
        ]),
      },
    }],
  }));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should extract memories from messages", async () => {
    const engine = createMemoryEngine({ store: mockStore, llm: mockLLM });

    const memories = await engine.extractMemoriesFromMessage(1, "I have a dog named Max", "That's nice!");

    expect(memories.length).toBe(1);
    expect(memories[0].category).toBe("fact");
    expect(memories[0].content).toBe("User has a dog named Max");
  });

  it("should filter out invalid categories", async () => {
    const badLLM = vi.fn(async () => ({
      choices: [{
        message: {
          content: JSON.stringify([
            { category: "invalid_category", content: "test", confidence: 0.9 },
            { category: "fact", content: "valid", confidence: 0.9 },
          ]),
        },
      }],
    }));

    const engine = createMemoryEngine({ store: mockStore, llm: badLLM });
    const memories = await engine.extractMemoriesFromMessage(1, "test", "test");

    expect(memories.length).toBe(1);
    expect(memories[0].category).toBe("fact");
  });

  it("should accept amp_engagement and ho_domain_trajectory categories", async () => {
    const ampLLM = vi.fn(async () => ({
      choices: [{
        message: {
          content: JSON.stringify([
            { category: "amp_engagement", content: "User completed Phase 2", confidence: 0.95 },
            { category: "ho_domain_trajectory", content: "Financial acumen improving", confidence: 0.8 },
          ]),
        },
      }],
    }));

    const engine = createMemoryEngine({ store: mockStore, llm: ampLLM });
    const memories = await engine.extractMemoriesFromMessage(1, "test", "test");

    expect(memories.length).toBe(2);
    expect(memories[0].category).toBe("amp_engagement");
    expect(memories[1].category).toBe("ho_domain_trajectory");
  });

  it("should normalize confidence scores", async () => {
    const highConfLLM = vi.fn(async () => ({
      choices: [{
        message: {
          content: JSON.stringify([
            { category: "fact", content: "test", confidence: 95 },
          ]),
        },
      }],
    }));

    const engine = createMemoryEngine({ store: mockStore, llm: highConfLLM });
    const memories = await engine.extractMemoriesFromMessage(1, "test", "test");

    expect(memories[0].confidence).toBe(0.95);
  });

  it("should deduplicate before saving", async () => {
    const engine = createMemoryEngine({ store: mockStore, llm: mockLLM });

    // Mock store returns existing memory with same content
    (mockStore.getMemories as any).mockResolvedValueOnce([
      { id: 1, userId: 1, category: "fact", content: "User has a dog named Max", source: "auto", confidence: 0.9, updatedAt: new Date() },
    ]);

    await engine.saveExtractedMemories(1, [
      { category: "fact", content: "User has a dog named Max", confidence: 0.9 },
    ]);

    expect(mockStore.insertMemories).not.toHaveBeenCalled();
  });

  it("should assemble memory context", async () => {
    const engine = createMemoryEngine({ store: mockStore, llm: mockLLM });

    const context = await engine.assembleMemoryContext(1);

    expect(context).toContain("KNOWN ABOUT THIS USER");
    expect(context).toContain("FACT: User is 35 years old");
    expect(context).toContain("PREFERENCE: Prefers charts over text");
    expect(context).toContain("RECENT CONVERSATION HISTORY");
    expect(context).toContain("Discussed retirement planning");
  });

  it("should expose configured categories", async () => {
    const engine = createMemoryEngine({ store: mockStore, llm: mockLLM });

    expect(engine.categories).toContain("fact");
    expect(engine.categories).toContain("amp_engagement");
    expect(engine.categories).toContain("ho_domain_trajectory");
  });

  it("should handle LLM extraction failures gracefully", async () => {
    const failLLM = vi.fn(async () => { throw new Error("LLM down"); });
    const engine = createMemoryEngine({ store: mockStore, llm: failLLM });

    const memories = await engine.extractMemoriesFromMessage(1, "test", "test");
    expect(memories).toEqual([]);
  });

  it("should limit extractions to maxExtractionsPerMessage", async () => {
    const manyLLM = vi.fn(async () => ({
      choices: [{
        message: {
          content: JSON.stringify(
            Array.from({ length: 10 }, (_, i) => ({
              category: "fact",
              content: `Fact ${i}`,
              confidence: 0.9,
            })),
          ),
        },
      }],
    }));

    const engine = createMemoryEngine({
      store: mockStore,
      llm: manyLLM,
      maxExtractionsPerMessage: 3,
    });

    const memories = await engine.extractMemoriesFromMessage(1, "test", "test");
    expect(memories.length).toBe(3);
  });

  it("should generate episode summaries for conversations with enough messages", async () => {
    const episodeLLM = vi.fn(async () => ({
      choices: [{
        message: {
          content: JSON.stringify({
            summary: "Discussed retirement planning options",
            keyTopics: ["retirement", "401k"],
            emotionalTone: "curious",
          }),
        },
      }],
    }));

    const engine = createMemoryEngine({ store: mockStore, llm: episodeLLM });

    const episode = await engine.generateEpisodeSummary([
      { role: "user", content: "Tell me about retirement" },
      { role: "assistant", content: "There are several options..." },
      { role: "user", content: "What about 401k?" },
      { role: "assistant", content: "A 401k is..." },
    ]);

    expect(episode).not.toBeNull();
    expect(episode?.summary).toContain("retirement");
    expect(episode?.keyTopics).toContain("retirement");
  });

  it("should return null for conversations with fewer than 4 messages", async () => {
    const engine = createMemoryEngine({ store: mockStore, llm: mockLLM });

    const episode = await engine.generateEpisodeSummary([
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello!" },
    ]);

    expect(episode).toBeNull();
  });
});
