import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getAvailablePerspectives, getBuiltInPresets } from "../multiModel";
import {
  listUserModelPresets, createModelPreset, updateModelPreset, deleteModelPreset,
  getModelUsageStats, getModelUsageTimeline, getModelRatingSummary, getOperationTypeBreakdown,
} from "../db";

export const multiModelRouter = router({
  perspectives: protectedProcedure.query(() => getAvailablePerspectives()),
  presets: protectedProcedure.query(() => getBuiltInPresets()),

  // ─── PRESET CRUD ──────────────────────────────────────────────────
  listPresets: protectedProcedure.query(async ({ ctx }) => {
    const rows = await listUserModelPresets(ctx.user.id);
    return rows.map((r) => ({
      id: r.id,
      ...(r.config as any),
    }));
  }),

  savePreset: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      perspectives: z.array(z.string()).min(1),
      weights: z.record(z.string(), z.number().min(0).max(2)),
      modelPreferences: z.object({
        primary: z.string().optional(),
        fallback: z.string().optional(),
        synthesis: z.string().optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return createModelPreset(ctx.user.id, input);
    }),

  updatePreset: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(500).optional(),
      perspectives: z.array(z.string()).min(1).optional(),
      weights: z.record(z.string(), z.number().min(0).max(2)).optional(),
      modelPreferences: z.object({
        primary: z.string().optional(),
        fallback: z.string().optional(),
        synthesis: z.string().optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      return updateModelPreset(id, ctx.user.id, updates);
    }),

  deletePreset: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return deleteModelPreset(input.id, ctx.user.id);
    }),

  // Keep legacy endpoint for backward compat
  saveCustomPreset: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      perspectives: z.array(z.string()).min(1),
      weights: z.record(z.string(), z.number().min(0).max(2)),
    }))
    .mutation(async ({ ctx, input }) => {
      return createModelPreset(ctx.user.id, input);
    }),

  // ─── MODEL ANALYTICS ─────────────────────────────────────────────
  usageStats: protectedProcedure
    .input(z.object({ days: z.number().min(1).max(365).default(30) }).optional())
    .query(async ({ ctx, input }) => {
      const days = input?.days ?? 30;
      const isAdmin = ctx.user.role === "admin";
      return getModelUsageStats(isAdmin ? undefined : ctx.user.id, days);
    }),

  usageTimeline: protectedProcedure
    .input(z.object({ days: z.number().min(1).max(365).default(30) }).optional())
    .query(async ({ ctx, input }) => {
      const days = input?.days ?? 30;
      const isAdmin = ctx.user.role === "admin";
      return getModelUsageTimeline(isAdmin ? undefined : ctx.user.id, days);
    }),

  ratingSummary: protectedProcedure
    .input(z.object({ days: z.number().min(1).max(365).default(30) }).optional())
    .query(async ({ ctx, input }) => {
      const days = input?.days ?? 30;
      const isAdmin = ctx.user.role === "admin";
      return getModelRatingSummary(isAdmin ? undefined : ctx.user.id, days);
    }),

  operationBreakdown: protectedProcedure
    .input(z.object({ days: z.number().min(1).max(365).default(30) }).optional())
    .query(async ({ ctx, input }) => {
      const days = input?.days ?? 30;
      const isAdmin = ctx.user.role === "admin";
      return getOperationTypeBreakdown(isAdmin ? undefined : ctx.user.id, days);
    }),
});
