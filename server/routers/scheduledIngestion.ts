/**
 * Scheduled Ingestion Router
 * Endpoints for: schedule management, CSV/Excel upload, insight-to-action workflow
 */
import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { scheduleRunner, csvUploadService, insightActionService } from "../services/scheduledIngestion";
import { getDb } from "../db";
import { eq, desc, and, lte, sql } from "drizzle-orm";
import {
  scrapeSchedules, dataSources, insightActions, ingestionInsights,
  bulkImportBatches,
} from "../../drizzle/schema";

export const scheduledIngestionRouter = router({
  // ─── Schedule Management ─────────────────────────────────────────
  schedules: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const schedules = await db.select().from(scrapeSchedules)
        .orderBy(desc(scrapeSchedules.createdAt))
        .limit(50);

      // Enrich with data source names
      const enriched = [];
      for (const s of schedules) {
        const [source] = await db.select({ name: dataSources.name, sourceType: dataSources.sourceType })
          .from(dataSources)
          .where(eq(dataSources.id, s.dataSourceId))
          .limit(1);
        enriched.push({ ...s, dataSourceName: source?.name || "Unknown", sourceType: source?.sourceType || "unknown" });
      }
      return enriched;
    }),

    create: protectedProcedure
      .input(z.object({
        dataSourceId: z.number(),
        cronExpression: z.string().min(1),
        enabled: z.boolean().default(true),
        retryOnFailure: z.boolean().default(true),
        maxRetries: z.number().default(3),
        notifyOnFailure: z.boolean().default(true),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

        const nextRun = scheduleRunner.calculateNextRun(input.cronExpression);
        const [result] = await db.insert(scrapeSchedules).values({
          dataSourceId: input.dataSourceId,
          cronExpression: input.cronExpression,
          nextRunAt: nextRun,
          enabled: input.enabled,
          retryOnFailure: input.retryOnFailure,
          maxRetries: input.maxRetries,
          notifyOnFailure: input.notifyOnFailure,
          createdAt: Date.now(),
        }).$returningId();
        return { id: result.id, nextRunAt: nextRun };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        cronExpression: z.string().optional(),
        enabled: z.boolean().optional(),
        retryOnFailure: z.boolean().optional(),
        maxRetries: z.number().optional(),
        notifyOnFailure: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

        const updates: any = {};
        if (input.cronExpression !== undefined) {
          updates.cronExpression = input.cronExpression;
          updates.nextRunAt = scheduleRunner.calculateNextRun(input.cronExpression);
        }
        if (input.enabled !== undefined) updates.enabled = input.enabled;
        if (input.retryOnFailure !== undefined) updates.retryOnFailure = input.retryOnFailure;
        if (input.maxRetries !== undefined) updates.maxRetries = input.maxRetries;
        if (input.notifyOnFailure !== undefined) updates.notifyOnFailure = input.notifyOnFailure;

        await db.update(scrapeSchedules).set(updates)
          .where(eq(scrapeSchedules.id, input.id));
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        await db.delete(scrapeSchedules).where(eq(scrapeSchedules.id, input.id));
        return { success: true };
      }),

    runNow: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

        // Set nextRunAt to now to trigger on next tick
        await db.update(scrapeSchedules).set({ nextRunAt: Date.now() - 1000 })
          .where(eq(scrapeSchedules.id, input.id));

        // Trigger tick immediately
        await scheduleRunner.tick();
        return { success: true, message: "Schedule triggered" };
      }),
  }),

  // ─── CSV/Excel Upload ────────────────────────────────────────────
  csvUpload: router({
    ingest: protectedProcedure
      .input(z.object({
        csvContent: z.string().min(1),
        batchName: z.string().min(1),
        recordType: z.string().default("entity"),
        columnMapping: z.record(z.string(), z.string()).optional(),
        format: z.enum(["csv", "tsv"]).default("csv"),
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.format === "tsv") {
          return csvUploadService.ingestTSV(input.csvContent, input.batchName, input.recordType, ctx.user.id);
        }
        return csvUploadService.ingestCSV(
          input.csvContent, input.batchName, input.recordType,
          input.columnMapping, ctx.user.id,
        );
      }),

    batches: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(bulkImportBatches)
        .where(eq(bulkImportBatches.importType, "csv_upload"))
        .orderBy(desc(bulkImportBatches.createdAt))
        .limit(30);
    }),

    previewHeaders: protectedProcedure
      .input(z.object({
        csvContent: z.string().min(1),
        format: z.enum(["csv", "tsv"]).default("csv"),
      }))
      .mutation(({ input }) => {
        const lines = input.csvContent.split(/\r?\n/).filter(l => l.trim());
        if (lines.length === 0) return { headers: [], sampleRows: [], totalRows: 0 };

        const delimiter = input.format === "tsv" ? "\t" : ",";
        const headers = lines[0].split(delimiter).map(h => h.replace(/^"|"$/g, "").trim());
        const sampleRows = lines.slice(1, 6).map(line =>
          line.split(delimiter).map(c => c.replace(/^"|"$/g, "").trim())
        );
        return { headers, sampleRows, totalRows: lines.length - 1 };
      }),
  }),

  // ─── Insight-to-Action Workflow ──────────────────────────────────
  insightActions: router({
    pending: protectedProcedure.query(() => insightActionService.getPendingActions()),

    stats: protectedProcedure.query(() => insightActionService.getStats()),

    complete: protectedProcedure
      .input(z.object({ actionId: z.number() }))
      .mutation(async ({ input }) => {
        await insightActionService.completeAction(input.actionId);
        return { success: true };
      }),

    dismiss: protectedProcedure
      .input(z.object({ actionId: z.number() }))
      .mutation(async ({ input }) => {
        await insightActionService.dismissAction(input.actionId);
        return { success: true };
      }),

    generateAndProcess: protectedProcedure.mutation(async () => {
      return insightActionService.generateAndProcess();
    }),

    history: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const actions = await db.select().from(insightActions)
        .orderBy(desc(insightActions.createdAt))
        .limit(50);

      const enriched = [];
      for (const action of actions) {
        const [insight] = await db.select().from(ingestionInsights)
          .where(eq(ingestionInsights.id, action.insightId))
          .limit(1);
        enriched.push({ ...action, insight: insight || null });
      }
      return enriched;
    }),
  }),
});
