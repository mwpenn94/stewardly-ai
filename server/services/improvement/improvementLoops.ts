/**
 * Continuous improvement engine — Phase 7B.
 *
 * Six learning loops that run on different schedules and feed back into
 * the engine defaults, recommendation weighting, and trigger thresholds.
 *
 *  1. Default calibration       (quarterly)
 *  2. Recommendation quality    (monthly)
 *  3. Sensitivity analysis      (weekly)
 *  4. Trigger tuning            (monthly)
 *  5. User behavior clustering  (quarterly)
 *  6. Competitive feature track (quarterly — manual)
 *
 * Each loop is a pure analyzer that takes a `ComputationLog[]` window
 * and returns a `LoopResult`. The cron scheduler is responsible for
 * fetching the right window from `model_runs` and persisting the
 * proposed adjustments.
 */

export interface ComputationLog {
  id: string;
  timestamp: Date;
  toolName: string;
  trigger: string;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  userAction?: "accepted" | "rejected" | "modified" | "ignored";
  actualOutcome?: Record<string, number>;
}

export interface LoopResult {
  loop: string;
  windowSize: number;
  proposedAdjustments: Array<{
    field: string;
    oldValue: number;
    newValue: number;
    confidence: number;
    rationale: string;
  }>;
  metrics: Record<string, number>;
}

// ─── Loop 1: Default calibration ─────────────────────────────────────────
// Compare projected savings rates / return rates / inflation against
// observed actuals from Plaid-tagged outcomes. Adjust the engine
// defaults toward population-validated values.

export function calibrateDefaults(logs: ComputationLog[]): LoopResult {
  const projected: number[] = [];
  const actual: number[] = [];

  for (const log of logs) {
    if (log.actualOutcome?.savingsRateActual && log.input.savingsRate) {
      projected.push(Number(log.input.savingsRate));
      actual.push(log.actualOutcome.savingsRateActual);
    }
  }

  const projectedAvg =
    projected.length > 0
      ? projected.reduce((a, b) => a + b, 0) / projected.length
      : 0;
  const actualAvg =
    actual.length > 0
      ? actual.reduce((a, b) => a + b, 0) / actual.length
      : 0;

  const proposed: LoopResult["proposedAdjustments"] = [];
  if (projected.length >= 10 && Math.abs(projectedAvg - actualAvg) > 0.02) {
    proposed.push({
      field: "savingsRate.default",
      oldValue: projectedAvg,
      newValue: actualAvg,
      confidence: Math.min(0.9, projected.length / 100),
      rationale: `Sample of ${projected.length} actuals shows ${(actualAvg * 100).toFixed(1)}% vs projected ${(projectedAvg * 100).toFixed(1)}%.`,
    });
  }

  return {
    loop: "default_calibration",
    windowSize: logs.length,
    proposedAdjustments: proposed,
    metrics: {
      projectedAvg,
      actualAvg,
      sampleSize: projected.length,
    },
  };
}

// ─── Loop 2: Recommendation quality ──────────────────────────────────────
// Track which recommendations users accept vs reject; weight future
// recommendations by historical acceptance rate.

export function analyzeRecommendationQuality(
  logs: ComputationLog[],
): LoopResult {
  const byAction: Record<string, number> = {
    accepted: 0,
    rejected: 0,
    modified: 0,
    ignored: 0,
  };
  let totalWithAction = 0;
  for (const log of logs) {
    if (log.userAction) {
      byAction[log.userAction] = (byAction[log.userAction] ?? 0) + 1;
      totalWithAction++;
    }
  }
  const acceptanceRate =
    totalWithAction > 0 ? byAction.accepted / totalWithAction : 0;
  const rejectionRate =
    totalWithAction > 0 ? byAction.rejected / totalWithAction : 0;

  const proposed: LoopResult["proposedAdjustments"] = [];
  if (totalWithAction >= 20 && acceptanceRate < 0.5) {
    proposed.push({
      field: "recommendation.confidenceThreshold",
      oldValue: 0.7,
      newValue: 0.8,
      confidence: 0.7,
      rationale: `Acceptance rate ${(acceptanceRate * 100).toFixed(0)}% below 50% — tighten confidence threshold.`,
    });
  }

  return {
    loop: "recommendation_quality",
    windowSize: logs.length,
    proposedAdjustments: proposed,
    metrics: {
      totalWithAction,
      accepted: byAction.accepted,
      rejected: byAction.rejected,
      modified: byAction.modified,
      ignored: byAction.ignored,
      acceptanceRate,
      rejectionRate,
    },
  };
}

// ─── Loop 3: Sensitivity analysis ────────────────────────────────────────
// For each engine, identify which inputs cause the largest output
// swings. Surfaces "your plan is most sensitive to X" hints.

export interface SensitivityInput {
  metric: string;
  variations: Array<{ inputDelta: number; outputDelta: number }>;
}

