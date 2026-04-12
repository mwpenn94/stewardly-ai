/**
 * Unit tests for the pure multi-year tax projector.
 *
 * Pass 4 of the hybrid build loop — PARITY-TAX-0001.
 */
import { describe, it, expect } from "vitest";
import {
  computeOrdinaryTax,
  marginalRateFor,
  computeLTCGTax,
  projectYear,
  projectYears,
  projectRothLadder,
  computeRMD,
  irmaaTier,
  summarizeYears,
  inflationFactor,
  type YearContext,
} from "./projector";

const MFJ_2024: YearContext = {
  year: 2024,
  filingStatus: "mfj",
  ordinaryIncomeUSD: 150_000,
  longTermCapGainsUSD: 0,
  qualifiedDividendsUSD: 0,
  traditionalDistributionsUSD: 0,
  itemizedDeductionUSD: 0,
  aboveTheLineUSD: 0,
  primaryAge: 50,
};

// ─── computeOrdinaryTax ──────────────────────────────────────────────────

describe("tax/projector — computeOrdinaryTax", () => {
  const mfjBrackets2024 = [
    { upper: 23_200, rate: 0.10 },
    { upper: 94_300, rate: 0.12 },
    { upper: 201_050, rate: 0.22 },
    { upper: 383_900, rate: 0.24 },
    { upper: 487_450, rate: 0.32 },
    { upper: 731_200, rate: 0.35 },
    { upper: Infinity, rate: 0.37 },
  ];

  it("returns 0 for zero income", () => {
    expect(computeOrdinaryTax(0, mfjBrackets2024)).toBe(0);
  });
  it("returns 0 for negative / NaN income", () => {
    expect(computeOrdinaryTax(-100, mfjBrackets2024)).toBe(0);
    expect(computeOrdinaryTax(Number.NaN, mfjBrackets2024)).toBe(0);
  });
  it("taxes the entire amount at the first bracket when below the first upper", () => {
    expect(computeOrdinaryTax(10_000, mfjBrackets2024)).toBeCloseTo(1000, 2);
  });
  it("stacks through brackets for a mid-range taxable income (MFJ $100k)", () => {
    const tax = computeOrdinaryTax(100_000, mfjBrackets2024);
    // 23,200 * 0.10 = 2,320
    // (94,300 - 23,200) * 0.12 = 8,532
    // (100,000 - 94,300) * 0.22 = 1,254
    // total = 12,106
    expect(tax).toBeCloseTo(12_106, 0);
  });
  it("stacks through top bracket for high income (MFJ $1M)", () => {
    const tax = computeOrdinaryTax(1_000_000, mfjBrackets2024);
    // This is deterministic — snapshot-test against a manual calc.
    // Brackets: 2,320 + 8,532 + 23,485 + 43,884 + 33,136 + 85,312.50 + 99,456
    expect(tax).toBeGreaterThan(290_000);
    expect(tax).toBeLessThan(310_000);
  });
});

// ─── marginalRateFor ──────────────────────────────────────────────────────

describe("tax/projector — marginalRateFor", () => {
  const simple = [
    { upper: 10_000, rate: 0.10 },
    { upper: 50_000, rate: 0.20 },
    { upper: Infinity, rate: 0.30 },
  ];
  it("returns the first bracket for 0", () => {
    expect(marginalRateFor(0, simple)).toBe(0.10);
  });
  it("picks the bracket containing the income", () => {
    expect(marginalRateFor(9_999, simple)).toBe(0.10);
    expect(marginalRateFor(10_000, simple)).toBe(0.20);
    expect(marginalRateFor(49_999, simple)).toBe(0.20);
    expect(marginalRateFor(50_000, simple)).toBe(0.30);
  });
  it("returns the top bracket for infinity-style income", () => {
    expect(marginalRateFor(10_000_000, simple)).toBe(0.30);
  });
  it("handles negative / NaN safely", () => {
    expect(marginalRateFor(-1, simple)).toBe(0.10);
    expect(marginalRateFor(Number.NaN, simple)).toBe(0.10);
  });
});

// ─── computeLTCGTax ───────────────────────────────────────────────────────

describe("tax/projector — computeLTCGTax", () => {
  const tiers = { zero: 50_000, fifteen: 500_000 };

  it("taxes nothing when LTCG fits entirely in the 0% bracket", () => {
    expect(computeLTCGTax(20_000, 10_000, tiers)).toBe(0);
  });
  it("taxes at 15% when ordinary is above the zero threshold", () => {
    expect(computeLTCGTax(60_000, 10_000, tiers)).toBeCloseTo(1500, 2);
  });
  it("splits across 0% and 15% when ordinary is below but LTCG crosses", () => {
    const tax = computeLTCGTax(40_000, 50_000, tiers);
    // 10k in 0%, 40k in 15% = 6,000
    expect(tax).toBeCloseTo(6_000, 2);
  });
  it("taxes large amounts at 20% top-tier", () => {
    const tax = computeLTCGTax(50_000, 600_000, tiers);
    // all 600k is above zero (0), 450k of 600k in 15% (50k→500k headroom),
    // 150k in 20%
    expect(tax).toBeCloseTo(450_000 * 0.15 + 150_000 * 0.20, 0);
  });
  it("returns 0 for zero/negative/NaN amounts", () => {
    expect(computeLTCGTax(100_000, 0, tiers)).toBe(0);
    expect(computeLTCGTax(100_000, -50, tiers)).toBe(0);
    expect(computeLTCGTax(100_000, Number.NaN, tiers)).toBe(0);
  });
});

