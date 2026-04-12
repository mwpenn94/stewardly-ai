/**
 * Unit tests for the pure helpers in HolisticComparison.
 *
 * Cover preset registry integrity, profile mapping, delta math
 * (including edge cases like zero baseline + empty arrays),
 * headline formatting, and confidence scoring.
 */

import { describe, it, expect } from "vitest";
import {
  HE_PRESET_REGISTRY,
  comparisonConfidence,
  computeComparisonDelta,
  findPreset,
  formatDeltaHeadline,
  profileToHolisticInput,
} from "./holisticComparisonHelpers";

describe("holisticComparisonHelpers / HE_PRESET_REGISTRY", () => {
  it("includes all 8 server-side runPreset enum values", () => {
    const keys = HE_PRESET_REGISTRY.map((p) => p.key).sort();
    expect(keys).toEqual([
      "captivemutual",
      "communitybd",
      "diy",
      "doNothing",
      "ria",
      "wbPremFinance",
      "wealthbridgeClient",
      "wirehouse",
    ]);
  });

  it("has unique keys", () => {
    const keys = HE_PRESET_REGISTRY.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("has a non-empty label, color, description for every preset", () => {
    for (const p of HE_PRESET_REGISTRY) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.short.length).toBeGreaterThan(0);
      expect(p.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(p.description.length).toBeGreaterThan(10);
    }
  });
});

describe("holisticComparisonHelpers / findPreset", () => {
  it("returns the preset by exact key", () => {
    expect(findPreset("doNothing")?.label).toBe("Do Nothing (Current Path)");
    expect(findPreset("wealthbridgeClient")?.short).toBe("WealthBridge");
  });

  it("returns undefined for unknown keys", () => {
    expect(findPreset("nonexistent")).toBeUndefined();
  });
});

describe("holisticComparisonHelpers / profileToHolisticInput", () => {
  it("returns empty object for empty profile", () => {
    expect(profileToHolisticInput({})).toEqual({});
  });

  it("maps engine-recognized fields", () => {
    const input = profileToHolisticInput({
      age: 40,
      income: 120000,
      savings: 50000,
      monthlySavings: 1500,
      dependents: 2,
      mortgage: 250000,
      debts: 30000,
      marginalRate: 0.25,
      isBizOwner: true,
    });
    expect(input.age).toBe(40);
    expect(input.income).toBe(120000);
    expect(input.savings).toBe(50000);
    expect(input.isBizOwner).toBe(true);
  });

  it("strips UI-only fields", () => {
    const input = profileToHolisticInput({
      age: 40,
      filingStatus: "mfj",
      stateOfResidence: "TX",
      hasHomeowner: true,
      retirementAge: 65,
      businessRole: "md",
    });
    expect(input.age).toBe(40);
    expect(input.filingStatus).toBeUndefined();
    expect(input.stateOfResidence).toBeUndefined();
    expect(input.hasHomeowner).toBeUndefined();
    expect(input.businessRole).toBeUndefined();
  });

  it("preserves false booleans (zero is meaningful)", () => {
    const input = profileToHolisticInput({ isBizOwner: false });
    expect(input.isBizOwner).toBe(false);
  });
});

describe("holisticComparisonHelpers / computeComparisonDelta", () => {
  it("returns zeros for both undefined", () => {
    const d = computeComparisonDelta(undefined, undefined);
    expect(d.finalA).toBe(0);
    expect(d.finalB).toBe(0);
    expect(d.delta).toBe(0);
    expect(d.years).toBe(0);
  });

  it("returns zeros for both empty", () => {
    const d = computeComparisonDelta([], []);
    expect(d.finalA).toBe(0);
    expect(d.finalB).toBe(0);
    expect(d.delta).toBe(0);
  });

  it("computes delta with B winning", () => {
    const a = [{ liquidWealth: 100, year: 1 }, { liquidWealth: 200, year: 2 }];
    const b = [{ liquidWealth: 150, year: 1 }, { liquidWealth: 500, year: 2 }];
    const d = computeComparisonDelta(a, b);
    expect(d.finalA).toBe(200);
    expect(d.finalB).toBe(500);
    expect(d.delta).toBe(300);
    expect(d.pctImprovement).toBe(1.5);
    expect(d.years).toBe(2);
  });

  it("computes delta with A winning (negative delta)", () => {
    const a = [{ liquidWealth: 1000 }];
    const b = [{ liquidWealth: 600 }];
    const d = computeComparisonDelta(a, b);
    expect(d.delta).toBe(-400);
    expect(d.pctImprovement).toBe(-0.4);
  });

  it("guards against zero baseline (no division by zero)", () => {
    const a = [{ liquidWealth: 0 }];
    const b = [{ liquidWealth: 500 }];
    const d = computeComparisonDelta(a, b);
    expect(d.finalA).toBe(0);
    expect(d.finalB).toBe(500);
    expect(d.delta).toBe(500);
    // pct improvement uses max(|A|, 1) = 1 as denominator
    expect(d.pctImprovement).toBe(500);
  });

  it("uses the longer array length for years", () => {
    const a = [{ liquidWealth: 100 }, { liquidWealth: 200 }];
    const b = [{ liquidWealth: 300 }];
    const d = computeComparisonDelta(a, b);
    expect(d.years).toBe(2);
  });

  it("treats missing liquidWealth as zero on the final row", () => {
    const a = [{ liquidWealth: 100 }, { year: 2 }];
    const b = [{ liquidWealth: 500 }];
    const d = computeComparisonDelta(a, b);
    expect(d.finalA).toBe(0);
    expect(d.finalB).toBe(500);
  });
});

describe("holisticComparisonHelpers / formatDeltaHeadline", () => {
  it("explains a positive improvement", () => {
    const d = computeComparisonDelta(
      [{ liquidWealth: 1_000_000 }],
      [{ liquidWealth: 1_500_000 }],
    );
    const text = formatDeltaHeadline(d, "Do Nothing", "WealthBridge");
    expect(text).toContain("WealthBridge");
    expect(text).toContain("more");
    expect(text).toContain("50");
  });

  it("explains a negative improvement", () => {
    const d = computeComparisonDelta(
      [{ liquidWealth: 1_500_000 }],
      [{ liquidWealth: 1_000_000 }],
    );
    const text = formatDeltaHeadline(d, "WealthBridge", "Captive");
    expect(text).toContain("less");
  });

  it("handles a zero delta", () => {
    const d = computeComparisonDelta(
      [{ liquidWealth: 1000 }],
      [{ liquidWealth: 1000 }],
    );
    const text = formatDeltaHeadline(d, "A", "B");
    expect(text).toContain("same");
  });
});

describe("holisticComparisonHelpers / comparisonConfidence", () => {
  it("returns 0 for zero years (no projection)", () => {
    expect(comparisonConfidence(1, 0)).toBe(0);
  });

  it("returns ~1 for full profile + 30+ year horizon", () => {
    expect(comparisonConfidence(1, 30)).toBeCloseTo(1, 4);
    expect(comparisonConfidence(1, 50)).toBeCloseTo(1, 4);
  });

  it("scales linearly with profile completeness", () => {
    expect(comparisonConfidence(0.5, 30)).toBeCloseTo(0.65, 4); // 0.5*0.7 + 1*0.3
  });

  it("clamps to 0..1", () => {
    expect(comparisonConfidence(-1, 10)).toBeGreaterThanOrEqual(0);
    expect(comparisonConfidence(2, 100)).toBeLessThanOrEqual(1);
  });
});
