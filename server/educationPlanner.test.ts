/**
 * Education Planner — Pure-function unit tests
 * Tests planEducation covering: cost projection, vehicle comparisons,
 * funding gap, monthly savings needed, and strategy recommendations.
 */
import { describe, expect, it } from "vitest";
import { planEducation, type EducationPlanInput } from "./educationPlanner";

function baseInput(overrides: Partial<EducationPlanInput> = {}): EducationPlanInput {
  return {
    childAge: 5,
    targetAge: 18,
    annualCostToday: 30000,
    yearsOfSchool: 4,
    currentSavings: 10000,
    monthlyContribution: 500,
    marginalTaxRate: 0.24,
    stateTaxRate: 0.05,
    ...overrides,
  };
}

// ── Cost projection ──────────────────────────────────────────────────────────

describe("Education Planner — Cost projection", () => {
  it("should project future costs with education inflation", () => {
    const result = planEducation(baseInput());
    expect(result.totalProjectedCost).toBeGreaterThan(0);
    // 4 years of school
    expect(result.costByYear.length).toBe(4);
  });

  it("should apply 5% default education inflation", () => {
    const result = planEducation(baseInput({ childAge: 5, targetAge: 18, annualCostToday: 30000 }));
    // Year 1 cost: 30000 * (1.05)^13 ≈ 56,278
    const year1Cost = result.costByYear[0].cost;
    expect(year1Cost).toBeGreaterThan(30000); // Inflation increases cost
    expect(year1Cost).toBeCloseTo(30000 * Math.pow(1.05, 13), -2);
  });

  it("should respect custom inflation rate", () => {
    const low = planEducation(baseInput({ inflationRate: 0.03 }));
    const high = planEducation(baseInput({ inflationRate: 0.08 }));
    expect(high.totalProjectedCost).toBeGreaterThan(low.totalProjectedCost);
  });

  it("should have correct age for each school year", () => {
    const result = planEducation(baseInput({ targetAge: 18, yearsOfSchool: 4 }));
    expect(result.costByYear[0].age).toBe(18);
    expect(result.costByYear[1].age).toBe(19);
    expect(result.costByYear[2].age).toBe(20);
    expect(result.costByYear[3].age).toBe(21);
  });

  it("should handle zero years to college (child already at target age)", () => {
    const result = planEducation(baseInput({ childAge: 18, targetAge: 18 }));
    expect(result.totalProjectedCost).toBeGreaterThan(0);
    // Year 1 cost should be close to today's cost (no inflation years)
    expect(result.costByYear[0].cost).toBeCloseTo(30000, -1);
  });
});

// ── Vehicle comparisons ──────────────────────────────────────────────────────

describe("Education Planner — Vehicle comparisons", () => {
  it("should generate exactly 5 vehicle comparisons", () => {
    const result = planEducation(baseInput());
    expect(result.vehicles.length).toBe(5);
    const types = result.vehicles.map(v => v.vehicle);
    expect(types).toContain("529");
    expect(types).toContain("coverdell");
    expect(types).toContain("utma");
    expect(types).toContain("roth_ira");
    expect(types).toContain("taxable");
  });

  it("should select best vehicle by highest balance + tax savings", () => {
    const result = planEducation(baseInput());
    const best = result.vehicles.find(v => v.vehicle === result.bestVehicle)!;
    for (const v of result.vehicles) {
      expect(best.projectedBalance + best.taxSavings).toBeGreaterThanOrEqual(
        v.projectedBalance + v.taxSavings
      );
    }
  });

  it("should have 529 as the typical best vehicle for most scenarios", () => {
    const result = planEducation(baseInput({ state529Deduction: true }));
    // 529 usually wins due to tax-free growth + state deduction
    expect(result.bestVehicle).toBe("529");
  });

  it("should show all vehicles with positive projected balances", () => {
    const result = planEducation(baseInput());
    for (const v of result.vehicles) {
      expect(v.projectedBalance).toBeGreaterThan(0);
    }
  });
});

// ── 529 Plan specifics ───────────────────────────────────────────────────────

