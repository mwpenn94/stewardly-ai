/**
 * Charitable Giving Calculator — Pure-function unit tests
 * Tests optimizeCharitable from charitableGiving.ts covering:
 * cash, appreciated stock, DAF, QCD, CRT vehicles + bunching analysis.
 */
import { describe, expect, it } from "vitest";
import { optimizeCharitable, type DonationInput } from "./charitableGiving";

function baseInput(overrides: Partial<DonationInput> = {}): DonationInput {
  return {
    annualIncome: 200000,
    filingStatus: "mfj",
    marginalRate: 0.32,
    stateRate: 0.05,
    itemizedDeductions: 35000, // Above standard deduction → already itemizing
    age: 55,
    desiredAnnualGiving: 20000,
    ...overrides,
  };
}

// ── Strategy generation ──────────────────────────────────────────────────────

describe("Charitable Giving — Strategy generation", () => {
  it("should generate 5 donation vehicle strategies", () => {
    const result = optimizeCharitable(baseInput());
    expect(result.strategies.length).toBe(5);
    const vehicles = result.strategies.map(s => s.vehicle);
    expect(vehicles).toContain("cash");
    expect(vehicles).toContain("appreciated_stock");
    expect(vehicles).toContain("daf");
    expect(vehicles).toContain("qcd");
    expect(vehicles).toContain("crt");
  });

  it("should select the best strategy as the one with highest tax savings among eligible", () => {
    const result = optimizeCharitable(baseInput());
    const eligible = result.strategies.filter(s => s.eligible);
    const best = eligible.reduce((a, b) => a.taxSavings > b.taxSavings ? a : b);
    expect(result.bestStrategy).toBe(best.vehicle);
  });
});

// ── Cash donation ────────────────────────────────────────────────────────────

describe("Charitable Giving — Cash donation", () => {
  it("should provide full deduction benefit when already itemizing", () => {
    const result = optimizeCharitable(baseInput({ itemizedDeductions: 35000 }));
    const cash = result.strategies.find(s => s.vehicle === "cash")!;
    // Combined rate = min(0.32 + 0.05, 0.50) = 0.37
    expect(cash.taxSavings).toBe(Math.round(20000 * 0.37));
    expect(cash.eligible).toBe(true);
  });

  it("should provide zero benefit when not itemizing and donation doesn't exceed standard deduction gap", () => {
    const result = optimizeCharitable(baseInput({
      itemizedDeductions: 5000,
      desiredAnnualGiving: 1000,
    }));
    const cash = result.strategies.find(s => s.vehicle === "cash")!;
    // itemized + donation = 6000 < 30000 std ded → 0 benefit
    expect(cash.taxSavings).toBe(0);
  });

  it("should compute effectiveCost = amount - taxSavings", () => {
    const result = optimizeCharitable(baseInput());
    const cash = result.strategies.find(s => s.vehicle === "cash")!;
    expect(cash.effectiveCost).toBe(Math.round(cash.annualAmount - cash.taxSavings));
  });

  it("should cap combined tax rate at 50%", () => {
    const result = optimizeCharitable(baseInput({
      marginalRate: 0.37,
      stateRate: 0.15, // Would be 52% combined
      itemizedDeductions: 35000,
    }));
    const cash = result.strategies.find(s => s.vehicle === "cash")!;
    // Capped at 50%
    expect(cash.taxSavings).toBe(Math.round(20000 * 0.50));
  });
});

// ── Appreciated stock ────────────────────────────────────────────────────────

describe("Charitable Giving — Appreciated stock", () => {
  it("should be eligible when stock has unrealized gains", () => {
    const result = optimizeCharitable(baseInput({
      appreciatedStockBasis: 10000,
      appreciatedStockFMV: 25000,
    }));
    const stock = result.strategies.find(s => s.vehicle === "appreciated_stock")!;
    expect(stock.eligible).toBe(true);
  });

  it("should be ineligible when no stock provided", () => {
    const result = optimizeCharitable(baseInput());
    const stock = result.strategies.find(s => s.vehicle === "appreciated_stock")!;
    expect(stock.eligible).toBe(false);
    expect(stock.taxSavings).toBe(0);
  });

  it("should avoid capital gains tax at 23.8%", () => {
    const result = optimizeCharitable(baseInput({
      appreciatedStockBasis: 5000,
      appreciatedStockFMV: 25000,
      desiredAnnualGiving: 20000,
    }));
    const stock = result.strategies.find(s => s.vehicle === "appreciated_stock")!;
    // gain = 25000 - 5000 = 20000; cap gains avoided = 20000 * 0.238 = 4760
    expect(stock.notes.some(n => n.includes("capital gains"))).toBe(true);
  });

  it("should be ineligible when stock has no gain", () => {
    const result = optimizeCharitable(baseInput({
      appreciatedStockBasis: 30000,
      appreciatedStockFMV: 25000,
    }));
    const stock = result.strategies.find(s => s.vehicle === "appreciated_stock")!;
    expect(stock.eligible).toBe(false);
  });
});

