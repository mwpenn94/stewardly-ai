/**
 * Substrate Router — tRPC procedures for substrate primitives
 *
 * Exposes AEGIS, Sovereign routing, Search Cascade, and Classifier
 * through the standard tRPC interface.
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import {
  runPreFlight,
  runPostFlight,
  routeRequest,
  getRoutingStats,
  getCircuitBreakerStatus,
  getRecentDecisions,
  searchCascade,
  classify,
} from "../services/substrate";

export const substrateRouter = router({
  // ─── AEGIS ───────────────────────────────────────────────────────────────
  /** Run pre-flight analysis on a prompt */
  aegisPreFlight: protectedProcedure
    .input(z.object({
      prompt: z.string().min(1).max(50000),
      taskExternalId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return runPreFlight(input.prompt, ctx.user.id, input.taskExternalId);
    }),

  /** Run post-flight analysis on LLM output */
  aegisPostFlight: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      prompt: z.string(),
      output: z.string(),
      taskType: z.string(),
      costActual: z.number().default(0),
    }))
    .mutation(async ({ input }) => {
      return runPostFlight(input.sessionId, input.prompt, input.output, input.taskType, input.costActual);
    }),

  /** Classify a prompt without running the full pipeline */
  classify: protectedProcedure
    .input(z.object({ text: z.string().min(1) }))
    .query(async ({ input }) => {
      return classify(input.text);
    }),

  // ─── Sovereign Routing ─────────────────────────────────────────────────
  /** Route a request through the sovereign layer */
  sovereignRoute: protectedProcedure
    .input(z.object({
      messages: z.array(z.object({
        role: z.string(),
        content: z.string(),
      })),
      requiredCapabilities: z.array(z.string()).optional(),
      maxCost: z.number().optional(),
      preferredProvider: z.string().optional(),
      taskType: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return routeRequest({ ...input, userId: ctx.user.id });
    }),

  /** Get routing statistics */
  sovereignStats: protectedProcedure
    .query(async ({ ctx }) => {
      return getRoutingStats(ctx.user.id);
    }),

  /** Get circuit breaker status */
  sovereignCircuits: protectedProcedure
    .query(async () => {
      return getCircuitBreakerStatus();
    }),

  /** Get recent routing decisions */
  sovereignDecisions: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(20) }).optional())
    .query(async ({ input }) => {
      return getRecentDecisions(input?.limit ?? 20);
    }),

  // ─── Search Cascade ────────────────────────────────────────────────────
  /** Execute a search through the cascade */
  search: protectedProcedure
    .input(z.object({
      query: z.string().min(1).max(1000),
      numResults: z.number().min(1).max(50).default(10),
      dateRange: z.enum(["all", "past_day", "past_week", "past_month", "past_year"]).default("all"),
      categories: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      return searchCascade({
        query: input.query,
        numResults: input.numResults,
        dateRange: input.dateRange,
        categories: input.categories,
      });
    }),
});
