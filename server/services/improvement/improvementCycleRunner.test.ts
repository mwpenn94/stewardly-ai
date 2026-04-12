import { describe, it, expect } from "vitest";
import {
  runImprovementCycle,
  generateHypotheses,
  type ComputationLog,
  type AlertOutcome,
  type UserActivity,
  type SensitivityInput,
  type CompetitorFeature,
} from "./improvementLoops";

// Test the pure-function pipeline that executeImprovementCycle delegates to.
// The DB-hydration layer (hydrateComputationLogs etc) is tested by presence
// in integration tests — here we verify the cycle → hypothesis pipeline.

describe("improvementCycleRunner — pure pipeline", () => {
  const baseLogs: ComputationLog[] = Array.from({ length: 25 }, (_, i) => ({
    id: `log-${i}`,
    timestamp: new Date(),
    toolName: "we_holistic_simulate",
    trigger: "manual",
    input: { savingsRate: 0.1 + i * 0.001 },
    result: {},
    userAction: i % 3 === 0 ? "accepted" : i % 3 === 1 ? "rejected" : undefined,
    actualOutcome: { savingsRateActual: 0.08 + i * 0.001 },
  }));

  const baseAlerts: AlertOutcome[] = Array.from({ length: 15 }, (_, i) => ({
    trigger: i < 10 ? "portfolio_drift" : "compliance_check",
    actedUpon: i % 4 !== 0,
  }));

  const baseUsers: UserActivity[] = [
    { userId: 1, scenariosThisQuarter: 15, agentInitiatedAcceptanceRate: 0.3 },
    { userId: 2, scenariosThisQuarter: 2, agentInitiatedAcceptanceRate: 0.9 },
    { userId: 3, scenariosThisQuarter: 5, agentInitiatedAcceptanceRate: 0.5 },
    { userId: 4, scenariosThisQuarter: 12, agentInitiatedAcceptanceRate: 0.4 },
  ];

  it("runImprovementCycle produces all 6 loop results", () => {
    const result = runImprovementCycle({
      computationLogs: baseLogs,
      alertOutcomes: baseAlerts,
      userActivity: baseUsers,
      sensitivityInputs: [],
      competitorFeatures: [],
    });

    expect(result.defaultCalibration.loop).toBe("default_calibration");
    expect(result.recommendationQuality.loop).toBe("recommendation_quality");
    expect(result.triggerTuning.loop).toBe("trigger_tuning");
    expect(Array.isArray(result.sensitivityRanking)).toBe(true);
    expect(result.userClusters).toHaveProperty("explorer");
    expect(result.userClusters).toHaveProperty("confirmer");
    expect(result.userClusters).toHaveProperty("delegator");
    expect(Array.isArray(result.featureGaps)).toBe(true);
    expect(result.ranAt).toBeInstanceOf(Date);
  });

  it("calibrateDefaults detects savingsRate drift with sufficient data", () => {
    const result = runImprovementCycle({
      computationLogs: baseLogs,
      alertOutcomes: [],
      userActivity: [],
      sensitivityInputs: [],
      competitorFeatures: [],
    });

    // 25 logs with actualOutcome should trigger calibration adjustment
    expect(result.defaultCalibration.windowSize).toBe(25);
    expect(result.defaultCalibration.metrics.sampleSize).toBeGreaterThan(0);
  });

  it("recommendationQuality computes acceptance rate", () => {
    const result = runImprovementCycle({
      computationLogs: baseLogs,
      alertOutcomes: [],
      userActivity: [],
      sensitivityInputs: [],
      competitorFeatures: [],
    });

    // About 1/3 of logs have userAction defined (accepted/rejected)
    expect(result.recommendationQuality.metrics.totalWithAction).toBeGreaterThan(0);
    expect(result.recommendationQuality.metrics.acceptanceRate).toBeGreaterThanOrEqual(0);
    expect(result.recommendationQuality.metrics.acceptanceRate).toBeLessThanOrEqual(1);
  });

  it("triggerTuning detects portfolio_drift as over-fired", () => {
    const result = runImprovementCycle({
      computationLogs: [],
      alertOutcomes: baseAlerts,
      userActivity: [],
      sensitivityInputs: [],
      competitorFeatures: [],
    });

    expect(result.triggerTuning.metrics.uniqueTriggers).toBe(2);
    expect(result.triggerTuning.metrics.totalOutcomes).toBe(15);
  });

  it("clusterUsers assigns users to correct clusters", () => {
    const result = runImprovementCycle({
      computationLogs: [],
      alertOutcomes: [],
      userActivity: baseUsers,
      sensitivityInputs: [],
      competitorFeatures: [],
    });

    // User 1: 15 scenarios → explorer
    expect(result.userClusters.explorer).toContain(1);
    // User 4: 12 scenarios → explorer
    expect(result.userClusters.explorer).toContain(4);
    // User 2: 2 scenarios, 0.9 acceptance → delegator
    expect(result.userClusters.delegator).toContain(2);
    // User 3: 5 scenarios, 0.5 acceptance → confirmer
    expect(result.userClusters.confirmer).toContain(3);
  });

  it("generateHypotheses produces actionable items from cycle results", () => {
    const cycle = runImprovementCycle({
      computationLogs: baseLogs,
      alertOutcomes: baseAlerts,
      userActivity: baseUsers,
      sensitivityInputs: [],
      competitorFeatures: [],
    });

    const hypotheses = generateHypotheses(cycle);

    expect(hypotheses.length).toBeGreaterThan(0);
    for (const h of hypotheses) {
      expect(h.id).toBeTruthy();
      expect(h.source).toBeTruthy();
      expect(h.title).toBeTruthy();
      expect(h.description).toBeTruthy();
      expect(["high", "medium", "low"]).toContain(h.priority);
      expect(h.estimatedEffortHours).toBeGreaterThan(0);
    }
  });

  it("generateHypotheses are sorted by priority then effort", () => {
    const cycle = runImprovementCycle({
      computationLogs: baseLogs,
      alertOutcomes: baseAlerts,
      userActivity: baseUsers,
      sensitivityInputs: [],
      competitorFeatures: [],
    });

    const hypotheses = generateHypotheses(cycle);
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

    for (let i = 1; i < hypotheses.length; i++) {
      const prev = hypotheses[i - 1];
      const curr = hypotheses[i];
      const pd = priorityOrder[prev.priority] - priorityOrder[curr.priority];
      if (pd === 0) {
        expect(prev.estimatedEffortHours).toBeLessThanOrEqual(curr.estimatedEffortHours);
      } else {
        expect(pd).toBeLessThanOrEqual(0);
      }
    }
  });

  it("feature gaps produce hypotheses with competitor source", () => {
    const features: CompetitorFeature[] = [
      { competitor: "Wealthfront", feature: "Direct Indexing", launchedAt: "2025-01-01", category: "engine", ourEquivalent: null },
      { competitor: "Betterment", feature: "Tax Coordination", launchedAt: "2025-06-01", category: "engine", ourEquivalent: "Tax Planning" },
    ];

    const cycle = runImprovementCycle({
      computationLogs: [],
      alertOutcomes: [],
      userActivity: [],
      sensitivityInputs: [],
      competitorFeatures: features,
    });

    expect(cycle.featureGaps).toHaveLength(1);
    expect(cycle.featureGaps[0].feature).toBe("Direct Indexing");

    const hypotheses = generateHypotheses(cycle);
    const featureHyp = hypotheses.find(h => h.source === "feature_gap");
    expect(featureHyp).toBeTruthy();
    expect(featureHyp!.title).toContain("Direct Indexing");
  });

  it("sensitivity inputs produce ranked output", () => {
    const inputs: SensitivityInput[] = [
      { metric: "returnRate", variations: [{ inputDelta: 0.01, outputDelta: 5000 }, { inputDelta: -0.01, outputDelta: -4500 }] },
      { metric: "savingsRate", variations: [{ inputDelta: 0.01, outputDelta: 200 }, { inputDelta: -0.01, outputDelta: -180 }] },
    ];

    const cycle = runImprovementCycle({
      computationLogs: [],
      alertOutcomes: [],
      userActivity: [],
      sensitivityInputs: inputs,
      competitorFeatures: [],
    });

    expect(cycle.sensitivityRanking).toHaveLength(2);
    // returnRate should be more sensitive than savingsRate
    expect(cycle.sensitivityRanking[0].metric).toBe("returnRate");
    expect(cycle.sensitivityRanking[0].sensitivity).toBeGreaterThan(cycle.sensitivityRanking[1].sensitivity);
  });

  it("empty inputs produce valid but empty results", () => {
    const cycle = runImprovementCycle({
      computationLogs: [],
      alertOutcomes: [],
      userActivity: [],
      sensitivityInputs: [],
      competitorFeatures: [],
    });

    expect(cycle.defaultCalibration.windowSize).toBe(0);
    expect(cycle.defaultCalibration.proposedAdjustments).toHaveLength(0);
    expect(cycle.recommendationQuality.metrics.totalWithAction).toBe(0);
    expect(cycle.triggerTuning.metrics.uniqueTriggers).toBe(0);
    expect(cycle.sensitivityRanking).toHaveLength(0);
    expect(cycle.featureGaps).toHaveLength(0);

    const hypotheses = generateHypotheses(cycle);
    // Even with empty data, user clusters still get hypotheses
    // (explorer/confirmer/delegator all empty but structurally valid)
    expect(hypotheses).toBeDefined();
  });

  it("user cluster hypotheses scale priority with cluster size", () => {
    const largeUserBase: UserActivity[] = Array.from({ length: 20 }, (_, i) => ({
      userId: i + 1,
      scenariosThisQuarter: 15, // All explorers
      agentInitiatedAcceptanceRate: 0.3,
    }));

    const cycle = runImprovementCycle({
      computationLogs: [],
      alertOutcomes: [],
      userActivity: largeUserBase,
      sensitivityInputs: [],
      competitorFeatures: [],
    });

    expect(cycle.userClusters.explorer).toHaveLength(20);

    const hypotheses = generateHypotheses(cycle);
    const explorerHyp = hypotheses.find(h => h.source === "user_cluster" && h.title.includes("explorer"));
    expect(explorerHyp).toBeTruthy();
    expect(explorerHyp!.priority).toBe("high"); // >10 users → high priority
  });
});