describe("Education Planner — 529 Plan", () => {
  it("should project tax-free growth (no tax drag)", () => {
    const result = planEducation(baseInput());
    const plan529 = result.vehicles.find(v => v.vehicle === "529")!;
    const taxable = result.vehicles.find(v => v.vehicle === "taxable")!;
    // 529 has no tax drag, taxable has 15% drag → 529 should grow more
    expect(plan529.projectedBalance).toBeGreaterThan(taxable.projectedBalance);
  });

  it("should include state deduction when available", () => {
    const withDeduction = planEducation(baseInput({ state529Deduction: true, state529DeductionMax: 10000 }));
    const withoutDeduction = planEducation(baseInput({ state529Deduction: false }));
    const with529 = withDeduction.vehicles.find(v => v.vehicle === "529")!;
    const without529 = withoutDeduction.vehicles.find(v => v.vehicle === "529")!;
    expect(with529.taxSavings).toBeGreaterThan(without529.taxSavings);
  });

  it("should have no annual contribution limit (null)", () => {
    const result = planEducation(baseInput());
    const plan529 = result.vehicles.find(v => v.vehicle === "529")!;
    expect(plan529.annualContributionLimit).toBeNull();
  });
});

// ── Coverdell ESA specifics ──────────────────────────────────────────────────

describe("Education Planner — Coverdell ESA", () => {
  it("should cap monthly contributions at $2000/year ($166.67/mo)", () => {
    const result = planEducation(baseInput({ monthlyContribution: 1000 }));
    const coverdell = result.vehicles.find(v => v.vehicle === "coverdell")!;
    // Balance should be less than 529 due to contribution cap
    const plan529 = result.vehicles.find(v => v.vehicle === "529")!;
    expect(coverdell.projectedBalance).toBeLessThanOrEqual(plan529.projectedBalance);
  });

  it("should have $2000 annual limit", () => {
    const result = planEducation(baseInput());
    const coverdell = result.vehicles.find(v => v.vehicle === "coverdell")!;
    expect(coverdell.annualContributionLimit).toBe(2000);
  });
});

// ── Roth IRA specifics ───────────────────────────────────────────────────────

describe("Education Planner — Roth IRA", () => {
  it("should cap monthly contributions at $7000/year (~$583/mo)", () => {
    const result = planEducation(baseInput({ monthlyContribution: 1000 }));
    const roth = result.vehicles.find(v => v.vehicle === "roth_ira")!;
    const plan529 = result.vehicles.find(v => v.vehicle === "529")!;
    // Roth capped at ~583/mo vs 529 at full 1000/mo
    expect(roth.projectedBalance).toBeLessThan(plan529.projectedBalance);
  });

  it("should have $7000 annual limit", () => {
    const result = planEducation(baseInput());
    const roth = result.vehicles.find(v => v.vehicle === "roth_ira")!;
    expect(roth.annualContributionLimit).toBe(7000);
  });
});

// ── UTMA/Taxable specifics ───────────────────────────────────────────────────

describe("Education Planner — UTMA and Taxable", () => {
  it("should apply 15% kiddie tax drag to UTMA", () => {
    const result = planEducation(baseInput());
    const utma = result.vehicles.find(v => v.vehicle === "utma")!;
    const plan529 = result.vehicles.find(v => v.vehicle === "529")!;
    // Tax drag should reduce UTMA balance vs 529
    expect(utma.projectedBalance).toBeLessThan(plan529.projectedBalance);
  });

  it("should apply 15% tax drag to taxable brokerage", () => {
    const result = planEducation(baseInput());
    const taxable = result.vehicles.find(v => v.vehicle === "taxable")!;
    const plan529 = result.vehicles.find(v => v.vehicle === "529")!;
    expect(taxable.projectedBalance).toBeLessThan(plan529.projectedBalance);
  });

  it("should show negative tax savings for UTMA (tax cost)", () => {
    const result = planEducation(baseInput());
    const utma = result.vehicles.find(v => v.vehicle === "utma")!;
    expect(utma.taxSavings).toBeLessThanOrEqual(0);
  });

  it("should show zero tax savings for taxable brokerage", () => {
    const result = planEducation(baseInput());
    const taxable = result.vehicles.find(v => v.vehicle === "taxable")!;
    expect(taxable.taxSavings).toBe(0);
  });

  it("should have no contribution limits for UTMA and taxable", () => {
    const result = planEducation(baseInput());
    const utma = result.vehicles.find(v => v.vehicle === "utma")!;
    const taxable = result.vehicles.find(v => v.vehicle === "taxable")!;
    expect(utma.annualContributionLimit).toBeNull();
    expect(taxable.annualContributionLimit).toBeNull();
  });
});

