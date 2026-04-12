/**
 * Social Security Optimizer — Pure-function unit tests
 * Tests PIA calculation, FRA lookup, benefit reduction/increase,
 * break-even analysis, NPV, spousal/survivor benefits, and tax estimation.
 */
import { describe, expect, it } from "vitest";
import { optimizeSS, type SSInput, type EarningsRecord } from "./ssOptimizer";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeEarnings(years: number, amount: number): EarningsRecord[] {
  return Array.from({ length: years }, (_, i) => ({ year: 2000 + i, earnings: amount }));
}

function baseInput(overrides: Partial<SSInput> = {}): SSInput {
  return {
    birthYear: 1960,
    birthMonth: 6,
    earningsHistory: makeEarnings(35, 80000),
    filingStatus: "single",
    lifeExpectancy: 85,
    discountRate: 0.03,
    ...overrides,
  };
}

// ── PIA calculation ──────────────────────────────────────────────────────────

describe("SS Optimizer — PIA calculation", () => {
  it("should calculate PIA from 35-year earnings history", () => {
    const result = optimizeSS(baseInput());
    expect(result.pia).toBeGreaterThan(0);
    expect(result.pia).toBeLessThan(5000); // Reasonable monthly PIA range
  });

  it("should use estimatedPIA when provided and skip earnings calculation", () => {
    const result = optimizeSS(baseInput({ estimatedPIA: 2500 }));
    expect(result.pia).toBe(2500);
  });

  it("should handle fewer than 35 years of earnings (zeros fill in)", () => {
    const result = optimizeSS(baseInput({ earningsHistory: makeEarnings(20, 100000) }));
    expect(result.pia).toBeGreaterThan(0);
    // PIA should be lower than someone with 35 full years at same earnings
    const fullResult = optimizeSS(baseInput({ earningsHistory: makeEarnings(35, 100000) }));
    expect(result.pia).toBeLessThan(fullResult.pia);
  });

  it("should produce higher PIA for higher earners", () => {
    const lowEarner = optimizeSS(baseInput({ earningsHistory: makeEarnings(35, 40000) }));
    const highEarner = optimizeSS(baseInput({ earningsHistory: makeEarnings(35, 150000) }));
    expect(highEarner.pia).toBeGreaterThan(lowEarner.pia);
  });

  it("should use top 35 years when more are provided", () => {
    const history = [
      ...makeEarnings(30, 100000),
      ...Array.from({ length: 10 }, (_, i) => ({ year: 1970 + i, earnings: 10000 })),
    ];
    const result = optimizeSS(baseInput({ earningsHistory: history }));
    // Should still produce a reasonable PIA using the top 35 years
    expect(result.pia).toBeGreaterThan(0);
  });
});

// ── FRA (Full Retirement Age) ────────────────────────────────────────────────

describe("SS Optimizer — FRA determination", () => {
  it("should return FRA 65 for birth year 1937", () => {
    const result = optimizeSS(baseInput({ birthYear: 1937, estimatedPIA: 2000 }));
    expect(result.fra).toBe(65);
  });

  it("should return FRA 66 for birth years 1943-1954", () => {
    for (const year of [1943, 1950, 1954]) {
      const result = optimizeSS(baseInput({ birthYear: year, estimatedPIA: 2000 }));
      expect(result.fra).toBe(66);
    }
  });

  it("should return FRA 67 for birth year 1960+", () => {
    const result = optimizeSS(baseInput({ birthYear: 1960, estimatedPIA: 2000 }));
    expect(result.fra).toBe(67);
  });

  it("should return transitional FRA for birth years 1955-1959", () => {
    const result1955 = optimizeSS(baseInput({ birthYear: 1955, estimatedPIA: 2000 }));
    const result1959 = optimizeSS(baseInput({ birthYear: 1959, estimatedPIA: 2000 }));
    expect(result1955.fra).toBeGreaterThan(66);
    expect(result1955.fra).toBeLessThan(67);
    expect(result1959.fra).toBeGreaterThan(result1955.fra);
  });
});

// ── Claiming scenarios (ages 62-70) ──────────────────────────────────────────

