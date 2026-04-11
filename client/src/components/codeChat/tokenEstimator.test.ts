/**
 * Tests for tokenEstimator.ts (Pass 210).
 */

import { describe, it, expect } from "vitest";
import {
  estimateTokens,
  estimateMessageUsage,
  sumUsage,
  formatTokens,
  formatCost,
  evaluateBudget,
  DEFAULT_BUDGET_STATE,
  MODEL_PRICING,
  evaluateContextWindow,
  formatContextSize,
  MODEL_CONTEXT_LIMITS,
  DEFAULT_CONTEXT_LIMIT,
} from "./tokenEstimator";

describe("estimateTokens", () => {
  it("returns 0 for empty input", () => {
    expect(estimateTokens("")).toBe(0);
  });
  it("rounds up the chars/3.8 ratio", () => {
    // 38 chars → 10 tokens
    expect(estimateTokens("a".repeat(38))).toBe(10);
    // 39 chars → 11 tokens (rounded up)
    expect(estimateTokens("a".repeat(39))).toBe(11);
  });
  it("handles multi-line text", () => {
    expect(estimateTokens("line1\nline2\nline3")).toBeGreaterThan(0);
  });
});

describe("estimateMessageUsage", () => {
  it("sums input + output tokens", () => {
    const u = estimateMessageUsage("hello world", "goodbye world", undefined);
    expect(u.inputTokens).toBeGreaterThan(0);
    expect(u.outputTokens).toBeGreaterThan(0);
    expect(u.totalTokens).toBe(u.inputTokens + u.outputTokens);
  });
  it("returns cost null when model is unknown", () => {
    const u = estimateMessageUsage("hi", "hi", "cobol-7");
    expect(u.costUSD).toBeNull();
  });
  it("computes cost for a priced model", () => {
    const u = estimateMessageUsage("hi", "hi", "claude-sonnet-4-6");
    expect(u.costUSD).not.toBeNull();
    expect(u.costUSD).toBeGreaterThan(0);
  });
  it("exposes pricing for known models", () => {
    expect(MODEL_PRICING["claude-opus-4-6"]).toBeDefined();
    expect(MODEL_PRICING["gpt-5"]).toBeDefined();
  });
});

describe("sumUsage", () => {
  it("returns zero usage for empty list", () => {
    const r = sumUsage([]);
    expect(r.inputTokens).toBe(0);
    expect(r.outputTokens).toBe(0);
    // No priced entries → costUSD stays null
    expect(r.costUSD).toBeNull();
  });
  it("sums all fields", () => {
    const a = estimateMessageUsage("hello", "world", "claude-sonnet-4-6");
    const b = estimateMessageUsage("foo", "bar", "claude-sonnet-4-6");
    const sum = sumUsage([a, b]);
    expect(sum.inputTokens).toBe(a.inputTokens + b.inputTokens);
    expect(sum.outputTokens).toBe(a.outputTokens + b.outputTokens);
    expect(sum.totalTokens).toBe(a.totalTokens + b.totalTokens);
    expect(sum.costUSD).toBeCloseTo((a.costUSD ?? 0) + (b.costUSD ?? 0), 6);
  });
  it("keeps cost null when no entries are priced", () => {
    const a = estimateMessageUsage("hi", "hi", "unknown-model");
    const b = estimateMessageUsage("hi", "hi", "also-unknown");
    expect(sumUsage([a, b]).costUSD).toBeNull();
  });
  it("sums cost across mixed priced / unpriced entries", () => {
    const priced = estimateMessageUsage("hi", "hi", "claude-sonnet-4-6");
    const unpriced = estimateMessageUsage("hi", "hi", "unknown");
    const sum = sumUsage([priced, unpriced]);
    expect(sum.costUSD).toBeCloseTo(priced.costUSD ?? 0, 6);
  });
});

