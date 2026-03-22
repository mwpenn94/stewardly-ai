import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import {
  seedIulCreditingHistory,
  getCreditingHistory,
  getAvailableStrategies,
  getAverageCreditingByStrategy,
  seedMarketIndexHistory,
  getIndexHistory,
  getLatestIndexValues,
  compareIndices,
} from "../services/iulMarketData";
import {
  fetchRiskProfile,
  assessRiskManually,
  getCachedRiskProfile,
  getRiskProfileHistory,
} from "../services/nitrogenRisk";
import {
  createEnvelope,
  updateEnvelopeStatus,
  getEnvelopesByProfessional,
  getEnvelopesByClient,
  getEnvelopeByEnvelopeId,
  getPendingEnvelopes,
  getSignatureStats,
  handleWebhook,
} from "../services/esignatureService";

export const productIntelligenceRouter = router({
  // ─── IUL Crediting History ──────────────────────────────────────────────
  seedIulData: protectedProcedure.mutation(async () => {
    const count = await seedIulCreditingHistory();
    return { seeded: count };
  }),

  creditingHistory: publicProcedure
    .input(z.object({ productId: z.number(), strategy: z.string().optional() }))
    .query(async ({ input }) => {
      return getCreditingHistory(input.productId, input.strategy);
    }),

  availableStrategies: publicProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ input }) => {
      return getAvailableStrategies(input.productId);
    }),

  avgCreditingByStrategy: publicProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ input }) => {
      return getAverageCreditingByStrategy(input.productId);
    }),

  // ─── Market Index History ───────────────────────────────────────────────
  seedMarketData: protectedProcedure.mutation(async () => {
    const count = await seedMarketIndexHistory();
    return { seeded: count };
  }),

  indexHistory: publicProcedure
    .input(z.object({ symbol: z.string(), months: z.number().optional() }))
    .query(async ({ input }) => {
      return getIndexHistory(input.symbol, input.months);
    }),

  latestIndices: publicProcedure.query(async () => {
    return getLatestIndexValues();
  }),

  compareIndices: publicProcedure
    .input(z.object({ symbols: z.array(z.string()), months: z.number().default(12) }))
    .query(async ({ input }) => {
      return compareIndices(input.symbols, input.months);
    }),

  // ─── Nitrogen Risk Profiling ────────────────────────────────────────────
  riskProfile: protectedProcedure.query(async ({ ctx }) => {
    return getCachedRiskProfile(ctx.user.id);
  }),

  fetchRiskProfile: protectedProcedure
    .input(z.object({ externalId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return fetchRiskProfile(ctx.user.id, input.externalId);
    }),

  assessRisk: protectedProcedure
    .input(z.object({
      age: z.number(),
      investmentExperience: z.enum(["none", "beginner", "intermediate", "advanced"]),
      timeHorizon: z.enum(["1-3", "3-5", "5-10", "10+"]),
      reactionToLoss: z.enum(["sell_all", "sell_some", "hold", "buy_more"]),
      incomeStability: z.enum(["unstable", "moderate", "stable", "very_stable"]),
      goalPriority: z.enum(["preservation", "income", "growth", "aggressive_growth"]),
    }))
    .mutation(async ({ ctx, input }) => {
      return assessRiskManually(ctx.user.id, input);
    }),

  riskHistory: protectedProcedure.query(async ({ ctx }) => {
    return getRiskProfileHistory(ctx.user.id);
  }),

  // ─── eSignature Tracking ────────────────────────────────────────────────
  createEnvelope: protectedProcedure
    .input(z.object({
      clientUserId: z.number().optional(),
      provider: z.enum(["docusign", "dropbox_sign", "manual"]),
      documentType: z.string().optional(),
      relatedProductId: z.number().optional(),
      relatedQuoteId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return createEnvelope({
        professionalId: ctx.user.id,
        ...input,
      });
    }),

  updateEnvelopeStatus: protectedProcedure
    .input(z.object({
      envelopeId: z.string(),
      status: z.enum(["created", "sent", "delivered", "viewed", "signed", "completed", "declined", "voided", "expired"]),
    }))
    .mutation(async ({ input }) => {
      await updateEnvelopeStatus(input);
      return { success: true };
    }),

  myEnvelopes: protectedProcedure.query(async ({ ctx }) => {
    return getEnvelopesByProfessional(ctx.user.id);
  }),

  clientEnvelopes: protectedProcedure
    .input(z.object({ clientUserId: z.number() }))
    .query(async ({ input }) => {
      return getEnvelopesByClient(input.clientUserId);
    }),

  envelopeDetail: protectedProcedure
    .input(z.object({ envelopeId: z.string() }))
    .query(async ({ input }) => {
      return getEnvelopeByEnvelopeId(input.envelopeId);
    }),

  pendingEnvelopes: protectedProcedure.query(async ({ ctx }) => {
    return getPendingEnvelopes(ctx.user.id);
  }),

  signatureStats: protectedProcedure.query(async ({ ctx }) => {
    return getSignatureStats(ctx.user.id);
  }),

  // ─── Webhook (public for external providers) ───────────────────────────
  esignWebhook: publicProcedure
    .input(z.object({
      provider: z.enum(["docusign", "dropbox_sign"]),
      payload: z.any(),
    }))
    .mutation(async ({ input }) => {
      await handleWebhook(input.provider, input.payload);
      return { received: true };
    }),
});