describe("SS Optimizer — Claiming scenarios", () => {
  it("should generate exactly 9 scenarios (ages 62 through 70)", () => {
    const result = optimizeSS(baseInput({ estimatedPIA: 2000 }));
    expect(result.scenarios.length).toBe(9);
    expect(result.scenarios[0].claimingAge).toBe(62);
    expect(result.scenarios[8].claimingAge).toBe(70);
  });

  it("should reduce benefits for early claiming (before FRA)", () => {
    const result = optimizeSS(baseInput({ birthYear: 1960, estimatedPIA: 2000 }));
    const at62 = result.scenarios.find(s => s.claimingAge === 62)!;
    expect(at62.monthlyBenefit).toBeLessThan(2000);
    expect(at62.reductionOrIncrease).toMatch(/^-/);
  });

  it("should increase benefits for delayed claiming (after FRA)", () => {
    const result = optimizeSS(baseInput({ birthYear: 1960, estimatedPIA: 2000 }));
    const at70 = result.scenarios.find(s => s.claimingAge === 70)!;
    expect(at70.monthlyBenefit).toBeGreaterThan(2000);
    expect(at70.reductionOrIncrease).toMatch(/^\+/);
  });

  it("should have benefit equal to PIA at FRA", () => {
    // FRA=67 for 1960
    const result = optimizeSS(baseInput({ birthYear: 1960, estimatedPIA: 2000 }));
    const atFRA = result.scenarios.find(s => s.claimingAge === 67)!;
    expect(atFRA.monthlyBenefit).toBe(2000);
    expect(atFRA.reductionOrIncrease).toBe("+0.0%");
  });

  it("should apply correct early reduction for claiming at 62 with FRA 67", () => {
    // 60 months early: first 36 months at 5/900, remaining 24 at 5/1200
    // Reduction = 36*(5/900) + 24*(5/1200) = 0.2 + 0.1 = 0.3 → 30% reduction
    const result = optimizeSS(baseInput({ birthYear: 1960, estimatedPIA: 2000 }));
    const at62 = result.scenarios.find(s => s.claimingAge === 62)!;
    expect(at62.monthlyBenefit).toBeCloseTo(2000 * 0.70, 0);
  });

  it("should apply correct delayed credits for claiming at 70 with FRA 67", () => {
    // 36 months delayed at 2/300 per month = 36 * 2/300 = 0.24 → 24% increase
    const result = optimizeSS(baseInput({ birthYear: 1960, estimatedPIA: 2000 }));
    const at70 = result.scenarios.find(s => s.claimingAge === 70)!;
    expect(at70.monthlyBenefit).toBeCloseTo(2000 * 1.24, 0);
  });

  it("should produce monotonically increasing monthly benefits from 62 to 70", () => {
    const result = optimizeSS(baseInput({ estimatedPIA: 2000 }));
    for (let i = 1; i < result.scenarios.length; i++) {
      expect(result.scenarios[i].monthlyBenefit).toBeGreaterThan(result.scenarios[i - 1].monthlyBenefit);
    }
  });

  it("should have annualBenefit = monthlyBenefit * 12", () => {
    const result = optimizeSS(baseInput({ estimatedPIA: 2000 }));
    for (const s of result.scenarios) {
      expect(s.annualBenefit).toBeCloseTo(s.monthlyBenefit * 12, 0);
    }
  });
});

// ── Cumulative and break-even ────────────────────────────────────────────────

describe("SS Optimizer — Cumulative benefits and break-even", () => {
  it("should calculate cumulative by 80/85/90", () => {
    const result = optimizeSS(baseInput({ estimatedPIA: 2000 }));
    const at62 = result.scenarios.find(s => s.claimingAge === 62)!;
    // 18 years of benefits by age 80
    expect(at62.cumulativeBy80).toBe(Math.round(at62.annualBenefit * 18));
    expect(at62.cumulativeBy85).toBe(Math.round(at62.annualBenefit * 23));
    expect(at62.cumulativeBy90).toBe(Math.round(at62.annualBenefit * 28));
  });

  it("should show higher cumulative at 80 for age 62 vs age 70 (early wins short-term)", () => {
    const result = optimizeSS(baseInput({ estimatedPIA: 2000 }));
    const at62 = result.scenarios.find(s => s.claimingAge === 62)!;
    const at70 = result.scenarios.find(s => s.claimingAge === 70)!;
    expect(at62.cumulativeBy80).toBeGreaterThan(at70.cumulativeBy80);
  });

  it("should show higher cumulative at 90 for age 70 vs age 62 (delayed wins long-term)", () => {
    const result = optimizeSS(baseInput({ estimatedPIA: 2000 }));
    const at62 = result.scenarios.find(s => s.claimingAge === 62)!;
    const at70 = result.scenarios.find(s => s.claimingAge === 70)!;
    expect(at70.cumulativeBy90).toBeGreaterThan(at62.cumulativeBy90);
  });

  it("should have null break-even for claiming at 62 (reference age)", () => {
    const result = optimizeSS(baseInput({ estimatedPIA: 2000 }));
    const at62 = result.scenarios.find(s => s.claimingAge === 62)!;
    expect(at62.breakEvenVs62).toBeNull();
  });

  it("should have a break-even age for later claiming vs 62", () => {
    const result = optimizeSS(baseInput({ estimatedPIA: 2000 }));
    const at70 = result.scenarios.find(s => s.claimingAge === 70)!;
    expect(at70.breakEvenVs62).not.toBeNull();
    expect(at70.breakEvenVs62!).toBeGreaterThan(70);
    expect(at70.breakEvenVs62!).toBeLessThan(100);
  });
});

// ── NPV analysis ─────────────────────────────────────────────────────────────