describe("evaluateBudget", () => {
  it("returns ok when no limit set", () => {
    const r = evaluateBudget(100, DEFAULT_BUDGET_STATE);
    expect(r.status).toBe("ok");
    expect(r.remainingUSD).toBeNull();
  });

  it("returns ok when cost is null (unpriced model)", () => {
    const r = evaluateBudget(null, { limitUSD: 1, warnAt: 0.5 });
    expect(r.status).toBe("ok");
  });

  it("returns ok under the warn threshold", () => {
    const r = evaluateBudget(0.1, { limitUSD: 1, warnAt: 0.5 });
    expect(r.status).toBe("ok");
    expect(r.pct).toBeCloseTo(0.1);
    expect(r.remainingUSD).toBeCloseTo(0.9);
  });

  it("returns warning at the threshold", () => {
    const r = evaluateBudget(0.5, { limitUSD: 1, warnAt: 0.5 });
    expect(r.status).toBe("warning");
  });

  it("returns warning between threshold and limit", () => {
    const r = evaluateBudget(0.75, { limitUSD: 1, warnAt: 0.5 });
    expect(r.status).toBe("warning");
  });

  it("returns blocked at and above the limit", () => {
    expect(evaluateBudget(1, { limitUSD: 1, warnAt: 0.5 }).status).toBe("blocked");
    expect(evaluateBudget(1.5, { limitUSD: 1, warnAt: 0.5 }).status).toBe("blocked");
  });

  it("clamps remainingUSD at zero when over budget", () => {
    const r = evaluateBudget(2, { limitUSD: 1, warnAt: 0.5 });
    expect(r.remainingUSD).toBe(0);
  });

  it("treats limit <= 0 as no limit", () => {
    expect(evaluateBudget(5, { limitUSD: 0, warnAt: 0.5 }).status).toBe("ok");
    expect(evaluateBudget(5, { limitUSD: -1, warnAt: 0.5 }).status).toBe("ok");
  });
});

describe("evaluateContextWindow", () => {
  it("returns ok when well under the limit", () => {
    const r = evaluateContextWindow(1000, "claude-sonnet-4-6");
    expect(r.status).toBe("ok");
    expect(r.pct).toBeCloseTo(0.001);
    expect(r.modelKnown).toBe(true);
  });

  it("returns warning between 60% and 80%", () => {
    // 60% of claude-sonnet-4-6 = 600K tokens
    const r = evaluateContextWindow(650_000, "claude-sonnet-4-6");
    expect(r.status).toBe("warning");
  });

  it("returns critical at 80%+", () => {
    const r = evaluateContextWindow(900_000, "claude-sonnet-4-6");
    expect(r.status).toBe("critical");
  });

  it("falls back to DEFAULT_CONTEXT_LIMIT for unknown model", () => {
    const r = evaluateContextWindow(50_000, "unknown-model");
    expect(r.limit).toBe(DEFAULT_CONTEXT_LIMIT);
    expect(r.modelKnown).toBe(false);
  });

  it("falls back to DEFAULT_CONTEXT_LIMIT when model is undefined", () => {
    const r = evaluateContextWindow(50_000, undefined);
    expect(r.limit).toBe(DEFAULT_CONTEXT_LIMIT);
    expect(r.modelKnown).toBe(false);
  });

  it("uses the exact limit for known models", () => {
    const claude = evaluateContextWindow(1, "claude-sonnet-4-6");
    expect(claude.limit).toBe(MODEL_CONTEXT_LIMITS["claude-sonnet-4-6"]);
    const gpt = evaluateContextWindow(1, "gpt-4o");
    expect(gpt.limit).toBe(MODEL_CONTEXT_LIMITS["gpt-4o"]);
  });
});

describe("formatContextSize", () => {
  it("formats millions with M suffix", () => {
    expect(formatContextSize(1_000_000)).toBe("1.0M");
    expect(formatContextSize(2_500_000)).toBe("2.5M");
  });
  it("formats thousands with K suffix", () => {
    expect(formatContextSize(1000)).toBe("1K");
    expect(formatContextSize(128_000)).toBe("128K");
  });
  it("shows small values verbatim", () => {
    expect(formatContextSize(500)).toBe("500");
    expect(formatContextSize(0)).toBe("0");
  });
});

describe("formatters", () => {
  it("formatTokens uses t / kt suffixes", () => {
    expect(formatTokens(42)).toBe("42t");
    expect(formatTokens(1500)).toBe("1.5kt");
    expect(formatTokens(42_000)).toBe("42kt");
  });

  it("formatCost handles null", () => {
    expect(formatCost(null)).toBe("—");
  });
  it("formatCost shows <$0.001 for tiny amounts", () => {
    expect(formatCost(0.0002)).toBe("<$0.001");
  });
  it("formatCost shows 3-decimal for sub-$1", () => {
    expect(formatCost(0.12)).toBe("$0.120");
  });
  it("formatCost shows 2-decimal for $1+", () => {
    expect(formatCost(1.25)).toBe("$1.25");
  });
});
