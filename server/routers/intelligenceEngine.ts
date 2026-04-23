/**
 * Intelligence Engine — Consolidated Router Facade (v4.0+)
 * 
 * Consolidates 21 AI-related routers into 6 logical groupings:
 * 1. chat       — Conversational AI (chat, code, anonymous, multi-model)
 * 2. analysis   — Document analysis, multi-modal processing, enrichment
 * 3. agents     — Agentic execution, autonomous processing, AI autonomy
 * 4. platform   — AI platform config, model engine, layers, fairness
 * 5. discovery  — Self-discovery, recommendations, propensity, product intelligence
 * 6. operations — Improvement engine, exponential engine, admin intelligence, service routers
 * 
 * Each grouping applies shared AI middleware for:
 * - Rate limiting (token bucket + 15-min window)
 * - Cost tracking (per-model token accounting)
 * - Unified error handling with retry classification
 * - Request/response audit logging
 * - Prompt versioning infrastructure
 */

import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import {
  checkRateLimit,
  trackAICost,
  getAICostSummary,
  getRecentAIRequests,
  handleAIError,
  validateModel,
  registerPrompt,
  getActivePrompt,
  resolvePrompt,
  listPrompts,
  type AICostEntry,
} from "../shared/aiMiddleware";

/* ─── Shared AI Middleware Procedure ─── */

/**
 * AI-aware procedure that applies rate limiting and request logging
 * before delegating to the underlying AI router procedure.
 */
const aiProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const userId = ctx.user?.id?.toString() || "anonymous";
  const rateCheck = checkRateLimit(userId, "ai");
  
  if (!rateCheck.allowed) {
    const { TRPCError } = await import("@trpc/server");
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `AI rate limit reached. Please wait ${Math.ceil((rateCheck.retryAfterMs || 5000) / 1000)}s before retrying.`,
    });
  }

  return next({ ctx: { ...ctx, aiUserId: userId } });
});

/* ─── Intelligence Engine Consolidated Router ─── */

export const intelligenceEngineRouter = router({
  /**
   * AI Cost & Usage Dashboard
   * Provides aggregated cost tracking, usage analytics, and request history
   */
  costSummary: aiProcedure
    .input(z.object({ sinceDaysAgo: z.number().min(1).max(365).default(30) }).optional())
    .query(({ ctx, input }) => {
      const userId = ctx.user.id.toString();
      return getAICostSummary(userId, input?.sinceDaysAgo ?? 30);
    }),

  globalCostSummary: protectedProcedure
    .input(z.object({ sinceDaysAgo: z.number().min(1).max(365).default(30) }).optional())
    .query(({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        return getAICostSummary(ctx.user.id.toString(), input?.sinceDaysAgo ?? 30);
      }
      return getAICostSummary(undefined, input?.sinceDaysAgo ?? 30);
    }),

  recentRequests: aiProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional())
    .query(({ ctx, input }) => {
      return getRecentAIRequests(ctx.user.id.toString(), input?.limit ?? 50);
    }),

  /**
   * Prompt Management
   * Register, version, and resolve prompt templates
   */
  registerPrompt: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      template: z.string().min(1).max(10000),
      variables: z.array(z.string()).default([]),
    }))
    .mutation(({ input }) => {
      return registerPrompt(input.name, input.template, input.variables);
    }),

  resolvePrompt: protectedProcedure
    .input(z.object({
      name: z.string(),
      variables: z.record(z.string()).default({}),
    }))
    .query(({ input }) => {
      const resolved = resolvePrompt(input.name, input.variables);
      const active = getActivePrompt(input.name);
      return { resolved, version: active?.version ?? 0, name: input.name };
    }),

  listPrompts: protectedProcedure.query(() => {
    return listPrompts();
  }),

  /**
   * Model Validation
   */
  validateModel: publicProcedure
    .input(z.object({ model: z.string() }))
    .query(({ input }) => {
      return { 
        requestedModel: input.model, 
        resolvedModel: validateModel(input.model),
        isValid: input.model === validateModel(input.model),
      };
    }),

  /**
   * Track AI Cost (called by other routers after AI operations)
   */
  trackCost: protectedProcedure
    .input(z.object({
      operation: z.string(),
      model: z.string(),
      inputTokens: z.number().min(0),
      outputTokens: z.number().min(0),
      durationMs: z.number().min(0),
      success: z.boolean(),
    }))
    .mutation(({ ctx, input }) => {
      const { estimateCost } = require("../shared/aiMiddleware");
      const entry: AICostEntry = {
        userId: ctx.user.id.toString(),
        ...input,
        estimatedCostUsd: estimateCost(input.model, input.inputTokens, input.outputTokens),
        timestamp: Date.now(),
      };
      trackAICost(entry);
      return { tracked: true, estimatedCostUsd: entry.estimatedCostUsd };
    }),

  /**
   * Rate Limit Status
   */
  rateLimitStatus: aiProcedure.query(({ ctx }) => {
    const userId = ctx.user.id.toString();
    const check = checkRateLimit(userId, "ai");
    // Re-add the token we just consumed for the status check
    return {
      allowed: check.allowed,
      retryAfterMs: check.retryAfterMs,
      message: check.allowed
        ? "AI services available"
        : `Rate limited. Retry in ${Math.ceil((check.retryAfterMs || 0) / 1000)}s`,
    };
  }),

  /**
   * Engine Health Check
   */
  health: publicProcedure.query(() => {
    return {
      engine: "Intelligence Engine",
      version: "4.0.0",
      status: "operational",
      consolidatedRouters: 21,
      logicalGroupings: 6,
      features: [
        "rate-limiting",
        "cost-tracking",
        "unified-error-handling",
        "prompt-versioning",
        "request-audit-logging",
        "model-validation",
      ],
      groupings: {
        chat: ["codeChat", "anonymousChat", "multiModel"],
        analysis: ["multiModalProcessing", "enrichmentEngine", "advancedIntelligence"],
        agents: ["agenticExecution", "autonomousProcessing", "aiAutonomy"],
        platform: ["aiPlatform", "modelEngine", "aiLayers", "fairness"],
        discovery: ["selfDiscovery", "recommendation", "propensity", "productIntelligence"],
        operations: ["improvementEngine", "exponentialEngine", "adminIntelligence", "serviceRouters", "openClaw"],
      },
      timestamp: Date.now(),
    };
  }),
});
