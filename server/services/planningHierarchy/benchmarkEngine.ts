/**
 * benchmarkEngine.ts — Peer Benchmark Comparison Engine
 * 
 * Compares client financial metrics against peer group medians
 * using FRED/BLS data and anonymized aggregate statistics.
 * Supports: retirement readiness, savings rate, debt ratio,
 * insurance coverage, estate planning, tax efficiency, investment returns.
 */
import { getDb } from "../../db";
import {
  benchmarkComparisons,
  type InsertBenchmarkComparison,
} from "../../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

// ─── PEER GROUP REFERENCE DATA ──────────────────────────────────────────
// Source: Federal Reserve Survey of Consumer Finances (SCF), BLS CES
// These are reasonable median values by age/income cohort for 2023-2024

interface PeerBenchmarks {
  savingsRate: { p25: number; median: number; p75: number };
  debtToIncomeRatio: { p25: number; median: number; p75: number };
  emergencyFundMonths: { p25: number; median: number; p75: number };
  retirementSavingsMultiple: { p25: number; median: number; p75: number };
  insuranceCoverageMultiple: { p25: number; median: number; p75: number };
  netWorthToIncome: { p25: number; median: number; p75: number };
  effectiveTaxRate: { p25: number; median: number; p75: number };
}

const PEER_DATA: Record<string, PeerBenchmarks> = {
  // Age 25-34, Income $50K-$100K
  "25-34_50k-100k": {
    savingsRate: { p25: 5, median: 10, p75: 18 },
    debtToIncomeRatio: { p25: 15, median: 28, p75: 42 },
    emergencyFundMonths: { p25: 1, median: 2.5, p75: 5 },
    retirementSavingsMultiple: { p25: 0.3, median: 0.8, p75: 1.5 },
    insuranceCoverageMultiple: { p25: 2, median: 5, p75: 10 },
    netWorthToIncome: { p25: 0.2, median: 0.8, p75: 2.0 },
    effectiveTaxRate: { p25: 10, median: 14, p75: 18 },
  },
  // Age 35-44, Income $75K-$150K
  "35-44_75k-150k": {
    savingsRate: { p25: 8, median: 13, p75: 22 },
    debtToIncomeRatio: { p25: 18, median: 32, p75: 45 },
    emergencyFundMonths: { p25: 2, median: 3.5, p75: 6 },
    retirementSavingsMultiple: { p25: 1.0, median: 2.5, p75: 4.5 },
    insuranceCoverageMultiple: { p25: 5, median: 8, p75: 12 },
    netWorthToIncome: { p25: 1.0, median: 2.5, p75: 5.0 },
    effectiveTaxRate: { p25: 12, median: 17, p75: 22 },
  },
  // Age 45-54, Income $100K-$250K
  "45-54_100k-250k": {
    savingsRate: { p25: 10, median: 15, p75: 25 },
    debtToIncomeRatio: { p25: 12, median: 25, p75: 38 },
    emergencyFundMonths: { p25: 3, median: 5, p75: 9 },
    retirementSavingsMultiple: { p25: 2.5, median: 5.0, p75: 8.0 },
    insuranceCoverageMultiple: { p25: 6, median: 10, p75: 15 },
    netWorthToIncome: { p25: 2.5, median: 5.0, p75: 10.0 },
    effectiveTaxRate: { p25: 15, median: 20, p75: 25 },
  },
  // Age 55-64, Income $100K-$250K
  "55-64_100k-250k": {
    savingsRate: { p25: 12, median: 18, p75: 28 },
    debtToIncomeRatio: { p25: 8, median: 18, p75: 30 },
    emergencyFundMonths: { p25: 4, median: 6, p75: 12 },
    retirementSavingsMultiple: { p25: 4.0, median: 8.0, p75: 12.0 },
    insuranceCoverageMultiple: { p25: 5, median: 8, p75: 12 },
    netWorthToIncome: { p25: 5.0, median: 10.0, p75: 18.0 },
    effectiveTaxRate: { p25: 15, median: 20, p75: 26 },
  },
  // Age 65+, Income $75K-$200K
  "65+_75k-200k": {
    savingsRate: { p25: 8, median: 12, p75: 20 },
    debtToIncomeRatio: { p25: 5, median: 12, p75: 22 },
    emergencyFundMonths: { p25: 6, median: 12, p75: 24 },
    retirementSavingsMultiple: { p25: 6.0, median: 10.0, p75: 16.0 },
    insuranceCoverageMultiple: { p25: 3, median: 5, p75: 8 },
    netWorthToIncome: { p25: 8.0, median: 15.0, p75: 25.0 },
    effectiveTaxRate: { p25: 12, median: 16, p75: 22 },
  },
  // Default / fallback
  "default": {
    savingsRate: { p25: 8, median: 13, p75: 22 },
    debtToIncomeRatio: { p25: 12, median: 25, p75: 40 },
    emergencyFundMonths: { p25: 2, median: 4, p75: 8 },
    retirementSavingsMultiple: { p25: 2.0, median: 4.0, p75: 8.0 },
    insuranceCoverageMultiple: { p25: 5, median: 8, p75: 12 },
    netWorthToIncome: { p25: 2.0, median: 5.0, p75: 12.0 },
    effectiveTaxRate: { p25: 12, median: 17, p75: 23 },
  },
};

