/**
 * Task #25 — What-If Scenarios + Backtesting Service
 * Allows users to adjust model parameters and see projected outcomes,
 * plus backtest portfolios against historical market events.
 */
import { getDb } from "../db";
import { modelScenarios, modelBacktests } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { contextualLLM as invokeLLM } from "../shared/stewardlyWiring"
import { contextualLLM } from "./contextualLLM";

// ─── Historical Events for Backtesting ───────────────────────────────────
export const HISTORICAL_EVENTS = [
  { name: "2008 Financial Crisis", year: 2008, spDrop: -56.8, recoveryMonths: 49 },
  { name: "2000 Dot-Com Crash", year: 2000, spDrop: -49.1, recoveryMonths: 56 },
  { name: "2020 COVID Crash", year: 2020, spDrop: -33.9, recoveryMonths: 5 },
  { name: "1987 Black Monday", year: 1987, spDrop: -33.5, recoveryMonths: 20 },
  { name: "2022 Rate Hike Bear", year: 2022, spDrop: -25.4, recoveryMonths: 15 },
  { name: "2018 Q4 Selloff", year: 2018, spDrop: -19.8, recoveryMonths: 4 },
  { name: "2011 Euro Debt Crisis", year: 2011, spDrop: -19.4, recoveryMonths: 5 },
  { name: "1973 Oil Crisis", year: 1973, spDrop: -48.2, recoveryMonths: 69 },
] as const;

// ─── Asset Class Correlations (simplified) ───────────────────────────────
const ASSET_SENSITIVITY: Record<string, Record<string, number>> = {
  "US Large Cap": { equityBeta: 1.0, bondCorr: -0.2, inflationSens: -0.3 },
  "US Small Cap": { equityBeta: 1.3, bondCorr: -0.15, inflationSens: -0.4 },
  "International Developed": { equityBeta: 0.85, bondCorr: -0.1, inflationSens: -0.2 },
  "Emerging Markets": { equityBeta: 1.2, bondCorr: -0.05, inflationSens: -0.3 },
  "US Bonds": { equityBeta: -0.2, bondCorr: 1.0, inflationSens: -0.5 },
  "TIPS": { equityBeta: -0.1, bondCorr: 0.6, inflationSens: 0.8 },
  "Real Estate": { equityBeta: 0.7, bondCorr: 0.1, inflationSens: 0.3 },
  "Cash": { equityBeta: 0, bondCorr: 0.1, inflationSens: -0.8 },
  "Gold": { equityBeta: -0.1, bondCorr: 0.2, inflationSens: 0.6 },
};

interface PortfolioAllocation {
  assetClass: string;
  percentage: number;
}

interface ScenarioParams {
  returnAdjustment?: number;
  inflationRate?: number;
  interestRateChange?: number;
  timeHorizonYears?: number;
  initialInvestment?: number;
}

// ─── What-If Scenario Engine ─────────────────────────────────────────────
export async function runWhatIfScenario(
  userId: number,
  scenarioName: string,
  modelType: string,
  portfolio: PortfolioAllocation[],
  params: ScenarioParams,
  baseRunId?: number
): Promise<{
  id: number;
  projectedReturn: number;
  projectedValue: number;
  riskMetrics: { volatility: number; sharpeRatio: number; maxDrawdown: number };
  yearByYear: Array<{ year: number; value: number; returnPct: number }>;
}> {
  const timeHorizon = params.timeHorizonYears ?? 10;
  const initial = params.initialInvestment ?? 100000;
  const inflationAdj = params.inflationRate ?? 0.025;
  const rateAdj = params.interestRateChange ?? 0;

  // Calculate weighted portfolio metrics
  let weightedReturn = 0;
  let weightedVolatility = 0;

  for (const alloc of portfolio) {
    const sens = ASSET_SENSITIVITY[alloc.assetClass] ?? { equityBeta: 0.5, bondCorr: 0, inflationSens: 0 };
    const baseReturn = sens.equityBeta * 0.08 + sens.bondCorr * 0.035;
    const adjustedReturn = baseReturn + (params.returnAdjustment ?? 0) + sens.inflationSens * (inflationAdj - 0.025) + sens.bondCorr * rateAdj * -0.1;
    const vol = Math.abs(sens.equityBeta) * 0.15 + 0.02;

    weightedReturn += adjustedReturn * (alloc.percentage / 100);
    weightedVolatility += vol * (alloc.percentage / 100);
  }

  // Generate year-by-year projection
  const yearByYear: Array<{ year: number; value: number; returnPct: number }> = [];
  let currentValue = initial;
  let maxValue = initial;
  let maxDrawdown = 0;

  for (let y = 1; y <= timeHorizon; y++) {
    // Add some variance
    const variance = (Math.random() - 0.5) * weightedVolatility * 2;
    const yearReturn = weightedReturn + variance;
    currentValue *= (1 + yearReturn);
    maxValue = Math.max(maxValue, currentValue);
    const drawdown = (maxValue - currentValue) / maxValue;
    maxDrawdown = Math.max(maxDrawdown, drawdown);

    yearByYear.push({
      year: y,
      value: Math.round(currentValue * 100) / 100,
      returnPct: Math.round(yearReturn * 10000) / 100,
    });
  }

  const totalReturn = (currentValue - initial) / initial;
  const sharpeRatio = weightedVolatility > 0 ? (weightedReturn - 0.03) / weightedVolatility : 0;

  const resultJson = {
    projectedReturn: Math.round(totalReturn * 10000) / 100,
    projectedValue: Math.round(currentValue * 100) / 100,
    riskMetrics: {
      volatility: Math.round(weightedVolatility * 10000) / 100,
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
      maxDrawdown: Math.round(maxDrawdown * 10000) / 100,
    },
    yearByYear,
  };

  const db = (await getDb())!;
  const [result] = await db.insert(modelScenarios).values({
    userId,
    baseRunId,
    modelType,
    scenarioName,
    adjustedParams: { portfolio, ...params },
    resultJson,
  }).$returningId();

  return { id: result.id, ...resultJson };
}

