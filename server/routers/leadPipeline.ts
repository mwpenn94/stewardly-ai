/**
 * Lead Pipeline Router — Lead management and pipeline operations
 *
 * All lead queries are scoped by the user's assigned locations via getLocationScope().
 * Admin users bypass location filtering and see all data.
 * Regular users only see leads belonging to their assigned GHL locations.
 */
import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { logger } from "../_core/logger";
import { dispatchWorkflowEvent } from "../services/notificationWorkflows";
import { getLocationScope, canAccessLead } from "../services/locationAccess";

/** Get a raw MySQL pool for location-scoped queries */
async function getPool() {
  try {
    const mysql = await import("mysql2/promise");
    return mysql.createPool(process.env.DATABASE_URL!);
  } catch {
    return null;
  }
}

export const leadPipelineRouter = router({
  /**
   * Get pipeline leads — scoped by user's assigned locations.
   * Admin users see all leads. Regular users see only their locations' leads.
   */
  getPipeline: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
      locationId: z.number().optional(), // optional explicit location filter
    }).optional())
    .query(async ({ ctx, input }) => {
      const pool = await getPool();
      if (!pool) return [];
      try {
        const scope = await getLocationScope(pool, ctx.user as any);

        let where = "WHERE 1=1";
        const params: any[] = [];

        // Location scoping
        if (input?.locationId != null) {
          // Explicit location filter — verify user has access
          if (!scope.isAdmin && !scope.locationIds.includes(input.locationId)) {
            return []; // User doesn't have access to this location
          }
          where += " AND location_id = ?";
          params.push(input.locationId);
        } else if (!scope.isAdmin) {
          if (scope.locationIds.length === 0) return [];
          where += ` AND (location_id IN (${scope.locationIds.join(",")}) OR location_id IS NULL)`;
        }

        // Status filter
        if (input?.status) {
          where += " AND status = ?";
          params.push(input.status);
        }

        const limit = input?.limit || 50;
        const offset = input?.offset || 0;
        params.push(limit, offset);

        const [rows] = await pool.query(
          `SELECT * FROM lead_pipeline ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
          params
        );
        await pool.end();
        return rows as any[];
      } catch (e: any) {
        // @ts-expect-error — overload resolution mismatch
        logger.warn("[leadPipeline.getPipeline]", { error: e?.message?.slice(0, 120) });
        await pool.end().catch(() => {});
        return [];
      }
    }),

  /**
   * Get a single lead's detail — checks location access.
   */
  getLeadDetail: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ ctx, input }) => {
      const pool = await getPool();
      if (!pool) return null;
      try {
        const hasAccess = await canAccessLead(pool, ctx.user as any, input.leadId);
        if (!hasAccess) {
          await pool.end();
          return null; // Silently return null for unauthorized access (don't reveal existence)
        }
        const [rows] = await pool.query(
          "SELECT * FROM lead_pipeline WHERE id = ? LIMIT 1",
          [input.leadId]
        );
        await pool.end();
        return (rows as any[])[0] ?? null;
      } catch (e: any) {
        // @ts-expect-error — overload resolution mismatch
        logger.warn("[leadPipeline.getLeadDetail]", { error: e?.message?.slice(0, 120) });
        await pool.end().catch(() => {});
        return null;
      }
    }),

  /**
   * Assign a lead to an advisor — checks location access first.
   */
  assign: protectedProcedure
    .input(z.object({ leadId: z.number(), advisorId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const pool = await getPool();
      if (!pool) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      try {
        const hasAccess = await canAccessLead(pool, ctx.user as any, input.leadId);
        if (!hasAccess) {
          await pool.end();
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this lead's location" });
        }
        await pool.query(
          "UPDATE lead_pipeline SET assigned_advisor_id = ?, status = 'assigned', updated_at = ? WHERE id = ?",
          [input.advisorId, Date.now(), input.leadId]
        );
        await pool.end();
        dispatchWorkflowEvent({
          type: "lead.assigned",
          userId: input.advisorId,
          data: { leadName: "Lead #" + input.leadId, advisorId: input.advisorId },
          timestamp: Date.now(),
        });
        return { success: true };
      } catch (e: any) {
        await pool.end().catch(() => {});
        if (e instanceof TRPCError) throw e;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: e.message });
      }
    }),

  /**
   * Update lead status — checks location access first.
   */
  updateStatus: protectedProcedure
    .input(z.object({ leadId: z.number(), status: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const pool = await getPool();
      if (!pool) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      try {
        const hasAccess = await canAccessLead(pool, ctx.user as any, input.leadId);
        if (!hasAccess) {
          await pool.end();
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this lead's location" });
        }
        await pool.query(
          "UPDATE lead_pipeline SET status = ?, updated_at = ? WHERE id = ?",
          [input.status, Date.now(), input.leadId]
        );
        await pool.end();
        dispatchWorkflowEvent({
          type: "lead.status_changed",
          userId: 0,
          data: { leadName: "Lead #" + input.leadId, newStatus: input.status },
          timestamp: Date.now(),
        });
        return { success: true };
      } catch (e: any) {
        await pool.end().catch(() => {});
        if (e instanceof TRPCError) throw e;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: e.message });
      }
    }),

  /**
   * Bulk update lead statuses — filters to only leads the user can access.
   */
  bulkUpdateStatus: protectedProcedure
    .input(z.object({ leadIds: z.array(z.number()).min(1).max(100), status: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const pool = await getPool();
      if (!pool) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      try {
        const scope = await getLocationScope(pool, ctx.user as any);
        let accessibleIds = input.leadIds;

        if (!scope.isAdmin) {
          if (scope.locationIds.length === 0) {
            await pool.end();
            throw new TRPCError({ code: "FORBIDDEN", message: "No location access" });
          }
          // Filter to only leads the user can access
          const placeholders = input.leadIds.map(() => "?").join(",");
          const [rows] = await pool.query(
            `SELECT id FROM lead_pipeline WHERE id IN (${placeholders}) AND (location_id IN (${scope.locationIds.join(",")}) OR location_id IS NULL)`,
            input.leadIds
          );
          accessibleIds = (rows as any[]).map((r: any) => r.id);
          if (accessibleIds.length === 0) {
            await pool.end();
            throw new TRPCError({ code: "FORBIDDEN", message: "No accessible leads in selection" });
          }
        }

        const placeholders = accessibleIds.map(() => "?").join(",");
        await pool.query(
          `UPDATE lead_pipeline SET status = ?, updated_at = ? WHERE id IN (${placeholders})`,
          [input.status, Date.now(), ...accessibleIds]
        );
        await pool.end();
        return { success: true, count: accessibleIds.length };
      } catch (e: any) {
        await pool.end().catch(() => {});
        if (e instanceof TRPCError) throw e;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: e.message });
      }
    }),

  /**
   * Source performance — admin only (cross-location analytics).
   */
  sourcePerformance: adminProcedure.query(async () => {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return [];
    const { leadSourcePerformance } = await import("../../drizzle/schema");
    try {
      return await db.select().from(leadSourcePerformance);
    } catch { return []; }
  }),

  /**
   * Delete PII — checks location access first.
   */
  deletePii: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const pool = await getPool();
      if (!pool) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      try {
        const hasAccess = await canAccessLead(pool, ctx.user as any, input.leadId);
        if (!hasAccess) {
          await pool.end();
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this lead's location" });
        }
        await pool.query(
          "UPDATE lead_pipeline SET firstName = '[REDACTED]', lastName = '[REDACTED]', email = NULL, phone = NULL, updated_at = ? WHERE id = ?",
          [Date.now(), input.leadId]
        );
        await pool.end();
        return { success: true };
      } catch (e: any) {
        await pool.end().catch(() => {});
        if (e instanceof TRPCError) throw e;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: e.message });
      }
    }),

  /**
   * Get score history for a lead — checks location access.
   */
  getScoreHistory: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        const pool = await getPool();
        if (pool) {
          const hasAccess = await canAccessLead(pool, ctx.user as any, input.leadId);
          await pool.end();
          if (!hasAccess) return [];
        }
        const { getScoreHistory } = await import("../services/propensity/scoringEngine");
        return getScoreHistory(input.leadId);
      } catch (e: any) {
        // @ts-expect-error — overload resolution mismatch
        logger.warn("[leadPipeline.getScoreHistory]", { error: e?.message?.slice(0, 120) });
        return [];
      }
    }),

  /**
   * Get lead sources — admin only.
   */
  getLeadSources: adminProcedure.query(async () => {
    try {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return [];
      const { leadSources } = await import("../../drizzle/schema");
      return await db.select().from(leadSources);
    } catch (e: any) {
      // @ts-expect-error — overload resolution mismatch
      logger.warn("[leadPipeline.getLeadSources]", { error: e?.message?.slice(0, 120) });
      return [];
    }
  }),
});