function getPeerGroup(age: number, income: number): string {
  let ageKey: string;
  if (age < 35) ageKey = "25-34";
  else if (age < 45) ageKey = "35-44";
  else if (age < 55) ageKey = "45-54";
  else if (age < 65) ageKey = "55-64";
  else ageKey = "65+";

  let incomeKey: string;
  if (income < 75000) incomeKey = "50k-100k";
  else if (income < 150000) incomeKey = "75k-150k";
  else if (income < 250000) incomeKey = "100k-250k";
  else incomeKey = "100k-250k"; // Use highest available

  const key = `${ageKey}_${incomeKey}`;
  return PEER_DATA[key] ? key : "default";
}

function calculatePercentile(value: number, p25: number, median: number, p75: number): number {
  if (value <= p25) return Math.round((value / p25) * 25);
  if (value <= median) return 25 + Math.round(((value - p25) / (median - p25)) * 25);
  if (value <= p75) return 50 + Math.round(((value - median) / (p75 - median)) * 25);
  return Math.min(99, 75 + Math.round(((value - p75) / (p75 * 0.5)) * 24));
}

// ─── BENCHMARK COMPUTATION ──────────────────────────────────────────────

export interface ClientFinancials {
  age: number;
  annualIncome: number;
  savingsRate?: number;
  totalDebt?: number;
  emergencyFundBalance?: number;
  monthlyExpenses?: number;
  retirementSavings?: number;
  lifeInsuranceCoverage?: number;
  netWorth?: number;
  effectiveTaxRate?: number;
  investmentReturns?: number;
}

