import { describe, it, expect } from "vitest";
import {
  mean,
  stddev,
  downsideDeviation,
  covariance,
  correlation,
  computeRiskMetrics,
  computeMaxDrawdown,
  buildCorrelationMatrix,
  generateEfficientFrontier,
  computeRiskParity,
  type ReturnSeries,
} from "./optimizationUtils";

// ─── Core statistics ───────────────────────────────────────────────────────

describe("mean", () => {
  it("returns 0 for empty array", () => expect(mean([])).toBe(0));
  it("returns the value for single element", () => expect(mean([5])).toBe(5));
  it("computes average correctly", () => expect(mean([1, 2, 3, 4, 5])).toBe(3));
  it("handles negative values", () => expect(mean([-1, 1])).toBe(0));
});

describe("stddev", () => {
  it("returns 0 for empty array", () => expect(stddev([])).toBe(0));
  it("returns 0 for single element", () => expect(stddev([5])).toBe(0));
  it("computes standard deviation correctly", () => {
    const result = stddev([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(result).toBeCloseTo(2.0, 0); // ~2.138
  });
  it("returns 0 for identical values", () => expect(stddev([3, 3, 3])).toBe(0));
});

describe("downsideDeviation", () => {
  it("returns 0 for empty array", () => expect(downsideDeviation([])).toBe(0));
  it("returns 0 when all returns are positive", () => {
    expect(downsideDeviation([0.01, 0.02, 0.03])).toBe(0);
  });
  it("computes downside deviation for mixed returns", () => {
    const result = downsideDeviation([0.01, -0.02, 0.03, -0.01, 0.02]);
    expect(result).toBeGreaterThan(0);
  });
  it("respects custom threshold", () => {
    const result = downsideDeviation([0.01, 0.02, 0.03], 0.05);
    expect(result).toBeGreaterThan(0); // all below threshold
  });
});

describe("covariance", () => {
  it("returns 0 for insufficient data", () => expect(covariance([], [])).toBe(0));
  it("returns 0 for single element", () => expect(covariance([1], [2])).toBe(0));
  it("computes positive covariance for correlated series", () => {
    const a = [1, 2, 3, 4, 5];
    const b = [2, 4, 6, 8, 10];
    expect(covariance(a, b)).toBeGreaterThan(0);
  });
  it("computes negative covariance for inversely correlated series", () => {
    const a = [1, 2, 3, 4, 5];
    const b = [10, 8, 6, 4, 2];
    expect(covariance(a, b)).toBeLessThan(0);
  });
});

describe("correlation", () => {
  it("returns 0 when stddev is 0", () => {
    expect(correlation([3, 3, 3], [1, 2, 3])).toBe(0);
  });
  it("returns ~1 for perfectly correlated series", () => {
    const a = [1, 2, 3, 4, 5];
    const b = [2, 4, 6, 8, 10];
    expect(correlation(a, b)).toBeCloseTo(1, 4);
  });
  it("returns ~-1 for perfectly inversely correlated series", () => {
    const a = [1, 2, 3, 4, 5];
    const b = [10, 8, 6, 4, 2];
    expect(correlation(a, b)).toBeCloseTo(-1, 4);
  });
  it("returns ~0 for uncorrelated series", () => {
    const a = [1, -1, 1, -1, 1, -1, 1, -1];
    const b = [1, 1, -1, -1, 1, 1, -1, -1];
    expect(Math.abs(correlation(a, b))).toBeLessThan(0.3);
  });
});

// ─── Risk metrics ──────────────────────────────────────────────────────────

describe("computeRiskMetrics", () => {
  it("returns zeros for insufficient data", () => {
    const result = computeRiskMetrics([]);
    expect(result.annualizedReturn).toBe(0);
    expect(result.sharpeRatio).toBe(0);
    expect(result.periods).toBe(0);
  });

  it("computes annualized metrics for daily returns", () => {
    // Simulate ~8% annual return with ~15% volatility
    const dailyReturns = Array.from({ length: 252 }, () => 0.0003 + (Math.random() - 0.5) * 0.02);
    const result = computeRiskMetrics(dailyReturns, 252, 0.04);
    expect(result.periods).toBe(252);
    expect(typeof result.annualizedReturn).toBe("number");
    expect(typeof result.annualizedVolatility).toBe("number");
    expect(typeof result.sharpeRatio).toBe("number");
    expect(typeof result.sortinoRatio).toBe("number");
    expect(result.annualizedVolatility).toBeGreaterThan(0);
  });

  it("computes monthly metrics", () => {
    const monthlyReturns = [0.01, 0.02, -0.01, 0.03, 0.01, -0.02, 0.02, 0.01, 0.03, -0.01, 0.02, 0.01];
    const result = computeRiskMetrics(monthlyReturns, 12, 0.04);
    expect(result.periods).toBe(12);
    expect(result.annualizedReturn).toBeGreaterThan(0);
  });

  it("handles all-negative returns", () => {
    const returns = [-0.01, -0.02, -0.01, -0.03, -0.01];
    const result = computeRiskMetrics(returns, 252, 0.04);
    expect(result.annualizedReturn).toBeLessThan(0);
    expect(result.sharpeRatio).toBeLessThan(0);
  });
});

describe("computeMaxDrawdown", () => {
  it("returns 0 for empty array", () => expect(computeMaxDrawdown([])).toBe(0));
  it("returns 0 for monotonically increasing returns", () => {
    expect(computeMaxDrawdown([0.01, 0.01, 0.01, 0.01])).toBe(0);
  });
  it("computes drawdown correctly", () => {
    // Up 10%, then down 20% from peak
    const returns = [0.1, -0.2];
    const dd = computeMaxDrawdown(returns);
    expect(dd).toBeGreaterThan(0);
    expect(dd).toBeLessThan(1);
  });
  it("finds the maximum drawdown across multiple dips", () => {
    const returns = [0.05, -0.03, 0.02, -0.10, 0.08, -0.02];
    const dd = computeMaxDrawdown(returns);
    expect(dd).toBeGreaterThan(0.05); // The -10% dip should dominate
  });
});

// ─── Correlation matrix ────────────────────────────────────────────────────

describe("buildCorrelationMatrix", () => {
  it("returns empty for empty input", () => {
    expect(buildCorrelationMatrix([])).toEqual([]);
  });

  it("returns empty for single series", () => {
    expect(buildCorrelationMatrix([{ id: "A", returns: [0.01, 0.02] }])).toEqual([]);
  });

  it("builds pairwise correlations for multiple series", () => {
    const series: ReturnSeries[] = [
      { id: "A", returns: [0.01, 0.02, 0.03, 0.04, 0.05] },
      { id: "B", returns: [0.02, 0.04, 0.06, 0.08, 0.10] },
      { id: "C", returns: [0.05, 0.03, 0.01, -0.01, -0.03] },
    ];
    const matrix = buildCorrelationMatrix(series);
    // 3 assets → 3 pairs: AB, AC, BC
    expect(matrix).toHaveLength(3);
    expect(matrix[0].assetA).toBe("A");
    expect(matrix[0].assetB).toBe("B");
    expect(matrix[0].correlation).toBeCloseTo(1, 2); // A and B are perfectly correlated
    expect(matrix[1].correlation).toBeCloseTo(-1, 2); // A and C are inversely correlated
  });
});

// ─── Efficient frontier ────────────────────────────────────────────────────

describe("generateEfficientFrontier", () => {
  it("returns empty for empty input", () => {
    expect(generateEfficientFrontier([])).toEqual([]);
  });

  it("returns single point for single asset", () => {
    const series: ReturnSeries[] = [
      { id: "A", returns: [0.01, 0.02, -0.01, 0.03, 0.01] },
    ];
    const frontier = generateEfficientFrontier(series, 5, 252, 0.04);
    expect(frontier).toHaveLength(1);
    expect(frontier[0].weights.A).toBe(1);
  });

  it("generates frontier points for two assets", () => {
    const series: ReturnSeries[] = [
      { id: "BOND", returns: Array.from({ length: 60 }, () => 0.003 + (Math.random() - 0.5) * 0.005) },
      { id: "STOCK", returns: Array.from({ length: 60 }, () => 0.008 + (Math.random() - 0.5) * 0.03) },
    ];
    const frontier = generateEfficientFrontier(series, 10, 12, 0.04);
    expect(frontier.length).toBe(10);

    // Weights should sum to ~1 for each point
    for (const point of frontier) {
      const totalWeight = Object.values(point.weights).reduce((s, w) => s + w, 0);
      expect(totalWeight).toBeCloseTo(1, 2);
      expect(point.volatility).toBeGreaterThanOrEqual(0);
    }
  });

  it("generates frontier for three assets", () => {
    const series: ReturnSeries[] = [
      { id: "A", returns: Array.from({ length: 60 }, () => 0.005 + (Math.random() - 0.5) * 0.01) },
      { id: "B", returns: Array.from({ length: 60 }, () => 0.008 + (Math.random() - 0.5) * 0.02) },
      { id: "C", returns: Array.from({ length: 60 }, () => 0.003 + (Math.random() - 0.5) * 0.005) },
    ];
    const frontier = generateEfficientFrontier(series, 5, 12, 0.04);
    expect(frontier.length).toBe(5);

    for (const point of frontier) {
      const totalWeight = Object.values(point.weights).reduce((s, w) => s + w, 0);
      expect(totalWeight).toBeCloseTo(1, 1);
    }
  });
});

// ─── Risk parity ───────────────────────────────────────────────────────────

describe("computeRiskParity", () => {
  it("returns empty for no assets", () => {
    const result = computeRiskParity([]);
    expect(result.weights).toEqual({});
    expect(result.portfolioVolatility).toBe(0);
  });

  it("assigns equal weights to assets with equal volatility", () => {
    const returns = Array.from({ length: 60 }, () => 0.005 + (Math.random() - 0.5) * 0.01);
    const series: ReturnSeries[] = [
      { id: "A", returns: [...returns] },
      { id: "B", returns: [...returns] },
    ];
    const result = computeRiskParity(series, 12);
    expect(result.weights.A).toBeCloseTo(0.5, 1);
    expect(result.weights.B).toBeCloseTo(0.5, 1);
  });

  it("assigns higher weight to lower-volatility assets", () => {
    const series: ReturnSeries[] = [
      { id: "LOW_VOL", returns: Array.from({ length: 60 }, () => 0.003 + (Math.random() - 0.5) * 0.005) },
      { id: "HIGH_VOL", returns: Array.from({ length: 60 }, () => 0.008 + (Math.random() - 0.5) * 0.04) },
    ];
    const result = computeRiskParity(series, 12);
    expect(result.weights.LOW_VOL).toBeGreaterThan(result.weights.HIGH_VOL);
  });

  it("weights sum to 1", () => {
    const series: ReturnSeries[] = [
      { id: "A", returns: Array.from({ length: 60 }, () => (Math.random() - 0.5) * 0.02) },
      { id: "B", returns: Array.from({ length: 60 }, () => (Math.random() - 0.5) * 0.03) },
      { id: "C", returns: Array.from({ length: 60 }, () => (Math.random() - 0.5) * 0.01) },
    ];
    const result = computeRiskParity(series, 12);
    const totalWeight = Object.values(result.weights).reduce((s, w) => s + w, 0);
    expect(totalWeight).toBeCloseTo(1, 2);
  });

  it("risk contributions sum to ~1", () => {
    const series: ReturnSeries[] = [
      { id: "A", returns: Array.from({ length: 60 }, () => (Math.random() - 0.5) * 0.02) },
      { id: "B", returns: Array.from({ length: 60 }, () => (Math.random() - 0.5) * 0.03) },
    ];
    const result = computeRiskParity(series, 12);
    const totalRC = Object.values(result.riskContributions).reduce((s, v) => s + v, 0);
    expect(totalRC).toBeCloseTo(1, 1);
  });
});
