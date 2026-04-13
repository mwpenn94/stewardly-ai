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
  if (overrides.returnRate !== undefined) p.equitiesReturn = overrides.returnRate;
  if (overrides.monthlySavings !== undefined) {
    p.monthlyContribution = overrides.monthlySavings;
    p.monthlySavings = overrides.monthlySavings;
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
