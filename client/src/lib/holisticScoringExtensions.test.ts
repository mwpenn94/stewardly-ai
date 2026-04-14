import { describe, it, expect } from "vitest";
import {
  groupByPillar,
  PILLAR_MAP,
  SCENARIO_PRESETS,
  applyScenario,
  runScenarioComparison,
  projectTrajectory,
  type PillarId,
  type ScenarioOverride,
} from "./holisticScoringExtensions";
import { computeHolisticScore } from "./holisticScoring";
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
    retirementAge: 65,
    filingStatus: "mfj",
    dependents: 2,
    childrenCount: 2,
    mortgageBalance: 300000,
    mortgage: 300000,
    otherDebts: 15000,
    debts: 15000,
    existingLifeInsurance: 500000,
    lifeInsuranceCoverage: 500000,
    ...overrides,
  } as FinancialProfile;
}

// ─── Pillar Groupings ────────────────────────────────────────────
describe("groupByPillar", () => {
  it("groups all 7 domains into 3 pillars", () => {
    const profile = makeProfile();
    const result = computeHolisticScore(profile);
    const pillars = groupByPillar(result.domains);

    expect(pillars).toHaveLength(3);
    expect(pillars.map(p => p.id)).toEqual(["plan", "protect", "grow"]);
  });

  it("Plan pillar contains cashFlow, retirement, tax, education", () => {
    const profile = makeProfile();
    const result = computeHolisticScore(profile);
    const pillars = groupByPillar(result.domains);
    const plan = pillars.find(p => p.id === "plan")!;

    const domainIds = plan.domains.map(d => d.id);
    expect(domainIds).toContain("cashFlow");
    expect(domainIds).toContain("retirement");
    expect(domainIds).toContain("tax");
    expect(domainIds).toContain("education");
  });

  it("Protect pillar contains protection and estate", () => {
    const profile = makeProfile();
    const result = computeHolisticScore(profile);
    const pillars = groupByPillar(result.domains);
    const protect = pillars.find(p => p.id === "protect")!;

    const domainIds = protect.domains.map(d => d.id);
    expect(domainIds).toContain("protection");
    expect(domainIds).toContain("estate");
  });

  it("Grow pillar contains growth", () => {
    const profile = makeProfile();
    const result = computeHolisticScore(profile);
    const pillars = groupByPillar(result.domains);
    const grow = pillars.find(p => p.id === "grow")!;

    expect(grow.domains.map(d => d.id)).toContain("growth");
  });

  it("pillar scores are between 0 and 100", () => {
    const profile = makeProfile();
    const result = computeHolisticScore(profile);
    const pillars = groupByPillar(result.domains);

    for (const p of pillars) {
      expect(p.score).toBeGreaterThanOrEqual(0);
      expect(p.score).toBeLessThanOrEqual(100);
    }
  });

  it("each pillar has label, icon, and accent color", () => {
    const profile = makeProfile();
    const result = computeHolisticScore(profile);
    const pillars = groupByPillar(result.domains);

    for (const p of pillars) {
      expect(p.label).toBeTruthy();
      expect(p.icon).toBeTruthy();
      expect(p.accent).toBeTruthy();
    }
  });
});

// ─── PILLAR_MAP ──────────────────────────────────────────────────
describe("PILLAR_MAP", () => {
  it("maps all 7 domain IDs to pillars", () => {
    const domainIds = ["cashFlow", "retirement", "tax", "education", "protection", "estate", "growth"];
    for (const id of domainIds) {
      expect(PILLAR_MAP[id as keyof typeof PILLAR_MAP]).toBeDefined();
    }
  });
});

// ─── Scenario Presets ────────────────────────────────────────────
describe("SCENARIO_PRESETS", () => {
  it("contains at least 5 presets", () => {
    expect(SCENARIO_PRESETS.length).toBeGreaterThanOrEqual(5);
  });

  it("includes a baseline preset with no overrides", () => {
    const baseline = SCENARIO_PRESETS.find(p => p.id === "baseline");
    expect(baseline).toBeDefined();
    expect(Object.keys(baseline!.overrides)).toHaveLength(0);
  });

  it("each preset has id, label, description, overrides, color", () => {
    for (const p of SCENARIO_PRESETS) {
      expect(p.id).toBeTruthy();
      expect(p.label).toBeTruthy();
      expect(p.description).toBeTruthy();
      expect(p.overrides).toBeDefined();
      expect(p.color).toBeTruthy();
    }
  });
});

// ─── applyScenario ──────────────────────────────────────────────
describe("applyScenario", () => {
  it("returns a new profile with overrides applied", () => {
    const profile = makeProfile();
    const adjusted = applyScenario(profile, { returnRate: 0.03 });

    expect(adjusted.equitiesReturn).toBe(0.03);
    // Original should not be mutated
    expect(profile.equitiesReturn).toBeUndefined();
  });

  it("applies monthlySavings override to both fields", () => {
    const profile = makeProfile({ monthlyContribution: 2000, monthlySavings: 2000 });
    const adjusted = applyScenario(profile, { monthlySavings: 0 });

    expect(adjusted.monthlyContribution).toBe(0);
    expect(adjusted.monthlySavings).toBe(0);
  });

  it("does not modify fields not in overrides", () => {
    const profile = makeProfile({ annualIncome: 200000 });
    const adjusted = applyScenario(profile, { returnRate: 0.05 });

    expect(adjusted.annualIncome).toBe(200000);
  });

  it("applies inflationRate override", () => {
    const profile = makeProfile();
    const adjusted = applyScenario(profile, { inflationRate: 0.08 });
    expect((adjusted as any).inflationRate).toBe(0.08);
  });

  it("applies incomeGrowth override and caps projectedIncome when zero", () => {
    const profile = makeProfile({ annualIncome: 150000 });
    const adjusted = applyScenario(profile, { incomeGrowth: 0 });
    expect((adjusted as any).incomeGrowthRate).toBe(0);
    expect((adjusted as any).projectedIncome).toBe(150000);
  });
});