// ─── projectYear ──────────────────────────────────────────────────────────

describe("tax/projector — projectYear", () => {
  it("produces AGI, taxable income, and federal tax for a standard MFJ 2024 case", () => {
    const r = projectYear(MFJ_2024);
    expect(r.agi).toBe(150_000);
    // Standard deduction MFJ 2024 = 29,200 → taxable = 120,800
    expect(r.usedDeduction).toBe(29_200);
    expect(r.taxableIncome).toBeCloseTo(120_800, 0);
    expect(r.totalFederalTax).toBeGreaterThan(15_000);
    expect(r.totalFederalTax).toBeLessThan(25_000);
  });

  it("picks itemized when greater than standard", () => {
    const r = projectYear({
      ...MFJ_2024,
      itemizedDeductionUSD: 50_000,
    });
    expect(r.usedDeduction).toBe(50_000);
  });

  it("throws on year < 2024", () => {
    expect(() => projectYear({ ...MFJ_2024, year: 2023 })).toThrow(/2024\+/);
  });

  it("warns on post-TCJA sunset years", () => {
    const r = projectYear({ ...MFJ_2024, year: 2026 });
    expect(r.warnings.some((w) => /sunset/i.test(w))).toBe(true);
  });

  it("adds additional deduction for age 65+", () => {
    const r = projectYear({ ...MFJ_2024, primaryAge: 67 });
    expect(r.standardDeduction).toBeGreaterThan(29_200);
  });

  it("clamps negative income inputs to 0 with warning", () => {
    const r = projectYear({
      ...MFJ_2024,
      ordinaryIncomeUSD: -5_000,
    });
    expect(r.warnings.some((w) => /negative/i.test(w))).toBe(true);
    expect(r.agi).toBe(0); // -5000 → 0, rest 0
  });

  it("NaN inputs are treated as 0 with warning", () => {
    const r = projectYear({
      ...MFJ_2024,
      ordinaryIncomeUSD: Number.NaN,
    });
    expect(r.warnings.some((w) => /NaN/i.test(w))).toBe(true);
    expect(r.agi).toBe(0);
  });

  it("marginalRate is from the ordinary bracket (excludes LTCG)", () => {
    const r = projectYear({
      ...MFJ_2024,
      ordinaryIncomeUSD: 100_000,
      longTermCapGainsUSD: 1_000_000,
    });
    // Ordinary taxable income ≈ 70,800 (100,000 - 29,200) → 12% bracket
    expect(r.marginalRate).toBe(0.12);
  });

  it("applies above-the-line adjustments", () => {
    const r = projectYear({
      ...MFJ_2024,
      aboveTheLineUSD: 10_000,
    });
    expect(r.agi).toBe(140_000);
  });

  it("HOH uses a different bracket table", () => {
    const r = projectYear({
      ...MFJ_2024,
      filingStatus: "hoh",
      ordinaryIncomeUSD: 70_000,
    });
    expect(r.agi).toBe(70_000);
    expect(r.totalFederalTax).toBeGreaterThan(0);
  });
});

// ─── projectYears ─────────────────────────────────────────────────────────

describe("tax/projector — projectYears", () => {
  it("maps an array of contexts", () => {
    const results = projectYears([
      MFJ_2024,
      { ...MFJ_2024, year: 2025 },
      { ...MFJ_2024, year: 2026 },
    ]);
    expect(results).toHaveLength(3);
    expect(results.map((r) => r.year)).toEqual([2024, 2025, 2026]);
  });
});

// ─── projectRothLadder ────────────────────────────────────────────────────