export function rankInputSensitivity(
  inputs: SensitivityInput[],
): Array<{ metric: string; sensitivity: number }> {
  return inputs
    .map((s) => {
      // sensitivity = average abs(outputDelta / inputDelta) across variations
      const ratios = s.variations
        .filter((v) => v.inputDelta !== 0)
        .map((v) => Math.abs(v.outputDelta / v.inputDelta));
      const avg =
        ratios.length > 0
          ? ratios.reduce((a, b) => a + b, 0) / ratios.length
          : 0;
      return { metric: s.metric, sensitivity: avg };
    })
    .sort((a, b) => b.sensitivity - a.sensitivity);
}

// ─── Loop 4: Trigger tuning ──────────────────────────────────────────────
// Track act-upon vs dismiss rates for proactive alerts. Loosen or
// tighten thresholds based on the ratio.

export interface AlertOutcome {
  trigger: string;
  actedUpon: boolean;
}

export function tuneAlertThresholds(
  outcomes: AlertOutcome[],
): LoopResult {
  const byTrigger: Record<string, { fired: number; acted: number }> = {};
  for (const o of outcomes) {
    if (!byTrigger[o.trigger]) byTrigger[o.trigger] = { fired: 0, acted: 0 };
    byTrigger[o.trigger].fired++;
    if (o.actedUpon) byTrigger[o.trigger].acted++;
  }
  const proposed: LoopResult["proposedAdjustments"] = [];
  for (const [trigger, counts] of Object.entries(byTrigger)) {
    if (counts.fired < 10) continue;
    const rate = counts.acted / counts.fired;
    if (rate < 0.3) {
      proposed.push({
        field: `${trigger}.threshold`,
        oldValue: 1,
        newValue: 1.2, // widen by 20%
        confidence: 0.6,
        rationale: `Only ${(rate * 100).toFixed(0)}% acted upon — widen threshold.`,
      });
    } else if (rate > 0.8) {
      proposed.push({
        field: `${trigger}.threshold`,
        oldValue: 1,
        newValue: 0.8, // tighten by 20%
        confidence: 0.6,
        rationale: `${(rate * 100).toFixed(0)}% acted upon — tighten threshold.`,
      });
    }
  }
  return {
    loop: "trigger_tuning",
    windowSize: outcomes.length,
    proposedAdjustments: proposed,
    metrics: {
      uniqueTriggers: Object.keys(byTrigger).length,
      totalOutcomes: outcomes.length,
    },
  };
}

// ─── Loop 5: User behavior clustering ────────────────────────────────────
// Identify usage patterns: explorers (many scenarios), confirmers (one
// scenario), delegators (trust agent). Used to tailor agent verbosity.

export interface UserActivity {
  userId: number;
  scenariosThisQuarter: number;
  agentInitiatedAcceptanceRate: number;
}

export type UserCluster = "explorer" | "confirmer" | "delegator";

export function clusterUsers(
  activity: UserActivity[],
): Record<UserCluster, number[]> {
  const clusters: Record<UserCluster, number[]> = {
    explorer: [],
    confirmer: [],
    delegator: [],
  };
  for (const u of activity) {
    if (u.scenariosThisQuarter >= 10) {
      clusters.explorer.push(u.userId);
    } else if (u.agentInitiatedAcceptanceRate >= 0.7) {
      clusters.delegator.push(u.userId);
    } else {
      clusters.confirmer.push(u.userId);
    }
  }
  return clusters;
}

// ─── Loop 6: Competitive feature tracking (manual) ──────────────────────
// Manual loop — surfaces a list of known competitor feature launches
// the team can score. We expose the data shape so the admin dashboard
// can render it; the actual entries are populated by the team.

export interface CompetitorFeature {
  competitor: string;
  feature: string;
  launchedAt: string;
  category: "ux" | "engine" | "data" | "compliance";
  ourEquivalent: string | null;
}

export function findFeatureGaps(
  features: CompetitorFeature[],
): CompetitorFeature[] {
  return features.filter((f) => f.ourEquivalent === null);
}

// ─── Convenience: run all loops in one shot ──────────────────────────────

export interface ImprovementCycleInput {
  computationLogs: ComputationLog[];
  alertOutcomes: AlertOutcome[];
  userActivity: UserActivity[];
  sensitivityInputs: SensitivityInput[];
  competitorFeatures: CompetitorFeature[];
}

export interface ImprovementCycleResult {
  defaultCalibration: LoopResult;
  recommendationQuality: LoopResult;
  triggerTuning: LoopResult;
  sensitivityRanking: Array<{ metric: string; sensitivity: number }>;
  userClusters: Record<UserCluster, number[]>;
  featureGaps: CompetitorFeature[];
  ranAt: Date;
}

export function runImprovementCycle(
  input: ImprovementCycleInput,
): ImprovementCycleResult {
  return {
    defaultCalibration: calibrateDefaults(input.computationLogs),
    recommendationQuality: analyzeRecommendationQuality(input.computationLogs),
    triggerTuning: tuneAlertThresholds(input.alertOutcomes),
    sensitivityRanking: rankInputSensitivity(input.sensitivityInputs),
    userClusters: clusterUsers(input.userActivity),
    featureGaps: findFeatureGaps(input.competitorFeatures),
    ranAt: new Date(),
  };
}