// ─── runScenarioComparison ──────────────────────────────────────
describe("runScenarioComparison", () => {
  it("returns results for all presets", () => {
    const profile = makeProfile();
    const results = runScenarioComparison(profile);

    expect(results).toHaveLength(SCENARIO_PRESETS.length);
  });

  it("baseline has delta of 0", () => {
    const profile = makeProfile();
    const results = runScenarioComparison(profile);
    const baseline = results.find(r => r.preset.id === "baseline");

    expect(baseline).toBeDefined();
    expect(baseline!.delta).toBe(0);
  });

  it("each result has preset, result, and delta", () => {
    const profile = makeProfile();
    const results = runScenarioComparison(profile);

    for (const r of results) {
      expect(r.preset).toBeDefined();
      expect(r.result).toBeDefined();
      expect(typeof r.delta).toBe("number");
      expect(r.result.compositeScore).toBeGreaterThanOrEqual(0);
      expect(r.result.compositeScore).toBeLessThanOrEqual(100);
    }
  });

  it("market crash scenario has lower or equal score than baseline", () => {
    const profile = makeProfile();
    const results = runScenarioComparison(profile);
    const baseline = results.find(r => r.preset.id === "baseline")!;
    const crash = results.find(r => r.preset.id === "market_crash")!;

    expect(crash.result.compositeScore).toBeLessThanOrEqual(baseline.result.compositeScore);
  });

  it("accepts custom presets", () => {
    const profile = makeProfile();
    const custom = [SCENARIO_PRESETS[0], SCENARIO_PRESETS[1]];
    const results = runScenarioComparison(profile, custom);

    expect(results).toHaveLength(2);
  });
});

// ─── projectTrajectory ──────────────────────────────────────────
describe("projectTrajectory", () => {
  it("returns correct number of years", () => {
    const profile = makeProfile();
    const traj = projectTrajectory(profile, 20);

    // year 0 through year 20 = 21 entries
    expect(traj).toHaveLength(21);
  });

  it("first entry matches current profile age", () => {
    const profile = makeProfile({ currentAge: 42 });
    const traj = projectTrajectory(profile, 10);

    expect(traj[0].age).toBe(42);
    expect(traj[0].year).toBe(0);
  });

  it("ages increment correctly", () => {
    const profile = makeProfile({ currentAge: 35 });
    const traj = projectTrajectory(profile, 5);

    for (let i = 0; i < traj.length; i++) {
      expect(traj[i].age).toBe(35 + i);
    }
  });

  it("portfolio grows over time for working years", () => {
    const profile = makeProfile({
      currentAge: 35,
      portfolioBalance: 100000,
      monthlyContribution: 2000,
    });
    const traj = projectTrajectory(profile, 10);

    // Portfolio should grow with contributions + returns
    expect(traj[10].portfolioBalance).toBeGreaterThan(traj[0].portfolioBalance);
  });

  it("net worth increases over time for healthy profile", () => {
    const profile = makeProfile({
      currentAge: 35,
      portfolioBalance: 200000,
      monthlyContribution: 3000,
      mortgageBalance: 200000,
      otherDebts: 10000,
    });
    const traj = projectTrajectory(profile, 20);

    expect(traj[20].netWorth).toBeGreaterThan(traj[0].netWorth);
  });

  it("respects scenario overrides", () => {
    const profile = makeProfile();
    const baseline = projectTrajectory(profile, 20);
    const crash = projectTrajectory(profile, 20, { returnRate: 0.01 });

    // Crash scenario should have lower portfolio at year 20
    expect(crash[20].portfolioBalance).toBeLessThan(baseline[20].portfolioBalance);
  });

  it("caps at 50 years maximum", () => {
    const profile = makeProfile();
    const traj = projectTrajectory(profile, 100);

    // Should be capped to 51 entries (year 0 through year 50)
    expect(traj).toHaveLength(51);
  });

  it("handles zero savings gracefully", () => {
    const profile = makeProfile({
      monthlyContribution: 0,
      monthlySavings: 0,
      portfolioBalance: 100000,
    });
    const traj = projectTrajectory(profile, 10);

    // Should still produce valid results
    expect(traj).toHaveLength(11);
    for (const t of traj) {
      expect(typeof t.netWorth).toBe("number");
      expect(Number.isFinite(t.netWorth)).toBe(true);
    }
  });

  it("handles missing profile fields gracefully", () => {
    const sparse = {
      age: 30,
      annualIncome: 80000,
    } as FinancialProfile;
    const traj = projectTrajectory(sparse, 5);

    expect(traj).toHaveLength(6);
    expect(traj[0].age).toBe(30);
  });

  it("retirement income appears after retirement age", () => {
    const profile = makeProfile({ currentAge: 60, retirementAge: 65 });
    const traj = projectTrajectory(profile, 10);

    // Before retirement (year 0-4), retirement income should be 0
    expect(traj[0].retirementIncome).toBe(0);
    // After retirement (year 5+), should have retirement income
    expect(traj[6].retirementIncome).toBeGreaterThan(0);
  });
});
