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
  MODEL_PRICING,
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