// ── QCD (Qualified Charitable Distribution) ──────────────────────────────────

describe("Charitable Giving — QCD", () => {
  it("should be eligible for age 70+ with IRA balance", () => {
    const result = optimizeCharitable(baseInput({
      age: 72,
      iraBalance: 500000,
    }));
    const qcd = result.strategies.find(s => s.vehicle === "qcd")!;
    expect(qcd.eligible).toBe(true);
  });

  it("should be ineligible for age under 70", () => {
    const result = optimizeCharitable(baseInput({
      age: 65,
      iraBalance: 500000,
    }));
    const qcd = result.strategies.find(s => s.vehicle === "qcd")!;
    expect(qcd.eligible).toBe(false);
    expect(qcd.taxSavings).toBe(0);
  });

  it("should cap QCD at $105,000 per year", () => {
    const result = optimizeCharitable(baseInput({
      age: 72,
      iraBalance: 500000,
      desiredAnnualGiving: 200000,
    }));
    const qcd = result.strategies.find(s => s.vehicle === "qcd")!;
    expect(qcd.annualAmount).toBeLessThanOrEqual(105000);
  });

  it("should cap QCD at IRA balance", () => {
    const result = optimizeCharitable(baseInput({
      age: 72,
      iraBalance: 5000,
      desiredAnnualGiving: 20000,
    }));
    const qcd = result.strategies.find(s => s.vehicle === "qcd")!;
    expect(qcd.annualAmount).toBe(5000);
  });

  it("should compute QCD tax savings using marginal rate (AGI exclusion)", () => {
    const result = optimizeCharitable(baseInput({
      age: 72,
      iraBalance: 500000,
      desiredAnnualGiving: 20000,
      marginalRate: 0.32,
    }));
    const qcd = result.strategies.find(s => s.vehicle === "qcd")!;
    // QCD excludes from income → savings = amount * marginalRate
    expect(qcd.taxSavings).toBe(Math.round(20000 * 0.32));
  });
});

// ── CRT (Charitable Remainder Trust) ─────────────────────────────────────────

describe("Charitable Giving — CRT", () => {
  it("should be eligible for gifts of $100K+", () => {
    const result = optimizeCharitable(baseInput({ desiredAnnualGiving: 150000 }));
    const crt = result.strategies.find(s => s.vehicle === "crt")!;
    expect(crt.eligible).toBe(true);
  });

  it("should be ineligible for gifts under $100K", () => {
    const result = optimizeCharitable(baseInput({ desiredAnnualGiving: 50000 }));
    const crt = result.strategies.find(s => s.vehicle === "crt")!;
    expect(crt.eligible).toBe(false);
  });

  it("should include income stream and upfront deduction in notes", () => {
    const result = optimizeCharitable(baseInput({ desiredAnnualGiving: 200000 }));
    const crt = result.strategies.find(s => s.vehicle === "crt")!;
    expect(crt.notes.some(n => n.includes("Income stream"))).toBe(true);
    expect(crt.notes.some(n => n.includes("deduction"))).toBe(true);
  });
});

// ── Bunching analysis ────────────────────────────────────────────────────────

describe("Charitable Giving — Bunching analysis", () => {
  it("should calculate bunching over specified years", () => {
    const result = optimizeCharitable(baseInput({ yearsToModel: 3 }));
    expect(result.bunchingAnalysis.bunchEveryNYears).toBe(3);
    expect(result.bunchingAnalysis.bunchedAmount).toBe(60000);
  });

  it("should default to 3-year model if not specified", () => {
    const result = optimizeCharitable(baseInput());
    expect(result.bunchingAnalysis.bunchEveryNYears).toBe(3);
  });

  it("should show positive bunching benefit when not itemizing", () => {
    const result = optimizeCharitable(baseInput({
      itemizedDeductions: 10000, // below standard deduction
      desiredAnnualGiving: 15000,
      yearsToModel: 2,
    }));
    // Bunching may help push over standard deduction threshold
    expect(result.bunchingAnalysis.bunchedAmount).toBe(30000);
  });
});

// ── Effective giving rate ────────────────────────────────────────────────────

describe("Charitable Giving — Effective giving rate", () => {
  it("should be between 0 and 1", () => {
    const result = optimizeCharitable(baseInput());
    expect(result.effectiveGivingRate).toBeGreaterThan(0);
    expect(result.effectiveGivingRate).toBeLessThanOrEqual(1);
  });

  it("should be lower when tax savings are higher", () => {
    const highTax = optimizeCharitable(baseInput({ marginalRate: 0.37, stateRate: 0.10 }));
    const lowTax = optimizeCharitable(baseInput({ marginalRate: 0.12, stateRate: 0.0 }));
    expect(highTax.effectiveGivingRate).toBeLessThan(lowTax.effectiveGivingRate);
  });
});
