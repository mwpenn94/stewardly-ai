/**
 * Data Value Scorer — Score the value of data sources for prioritization
 */
import { logger } from "../../_core/logger";

const log = logger.child({ module: "dataValueScorer" });

export interface DataSource {
  provider: string;
  dataType: string;
  recordCount: number;
  freshness: number; // ms since last update
  accuracy: number; // 0-1
  costPerQuery: number; // USD
  queryVolume: number; // queries per month
  uniqueness: number; // 0-1, how unique vs other sources
}

export interface DataValueScore {
  provider: string;
  dataType: string;
  overallScore: number; // 0-100
  freshnessScore: number;
  accuracyScore: number;
  costEfficiency: number;
  usageScore: number;
  uniquenessScore: number;
  recommendation: "keep" | "optimize" | "replace" | "deprecate";
}

export function scoreSource(source: DataSource): DataValueScore {
  // Freshness: 100 if < 1h, decays to 0 at 30 days
  const hoursOld = source.freshness / (60 * 60 * 1000);
  const freshnessScore = Math.max(0, Math.min(100, 100 - (hoursOld / 720) * 100));

  // Accuracy: direct mapping
  const accuracyScore = source.accuracy * 100;

  // Cost efficiency: higher is better (more queries per dollar)
  const costEfficiency = source.costPerQuery > 0
    ? Math.min(100, (source.queryVolume / (source.costPerQuery * source.queryVolume + 0.01)) * 10)
    : 100; // Free sources get max score

  // Usage: logarithmic scale
  const usageScore = Math.min(100, Math.log10(source.queryVolume + 1) * 25);

  // Uniqueness: direct mapping
  const uniquenessScore = source.uniqueness * 100;

  // Weighted overall
  const overallScore = Math.round(
    freshnessScore * 0.2 + accuracyScore * 0.3 + costEfficiency * 0.15 + usageScore * 0.2 + uniquenessScore * 0.15
  );

  let recommendation: DataValueScore["recommendation"] = "keep";
  if (overallScore < 30) recommendation = "deprecate";
  else if (overallScore < 50) recommendation = "replace";
  else if (overallScore < 70) recommendation = "optimize";

  return { provider: source.provider, dataType: source.dataType, overallScore, freshnessScore, accuracyScore, costEfficiency, usageScore, uniquenessScore, recommendation };
}

export function scoreAll(sources: DataSource[]): DataValueScore[] {
  const scores = sources.map(scoreSource);
  log.info({ count: scores.length, avgScore: Math.round(scores.reduce((s, sc) => s + sc.overallScore, 0) / scores.length) }, "Data sources scored");
  return scores.sort((a, b) => b.overallScore - a.overallScore);
}
