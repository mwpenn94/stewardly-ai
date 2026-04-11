/**
 * Tests for cost sheet calculator — Pass 269.
 */

import { describe, it, expect } from "vitest";
import {
  MODEL_PRICES,
  findModelPrice,
  estimateCallCost,
  projectCost,
  compareModels,
  formatUsd,
  summarizeComparison,
} from "./costSheet";

describe("MODEL_PRICES", () => {
  it("has a non-empty list", () => {
    expect(MODEL_PRICES.length).toBeGreaterThan(3);
  });

  it("every entry has required fields", () => {
    for (const m of MODEL_PRICES) {
      expect(m.id).toBeTruthy();
      expect(m.name).toBeTruthy();
      expect(m.inputPerMillion).toBeGreaterThanOrEqual(0);
      expect(m.outputPerMillion).toBeGreaterThanOrEqual(0);
      expect(m.contextWindow).toBeGreaterThan(0);
    }
  });
});

describe("findModelPrice", () => {
  it("finds known model", () => {
    const out = findModelPrice("claude-sonnet-4-6");
    expect(out).not.toBeNull();
    expect(out!.name).toBe("Claude Sonnet 4.6");
  });

  it("returns null for unknown", () => {
    expect(findModelPrice("bogus")).toBeNull();
  });
});

describe("estimateCallCost", () => {
  const sonnet = findModelPrice("claude-sonnet-4-6")!;

  it("computes simple cost", () => {
    const cost = estimateCallCost(sonnet, 1_000_000, 500_000);
    expect(cost.inputCost).toBe(3.0); // $3/M * 1M
    expect(cost.outputCost).toBe(7.5); // $15/M * 0.5M
    expect(cost.totalCost).toBe(10.5);
  });

  it("returns zero for zero tokens", () => {
    const cost = estimateCallCost(sonnet, 0, 0);
    expect(cost.totalCost).toBe(0);
  });

  it("clamps negative input to zero", () => {
    const cost = estimateCallCost(sonnet, -100, -50);
    expect(cost.totalCost).toBe(0);
  });

  it("costPerCall equals totalCost", () => {
    const cost = estimateCallCost(sonnet, 1000, 500);
    expect(cost.costPerCall).toBe(cost.totalCost);
  });
});

describe("projectCost", () => {
  const haiku = findModelPrice("claude-haiku-4-5")!;

  it("computes daily / weekly / monthly / annual", () => {
    const projection = projectCost(haiku, 1000, 500, 10);
    expect(projection.perCall.totalCost).toBeGreaterThan(0);
    expect(projection.daily).toBe(projection.perCall.totalCost * 10);
    expect(projection.weekly).toBeCloseTo(projection.daily * 7);
    expect(projection.monthly).toBeCloseTo(projection.daily * 30.4);
    expect(projection.annualRate).toBeCloseTo(projection.daily * 365);
  });

  it("handles zero calls", () => {
    const projection = projectCost(haiku, 1000, 500, 0);
    expect(projection.daily).toBe(0);
    expect(projection.monthly).toBe(0);
  });

  it("clamps negative callsPerDay", () => {
    const projection = projectCost(haiku, 1000, 500, -5);
    expect(projection.daily).toBe(0);
  });
});

describe("compareModels", () => {
  it("returns a row per model sorted cheapest-first", () => {
    const rows = compareModels("claude-sonnet-4-6", 1000, 500, 10);
    expect(rows.length).toBe(MODEL_PRICES.length);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].projection.monthly).toBeGreaterThanOrEqual(
        rows[i - 1].projection.monthly,
      );
    }
  });

  it("computes savings relative to current", () => {
    const rows = compareModels("claude-opus-4-6", 10000, 5000, 100);
    // Haiku should be much cheaper than Opus so savings > 0
    const haikuRow = rows.find((r) => r.model.id === "claude-haiku-4-5");
    expect(haikuRow?.savings).toBeGreaterThan(0);
  });

  it("relativeCost < 1 for cheaper options", () => {
    const rows = compareModels("claude-opus-4-6", 1000, 500, 10);
    const cheap = rows.find((r) => r.model.id === "gemini-2.5-flash");
    expect(cheap?.relativeCost).toBeLessThan(1);
  });
});

describe("formatUsd", () => {
  it("zero", () => {
    expect(formatUsd(0)).toBe("$0.00");
  });

  it("tiny amounts", () => {
    expect(formatUsd(0.000123)).toBe("$0.000123");
  });

  it("small amounts with 4 decimals", () => {
    expect(formatUsd(0.5)).toBe("$0.5000");
  });

  it("medium amounts with 2 decimals", () => {
    expect(formatUsd(12.345)).toBe("$12.35");
  });

  it("large amounts with commas", () => {
    expect(formatUsd(12345)).toBe("$12,345");
  });

  it("handles NaN gracefully", () => {
    expect(formatUsd(NaN)).toBe("$0");
  });
});

describe("summarizeComparison", () => {
  it("returns nulls for empty", () => {
    const s = summarizeComparison([]);
    expect(s.cheapest).toBeNull();
    expect(s.mostExpensive).toBeNull();
    expect(s.avgMonthly).toBe(0);
  });

  it("identifies cheapest and most expensive", () => {
    const rows = compareModels("claude-sonnet-4-6", 1000, 500, 10);
    const s = summarizeComparison(rows);
    expect(s.cheapest).not.toBeNull();
    expect(s.mostExpensive).not.toBeNull();
    expect(s.cheapest!.projection.monthly).toBeLessThanOrEqual(
      s.mostExpensive!.projection.monthly,
    );
  });
});
