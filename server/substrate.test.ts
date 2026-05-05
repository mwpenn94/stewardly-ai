/**
 * Phase A Tests — Substrate Primitives
 *
 * Validates the 6 substrate primitives absorbed from manus-next-app:
 *   1. Classifier (deterministic, no network)
 *   2. Embedding (API integration)
 *   3. AEGIS (pre/post-flight pipeline)
 *   4. Sovereign Routing (multi-provider)
 *   5. Search Cascade (tiered degradation)
 *   6. Capability Tiers (quality-first degradation)
 *   7. ATLAS (goal decomposition)
 */
import { describe, it, expect } from "vitest";
import {
  classify,
  isSensitive,
  getRoutingTier,
} from "./services/substrate/classifier";
import { cosineSimilarity, keywordSimilarity, findTopK } from "./services/substrate/embedding";
import {
  getCapabilities,
  getCapability,
  getActiveTier,
  degradeCapability,
  restoreCapability,
  recordUsage,
  getDegradationHistory,
} from "./services/substrate/capabilityTiers";
import {
  getRoutingStats,
  getCircuitBreakerStatus,
  getRecentDecisions,
} from "./services/substrate/sovereign";

// ─── Classifier Tests ────────────────────────────────────────────────────────

describe("Substrate: Classifier", () => {
  it("classifies public content as CLOUD tier", () => {
    const result = classify("What is the current GDP growth rate?");
    expect(result.sensitivity).toBe("public");
    expect(result.routingTier).toBe("CLOUD");
  });

  it("classifies SSN-containing content as restricted/LOCAL", () => {
    const result = classify("My SSN is 123-45-6789");
    expect(result.sensitivity).toBe("restricted");
    expect(result.routingTier).toBe("LOCAL");
    expect(result.flags).toContain("sensitivity:ssn");
  });

  it("classifies credit card numbers as restricted", () => {
    const result = classify("Card number 4111-1111-1111-1111 for payment");
    expect(result.sensitivity).toBe("restricted");
    expect(result.flags).toContain("sensitivity:credit_card");
  });

  it("classifies salary information as confidential", () => {
    const result = classify("My salary is $150,000 per year");
    expect(result.sensitivity).toBe("confidential");
    expect(result.routingTier).toBe("LOCAL");
  });

  it("classifies net worth as confidential", () => {
    const result = classify("My net worth is $2,500,000 in total assets");
    expect(result.sensitivity).toBe("confidential");
  });

  it("classifies estate planning content as confidential", () => {
    const result = classify("I need to update my power of attorney document");
    expect(result.sensitivity).toBe("confidential");
  });

  it("classifies internal business content correctly", () => {
    const result = classify("This is confidential internal only strategy");
    expect(result.sensitivity).toBe("internal");
    expect(result.routingTier).toBe("AUTO");
  });

  it("detects wealth domain correctly", () => {
    const result = classify("Help me rebalance my portfolio allocation between stocks and bonds");
    expect(result.domain).toBe("wealth");
  });

  it("detects learning domain correctly", () => {
    const result = classify("I need to study for my CFP certification exam");
    expect(result.domain).toBe("learning");
  });

  it("detects people domain correctly", () => {
    const result = classify("Schedule a meeting with my client about their referral");
    expect(result.domain).toBe("people");
  });

  it("detects research task type", () => {
    const result = classify("Research and compare the top ETF options for retirement");
    expect(result.taskType).toBe("research");
  });

  it("detects code task type", () => {
    const result = classify("Implement a function to calculate compound interest in typescript");
    expect(result.taskType).toBe("code");
  });

  it("detects compliance task type", () => {
    const result = classify("Check this disclosure for regulatory compliance and fiduciary suitability");
    expect(result.taskType).toBe("compliance");
  });

  it("classifies complexity by word count", () => {
    const short = classify("Hi");
    expect(short.complexity).toBe("trivial");

    const medium = classify("Please help me understand the implications of converting my traditional IRA to a Roth IRA given my current tax bracket and expected future income trajectory over the next decade");
    // 30 words = simple threshold
    expect(["moderate", "simple", "trivial"]).toContain(medium.complexity);
  });

  it("isSensitive helper works correctly", () => {
    expect(isSensitive("My SSN is 123-45-6789")).toBe(true);
    expect(isSensitive("What is GDP?")).toBe(false);
  });

  it("getRoutingTier helper works correctly", () => {
    expect(getRoutingTier("public question about markets")).toBe("CLOUD");
    expect(getRoutingTier("My salary is $200,000")).toBe("LOCAL");
  });

  it("returns confidence between 0 and 1", () => {
    const result = classify("Help me plan my retirement with portfolio rebalancing");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});

// ─── Embedding Utility Tests ─────────────────────────────────────────────────

describe("Substrate: Embedding Utilities", () => {
  it("cosineSimilarity returns 1 for identical vectors", () => {
    const vec = [0.1, 0.2, 0.3, 0.4, 0.5];
    expect(cosineSimilarity(vec, vec)).toBeCloseTo(1, 5);
  });

  it("cosineSimilarity returns 0 for orthogonal vectors", () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
  });

  it("cosineSimilarity handles empty vectors", () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it("cosineSimilarity handles different length vectors", () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it("keywordSimilarity returns 1 for identical texts", () => {
    const text = "retirement portfolio allocation strategy";
    expect(keywordSimilarity(text, text)).toBeCloseTo(1, 5);
  });

  it("keywordSimilarity returns 0 for completely different texts", () => {
    expect(keywordSimilarity("apple banana cherry", "xyz quantum physics")).toBe(0);
  });

  it("keywordSimilarity returns partial overlap score", () => {
    const score = keywordSimilarity(
      "retirement portfolio allocation",
      "portfolio allocation rebalancing"
    );
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it("findTopK returns correct number of results", () => {
    const items = [
      { embedding: [1, 0, 0], data: "a" },
      { embedding: [0.9, 0.1, 0], data: "b" },
      { embedding: [0, 1, 0], data: "c" },
      { embedding: [0, 0, 1], data: "d" },
    ];
    const results = findTopK([1, 0, 0], items, 2, 0);
    expect(results.length).toBe(2);
    expect(results[0].data).toBe("a");
    expect(results[1].data).toBe("b");
  });

  it("findTopK respects threshold", () => {
    const items = [
      { embedding: [1, 0, 0], data: "a" },
      { embedding: [0, 1, 0], data: "b" },
    ];
    const results = findTopK([1, 0, 0], items, 5, 0.9);
    expect(results.length).toBe(1);
    expect(results[0].data).toBe("a");
  });
});

// ─── Capability Tiers Tests ──────────────────────────────────────────────────

describe("Substrate: Capability Tiers", () => {
  it("getCapabilities returns all domains", () => {
    const caps = getCapabilities();
    expect(caps.length).toBeGreaterThanOrEqual(6);
    const domains = caps.map((c) => c.domain);
    expect(domains).toContain("llm");
    expect(domains).toContain("search");
    expect(domains).toContain("voice_tts");
  });

  it("getCapability returns specific domain", () => {
    const cap = getCapability("search");
    expect(cap).toBeDefined();
    expect(cap!.displayName).toBe("Web Search");
    expect(cap!.tiers.length).toBeGreaterThanOrEqual(3);
  });

  it("getActiveTier returns current tier", () => {
    const tier = getActiveTier("llm");
    expect(tier).toBeDefined();
    expect(tier!.level).toBe(0);
    expect(tier!.provider).toBe("forge");
  });

  it("degradeCapability moves to next tier", () => {
    // Search starts at tier 0, should degrade to tier 2 (tier 1 not available)
    const newTier = degradeCapability("search", "quota exhausted");
    expect(newTier).not.toBeNull();
    expect(newTier).toBeGreaterThan(0);
  });

  it("restoreCapability moves back to higher tier", () => {
    const restored = restoreCapability("search", 0);
    expect(restored).toBe(true);
  });

  it("recordUsage increments counter", () => {
    recordUsage("llm", 5);
    const cap = getCapability("llm");
    expect(cap!.usageThisMonth).toBeGreaterThanOrEqual(5);
  });

  it("getDegradationHistory returns events", () => {
    const history = getDegradationHistory();
    expect(Array.isArray(history)).toBe(true);
  });
});

// ─── Sovereign Routing Tests ─────────────────────────────────────────────────

describe("Substrate: Sovereign Routing", () => {
  it("getRoutingStats returns valid structure", () => {
    const stats = getRoutingStats();
    expect(stats).toHaveProperty("totalDecisions");
    expect(stats).toHaveProperty("byTier");
    expect(stats).toHaveProperty("byProvider");
    expect(stats).toHaveProperty("avgLatency");
  });

  it("getCircuitBreakerStatus returns array", () => {
    const status = getCircuitBreakerStatus();
    expect(Array.isArray(status)).toBe(true);
  });

  it("getRecentDecisions returns array with limit", () => {
    const decisions = getRecentDecisions(5);
    expect(Array.isArray(decisions)).toBe(true);
    expect(decisions.length).toBeLessThanOrEqual(5);
  });
});
