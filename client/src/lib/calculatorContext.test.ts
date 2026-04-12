/**
 * Tests for calculatorContext — cross-app calculator-to-chat bridge.
 */
import { describe, it, expect } from "vitest";
import {
  parseCalculatorContext,
  serializeCalculatorContext,
  recordCalculation,
  removeCalculation,
  clearCalculations,
  filterByType,
  recentCalculations,
  buildContextOverlay,
  summarizeContext,
  type CalculationResult,
  type CalculatorContextState,
} from "./calculatorContext";

function makeResult(overrides: Partial<CalculationResult> = {}): CalculationResult {
  return {
    id: "test-1",
    type: "tax",
    title: "Tax Analysis",
    summary: "Effective rate 22%, federal tax $33,000",
    inputs: { income: 150000, filingStatus: "mfj" },
    outputs: { effectiveRate: 0.22, federalTax: 33000 },
    timestamp: Date.now(),
    ...overrides,
  };
}

const empty: CalculatorContextState = { entries: [] };

describe("parseCalculatorContext", () => {
  it("returns empty for null/empty string", () => {
    expect(parseCalculatorContext(null)).toEqual(empty);
    expect(parseCalculatorContext("")).toEqual(empty);
  });

  it("returns empty for malformed JSON", () => {
    expect(parseCalculatorContext("{broken")).toEqual(empty);
    expect(parseCalculatorContext("42")).toEqual(empty);
    expect(parseCalculatorContext('"hello"')).toEqual(empty);
  });

  it("returns empty for object without entries array", () => {
    expect(parseCalculatorContext('{"foo":"bar"}')).toEqual(empty);
    expect(parseCalculatorContext('{"entries":"not-array"}')).toEqual(empty);
  });

  it("filters out malformed entries", () => {
    const data = {
      entries: [
        makeResult(),
        { id: "x" }, // missing type, title, summary, timestamp
        null,
        "not-object",
      ],
    };
    const result = parseCalculatorContext(JSON.stringify(data));
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].id).toBe("test-1");
  });

  it("caps at 10 entries", () => {
    const entries = Array.from({ length: 20 }, (_, i) =>
      makeResult({ id: `id-${i}` }),
    );
    const result = parseCalculatorContext(JSON.stringify({ entries }));
    expect(result.entries).toHaveLength(10);
  });

  it("round-trips through serialize/parse", () => {
    const state: CalculatorContextState = {
      entries: [makeResult(), makeResult({ id: "test-2", type: "estate" })],
    };
    const serialized = serializeCalculatorContext(state);
    const parsed = parseCalculatorContext(serialized);
    expect(parsed.entries).toHaveLength(2);
    expect(parsed.entries[0].id).toBe("test-1");
    expect(parsed.entries[1].id).toBe("test-2");
  });
});

describe("recordCalculation", () => {
  it("adds a new entry to the front", () => {
    const result = makeResult();
    const state = recordCalculation(empty, result);
    expect(state.entries).toHaveLength(1);
    expect(state.entries[0].id).toBe("test-1");
  });

  it("deduplicates by id (updates existing)", () => {
    const first = makeResult({ summary: "old" });
    const state1 = recordCalculation(empty, first);
    const updated = makeResult({ summary: "new" });
    const state2 = recordCalculation(state1, updated);
    expect(state2.entries).toHaveLength(1);
    expect(state2.entries[0].summary).toBe("new");
  });

  it("caps at 10 entries (drops oldest)", () => {
    let state = empty;
    for (let i = 0; i < 12; i++) {
      state = recordCalculation(state, makeResult({ id: `id-${i}` }));
    }
    expect(state.entries).toHaveLength(10);
    // Most recent should be first
    expect(state.entries[0].id).toBe("id-11");
  });

  it("clamps summary length at 2000 chars", () => {
    const longSummary = "x".repeat(5000);
    const result = makeResult({ summary: longSummary });
    const state = recordCalculation(empty, result);
    expect(state.entries[0].summary.length).toBeLessThanOrEqual(2000);
  });
});

