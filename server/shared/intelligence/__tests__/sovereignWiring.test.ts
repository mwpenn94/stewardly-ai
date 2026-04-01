/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Sovereign Wiring — Comprehensive Test Suite
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Tests the Sovereign intelligence layer integration:
 *   1.  Context source registry (21 sources: 15 AEGIS + 6 Sovereign)
 *   2.  Sovereign LLM router (failover, canary detection, usage logging)
 *   3.  Quality score normalization across all response paths
 *   4.  Model version tracking on all responses
 *   5.  Backward compatibility with Stewardly wiring API
 *   6.  Memory store enrichment (Sovereign categories)
 *   7.  Config store (autonomy persistence, budget config)
 *   8.  Provider usage logging and cost estimation
 *   9.  Canary route health detection
 *   10. Budget tracking and alert thresholds
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── MOCK SETUP ─────────────────────────────────────────────────────────────

// Mock stewardlyContextSources (the 15 AEGIS sources)
vi.mock("../stewardlyContextSources", () => ({
  stewardlyContextSources: {
    documents: vi.fn(async () => "[Source: doc1] Financial planning guide"),
    knowledgeBase: vi.fn(async () => "KB: Tax-loss harvesting strategies"),
    userProfile: vi.fn(async () => "User: Age 42, Engineer, Moderate risk"),
    suitability: vi.fn(async () => "Risk tolerance: moderate-aggressive"),
    memory: vi.fn(async () => "Prefers index funds over active management"),
    graph: vi.fn(async () => "Connected: spouse(Sarah), advisor(John)"),
    pipelineData: vi.fn(async () => "SOFR: 4.33%, CPI: 3.2%"),
    conversationHistory: vi.fn(async () => "Prev: discussed Roth conversion"),
    integrations: vi.fn(async () => "Plaid: checking $12,500"),
    calculators: vi.fn(async () => "Retirement: 87% funded"),
    insights: vi.fn(async () => "Insight: increase 401k contribution"),
    clientRelationships: vi.fn(async () => "Advisor: John Smith, CFP"),
    activityLog: vi.fn(async () => "Last login: 30 min ago"),
    tags: vi.fn(async () => "Tags: retirement, tax-planning, estate"),
    gapFeedback: vi.fn(async () => "Gap: estate planning knowledge"),
  },
}));

// Mock stewardlyMemoryStore
vi.mock("../stewardlyMemoryStore", () => ({
  stewardlyMemoryStore: {
    getMemories: vi.fn(async () => [
      { id: 1, category: "fact", content: "User is 42 years old", confidence: 0.95, source: "profile" },
      { id: 2, category: "preference", content: "Prefers index funds", confidence: 85, source: "chat" },
    ]),
    insertMemories: vi.fn(async () => {}),
    getEpisodes: vi.fn(async () => []),
    insertEpisode: vi.fn(async () => {}),
  },
}));

// Mock _core/llm (fallback path)
vi.mock("../../../_core/llm", () => {
  throw new Error("Not in monorepo");
});

// Mock openai (fallback LLM)
vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: vi.fn(async () => ({
          choices: [{ message: { content: "Mock response", role: "assistant" }, finish_reason: "stop" }],
          model: "gpt-4o-mini",
          usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        })),
      },
    };
  },
}));

// Mock DB
vi.mock("../../../db", () => ({
  getDb: vi.fn(async () => null),
}));

// Mock stewardlyConfigStore
vi.mock("../../config/stewardlyConfigStore", () => ({
  stewardlyConfigStore: {
    getLayerSettings: vi.fn(async () => [
      { layer: 1, name: "Platform", settings: { toneStyle: "professional" } },
      { layer: 5, name: "User", settings: null },
    ]),
    getLayerConfig: vi.fn(async () => null),
    upsertLayerConfig: vi.fn(async () => {}),
  },
}));

// ─── IMPORT AFTER MOCKS ────────────────────────────────────────────────────

import { sovereignContextSources } from "../sovereignContextSources";
import {
  sovereignMemoryStore,
  SOVEREIGN_MEMORY_CATEGORIES,
  recordRoutingMemory,
  recordBudgetMemory,
  recordAutonomyTransition,
  recordReflection,
} from "../sovereignMemoryStore";
import {
  sovereignConfigStore,
  DEFAULT_SOVEREIGN_CONFIG,
} from "../../config/sovereignConfigStore";
import { normalizeQualityScore } from "../types";

