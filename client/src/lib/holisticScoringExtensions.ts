/**
 * holisticScoringExtensions.ts — Pillar groupings, scenario engine,
 * and forward/back trajectory projection.
 *
 * Extends the core holisticScoring.ts engine with:
 * - Plan / Protect / Grow pillar roll-ups (matching v7 HTML structure)
 * - What-If scenario presets and comparison
 * - Multi-year forward projection (wealth trajectory)
 *
 * Pure TypeScript — no React, no side effects, fully testable.
 */

import type { FinancialProfile } from "@/hooks/useFinancialProfile";
import {
  type DomainId,
  type DomainScore,
  type HolisticResult,
  computeHolisticScore,
} from "./holisticScoring";

// Re-export core types for convenience
export type { DomainId, DomainScore, HolisticResult };

// ─── Pillar Groupings (v7 HTML structure) ────────────────────────

export type PillarId = "plan" | "protect" | "grow";

export interface PillarSummary {
  id: PillarId;
  label: string;
  icon: string;
  domains: DomainScore[];
  score: number; // 0-100
  raw: number;
  max: number;
  accent: string;
}

export const PILLAR_MAP: Record<DomainId, PillarId> = {
  cashFlow: "plan",
  retirement: "plan",
  tax: "plan",
  education: "plan",
  protection: "protect",
  estate: "protect",
  growth: "grow",
};

export function groupByPillar(domains: DomainScore[]): PillarSummary[] {
  const groups: Record<PillarId, DomainScore[]> = { plan: [], protect: [], grow: [] };
  for (const d of domains) {
    const pillar = PILLAR_MAP[d.id];
    groups[pillar].push(d);
  }

  const pillarMeta: Record<PillarId, { label: string; icon: string; accent: string }> = {
    plan: { label: "Plan", icon: "Target", accent: "text-amber-400" },
    protect: { label: "Protect", icon: "Shield", accent: "text-blue-400" },
    grow: { label: "Grow", icon: "TrendingUp", accent: "text-emerald-400" },
  };

  return (["plan", "protect", "grow"] as PillarId[]).map(id => {
    const ds = groups[id];
    const scored = ds.filter(d => d.score > 0);
    const raw = scored.reduce((s, d) => s + d.score, 0);
    const max = scored.length * 3;
    return {
      id,
      ...pillarMeta[id],
      domains: ds,
      score: max > 0 ? Math.round((raw / max) * 100) : 0,
      raw,
      max,
    };
  });
}

// ─── Scenario / What-If Engine ───────────────────────────────────

export interface ScenarioOverride {
  returnRate?: number;     // e.g. 0.03 for market crash
  inflationRate?: number;  // e.g. 0.08 for inflation spike
  monthlySavings?: number; // e.g. 0 for job loss
  incomeGrowth?: number;   // e.g. 0 for practice disruption
}

export interface ScenarioPreset {
  id: string;
  label: string;
  description: string;
  overrides: ScenarioOverride;
  color: string;
}

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: "baseline",
    label: "Baseline",
    description: "Current assumptions \u2014 7% return, 3% inflation",
    overrides: {},
    color: "text-emerald-400",
  },
  {
    id: "market_crash",
    label: "Market Crash",
    description: "Prolonged bear market \u2014 3% return",
    overrides: { returnRate: 0.03 },
    color: "text-red-400",
  },
  {
    id: "inflation_spike",
    label: "Inflation Spike",
    description: "Sustained high inflation \u2014 8%",
    overrides: { inflationRate: 0.08 },
    color: "text-orange-400",
  },
  {
    id: "job_loss",
    label: "Job Loss",
    description: "No savings contributions for 2+ years",
    overrides: { monthlySavings: 0 },
    color: "text-yellow-400",
  },
  {
    id: "practice_disruption",
    label: "Practice Disruption",
    description: "Business income growth halts, no recruits",
    overrides: { incomeGrowth: 0, monthlySavings: 0 },
    color: "text-rose-500",
  },
  {
    id: "optimistic",
    label: "Optimistic",
    description: "Strong market \u2014 10% return, 2% inflation",
    overrides: { returnRate: 0.10, inflationRate: 0.02 },
    color: "text-sky-400",
  },
];

