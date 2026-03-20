import { getDb } from "./db";
import { practiceMetrics } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";

// ─── Types ─────────────────────────────────────────────────────
export interface PracticeInput {
  professionalId: number;
  totalAum: number;
  clientCount: number;
  annualRevenue: number;
  netNewClients: number;
  referralConversionRate: number; // 0-1
  clientRetentionRate: number; // 0-1
  avgMeetingPrepMinutes: number;
  complianceCompletionRate: number; // 0-1
}

export interface PracticeAnalysis {
  revenuePerClient: number;
  organicGrowthRate: number;
  efficiencyScore: number; // 0-100
  healthIndicators: HealthIndicator[];
  benchmarkComparison: BenchmarkComparison[];
  recommendations: string[];
  projectedGrowth12m: number;
}

export interface HealthIndicator {
  metric: string;
  value: number;
  status: "excellent" | "good" | "needs_attention" | "critical";
  benchmark: number;
  unit: string;
}

export interface BenchmarkComparison {
  metric: string;
  yourValue: number;
  industryMedian: number;
  topQuartile: number;
  percentile: number;
}

// ─── Industry Benchmarks (2026 RIA averages) ──────────────────
const BENCHMARKS = {
  revenuePerClient: { median: 5800, topQuartile: 9200 },
  clientRetention: { median: 0.95, topQuartile: 0.98 },
  organicGrowth: { median: 0.04, topQuartile: 0.10 },
  referralConversion: { median: 0.25, topQuartile: 0.45 },
  meetingPrep: { median: 45, topQuartile: 25 }, // lower is better
  complianceCompletion: { median: 0.88, topQuartile: 0.98 },
  aumPerClient: { median: 450000, topQuartile: 850000 },
};

function percentileRank(value: number, median: number, topQ: number, lowerIsBetter = false): number {
  if (lowerIsBetter) {
    if (value <= topQ) return 90;
    if (value <= median) return 50 + 40 * ((median - value) / (median - topQ));
    return Math.max(5, 50 * (topQ / value));
  }
  if (value >= topQ) return 90;
  if (value >= median) return 50 + 40 * ((value - median) / (topQ - median));
  return Math.max(5, 50 * (value / median));
}

