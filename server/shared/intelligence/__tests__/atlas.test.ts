/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ATLAS Intelligence Integration — Test Suite
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 30+ tests covering:
 *   - TiDB numeric coercion (dbCoercion.ts)
 *   - ATLAS context sources registry (atlasContextSources.ts)
 *   - ATLAS memory store interface (atlasMemoryStore.ts)
 *   - ATLAS config store interface (atlasConfigStore.ts)
 *   - ATLAS wiring layer (atlasWiring.ts)
 *   - ATLAS graduated autonomy (atlasGraduatedAutonomy.ts)
 *   - ATLAS LLM adapter (atlasLLMAdapter.ts)
 *   - Model version tracking
 *   - Quality score normalization integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── DB COERCION ────────────────────────────────────────────────────────────

import {
  coerceNumeric,
  coerceNumericFields,
  coerceNumericFieldsBatch,
} from "../dbCoercion";
import { normalizeQualityScore } from "../types";

describe("dbCoercion — coerceNumeric", () => {
  it("should return number values as-is", () => {
    expect(coerceNumeric(42)).toBe(42);
    expect(coerceNumeric(3.14)).toBe(3.14);
    expect(coerceNumeric(0)).toBe(0);
  });

  it("should coerce string-encoded numbers (TiDB decimal returns)", () => {
    expect(coerceNumeric("42")).toBe(42);
    expect(coerceNumeric("3.14")).toBe(3.14);
    expect(coerceNumeric("0.85")).toBe(0.85);
    expect(coerceNumeric("  100  ")).toBe(100);
  });

  it("should return fallback for null/undefined", () => {
    expect(coerceNumeric(null)).toBe(0);
    expect(coerceNumeric(undefined)).toBe(0);
    expect(coerceNumeric(null, 5)).toBe(5);
    expect(coerceNumeric(undefined, -1)).toBe(-1);
  });

  it("should return fallback for non-parseable strings", () => {
    expect(coerceNumeric("abc")).toBe(0);
    expect(coerceNumeric("")).toBe(0);
    expect(coerceNumeric("  ")).toBe(0);
    expect(coerceNumeric("abc", 99)).toBe(99);
  });

  it("should return fallback for NaN and Infinity", () => {
    expect(coerceNumeric(NaN)).toBe(0);
    expect(coerceNumeric(Infinity)).toBe(0);
    expect(coerceNumeric(-Infinity)).toBe(0);
    expect(coerceNumeric(NaN, 42)).toBe(42);
  });

  it("should handle boolean and object inputs with fallback", () => {
    expect(coerceNumeric(true)).toBe(0);
    expect(coerceNumeric(false)).toBe(0);
    expect(coerceNumeric({})).toBe(0);
    expect(coerceNumeric([])).toBe(0);
  });
});

describe("dbCoercion — coerceNumericFields", () => {
  it("should coerce specified fields on a row", () => {
    const row = {
      id: 1,
      name: "test",
      qualityScore: "0.85",
      confidence: "0.92",
      category: "fact",
    };

    const result = coerceNumericFields(row, ["qualityScore", "confidence"]);
    expect(result.qualityScore).toBe(0.85);
    expect(result.confidence).toBe(0.92);
    expect(result.name).toBe("test");
    expect(result.id).toBe(1);
  });

  it("should skip fields not present on the row", () => {
    const row = { id: 1, name: "test" };
    const result = coerceNumericFields(row, ["qualityScore" as any, "confidence" as any]);
    expect(result).toEqual({ id: 1, name: "test" });
  });

  it("should use custom fallback for unparseable values", () => {
    const row = { score: "invalid", count: null };
    const result = coerceNumericFields(row, ["score", "count"], -1);
    expect(result.score).toBe(-1);
    expect(result.count).toBe(-1);
  });

  it("should not mutate the original row", () => {
    const row = { score: "42" };
    const result = coerceNumericFields(row, ["score"]);
    expect(result.score).toBe(42);
    expect(row.score).toBe("42");
  });
});

describe("dbCoercion — coerceNumericFieldsBatch", () => {
  it("should coerce fields across an array of rows", () => {
    const rows = [
      { id: 1, score: "0.85" },
      { id: 2, score: "0.92" },
      { id: 3, score: null as any },
    ];

    const results = coerceNumericFieldsBatch(rows, ["score"]);
    expect(results[0].score).toBe(0.85);
    expect(results[1].score).toBe(0.92);
    expect(results[2].score).toBe(0);
  });

  it("should handle empty arrays", () => {
    const results = coerceNumericFieldsBatch([], ["score"]);
    expect(results).toEqual([]);
  });
});

// ─── ATLAS CONTEXT SOURCES ──────────────────────────────────────────────────