describe("removeCalculation", () => {
  it("removes by id", () => {
    const state: CalculatorContextState = {
      entries: [makeResult({ id: "a" }), makeResult({ id: "b" })],
    };
    const result = removeCalculation(state, "a");
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].id).toBe("b");
  });

  it("no-ops for non-existent id", () => {
    const state: CalculatorContextState = { entries: [makeResult()] };
    const result = removeCalculation(state, "nonexistent");
    expect(result.entries).toHaveLength(1);
  });
});

describe("clearCalculations", () => {
  it("returns empty state", () => {
    expect(clearCalculations()).toEqual(empty);
  });
});

describe("filterByType", () => {
  it("filters entries by type", () => {
    const state: CalculatorContextState = {
      entries: [
        makeResult({ id: "a", type: "tax" }),
        makeResult({ id: "b", type: "estate" }),
        makeResult({ id: "c", type: "tax" }),
      ],
    };
    expect(filterByType(state, "tax")).toHaveLength(2);
    expect(filterByType(state, "estate")).toHaveLength(1);
    expect(filterByType(state, "retirement")).toHaveLength(0);
  });
});

describe("recentCalculations", () => {
  it("returns entries sorted by timestamp descending", () => {
    const state: CalculatorContextState = {
      entries: [
        makeResult({ id: "old", timestamp: 1000 }),
        makeResult({ id: "new", timestamp: 3000 }),
        makeResult({ id: "mid", timestamp: 2000 }),
      ],
    };
    const recent = recentCalculations(state, 2);
    expect(recent).toHaveLength(2);
    expect(recent[0].id).toBe("new");
    expect(recent[1].id).toBe("mid");
  });

  it("defaults to limit of 5", () => {
    const entries = Array.from({ length: 10 }, (_, i) =>
      makeResult({ id: `id-${i}`, timestamp: i * 1000 }),
    );
    const recent = recentCalculations({ entries });
    expect(recent).toHaveLength(5);
  });
});

describe("buildContextOverlay", () => {
  it("returns empty string for no entries", () => {
    expect(buildContextOverlay(empty)).toBe("");
  });

  it("builds markdown overlay with recent results", () => {
    const state: CalculatorContextState = {
      entries: [
        makeResult({
          id: "a",
          type: "tax",
          title: "Tax Analysis",
          summary: "Effective rate 22%",
          timestamp: Date.now() - 5 * 60000, // 5 minutes ago
        }),
      ],
    };
    const overlay = buildContextOverlay(state);
    expect(overlay).toContain("## Recent Calculator Results");
    expect(overlay).toContain("[TAX] Tax Analysis");
    expect(overlay).toContain("5m ago");
    expect(overlay).toContain("Effective rate 22%");
  });

  it("formats hours for older results", () => {
    const state: CalculatorContextState = {
      entries: [
        makeResult({
          timestamp: Date.now() - 120 * 60000, // 2 hours ago
        }),
      ],
    };
    const overlay = buildContextOverlay(state);
    expect(overlay).toContain("2h ago");
  });
});

describe("summarizeContext", () => {
  it("returns zero count for empty state", () => {
    const summary = summarizeContext(empty);
    expect(summary.count).toBe(0);
    expect(summary.types).toEqual([]);
    expect(summary.mostRecent).toBeNull();
  });

  it("returns correct summary for populated state", () => {
    const state: CalculatorContextState = {
      entries: [
        makeResult({ id: "a", type: "tax", timestamp: 1000 }),
        makeResult({ id: "b", type: "estate", timestamp: 3000 }),
        makeResult({ id: "c", type: "tax", timestamp: 2000 }),
      ],
    };
    const summary = summarizeContext(state);
    expect(summary.count).toBe(3);
    expect(summary.types).toContain("tax");
    expect(summary.types).toContain("estate");
    expect(summary.mostRecent?.id).toBe("b"); // highest timestamp
  });
});
