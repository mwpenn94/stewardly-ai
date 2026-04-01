/**
 * Recursive Improvement Engine — Tests
 *
 * 10 tests covering signal detection, convergence, and anti-regression.
 */
import { describe, it, expect, vi } from "vitest";
import {
  detectSignals,
  checkConvergence,
  antiRegressionCheck,
  type QualityDimensions,
} from "./improvementEngine";

// ── Mock DB helper ───────────────────────────────────────────────────────────

/**
 * Creates a chainable mock DB that tracks calls and returns configured results.
 * Each call to db.select().from().where() resolves to the next value in `results`.
 */
function createChainedMockDb(results: any[], executeResult: any = [[{ cnt: 0 }]]) {
  let callIdx = 0;

  const makeChain = () => {
    const chain: any = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.from = vi.fn().mockReturnValue(chain);
    chain.innerJoin = vi.fn().mockReturnValue(chain);
    chain.groupBy = vi.fn().mockImplementation(() => {
      const result = results[callIdx] ?? [];
      callIdx++;
      return Promise.resolve(result);
    });
    chain.where = vi.fn().mockImplementation(() => {
      const result = results[callIdx] ?? [];
      callIdx++;
      // Return a thenable that also has .then, .groupBy, .innerJoin
      const thenable: any = Promise.resolve(result);
      thenable.then = (cb: any) => {
        if (cb) return Promise.resolve(result).then(cb);
        return Promise.resolve(result);
      };
      thenable.groupBy = vi.fn().mockImplementation(() => {
        return Promise.resolve(result);
      });
      thenable.innerJoin = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(result),
      });
      return thenable;
    });
    chain.execute = vi.fn().mockResolvedValue(executeResult);
    return chain;
  };

  return makeChain();
}

// ── Signal Detection Tests ───────────────────────────────────────────────────

describe("detectSignals", () => {
  it("FUNDAMENTAL signal fires when bypass rate > 20%", async () => {
    // Results sequence: [total=100, bypass=30, ...rest empty]
    const db = createChainedMockDb([
      [{ cnt: 100 }], // total assistant messages in 24h
      [{ cnt: 30 }],  // bypass messages (30% > 20% threshold)
      [],              // LANDSCAPE: active tools
      [],              // DEPTH: quality scores
      [],              // ADVERSARIAL: promoted hypotheses
      [],              // FUTURE_STATE: recent models
      [],              // FUTURE_STATE: all models
    ]);

    const signals = await detectSignals(db);
    const fundamental = signals.find((s) => s.signalType === "FUNDAMENTAL");
    expect(fundamental).toBeDefined();
    expect(fundamental!.severity).toBe("critical");
    expect(fundamental!.sourceMetric).toBe("contextualLLM_bypass_rate");
  });

  it("FUNDAMENTAL signal does NOT fire when bypass rate < 20%", async () => {
    const db = createChainedMockDb([
      [{ cnt: 100 }], // total
      [{ cnt: 10 }],  // bypass (10% < 20%)
      [],              // rest empty
      [],
      [],
      [],
      [],
    ]);

    const signals = await detectSignals(db);
    const fundamental = signals.find((s) => s.signalType === "FUNDAMENTAL");
    expect(fundamental).toBeUndefined();
  });

  it("LANDSCAPE signal fires for unused active tool", async () => {
    const db = createChainedMockDb([
      [{ cnt: 0 }],   // FUNDAMENTAL: total (0 → skip)
      [{ cnt: 0 }],   // FUNDAMENTAL: bypass
      // LANDSCAPE: the .then() callback receives tools list
      [{ toolName: "calculator", toolId: 1 }, { toolName: "report_gen", toolId: 2 }],
      [{ cnt: 0 }],   // tool 1 call count = 0
      [{ cnt: 0 }],   // tool 2 call count = 0
      [],              // DEPTH: quality scores
      [],              // ADVERSARIAL: promoted
      [],              // FUTURE_STATE: recent models
      [],              // FUTURE_STATE: all models
    ]);

    const signals = await detectSignals(db);
    const landscape = signals.find((s) => s.signalType === "LANDSCAPE");
    expect(landscape).toBeDefined();
    expect(landscape!.severity).toBe("medium");
    expect(landscape!.sourceValue).toContain("calculator");
  });

  it("DEPTH signal fires for clustered quality scores", async () => {
    // 15 scores, 12 in top bucket (80% > 60% threshold)
    const clusteredScores = [
      ...Array(12).fill(null).map(() => ({ score: 0.95 })),
      { score: 0.5 },
      { score: 0.6 },
      { score: 0.7 },
    ];

    const db = createChainedMockDb([
      [{ cnt: 0 }],     // FUNDAMENTAL: total
      [{ cnt: 0 }],     // FUNDAMENTAL: bypass
      [],                // LANDSCAPE: tools
      clusteredScores,   // DEPTH: quality scores
      [],                // ADVERSARIAL: promoted
      [],                // FUTURE_STATE: recent
      [],                // FUTURE_STATE: all
    ]);

    const signals = await detectSignals(db);
    const depth = signals.find((s) => s.signalType === "DEPTH");
    expect(depth).toBeDefined();
    expect(depth!.severity).toBe("medium");
    expect(depth!.sourceMetric).toBe("quality_score_clustering");
  });

  it("ADVERSARIAL signal fires for retry-after-cache events", async () => {
    const db = createChainedMockDb(
      [
        [{ cnt: 0 }], // FUNDAMENTAL
        [{ cnt: 0 }],
        [],            // LANDSCAPE
        [],            // DEPTH
        [],            // ADVERSARIAL promoted
        [],            // FUTURE_STATE
        [],
      ],
      [[{ cnt: 8 }]], // execute result: 8 retry events > 5 threshold
    );

    const signals = await detectSignals(db);
    const adversarial = signals.find(
      (s) => s.signalType === "ADVERSARIAL" && s.sourceMetric === "retry_after_cache",
    );
    expect(adversarial).toBeDefined();
    expect(adversarial!.severity).toBe("high");
  });
});

