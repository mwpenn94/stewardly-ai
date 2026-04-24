/**
 * Pattern Transition Engine
 * ==========================
 * GAP-09: Tracks Pattern 4 → Pattern 5 transition readiness
 * 
 * Metrics tracked:
 *   C6: AUM signed per month
 *   C7: >$500K threshold per deal
 *   C8: Active affiliates count
 *   C9: New producers onboarded
 * 
 * Monthly assessment with recommendation to stay/transition.
 */
import { logger } from "../_core/logger";
const log = logger.child({ module: "patternTransition" });

// ─── Types ───────────────────────────────────────────────────────────────

export interface PatternMetrics {
  aumSignedThisMonth: number;       // C6: total AUM signed this month
  dealsAbove500K: number;           // C7: deals > $500K this month
  activeAffiliates: number;         // C8: active affiliate count
  newProducersOnboarded: number;    // C9: new producers this month
  totalPipelineValue: number;       // total pipeline value
  conversionRate: number;           // lead → client conversion rate
  avgDealSize: number;              // average deal size
  monthlyRecurringRevenue: number;  // MRR from advisory fees
}

export interface TransitionAssessment {
  currentPattern: "Pattern 4" | "Pattern 5" | "Pattern 6";
  metrics: PatternMetrics;
  readinessScore: number; // 0-100
  recommendation: "stay" | "prepare_transition" | "transition_ready";
  rationale: string;
  gatingFactors: string[];
  nextReviewDate: string; // ISO date
}

// ─── Pattern Thresholds ──────────────────────────────────────────────────

export const PATTERN_THRESHOLDS = {
  pattern4to5: {
    minMonthlyAum: 2_000_000,
    minDealsAbove500K: 2,
    minActiveAffiliates: 3,
    minNewProducers: 1,
    minConversionRate: 0.05,
    minAvgDealSize: 250_000,
    minMrr: 15_000,
    consecutiveMonthsRequired: 3,
  },
  pattern5to6: {
    minMonthlyAum: 5_000_000,
    minDealsAbove500K: 5,
    minActiveAffiliates: 10,
    minNewProducers: 3,
    minConversionRate: 0.08,
    minAvgDealSize: 500_000,
    minMrr: 50_000,
    consecutiveMonthsRequired: 3,
  },
} as const;

// ─── Assessment Functions ────────────────────────────────────────────────

/**
 * Assess readiness for pattern transition.
 */