describe("atlasContextSources registry", () => {
  it("should export a registry with 23 sources", async () => {
    const { atlasContextSources } = await import("../atlasContextSources");
    const sourceNames = Object.keys(atlasContextSources);
    expect(sourceNames.length).toBe(23);
  });

  it("should include all 15 AEGIS baseline sources", async () => {
    const { atlasContextSources } = await import("../atlasContextSources");
    const aegisSources = [
      "documents", "knowledgeBase", "userProfile", "suitability",
      "memory", "graph", "pipelineData", "conversationHistory",
      "integrations", "calculators", "insights", "clientRelationships",
      "activityLog", "tags", "gapFeedback",
    ];
    for (const source of aegisSources) {
      expect(atlasContextSources).toHaveProperty(source);
      expect(typeof atlasContextSources[source]).toBe("function");
    }
  });

  it("should include all 8 ATLAS kernel sources", async () => {
    const { atlasContextSources } = await import("../atlasContextSources");
    const atlasSources = [
      "goalsAndPlans", "scheduledGoals", "playgroundRuns", "playgroundPresets",
      "webhookLogs", "passiveActionLogs", "autonomyProfile", "responseQuality",
    ];
    for (const source of atlasSources) {
      expect(atlasContextSources).toHaveProperty(source);
      expect(typeof atlasContextSources[source]).toBe("function");
    }
  });

  it("should return empty string from sources when DB is unavailable", async () => {
    const { atlasContextSources } = await import("../atlasContextSources");
    // Without DATABASE_URL, all sources should gracefully return ""
    const result = await atlasContextSources.goalsAndPlans(1, "test query");
    expect(result).toBe("");
  });

  it("should return empty string from webhook source without DB", async () => {
    const { atlasContextSources } = await import("../atlasContextSources");
    const result = await atlasContextSources.webhookLogs(1, "test");
    expect(result).toBe("");
  });

  it("should return empty string from passiveActionLogs without DB", async () => {
    const { atlasContextSources } = await import("../atlasContextSources");
    const result = await atlasContextSources.passiveActionLogs(1, "test");
    expect(result).toBe("");
  });

  it("should return empty string from autonomyProfile without DB", async () => {
    const { atlasContextSources } = await import("../atlasContextSources");
    const result = await atlasContextSources.autonomyProfile(1, "test");
    expect(result).toBe("");
  });

  it("should return empty string from responseQuality without DB", async () => {
    const { atlasContextSources } = await import("../atlasContextSources");
    const result = await atlasContextSources.responseQuality(1, "test");
    expect(result).toBe("");
  });
});

// ─── ATLAS WIRING ───────────────────────────────────────────────────────────

describe("atlasWiring — model version tracking", () => {
  it("should have a default model version", async () => {
    const { getModelVersion } = await import("../atlasWiring");
    const version = getModelVersion();
    expect(typeof version).toBe("string");
    expect(version.length).toBeGreaterThan(0);
  });

  it("should allow setting and getting model version", async () => {
    const { setModelVersion, getModelVersion } = await import("../atlasWiring");
    const original = getModelVersion();
    setModelVersion("atlas-v2.0-test");
    expect(getModelVersion()).toBe("atlas-v2.0-test");
    // Restore
    setModelVersion(original);
  });
});

describe("atlasWiring — ATLAS memory categories", () => {
  it("should extend EXTENDED_MEMORY_CATEGORIES with ATLAS-specific ones", async () => {
    const { ATLAS_MEMORY_CATEGORIES } = await import("../atlasWiring");
    const { EXTENDED_MEMORY_CATEGORIES } = await import("../types");

    // Should be a superset
    for (const cat of EXTENDED_MEMORY_CATEGORIES) {
      expect(ATLAS_MEMORY_CATEGORIES).toContain(cat);
    }

    // Should include ATLAS-specific categories
    expect(ATLAS_MEMORY_CATEGORIES).toContain("task_context");
    expect(ATLAS_MEMORY_CATEGORIES).toContain("automation_pattern");
    expect(ATLAS_MEMORY_CATEGORIES).toContain("experimentation_insight");
  });

  it("should have more categories than EXTENDED", async () => {
    const { ATLAS_MEMORY_CATEGORIES } = await import("../atlasWiring");
    const { EXTENDED_MEMORY_CATEGORIES } = await import("../types");
    expect(ATLAS_MEMORY_CATEGORIES.length).toBeGreaterThan(EXTENDED_MEMORY_CATEGORIES.length);
  });
});