// ── Convergence Tests ────────────────────────────────────────────────────────

describe("checkConvergence", () => {
  it("convergence detected when 3 windows below 10%", async () => {
    const db = createChainedMockDb([
      [{ cnt: 50 }],  // total hypotheses in 30 days
      [{ cnt: 3 }],   // promoted in 30 days (6%)
      [{ cnt: 20 }],  // window 1 total
      [{ cnt: 1 }],   // window 1 promoted (5%)
      [{ cnt: 15 }],  // window 2 total
      [{ cnt: 1 }],   // window 2 promoted (6.7%)
      [{ cnt: 15 }],  // window 3 total
      [{ cnt: 1 }],   // window 3 promoted (6.7%)
    ]);

    const result = await checkConvergence(db);
    expect(result.status).toBe("CONVERGED");
    expect(result.windows).toHaveLength(3);
    expect(result.windows!.every((w) => w.rate < 0.10)).toBe(true);
  });

  it("convergence NOT declared if only 2 windows below threshold", async () => {
    const db = createChainedMockDb([
      [{ cnt: 50 }],  // total
      [{ cnt: 8 }],   // promoted (16%)
      [{ cnt: 20 }],  // window 1 total
      [{ cnt: 5 }],   // window 1 promoted (25%) — ABOVE threshold
      [{ cnt: 15 }],  // window 2 total
      [{ cnt: 1 }],   // window 2 promoted (6.7%)
      [{ cnt: 15 }],  // window 3 total
      [{ cnt: 1 }],   // window 3 promoted (6.7%)
    ]);

    const result = await checkConvergence(db);
    expect(result.status).toBe("ACTIVE");
  });
});

// ── Anti-Regression Tests ────────────────────────────────────────────────────

describe("antiRegressionCheck", () => {
  const baseDimensions: QualityDimensions = {
    accuracy: 0.85,
    latency: 0.80,
    user_satisfaction: 0.90,
    cost_efficiency: 0.75,
    reliability: 0.88,
  };

  it("catches regression when z < -1.5", () => {
    // 20 historical scores with very small variance (~0.01 stddev)
    const historical: QualityDimensions[] = Array.from({ length: 20 }, (_, i) => ({
      accuracy: 0.85 + (i % 2 === 0 ? 0.005 : -0.005),
      latency: 0.80 + (i % 2 === 0 ? 0.005 : -0.005),
      user_satisfaction: 0.90 + (i % 2 === 0 ? 0.005 : -0.005),
      cost_efficiency: 0.75 + (i % 2 === 0 ? 0.005 : -0.005),
      reliability: 0.88 + (i % 2 === 0 ? 0.005 : -0.005),
    }));

    const after: QualityDimensions = {
      ...baseDimensions,
      accuracy: 0.70, // Big drop: delta = -0.15, stddev ≈ 0.005, z ≈ -30
    };

    const result = antiRegressionCheck(baseDimensions, after, historical);
    expect(result.regressed).toBe(true);
    expect(result.dimension).toBe("accuracy");
    expect(result.zScore!).toBeLessThan(-1.5);
  });

  it("passes when improvement is positive", () => {
    const historical: QualityDimensions[] = Array.from({ length: 20 }, (_, i) => ({
      accuracy: 0.85 + (i % 2 === 0 ? 0.005 : -0.005),
      latency: 0.80 + (i % 2 === 0 ? 0.005 : -0.005),
      user_satisfaction: 0.90 + (i % 2 === 0 ? 0.005 : -0.005),
      cost_efficiency: 0.75 + (i % 2 === 0 ? 0.005 : -0.005),
      reliability: 0.88 + (i % 2 === 0 ? 0.005 : -0.005),
    }));

    const after: QualityDimensions = {
      accuracy: 0.90,
      latency: 0.85,
      user_satisfaction: 0.92,
      cost_efficiency: 0.80,
      reliability: 0.90,
    };

    const result = antiRegressionCheck(baseDimensions, after, historical);
    expect(result.regressed).toBe(false);
  });

  it("fallback works with < 10 data points (>5% decline = regression)", () => {
    const fewHistorical: QualityDimensions[] = Array.from({ length: 5 }, () => ({
      ...baseDimensions,
    }));

    const after: QualityDimensions = {
      ...baseDimensions,
      latency: 0.70, // 12.5% decline from 0.80
    };

    const result = antiRegressionCheck(baseDimensions, after, fewHistorical);
    expect(result.regressed).toBe(true);
    expect(result.dimension).toBe("latency");
  });
});
