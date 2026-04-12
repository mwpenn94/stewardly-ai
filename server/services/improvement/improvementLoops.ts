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

// ─── Hypothesis Generator ──────────────────────────────────────────────
// Takes the output of runImprovementCycle and produces actionable
// hypotheses for the improvement engine to test. Each hypothesis has
// a measurable prediction, a proposed change, and success criteria.

export interface Hypothesis {
  id: string;
  source: "calibration" | "recommendation_quality" | "trigger_tuning" | "sensitivity" | "feature_gap" | "user_cluster";
  title: string;
  description: string;
  proposedChange: string;
  measurableOutcome: string;
  successThreshold: number;
  priority: "high" | "medium" | "low";
  estimatedEffortHours: number;
  autoTestable: boolean;
}

/**
 * Pure function: generates hypotheses from improvement cycle results.
 * Does NOT call LLM — produces structured hypotheses from the data
 * patterns detected by the 6 loops. Can be enriched with LLM
 * descriptions via `enrichHypothesesWithLLM` below.
 */
export function generateHypotheses(cycle: ImprovementCycleResult): Hypothesis[] {
  const hypotheses: Hypothesis[] = [];
  let counter = 0;
  const mkId = () => `hyp-${Date.now()}-${++counter}`;

  // From default calibration: if adjustments are proposed, hypothesize
  // that applying them will reduce prediction error
  for (const adj of cycle.defaultCalibration.proposedAdjustments) {
    if (adj.confidence >= 0.5) {
      hypotheses.push({
        id: mkId(),
        source: "calibration",
        title: `Calibrate ${adj.field} from ${adj.oldValue.toFixed(3)} to ${adj.newValue.toFixed(3)}`,
        description: adj.rationale,
        proposedChange: `Update engine default for ${adj.field} to ${adj.newValue.toFixed(3)}`,
        measurableOutcome: `Prediction error on ${adj.field} decreases by ≥20% in next cycle`,
        successThreshold: 0.2,
        priority: adj.confidence >= 0.8 ? "high" : "medium",
        estimatedEffortHours: 0.5,
        autoTestable: true,
      });
    }
  }

  // From recommendation quality: if acceptance rate is low, hypothesize
  // that adjusting recommendation thresholds will improve acceptance
  for (const adj of cycle.recommendationQuality.proposedAdjustments) {
    hypotheses.push({
      id: mkId(),
      source: "recommendation_quality",
      title: `Tune recommendation threshold: ${adj.field}`,
      description: adj.rationale,
      proposedChange: `Adjust ${adj.field} from ${adj.oldValue.toFixed(3)} to ${adj.newValue.toFixed(3)}`,
      measurableOutcome: `Recommendation acceptance rate increases by ≥10%`,
      successThreshold: 0.1,
      priority: "medium",
      estimatedEffortHours: 1,
      autoTestable: true,
    });
  }

  // From trigger tuning: threshold adjustments
  for (const adj of cycle.triggerTuning.proposedAdjustments) {
    hypotheses.push({
      id: mkId(),
      source: "trigger_tuning",
      title: `Adjust alert threshold: ${adj.field}`,
      description: adj.rationale,
      proposedChange: `Move ${adj.field} threshold from ${adj.oldValue} to ${adj.newValue}`,
      measurableOutcome: `False positive rate decreases by ≥15%`,
      successThreshold: 0.15,
      priority: adj.confidence >= 0.7 ? "high" : "low",
      estimatedEffortHours: 0.5,
      autoTestable: true,
    });
  }

  // From sensitivity ranking: highest-sensitivity inputs deserve
  // better default values or more prominent UI placement
  const topSensitive = cycle.sensitivityRanking.slice(0, 3);
  for (const item of topSensitive) {
    if (item.sensitivity > 0.5) {
      hypotheses.push({
        id: mkId(),
        source: "sensitivity",
        title: `Improve guidance for high-sensitivity input: ${item.metric}`,
        description: `${item.metric} has sensitivity ${item.sensitivity.toFixed(2)} — small changes in this input cause large outcome changes. Users may benefit from guardrails or contextual guidance.`,
        proposedChange: `Add inline guardrail warning when ${item.metric} deviates >2σ from population median`,
        measurableOutcome: `User-modified ${item.metric} values cluster closer to population median`,
        successThreshold: 0.15,
        priority: "medium",
        estimatedEffortHours: 2,
        autoTestable: false,
      });
    }
  }

  // From feature gaps: each unmatched competitor feature is a hypothesis
  for (const gap of cycle.featureGaps) {
    hypotheses.push({
      id: mkId(),
      source: "feature_gap",
      title: `Close feature gap: ${gap.feature} (${gap.competitor})`,
      description: `${gap.competitor} launched "${gap.feature}" (${gap.category}) on ${gap.launchedAt}. No equivalent exists in Stewardly.`,
      proposedChange: `Build equivalent of ${gap.feature}`,
      measurableOutcome: `Feature parity score for ${gap.category} increases`,
      successThreshold: 1,
      priority: gap.category === "compliance" ? "high" : "medium",
      estimatedEffortHours: gap.category === "ux" ? 8 : 16,
      autoTestable: false,
    });
  }

  // From user clusters: identify underserved clusters
  const clusterEntries = Object.entries(cycle.userClusters) as [UserCluster, number[]][];
  for (const [cluster, userIds] of clusterEntries) {
    if (userIds.length > 0) {
      hypotheses.push({
        id: mkId(),
        source: "user_cluster",
        title: `Tailor experience for "${cluster}" user segment (${userIds.length} users)`,
        description: `${userIds.length} users cluster as "${cluster}". This segment may benefit from tailored defaults, content emphasis, or UI density adjustments.`,
        proposedChange: `Create a ${cluster}-optimized preset in the recommendation engine`,
        measurableOutcome: `Engagement score for ${cluster} users increases by ≥10%`,
        successThreshold: 0.1,
        priority: userIds.length > 10 ? "high" : "low",
        estimatedEffortHours: 4,
        autoTestable: true,
      });
    }
  }

  // Sort by priority then estimated effort
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  hypotheses.sort((a, b) => {
    const pd = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pd !== 0) return pd;
    return a.estimatedEffortHours - b.estimatedEffortHours;
  });

  return hypotheses;
}