describe("atlasWiring — legacy type compatibility", () => {
  it("should export assembleDeepContext function", async () => {
    const wiring = await import("../atlasWiring");
    expect(typeof wiring.assembleDeepContext).toBe("function");
  });

  it("should export getQuickContext function", async () => {
    const wiring = await import("../atlasWiring");
    expect(typeof wiring.getQuickContext).toBe("function");
  });

  it("should export contextualLLM as alias for atlasContextualLLM", async () => {
    const wiring = await import("../atlasWiring");
    expect(typeof wiring.contextualLLM).toBe("function");
    expect(typeof wiring.atlasContextualLLM).toBe("function");
    expect(wiring.contextualLLM).toBe(wiring.atlasContextualLLM);
  });

  it("should export atlasInvokeLLM function", async () => {
    const wiring = await import("../atlasWiring");
    expect(typeof wiring.atlasInvokeLLM).toBe("function");
  });

  it("should export normalizeQualityScore re-export", async () => {
    const wiring = await import("../atlasWiring");
    expect(typeof wiring.normalizeQualityScore).toBe("function");
    expect(wiring.normalizeQualityScore(85)).toBe(0.85);
  });

  it("should export coercion utilities", async () => {
    const wiring = await import("../atlasWiring");
    expect(typeof wiring.coerceNumeric).toBe("function");
    expect(typeof wiring.coerceNumericFields).toBe("function");
    expect(typeof wiring.coerceNumericFieldsBatch).toBe("function");
  });
});

describe("atlasWiring — graduated autonomy DB persistence", () => {
  it("should export persistAutonomyLevel function", async () => {
    const wiring = await import("../atlasWiring");
    expect(typeof wiring.persistAutonomyLevel).toBe("function");
  });

  it("should export loadAutonomyLevel function", async () => {
    const wiring = await import("../atlasWiring");
    expect(typeof wiring.loadAutonomyLevel).toBe("function");
  });

  it("should return null from loadAutonomyLevel without DB", async () => {
    const wiring = await import("../atlasWiring");
    const result = await wiring.loadAutonomyLevel(999);
    expect(result).toBeNull();
  });
});

// ─── ATLAS GRADUATED AUTONOMY ───────────────────────────────────────────────

describe("atlasGraduatedAutonomy", () => {
  beforeEach(async () => {
    const { clearProfileCache } = await import("../atlasGraduatedAutonomy");
    clearProfileCache();
  });

  it("should create a supervised profile for new users", async () => {
    const { getProfile } = await import("../atlasGraduatedAutonomy");
    const profile = await getProfile(9999);
    expect(profile.level).toBe("supervised");
    expect(profile.trustScore).toBe(0);
    expect(profile.totalInteractions).toBe(0);
    expect(profile.modelVersion).toBeTruthy();
  });

  it("should track model version on profiles", async () => {
    const { getProfile } = await import("../atlasGraduatedAutonomy");
    const { getModelVersion } = await import("../atlasWiring");
    const profile = await getProfile(9998);
    expect(profile.modelVersion).toBe(getModelVersion());
  });

  it("should record successful interactions and update trust score", async () => {
    const { recordInteraction, clearProfileCache } = await import("../atlasGraduatedAutonomy");
    clearProfileCache();
    const profile = await recordInteraction(9997, true, false, false);
    expect(profile.totalInteractions).toBe(1);
    expect(profile.successfulActions).toBe(1);
    expect(profile.trustScore).toBeGreaterThan(0);
  });

  it("should track escalations", async () => {
    const { recordInteraction, clearProfileCache } = await import("../atlasGraduatedAutonomy");
    clearProfileCache();
    const profile = await recordInteraction(9996, false, false, true);
    expect(profile.escalations).toBe(1);
    expect(profile.lastEscalation).toBeTruthy();
  });

  it("should deny unknown actions", async () => {
    const { canPerformAction } = await import("../atlasGraduatedAutonomy");
    const result = await canPerformAction(9995, "unknown_action");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Unknown action");
  });

  it("should allow supervised-level actions for new users", async () => {
    const { canPerformAction, clearProfileCache } = await import("../atlasGraduatedAutonomy");
    clearProfileCache();
    const result = await canPerformAction(9994, "send_message");
    expect(result.allowed).toBe(true);
  });

  it("should deny autonomous-level actions for new users", async () => {
    const { canPerformAction, clearProfileCache } = await import("../atlasGraduatedAutonomy");
    clearProfileCache();
    const result = await canPerformAction(9993, "bulk_export");
    expect(result.allowed).toBe(false);
  });

  it("should return available actions for supervised level", async () => {
    const { getAvailableActions, clearProfileCache } = await import("../atlasGraduatedAutonomy");
    clearProfileCache();
    const actions = await getAvailableActions(9992);
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every((a) => a.requiredLevel === "supervised")).toBe(true);
  });

  it("should report level progress", async () => {
    const { getLevelProgress, clearProfileCache } = await import("../atlasGraduatedAutonomy");
    clearProfileCache();
    const progress = await getLevelProgress(9991);
    expect(progress.currentLevel).toBe("supervised");
    expect(progress.nextLevel).toBe("guided");
    expect(typeof progress.progress).toBe("number");
    expect(progress.modelVersion).toBeTruthy();
  });

  it("should clear profile cache", async () => {
    const { getProfile, clearProfileCache } = await import("../atlasGraduatedAutonomy");
    await getProfile(9990);
    clearProfileCache();
    // After clearing, a fresh profile should be created
    const profile = await getProfile(9990);
    expect(profile.totalInteractions).toBe(0);
  });
});

