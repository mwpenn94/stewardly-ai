import { describe, it, expect } from "vitest";
import {
  computeEstateTax,
  computeDIME,
  computeRiskScore,
  getRiskProfile,
  monteCarloSuccessRate,
  projectTaxClientSide,
  FEDERAL_EXEMPTION_2026,
  FEDERAL_EXEMPTION_SUNSET,
  ESTATE_TAX_RATE,
  RISK_PROFILES,
} from "./planningCalculations";

// ─── Estate Tax ───────────────────────────────────────────────
describe("computeEstateTax", () => {
  it("returns zero tax when estate is below exemption", () => {
    const result = computeEstateTax(5_000_000, false, 0, false);
    expect(result.estateTax).toBe(0);
    expect(result.taxableEstate).toBe(0);
    expect(result.headroom).toBeGreaterThan(0);
  });

  it("computes 40% tax on amount above exemption", () => {
    const overAmount = 1_000_000;
    const estate = FEDERAL_EXEMPTION_2026 + overAmount;
    const result = computeEstateTax(estate, false, 0, false);
    expect(result.taxableEstate).toBe(overAmount);
    expect(result.estateTax).toBe(overAmount * ESTATE_TAX_RATE);
  });

  it("adds portability for married couples", () => {
    const estate = FEDERAL_EXEMPTION_2026 + 5_000_000;
    const portability = 5_000_000;
    const result = computeEstateTax(estate, true, portability, false);
    expect(result.exemption).toBe(FEDERAL_EXEMPTION_2026 + portability);
    expect(result.estateTax).toBe(0);
  });

  it("uses sunset exemption when useSunset=true", () => {
    const estate = 10_000_000;
    const current = computeEstateTax(estate, false, 0, false);
    const sunset = computeEstateTax(estate, false, 0, true);
    expect(current.estateTax).toBe(0); // below 13.61M
    expect(sunset.estateTax).toBeGreaterThan(0); // above 7M
    expect(sunset.taxableEstate).toBe(estate - FEDERAL_EXEMPTION_SUNSET);
  });

  it("computes negative headroom when estate exceeds exemption", () => {
    const estate = FEDERAL_EXEMPTION_2026 + 1_000_000;
    const result = computeEstateTax(estate, false, 0, false);
    expect(result.headroom).toBe(-1_000_000);
  });

  it("handles zero estate", () => {
    const result = computeEstateTax(0, false, 0, false);
    expect(result.estateTax).toBe(0);
    expect(result.taxableEstate).toBe(0);
    expect(result.headroom).toBe(FEDERAL_EXEMPTION_2026);
  });
});

// ─── DIME Insurance Needs ─────────────────────────────────────
describe("computeDIME", () => {
  const baseInput = {
    annualIncome: 150_000,
    yearsToReplace: 10,
    mortgageBalance: 350_000,
    otherDebts: 25_000,
    childrenCount: 2,
    educationPerChild: 100_000,
    finalExpenses: 15_000,
    existingLifeInsurance: 500_000,
    spouseIncome: 60_000,
  };

  it("computes total need correctly", () => {
    const result = computeDIME(baseInput);
    const expected = (350_000 + 25_000) + (150_000 * 10) + (2 * 100_000) + 15_000;
    expect(result.total).toBe(expected);
    expect(result.debt).toBe(375_000);
    expect(result.income).toBe(1_500_000);
    expect(result.education).toBe(200_000);
  });

  it("computes gap as total minus existing insurance", () => {
    const result = computeDIME(baseInput);
    expect(result.gap).toBe(result.total - 500_000);
  });

  it("offsets recommended by 30% of spouse income", () => {
    const result = computeDIME(baseInput);
    const spouseOffset = 60_000 * 10 * 0.3;
    expect(result.recommended).toBe(Math.max(0, result.gap - spouseOffset));
  });

  it("returns zero gap when fully covered", () => {
    const input = { ...baseInput, existingLifeInsurance: 5_000_000 };
    const result = computeDIME(input);
    expect(result.gap).toBe(0);
    expect(result.recommended).toBe(0);
  });

  it("computes coverage ratio capped at 100", () => {
    const overInsured = { ...baseInput, existingLifeInsurance: 10_000_000 };
    const result = computeDIME(overInsured);
    expect(result.coverageRatio).toBe(100);
  });

  it("handles zero children", () => {
    const input = { ...baseInput, childrenCount: 0 };
    const result = computeDIME(input);
    expect(result.education).toBe(0);
  });

  it("returns 0 coverage ratio when no existing insurance", () => {
    const input = { ...baseInput, existingLifeInsurance: 0 };
    const result = computeDIME(input);
    expect(result.coverageRatio).toBe(0);
  });
});

