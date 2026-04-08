/**
 * Phase 7 improvement engine tests — exercises plaidPerception triggers
 * and the 6 improvement loops without hitting the database or Plaid.
 *
 * Every function under test is pure, so the tests are fast and stable.
 */

import { describe, it, expect } from "vitest";

import {
  evaluateBalanceDivergence,
  evaluateCommissionPatternChange,
  evaluateLargeExpense,
  evaluateNew401kContribution,
  evaluateAllocationDrift,
  scanForPerceptionTriggers,
  type PerceptionSnapshot,
} from "./plaidPerception";
import {
  calibrateDefaults,
  analyzeRecommendationQuality,
  rankInputSensitivity,
  tuneAlertThresholds,
  clusterUsers,
  findFeatureGaps,
  runImprovementCycle,
  type ComputationLog,
  type AlertOutcome,
  type UserActivity,
  type SensitivityInput,
  type CompetitorFeature,
} from "./improvementLoops";

// ═══════════════════════════════════════════════════════════════════════════
// Phase 7A — Plaid perception
// ═══════════════════════════════════════════════════════════════════════════

describe("Phase 7A — Plaid perception", () => {
  describe("evaluateBalanceDivergence", () => {
    it("returns null when within 10% threshold", () => {
      expect(
        evaluateBalanceDivergence({
          actualBalance: 1_005_000,
          projectedBalance: 1_000_000,
        }),
      ).toBeNull();
    });

    it("fires warn when 12% drift", () => {
      const t = evaluateBalanceDivergence({
        actualBalance: 1_120_000,
        projectedBalance: 1_000_000,
      });
      expect(t?.severity).toBe("warn");
    });

    it("fires urgent when >20% drift", () => {
      const t = evaluateBalanceDivergence({
        actualBalance: 1_300_000,
        projectedBalance: 1_000_000,
      });
      expect(t?.severity).toBe("urgent");
    });

    it("returns null when projection is zero", () => {
      expect(
        evaluateBalanceDivergence({
          actualBalance: 100,
          projectedBalance: 0,
        }),
      ).toBeNull();
    });
  });

  describe("evaluateCommissionPatternChange", () => {
    it("fires when this month >25% above avg", () => {
      const t = evaluateCommissionPatternChange({
        thisMonthCommissions: 14_000,
        trailing12MonthAvg: 10_000,
      });
      expect(t?.kind).toBe("commission_pattern_change");
    });

    it("returns null when within band", () => {
      expect(
        evaluateCommissionPatternChange({
          thisMonthCommissions: 11_000,
          trailing12MonthAvg: 10_000,
        }),
      ).toBeNull();
    });

    it("returns null when avg is zero", () => {
      expect(
        evaluateCommissionPatternChange({
          thisMonthCommissions: 5000,
          trailing12MonthAvg: 0,
        }),
      ).toBeNull();
    });
  });

  describe("evaluateLargeExpense", () => {
    it("fires for $30K uncategorized expense", () => {
      const t = evaluateLargeExpense({
        amount: 30_000,
        monthlyIncome: 10_000,
        isCategorized: false,
      });
      expect(t?.severity).toBe("urgent");
    });

    it("fires for $1500 uncategorized when 15% of monthly income", () => {
      const t = evaluateLargeExpense({
        amount: 1500,
        monthlyIncome: 10_000,
        isCategorized: false,
      });
      expect(t?.severity).toBe("warn");
    });

    it("does not fire when categorized", () => {
      expect(
        evaluateLargeExpense({
          amount: 30_000,
          monthlyIncome: 10_000,
          isCategorized: true,
        }),
      ).toBeNull();
    });
  });

  describe("evaluateNew401kContribution", () => {
    it("fires for first-time contribution", () => {
      const t = evaluateNew401kContribution({
        contributionAmount: 5000,
        hasExistingContributions: false,
      });
      expect(t?.recommendedAction).toContain("Roth");
    });

    it("does not fire when existing contributions", () => {
      expect(
        evaluateNew401kContribution({
          contributionAmount: 5000,
          hasExistingContributions: true,
        }),
      ).toBeNull();
    });
  });

  describe("evaluateAllocationDrift", () => {
    it("fires when drift > 5%", () => {
      const t = evaluateAllocationDrift({
        currentEquityPct: 0.78,
        targetEquityPct: 0.7,
      });
      expect(t?.kind).toBe("allocation_drift");
    });

    it("returns null when drift <= 5%", () => {
      expect(
        evaluateAllocationDrift({
          currentEquityPct: 0.72,
          targetEquityPct: 0.7,
        }),
      ).toBeNull();
    });

    it("escalates to warn when drift > 10%", () => {
      const t = evaluateAllocationDrift({
        currentEquityPct: 0.85,
        targetEquityPct: 0.7,
      });
      expect(t?.severity).toBe("warn");
    });
  });

  describe("scanForPerceptionTriggers", () => {
    it("returns empty when no triggers fire", () => {
      const snapshot: PerceptionSnapshot = {
        balance: { actualBalance: 1_000_000, projectedBalance: 1_000_000 },
      };
      expect(scanForPerceptionTriggers(snapshot)).toEqual([]);
    });

    it("returns multiple triggers when many conditions met", () => {
      const snapshot: PerceptionSnapshot = {
        balance: { actualBalance: 1_300_000, projectedBalance: 1_000_000 },
        commission: { thisMonthCommissions: 20_000, trailing12MonthAvg: 10_000 },
        allocation: { currentEquityPct: 0.85, targetEquityPct: 0.7 },
      };
      const triggers = scanForPerceptionTriggers(snapshot);
      expect(triggers.length).toBe(3);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Phase 7B — Improvement loops
// ═══════════════════════════════════════════════════════════════════════════

const fakeLog = (overrides: Partial<ComputationLog> = {}): ComputationLog => ({
  id: "log-1",
  timestamp: new Date(),
  toolName: "he.simulate",
  trigger: "user_ui",
  input: {},
  result: {},
  ...overrides,
});

describe("Phase 7B — improvement loops", () => {
  describe("calibrateDefaults", () => {
    it("returns no adjustments for empty logs", () => {
      const r = calibrateDefaults([]);
      expect(r.proposedAdjustments).toEqual([]);
    });

    it("proposes adjustment when projected != actual across many samples", () => {
      const logs: ComputationLog[] = [];
      for (let i = 0; i < 15; i++) {
        logs.push(
          fakeLog({
            input: { savingsRate: 0.15 },
            actualOutcome: { savingsRateActual: 0.08 },
          }),
        );
      }
      const r = calibrateDefaults(logs);
      expect(r.proposedAdjustments.length).toBe(1);
      expect(r.proposedAdjustments[0].field).toBe("savingsRate.default");
    });

    it("does not propose adjustment when projected ≈ actual", () => {
      const logs: ComputationLog[] = [];
      for (let i = 0; i < 15; i++) {
        logs.push(
          fakeLog({
            input: { savingsRate: 0.15 },
            actualOutcome: { savingsRateActual: 0.155 },
          }),
        );
      }
      const r = calibrateDefaults(logs);
      expect(r.proposedAdjustments.length).toBe(0);
    });
  });

  describe("analyzeRecommendationQuality", () => {
    it("computes acceptance rate", () => {
      const logs: ComputationLog[] = [
        fakeLog({ userAction: "accepted" }),
        fakeLog({ userAction: "accepted" }),
        fakeLog({ userAction: "rejected" }),
        fakeLog({ userAction: "ignored" }),
      ];
      const r = analyzeRecommendationQuality(logs);
      expect(r.metrics.acceptanceRate).toBeCloseTo(0.5);
    });

    it("proposes tighter threshold when acceptance is low", () => {
      const logs: ComputationLog[] = [];
      for (let i = 0; i < 25; i++) {
        logs.push(
          fakeLog({ userAction: i < 5 ? "accepted" : "rejected" }),
        );
      }
      const r = analyzeRecommendationQuality(logs);
      expect(r.proposedAdjustments.length).toBe(1);
      expect(r.proposedAdjustments[0].field).toContain("confidenceThreshold");
    });
  });

  describe("rankInputSensitivity", () => {
    it("ranks higher sensitivity first", () => {
      const inputs: SensitivityInput[] = [
        {
          metric: "investmentReturn",
          variations: [
            { inputDelta: 0.01, outputDelta: 50_000 },
            { inputDelta: 0.02, outputDelta: 100_000 },
          ],
        },
        {
          metric: "savingsRate",
          variations: [
            { inputDelta: 0.05, outputDelta: 25_000 },
          ],
        },
      ];
      const ranked = rankInputSensitivity(inputs);
      expect(ranked[0].metric).toBe("investmentReturn");
    });

    it("returns 0 sensitivity when inputDelta is 0", () => {
      const ranked = rankInputSensitivity([
        {
          metric: "noChange",
          variations: [{ inputDelta: 0, outputDelta: 100 }],
        },
      ]);
      expect(ranked[0].sensitivity).toBe(0);
    });
  });

  describe("tuneAlertThresholds", () => {
    it("widens threshold when fewer than 30% acted upon", () => {
      const outcomes: AlertOutcome[] = [];
      for (let i = 0; i < 15; i++) {
        outcomes.push({ trigger: "guardrail", actedUpon: i < 3 });
      }
      const r = tuneAlertThresholds(outcomes);
      const adj = r.proposedAdjustments.find((a) => a.field.includes("guardrail"));
      expect(adj?.newValue).toBeGreaterThan(adj?.oldValue ?? 0);
    });

    it("tightens threshold when over 80% acted upon", () => {
      const outcomes: AlertOutcome[] = [];
      for (let i = 0; i < 15; i++) {
        outcomes.push({ trigger: "roth_window", actedUpon: i < 14 });
      }
      const r = tuneAlertThresholds(outcomes);
      const adj = r.proposedAdjustments.find((a) =>
        a.field.includes("roth_window"),
      );
      expect(adj?.newValue).toBeLessThan(adj?.oldValue ?? 1);
    });
  });

  describe("clusterUsers", () => {
    it("classifies into explorer / confirmer / delegator", () => {
      const activity: UserActivity[] = [
        { userId: 1, scenariosThisQuarter: 12, agentInitiatedAcceptanceRate: 0.5 },
        { userId: 2, scenariosThisQuarter: 1, agentInitiatedAcceptanceRate: 0.8 },
        { userId: 3, scenariosThisQuarter: 2, agentInitiatedAcceptanceRate: 0.3 },
      ];
      const clusters = clusterUsers(activity);
      expect(clusters.explorer).toEqual([1]);
      expect(clusters.delegator).toEqual([2]);
      expect(clusters.confirmer).toEqual([3]);
    });
  });

  describe("findFeatureGaps", () => {
    it("returns features with no equivalent", () => {
      const features: CompetitorFeature[] = [
        {
          competitor: "RightCapital",
          feature: "Goal-based planning",
          launchedAt: "2024-01-01",
          category: "ux",
          ourEquivalent: "Goal mode in /retirement",
        },
        {
          competitor: "eMoney",
          feature: "Vault encryption",
          launchedAt: "2024-06-01",
          category: "compliance",
          ourEquivalent: null,
        },
      ];
      const gaps = findFeatureGaps(features);
      expect(gaps.length).toBe(1);
      expect(gaps[0].feature).toBe("Vault encryption");
    });
  });

  describe("runImprovementCycle (composite)", () => {
    it("returns all 6 sub-results", () => {
      const r = runImprovementCycle({
        computationLogs: [],
        alertOutcomes: [],
        userActivity: [],
        sensitivityInputs: [],
        competitorFeatures: [],
      });
      expect(r.defaultCalibration).toBeDefined();
      expect(r.recommendationQuality).toBeDefined();
      expect(r.triggerTuning).toBeDefined();
      expect(r.sensitivityRanking).toBeDefined();
      expect(r.userClusters).toBeDefined();
      expect(r.featureGaps).toBeDefined();
      expect(r.ranAt).toBeInstanceOf(Date);
    });
  });
});
