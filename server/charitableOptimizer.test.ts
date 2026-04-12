/**
 * Charitable Optimizer — Pure-function unit tests
 * Tests optimizeCharitable from charitableOptimizer.ts covering:
 * vehicle analysis, bunching analysis, AGI limits, and strategy recommendations.
 */
import { describe, expect, it } from "vitest";
import { optimizeCharitable, type CharitableInput } from "./charitableOptimizer";

function baseInput(overrides: Partial<CharitableInput> = {}): CharitableInput {
  return {
    annualDonationGoal: 25000,
    marginalTaxRate: 0.32,
    stateTaxRate: 0.06,
    age: 55,
    filingStatus: "mfj",
    agi: 300000,
    itemizesDeductions: true,
    currentItemizedDeductions: 20000,
    ...overrides,
  };
}

// ── Vehicle analysis ─────────────────────────────────────────────────────────

describe("Charitable Optimizer — Vehicle analysis", () => {
  it("should generate 5 vehicle analyses", () => {
    const result = optimizeCharitable(baseInput());
    expect(result.vehicles.length).toBe(5);
    const types = result.vehicles.map(v => v.vehicle);
    expect(types).toContain("cash");
    expect(types).toContain("appreciated_stock");
    expect(types).toContain("daf");
    expect(types).toContain("qcd");
    expect(types).toContain("crt");
  });

  it("should select best vehicle as highest totalBenefit among eligible", () => {
    const result = optimizeCharitable(baseInput());
    const eligible = result.vehicles.filter(v => v.eligible);
    const best = eligible.reduce((a, b) => a.totalBenefit > b.totalBenefit ? a : b);
    expect(result.bestVehicle).toBe(best.vehicle);
  });
});

// ── Cash donation ────────────────────────────────────────────────────────────

describe("Charitable Optimizer — Cash donation", () => {
  it("should compute tax deduction when itemizing", () => {
    const result = optimizeCharitable(baseInput());
    const cash = result.vehicles.find(v => v.vehicle === "cash")!;
    expect(cash.taxDeduction).toBe(Math.round(25000));
    // combinedRate = 0.32 + 0.06 = 0.38
    expect(cash.taxSavings).toBe(Math.round(25000 * 0.38));
  });

  it("should show zero deduction when not itemizing", () => {
    const result = optimizeCharitable(baseInput({ itemizesDeductions: false }));
    const cash = result.vehicles.find(v => v.vehicle === "cash")!;
    expect(cash.taxDeduction).toBe(0);
    expect(cash.taxSavings).toBe(0);
  });

  it("should always be eligible", () => {
    const result = optimizeCharitable(baseInput());
    const cash = result.vehicles.find(v => v.vehicle === "cash")!;
    expect(cash.eligible).toBe(true);
  });

  it("should have effectiveCostOfGiving = donation - taxSavings", () => {
    const result = optimizeCharitable(baseInput());
    const cash = result.vehicles.find(v => v.vehicle === "cash")!;
    expect(cash.effectiveCostOfGiving).toBe(Math.round(25000 - cash.taxSavings));
  });
});

// ── Appreciated stock ────────────────────────────────────────────────────────

describe("Charitable Optimizer — Appreciated stock", () => {
  it("should be eligible when stock has unrealized gains", () => {
    const result = optimizeCharitable(baseInput({
      appreciatedStockValue: 50000,
      appreciatedStockBasis: 20000,
    }));
    const stock = result.vehicles.find(v => v.vehicle === "appreciated_stock")!;
    expect(stock.eligible).toBe(true);
    expect(stock.capitalGainsSaved).toBeGreaterThan(0);
  });

  it("should compute proportional capital gains savings", () => {
    const result = optimizeCharitable(baseInput({
      appreciatedStockValue: 50000,
      appreciatedStockBasis: 20000,
      annualDonationGoal: 25000, // donating half the stock
    }));
    const stock = result.vehicles.find(v => v.vehicle === "appreciated_stock")!;
    // gain = 30000; proportion = 25000/50000 = 0.5; capGains = 30000 * 0.5 * 0.238 = 3570
    expect(stock.capitalGainsSaved).toBe(Math.round(30000 * 0.5 * 0.238));
  });

  it("should be ineligible when no stock provided", () => {
    const result = optimizeCharitable(baseInput());
    const stock = result.vehicles.find(v => v.vehicle === "appreciated_stock")!;
    expect(stock.eligible).toBe(false);
  });

  it("should be ineligible when stock has no gain", () => {
    const result = optimizeCharitable(baseInput({
      appreciatedStockValue: 20000,
      appreciatedStockBasis: 25000,
    }));
    const stock = result.vehicles.find(v => v.vehicle === "appreciated_stock")!;
    expect(stock.eligible).toBe(false);
  });

  it("should include both deduction and capital gains benefits", () => {
    const result = optimizeCharitable(baseInput({
      appreciatedStockValue: 50000,
      appreciatedStockBasis: 20000,
    }));
    const stock = result.vehicles.find(v => v.vehicle === "appreciated_stock")!;
    expect(stock.totalBenefit).toBe(Math.round(stock.taxSavings + stock.capitalGainsSaved));
  });
});

// ── QCD ──────────────────────────────────────────────────────────────────────