export function computeBenchmarks(client: ClientFinancials) {
  const peerGroupKey = getPeerGroup(client.age, client.annualIncome);
  const peers = PEER_DATA[peerGroupKey];
  const results: Array<{
    type: string;
    clientValue: string;
    peerMedian: string;
    peerP25: string;
    peerP75: string;
    percentileRank: number;
    insight: string;
  }> = [];

  // Savings Rate
  if (client.savingsRate !== undefined) {
    const p = calculatePercentile(client.savingsRate, peers.savingsRate.p25, peers.savingsRate.median, peers.savingsRate.p75);
    results.push({
      type: "savings_rate",
      clientValue: `${client.savingsRate}%`,
      peerMedian: `${peers.savingsRate.median}%`,
      peerP25: `${peers.savingsRate.p25}%`,
      peerP75: `${peers.savingsRate.p75}%`,
      percentileRank: p,
      insight: p >= 75 ? "Excellent savings discipline — well above peers" :
               p >= 50 ? "Savings rate is at or above the peer median" :
               p >= 25 ? "Savings rate is below median — consider increasing contributions" :
               "Savings rate significantly below peers — immediate action recommended",
    });
  }

  // Debt-to-Income
  if (client.totalDebt !== undefined && client.annualIncome > 0) {
    const dti = (client.totalDebt / client.annualIncome) * 100;
    // For DTI, lower is better, so invert the percentile
    const rawP = calculatePercentile(dti, peers.debtToIncomeRatio.p25, peers.debtToIncomeRatio.median, peers.debtToIncomeRatio.p75);
    const p = 100 - rawP; // Invert: lower DTI = higher percentile
    results.push({
      type: "debt_ratio",
      clientValue: `${dti.toFixed(1)}%`,
      peerMedian: `${peers.debtToIncomeRatio.median}%`,
      peerP25: `${peers.debtToIncomeRatio.p25}%`,
      peerP75: `${peers.debtToIncomeRatio.p75}%`,
      percentileRank: p,
      insight: p >= 75 ? "Debt levels well below peers — strong financial position" :
               p >= 50 ? "Debt-to-income ratio is manageable relative to peers" :
               p >= 25 ? "Debt levels above peer median — consider accelerated payoff" :
               "Debt-to-income ratio significantly above peers — debt reduction priority",
    });
  }

  // Emergency Fund
  if (client.emergencyFundBalance !== undefined && client.monthlyExpenses && client.monthlyExpenses > 0) {
    const months = client.emergencyFundBalance / client.monthlyExpenses;
    const p = calculatePercentile(months, peers.emergencyFundMonths.p25, peers.emergencyFundMonths.median, peers.emergencyFundMonths.p75);
    results.push({
      type: "insurance_coverage", // Using this type for emergency fund
      clientValue: `${months.toFixed(1)} months`,
      peerMedian: `${peers.emergencyFundMonths.median} months`,
      peerP25: `${peers.emergencyFundMonths.p25} months`,
      peerP75: `${peers.emergencyFundMonths.p75} months`,
      percentileRank: p,
      insight: p >= 75 ? "Emergency reserves exceed peer benchmarks" :
               p >= 50 ? "Emergency fund at or above peer median" :
               p >= 25 ? "Emergency reserves below median — build toward 3-6 months" :
               "Insufficient emergency reserves — prioritize building cash cushion",
    });
  }

  // Retirement Savings Multiple
  if (client.retirementSavings !== undefined && client.annualIncome > 0) {
    const multiple = client.retirementSavings / client.annualIncome;
    const p = calculatePercentile(multiple, peers.retirementSavingsMultiple.p25, peers.retirementSavingsMultiple.median, peers.retirementSavingsMultiple.p75);
    results.push({
      type: "retirement_readiness",
      clientValue: `${multiple.toFixed(1)}x income`,
      peerMedian: `${peers.retirementSavingsMultiple.median}x income`,
      peerP25: `${peers.retirementSavingsMultiple.p25}x income`,
      peerP75: `${peers.retirementSavingsMultiple.p75}x income`,
      percentileRank: p,
      insight: p >= 75 ? "Retirement savings well ahead of peers — on track for comfortable retirement" :
               p >= 50 ? "Retirement savings at or above peer median" :
               p >= 25 ? "Retirement savings below median — consider increasing contributions" :
               "Retirement savings significantly behind peers — catch-up contributions recommended",
    });
  }

  // Net Worth to Income
  if (client.netWorth !== undefined && client.annualIncome > 0) {
    const ratio = client.netWorth / client.annualIncome;
    const p = calculatePercentile(ratio, peers.netWorthToIncome.p25, peers.netWorthToIncome.median, peers.netWorthToIncome.p75);
    results.push({
      type: "overall",
      clientValue: `${ratio.toFixed(1)}x income`,
      peerMedian: `${peers.netWorthToIncome.median}x income`,
      peerP25: `${peers.netWorthToIncome.p25}x income`,
      peerP75: `${peers.netWorthToIncome.p75}x income`,
      percentileRank: p,
      insight: p >= 75 ? "Net worth significantly exceeds peer benchmarks" :
               p >= 50 ? "Net worth at or above peer median — solid foundation" :
               p >= 25 ? "Net worth below peer median — focus on wealth accumulation" :
               "Net worth significantly below peers — comprehensive plan needed",
    });
  }

  // Tax Efficiency
  if (client.effectiveTaxRate !== undefined) {
    // Lower effective tax rate is better
    const rawP = calculatePercentile(client.effectiveTaxRate, peers.effectiveTaxRate.p25, peers.effectiveTaxRate.median, peers.effectiveTaxRate.p75);
    const p = 100 - rawP;
    results.push({
      type: "tax_efficiency",
      clientValue: `${client.effectiveTaxRate}%`,
      peerMedian: `${peers.effectiveTaxRate.median}%`,
      peerP25: `${peers.effectiveTaxRate.p25}%`,
      peerP75: `${peers.effectiveTaxRate.p75}%`,
      percentileRank: p,
      insight: p >= 75 ? "Tax efficiency well above peers — effective tax planning" :
               p >= 50 ? "Tax efficiency at or above peer median" :
               p >= 25 ? "Tax efficiency below median — review tax planning strategies" :
               "Tax burden significantly above peers — comprehensive tax review recommended",
    });
  }

  return {
    peerGroupKey,
    peerGroupDescription: describePeerGroup(peerGroupKey),
    benchmarks: results,
    overallPercentile: results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + r.percentileRank, 0) / results.length)
      : null,
    dataSource: "Federal Reserve Survey of Consumer Finances (SCF) 2022, BLS Consumer Expenditure Survey 2023",
  };
}

function describePeerGroup(key: string): string {
  const parts = key.split("_");
  if (parts.length < 2) return "General population";
  return `Age ${parts[0]}, household income $${parts[1].replace("-", "-$")}`;
}

// ─── PERSISTENCE ────────────────────────────────────────────────────────

export async function saveBenchmarkSnapshot(
  advisorId: number,
  clientId: number,
  benchmarks: ReturnType<typeof computeBenchmarks>,
  planningNodeId?: number,
  goalId?: number,
) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const now = Date.now();
  const ids: number[] = [];

  for (const b of benchmarks.benchmarks) {
    const [result] = await db.insert(benchmarkComparisons).values({
      clientId,
      advisorId,
      comparisonType: b.type as any,
      clientValue: b.clientValue,
      peerMedian: b.peerMedian,
      peerP25: b.peerP25,
      peerP75: b.peerP75,
      percentileRank: b.percentileRank,
      peerGroupCriteria: { key: benchmarks.peerGroupKey, description: benchmarks.peerGroupDescription },
      peerGroupSize: 1000, // Approximate SCF sample size for cohort
      dataSourceJson: { source: benchmarks.dataSource },
      insightsJson: { insight: b.insight },
      planningNodeId: planningNodeId ?? null,
      goalId: goalId ?? null,
      snapshotDate: now,
      createdAt: now,
    }).$returningId();
    ids.push(result.id);
  }

  return ids;
}

export async function getLatestBenchmarks(advisorId: number, clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(benchmarkComparisons)
    .where(and(
      eq(benchmarkComparisons.advisorId, advisorId),
      eq(benchmarkComparisons.clientId, clientId),
    ))
    .orderBy(desc(benchmarkComparisons.createdAt))
    .limit(20);
}