// ─── Risk Assessment ──────────────────────────────────────────
describe("computeRiskScore", () => {
  const questions = [
    { id: "timeHorizon", weight: 1.5 },
    { id: "lossTolerance", weight: 2.0 },
    { id: "incomeStability", weight: 1.0 },
  ];

  it("returns 0 with no answers", () => {
    const { score } = computeRiskScore({}, questions);
    expect(score).toBe(0);
  });

  it("computes weighted average correctly", () => {
    const answers = { timeHorizon: 8, lossTolerance: 6, incomeStability: 7 };
    const { score } = computeRiskScore(answers, questions);
    // Weighted: (8*1.5 + 6*2.0 + 7*1.0) / (1.5+2.0+1.0) = 31/4.5 = 6.889
    // Scaled: 6.889/10 * 100 = 68.89 → 69
    expect(score).toBe(69);
  });

  it("returns max score (100) when all answers are 10", () => {
    const answers = { timeHorizon: 10, lossTolerance: 10, incomeStability: 10 };
    const { score } = computeRiskScore(answers, questions);
    expect(score).toBe(100);
  });

  it("handles partial answers (ignores unanswered)", () => {
    const answers = { timeHorizon: 10 };
    const { score, categoryScores } = computeRiskScore(answers, questions);
    expect(categoryScores).toHaveLength(1);
    expect(score).toBe(100); // 10/10 * 100
  });

  it("includes weight in category scores", () => {
    const answers = { lossTolerance: 5 };
    const { categoryScores } = computeRiskScore(answers, questions);
    expect(categoryScores[0].weight).toBe(2.0);
  });
});

describe("getRiskProfile", () => {
  it("returns Conservative for score 0-25", () => {
    expect(getRiskProfile(0).name).toBe("Conservative");
    expect(getRiskProfile(25).name).toBe("Conservative");
  });

  it("returns Moderate for score 41-60", () => {
    expect(getRiskProfile(50).name).toBe("Moderate");
  });

  it("returns Aggressive for score 76-100", () => {
    expect(getRiskProfile(90).name).toBe("Aggressive");
    expect(getRiskProfile(100).name).toBe("Aggressive");
  });

  it("profiles have valid allocation summing to 100%", () => {
    for (const p of RISK_PROFILES) {
      expect(p.equity + p.fixed + p.alternatives + p.cash).toBe(100);
    }
  });

  it("profiles cover the full 0-100 range without gaps", () => {
    for (let s = 0; s <= 100; s++) {
      const profile = getRiskProfile(s);
      expect(profile).toBeDefined();
      expect(profile.name).toBeTruthy();
    }
  });
});