export function assessTransition(
  metrics: PatternMetrics,
  currentPattern: "Pattern 4" | "Pattern 5" = "Pattern 4"
): TransitionAssessment {
  try {
    if (!metrics) throw new Error("PatternMetrics is required for assessment");

    const thresholds = currentPattern === "Pattern 4"
      ? PATTERN_THRESHOLDS.pattern4to5
      : PATTERN_THRESHOLDS.pattern5to6;

    const gatingFactors: string[] = [];
    let metCount = 0;
    const totalChecks = 7;

    if (metrics.aumSignedThisMonth >= thresholds.minMonthlyAum) metCount++;
    else gatingFactors.push(`AUM signed ($${(metrics.aumSignedThisMonth / 1_000_000).toFixed(1)}M) below $${(thresholds.minMonthlyAum / 1_000_000).toFixed(0)}M threshold`);

    if (metrics.dealsAbove500K >= thresholds.minDealsAbove500K) metCount++;
    else gatingFactors.push(`Only ${metrics.dealsAbove500K} deals >$500K (need ${thresholds.minDealsAbove500K})`);

    if (metrics.activeAffiliates >= thresholds.minActiveAffiliates) metCount++;
    else gatingFactors.push(`${metrics.activeAffiliates} active affiliates (need ${thresholds.minActiveAffiliates})`);

    if (metrics.newProducersOnboarded >= thresholds.minNewProducers) metCount++;
    else gatingFactors.push(`${metrics.newProducersOnboarded} new producers (need ${thresholds.minNewProducers})`);

    if (metrics.conversionRate >= thresholds.minConversionRate) metCount++;
    else gatingFactors.push(`Conversion rate ${(metrics.conversionRate * 100).toFixed(1)}% below ${(thresholds.minConversionRate * 100).toFixed(0)}% threshold`);

    if (metrics.avgDealSize >= thresholds.minAvgDealSize) metCount++;
    else gatingFactors.push(`Avg deal size $${(metrics.avgDealSize / 1_000).toFixed(0)}K below $${(thresholds.minAvgDealSize / 1_000).toFixed(0)}K threshold`);

    if (metrics.monthlyRecurringRevenue >= thresholds.minMrr) metCount++;
    else gatingFactors.push(`MRR $${(metrics.monthlyRecurringRevenue / 1_000).toFixed(1)}K below $${(thresholds.minMrr / 1_000).toFixed(0)}K threshold`);

    const readinessScore = Math.round((metCount / totalChecks) * 100);
    let recommendation: TransitionAssessment["recommendation"];
    let rationale: string;

    if (readinessScore >= 85) {
      recommendation = "transition_ready";
      rationale = `${metCount}/${totalChecks} thresholds met. Ready for ${currentPattern === "Pattern 4" ? "Pattern 5" : "Pattern 6"} transition pending ${thresholds.consecutiveMonthsRequired}-month consistency verification.`;
    } else if (readinessScore >= 57) {
      recommendation = "prepare_transition";
      rationale = `${metCount}/${totalChecks} thresholds met. Address gating factors to prepare for transition. Focus on: ${gatingFactors.slice(0, 2).join("; ")}.`;
    } else {
      recommendation = "stay";
      rationale = `${metCount}/${totalChecks} thresholds met. Continue building ${currentPattern} fundamentals. Key gaps: ${gatingFactors.slice(0, 3).join("; ")}.`;
    }

    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + 30);

    const assessment: TransitionAssessment = {
      currentPattern,
      metrics,
      readinessScore,
      recommendation,
      rationale,
      gatingFactors,
      nextReviewDate: nextReview.toISOString().slice(0, 10),
    };

    log.info("Pattern transition assessment: %s → %s (readiness: %d%%)",
      currentPattern, recommendation, readinessScore);
    return assessment;
  } catch (error) {
    log.error("assessTransition failed: %s", error);
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + 30);
    return {
      currentPattern,
      metrics: metrics || {
        aumSignedThisMonth: 0, dealsAbove500K: 0, activeAffiliates: 0,
        newProducersOnboarded: 0, totalPipelineValue: 0, conversionRate: 0,
        avgDealSize: 0, monthlyRecurringRevenue: 0,
      },
      readinessScore: 0,
      recommendation: "stay",
      rationale: `Assessment error: ${error instanceof Error ? error.message : "Unknown"}. Manual review required.`,
      gatingFactors: ["Assessment engine error — manual review required"],
      nextReviewDate: nextReview.toISOString().slice(0, 10),
    };
  }
}

/**
 * Calculate funnel health metrics for pipeline coverage.
 */
export function calculatePipelineCoverage(pipeline: {
  discoveryValue: number;
  solutionDesignValue: number;
  validationValue: number;
  commitValue: number;
  targetQuotaValue: number;
}): {
  discoveryMultiple: number;
  solutionDesignMultiple: number;
  validationMultiple: number;
  commitMultiple: number;
  health: "healthy" | "at_risk" | "critical";
  recommendations: string[];
} {
  try {
    if (!pipeline) throw new Error("Pipeline data is required");

    const target = pipeline.targetQuotaValue || 1;
    const discovery = pipeline.discoveryValue / target;
    const solutionDesign = pipeline.solutionDesignValue / target;
    const validation = pipeline.validationValue / target;
    const commit = pipeline.commitValue / target;

    const recommendations: string[] = [];
    if (discovery < 10) recommendations.push(`Discovery pipeline (${discovery.toFixed(1)}×) below 10× target — increase top-of-funnel activity`);
    if (solutionDesign < 5) recommendations.push(`Solution Design (${solutionDesign.toFixed(1)}×) below 5× target — improve qualification`);
    if (validation < 3) recommendations.push(`Validation (${validation.toFixed(1)}×) below 3× target — accelerate deal progression`);
    if (commit < 1.5) recommendations.push(`Commit (${commit.toFixed(1)}×) below 1.5× target — focus on closing`);

    let health: "healthy" | "at_risk" | "critical";
    if (recommendations.length === 0) health = "healthy";
    else if (recommendations.length <= 2) health = "at_risk";
    else health = "critical";

    return { discoveryMultiple: discovery, solutionDesignMultiple: solutionDesign, validationMultiple: validation, commitMultiple: commit, health, recommendations };
  } catch (error) {
    log.error("calculatePipelineCoverage failed: %s", error);
    return {
      discoveryMultiple: 0,
      solutionDesignMultiple: 0,
      validationMultiple: 0,
      commitMultiple: 0,
      health: "critical",
      recommendations: [`Pipeline calculation error: ${error instanceof Error ? error.message : "Unknown"}`],
    };
  }
}