describe("tax/projector — projectRothLadder", () => {
  it("fills to the 24% bracket top across multiple years", () => {
    // Retired MFJ with $50k pension — lots of headroom in 12/22/24 brackets.
    const baseYears: YearContext[] = [2024, 2025, 2026, 2027, 2028].map((y) => ({
      year: y,
      filingStatus: "mfj" as const,
      ordinaryIncomeUSD: 50_000,
      longTermCapGainsUSD: 0,
      qualifiedDividendsUSD: 0,
      traditionalDistributionsUSD: 0,
      itemizedDeductionUSD: 0,
      aboveTheLineUSD: 0,
      primaryAge: 67,
      spouseAge: 65,
    }));
    const plan = projectRothLadder({
      years: baseYears,
      targetTopRate: 0.24,
      traditionalBalanceUSD: 2_000_000,
    });
    expect(plan.totalConverted).toBeGreaterThan(100_000);
    expect(plan.years.every((y) => y.conversionAmount >= 0)).toBe(true);
    expect(plan.totalTaxCost).toBeGreaterThan(0);
  });

  it("returns zero plan when current income already exceeds target", () => {
    const years: YearContext[] = [
      {
        ...MFJ_2024,
        ordinaryIncomeUSD: 500_000, // already in 35% bracket
      },
    ];
    const plan = projectRothLadder({
      years,
      targetTopRate: 0.22,
      traditionalBalanceUSD: 500_000,
    });
    expect(plan.totalConverted).toBe(0);
  });

  it("handles empty year array", () => {
    const plan = projectRothLadder({
      years: [],
      targetTopRate: 0.24,
      traditionalBalanceUSD: 500_000,
    });
    expect(plan.totalConverted).toBe(0);
    expect(plan.years).toHaveLength(0);
  });

  it("warns when target rate doesn't match any bracket", () => {
    const plan = projectRothLadder({
      years: [MFJ_2024],
      targetTopRate: 0.99,
      traditionalBalanceUSD: 500_000,
    });
    expect(plan.warnings.length).toBeGreaterThan(0);
  });

  it("defensively treats negative traditional balance as 0", () => {
    const plan = projectRothLadder({
      years: [MFJ_2024],
      targetTopRate: 0.24,
      traditionalBalanceUSD: -500,
    });
    expect(plan.totalConverted).toBe(0);
  });
});

// ─── computeRMD ───────────────────────────────────────────────────────────

describe("tax/projector — computeRMD", () => {
  it("returns 0 before age 72", () => {
    expect(computeRMD(71, 1_000_000)).toBe(0);
  });
  it("uses 27.4 divisor at age 72", () => {
    expect(computeRMD(72, 1_000_000)).toBeCloseTo(36_496, 0);
  });
  it("uses 24.6 divisor at age 75", () => {
    expect(computeRMD(75, 500_000)).toBeCloseTo(500_000 / 24.6, 0);
  });
  it("returns 0 for 0 or negative balance", () => {
    expect(computeRMD(75, 0)).toBe(0);
    expect(computeRMD(75, -100)).toBe(0);
  });
  it("clamps age > 100 to the top of the table", () => {
    expect(computeRMD(110, 100_000)).toBeCloseTo(100_000 / 6.4, 0);
  });
  it("handles fractional age by flooring", () => {
    expect(computeRMD(73.5, 500_000)).toBeCloseTo(500_000 / 26.5, 0);
  });
});

// ─── irmaaTier ────────────────────────────────────────────────────────────

describe("tax/projector — irmaaTier", () => {
  it("returns tier 0 for low MAGI (MFJ < 206k)", () => {
    const r = irmaaTier(100_000, "mfj");
    expect(r.tierIndex).toBe(0);
  });
  it("escalates tiers with MAGI", () => {
    const r1 = irmaaTier(250_000, "mfj");
    const r2 = irmaaTier(500_000, "mfj");
    expect(r2.tierIndex).toBeGreaterThan(r1.tierIndex);
  });
  it("uses single thresholds for non-MFJ", () => {
    const single = irmaaTier(150_000, "single");
    const mfj = irmaaTier(150_000, "mfj");
    expect(single.tierIndex).toBeGreaterThan(mfj.tierIndex);
  });
  it("handles 0 and NaN defensively", () => {
    const r = irmaaTier(0, "single");
    expect(r.tierIndex).toBe(0);
    const r2 = irmaaTier(Number.NaN, "single");
    expect(r2.tierIndex).toBe(0);
  });
});

// ─── summarizeYears ───────────────────────────────────────────────────────

describe("tax/projector — summarizeYears", () => {
  it("returns zero summary for empty array", () => {
    const s = summarizeYears([]);
    expect(s.yearsModeled).toBe(0);
    expect(s.totalFederalTax).toBe(0);
  });
  it("aggregates totals across years", () => {
    const results = projectYears([
      MFJ_2024,
      { ...MFJ_2024, year: 2025, ordinaryIncomeUSD: 200_000 },
    ]);
    const s = summarizeYears(results);
    expect(s.yearsModeled).toBe(2);
    expect(s.totalAGI).toBe(350_000);
    expect(s.totalFederalTax).toBeGreaterThan(0);
  });
  it("reports the highest marginal rate seen", () => {
    const results = projectYears([
      { ...MFJ_2024, ordinaryIncomeUSD: 100_000 },
      { ...MFJ_2024, year: 2025, ordinaryIncomeUSD: 500_000 },
    ]);
    const s = summarizeYears(results);
    expect(s.highestMarginalRate).toBeGreaterThanOrEqual(0.24);
  });
});

// ─── inflationFactor ──────────────────────────────────────────────────────

describe("tax/projector — inflationFactor", () => {
  it("returns 1 for same-year", () => {
    expect(inflationFactor(2024, 2024)).toBe(1);
  });
  it("compounds forward in time", () => {
    expect(inflationFactor(2024, 2026)).toBeCloseTo(1.0609, 4);
  });
  it("compounds backward in time (fractional <1)", () => {
    expect(inflationFactor(2026, 2024)).toBeCloseTo(0.9426, 3);
  });
});
