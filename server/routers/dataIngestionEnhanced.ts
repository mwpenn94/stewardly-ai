/**
 * Enhanced Data Ingestion Router
 * Adds bulk scraping, RSS feeds, sitemap crawling, competitor intelligence,
 * data quality scoring, and persistent AI insights.
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { eq, desc, sql } from "drizzle-orm";
import {
  bulkImportBatches, dataQualityScores, ingestionInsights, scrapeSchedules, ingestedRecords,
} from "../../drizzle/schema";
import {
  bulkScraper, rssFeedService, dataQualityService,
  insightGenerator, productCatalogParser, competitorIntel,
} from "../services/dataIngestionEnhanced";

export const dataIngestionEnhancedRouter = router({
  // ─── Bulk Scraping ────────────────────────────────────────────────
  bulkScrape: protectedProcedure
    .input(z.object({
      urls: z.array(z.string().url()).min(1).max(100),
      batchName: z.string().min(1).max(255),
      extractionPrompt: z.string().max(2000).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return bulkScraper.scrapeMultipleUrls(input.urls, input.batchName, input.extractionPrompt, ctx.user.id);
    }),

  crawlSitemap: protectedProcedure
    .input(z.object({
      sitemapUrl: z.string().url(),
      batchName: z.string().min(1).max(255),
      maxUrls: z.number().min(1).max(200).default(50),
    }))
    .mutation(async ({ input, ctx }) => {
      return bulkScraper.crawlSitemap(input.sitemapUrl, input.batchName, input.maxUrls, ctx.user.id);
    }),

  // ─── RSS Feed Ingestion ───────────────────────────────────────────
  ingestRSSFeed: protectedProcedure
    .input(z.object({
      feedUrl: z.string().url(),
      feedName: z.string().min(1).max(255),
      maxItems: z.number().min(1).max(100).default(25),
    }))
    .mutation(async ({ input, ctx }) => {
      return rssFeedService.ingestFeed(input.feedUrl, input.feedName, input.maxItems, ctx.user.id);
    }),

  // ─── Product Catalog ──────────────────────────────────────────────
  parseProductCatalog: protectedProcedure
    .input(z.object({
      url: z.string().url(),
      productCategory: z.string().max(100).optional(),
    }))
    .mutation(async ({ input }) => {
      return productCatalogParser.parseProductPage(input.url, input.productCategory);
    }),

  // ─── Competitor Intelligence ──────────────────────────────────────
  analyzeCompetitor: protectedProcedure
    .input(z.object({
      competitorUrl: z.string().url(),
      competitorName: z.string().min(1).max(255),
    }))
    .mutation(async ({ input }) => {
      return competitorIntel.analyzeCompetitor(input.competitorUrl, input.competitorName);
    }),

  // ─── Data Quality ─────────────────────────────────────────────────
  scoreDataQuality: protectedProcedure
    .input(z.object({ dataSourceId: z.number() }))
    .mutation(async ({ input }) => {
      return dataQualityService.scoreDataSource(input.dataSourceId);
    }),

  listQualityScores: protectedProcedure
    .input(z.object({ limit: z.number().default(20) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(dataQualityScores).orderBy(desc(dataQualityScores.scoredAt)).limit(input.limit);
    }),

  // ─── AI Insights ──────────────────────────────────────────────────
  generateInsights: protectedProcedure.mutation(async () => {
    return insightGenerator.generateAndPersistInsights();
  }),

  listInsights: protectedProcedure
    .input(z.object({ limit: z.number().default(20) }))
    .query(async ({ input }) => {
      return insightGenerator.getInsights(input.limit);
    }),

  acknowledgeInsight: protectedProcedure
    .input(z.object({ insightId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await insightGenerator.acknowledgeInsight(input.insightId, ctx.user.id);
      return { success: true };
    }),

  // ─── Bulk Import Batches ──────────────────────────────────────────
  listBatches: protectedProcedure
    .input(z.object({ limit: z.number().default(20) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(bulkImportBatches).orderBy(desc(bulkImportBatches.createdAt)).limit(input.limit);
    }),

  // ─── Scrape Schedules ─────────────────────────────────────────────
  createSchedule: protectedProcedure
    .input(z.object({
      dataSourceId: z.number(),
      cronExpression: z.string().min(1).max(100),
      retryOnFailure: z.boolean().default(true),
      maxRetries: z.number().min(0).max(10).default(3),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(scrapeSchedules).values({
        ...input,
        enabled: true,
        createdAt: Date.now(),
      }).$returningId();
      return { id: result.id, success: true };
    }),

  listSchedules: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(scrapeSchedules).orderBy(desc(scrapeSchedules.createdAt));
  }),

  toggleSchedule: protectedProcedure
    .input(z.object({ id: z.number(), enabled: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(scrapeSchedules).set({ enabled: input.enabled }).where(eq(scrapeSchedules.id, input.id));
      return { success: true };
    }),

  // ─── Enhanced Dashboard Stats ─────────────────────────────────────
  getEnhancedStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return {
      totalBatches: 0, totalInsights: 0, avgQualityScore: 0,
      recordsByType: [], recentActivity: [],
    };

    const [batchStats] = await db.select({
      total: sql<number>`COUNT(*)`,
    }).from(bulkImportBatches);

    const [insightStats] = await db.select({
      total: sql<number>`COUNT(*)`,
      unacknowledged: sql<number>`SUM(CASE WHEN acknowledged = 0 THEN 1 ELSE 0 END)`,
    }).from(ingestionInsights);

    const [qualityStats] = await db.select({
      avg: sql<number>`AVG(overall_score)`,
    }).from(dataQualityScores);

    const recordsByType = await db.select({
      type: ingestedRecords.recordType,
      count: sql<number>`COUNT(*)`,
    }).from(ingestedRecords).groupBy(ingestedRecords.recordType);

    return {
      totalBatches: Number(batchStats?.total || 0),
      totalInsights: Number(insightStats?.total || 0),
      unacknowledgedInsights: Number(insightStats?.unacknowledged || 0),
      avgQualityScore: Number(qualityStats?.avg || 0),
      recordsByType: recordsByType.map(r => ({ type: r.type, count: Number(r.count) })),
    };
  }),
});