export function applyScenario(
  profile: FinancialProfile,
  overrides: ScenarioOverride,
): FinancialProfile {
  const p = { ...profile };
  if (overrides.returnRate !== undefined) {
    p.equitiesReturn = overrides.returnRate;
    // Also adjust portfolio growth expectations
    if (p.expectedReturn !== undefined) p.expectedReturn = overrides.returnRate;
  }
  if (overrides.inflationRate !== undefined) {
    p.inflationRate = overrides.inflationRate;
    // Adjust real return expectations
    if (p.expectedInflation !== undefined) p.expectedInflation = overrides.inflationRate;
  }
  if (overrides.monthlySavings !== undefined) {
    p.monthlyContribution = overrides.monthlySavings;
    p.monthlySavings = overrides.monthlySavings;
  }
  if (overrides.incomeGrowth !== undefined) {
    p.incomeGrowthRate = overrides.incomeGrowth;
    // If income growth is zero, reduce projected income for scoring
    if (overrides.incomeGrowth === 0 && p.annualIncome) {
      p.projectedIncome = p.annualIncome; // no growth
    }
  }
  return p;
}

export interface ScenarioResult {
  preset: ScenarioPreset;
  result: HolisticResult;
  delta: number; // composite score change vs baseline
}

export function runScenarioComparison(
  profile: FinancialProfile,
  presets?: ScenarioPreset[],
): ScenarioResult[] {
  const baseline = computeHolisticScore(profile);
  const scenarios = presets ?? SCENARIO_PRESETS;

  return scenarios.map(preset => {
    const adjusted = applyScenario(profile, preset.overrides);
    const result = computeHolisticScore(adjusted);
    return {
      preset,
      result,
      delta: result.compositeScore - baseline.compositeScore,
    };
  });
}

// ─── Forward/Back Projection (multi-year trajectory) ─────────────

export interface YearProjection {
  year: number;
  age: number;
  netWorth: number;
  portfolioBalance: number;
  annualIncome: number;
  retirementIncome: number;
  compositeScore: number;
  protectionGap: number;
  taxBurden: number;
}

function n(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return fallback;
}

/**
 * Project multiple scenario trajectories for overlay comparison.
 * Returns an array of { preset, trajectory } for each scenario.
 */
export interface ScenarioTrajectory {
  preset: ScenarioPreset;
  trajectory: YearProjection[];
}

export function projectScenarioTrajectories(
  profile: FinancialProfile,
  years: number = 30,
  presets?: ScenarioPreset[],
): ScenarioTrajectory[] {
  const scenarios = presets ?? SCENARIO_PRESETS;
  return scenarios.map(preset => ({
    preset,
    trajectory: projectTrajectory(profile, years, preset.overrides),
  }));
}

/**
 * Cross-calculator recommendations based on which calculator was just run.
 * Returns suggested next calculators with reasoning.
 */
export interface CrossCalcRecommendation {
  calcId: string;
  label: string;
  reason: string;
  priority: number; // 1=high, 2=medium, 3=low
}