// ─── ATLAS LLM ADAPTER ─────────────────────────────────────────────────────

describe("atlasLLMAdapter", () => {
  it("should export invokeLLM function", async () => {
    const adapter = await import("../atlasLLMAdapter");
    expect(typeof adapter.invokeLLM).toBe("function");
  });

  it("should export getModelVersion", async () => {
    const adapter = await import("../atlasLLMAdapter");
    expect(typeof adapter.getModelVersion).toBe("function");
  });

  it("should have a default export", async () => {
    const adapter = await import("../atlasLLMAdapter");
    expect(typeof adapter.default).toBe("function");
  });
});

// ─── ATLAS MEMORY STORE ─────────────────────────────────────────────────────

describe("atlasMemoryStore", () => {
  it("should implement the MemoryStore interface", async () => {
    const { atlasMemoryStore } = await import("../atlasMemoryStore");
    expect(typeof atlasMemoryStore.getMemories).toBe("function");
    expect(typeof atlasMemoryStore.insertMemories).toBe("function");
    expect(typeof atlasMemoryStore.getEpisodes).toBe("function");
    expect(typeof atlasMemoryStore.insertEpisode).toBe("function");
  });

  it("should return empty arrays when DB is unavailable", async () => {
    const { atlasMemoryStore } = await import("../atlasMemoryStore");
    const memories = await atlasMemoryStore.getMemories(1);
    expect(memories).toEqual([]);
    const episodes = await atlasMemoryStore.getEpisodes(1);
    expect(episodes).toEqual([]);
  });

  it("should handle insertMemories gracefully without DB", async () => {
    const { atlasMemoryStore } = await import("../atlasMemoryStore");
    // Should not throw
    await atlasMemoryStore.insertMemories(1, [
      { category: "fact", content: "test", source: "test", confidence: 0.9 },
    ]);
  });

  it("should handle insertEpisode gracefully without DB", async () => {
    const { atlasMemoryStore } = await import("../atlasMemoryStore");
    await atlasMemoryStore.insertEpisode(1, 1, {
      summary: "test",
      keyTopics: ["test"],
      emotionalTone: "neutral",
    });
  });
});

// ─── ATLAS CONFIG STORE ─────────────────────────────────────────────────────

describe("atlasConfigStore", () => {
  it("should implement the LayerStore interface", async () => {
    const { atlasConfigStore } = await import("../../config/atlasConfigStore");
    expect(typeof atlasConfigStore.getLayerSettings).toBe("function");
    expect(typeof atlasConfigStore.getLayerConfig).toBe("function");
    expect(typeof atlasConfigStore.upsertLayerConfig).toBe("function");
  });

  it("should return empty array from getLayerSettings without DB", async () => {
    const { atlasConfigStore } = await import("../../config/atlasConfigStore");
    const layers = await atlasConfigStore.getLayerSettings(1);
    expect(layers).toEqual([]);
  });

  it("should return null from getLayerConfig without DB", async () => {
    const { atlasConfigStore } = await import("../../config/atlasConfigStore");
    const config = await atlasConfigStore.getLayerConfig(1, 1);
    expect(config).toBeNull();
  });
});

// ─── INTEGRATION: COERCION + QUALITY SCORE ──────────────────────────────────

describe("Integration: TiDB coercion with normalizeQualityScore", () => {
  it("should correctly chain coercion then normalization", () => {
    // Simulate TiDB returning "85" as a string for a quality score
    const tidbValue = "85";
    const coerced = coerceNumeric(tidbValue);
    expect(coerced).toBe(85);

    const normalized = normalizeQualityScore(coerced);
    expect(normalized).toBe(0.85);
  });

  it("should handle TiDB decimal string through full pipeline", () => {
    // TiDB returns decimal(3,2) as "0.85"
    const tidbDecimal = "0.85";
    const coerced = coerceNumeric(tidbDecimal);
    expect(coerced).toBe(0.85);

    const normalized = normalizeQualityScore(coerced);
    expect(normalized).toBe(0.85);
  });

  it("should handle null TiDB values through full pipeline", () => {
    const coerced = coerceNumeric(null, 0);
    const normalized = normalizeQualityScore(coerced);
    expect(normalized).toBe(0);
  });
});
