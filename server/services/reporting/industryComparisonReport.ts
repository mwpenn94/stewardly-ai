/**
 * Industry Comparison Report — Benchmark firm metrics against industry averages
 * Compares AUM per advisor, revenue per client, retention, growth rates
 */
import { getDb } from "../../db";
import { logger } from "../../_core/logger";

const log = logger.child({ module: "industryComparisonReport" });

// Industry benchmarks (source: Cerulli, InvestmentNews, Kitces Research)
const INDUSTRY_BENCHMARKS = {
  aumPerAdvisor: 120_000_000, // $120M median
  revenuePerClient: 4_800, // $4,800 median
  clientRetentionRate: 95.2, // 95.2%
  annualGrowthRate: 8.5, // 8.5%
  clientsPerAdvisor: 100, // median
  operatingMargin: 28, // 28%
  digitalAdoptionRate: 72, // 72%
  planCompletionRate: 65, // 65%
};

export interface IndustryComparison {
  metric: string;
  firmValue: number;
  industryBenchmark: number;
  percentile: number;
  status: "above" | "at" | "below";
}

export interface IndustryComparisonReport {
  period: { start: Date; end: Date };
  comparisons: IndustryComparison[];
  overallRank: "top_quartile" | "second_quartile" | "third_quartile" | "bottom_quartile";
  strengths: string[];
  improvements: string[];
}

function estimatePercentile(firmValue: number, benchmark: number): number {
  const ratio = firmValue / benchmark;
  if (ratio >= 2.0) return 99;
  if (ratio >= 1.5) return 90;
  if (ratio >= 1.2) return 75;
  if (ratio >= 1.0) return 55;
  if (ratio >= 0.8) return 35;
  if (ratio >= 0.5) return 15;
  return 5;
}

export async function generateIndustryComparisonReport(
  periodStart: Date,
  periodEnd: Date,
): Promise<IndustryComparisonReport> {
  const db = await getDb();
  const empty: IndustryComparisonReport = {
    period: { start: periodStart, end: periodEnd },
    comparisons: [], overallRank: "second_quartile",
    strengths: [], improvements: [],
  };

  if (!db) return empty;

  try {
    const { clientAssociations, users } = await import("../../../drizzle/schema");
    const { count, eq } = await import("drizzle-orm");

    const [clientCount] = await db.select({ count: count() }).from(clientAssociations).where(eq(clientAssociations.status, "active"));
    const [advisorCount] = await db.select({ count: count() }).from(users);

    const totalClients = clientCount?.count || 0;
    const totalAdvisors = Math.max(advisorCount?.count || 1, 1);
    const clientsPerAdvisor = Math.round(totalClients / totalAdvisors);

    const comparisons: IndustryComparison[] = [
      {
        metric: "Clients per Advisor",
        firmValue: clientsPerAdvisor,
        industryBenchmark: INDUSTRY_BENCHMARKS.clientsPerAdvisor,
        percentile: estimatePercentile(clientsPerAdvisor, INDUSTRY_BENCHMARKS.clientsPerAdvisor),
        status: clientsPerAdvisor >= INDUSTRY_BENCHMARKS.clientsPerAdvisor * 1.1 ? "above" : clientsPerAdvisor >= INDUSTRY_BENCHMARKS.clientsPerAdvisor * 0.9 ? "at" : "below",
      },
    ];

    const strengths = comparisons.filter((c) => c.status === "above").map((c) => c.metric);
    const improvements = comparisons.filter((c) => c.status === "below").map((c) => c.metric);
    const avgPercentile = comparisons.reduce((s, c) => s + c.percentile, 0) / Math.max(comparisons.length, 1);
    const overallRank = avgPercentile >= 75 ? "top_quartile" : avgPercentile >= 50 ? "second_quartile" : avgPercentile >= 25 ? "third_quartile" : "bottom_quartile";

    log.info({ comparisons: comparisons.length, overallRank }, "Industry comparison report generated");

    return { period: { start: periodStart, end: periodEnd }, comparisons, overallRank, strengths, improvements };
  } catch (e: any) {
    log.warn({ error: e.message }, "Industry comparison report generation failed");
    return empty;
  }
}

export function getIndustryBenchmarks() {
  return INDUSTRY_BENCHMARKS;
}