// ─── Backtest Against Historical Event ───────────────────────────────────
export async function runBacktest(
  userId: number,
  modelType: string,
  historicalEvent: string,
  portfolio: PortfolioAllocation[]
): Promise<{
  id: number;
  event: string;
  maxDrawdown: number;
  recoveryMonths: number;
  portfolioImpact: number;
  assetBreakdown: Array<{ assetClass: string; impact: number }>;
}> {
  const event = HISTORICAL_EVENTS.find(e => e.name === historicalEvent);
  if (!event) throw new Error(`Unknown historical event: ${historicalEvent}`);

  // Calculate portfolio-specific impact
  const assetBreakdown: Array<{ assetClass: string; impact: number }> = [];
  let weightedImpact = 0;

  for (const alloc of portfolio) {
    const sens = ASSET_SENSITIVITY[alloc.assetClass] ?? { equityBeta: 0.5, bondCorr: 0, inflationSens: 0 };
    const impact = (event.spDrop / 100) * sens.equityBeta;
    assetBreakdown.push({
      assetClass: alloc.assetClass,
      impact: Math.round(impact * 10000) / 100,
    });
    weightedImpact += impact * (alloc.percentage / 100);
  }

  const portfolioDrawdown = Math.round(Math.abs(weightedImpact) * 10000) / 100;
  // Recovery time scales with drawdown severity
  const recoveryFactor = Math.abs(weightedImpact) / Math.abs(event.spDrop / 100);
  const estimatedRecovery = Math.round(event.recoveryMonths * recoveryFactor);

  const db = (await getDb())!;
  const [result] = await db.insert(modelBacktests).values({
    userId,
    modelType,
    historicalEvent: event.name,
    eventYear: event.year,
    portfolioParams: { portfolio },
    resultJson: { assetBreakdown, portfolioImpact: weightedImpact * 100 },
    maxDrawdown: portfolioDrawdown,
    recoveryMonths: estimatedRecovery,
  }).$returningId();

  return {
    id: result.id,
    event: event.name,
    maxDrawdown: portfolioDrawdown,
    recoveryMonths: estimatedRecovery,
    portfolioImpact: Math.round(weightedImpact * 10000) / 100,
    assetBreakdown,
  };
}

// ─── Query Helpers ───────────────────────────────────────────────────────
export async function getUserScenarios(userId: number) {
  const db = (await getDb())!;
  return db.select().from(modelScenarios)
    .where(eq(modelScenarios.userId, userId))
    .orderBy(desc(modelScenarios.createdAt)).limit(20);
}

export async function getUserBacktests(userId: number) {
  const db = (await getDb())!;
  return db.select().from(modelBacktests)
    .where(eq(modelBacktests.userId, userId))
    .orderBy(desc(modelBacktests.createdAt)).limit(20);
}

export { HISTORICAL_EVENTS as historicalEvents };
