/**
 * Financial Data Router — Pass 121
 *
 * tRPC procedures for the financial data adapter registry,
 * PFM CSV import, and data authorization management.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getAdapterRegistry } from "../services/financialData/registry";
import { parsePfmCsv } from "../services/financialData/pfmParser/csvParser";
import { getDb } from "../db";
import { dataAccessAudit, pfmImports, dataAuthorizations } from "../../drizzle/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import type { PfmSource } from "../services/financialData/types";

export const financialDataRouter = router({
  /**
   * Get health status of all registered adapters
   */
  adapterHealth: publicProcedure.query(async () => {
    const registry = getAdapterRegistry();
    const results = await registry.healthCheckAll();
    return {
      adapters: results,
      summary: {
        total: results.length,
        healthy: results.filter(r => r.status === "healthy").length,
        degraded: results.filter(r => r.status === "degraded").length,
        notConfigured: results.filter(r => r.status === "not_configured").length,
        offline: results.filter(r => r.status === "offline").length,
      },
    };
  }),

  /**
   * List all registered adapters with their metadata
   */
  listAdapters: publicProcedure.query(() => {
    const registry = getAdapterRegistry();
    return registry.listAdapters().map(a => ({
      id: a.id,
      name: a.name,
      description: a.description,
      tier: a.tier,
      requiresKey: a.requiresKey,
      supportedActions: a.supportedActions,
    }));
  }),

  /**
   * Query a specific adapter with audit trail
   */
  queryAdapter: protectedProcedure
    .input(z.object({
      adapterId: z.string(),
      action: z.string(),
      params: z.record(z.unknown()).default({}),
      clientId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const registry = getAdapterRegistry();
      const adapter = await registry.getAdapter(input.adapterId);
      if (!adapter) {
        throw new TRPCError({ code: "NOT_FOUND", message: `Adapter '${input.adapterId}' not found` });
      }

      const start = Date.now();
      let responseStatus = "success";
      try {
        const result = await adapter.query(input.action, input.params);
        const latencyMs = Date.now() - start;

        // Audit trail
        try {
          const db = await getDb();
          if (db) {
            await db.insert(dataAccessAudit).values({
              adapterId: input.adapterId,
              action: input.action,
              userId: ctx.user.id,
              clientId: input.clientId || null,
              requestParams: JSON.stringify(input.params),
              responseStatus: "success",
              latencyMs,
              timestamp: Date.now(),
            });
          }
        } catch { /* audit failure is non-fatal */ }

        return { ...result, latencyMs };
      } catch (err) {
        responseStatus = "error";
        const latencyMs = Date.now() - start;

        // Audit trail for errors too
        try {
          const db = await getDb();
          if (db) {
            await db.insert(dataAccessAudit).values({
              adapterId: input.adapterId,
              action: input.action,
              userId: ctx.user.id,
              clientId: input.clientId || null,
              requestParams: JSON.stringify(input.params),
              responseStatus: "error",
              latencyMs,
              timestamp: Date.now(),
            });
          }
        } catch { /* audit failure is non-fatal */ }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : "Adapter query failed",
        });
      }
    }),

  /**
   * Import PFM CSV data
   */
  importPfmCsv: protectedProcedure
    .input(z.object({
      csvContent: z.string().max(10_000_000), // 10MB max
      sourceHint: z.enum(["mint", "empower", "monarch", "ynab", "quicken", "everydollar", "other"]).optional(),
      filename: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = parsePfmCsv(input.csvContent, input.sourceHint as PfmSource | undefined);

      // Save import record
      try {
        const db = await getDb();
        if (db) {
          await db.insert(pfmImports).values({
            userId: ctx.user.id,
            source: result.detectedSource,
            filename: input.filename || null,
            totalRows: result.result.totalRows,
            importedRows: result.result.importedRows,
            skippedRows: result.result.skippedRows,
            dateRangeStart: result.result.dateRange.start || null,
            dateRangeEnd: result.result.dateRange.end || null,
            categoryBreakdown: JSON.stringify(result.result.categoryBreakdown),
            warnings: JSON.stringify(result.result.warnings),
            status: "completed",
          });
        }
      } catch { /* non-fatal */ }

      return {
        detectedSource: result.detectedSource,
        mappings: result.mappings,
        summary: result.result,
        transactions: result.transactions.slice(0, 100), // Return first 100 for preview
        totalTransactions: result.transactions.length,
      };
    }),

  /**
   * Get PFM import history
   */
  pfmHistory: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(pfmImports)
      .where(eq(pfmImports.userId, ctx.user.id))
      .orderBy(desc(pfmImports.createdAt))
      .limit(50);
  }),

  /**
   * Get data access audit trail
   */
  auditTrail: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(200).default(50),
      adapterId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [eq(dataAccessAudit.userId, ctx.user.id)];
      if (input.adapterId) {
        conditions.push(eq(dataAccessAudit.adapterId, input.adapterId));
      }
      return db.select().from(dataAccessAudit)
        .where(and(...conditions))
        .orderBy(desc(dataAccessAudit.timestamp))
        .limit(input.limit);
    }),

  /**
   * Quick macro-economic data fetch (FRED + BEA + BLS combined)
   */
  macroSnapshot: publicProcedure.query(async ({ ctx }) => {
    const registry = getAdapterRegistry();
    const results: Record<string, any> = {};

    // FRED: Key rates
    const fred = await registry.getAdapter("fred");
    if (fred) {
      try {
        const fedFunds = await fred.query("series", { seriesId: "FEDFUNDS" });
        results.fedFundsRate = fedFunds.data;
      } catch { results.fedFundsRate = null; }
      try {
        const cpi = await fred.query("series", { seriesId: "CPIAUCSL" });
        results.cpi = cpi.data;
      } catch { results.cpi = null; }
      try {
        const unemployment = await fred.query("series", { seriesId: "UNRATE" });
        results.unemployment = unemployment.data;
      } catch { results.unemployment = null; }
    }

    // Treasury: Yield curve
    const treasury = await registry.getAdapter("treasury");
    if (treasury) {
      try {
        const yields = await treasury.query("rates", { type: "daily_treasury_yield_curve" });
        results.treasuryYields = yields.data;
      } catch { results.treasuryYields = null; }
    }

    // BLS: Latest employment
    const bls = await registry.getAdapter("bls");
    if (bls) {
      try {
        const employment = await bls.query("series", { seriesId: "CES0000000001" });
        results.totalNonfarmPayrolls = employment.data;
      } catch { results.totalNonfarmPayrolls = null; }
    }

    // Audit
    try {
      const db = await getDb();
      if (db) {
        await db.insert(dataAccessAudit).values({
          adapterId: "macro_snapshot",
          action: "snapshot",
          userId: (ctx as any).user?.id ?? 0,
          requestParams: null,
          responseStatus: "success",
          latencyMs: 0,
          timestamp: Date.now(),
        });
      }
    } catch { /* non-fatal */ }

    return results;
  }),

  /**
   * Data authorization management
   */
  grantDataAuth: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      dataScope: z.string(),
      consentLanguage: z.string().optional(),
      stateJurisdiction: z.string().optional(),
      expiresInDays: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const now = Date.now();
      const expiresAt = input.expiresInDays ? now + input.expiresInDays * 86400000 : null;
      await db.insert(dataAuthorizations).values({
        clientId: input.clientId,
        advisorId: ctx.user.id,
        dataScope: input.dataScope,
        consentLanguage: input.consentLanguage || null,
        stateJurisdiction: input.stateJurisdiction || null,
        grantedAt: now,
        expiresAt,
        status: "active",
      });
      return { success: true };
    }),

  revokeDataAuth: protectedProcedure
    .input(z.object({ authorizationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.update(dataAuthorizations)
        .set({ revokedAt: Date.now(), status: "revoked" })
        .where(and(
          eq(dataAuthorizations.id, input.authorizationId),
          eq(dataAuthorizations.advisorId, ctx.user.id),
        ));
      return { success: true };
    }),

  getDataAuths: protectedProcedure
    .input(z.object({ clientId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [eq(dataAuthorizations.advisorId, ctx.user.id)];
      if (input.clientId) conditions.push(eq(dataAuthorizations.clientId, input.clientId));
      return db.select().from(dataAuthorizations)
        .where(and(...conditions))
        .orderBy(desc(dataAuthorizations.grantedAt));
    }),
});
