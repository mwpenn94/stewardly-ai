/**
 * Advanced Intelligence Router — Wires phantom services into production
 * consensusLLM, modelComparison, financialPlanningAgent, batchAIPipeline,
 * reportExporter, feedbackCollector, templateOptimizer
 */
import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";

export const advancedIntelligenceRouter = router({
  // ─── Consensus LLM ─────────────────────────────────────────────────
  consensusQuery: protectedProcedure
    .input(z.object({
      prompt: z.string(),
      requireConsensus: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const { consensusLLM } = await import("../services/consensusLLM");
      return consensusLLM({
        userId: ctx.user!.id,
        contextType: "analysis",
        messages: [{ role: "user", content: input.prompt }],
        requireConsensus: input.requireConsensus,
      });
    }),

  // ─── Model Comparison ──────────────────────────────────────────────
  compareModels: protectedProcedure
    .input(z.object({
      prompt: z.string(),
      models: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { compareModels } = await import("../services/modelComparison");
      return compareModels({ prompt: input.prompt, models: input.models, userId: ctx.user!.id });
    }),

  estimateCost: protectedProcedure
    .input(z.object({ prompt: z.string(), modelCount: z.number().default(3) }))
    .query(async ({ input }) => {
      const { estimateCost } = await import("../services/modelComparison");
      return { estimatedCost: estimateCost(input.prompt, input.modelCount) };
    }),

  // ─── Financial Planning Agent ──────────────────────────────────────
  generatePlan: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { generateComprehensivePlan } = await import("../services/financialPlanningAgent");
      return generateComprehensivePlan(input.clientId, ctx.user!.id);
    }),

  // ─── Batch Pipeline ────────────────────────────────────────────────
  batchProcess: adminProcedure
    .input(z.object({
      leadIds: z.array(z.number()),
      operations: z.array(z.enum(["enrich", "score"])),
    }))
    .mutation(async ({ input }) => {
      const { batchProcess } = await import("../services/batchAIPipeline");
      return batchProcess(input.leadIds, input.operations);
    }),

  // ─── Report Export ─────────────────────────────────────────────────
  exportReport: protectedProcedure
    .input(z.object({
      type: z.enum(["financial_plan", "pre_meeting_brief", "suitability_assessment", "calculator_analysis", "holistic_summary"]),
      clientId: z.number(),
      format: z.enum(["pdf", "markdown"]).default("markdown"),
      data: z.record(z.string(), z.any()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { exportReport } = await import("../services/reportExporter");
      return exportReport({
        type: input.type,
        clientId: input.clientId,
        advisorId: ctx.user!.id,
        format: input.format,
        data: input.data || {},
      });
    }),

  // ─── Feedback / Ratings ────────────────────────────────────────────
  rateResponse: protectedProcedure
    .input(z.object({
      messageId: z.number(),
      rating: z.enum(["thumbs_up", "thumbs_down"]),
      feedbackText: z.string().optional(),
      model: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { recordRating } = await import("../services/feedbackCollector");
      await recordRating({ userId: ctx.user!.id, ...input });
      return { success: true };
    }),

  getRatings: protectedProcedure
    .input(z.object({ model: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const { getAggregateRatings } = await import("../services/feedbackCollector");
      return getAggregateRatings(input?.model);
    }),

  // ─── Usage Tracking ────────────────────────────────────────────────
  getUsageBudget: protectedProcedure.query(async ({ ctx }) => {
    const { checkBudget } = await import("../services/usageTracker");
    return checkBudget(ctx.user!.id);
  }),

  // ─── Template Optimization (admin) ─────────────────────────────────
  runTemplateOptimization: adminProcedure.mutation(async () => {
    const { optimizeTemplates } = await import("../services/templateOptimizer");
    return optimizeTemplates();
  }),

  getBestModel: protectedProcedure
    .input(z.object({ domain: z.string() }))
    .query(async ({ input }) => {
      const { getBestModelForDomain } = await import("../services/templateOptimizer");
      return { model: await getBestModelForDomain(input.domain) };
    }),

  // ─── Difference Highlighting ───────────────────────────────────────
  highlightDifferences: protectedProcedure
    .input(z.object({ primary: z.string(), secondary: z.string() }))
    .query(async ({ input }) => {
      const { highlightDifferences } = await import("../services/differenceHighlighter");
      return highlightDifferences(input.primary, input.secondary);
    }),
});