// ── Funding gap ──────────────────────────────────────────────────────────────

describe("Education Planner — Funding gap", () => {
  it("should compute non-negative funding gap", () => {
    const result = planEducation(baseInput());
    expect(result.fundingGap).toBeGreaterThanOrEqual(0);
  });

  it("should have zero gap when savings exceed projected cost", () => {
    const result = planEducation(baseInput({
      currentSavings: 1000000,
      monthlyContribution: 5000,
    }));
    expect(result.fundingGap).toBe(0);
  });

  it("should have larger gap with lower contributions", () => {
    const low = planEducation(baseInput({ monthlyContribution: 100 }));
    const high = planEducation(baseInput({ monthlyContribution: 1000 }));
    expect(low.fundingGap).toBeGreaterThanOrEqual(high.fundingGap);
  });
});

// ── Monthly savings needed ───────────────────────────────────────────────────

describe("Education Planner — Monthly savings needed", () => {
  it("should calculate positive monthly savings when gap exists", () => {
    const result = planEducation(baseInput({ currentSavings: 0, monthlyContribution: 100 }));
    expect(result.monthlyNeeded).toBeGreaterThan(0);
  });

  it("should require more monthly savings for shorter time horizons", () => {
    const long = planEducation(baseInput({ childAge: 3, targetAge: 18 }));
    const short = planEducation(baseInput({ childAge: 14, targetAge: 18 }));
    expect(short.monthlyNeeded).toBeGreaterThan(long.monthlyNeeded);
  });
});

// ── Strategy recommendations ─────────────────────────────────────────────────

describe("Education Planner — Strategies", () => {
  it("should always recommend 529 first", () => {
    const result = planEducation(baseInput());
    expect(result.strategies[0]).toContain("529");
  });

  it("should include superfunding tip", () => {
    const result = planEducation(baseInput());
    expect(result.strategies.some(s => s.includes("superfunding"))).toBe(true);
  });

  it("should recommend conservative allocation for short timelines", () => {
    const result = planEducation(baseInput({ childAge: 14, targetAge: 18 }));
    expect(result.strategies.some(s => s.includes("conservative"))).toBe(true);
  });

  it("should recommend aggressive allocation for long timelines", () => {
    const result = planEducation(baseInput({ childAge: 3, targetAge: 18 }));
    expect(result.strategies.some(s => s.includes("aggressive"))).toBe(true);
  });

  it("should recommend compound growth for young children", () => {
    const result = planEducation(baseInput({ childAge: 3 }));
    expect(result.strategies.some(s => s.includes("compound"))).toBe(true);
  });

  it("should include scholarship advice", () => {
    const result = planEducation(baseInput());
    expect(result.strategies.some(s => s.includes("scholarships"))).toBe(true);
  });
});

// ── Edge cases ───────────────────────────────────────────────────────────────

describe("Education Planner — Edge cases", () => {
  it("should handle zero current savings", () => {
    const result = planEducation(baseInput({ currentSavings: 0 }));
    expect(result.vehicles.length).toBe(5);
    expect(result.totalProjectedCost).toBeGreaterThan(0);
  });

  it("should handle zero monthly contribution", () => {
    const result = planEducation(baseInput({ monthlyContribution: 0 }));
    expect(result.vehicles.length).toBe(5);
    // Balance comes only from current savings growth
    for (const v of result.vehicles) {
      expect(v.projectedBalance).toBeGreaterThanOrEqual(0);
    }
  });

  it("should handle custom return rate", () => {
    const low = planEducation(baseInput({ investmentReturn: 0.03 }));
    const high = planEducation(baseInput({ investmentReturn: 0.10 }));
    const low529 = low.vehicles.find(v => v.vehicle === "529")!;
    const high529 = high.vehicles.find(v => v.vehicle === "529")!;
    expect(high529.projectedBalance).toBeGreaterThan(low529.projectedBalance);
  });

  it("should handle 2-year program", () => {
    const result = planEducation(baseInput({ yearsOfSchool: 2 }));
    expect(result.costByYear.length).toBe(2);
    expect(result.totalProjectedCost).toBeGreaterThan(0);
  });
});