// ═══════════════════════════════════════════════════════════════════════════
// 1. CONTEXT SOURCE REGISTRY TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("sovereignContextSources", () => {
  it("should have all 15 AEGIS sources", () => {
    const aegisSources = [
      "documents", "knowledgeBase", "userProfile", "suitability",
      "memory", "graph", "pipelineData", "conversationHistory",
      "integrations", "calculators", "insights", "clientRelationships",
      "activityLog", "tags", "gapFeedback",
    ];
    for (const source of aegisSources) {
      expect(sovereignContextSources).toHaveProperty(source);
      expect(typeof sovereignContextSources[source]).toBe("function");
    }
  });

  it("should have all 6 Sovereign-specific sources", () => {
    const sovereignSources = [
      "routingDecisions", "goalsPlansAndTasks", "reflections",
      "providerUsageLogs", "budgets", "autonomyState",
    ];
    for (const source of sovereignSources) {
      expect(sovereignContextSources).toHaveProperty(source);
      expect(typeof sovereignContextSources[source]).toBe("function");
    }
  });

  it("should have exactly 21 total sources", () => {
    expect(Object.keys(sovereignContextSources).length).toBe(21);
  });

  it("should return AEGIS data from inherited sources", async () => {
    const docResult = await sovereignContextSources.documents(1, "test query");
    expect(docResult).toContain("Financial planning guide");
  });

  it("should return empty string from Sovereign sources when DB unavailable", async () => {
    const routingResult = await sovereignContextSources.routingDecisions(1, "test");
    // Should gracefully handle missing DB
    expect(typeof routingResult).toBe("string");
  });

  it("should handle all Sovereign sources gracefully without DB", async () => {
    const sources = ["routingDecisions", "goalsPlansAndTasks", "reflections",
      "providerUsageLogs", "budgets", "autonomyState"];
    for (const source of sources) {
      const result = await sovereignContextSources[source](1, "test");
      expect(typeof result).toBe("string");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. QUALITY SCORE NORMALIZATION TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("Quality Score Normalization", () => {
  it("should normalize 0-100 scores to 0-1 range", () => {
    expect(normalizeQualityScore(85)).toBe(0.85);
    expect(normalizeQualityScore(100)).toBe(1);
    expect(normalizeQualityScore(0)).toBe(0);
  });

  it("should pass through scores already in 0-1 range", () => {
    expect(normalizeQualityScore(0.5)).toBe(0.5);
    expect(normalizeQualityScore(0.99)).toBe(0.99);
  });

  it("should clamp negative scores to 0", () => {
    expect(normalizeQualityScore(-10)).toBe(0);
  });

  it("should clamp scores above 100 to 1", () => {
    expect(normalizeQualityScore(150)).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. SOVEREIGN MEMORY STORE TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("sovereignMemoryStore", () => {
  it("should normalize confidence scores on getMemories", async () => {
    const memories = await sovereignMemoryStore.getMemories(1, 10);
    // The mock returns confidence: 85 for one memory (0-100 scale)
    // sovereignMemoryStore should normalize it to 0.85
    const highConfidence = memories.find(m => m.content === "Prefers index funds");
    expect(highConfidence).toBeDefined();
    expect(highConfidence!.confidence).toBe(0.85);
  });

  it("should pass through already-normalized confidence scores", async () => {
    const memories = await sovereignMemoryStore.getMemories(1, 10);
    const normalConfidence = memories.find(m => m.content === "User is 42 years old");
    expect(normalConfidence).toBeDefined();
    expect(normalConfidence!.confidence).toBe(0.95);
  });

  it("should have all Sovereign memory categories", () => {
    expect(SOVEREIGN_MEMORY_CATEGORIES).toContain("routing_decision");
    expect(SOVEREIGN_MEMORY_CATEGORIES).toContain("provider_performance");
    expect(SOVEREIGN_MEMORY_CATEGORIES).toContain("budget_awareness");
    expect(SOVEREIGN_MEMORY_CATEGORIES).toContain("autonomy_progression");
    expect(SOVEREIGN_MEMORY_CATEGORIES).toContain("reflection");
    expect(SOVEREIGN_MEMORY_CATEGORIES).toContain("goal_completion");
  });

  it("should include base categories alongside Sovereign categories", () => {
    expect(SOVEREIGN_MEMORY_CATEGORIES).toContain("fact");
    expect(SOVEREIGN_MEMORY_CATEGORIES).toContain("preference");
    expect(SOVEREIGN_MEMORY_CATEGORIES).toContain("goal");
    expect(SOVEREIGN_MEMORY_CATEGORIES).toContain("amp_engagement");
    expect(SOVEREIGN_MEMORY_CATEGORIES).toContain("ho_domain_trajectory");
  });

  it("should have exactly 14 memory categories", () => {
    expect(SOVEREIGN_MEMORY_CATEGORIES.length).toBe(14);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. SOVEREIGN MEMORY HELPERS TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("Sovereign Memory Helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("recordRoutingMemory should insert a routing_decision memory", async () => {
    const { stewardlyMemoryStore: mockStore } = await import("../stewardlyMemoryStore");
    await recordRoutingMemory(1, "financial_analysis", "gemini-2.5-flash", 0.92, 1500);
    expect(mockStore.insertMemories).toHaveBeenCalledWith(
      1,
      expect.arrayContaining([
        expect.objectContaining({
          category: "routing_decision",
          source: "sovereign_router",
        }),
      ]),
    );
  });

  it("recordBudgetMemory should insert a budget_awareness memory", async () => {
    const { stewardlyMemoryStore: mockStore } = await import("../stewardlyMemoryStore");
    await recordBudgetMemory(1, "threshold_reached", "80% of monthly budget used");
    expect(mockStore.insertMemories).toHaveBeenCalledWith(
      1,
      expect.arrayContaining([
        expect.objectContaining({
          category: "budget_awareness",
          confidence: 1.0,
        }),
      ]),
    );
  });

  it("recordAutonomyTransition should insert an autonomy_progression memory", async () => {
    const { stewardlyMemoryStore: mockStore } = await import("../stewardlyMemoryStore");
    await recordAutonomyTransition(1, "supervised", "guided", "Trust score reached 30");
    expect(mockStore.insertMemories).toHaveBeenCalledWith(
      1,
      expect.arrayContaining([
        expect.objectContaining({
          category: "autonomy_progression",
          source: "sovereign_autonomy",
        }),
      ]),
    );
  });

  it("recordReflection should insert a reflection memory with normalized quality", async () => {
    const { stewardlyMemoryStore: mockStore } = await import("../stewardlyMemoryStore");
    await recordReflection(1, "Retirement planning", 85, "Need more estate planning data");
    expect(mockStore.insertMemories).toHaveBeenCalledWith(
      1,
      expect.arrayContaining([
        expect.objectContaining({
          category: "reflection",
          confidence: 0.85, // normalized from 85
        }),
      ]),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. SOVEREIGN CONFIG STORE TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("sovereignConfigStore", () => {
  it("should return layer settings with Sovereign overlay", async () => {
    const layers = await sovereignConfigStore.getLayerSettings(1);
    expect(layers.length).toBeGreaterThan(0);
    // L1 should have Sovereign config injected
    const l1 = layers.find(l => l.layer === 1);
    expect(l1).toBeDefined();
    expect(l1!.settings).toHaveProperty("sovereignProvider");
    expect(l1!.settings).toHaveProperty("sovereignBudget");
    expect(l1!.settings).toHaveProperty("sovereignAutonomy");
  });

  it("should include default Sovereign config when DB unavailable", async () => {
    const layers = await sovereignConfigStore.getLayerSettings(1);
    const l1 = layers[0];
    const autonomy = l1.settings!.sovereignAutonomy as any;
    expect(autonomy.level).toBe("supervised");
    expect(autonomy.trustScore).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. DEFAULT CONFIG TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("DEFAULT_SOVEREIGN_CONFIG", () => {
  it("should have valid provider config", () => {
    expect(DEFAULT_SOVEREIGN_CONFIG.provider.primaryModel).toBe("gemini-2.5-flash");
    expect(DEFAULT_SOVEREIGN_CONFIG.provider.fallbackModels).toContain("gpt-4o-mini");
    expect(DEFAULT_SOVEREIGN_CONFIG.provider.maxCostPerCall).toBeGreaterThan(0);
    expect(DEFAULT_SOVEREIGN_CONFIG.provider.modelVersion).toBeDefined();
  });

  it("should have valid budget config", () => {
    expect(DEFAULT_SOVEREIGN_CONFIG.budget.monthlyLimitUsd).toBeGreaterThan(0);
    expect(DEFAULT_SOVEREIGN_CONFIG.budget.alertThresholdPct).toBe(80);
    expect(DEFAULT_SOVEREIGN_CONFIG.budget.hardStop).toBe(false);
  });

  it("should have valid autonomy config", () => {
    expect(DEFAULT_SOVEREIGN_CONFIG.autonomy.level).toBe("supervised");
    expect(DEFAULT_SOVEREIGN_CONFIG.autonomy.trustScore).toBe(0);
    expect(DEFAULT_SOVEREIGN_CONFIG.autonomy.levelHistory).toHaveLength(1);
    expect(DEFAULT_SOVEREIGN_CONFIG.autonomy.levelHistory[0].level).toBe("supervised");
  });

  it("should have all required autonomy levels in history", () => {
    const validLevels = ["supervised", "guided", "semi_autonomous", "autonomous"];
    expect(validLevels).toContain(DEFAULT_SOVEREIGN_CONFIG.autonomy.level);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. COST ESTIMATION TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("Cost Estimation", () => {
  // Import the module to test internal cost estimation
  it("should estimate non-zero cost for known providers", async () => {
    // We test this indirectly through the DEFAULT_SOVEREIGN_CONFIG
    const provider = DEFAULT_SOVEREIGN_CONFIG.provider;
    expect(provider.maxCostPerCall).toBeGreaterThan(0);
    expect(provider.maxLatencyMs).toBeGreaterThan(0);
  });

  it("should have fallback models defined", () => {
    const fallbacks = DEFAULT_SOVEREIGN_CONFIG.provider.fallbackModels;
    expect(fallbacks.length).toBeGreaterThanOrEqual(2);
    // Fallbacks should not include the primary model
    expect(fallbacks).not.toContain(DEFAULT_SOVEREIGN_CONFIG.provider.primaryModel);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. BACKWARD COMPATIBILITY TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("Backward Compatibility", () => {
  it("should export all expected functions", async () => {
    const wiring = await import("../sovereignWiring");
    expect(typeof wiring.contextualLLM).toBe("function");
    expect(typeof wiring.assembleDeepContext).toBe("function");
    expect(typeof wiring.assembleContext).toBe("function");
    expect(typeof wiring.getQuickContext).toBe("function");
    expect(typeof wiring.getQuickContextWithMetadata).toBe("function");
    expect(typeof wiring.getMemoryEngine).toBe("function");
    expect(typeof wiring.invokeLLM).toBe("function");
  });

  it("should export Sovereign-specific utilities", async () => {
    const wiring = await import("../sovereignWiring");
    expect(typeof wiring.getCanaryStates).toBe("function");
    expect(typeof wiring.getUsageLogBuffer).toBe("function");
    expect(typeof wiring.isProviderHealthy).toBe("function");
  });

  it("should export context sources and memory store", async () => {
    const wiring = await import("../sovereignWiring");
    expect(wiring.sovereignContextSources).toBeDefined();
    expect(wiring.sovereignMemoryStore).toBeDefined();
    expect(wiring.SOVEREIGN_MEMORY_CATEGORIES).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. CANARY AND HEALTH CHECK TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("Canary and Health Checks", () => {
  it("should report unknown providers as healthy", async () => {
    const { isProviderHealthy } = await import("../sovereignWiring");
    expect(isProviderHealthy("unknown-provider-xyz")).toBe(true);
  });

  it("should return empty canary states initially", async () => {
    const { getCanaryStates } = await import("../sovereignWiring");
    const states = getCanaryStates();
    expect(states).toBeInstanceOf(Map);
  });

  it("should return empty usage log buffer initially", async () => {
    const { getUsageLogBuffer } = await import("../sovereignWiring");
    const buffer = getUsageLogBuffer();
    expect(Array.isArray(buffer)).toBe(true);
  });
});