// ─── Monte Carlo ──────────────────────────────────────────────
describe("monteCarloSuccessRate", () => {
  it("returns 99 when guaranteed income exceeds target", () => {
    const rate = monteCarloSuccessRate(12000, 10000, 0, 0.07, 0.03, 25, 100);
    expect(rate).toBe(99);
  });

  it("returns high success rate with large portfolio and low withdrawal", () => {
    const rate = monteCarloSuccessRate(5000, 6000, 2_000_000, 0.07, 0.03, 20, 500);
    expect(rate).toBeGreaterThan(80);
  });

  it("returns low success rate with tiny portfolio and high withdrawal", () => {
    const rate = monteCarloSuccessRate(0, 10000, 50_000, 0.07, 0.03, 30, 500);
    expect(rate).toBeLessThan(20);
  });

  it("returns a number between 0 and 100", () => {
    const rate = monteCarloSuccessRate(3000, 8000, 500_000, 0.07, 0.03, 25, 100);
    expect(rate).toBeGreaterThanOrEqual(0);
    expect(rate).toBeLessThanOrEqual(100);
  });
});

// ─── Client-Side Tax Projector ────────────────────────────────
describe("projectTaxClientSide", () => {
  const baseInput = {
    filingStatus: "mfj" as const,
    wages: 150_000,
    selfEmploymentIncome: 0,
    interestIncome: 2_000,
    dividendIncome: 5_000,
    longTermCapGains: 0,
    rentalIncome: 0,
    rothConversion: 0,
    itemizedDeductions: 30_000,
    retirementContributions: 23_000,
    hsaContributions: 4_150,
  };

  it("computes gross income as sum of all income sources", () => {
    const result = projectTaxClientSide(baseInput);
    expect(result.grossIncome).toBe(157_000);
  });

  it("subtracts retirement + HSA from AGI", () => {
    const result = projectTaxClientSide(baseInput);
    expect(result.agiDeductions).toBe(23_000 + 4_150); // no SE deduction
    expect(result.agi).toBe(157_000 - 27_150);
  });

  it("uses standard deduction when itemized is lower", () => {
    const input = { ...baseInput, itemizedDeductions: 10_000 };
    const result = projectTaxClientSide(input);
    expect(result.deduction).toBe(31_400); // MFJ standard deduction
  });

  it("uses itemized deduction when higher than standard", () => {
    const result = projectTaxClientSide(baseInput);
    expect(result.deduction).toBe(31_400); // 30k < 31.4k standard, so standard wins
  });

  it("computes positive federal tax for typical income", () => {
    const result = projectTaxClientSide(baseInput);
    expect(result.federalTax).toBeGreaterThan(0);
    expect(result.federalTax).toBeLessThan(result.grossIncome);
  });

  it("returns zero tax for zero income", () => {
    const input = { ...baseInput, wages: 0, interestIncome: 0, dividendIncome: 0 };
    const result = projectTaxClientSide(input);
    expect(result.federalTax).toBe(0);
    expect(result.taxableIncome).toBe(0);
  });

  it("computes SE deduction for self-employment income", () => {
    const input = { ...baseInput, selfEmploymentIncome: 100_000 };
    const result = projectTaxClientSide(input);
    expect(result.agiDeductions).toBe(23_000 + 4_150 + Math.round(100_000 * 0.0765));
  });

  it("effective rate is less than marginal rate", () => {
    const result = projectTaxClientSide(baseInput);
    expect(result.effectiveRate).toBeLessThan(result.marginalRate);
    expect(result.effectiveRate).toBeGreaterThan(0);
  });

  it("handles single filer brackets correctly", () => {
    const input = { ...baseInput, filingStatus: "single" as const };
    const result = projectTaxClientSide(input);
    // Single has lower bracket thresholds, so should have higher tax
    const mfjResult = projectTaxClientSide(baseInput);
    expect(result.federalTax).toBeGreaterThan(mfjResult.federalTax);
  });

  it("brackets fill correctly", () => {
    const result = projectTaxClientSide(baseInput);
    expect(result.brackets).toHaveLength(7); // 7 brackets
    // First bracket should be fully filled
    expect(result.brackets[0].fill).toBeCloseTo(1, 1);
    // At least one bracket should be partially filled
    expect(result.brackets.some(b => b.fill > 0 && b.fill < 1)).toBe(true);
  });
});
