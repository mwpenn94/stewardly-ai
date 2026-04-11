/**
 * Tests for the quickQuoteSuggestions service.
 *
 * Cover topic detection (substring match), combined scoring,
 * scope visibility, ranking, threshold filtering, and reasoning
 * string generation.
 */

import { describe, it, expect } from "vitest";
import {
  SERVER_QUOTE_REGISTRY,
  combinedScore,
  suggestQuickQuotes,
  topicScore,
} from "./index";

describe("quickQuoteSuggestions / topicScore", () => {
  it("returns 0 for an empty message", () => {
    const entry = SERVER_QUOTE_REGISTRY[0];
    expect(topicScore("", entry)).toBe(0);
  });

  it("returns 0 when no keywords match", () => {
    const entry = SERVER_QUOTE_REGISTRY.find((e) => e.id === "estate-planning")!;
    expect(topicScore("how do I get a new car", entry)).toBe(0);
  });

  it("returns >0 for a single keyword match", () => {
    const entry = SERVER_QUOTE_REGISTRY.find((e) => e.id === "tax-projection")!;
    expect(topicScore("what's my marginal rate", entry)).toBeGreaterThan(0);
  });

  it("scales with hit count, saturating at 3", () => {
    const entry = SERVER_QUOTE_REGISTRY.find((e) => e.id === "tax-projection")!;
    // "tax", "marginal rate", "bracket" = 3 hits → 1.0
    const high = topicScore("tax bracket and marginal rate", entry);
    expect(high).toBe(1);
  });

  it("is case-insensitive", () => {
    const entry = SERVER_QUOTE_REGISTRY.find((e) => e.id === "retirement-goal")!;
    expect(topicScore("RETIREMENT planning", entry)).toBeGreaterThan(0);
    expect(topicScore("retirement planning", entry)).toBeGreaterThan(0);
  });
});

describe("quickQuoteSuggestions / combinedScore", () => {
  it("blends topic and fitness 60/40", () => {
    const entry = SERVER_QUOTE_REGISTRY.find((e) => e.id === "tax-projection")!;
    // topic = 1 (3+ hits), fitness = 1 (income 200k), expect 1
    const s = combinedScore(
      "tax bracket and marginal rate",
      { income: 250_000 },
      entry,
    );
    expect(s).toBeCloseTo(1, 4);
  });

  it("rewards keyword match even with low fitness", () => {
    const entry = SERVER_QUOTE_REGISTRY.find((e) => e.id === "premium-finance")!;
    const s = combinedScore(
      "premium finance loan leverage",
      { income: 50_000, netWorth: 100_000 },
      entry,
    );
    // topic = 1 (3 hits), fitness = 0.3 → 0.6 + 0.12 = 0.72
    expect(s).toBeCloseTo(0.72, 2);
  });
});

describe("quickQuoteSuggestions / suggestQuickQuotes", () => {
  it("returns at most topN suggestions", () => {
    const sug = suggestQuickQuotes({
      message: "I want to retire",
      topN: 2,
    });
    expect(sug.length).toBeLessThanOrEqual(2);
  });

  it("ranks the right entry for a retirement query", () => {
    const sug = suggestQuickQuotes({
      message: "I want to plan my retirement and 401k",
      profile: { age: 50 },
      topN: 3,
    });
    expect(sug[0].id).toBe("retirement-goal");
  });

  it("ranks tax projection for a tax query", () => {
    const sug = suggestQuickQuotes({
      message: "Can you help me with my marginal rate and roth conversion",
      profile: { age: 40, income: 200_000 },
      topN: 3,
    });
    const taxIdx = sug.findIndex((s) => s.id === "tax-projection");
    expect(taxIdx).toBeGreaterThanOrEqual(0);
    expect(taxIdx).toBeLessThan(2);
  });

  it("respects scope filter — user does NOT see business income", () => {
    const sug = suggestQuickQuotes({
      message: "I'm a managing director with team overrides",
      profile: { isBizOwner: true },
      scope: "user",
      topN: 5,
    });
    expect(sug.find((s) => s.id === "business-income")).toBeUndefined();
  });

  it("advisor scope DOES surface business income", () => {
    const sug = suggestQuickQuotes({
      message: "managing director team overrides",
      profile: { isBizOwner: true },
      scope: "advisor",
      topN: 5,
    });
    const biz = sug.find((s) => s.id === "business-income");
    expect(biz).toBeDefined();
  });

  it("falls back to pure fitness ranking when message is empty", () => {
    const sug = suggestQuickQuotes({
      message: "",
      profile: { age: 60, netWorth: 5_000_000 },
      scope: "user",
      topN: 3,
    });
    expect(sug.length).toBeGreaterThan(0);
    // Estate planning + holistic comparison should rank high
    const ids = sug.map((s) => s.id);
    expect(ids).toContain("estate-planning");
  });

  it("filters by minScore threshold", () => {
    const sug = suggestQuickQuotes({
      message: "random gibberish that matches nothing",
      profile: {},
      scope: "user",
      topN: 10,
      minScore: 0.5,
    });
    // Most entries score around 0.28-0.36 (fitness * 0.4) without
    // topic match — these should all be filtered out at 0.5
    for (const s of sug) {
      expect(s.score).toBeGreaterThan(0.5);
    }
  });

  it("includes a reasoning string for every suggestion", () => {
    const sug = suggestQuickQuotes({
      message: "retirement planning",
      profile: { age: 55 },
      topN: 2,
    });
    for (const s of sug) {
      expect(s.reasoning.length).toBeGreaterThan(0);
    }
  });

  it("reasoning mentions matched keywords for topic-driven suggestions", () => {
    const sug = suggestQuickQuotes({
      message: "I want to compare strategies side by side",
      profile: { age: 40, income: 100000 },
      topN: 1,
    });
    // The top result should mention the matched keywords
    expect(sug[0].reasoning).toContain("matches your message");
  });

  it("includes route + category in every suggestion", () => {
    const sug = suggestQuickQuotes({
      message: "estate planning",
      topN: 3,
    });
    for (const s of sug) {
      expect(s.route).toMatch(/^\//);
      expect(["wealth", "protection", "income", "tax", "estate", "business"]).toContain(
        s.category,
      );
    }
  });
});

describe("quickQuoteSuggestions / SERVER_QUOTE_REGISTRY integrity", () => {
  it("has unique ids", () => {
    const ids = SERVER_QUOTE_REGISTRY.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every entry has at least one topic keyword", () => {
    for (const e of SERVER_QUOTE_REGISTRY) {
      expect(e.topicKeywords.length).toBeGreaterThan(0);
    }
  });

  it("every entry has a non-empty route", () => {
    for (const e of SERVER_QUOTE_REGISTRY) {
      expect(e.route).toMatch(/^\//);
    }
  });
});
