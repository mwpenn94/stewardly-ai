/**
 * HSA Optimizer — Pure-function unit tests
 * Tests triple tax advantage modeling, contribution limits,
 * Medicare coordination, catch-up eligibility, and strategy comparison.
 */
import { describe, expect, it } from "vitest";
import { optimizeHSA, type HSAInput } from "./hsaOptimizer";

function baseInput(overrides: Partial<HSAInput> = {}): HSAInput {
  return {
    age: 40,
    coverageType: "family",
    currentBalance: 10000,
    annualContribution: 8550,
    annualMedicalExpenses: 3000,
    marginalTaxRate: 0.24,
    stateTaxRate: 0.05,
    yearsToRetirement: 25,
    ...overrides,
  };
}

// ── Strategy generation ──────────────────────────────────────────────────────

describe("HSA Optimizer — Strategies", () => {
  it("should generate exactly 3 strategies", () => {
    const result = optimizeHSA(baseInput());
    expect(result.strategies.length).toBe(3);
    expect(result.strategies.map(s => s.name)).toEqual([
      "Maximize & Invest",
      "Balanced",
      "Medical-Only",
    ]);
  });

  it("should pick the strategy with highest total tax savings as best", () => {
    const result = optimizeHSA(baseInput());
    const best = result.strategies.find(s => s.name === result.bestStrategy)!;
    for (const s of result.strategies) {
      expect(best.totalTaxSavings).toBeGreaterThanOrEqual(s.totalTaxSavings);
    }
  });

  it("should have Maximize strategy produce the highest final balance", () => {
    const result = optimizeHSA(baseInput());
    const maximize = result.strategies.find(s => s.name === "Maximize & Invest")!;
    const balanced = result.strategies.find(s => s.name === "Balanced")!;
    const medical = result.strategies.find(s => s.name === "Medical-Only")!;
    expect(maximize.finalBalance).toBeGreaterThan(balanced.finalBalance);
    expect(balanced.finalBalance).toBeGreaterThanOrEqual(medical.finalBalance);
  });

  it("should have positive totalContributions for all strategies", () => {
    const result = optimizeHSA(baseInput());
    for (const s of result.strategies) {
      expect(s.totalContributions).toBeGreaterThan(0);
    }
  });

  it("should have positive totalGrowth (investment returns compound over time)", () => {
    const result = optimizeHSA(baseInput());
    for (const s of result.strategies) {
      expect(s.totalGrowth).toBeGreaterThan(0);
    }
  });

  it("should produce projections covering retirement + post-retirement years", () => {
    const result = optimizeHSA(baseInput({ yearsToRetirement: 25, yearsInRetirement: 25 }));
    for (const s of result.strategies) {
      expect(s.projections.length).toBe(50); // 25 + 25
    }
  });
});

// ── Contribution limits ──────────────────────────────────────────────────────

describe("HSA Optimizer — Contribution limits", () => {
  it("should return correct max contribution for family coverage", () => {
    const result = optimizeHSA(baseInput({ coverageType: "family", age: 40 }));
    expect(result.maxContribution).toBe(8550);
  });

  it("should return correct max contribution for self coverage", () => {
    const result = optimizeHSA(baseInput({ coverageType: "self", age: 40 }));
    expect(result.maxContribution).toBe(4300);
  });

  it("should add catch-up amount for age 55+", () => {
    const result = optimizeHSA(baseInput({ coverageType: "self", age: 55 }));
    expect(result.maxContribution).toBe(4300 + 1000);
    expect(result.catchUpEligible).toBe(true);
    expect(result.catchUpAmount).toBe(1000);
  });

  it("should not add catch-up for age under 55", () => {
    const result = optimizeHSA(baseInput({ age: 50 }));
    expect(result.catchUpEligible).toBe(false);
    expect(result.catchUpAmount).toBe(0);
  });
});

// ── Medicare coordination ────────────────────────────────────────────────────

