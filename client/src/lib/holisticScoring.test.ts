import { describe, it, expect } from "vitest";
import {
  computeHolisticScore,
  interpRate,
  estPrem,
  fmt,
  pct,
  scoreLabel,
  RATES,
  scoreCashFlow,
  scoreProtection,
  scoreGrowth,
  scoreRetirement,
  scoreTax,
  scoreEstate,
  scoreEducation,
} from "./holisticScoring";
import type { FinancialProfile } from "@/hooks/useFinancialProfile";

// ─── Helpers ──────────────────────────────────────────────────────

function makeProfile(overrides: Partial<FinancialProfile> = {}): FinancialProfile {
  return {
    age: 40,
    currentAge: 40,
    annualIncome: 150000,
    income: 150000,
    portfolioBalance: 250000,
    savings: 250000,
    monthlyContribution: 2000,
    monthlySavings: 2000,
    mortgageBalance: 300000,
    mortgage: 300000,
    otherDebts: 20000,
    debts: 20000,
    childrenCount: 2,
    dependents: 2,
    retirementAge: 65,
    desiredRetirementIncome: 120000,
    estimatedSSBenefit: 30000,
    marginalRate: 0.24,
    existingLifeInsurance: 500000,
    lifeInsuranceCoverage: 500000,
    netWorth: 500000,
    isBizOwner: false,
    stateOfResidence: "CA",
    ...overrides,
  } as FinancialProfile;
}

// ─── interpRate ───────────────────────────────────────────────────

describe("interpRate", () => {
  it("returns first rate when age is below table minimum", () => {
    expect(interpRate(RATES.termPer100K, 15)).toBe(31);
  });

  it("returns last rate when age exceeds table maximum", () => {
    expect(interpRate(RATES.termPer100K, 80)).toBe(1557);
  });

  it("returns exact rate when age matches a table entry", () => {
    expect(interpRate(RATES.termPer100K, 30)).toBe(35);
  });

  it("interpolates between two entries", () => {
    const rate = interpRate(RATES.termPer100K, 32);
    expect(rate).toBeGreaterThan(35);
    expect(rate).toBeLessThan(42);
  });
});

// ─── estPrem ──────────────────────────────────────────────────────

describe("estPrem", () => {
  it("returns 0 for zero amount", () => {
    expect(estPrem("term", 40, 0)).toBe(0);
  });

  it("estimates term premium correctly", () => {
    const prem = estPrem("term", 40, 1000000);
    expect(prem).toBeGreaterThan(400);
    expect(prem).toBeLessThan(700);
  });

  it("estimates IUL premium correctly", () => {
    const prem = estPrem("iul", 40, 500000);
    expect(prem).toBeGreaterThan(3000);
    expect(prem).toBeLessThan(8000);
  });

  it("estimates DI premium correctly", () => {
    const prem = estPrem("di", 40, 90000);
    expect(prem).toBeGreaterThan(1500);
    expect(prem).toBeLessThan(4000);
  });

  it("returns 0 for unknown type", () => {
    expect(estPrem("unknown", 40, 100000)).toBe(0);
  });
});

// ─── fmt / pct / scoreLabel ───────────────────────────────────────

describe("formatting helpers", () => {
  it("formats currency", () => {
    expect(fmt(1234567)).toBe("$1,234,567");
  });

  it("formats percentage", () => {
    expect(pct(0.156)).toBe("15.6%");
  });

  it("returns correct score labels", () => {
    expect(scoreLabel(3)).toBe("Strong");
    expect(scoreLabel(2)).toBe("Needs Work");
    expect(scoreLabel(1)).toBe("Critical");
    expect(scoreLabel(0)).toBe("Not Scored");
  });
});

// ─── Domain Scoring ───────────────────────────────────────────────

describe("scoreCashFlow", () => {
  it("scores 3 for high savings rate", () => {
    const p = makeProfile({ monthlyContribution: 3000, monthlySavings: 3000 });
    const result = scoreCashFlow(p);
    expect(result.score).toBe(3);
    expect(result.id).toBe("cashFlow");
    expect(result.metrics.length).toBeGreaterThan(0);
  });

  it("scores 1 for low savings rate", () => {
    const p = makeProfile({ monthlyContribution: 500, monthlySavings: 500 });
    const result = scoreCashFlow(p);
    expect(result.score).toBe(1);
  });

  it("scores 0 for no income", () => {
    const p = makeProfile({ annualIncome: 0, income: 0 });
    const result = scoreCashFlow(p);
    expect(result.score).toBe(0);
  });
});

describe("scoreProtection", () => {
  it("scores 3 when fully covered", () => {
    const p = makeProfile({ existingLifeInsurance: 5000000, lifeInsuranceCoverage: 5000000, hasDisability: true });
    const result = scoreProtection(p);
    expect(result.score).toBe(3);
  });

  it("scores 1 for large gap", () => {
    const p = makeProfile({ existingLifeInsurance: 0, lifeInsuranceCoverage: 0 });
    const result = scoreProtection(p);
    expect(result.score).toBe(1);
  });

  it("includes DIME need metric", () => {
    const p = makeProfile();
    const result = scoreProtection(p);
    expect(result.metrics.some(m => m.name === "DIME Need")).toBe(true);
  });
});

describe("scoreGrowth", () => {
  it("scores based on projected vs target", () => {
    const p = makeProfile({ portfolioBalance: 1000000, savings: 1000000, monthlyContribution: 5000, monthlySavings: 5000 });
    const result = scoreGrowth(p);
    expect(result.score).toBeGreaterThanOrEqual(2);
    expect(result.metrics.some(m => m.name === "% of Target")).toBe(true);
  });

  it("includes years to retirement", () => {
    const p = makeProfile();
    const result = scoreGrowth(p);
    expect(result.metrics.some(m => m.name === "Years to Retirement")).toBe(true);
  });
});