// ─── Analysis ──────────────────────────────────────────────────
export function analyzePractice(input: PracticeInput): PracticeAnalysis {
  const revenuePerClient = input.clientCount > 0 ? input.annualRevenue / input.clientCount : 0;
  const aumPerClient = input.clientCount > 0 ? input.totalAum / input.clientCount : 0;
  const organicGrowthRate = input.totalAum > 0 ? (input.netNewClients * aumPerClient) / input.totalAum : 0;

  // Health indicators
  const indicators: HealthIndicator[] = [
    {
      metric: "Revenue per Client",
      value: Math.round(revenuePerClient),
      benchmark: BENCHMARKS.revenuePerClient.median,
      status: revenuePerClient >= BENCHMARKS.revenuePerClient.topQuartile ? "excellent" :
        revenuePerClient >= BENCHMARKS.revenuePerClient.median ? "good" :
        revenuePerClient >= BENCHMARKS.revenuePerClient.median * 0.7 ? "needs_attention" : "critical",
      unit: "$",
    },
    {
      metric: "Client Retention",
      value: Math.round(input.clientRetentionRate * 100),
      benchmark: Math.round(BENCHMARKS.clientRetention.median * 100),
      status: input.clientRetentionRate >= BENCHMARKS.clientRetention.topQuartile ? "excellent" :
        input.clientRetentionRate >= BENCHMARKS.clientRetention.median ? "good" :
        input.clientRetentionRate >= 0.90 ? "needs_attention" : "critical",
      unit: "%",
    },
    {
      metric: "Referral Conversion",
      value: Math.round(input.referralConversionRate * 100),
      benchmark: Math.round(BENCHMARKS.referralConversion.median * 100),
      status: input.referralConversionRate >= BENCHMARKS.referralConversion.topQuartile ? "excellent" :
        input.referralConversionRate >= BENCHMARKS.referralConversion.median ? "good" :
        input.referralConversionRate >= 0.15 ? "needs_attention" : "critical",
      unit: "%",
    },
    {
      metric: "Meeting Prep Time",
      value: Math.round(input.avgMeetingPrepMinutes),
      benchmark: BENCHMARKS.meetingPrep.median,
      status: input.avgMeetingPrepMinutes <= BENCHMARKS.meetingPrep.topQuartile ? "excellent" :
        input.avgMeetingPrepMinutes <= BENCHMARKS.meetingPrep.median ? "good" :
        input.avgMeetingPrepMinutes <= 60 ? "needs_attention" : "critical",
      unit: "min",
    },
    {
      metric: "Compliance Completion",
      value: Math.round(input.complianceCompletionRate * 100),
      benchmark: Math.round(BENCHMARKS.complianceCompletion.median * 100),
      status: input.complianceCompletionRate >= BENCHMARKS.complianceCompletion.topQuartile ? "excellent" :
        input.complianceCompletionRate >= BENCHMARKS.complianceCompletion.median ? "good" :
        input.complianceCompletionRate >= 0.80 ? "needs_attention" : "critical",
      unit: "%",
    },
  ];

  // Benchmark comparisons
  const benchmarks: BenchmarkComparison[] = [
    { metric: "Revenue/Client", yourValue: revenuePerClient, industryMedian: BENCHMARKS.revenuePerClient.median, topQuartile: BENCHMARKS.revenuePerClient.topQuartile, percentile: percentileRank(revenuePerClient, BENCHMARKS.revenuePerClient.median, BENCHMARKS.revenuePerClient.topQuartile) },
    { metric: "AUM/Client", yourValue: aumPerClient, industryMedian: BENCHMARKS.aumPerClient.median, topQuartile: BENCHMARKS.aumPerClient.topQuartile, percentile: percentileRank(aumPerClient, BENCHMARKS.aumPerClient.median, BENCHMARKS.aumPerClient.topQuartile) },
    { metric: "Organic Growth", yourValue: organicGrowthRate, industryMedian: BENCHMARKS.organicGrowth.median, topQuartile: BENCHMARKS.organicGrowth.topQuartile, percentile: percentileRank(organicGrowthRate, BENCHMARKS.organicGrowth.median, BENCHMARKS.organicGrowth.topQuartile) },
    { metric: "Retention Rate", yourValue: input.clientRetentionRate, industryMedian: BENCHMARKS.clientRetention.median, topQuartile: BENCHMARKS.clientRetention.topQuartile, percentile: percentileRank(input.clientRetentionRate, BENCHMARKS.clientRetention.median, BENCHMARKS.clientRetention.topQuartile) },
  ];

  // Efficiency score (weighted average of percentiles)
  const efficiencyScore = Math.round(
    benchmarks.reduce((sum, b) => sum + b.percentile, 0) / benchmarks.length
  );

  // Recommendations
  const recommendations: string[] = [];
  if (revenuePerClient < BENCHMARKS.revenuePerClient.median) {
    recommendations.push("Consider fee review or expanding services to increase revenue per client");
  }
  if (input.clientRetentionRate < BENCHMARKS.clientRetention.median) {
    recommendations.push("Implement proactive client engagement program to improve retention");
  }
  if (input.referralConversionRate < BENCHMARKS.referralConversion.median) {
    recommendations.push("Develop systematic referral process with COI network activation");
  }
  if (input.avgMeetingPrepMinutes > BENCHMARKS.meetingPrep.median) {
    recommendations.push("Leverage AI-assisted meeting prep to reduce preparation time");
  }
  if (input.complianceCompletionRate < BENCHMARKS.complianceCompletion.median) {
    recommendations.push("Automate compliance workflows to improve completion rates");
  }
  if (recommendations.length === 0) {
    recommendations.push("Practice metrics are strong across all dimensions. Focus on scaling what works.");
  }

  // 12-month growth projection
  const projectedGrowth12m = input.totalAum * (1 + organicGrowthRate + 0.06); // organic + market growth

  return {
    revenuePerClient: Math.round(revenuePerClient),
    organicGrowthRate: Math.round(organicGrowthRate * 1000) / 1000,
    efficiencyScore,
    healthIndicators: indicators,
    benchmarkComparison: benchmarks,
    recommendations,
    projectedGrowth12m: Math.round(projectedGrowth12m),
  };
}

// ─── DB Helpers ────────────────────────────────────────────────
export async function savePracticeMetrics(input: PracticeInput, analysis: PracticeAnalysis) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(practiceMetrics).values({
    professionalId: input.professionalId,
    periodEndDate: new Date(),
    revenuePerClient: analysis.revenuePerClient,
    organicGrowthRate: analysis.organicGrowthRate,
    netNewClients: input.netNewClients,
    costToServeJson: JSON.stringify({ avgMeetingPrepMinutes: input.avgMeetingPrepMinutes }),
    engagementScoresJson: JSON.stringify({
      referralConversion: input.referralConversionRate,
      clientRetention: input.clientRetentionRate,
      complianceCompletion: input.complianceCompletionRate,
    }),
    benchmarkPercentilesJson: JSON.stringify(analysis.benchmarkComparison),
  });
}

export async function getLatestPracticeMetrics(professionalId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(practiceMetrics)
    .where(eq(practiceMetrics.professionalId, professionalId))
    .orderBy(desc(practiceMetrics.createdAt))
    .limit(1);
  return rows[0] || null;
}
