import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import * as pa from "../services/passiveActions";

export const passiveActionsRouter = router({
  /** Get all data source definitions with supported actions */
  dataSources: protectedProcedure.query(() => {
    return {
      sources: pa.getDataSources(),
      actionTypes: pa.getActionTypeMeta(),
    };
  }),

  /** Get all user preferences */
  preferences: protectedProcedure.query(async ({ ctx }) => {
    return pa.getUserPreferences(ctx.user.id);
  }),

  /** Get preferences for a specific source */
  sourcePreferences: protectedProcedure
    .input(z.object({ source: z.string() }))
    .query(async ({ ctx, input }) => {
      return pa.getSourcePreferences(ctx.user.id, input.source);
    }),

  /** Toggle a specific action for a source */
  toggle: protectedProcedure
    .input(
      z.object({
        source: z.string(),
        actionType: z.enum([
          "auto_refresh",
          "background_sync",
          "monitoring_alerts",
          "scheduled_reports",
          "anomaly_detection",
          "smart_enrichment",
        ]),
        enabled: z.boolean(),
        config: z.record(z.string(), z.any()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return pa.toggleAction(
        ctx.user.id,
        input.source,
        input.actionType,
        input.enabled,
        input.config
      );
    }),

  /** Bulk toggle all actions for a source */
  bulkToggleSource: protectedProcedure
    .input(z.object({ source: z.string(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return pa.bulkToggleSource(ctx.user.id, input.source, input.enabled);
    }),

  /** Bulk toggle all sources and actions */
  bulkToggleAll: protectedProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return pa.bulkToggleAll(ctx.user.id, input.enabled);
    }),

  /** Get summary stats */
  stats: protectedProcedure.query(async ({ ctx }) => {
    return pa.getPassiveActionStats(ctx.user.id);
  }),

  /** Get execution history */
  history: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(200).optional() }).optional())
    .query(async ({ ctx, input }) => {
      return pa.getExecutionHistory(ctx.user.id, input?.limit ?? 50);
    }),
});