/**
 * Enriches hypotheses with LLM-generated descriptions and implementation plans.
 * This is the async LLM-dependent step — call only when contextualLLM is available.
 * Falls back to the original hypothesis text on LLM failure.
 */
export async function enrichHypothesesWithLLM(
  hypotheses: Hypothesis[],
  invokeLLM: (prompt: string) => Promise<string>,
): Promise<Hypothesis[]> {
  if (hypotheses.length === 0) return hypotheses;

  // Batch the top 5 hypotheses to avoid excessive LLM calls
  const toEnrich = hypotheses.slice(0, 5);
  const prompt = `You are a financial technology improvement analyst. For each hypothesis below, provide a one-sentence refined description and a concrete implementation plan (2-3 steps max).

${toEnrich.map((h, i) => `${i + 1}. [${h.source}] ${h.title}\n   Current: ${h.description}\n   Proposed: ${h.proposedChange}`).join("\n\n")}

Respond as JSON array: [{"index": 0, "description": "...", "plan": "..."}]`;

  try {
    const response = await invokeLLM(prompt);
    const enrichments = JSON.parse(response);
    if (Array.isArray(enrichments)) {
      for (const e of enrichments) {
        const idx = typeof e.index === "number" ? e.index : -1;
        if (idx >= 0 && idx < toEnrich.length) {
          if (e.description) toEnrich[idx].description = e.description;
          if (e.plan) toEnrich[idx].proposedChange = e.plan;
        }
      }
    }
  } catch {
    // LLM failure is non-fatal — hypotheses remain with their original text
  }

  return hypotheses;
}