describe("SS Optimizer — NPV analysis", () => {
  it("should calculate positive NPV for all scenarios", () => {
    const result = optimizeSS(baseInput({ estimatedPIA: 2000 }));
    for (const s of result.scenarios) {
      expect(s.npv).toBeGreaterThan(0);
    }
  });

  it("should select optimal age by highest NPV", () => {
    const result = optimizeSS(baseInput({ estimatedPIA: 2000 }));
    const optimalScenario = result.scenarios.find(s => s.claimingAge === result.optimalAge)!;
    for (const s of result.scenarios) {
      expect(optimalScenario.npv).toBeGreaterThanOrEqual(s.npv);
    }
  });

  it("should favor later claiming with longer life expectancy", () => {
    const shortLife = optimizeSS(baseInput({ estimatedPIA: 2000, lifeExpectancy: 72 }));
    const longLife = optimizeSS(baseInput({ estimatedPIA: 2000, lifeExpectancy: 95 }));
    expect(longLife.optimalAge).toBeGreaterThanOrEqual(shortLife.optimalAge);
  });

  it("should include optimalReason describing NPV", () => {
    const result = optimizeSS(baseInput({ estimatedPIA: 2000 }));
    expect(result.optimalReason).toContain("NPV");
    expect(result.optimalReason).toContain(String(result.optimalAge));
  });
});

// ── Spousal and survivor benefits ────────────────────────────────────────────

describe("SS Optimizer — Spousal and survivor benefits", () => {
  it("should calculate spousal benefit for married filer", () => {
    const result = optimizeSS(baseInput({
      estimatedPIA: 3000,
      filingStatus: "married",
      spousePIA: 500,
      spouseBirthYear: 1960,
    }));
    // Spousal = max(0, primaryPIA * 0.5 - spousePIA) = max(0, 1500 - 500) = 1000
    expect(result.spousalBenefit).toBe(1000);
  });

  it("should return 0 spousal benefit when spouse PIA exceeds 50%", () => {
    const result = optimizeSS(baseInput({
      estimatedPIA: 2000,
      filingStatus: "married",
      spousePIA: 1500,
      spouseBirthYear: 1960,
    }));
    // max(0, 1000 - 1500) = 0
    expect(result.spousalBenefit).toBe(0);
  });

  it("should calculate survivor benefit as max of both PIAs", () => {
    const result = optimizeSS(baseInput({
      estimatedPIA: 3000,
      filingStatus: "married",
      spousePIA: 2000,
      spouseBirthYear: 1960,
    }));
    expect(result.survivorBenefit).toBe(3000);
  });

  it("should not include spousal/survivor for single filer", () => {
    const result = optimizeSS(baseInput({ estimatedPIA: 2000, filingStatus: "single" }));
    expect(result.spousalBenefit).toBeUndefined();
    expect(result.survivorBenefit).toBeUndefined();
  });
});

// ── Taxation ─────────────────────────────────────────────────────────────────

describe("SS Optimizer — Taxation estimation", () => {
  it("should estimate 85% taxable for high-PIA beneficiary", () => {
    // PIA * 12 > 34000 → 85%
    const result = optimizeSS(baseInput({ estimatedPIA: 3000 }));
    expect(result.taxablePercentage).toBe(85);
  });

  it("should estimate 50% taxable for mid-PIA beneficiary", () => {
    // PIA * 12 between 25000 and 34000 → 50%
    // Need PIA between ~2084 and ~2833
    const result = optimizeSS(baseInput({ estimatedPIA: 2200 }));
    expect(result.taxablePercentage).toBe(50);
  });

  it("should estimate 0% taxable for low-PIA beneficiary", () => {
    // PIA * 12 < 25000 → 0%
    const result = optimizeSS(baseInput({ estimatedPIA: 1500 }));
    expect(result.taxablePercentage).toBe(0);
  });
});

// ── Recommendations ──────────────────────────────────────────────────────────

describe("SS Optimizer — Recommendations", () => {
  it("should recommend delaying for long life expectancy", () => {
    const result = optimizeSS(baseInput({ estimatedPIA: 2000, lifeExpectancy: 90 }));
    expect(result.recommendations.some(r => r.includes("delaying"))).toBe(true);
  });

  it("should recommend earlier claiming for short life expectancy", () => {
    const result = optimizeSS(baseInput({ estimatedPIA: 2000, lifeExpectancy: 75 }));
    expect(result.recommendations.some(r => r.includes("earlier"))).toBe(true);
  });

  it("should recommend tax-efficient withdrawals when benefits are taxable", () => {
    const result = optimizeSS(baseInput({ estimatedPIA: 3000 }));
    expect(result.recommendations.some(r => r.includes("taxable"))).toBe(true);
  });

  it("should recommend coordinating with spouse when spousal benefit exists", () => {
    const result = optimizeSS(baseInput({
      estimatedPIA: 3000,
      filingStatus: "married",
      spousePIA: 500,
      spouseBirthYear: 1960,
    }));
    expect(result.recommendations.some(r => r.includes("Spousal") || r.includes("coordinate"))).toBe(true);
  });
});