export const CROSS_CALC_MAP: Record<string, CrossCalcRecommendation[]> = {
  tax: [
    { calcId: "charitable", label: "Charitable Giving", reason: "Optimize deductions to reduce your tax burden", priority: 1 },
    { calcId: "hsa", label: "HSA Optimizer", reason: "Triple tax advantage reduces taxable income", priority: 1 },
    { calcId: "ret", label: "Retirement", reason: "Pre-tax contributions lower current tax liability", priority: 2 },
  ],
  ret: [
    { calcId: "ss", label: "Social Security", reason: "Claiming strategy affects retirement income", priority: 1 },
    { calcId: "medicare", label: "Medicare", reason: "Healthcare costs are a major retirement expense", priority: 1 },
    { calcId: "montecarlo", label: "Monte Carlo", reason: "Test your retirement plan against 1,000 market scenarios", priority: 2 },
  ],
  iul: [
    { calcId: "pf", label: "Premium Finance", reason: "Leverage analysis for larger IUL policies", priority: 1 },
    { calcId: "tax", label: "Tax Projector", reason: "See the tax-free growth impact on your overall plan", priority: 2 },
    { calcId: "stress", label: "Stress Test", reason: "Test IUL cash value against market downturns", priority: 2 },
  ],
  pf: [
    { calcId: "iul", label: "IUL Projection", reason: "Compare financed vs self-funded IUL scenarios", priority: 1 },
    { calcId: "stress", label: "Stress Test", reason: "Validate leverage strategy under market stress", priority: 1 },
  ],
  ss: [
    { calcId: "ret", label: "Retirement", reason: "Integrate SS income into your retirement projection", priority: 1 },
    { calcId: "medicare", label: "Medicare", reason: "Coordinate Medicare enrollment with SS claiming", priority: 1 },
    { calcId: "tax", label: "Tax Projector", reason: "SS benefits may be taxable — see the impact", priority: 2 },
  ],
  medicare: [
    { calcId: "hsa", label: "HSA Optimizer", reason: "HSA funds can cover Medicare premiums tax-free", priority: 1 },
    { calcId: "ss", label: "Social Security", reason: "MAGI affects Medicare IRMAA surcharges", priority: 2 },
  ],
  hsa: [
    { calcId: "tax", label: "Tax Projector", reason: "See how HSA contributions reduce your tax bill", priority: 1 },
    { calcId: "medicare", label: "Medicare", reason: "Plan HSA usage for Medicare premiums in retirement", priority: 2 },
  ],
  charitable: [
    { calcId: "tax", label: "Tax Projector", reason: "See the net tax impact of your giving strategy", priority: 1 },
    { calcId: "iul", label: "IUL Projection", reason: "Consider charitable IUL strategies", priority: 3 },
  ],
  divorce: [
    { calcId: "tax", label: "Tax Projector", reason: "Filing status change affects your tax bracket", priority: 1 },
    { calcId: "ret", label: "Retirement", reason: "Recalculate retirement with divided assets", priority: 1 },
    { calcId: "ss", label: "Social Security", reason: "Divorced spouse benefits may apply", priority: 2 },
  ],
  education: [
    { calcId: "tax", label: "Tax Projector", reason: "Education credits and 529 deductions", priority: 2 },
    { calcId: "ret", label: "Retirement", reason: "Balance education funding with retirement savings", priority: 2 },
  ],
  stress: [
    { calcId: "montecarlo", label: "Monte Carlo", reason: "Probabilistic analysis complements historical backtesting", priority: 1 },
    { calcId: "ret", label: "Retirement", reason: "Adjust your plan based on stress test results", priority: 2 },
  ],
  montecarlo: [
    { calcId: "stress", label: "Stress Test", reason: "See how specific historical crises would have affected you", priority: 1 },
    { calcId: "ret", label: "Retirement", reason: "Use probability insights to refine your plan", priority: 2 },
  ],
};

export function getCrossCalcRecommendations(calcId: string): CrossCalcRecommendation[] {
  return CROSS_CALC_MAP[calcId] ?? [];
}

/**
 * Peer benchmark ranges by age bracket and income tier.
 * Returns { low, median, high } composite scores for context.
 */
export interface PeerBenchmark {
  ageRange: string;
  incomeRange: string;
  low: number;
  median: number;
  high: number;
}

export function getPeerBenchmark(age: number, income: number): PeerBenchmark {
  // Simplified benchmark model based on typical financial health distributions
  const ageRange = age < 30 ? "25-29" : age < 40 ? "30-39" : age < 50 ? "40-49" : age < 60 ? "50-59" : "60+";
  const incomeRange = income < 75000 ? "<$75K" : income < 150000 ? "$75K-$150K" : income < 300000 ? "$150K-$300K" : income < 500000 ? "$300K-$500K" : "$500K+";

  // Base scores shift with age (older = more time to build) and income (higher = more resources)
  const ageBonus = age < 30 ? 0 : age < 40 ? 5 : age < 50 ? 10 : age < 60 ? 12 : 8;
  const incomeBonus = income < 75000 ? 0 : income < 150000 ? 5 : income < 300000 ? 10 : income < 500000 ? 15 : 18;
  const base = 30 + ageBonus + incomeBonus;

  return {
    ageRange,
    incomeRange,
    low: Math.min(base - 10, 20),
    median: Math.min(base, 85),
    high: Math.min(base + 15, 95),
  };
}

