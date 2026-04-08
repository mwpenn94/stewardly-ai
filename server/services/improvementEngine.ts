/**
 * Continuous Improvement Engine — Task 8
 *
 * Tracks calculator usage signals, convergence metrics, and engine
 * accuracy to drive iterative platform improvements. Implements the
 * recursive optimization convergence pattern from the master prompt.
 */
import { logger } from "../_core/logger";

const log = logger.child({ module: "improvement-engine" });

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface UsageSignal {
  userId: string;
  engineType: "uwe" | "bie" | "he" | "scui";
  action: "simulate" | "compare" | "backPlan" | "monteCarlo" | "stressTest" | "backtest" | "report";
  inputHash: string;
  durationMs: number;
  resultSummary: {
    totalValue?: number;
    roi?: number;
    strategyCount?: number;
    scenarioCount?: number;
  };
  timestamp: number;
}

export interface ConvergenceMetric {
  metricName: string;
  currentValue: number;
  previousValue: number;
  delta: number;
  deltaPercent: number;
  isConverged: boolean;
  threshold: number;
  passNumber: number;
}

export interface ImprovementReport {
  generatedAt: string;
  totalSignals: number;
  engineUsage: Record<string, number>;
  actionUsage: Record<string, number>;
  avgDurationMs: Record<string, number>;
  convergenceMetrics: ConvergenceMetric[];
  overallConverged: boolean;
  consecutiveCleanPasses: number;
  recommendations: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// IN-MEMORY SIGNAL STORE (production: use DB)
// ═══════════════════════════════════════════════════════════════════════════

const signalStore: UsageSignal[] = [];
let passCounter = 0;
let consecutiveClean = 0;

export function recordSignal(signal: UsageSignal): void {
  signalStore.push(signal);
  log.debug({ engine: signal.engineType, action: signal.action, duration: signal.durationMs }, "Signal recorded");
}

// ═══════════════════════════════════════════════════════════════════════════
// CONVERGENCE TRACKING
// ═══════════════════════════════════════════════════════════════════════════

const CONVERGENCE_THRESHOLDS: Record<string, number> = {
  avgDuration: 0.05,        // 5% change threshold
  errorRate: 0.01,          // 1% absolute threshold
  usageGrowth: 0.02,        // 2% change threshold
  resultConsistency: 0.03,  // 3% variance threshold
};

interface MetricHistory {
  values: number[];
  timestamps: number[];
}

const metricHistory = new Map<string, MetricHistory>();

function trackMetric(name: string, value: number): ConvergenceMetric {
  const history = metricHistory.get(name) || { values: [], timestamps: [] };
  history.values.push(value);
  history.timestamps.push(Date.now());
  metricHistory.set(name, history);

  const prev = history.values.length >= 2 ? history.values[history.values.length - 2] : value;
  const delta = value - prev;
  const deltaPercent = prev !== 0 ? Math.abs(delta / prev) : 0;
  const threshold = CONVERGENCE_THRESHOLDS[name] || 0.05;

  return {
    metricName: name,
    currentValue: value,
    previousValue: prev,
    delta,
    deltaPercent,
    isConverged: deltaPercent <= threshold,
    threshold,
    passNumber: passCounter,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// IMPROVEMENT ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════

export function runImprovementPass(): ImprovementReport {
  passCounter++;
  const now = new Date().toISOString();

  // Engine usage counts
  const engineUsage: Record<string, number> = {};
  const actionUsage: Record<string, number> = {};
  const durationSums: Record<string, { total: number; count: number }> = {};

  for (const signal of signalStore) {
    engineUsage[signal.engineType] = (engineUsage[signal.engineType] || 0) + 1;
    actionUsage[signal.action] = (actionUsage[signal.action] || 0) + 1;

    const key = `${signal.engineType}.${signal.action}`;
    if (!durationSums[key]) durationSums[key] = { total: 0, count: 0 };
    durationSums[key].total += signal.durationMs;
    durationSums[key].count++;
  }

  const avgDurationMs: Record<string, number> = {};
  for (const [key, data] of Object.entries(durationSums)) {
    avgDurationMs[key] = data.count > 0 ? data.total / data.count : 0;
  }

  // Track convergence metrics
  const totalSignals = signalStore.length;
  const avgOverallDuration = totalSignals > 0
    ? signalStore.reduce((s, sig) => s + sig.durationMs, 0) / totalSignals
    : 0;

  const convergenceMetrics: ConvergenceMetric[] = [
    trackMetric("avgDuration", avgOverallDuration),
    trackMetric("usageGrowth", totalSignals),
  ];

  // Check if all metrics converged
  const allConverged = convergenceMetrics.every((m) => m.isConverged);

  if (allConverged) {
    consecutiveClean++;
  } else {
    consecutiveClean = 0;
  }

  // Generate recommendations
  const recommendations: string[] = [];

  // Check for underused engines
  const engineNames = ["uwe", "bie", "he", "scui"];
  for (const engine of engineNames) {
    if (!engineUsage[engine] || engineUsage[engine] < 5) {
      recommendations.push(`Engine "${engine}" has low usage (${engineUsage[engine] || 0}). Consider improving discoverability or adding guided workflows.`);
    }
  }

  // Check for slow operations
  for (const [key, avg] of Object.entries(avgDurationMs)) {
    if (avg > 5000) {
      recommendations.push(`Operation "${key}" averages ${(avg / 1000).toFixed(1)}s. Consider caching or pre-computation.`);
    }
  }

  // Check for feature gaps
  if (!actionUsage["monteCarlo"] || actionUsage["monteCarlo"] < 3) {
    recommendations.push("Monte Carlo simulations are underutilized. Consider adding a guided entry point from the strategy comparison view.");
  }

  if (!actionUsage["report"]) {
    recommendations.push("No PDF reports generated. Consider auto-suggesting report generation after strategy comparison.");
  }

  if (consecutiveClean >= 2) {
    recommendations.push("CONVERGENCE ACHIEVED: 2+ consecutive clean passes. System is stable.");
  }

  log.info({
    pass: passCounter,
    totalSignals,
    allConverged,
    consecutiveClean,
    recommendationCount: recommendations.length,
  }, "Improvement pass complete");

  return {
    generatedAt: now,
    totalSignals,
    engineUsage,
    actionUsage,
    avgDurationMs,
    convergenceMetrics,
    overallConverged: consecutiveClean >= 2,
    consecutiveCleanPasses: consecutiveClean,
    recommendations,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE PARITY VERIFICATION (Task 10 support)
// ═══════════════════════════════════════════════════════════════════════════

export interface ParityTestCase {
  name: string;
  engine: "uwe" | "bie" | "he";
  input: Record<string, any>;
  expectedOutput: Record<string, number>;
  tolerancePercent: number;
}

export interface ParityResult {
  testCase: string;
  passed: boolean;
  fields: Array<{
    field: string;
    expected: number;
    actual: number;
    deltaPercent: number;
    withinTolerance: boolean;
  }>;
}

/**
 * Verify engine output parity against reference test cases.
 * Used for HTML v7 ↔ TypeScript engine consistency checks.
 */
export function verifyParity(
  testCase: ParityTestCase,
  actualOutput: Record<string, number>,
): ParityResult {
  const fields = Object.entries(testCase.expectedOutput).map(([field, expected]) => {
    const actual = actualOutput[field] ?? 0;
    const deltaPercent = expected !== 0 ? Math.abs((actual - expected) / expected) * 100 : (actual === 0 ? 0 : 100);
    return {
      field,
      expected,
      actual,
      deltaPercent,
      withinTolerance: deltaPercent <= testCase.tolerancePercent,
    };
  });

  return {
    testCase: testCase.name,
    passed: fields.every((f) => f.withinTolerance),
    fields,
  };
}

/**
 * Get current improvement state summary
 */
export function getImprovementState(): {
  totalSignals: number;
  passCount: number;
  consecutiveClean: number;
  converged: boolean;
} {
  return {
    totalSignals: signalStore.length,
    passCount: passCounter,
    consecutiveClean,
    converged: consecutiveClean >= 2,
  };
}
