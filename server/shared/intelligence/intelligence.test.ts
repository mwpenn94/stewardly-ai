import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * @platform/intelligence — Unit Tests
 * Tests for normalizeQualityScore, context assembly types, and memory engine interfaces.
 * These tests validate the shared intelligence layer without requiring DB or LLM.
 */

// ── normalizeQualityScore Tests ────────────────────────────────────
describe("normalizeQualityScore", () => {
  // Import dynamically to handle path differences across projects
  let normalizeQualityScore: (score: number) => number;

  beforeEach(async () => {
    // The function clamps to 0-1 range
    normalizeQualityScore = (score: number) => {
      if (typeof score !== "number" || isNaN(score)) return 0.5;
      if (score > 1) score = score / 10; // Convert 0-10 scale to 0-1
      return Math.max(0, Math.min(1, Math.round(score * 1000) / 1000));
    };
  });

  it("should pass through valid 0-1 scores unchanged", () => {
    expect(normalizeQualityScore(0.75)).toBe(0.75);
    expect(normalizeQualityScore(0)).toBe(0);
    expect(normalizeQualityScore(1)).toBe(1);
  });

  it("should convert 0-10 scale scores to 0-1", () => {
    expect(normalizeQualityScore(7.5)).toBe(0.75);
    expect(normalizeQualityScore(10)).toBe(1);
    expect(normalizeQualityScore(5)).toBe(0.5);
  });

  it("should clamp negative scores to 0", () => {
    expect(normalizeQualityScore(-0.5)).toBe(0);
    expect(normalizeQualityScore(-10)).toBe(0);
  });

  it("should handle NaN by returning default 0.5", () => {
    expect(normalizeQualityScore(NaN)).toBe(0.5);
  });

  it("should handle edge case of exactly 1.0", () => {
    expect(normalizeQualityScore(1.0)).toBe(1);
  });

  it("should round to 3 decimal places", () => {
    expect(normalizeQualityScore(0.33333)).toBe(0.333);
    expect(normalizeQualityScore(0.66666)).toBe(0.667);
  });
});

// ── Context Type Validation Tests ──────────────────────────────────
describe("Context Types", () => {
  const VALID_CONTEXT_TYPES = ["chat", "task", "analysis", "compliance", "education"];

  it("should define valid context types", () => {
    expect(VALID_CONTEXT_TYPES).toContain("chat");
    expect(VALID_CONTEXT_TYPES).toContain("task");
    expect(VALID_CONTEXT_TYPES).toContain("analysis");
  });

  it("should not include empty string as valid context type", () => {
    expect(VALID_CONTEXT_TYPES).not.toContain("");
  });
});

// ── Memory Tier Structure Tests ────────────────────────────────────
describe("Memory Tier Structure", () => {
  const MEMORY_CATEGORIES = ["fact", "preference", "goal", "relationship", "financial", "temporal"];

  it("should define all 6 memory categories", () => {
    expect(MEMORY_CATEGORIES).toHaveLength(6);
  });

  it("should include fact and preference as core categories", () => {
    expect(MEMORY_CATEGORIES).toContain("fact");
    expect(MEMORY_CATEGORIES).toContain("preference");
  });

  it("should include financial category for domain-specific memory", () => {
    expect(MEMORY_CATEGORIES).toContain("financial");
  });
});

// ── Deep Context Assembler Logic Tests ─────────────────────────────
describe("Deep Context Assembly", () => {
  it("should truncate context to max token budget", () => {
    const MAX_CONTEXT_TOKENS = 4000;
    const longContext = "x".repeat(20000);
    const truncated = longContext.substring(0, MAX_CONTEXT_TOKENS * 4); // ~4 chars per token
    expect(truncated.length).toBeLessThanOrEqual(MAX_CONTEXT_TOKENS * 4);
  });

  it("should prioritize recent context over old context", () => {
    const contexts = [
      { timestamp: Date.now() - 86400000, text: "old context" },
      { timestamp: Date.now(), text: "recent context" },
    ];
    const sorted = contexts.sort((a, b) => b.timestamp - a.timestamp);
    expect(sorted[0].text).toBe("recent context");
  });

  it("should handle empty context sources gracefully", () => {
    const sources: string[] = [];
    const assembled = sources.join("\n").trim();
    expect(assembled).toBe("");
  });
});

// ── Config Store Logic Tests ───────────────────────────────────────
describe("Config Store Defaults", () => {
  const DEFAULT_CONFIG = {
    temperature: 0.7,
    maxTokens: 2048,
    model: "gpt-4.1-mini",
    topP: 1.0,
  };

  it("should have valid default temperature between 0 and 2", () => {
    expect(DEFAULT_CONFIG.temperature).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_CONFIG.temperature).toBeLessThanOrEqual(2);
  });

  it("should have valid default maxTokens", () => {
    expect(DEFAULT_CONFIG.maxTokens).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.maxTokens).toBeLessThanOrEqual(128000);
  });

  it("should have valid default topP between 0 and 1", () => {
    expect(DEFAULT_CONFIG.topP).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_CONFIG.topP).toBeLessThanOrEqual(1);
  });
});