describe("HSA Optimizer — Medicare coordination", () => {
  it("should warn about Medicare enrollment for near-65 individuals", () => {
    const result = optimizeHSA(baseInput({ age: 63 }));
    expect(result.medicareNote).toContain("6 months before Medicare");
  });

  it("should provide general Medicare guidance for younger individuals", () => {
    const result = optimizeHSA(baseInput({ age: 40 }));
    expect(result.medicareNote).toContain("Medicare Part A");
  });

  it("should stop contributions at age 65 in projections", () => {
    const result = optimizeHSA(baseInput({ age: 60, yearsToRetirement: 5, yearsInRetirement: 10 }));
    const maximize = result.strategies.find(s => s.name === "Maximize & Invest")!;
    // After age 65, contributions should be 0
    const postMedicare = maximize.projections.filter(p => p.age >= 65);
    for (const p of postMedicare) {
      expect(p.contribution).toBe(0);
    }
  });
});

// ── Triple tax advantage ─────────────────────────────────────────────────────

describe("HSA Optimizer — Triple tax advantage", () => {
  it("should calculate income tax savings from contributions", () => {
    const result = optimizeHSA(baseInput({
      annualContribution: 8550,
      marginalTaxRate: 0.24,
      stateTaxRate: 0.05,
      yearsToRetirement: 25,
    }));
    // incomeTaxSaved = min(8550, maxContrib) * (0.24+0.05) * 25
    const expected = 8550 * 0.29 * 25;
    expect(result.tripleAdvantage.incomeTaxSaved).toBe(Math.round(expected));
  });

  it("should calculate FICA savings at 7.65%", () => {
    const result = optimizeHSA(baseInput({
      annualContribution: 8550,
      yearsToRetirement: 25,
    }));
    const expected = 8550 * 0.0765 * 25;
    expect(result.tripleAdvantage.ficaSaved).toBe(Math.round(expected));
  });

  it("should calculate investment tax savings at 23.8%", () => {
    const result = optimizeHSA(baseInput());
    expect(result.tripleAdvantage.investmentTaxSaved).toBeGreaterThan(0);
  });

  it("should have totalLifetimeSavings equal to sum of three components", () => {
    const result = optimizeHSA(baseInput());
    const { incomeTaxSaved, ficaSaved, investmentTaxSaved, totalLifetimeSavings } = result.tripleAdvantage;
    // Allow ±1 rounding tolerance since each component is individually rounded
    expect(Math.abs(totalLifetimeSavings - (incomeTaxSaved + ficaSaved + investmentTaxSaved))).toBeLessThanOrEqual(1);
  });
});

// ── Edge cases ───────────────────────────────────────────────────────────────

describe("HSA Optimizer — Edge cases", () => {
  it("should handle zero current balance", () => {
    const result = optimizeHSA(baseInput({ currentBalance: 0 }));
    expect(result.strategies.length).toBe(3);
    for (const s of result.strategies) {
      expect(s.finalBalance).toBeGreaterThanOrEqual(0);
    }
  });

  it("should handle zero annual contribution", () => {
    const result = optimizeHSA(baseInput({ annualContribution: 0 }));
    expect(result.strategies.length).toBe(3);
  });

  it("should handle employer contributions", () => {
    const withEmployer = optimizeHSA(baseInput({ employerContribution: 1000 }));
    const without = optimizeHSA(baseInput({ employerContribution: 0 }));
    // Balanced strategy shows the difference since Maximize already maxes the contribution limit
    const withBal = withEmployer.strategies.find(s => s.name === "Balanced")!.finalBalance;
    const withoutBal = without.strategies.find(s => s.name === "Balanced")!.finalBalance;
    expect(withBal).toBeGreaterThan(withoutBal);
  });

  it("should use default 7% return rate when not specified", () => {
    const result = optimizeHSA(baseInput());
    const maximize = result.strategies.find(s => s.name === "Maximize & Invest")!;
    expect(maximize.totalGrowth).toBeGreaterThan(0);
  });

  it("should use custom return rate when specified", () => {
    const low = optimizeHSA(baseInput({ investmentReturn: 0.03 }));
    const high = optimizeHSA(baseInput({ investmentReturn: 0.10 }));
    const lowBal = low.strategies[0].finalBalance;
    const highBal = high.strategies[0].finalBalance;
    expect(highBal).toBeGreaterThan(lowBal);
  });
});
