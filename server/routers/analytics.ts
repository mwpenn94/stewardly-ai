import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  dataSources, ingestedRecords, ingestionJobs, ingestionInsights,
  dataQualityScores, insightActions
} from "../../drizzle/schema";
import { sql, eq, gte, and, count, avg } from "drizzle-orm";

/**
 * Analytics Router — provides time-series and aggregate data for
 * Chart.js dashboard widgets in the Data Intelligence Hub.
 */
export const analyticsRouter = router({
  /**
   * Ingestion volume over time — records ingested per day for the last N days
   */
  ingestionVolume: protectedProcedure
    .input(z.object({ days: z.number().min(1).max(90).default(30) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const since = new Date(Date.now() - input.days * 86400000);
      const sinceMs = since.getTime();
      const rows = await db
        .select({
          date: sql<string>`DATE(FROM_UNIXTIME(${ingestedRecords.createdAt} / 1000))`.as("date"),
          count: count().as("count"),
        })
        .from(ingestedRecords)
        .where(gte(ingestedRecords.createdAt, sinceMs))
        .groupBy(sql`DATE(FROM_UNIXTIME(${ingestedRecords.createdAt} / 1000))`)
        .orderBy(sql`DATE(FROM_UNIXTIME(${ingestedRecords.createdAt} / 1000))`);
      return rows;
    }),

  /**
   * Data quality trends — average quality score per day
   */
  qualityTrends: protectedProcedure
    .input(z.object({ days: z.number().min(1).max(90).default(30) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const sinceMs = Date.now() - input.days * 86400000;
      const rows = await db
        .select({
          date: sql<string>`DATE(FROM_UNIXTIME(${dataQualityScores.scoredAt} / 1000))`.as("date"),
          avgScore: avg(dataQualityScores.overallScore).as("avgScore"),
          count: count().as("count"),
        })
        .from(dataQualityScores)
        .where(gte(dataQualityScores.scoredAt, sinceMs))
        .groupBy(sql`DATE(FROM_UNIXTIME(${dataQualityScores.scoredAt} / 1000))`)
        .orderBy(sql`DATE(FROM_UNIXTIME(${dataQualityScores.scoredAt} / 1000))`);
      return rows;
    }),

  /**
   * Insight severity distribution — count of insights by severity
   */
  insightSeverity: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select({
        severity: ingestionInsights.severity,
        count: count().as("count"),
      })
      .from(ingestionInsights)
      .groupBy(ingestionInsights.severity);
    return rows;
  }),

  /**
   * Insight category distribution — count of insights by category
   */
  insightCategories: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select({
        category: ingestionInsights.insightType,
        count: count().as("count"),
      })
      .from(ingestionInsights)
      .groupBy(ingestionInsights.insightType);
    return rows;
  }),

  /**
   * Data source breakdown — count of sources by type and status
   */
  sourceBreakdown: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { byType: [], byStatus: [] };
    const byType = await db
      .select({
        type: dataSources.sourceType,
        count: count().as("count"),
      })
      .from(dataSources)
      .groupBy(dataSources.sourceType);
    const byStatus = await db
      .select({
        active: dataSources.isActive,
        count: count().as("count"),
      })
      .from(dataSources)
      .groupBy(dataSources.isActive);
    return { byType, byStatus };
  }),

  /**
   * Job status breakdown — count of ingestion jobs by status
   */
  jobStatus: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select({
        status: ingestionJobs.status,
        count: count().as("count"),
      })
      .from(ingestionJobs)
      .groupBy(ingestionJobs.status);
    return rows;
  }),

  /**
   * Action status breakdown — count of insight actions by status
   */
  actionStatus: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select({
        status: insightActions.status,
        count: count().as("count"),
      })
      .from(insightActions)
      .groupBy(insightActions.status);
    return rows;
  }),

  /**
   * Overall platform stats — summary metrics
   */
  platformStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return {
      totalSources: 0, totalRecords: 0, totalInsights: 0,
      totalJobs: 0, totalActions: 0, avgQuality: 0,
    };
    const [sources] = await db.select({ count: count() }).from(dataSources);
    const [records] = await db.select({ count: count() }).from(ingestedRecords);
    const [insights] = await db.select({ count: count() }).from(ingestionInsights);
    const [jobs] = await db.select({ count: count() }).from(ingestionJobs);
    const [actions] = await db.select({ count: count() }).from(insightActions);
    const [quality] = await db.select({ avg: avg(dataQualityScores.overallScore) }).from(dataQualityScores);
    return {
      totalSources: sources?.count ?? 0,
      totalRecords: records?.count ?? 0,
      totalInsights: insights?.count ?? 0,
      totalJobs: jobs?.count ?? 0,
      totalActions: actions?.count ?? 0,
      avgQuality: quality?.avg ? Number(quality.avg) : 0,
    };
  }),

  /**
   * Ingestion volume by source type — for stacked bar chart
   */
  volumeBySourceType: protectedProcedure
    .input(z.object({ days: z.number().min(1).max(90).default(30) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const since = new Date(Date.now() - input.days * 86400000);
      const sinceMs = since.getTime();
      const rows = await db
        .select({
          date: sql<string>`DATE(FROM_UNIXTIME(${ingestedRecords.createdAt} / 1000))`.as("date"),
          recordType: ingestedRecords.recordType,
          count: count().as("count"),
        })
        .from(ingestedRecords)
        .where(gte(ingestedRecords.createdAt, sinceMs))
        .groupBy(sql`DATE(FROM_UNIXTIME(${ingestedRecords.createdAt} / 1000))`, ingestedRecords.recordType)
        .orderBy(sql`DATE(FROM_UNIXTIME(${ingestedRecords.createdAt} / 1000))`);
      return rows;
    }),
});
