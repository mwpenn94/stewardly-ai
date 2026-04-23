/**
 * Sensitivity Analysis for Wealth Engine Monte Carlo simulations.
 * Runs MC across parameter grids (return, volatility, savings, horizon)
 * and reports median outcome changes + elasticity. Wealth Engine 4.0+.
 */
import { mulberry32, boxMullerSeeded, defaultSeed } from "./seededRng";
import type { MonteCarloPercentile } from "./types";

export interface SensitivityInput {
  baseReturn: number;
  baseVolatility: number;
  startBalance: number;
  annualContribution: number;
  years: number;
  trials?: number;
  seed?: number;
}

export interface SensitivityResult {
  parameter: string;
  label: string;
  points: SensitivityPoint[];
  elasticity: number;
}

export interface SensitivityPoint {
  value: number;
  label: string;
  medianOutcome: number;
  p10: number;
  p90: number;
  successRate: number;
}

function runSeededMC(
  startBalance: number, annualContribution: number,
  expectedReturn: number, volatility: number,
  years: number, trials: number, seed: number,
): MonteCarloPercentile {
  const rng = mulberry32(seed);
  const finalValues: number[] = [];
  for (let t = 0; t < trials; t++) {
    let bal = startBalance;
    for (let yr = 1; yr <= years; yr++) {
      const r = expectedReturn + volatility * boxMullerSeeded(rng);
      bal = (bal + annualContribution) * (1 + Math.max(-0.40, Math.min(0.60, r)));
      if (bal < 0) bal = 0;
    }
    finalValues.push(Math.round(bal));
  }
  finalValues.sort((a, b) => a - b);
  const n = finalValues.length;
  const sum = finalValues.reduce((a, b) => a + b, 0);
  const successCount = finalValues.filter(v => v > 0).length;
  return {
    p10: finalValues[Math.floor(n * 0.10)],
    p25: finalValues[Math.floor(n * 0.25)],
    p50: finalValues[Math.floor(n * 0.50)],
    p75: finalValues[Math.floor(n * 0.75)],
    p90: finalValues[Math.floor(n * 0.90)],
    mean: Math.round(sum / n),
    min: finalValues[0],
    max: finalValues[n - 1],
    successRate: Math.round((successCount / n) * 100),
  };
}

function calcElasticity(points: { value: number; medianOutcome: number }[], baseValue: number, baseMedian: number): number {
  if (points.length < 2 || baseMedian === 0 || baseValue === 0) return 0;
  const first = points[0], last = points[points.length - 1];
  return Math.round(((last.medianOutcome - first.medianOutcome) / baseMedian) / ((last.value - first.value) / baseValue) * 100) / 100;
}

export function runSensitivityAnalysis(input: SensitivityInput): SensitivityResult[] {
  const { baseReturn, baseVolatility, startBalance, annualContribution, years, trials = 500, seed = defaultSeed() } = input;
  const results: SensitivityResult[] = [];

  // 1. Return rate: -3% to +3%
  const returnDeltas = [-0.03, -0.02, -0.01, 0, 0.01, 0.02, 0.03];
  const returnPts = returnDeltas.map((d, i) => {
    const r = baseReturn + d;
    const mc = runSeededMC(startBalance, annualContribution, r, baseVolatility, years, trials, seed + i * 1000);
    return { value: r, label: `${(r * 100).toFixed(1)}%`, medianOutcome: mc.p50, p10: mc.p10, p90: mc.p90, successRate: mc.successRate ?? 100 };
  });
  const baseRetMedian = returnPts.find(p => p.value === baseReturn)?.medianOutcome ?? 1;
  results.push({ parameter: "expectedReturn", label: "Expected Return", points: returnPts, elasticity: calcElasticity(returnPts, baseReturn, baseRetMedian) });

  // 2. Volatility: 5% to 30%
  const volVals = [0.05, 0.10, 0.15, 0.20, 0.25, 0.30];
  const volPts = volVals.map((v, i) => {
    const mc = runSeededMC(startBalance, annualContribution, baseReturn, v, years, trials, seed + 10000 + i * 1000);
    return { value: v, label: `${(v * 100).toFixed(0)}%`, medianOutcome: mc.p50, p10: mc.p10, p90: mc.p90, successRate: mc.successRate ?? 100 };
  });
  const baseVolMedian = volPts.find(p => p.value === baseVolatility)?.medianOutcome ?? 1;
  results.push({ parameter: "volatility", label: "Market Volatility", points: volPts, elasticity: calcElasticity(volPts, baseVolatility, baseVolMedian) });

  // 3. Contribution: 50% to 200%
  const contribMults = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
  const contribPts = contribMults.map((m, i) => {
    const c = Math.round(annualContribution * m);
    const mc = runSeededMC(startBalance, c, baseReturn, baseVolatility, years, trials, seed + 20000 + i * 1000);
    return { value: c, label: `$${(c / 1000).toFixed(0)}K/yr`, medianOutcome: mc.p50, p10: mc.p10, p90: mc.p90, successRate: mc.successRate ?? 100 };
  });
  const baseContribMedian = contribPts.find(p => p.value === annualContribution)?.medianOutcome ?? 1;
  results.push({ parameter: "annualContribution", label: "Annual Savings", points: contribPts, elasticity: calcElasticity(contribPts, annualContribution, baseContribMedian) });

  // 4. Horizon: 10 to 40 years
  const horizons = [10, 15, 20, 25, 30, 35, 40];
  const horizonPts = horizons.map((h, i) => {
    const mc = runSeededMC(startBalance, annualContribution, baseReturn, baseVolatility, h, trials, seed + 30000 + i * 1000);
    return { value: h, label: `${h} yrs`, medianOutcome: mc.p50, p10: mc.p10, p90: mc.p90, successRate: mc.successRate ?? 100 };
  });
  const baseHorizonMedian = horizonPts.find(p => p.value === years)?.medianOutcome ?? 1;
  results.push({ parameter: "timeHorizon", label: "Time Horizon", points: horizonPts, elasticity: calcElasticity(horizonPts, years, baseHorizonMedian) });

  return results;
}

export function tornadoChart(results: SensitivityResult[]) {
  return results.map(r => {
    const sorted = [...r.points].sort((a, b) => a.medianOutcome - b.medianOutcome);
    const mid = r.points[Math.floor(r.points.length / 2)];
    return { parameter: r.parameter, label: r.label, elasticity: r.elasticity, lowOutcome: sorted[0].medianOutcome, highOutcome: sorted[sorted.length - 1].medianOutcome, baseOutcome: mid.medianOutcome };
  }).sort((a, b) => Math.abs(b.elasticity) - Math.abs(a.elasticity));
}
