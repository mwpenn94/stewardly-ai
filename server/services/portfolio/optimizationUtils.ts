/**
 * portfolioOptimizationUtils — Pure-function portfolio analytics.
 *
 * Provides:
 *   1. Return metrics (annualized return, volatility, Sharpe, Sortino, max drawdown).
 *   2. Correlation / covariance matrix computation.
 *   3. Efficient frontier point generation (mean-variance).
 *   4. Risk-parity weight calculator.
 *
 * All functions are PURE — no DB, no fetch, no wall-clock.
 * Input arrays represent periodic returns (daily, monthly — caller decides).
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ReturnSeries {
  /** Identifier (ticker, sleeve key). */
  id: string;
  /** Periodic returns as decimals (0.01 = 1%). */
  returns: number[];
}

export interface RiskMetrics {
  /** Annualized return (decimal). */
  annualizedReturn: number;
  /** Annualized volatility (standard deviation, decimal). */
  annualizedVolatility: number;
  /** Sharpe ratio (excess return / volatility). */
  sharpeRatio: number;
  /** Sortino ratio (excess return / downside deviation). */
  sortinoRatio: number;
  /** Maximum drawdown as a positive decimal (0.25 = 25% peak-to-trough). */
  maxDrawdown: number;
  /** Number of periods in the input. */
  periods: number;
}

export interface CorrelationEntry {
  assetA: string;
  assetB: string;
  correlation: number;
  covariance: number;
}

export interface EfficientFrontierPoint {
  /** Target return (decimal). */
  targetReturn: number;
  /** Minimum volatility at this return level (decimal). */
  volatility: number;
  /** Sharpe ratio at this point. */
  sharpeRatio: number;
  /** Asset weights (id → weight decimal summing to 1). */
  weights: Record<string, number>;
}

export interface RiskParityResult {
  /** Asset weights (id → weight decimal summing to 1). */
  weights: Record<string, number>;
  /** Expected portfolio volatility. */
  portfolioVolatility: number;
  /** Each asset's risk contribution (id → fraction of total risk). */
  riskContributions: Record<string, number>;
}

// ─── Core statistics ───────────────────────────────────────────────────────

export function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

export function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

export function downsideDeviation(arr: number[], threshold = 0): number {
  if (arr.length < 2) return 0;
  const downside = arr.filter((r) => r < threshold).map((r) => (r - threshold) ** 2);
  if (downside.length === 0) return 0;
  return Math.sqrt(downside.reduce((s, v) => s + v, 0) / arr.length);
}

export function covariance(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const ma = mean(a.slice(0, n));
  const mb = mean(b.slice(0, n));
  let sum = 0;
  for (let i = 0; i < n; i++) sum += (a[i] - ma) * (b[i] - mb);
  return sum / (n - 1);
}

export function correlation(a: number[], b: number[]): number {
  const sa = stddev(a);
  const sb = stddev(b);
  if (sa === 0 || sb === 0) return 0;
  return covariance(a, b) / (sa * sb);
}

// ─── Risk metrics ──────────────────────────────────────────────────────────

/**
 * Compute annualized risk metrics for a single return series.
 * @param returns Periodic returns as decimals.
 * @param periodsPerYear Number of periods in a year (252 for daily, 12 for monthly).
 * @param riskFreeRate Annualized risk-free rate (decimal). Default 0.04 (4%).
 */
export function computeRiskMetrics(
  returns: number[],
  periodsPerYear = 252,
  riskFreeRate = 0.04,
): RiskMetrics {
  const n = returns.length;
  if (n < 2) {
    return { annualizedReturn: 0, annualizedVolatility: 0, sharpeRatio: 0, sortinoRatio: 0, maxDrawdown: 0, periods: n };
  }

  const periodicMean = mean(returns);
  const periodicStd = stddev(returns);
  const annualizedReturn = periodicMean * periodsPerYear;
  const annualizedVolatility = periodicStd * Math.sqrt(periodsPerYear);

  const excessReturn = annualizedReturn - riskFreeRate;
  const sharpeRatio = annualizedVolatility > 0 ? excessReturn / annualizedVolatility : 0;

  const periodicRfr = riskFreeRate / periodsPerYear;
  const dd = downsideDeviation(returns, periodicRfr);
  const annualizedDD = dd * Math.sqrt(periodsPerYear);
  const sortinoRatio = annualizedDD > 0 ? excessReturn / annualizedDD : 0;

  const maxDrawdown = computeMaxDrawdown(returns);

  return {
    annualizedReturn: round6(annualizedReturn),
    annualizedVolatility: round6(annualizedVolatility),
    sharpeRatio: round4(sharpeRatio),
    sortinoRatio: round4(sortinoRatio),
    maxDrawdown: round6(maxDrawdown),
    periods: n,
  };
}

