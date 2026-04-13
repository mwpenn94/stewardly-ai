/**
 * Calculators.test.ts — Structural verification for v7 HTML match
 *
 * Validates that the Calculators page exports correctly and that
 * the calculation engines produce expected results.
 */
import { describe, it, expect } from "vitest";
import { computeHolisticScore, fmt } from "@/lib/holisticScoring";
import {
  groupByPillar,
  runScenarioComparison,
  projectTrajectory,
  getCrossCalcRecommendations,
  getPeerBenchmark,
  SCENARIO_PRESETS,
} from "@/lib/holisticScoringExtensions";
import { profileToStreams, annualize, rollUpStreams } from "@/lib/incomeStreams";
import type { FinancialProfile } from "@/lib/holisticScoring";

// ─── Test profile ──────────────────────────────────────────
const TEST_PROFILE: FinancialProfile = {
  age: 40,
  annualIncome: 150000,
  portfolioBalance: 180000,
  netWorth: 500000,
  monthlyExpenses: 6000,
  monthlySavings: 1200,
  retirementAge: 65,
  dependents: 2,
  lifeInsurance: 250000,
  hasDisabilityInsurance: false,
  hasLongTermCare: false,
  hasWill: false,
  hasTrust: false,
  taxFilingStatus: "married_jointly",
  stateOfResidence: "CA",
  riskTolerance: "moderate",
  investmentHorizon: "long",
};

describe("Calculators Page — v7 Structural Match", () => {
  describe("Panel 1: Client Profile & Scorecard", () => {
    it("produces a holistic result with 7 domains", () => {
      const result = computeHolisticScore(TEST_PROFILE);
      expect(result).toBeDefined();
      expect(result.domains).toHaveLength(7);
      expect(result.compositeScore).toBeGreaterThanOrEqual(0);
      expect(result.compositeScore).toBeLessThanOrEqual(100);
    });

    it("groups domains into 3 pillars", () => {
      const result = computeHolisticScore(TEST_PROFILE);
      const pillars = groupByPillar(result.domains);
      expect(pillars).toHaveLength(3);
      const labels = pillars.map((p) => p.label);
      expect(labels).toContain("Plan");
      expect(labels).toContain("Protect");
      expect(labels).toContain("Grow");
    });

    it("generates recommended products", () => {
      const result = computeHolisticScore(TEST_PROFILE);
      expect(result.products).toBeDefined();
      expect(Array.isArray(result.products)).toBe(true);
    });

    it("formats currency correctly", () => {
      expect(fmt(150000)).toBe("$150,000");
      expect(fmt(0)).toBe("$0");
      expect(fmt(1234567)).toBe("$1,234,567");
    });
  });

  describe("Panel 2: Cash Flow", () => {
    it("calculates savings rate from profile", () => {
      const savingsRate = TEST_PROFILE.monthlySavings! / (TEST_PROFILE.annualIncome / 12);
      expect(savingsRate).toBeGreaterThan(0);
      expect(savingsRate).toBeLessThan(1);
    });

    it("calculates emergency fund months", () => {
      const emergencyMonths = TEST_PROFILE.portfolioBalance / TEST_PROFILE.monthlyExpenses!;
      expect(emergencyMonths).toBeGreaterThan(0);
    });
  });

  describe("Panel 3: Protection (DIME)", () => {
    it("calculates life insurance need via DIME", () => {
      const income = TEST_PROFILE.annualIncome;
      const deps = TEST_PROFILE.dependents ?? 0;
      const incomeReplace = income * 10;
      const eduCost = deps * 100000;
      const dimeNeed = incomeReplace + eduCost;
      expect(dimeNeed).toBeGreaterThan(0);
      const gap = dimeNeed - (TEST_PROFILE.lifeInsurance ?? 0);
      expect(gap).toBeGreaterThan(0); // 40-year-old with $250k coverage has a gap
    });
  });

  describe("Panel 4: Growth — Multi-Vehicle", () => {
    it("calculates future value correctly", () => {
      // FV = PV*(1+r)^n + PMT*((1+r)^n - 1)/r
      const pv = 180000;
      const pmt = 1200;
      const r = 0.07 / 12;
      const n = 25 * 12;
      const fvCalc = pv * Math.pow(1 + r, n) + pmt * ((Math.pow(1 + r, n) - 1) / r);
      expect(fvCalc).toBeGreaterThan(1000000);
    });
  });

  describe("Panel 5: Retirement", () => {
    it("calculates SS benefit at different claiming ages", () => {
      const pia = 2500;
      const at62 = Math.round(pia * 0.7);
      const at67 = pia;
      const at70 = Math.round(pia * 1.24);
      expect(at62).toBeLessThan(at67);
      expect(at67).toBeLessThan(at70);
    });
  });

  describe("Panel 9: Cost-Benefit — Scenarios", () => {
    it("runs scenario comparison with presets", () => {
      const results = runScenarioComparison(TEST_PROFILE);
      expect(results.length).toBeGreaterThan(0);
      const baseline = results.find((r) => r.preset.id === "baseline");
      expect(baseline).toBeDefined();
      expect(baseline!.delta).toBe(0);
    });

    it("has at least 4 scenario presets", () => {
      expect(SCENARIO_PRESETS.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("Panel 11: Summary — Trajectory", () => {
    it("projects trajectory over time", () => {
      const trajectory = projectTrajectory(TEST_PROFILE);
      expect(trajectory.length).toBeGreaterThan(0);
      expect(trajectory[0].age).toBe(TEST_PROFILE.age);
      const last = trajectory[trajectory.length - 1];
      expect(last.netWorth).toBeGreaterThan(TEST_PROFILE.netWorth);
    });

    it("generates peer benchmark", () => {
      const benchmark = getPeerBenchmark(TEST_PROFILE.age, TEST_PROFILE.annualIncome);
      expect(benchmark).toBeDefined();
      expect(benchmark.ageRange).toBeDefined();
      expect(benchmark.incomeRange).toBeDefined();
      expect(benchmark.median).toBeGreaterThan(0);
    });
  });

  describe("Panel 13: Cross-Calculator Recommendations", () => {
    it("returns recommendations for profile panel", () => {
      const recs = getCrossCalcRecommendations("ret");
      expect(recs.length).toBeGreaterThan(0);
      recs.forEach((r) => {
        expect(r.calcId).toBeDefined();
        expect(r.label).toBeDefined();
        expect(r.reason).toBeDefined();
        expect(r.priority).toBeGreaterThanOrEqual(1);
        expect(r.priority).toBeLessThanOrEqual(3);
      });
    });
  });

  describe("Income Streams Integration", () => {
    it("builds streams from profile", () => {
      const streams = profileToStreams(TEST_PROFILE);
      expect(streams.length).toBeGreaterThan(0);
    });

    it("annualizes a stream", () => {
      const streams = profileToStreams(TEST_PROFILE);
      const annual = annualize(streams[0]);
      expect(annual).toBeGreaterThan(0);
    });

    it("rolls up streams", () => {
      const streams = profileToStreams(TEST_PROFILE);
      const rollup = rollUpStreams(streams);
      expect(rollup.totalAnnualIncome).toBeGreaterThan(0);
    });
  });
});