export function projectTrajectory(
  profile: FinancialProfile,
  years: number = 30,
  overrides?: ScenarioOverride,
): YearProjection[] {
  const age = n(profile.currentAge ?? profile.age, 35);
  const income = n(profile.annualIncome ?? profile.income);
  const savings = n(profile.portfolioBalance ?? profile.savings);
  const monthly = n(profile.monthlyContribution ?? profile.monthlySavings);
  const returnRate = overrides?.returnRate ?? n(profile.equitiesReturn, 0.07);
  const inflRate = overrides?.inflationRate ?? 0.03;
  const incGrowth = overrides?.incomeGrowth ?? 0.03;
  const effectiveMonthly = overrides?.monthlySavings ?? monthly;

  const retAge = n(profile.retirementAge, 65);
  const ssEstimate = n(profile.estimatedSSBenefit, income * 0.25);
  const mortgage = n(profile.mortgageBalance ?? profile.mortgage);
  const debts = n(profile.otherDebts ?? profile.debts);
  const existingIns = n(profile.existingLifeInsurance ?? profile.lifeInsuranceCoverage);
  const dependents = n(profile.childrenCount ?? profile.dependents);

  const trajectory: YearProjection[] = [];
  let bal = savings;
  let curIncome = income;
  let curMortgage = mortgage;
  let curDebts = debts;

  // Limit to reasonable range to avoid performance issues
  const maxYears = Math.min(years, 50);

  for (let y = 0; y <= maxYears; y++) {
    const curAge = age + y;
    const isRetired = curAge >= retAge;

    // Income projection
    if (y > 0 && !isRetired) curIncome = Math.round(curIncome * (1 + incGrowth));
    if (isRetired && y === retAge - age) curIncome = Math.round(ssEstimate + bal * 0.04);

    // Portfolio growth
    if (y > 0) {
      const contrib = isRetired ? -(bal * 0.04) : effectiveMonthly * 12;
      bal = (bal + contrib) * (1 + returnRate);
    }

    // Debt paydown (simplified)
    if (y > 0) {
      curMortgage = Math.max(0, curMortgage - curMortgage * 0.05);
      curDebts = Math.max(0, curDebts - curDebts * 0.15);
    }

    const netWorth = Math.round(bal - curMortgage - curDebts);

    // Protection gap
    const incYrs = curAge < 40 ? 12 : curAge < 55 ? 10 : 6;
    const dimeNeed = curMortgage + curDebts + (curIncome * 0.8 * incYrs) + (dependents * 100000) + 25000;
    const protGap = Math.max(0, dimeNeed - existingIns);

    // Tax burden (simplified)
    const taxBurden = Math.round(
      curIncome * (curIncome > 500000 ? 0.37 : curIncome > 200000 ? 0.32 : curIncome > 100000 ? 0.24 : 0.22),
    );

    // Retirement income
    const retIncome = isRetired ? Math.round(ssEstimate + bal * 0.04) : 0;

    // Quick composite score (only compute every 5 years for performance)
    let compositeScore = 0;
    if (y % 5 === 0 || y === 0 || y === maxYears) {
      const tempProfile: FinancialProfile = {
        ...profile,
        currentAge: curAge,
        age: curAge,
        annualIncome: Math.round(curIncome),
        income: Math.round(curIncome),
        portfolioBalance: Math.round(bal),
        savings: Math.round(bal),
        monthlyContribution: isRetired ? 0 : effectiveMonthly,
        monthlySavings: isRetired ? 0 : effectiveMonthly,
        mortgageBalance: Math.round(curMortgage),
        mortgage: Math.round(curMortgage),
        otherDebts: Math.round(curDebts),
        debts: Math.round(curDebts),
        netWorth,
      };
      const score = computeHolisticScore(tempProfile);
      compositeScore = score.compositeScore;
    } else if (trajectory.length > 0) {
      compositeScore = trajectory[trajectory.length - 1].compositeScore;
    }

    trajectory.push({
      year: y,
      age: curAge,
      netWorth,
      portfolioBalance: Math.round(bal),
      annualIncome: Math.round(curIncome),
      retirementIncome: retIncome,
      compositeScore,
      protectionGap: protGap,
      taxBurden,
    });
  }

  return trajectory;
}