export function computeMaxDrawdown(returns: number[]): number {
  let cumulative = 1;
  let peak = 1;
  let maxDD = 0;

  for (const r of returns) {
    cumulative *= 1 + r;
    if (cumulative > peak) peak = cumulative;
    const dd = (peak - cumulative) / peak;
    if (dd > maxDD) maxDD = dd;
  }

  return round6(maxDD);
}

// ─── Correlation matrix ────────────────────────────────────────────────────

export function buildCorrelationMatrix(series: ReturnSeries[]): CorrelationEntry[] {
  const entries: CorrelationEntry[] = [];

  for (let i = 0; i < series.length; i++) {
    for (let j = i + 1; j < series.length; j++) {
      entries.push({
        assetA: series[i].id,
        assetB: series[j].id,
        correlation: round4(correlation(series[i].returns, series[j].returns)),
        covariance: round6(covariance(series[i].returns, series[j].returns)),
      });
    }
  }

  return entries;
}

// ─── Efficient frontier (simplified mean-variance) ─────────────────────────

/**
 * Generate points on the efficient frontier using a grid search over
 * weight combinations. This is a simplified approach suitable for
 * small portfolios (≤10 assets). For larger portfolios, use quadratic
 * programming (e.g., via a dedicated optimizer library).
 *
 * @param series Array of return series for each asset.
 * @param points Number of frontier points to generate. Default 20.
 * @param periodsPerYear Periods per year for annualization. Default 252.
 * @param riskFreeRate Annualized risk-free rate. Default 0.04.
 */
export function generateEfficientFrontier(
  series: ReturnSeries[],
  points = 20,
  periodsPerYear = 252,
  riskFreeRate = 0.04,
): EfficientFrontierPoint[] {
  if (series.length === 0) return [];
  if (series.length === 1) {
    const metrics = computeRiskMetrics(series[0].returns, periodsPerYear, riskFreeRate);
    return [{
      targetReturn: metrics.annualizedReturn,
      volatility: metrics.annualizedVolatility,
      sharpeRatio: metrics.sharpeRatio,
      weights: { [series[0].id]: 1 },
    }];
  }

  // Compute per-asset metrics
  const assetMetrics = series.map((s) => ({
    id: s.id,
    returns: s.returns,
    metrics: computeRiskMetrics(s.returns, periodsPerYear, riskFreeRate),
  }));

  // Build covariance matrix
  const n = series.length;
  const covMatrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      covMatrix[i][j] = covariance(series[i].returns, series[j].returns);
    }
  }

  // Determine return range
  const minReturn = Math.min(...assetMetrics.map((a) => a.metrics.annualizedReturn));
  const maxReturn = Math.max(...assetMetrics.map((a) => a.metrics.annualizedReturn));
  const step = (maxReturn - minReturn) / (points - 1 || 1);

  const frontier: EfficientFrontierPoint[] = [];

  for (let p = 0; p < points; p++) {
    const targetReturn = minReturn + step * p;

    // For 2-asset case, solve analytically
    if (n === 2) {
      const r1 = assetMetrics[0].metrics.annualizedReturn;
      const r2 = assetMetrics[1].metrics.annualizedReturn;
      const denom = r1 - r2;
      let w1 = denom !== 0 ? (targetReturn - r2) / denom : 0.5;
      w1 = Math.max(0, Math.min(1, w1));
      const w2 = 1 - w1;
      const weights = [w1, w2];

      const vol = portfolioVolatility(weights, covMatrix, periodsPerYear);
      const excess = targetReturn - riskFreeRate;
      const sharpe = vol > 0 ? excess / vol : 0;

      frontier.push({
        targetReturn: round6(targetReturn),
        volatility: round6(vol),
        sharpeRatio: round4(sharpe),
        weights: { [series[0].id]: round4(w1), [series[1].id]: round4(w2) },
      });
    } else {
      // For n > 2, use equal-weight as starting point and perturb
      // This is a simplified heuristic — production would use QP
      const equalWeight = 1 / n;
      const weights = Array(n).fill(equalWeight);

      // Adjust weights toward target return
      const currentReturn = weights.reduce((s, w, i) => s + w * assetMetrics[i].metrics.annualizedReturn, 0);
      if (currentReturn !== targetReturn) {
        const bestIdx = assetMetrics.reduce((best, a, i) =>
          a.metrics.annualizedReturn > assetMetrics[best].metrics.annualizedReturn ? i : best, 0);
        const worstIdx = assetMetrics.reduce((worst, a, i) =>
          a.metrics.annualizedReturn < assetMetrics[worst].metrics.annualizedReturn ? i : worst, 0);

        if (bestIdx !== worstIdx) {
          const shift = Math.min(0.5, Math.abs(targetReturn - currentReturn) /
            Math.abs(assetMetrics[bestIdx].metrics.annualizedReturn - assetMetrics[worstIdx].metrics.annualizedReturn));
          if (targetReturn > currentReturn) {
            weights[bestIdx] += shift;
            weights[worstIdx] = Math.max(0, weights[worstIdx] - shift);
          } else {
            weights[worstIdx] += shift;
            weights[bestIdx] = Math.max(0, weights[bestIdx] - shift);
          }
        }
      }

      // Normalize
      const totalW = weights.reduce((s, w) => s + w, 0);
      const normWeights = weights.map((w) => w / totalW);

      const vol = portfolioVolatility(normWeights, covMatrix, periodsPerYear);
      const actualReturn = normWeights.reduce((s, w, i) => s + w * assetMetrics[i].metrics.annualizedReturn, 0);
      const excess = actualReturn - riskFreeRate;
      const sharpe = vol > 0 ? excess / vol : 0;

      const weightMap: Record<string, number> = {};
      series.forEach((s, i) => { weightMap[s.id] = round4(normWeights[i]); });

      frontier.push({
        targetReturn: round6(actualReturn),
        volatility: round6(vol),
        sharpeRatio: round4(sharpe),
        weights: weightMap,
      });
    }
  }

  return frontier;
}

