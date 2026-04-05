/**
 * Rate Recommender — AI-powered rate optimization recommendations
 */
import { logger } from "../../_core/logger";
import type { CalibratedRate } from "./rateCalibrator";
import type { RateSignal } from "./rateSignalDetector";

const log = logger.child({ module: "rateRecommender" });

export interface RateRecommendation {
  product: string;
  currentRate: number;
  recommendedRate: number;
  rationale: string;
  confidence: number;
  impact: "high" | "medium" | "low";
  action: "increase" | "decrease" | "hold" | "review";
  marketContext: string;
}

export function generateRecommendations(
  currentRates: CalibratedRate[],
  signals: RateSignal[],
  marketBenchmarks: Map<string, number>
): RateRecommendation[] {
  const recommendations: RateRecommendation[] = [];

  for (const rate of currentRates) {
    const benchmark = marketBenchmarks.get(rate.product);
    const recentSignals = signals.filter((s) => s.product === rate.product && s.direction !== "unchanged");

    if (!benchmark) {
      recommendations.push({
        product: rate.product, currentRate: rate.annualPercent, recommendedRate: rate.annualPercent,
        rationale: "No market benchmark available — holding current rate",
        confidence: 0.3, impact: "low", action: "review",
        marketContext: "Benchmark data unavailable",
      });
      continue;
    }

    const spread = rate.annualPercent - benchmark;
    const trendingUp = recentSignals.filter((s) => s.direction === "up").length;
    const trendingDown = recentSignals.filter((s) => s.direction === "down").length;

    let action: RateRecommendation["action"] = "hold";
    let recommendedRate = rate.annualPercent;
    let rationale = "";
    let impact: RateRecommendation["impact"] = "low";

    if (spread > 0.5) {
      action = "decrease";
      recommendedRate = benchmark + 0.25;
      rationale = `Current rate ${spread.toFixed(2)}% above market — recommend aligning closer to benchmark`;
      impact = spread > 1 ? "high" : "medium";
    } else if (spread < -0.5) {
      action = "increase";
      recommendedRate = benchmark - 0.25;
      rationale = `Current rate ${Math.abs(spread).toFixed(2)}% below market — opportunity to increase`;
      impact = "medium";
    } else if (trendingUp > trendingDown && trendingUp >= 2) {
      action = "review";
      rationale = `Market trending upward (${trendingUp} signals) — review for potential increase`;
      impact = "medium";
    } else {
      rationale = "Rate aligned with market — no change recommended";
    }

    recommendations.push({
      product: rate.product, currentRate: rate.annualPercent, recommendedRate,
      rationale, confidence: 0.7 + (recentSignals.length > 3 ? 0.2 : 0),
      impact, action,
      marketContext: `Benchmark: ${benchmark.toFixed(2)}%, ${recentSignals.length} recent signals`,
    });
  }

  log.info({ count: recommendations.length }, "Rate recommendations generated");
  return recommendations;
}

export function prioritize(recs: RateRecommendation[]): RateRecommendation[] {
  const impactOrder = { high: 0, medium: 1, low: 2 };
  return [...recs].sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact]);
}