describe("scoreRetirement", () => {
  it("scores 3 for well-funded retirement", () => {
    const p = makeProfile({ portfolioBalance: 3000000, savings: 3000000, monthlyContribution: 5000, monthlySavings: 5000, estimatedSSBenefit: 40000 });
    const result = scoreRetirement(p);
    expect(result.score).toBe(3);
  });

  it("includes income replacement metric", () => {
    const p = makeProfile();
    const result = scoreRetirement(p);
    expect(result.metrics.some(m => m.name === "Income Replacement")).toBe(true);
  });
});

describe("scoreTax", () => {
  it("scores based on tax optimization", () => {
    const p = makeProfile({ retirementContributions: 23500, hsaContributions: 4300, itemizedDeductions: 20000 });
    const result = scoreTax(p);
    expect(result.score).toBeGreaterThanOrEqual(2);
  });

  it("includes marginal rate metric", () => {
    const p = makeProfile();
    const result = scoreTax(p);
    expect(result.metrics.some(m => m.name === "Marginal Rate")).toBe(true);
  });
});

describe("scoreEstate", () => {
  it("scores 3 for plan in place with no tax exposure", () => {
    const p = makeProfile({ estateGoal: "wealth_transfer", netWorth: 500000 } as any);
    const result = scoreEstate(p);
    expect(result.score).toBe(3);
  });

  it("scores 1 for no plan with dependents", () => {
    const p = makeProfile({ childrenCount: 2, dependents: 2 });
    const result = scoreEstate(p);
    expect(result.score).toBe(1);
  });
});

describe("scoreEducation", () => {
  it("scores 0 for no dependents", () => {
    const p = makeProfile({ childrenCount: 0, dependents: 0 });
    const result = scoreEducation(p);
    expect(result.score).toBe(0);
  });

  it("scores for dependents with education gap", () => {
    const p = makeProfile({ childrenCount: 2, dependents: 2 });
    const result = scoreEducation(p);
    expect(result.score).toBeGreaterThan(0);
    expect(result.metrics.some(m => m.name === "Education Gap")).toBe(true);
  });
});

// ─── Master Function ──────────────────────────────────────────────

describe("computeHolisticScore", () => {
  it("returns all 7 domains for profile with dependents", () => {
    const p = makeProfile();
    const result = computeHolisticScore(p);
    expect(result.domains.length).toBe(7);
    expect(result.compositeScore).toBeGreaterThan(0);
    expect(result.compositeScore).toBeLessThanOrEqual(100);
  });

  it("returns 6 domains for profile without dependents", () => {
    const p = makeProfile({ childrenCount: 0, dependents: 0 });
    const result = computeHolisticScore(p);
    expect(result.domains.length).toBe(6);
  });

  it("generates recommended products", () => {
    const p = makeProfile();
    const result = computeHolisticScore(p);
    expect(result.products.length).toBeGreaterThan(0);
    expect(result.products[0]).toHaveProperty("product");
    expect(result.products[0]).toHaveProperty("estPremium");
  });

  it("generates cost-benefit summary", () => {
    const p = makeProfile();
    const result = computeHolisticScore(p);
    expect(result.costBenefit.annualPlanningCost).toBeGreaterThan(0);
    expect(result.costBenefit.totalBenefitValue).toBeGreaterThan(0);
    expect(result.costBenefit.roiRatio).toBeGreaterThan(0);
  });

  it("generates action items sorted by priority", () => {
    const p = makeProfile();
    const result = computeHolisticScore(p);
    expect(result.actions.length).toBeGreaterThan(0);
    // Check sorted by priority
    for (let i = 1; i < result.actions.length; i++) {
      expect(result.actions[i].priority).toBeGreaterThanOrEqual(result.actions[i - 1].priority);
    }
  });

  it("calculates profile completeness", () => {
    const p = makeProfile();
    const result = computeHolisticScore(p);
    expect(result.profileCompleteness).toBeGreaterThan(0);
    expect(result.profileCompleteness).toBeLessThanOrEqual(1);
  });

  it("returns stage label based on age", () => {
    expect(computeHolisticScore(makeProfile({ currentAge: 25, age: 25 })).stageLabel).toBe("Early Career");
    expect(computeHolisticScore(makeProfile({ currentAge: 35, age: 35 })).stageLabel).toBe("Building Phase");
    expect(computeHolisticScore(makeProfile({ currentAge: 45, age: 45 })).stageLabel).toBe("Peak Earning");
    expect(computeHolisticScore(makeProfile({ currentAge: 55, age: 55 })).stageLabel).toBe("Pre-Retirement");
    expect(computeHolisticScore(makeProfile({ currentAge: 65, age: 65 })).stageLabel).toBe("Transition");
    expect(computeHolisticScore(makeProfile({ currentAge: 75, age: 75 })).stageLabel).toBe("Distribution");
  });

  it("handles empty profile gracefully", () => {
    const result = computeHolisticScore({} as FinancialProfile);
    expect(result.compositeScore).toBe(0);
    expect(result.domains.length).toBe(6); // no dependents
    expect(result.profileCompleteness).toBe(0);
  });

  it("includes deep dive URLs for all domains", () => {
    const p = makeProfile();
    const result = computeHolisticScore(p);
    for (const d of result.domains) {
      expect(d.deepDiveUrl).toBeTruthy();
      expect(d.deepDiveUrl.startsWith("/")).toBe(true);
    }
  });
});