// ─── Risk parity ───────────────────────────────────────────────────────────

/**
 * Compute risk-parity weights: each asset contributes equally to
 * total portfolio risk. Uses inverse-volatility as the starting point
 * (exact for uncorrelated assets, good approximation otherwise).
 */
export function computeRiskParity(
  series: ReturnSeries[],
  periodsPerYear = 252,
): RiskParityResult {
  if (series.length === 0) {
    return { weights: {}, portfolioVolatility: 0, riskContributions: {} };
  }

  const vols = series.map((s) => {
    const sd = stddev(s.returns);
    return sd * Math.sqrt(periodsPerYear);
  });

  // Inverse-volatility weights
  const invVols = vols.map((v) => (v > 0 ? 1 / v : 0));
  const totalInv = invVols.reduce((s, v) => s + v, 0);
  const rawWeights = totalInv > 0 ? invVols.map((v) => v / totalInv) : series.map(() => 1 / series.length);

  // Build covariance matrix for portfolio vol
  const n = series.length;
  const covMatrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      covMatrix[i][j] = covariance(series[i].returns, series[j].returns);
    }
  }

  const portVol = portfolioVolatility(rawWeights, covMatrix, periodsPerYear);

  // Marginal risk contributions
  const riskContributions: Record<string, number> = {};
  const marginalRisks = rawWeights.map((wi, i) => {
    let marginal = 0;
    for (let j = 0; j < n; j++) {
      marginal += rawWeights[j] * covMatrix[i][j];
    }
    return wi * marginal;
  });
  const totalMarginal = marginalRisks.reduce((s, v) => s + v, 0);

  const weights: Record<string, number> = {};
  series.forEach((s, i) => {
    weights[s.id] = round4(rawWeights[i]);
    riskContributions[s.id] = totalMarginal > 0 ? round4(marginalRisks[i] / totalMarginal) : round4(1 / n);
  });

  return {
    weights,
    portfolioVolatility: round6(portVol),
    riskContributions,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function portfolioVolatility(weights: number[], covMatrix: number[][], periodsPerYear: number): number {
  const n = weights.length;
  let variance = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      variance += weights[i] * weights[j] * covMatrix[i][j];
    }
  }
  return Math.sqrt(Math.max(0, variance) * periodsPerYear);
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function round6(n: number): number {
  return Math.round(n * 1000000) / 1000000;
}
