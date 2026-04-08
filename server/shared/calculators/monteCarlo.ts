/**
 * Monte Carlo simulation for UWE strategy portfolios.
 *
 * Ported verbatim from the v7 WealthBridge HTML calculators
 * (Business-Calculator-v7 lines 1563–1619). Uses Box-Muller to draw a
 * normal N(μ, σ²) annual return and caps the draw at [-40%, +60%] to
 * match the v7 envelope and the Morningstar 2025 SBBI historical tail.
 *
 * The Box-Muller primitive is also present at
 * server/services/statisticalModels.ts:16-21 — we deliberately mirror it
 * here (rather than cross-import) so the shared calculators package stays
 * free of cross-layer dependencies on server/services/*.
 */

import type { MonteCarloPercentile } from "./types";

// ─── Random normal via Box-Muller transform ─────────────────────────────────
// Returns a single draw from N(0, 1). v7 inlines this in
// `simulateWithVolatility`; we factor it out so the test suite can stub it
// with a deterministic generator.
function randNorm(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Volatility-adjusted single-path simulator used by `simulate`.
 *
 * The v7 version clones the strategy config, draws an annual return for
 * each year, caps it at [-0.40, +0.60], and uses a cheap cumulative-factor
 * approximation of the underlying UWE year-by-year totalHolisticValue.
 * The cumulative factor is scaled by `yr * 10000` to match the v7 shape
 * exactly — this is a stand-in for the full deterministic simulation in
 * `uwe.simulate`, intentionally preserved so the percentile bands match.
 */
export function simulateWithVolatility(
  strategyConfig: { investReturn?: number; volatility?: number } & Record<
    string,
    unknown
  >,
  maxYears: number,
): Array<{ year: number; totalHolisticValue: number }> {
  // Clone config so downstream callers never observe mutated state. The v7
  // original does `JSON.parse(JSON.stringify(strategyConfig))` for the same
  // reason.
  const cfg = JSON.parse(JSON.stringify(strategyConfig)) as {
    investReturn?: number;
    volatility?: number;
  };
  const baseReturn = cfg.investReturn ?? 0.07;
  const volatility = cfg.volatility ?? 0.15; // 15% annual std dev (stock-like)

  const results: Array<{ year: number; totalHolisticValue: number }> = [];
  let cumReturn = 1;
  for (let yr = 1; yr <= maxYears; yr++) {
    let annualReturn = baseReturn + volatility * randNorm();
    // Cap at -40% to +60% to match v7 envelope.
    annualReturn = Math.max(-0.4, Math.min(0.6, annualReturn));
    cumReturn *= 1 + annualReturn;
    results.push({
      year: yr,
      totalHolisticValue: Math.round(cumReturn * yr * 10000),
    });
  }
  return results;
}

/**
 * Run `numTrials` independent trials of the volatility-adjusted simulation
 * and return a per-year percentile band.
 *
 * Output matches v7 shape exactly: an array of length `maxYears + 1`
 * (indices 0..maxYears), where index 0 is the pre-simulation sentinel
 * and indices 1..maxYears hold the `{p10, p25, p50, p75, p90, mean, min,
 * max, successRate}` percentiles for that year's totalHolisticValue.
 *
 * Defaults: 1000 trials, 30 years — same as v7.
 */
export function simulate(
  strategyConfig: { investReturn?: number; volatility?: number } & Record<
    string,
    unknown
  >,
  maxYears: number = 30,
  numTrials: number = 1000,
): MonteCarloPercentile[] {
  const years = maxYears || 30;
  const trials = numTrials || 1000;

  // yearlyResults[y] holds one entry per trial at year y.
  const yearlyResults: number[][] = [];
  for (let yr = 0; yr <= years; yr++) yearlyResults.push([]);

  for (let trial = 0; trial < trials; trial++) {
    const results = simulateWithVolatility(strategyConfig, years);
    for (let yr = 0; yr < results.length; yr++) {
      // +1 because v7 reserves index 0 as the pre-simulation sentinel
      yearlyResults[yr + 1].push(results[yr].totalHolisticValue || 0);
    }
  }

  const percentiles: MonteCarloPercentile[] = [];
  for (let yr = 0; yr <= years; yr++) {
    const vals = yearlyResults[yr].slice().sort((a, b) => a - b);
    const n = vals.length;
    if (n === 0) {
      percentiles.push({ p10: 0, p25: 0, p50: 0, p75: 0, p90: 0 });
      continue;
    }
    percentiles.push({
      p10: vals[Math.floor(n * 0.1)] || 0,
      p25: vals[Math.floor(n * 0.25)] || 0,
      p50: vals[Math.floor(n * 0.5)] || 0,
      p75: vals[Math.floor(n * 0.75)] || 0,
      p90: vals[Math.floor(n * 0.9)] || 0,
      mean: Math.round(vals.reduce((s, v) => s + v, 0) / n),
      min: vals[0],
      max: vals[n - 1],
      successRate: Math.round(
        (vals.filter((v) => v > 0).length / n) * 100,
      ),
    });
  }
  return percentiles;
}

// v7 parity alias — downstream code calls this as `UWE.monteCarloSimulate`.
export const monteCarloSimulate = simulate;
