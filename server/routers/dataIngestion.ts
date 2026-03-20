/**
 * Data Ingestion Router
 * Manages data sources, ingestion jobs, market data, and AI-generated insights.
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { eq, desc, and, sql } from "drizzle-orm";
import {
  dataSources, ingestionJobs, ingestedRecords,
  marketDataCache, webScrapeResults, documentExtractions,
} from "../../drizzle/schema";
import { dataIngestion } from "../services/dataIngestion";

export const dataIngestionRouter = router({
  // ─── Data Sources CRUD ─────────────────────────────────────────────
  listSources: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(dataSources).orderBy(desc(dataSources.createdAt));
  }),

  createSource: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      sourceType: z.enum(["document_upload", "web_scrape", "api_feed", "market_data", "regulatory", "product_catalog", "news_feed", "competitor", "custom"]),
      url: z.string().max(1000).optional(),
      authType: z.enum(["none", "api_key", "oauth", "basic", "bearer"]).default("none"),
      scheduleCron: z.string().max(100).optional(),
      priority: z.number().min(1).max(10).default(5),
      configJson: z.any().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [result] = await db.insert(dataSources).values({
        ...input,
        configJson: input.configJson || null,
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }).$returningId();
      return { id: result.id, success: true };
    }),

  updateSource: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(255).optional(),
      url: z.string().max(1000).optional(),
      scheduleCron: z.string().max(100).optional(),
      priority: z.number().min(1).max(10).optional(),
      isActive: z.boolean().optional(),
      configJson: z.any().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...updates } = input;
      await db.update(dataSources).set({ ...updates, updatedAt: Date.now() }).where(eq(dataSources.id, id));
      return { success: true };
    }),

  deleteSource: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(dataSources).set({ isActive: false, updatedAt: Date.now() }).where(eq(dataSources.id, input.id));
      return { success: true };
    }),

  // ─── Ingestion Jobs ────────────────────────────────────────────────
  runIngestion: protectedProcedure
    .input(z.object({ dataSourceId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      return dataIngestion.runIngestion(input.dataSourceId, ctx.user.id);
    }),

  listJobs: protectedProcedure
    .input(z.object({ dataSourceId: z.number().optional(), limit: z.number().default(50) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const query = db.select().from(ingestionJobs).orderBy(desc(ingestionJobs.createdAt)).limit(input.limit);
      if (input.dataSourceId) {
        return query.where(eq(ingestionJobs.dataSourceId, input.dataSourceId));
      }
      return query;
    }),

  // ─── Ingested Records ─────────────────────────────────────────────
  listRecords: protectedProcedure
    .input(z.object({
      recordType: z.string().optional(),
      limit: z.number().default(100),
      offset: z.number().default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { records: [], total: 0 };
      let query = db.select().from(ingestedRecords).orderBy(desc(ingestedRecords.createdAt)).limit(input.limit).offset(input.offset);
      if (input.recordType) {
        query = query.where(eq(ingestedRecords.recordType, input.recordType as any)) as any;
      }
      const records = await query;
      return { records, total: records.length };
    }),

  // ─── Market Data ──────────────────────────────────────────────────
  fetchMarketData: protectedProcedure.mutation(async () => {
    const rates = await dataIngestion.marketDataService.fetchECBRates();
    let cached = 0;
    for (const rate of rates) {
      await dataIngestion.marketDataService.cacheMarketData(rate.symbol, "fx_rate", rate.rate, "ECB");
      cached++;
    }
    return { ratesFetched: rates.length, cached };
  }),

  getMarketData: protectedProcedure
    .input(z.object({ symbol: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(marketDataCache)
        .where(eq(marketDataCache.symbol, input.symbol))
        .orderBy(desc(marketDataCache.observedAt))
        .limit(30);
    }),

  // ─── Web Scraping ────────────────────────────────────────────────
  scrapeUrl: protectedProcedure
    .input(z.object({
      url: z.string().url(),
      extractionPrompt: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await dataIngestion.scraperService.scrapeUrl(input.url, input.extractionPrompt);
      await dataIngestion.scraperService.saveScrapeResult(null, null, result);
      return result;
    }),

  listScrapeResults: protectedProcedure
    .input(z.object({ limit: z.number().default(50) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(webScrapeResults).orderBy(desc(webScrapeResults.scrapedAt)).limit(input.limit);
    }),

  // ─── Document Processing ─────────────────────────────────────────
  processDocument: protectedProcedure
    .input(z.object({
      documentUrl: z.string(),
      documentType: z.string(),
      documentId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return dataIngestion.documentService.processDocument(
        input.documentUrl,
        input.documentType,
        ctx.user.id,
        input.documentId
      );
    }),

  listExtractions: protectedProcedure
    .input(z.object({ limit: z.number().default(50) }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(documentExtractions)
        .where(eq(documentExtractions.userId, ctx.user.id))
        .orderBy(desc(documentExtractions.createdAt))
        .limit(input.limit);
    }),

  // ─── Entity Extraction ───────────────────────────────────────────
  extractEntities: protectedProcedure
    .input(z.object({
      text: z.string().min(1).max(10000),
      context: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return dataIngestion.entityExtractorService.extractEntities(input.text, input.context);
    }),

  // ─── AI Insights ─────────────────────────────────────────────────
  generateInsights: protectedProcedure.mutation(async () => {
    return dataIngestion.learningService.generateInsights();
  }),

  getContextEnrichment: protectedProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ input, ctx }) => {
      return dataIngestion.learningService.getContextEnrichment(input.query, ctx.user.id);
    }),

  // ─── Dashboard Stats ─────────────────────────────────────────────
  getDashboardStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalSources: 0, activeSources: 0, totalRecords: 0, totalJobs: 0, recentInsights: [] };

    const [sourceStats] = await db.select({
      total: sql<number>`COUNT(*)`,
      active: sql<number>`SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END)`,
    }).from(dataSources);

    const [recordStats] = await db.select({
      total: sql<number>`COUNT(*)`,
    }).from(ingestedRecords);

    const [jobStats] = await db.select({
      total: sql<number>`COUNT(*)`,
    }).from(ingestionJobs);

    return {
      totalSources: Number(sourceStats?.total || 0),
      activeSources: Number(sourceStats?.active || 0),
      totalRecords: Number(recordStats?.total || 0),
      totalJobs: Number(jobStats?.total || 0),
      recentInsights: [],
    };
  }),
});