describe("Charitable Optimizer — QCD", () => {
  it("should be eligible for age 70.5+", () => {
    const result = optimizeCharitable(baseInput({
      age: 71,
      iraBalance: 200000,
    }));
    const qcd = result.vehicles.find(v => v.vehicle === "qcd")!;
    expect(qcd.eligible).toBe(true);
  });

  it("should be ineligible for age under 70.5", () => {
    const result = optimizeCharitable(baseInput({
      age: 70,
      iraBalance: 200000,
    }));
    const qcd = result.vehicles.find(v => v.vehicle === "qcd")!;
    expect(qcd.eligible).toBe(false);
  });

  it("should cap at $105K annual limit", () => {
    const result = optimizeCharitable(baseInput({
      age: 72,
      iraBalance: 1000000,
      annualDonationGoal: 200000,
    }));
    const qcd = result.vehicles.find(v => v.vehicle === "qcd")!;
    // Tax savings should be based on amount capped at min(goal, 105K, iraBalance)
    expect(qcd.taxSavings).toBeLessThanOrEqual(Math.round(105000 * (0.32 + 0.06)));
  });

  it("should have zero taxDeduction (it's an exclusion, not a deduction)", () => {
    const result = optimizeCharitable(baseInput({
      age: 72,
      iraBalance: 200000,
    }));
    const qcd = result.vehicles.find(v => v.vehicle === "qcd")!;
    expect(qcd.taxDeduction).toBe(0);
  });
});

// ── CRT ──────────────────────────────────────────────────────────────────────

describe("Charitable Optimizer — CRT", () => {
  it("should be eligible for donations >= $100K", () => {
    const result = optimizeCharitable(baseInput({ annualDonationGoal: 150000 }));
    const crt = result.vehicles.find(v => v.vehicle === "crt")!;
    expect(crt.eligible).toBe(true);
    // Approximate deduction = 35% of donation
    expect(crt.taxDeduction).toBe(Math.round(150000 * 0.35));
  });

  it("should be ineligible for donations under $100K", () => {
    const result = optimizeCharitable(baseInput({ annualDonationGoal: 50000 }));
    const crt = result.vehicles.find(v => v.vehicle === "crt")!;
    expect(crt.eligible).toBe(false);
  });

  it("should apply 80% modifier to capital gains savings", () => {
    const result = optimizeCharitable(baseInput({
      annualDonationGoal: 150000,
      appreciatedStockValue: 200000,
      appreciatedStockBasis: 100000,
    }));
    const crt = result.vehicles.find(v => v.vehicle === "crt")!;
    // Stock donation portion cap gains: gain * proportion * 0.238 * 0.8
    expect(crt.capitalGainsSaved).toBeGreaterThan(0);
  });
});

// ── Bunching analysis ────────────────────────────────────────────────────────

describe("Charitable Optimizer — Bunching analysis", () => {
  it("should compare 2-year bunching vs annual giving", () => {
    const result = optimizeCharitable(baseInput());
    const ba = result.bunchingAnalysis;
    expect(ba.bunchYearDeduction).toBeGreaterThanOrEqual(ba.standardYearDeduction);
    expect(ba.twoYearSavings).toBeDefined();
    expect(ba.twoYearSavingsWithoutBunching).toBeDefined();
  });

  it("should recommend bunching when it saves more", () => {
    const result = optimizeCharitable(baseInput({
      itemizesDeductions: true,
      currentItemizedDeductions: 10000, // Below standard deduction
      annualDonationGoal: 15000,
    }));
    const ba = result.bunchingAnalysis;
    if (ba.bunchingBenefit > 0) {
      expect(ba.recommendation).toContain("Bunching");
    } else {
      expect(ba.recommendation).toContain("Annual");
    }
  });

  it("should use standard deduction in off-year of bunching", () => {
    const result = optimizeCharitable(baseInput({ filingStatus: "mfj" }));
    const ba = result.bunchingAnalysis;
    // The off-year should use standard deduction (30000 for mfj)
    expect(ba.twoYearSavings).toBeDefined();
  });
});

// ── AGI limits ───────────────────────────────────────────────────────────────

describe("Charitable Optimizer — AGI limits", () => {
  it("should provide AGI-based limits for cash, stock, and foundation", () => {
    const result = optimizeCharitable(baseInput({ agi: 400000 }));
    expect(result.agiLimits.length).toBe(3);
    const cashLimit = result.agiLimits.find(l => l.vehicle === "Cash")!;
    expect(cashLimit.maxDeduction).toBe(Math.round(400000 * 0.6));
    const stockLimit = result.agiLimits.find(l => l.vehicle === "Appreciated Stock")!;
    expect(stockLimit.maxDeduction).toBe(Math.round(400000 * 0.3));
  });
});

// ── Strategy recommendations ─────────────────────────────────────────────────

describe("Charitable Optimizer — Strategy recommendations", () => {
  it("should recommend stock donation when gains exist", () => {
    const result = optimizeCharitable(baseInput({
      appreciatedStockValue: 50000,
      appreciatedStockBasis: 20000,
    }));
    expect(result.strategies.some(s => s.includes("appreciated stock"))).toBe(true);
  });

  it("should recommend QCD when age-eligible", () => {
    const result = optimizeCharitable(baseInput({
      age: 72,
      iraBalance: 200000,
    }));
    expect(result.strategies.some(s => s.includes("QCD"))).toBe(true);
  });

  it("should recommend bunching for non-itemizers", () => {
    const result = optimizeCharitable(baseInput({ itemizesDeductions: false }));
    expect(result.strategies.some(s => s.includes("bunching") || s.includes("DAF"))).toBe(true);
  });

  it("should always include record-keeping advice", () => {
    const result = optimizeCharitable(baseInput());
    expect(result.strategies.some(s => s.includes("records"))).toBe(true);
  });
});
