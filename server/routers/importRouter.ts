/**
 * Import Router — File upload and data import management
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";

export const importRouter = router({
  startImport: protectedProcedure
    .input(z.object({
      importSource: z.string(),
      fileName: z.string(),
      records: z.array(z.record(z.string(), z.string())),
      fieldMapping: z.record(z.string(), z.string()),
      options: z.object({ enrichAfter: z.boolean().optional(), scoreAfter: z.boolean().optional() }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { startImport } = await import("../services/import/importOrchestrator");
      return startImport({ ...input, importedBy: ctx.user!.id });
    }),

  getImportHistory: protectedProcedure.query(async () => {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return [];
    const { importJobs } = await import("../../drizzle/schema");
    const { desc } = await import("drizzle-orm");
    return db.select().from(importJobs).orderBy(desc(importJobs.createdAt)).limit(50);
  }),

  getFieldMappings: protectedProcedure.query(async () => {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return [];
    const { importFieldMappings } = await import("../../drizzle/schema");
    return db.select().from(importFieldMappings);
  }),

  saveFieldMapping: protectedProcedure
    .input(z.object({ name: z.string(), importSource: z.string(), columnMappings: z.record(z.string(), z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const { importFieldMappings } = await import("../../drizzle/schema");
      const [result] = await db.insert(importFieldMappings).values({ name: input.name, importSource: input.importSource, columnMappings: input.columnMappings as any, createdBy: ctx.user!.id }).$returningId();
      return { id: result.id };
    }),
});
