/**
 * Service Routers — Wiring for previously orphaned services
 * esignature, pdfGenerator, creditBureau, crmAdapter
 */
import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";

// ─── eSignature Router ────────────────────────────────────────────────────
export const esignatureRouter = router({
  getEnvelopes: protectedProcedure
    .input(z.object({ clientUserId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const { getEnvelopesByProfessional, getEnvelopesByClient } = await import("../services/esignatureService");
      if (input?.clientUserId) return getEnvelopesByClient(input.clientUserId);
      return getEnvelopesByProfessional(ctx.user.id);
    }),

  getEnvelope: protectedProcedure
    .input(z.object({ envelopeId: z.string() }))
    .query(async ({ input }) => {
      const { getEnvelopeByEnvelopeId } = await import("../services/esignatureService");
      const envelope = await getEnvelopeByEnvelopeId(input.envelopeId);
      if (!envelope) throw new TRPCError({ code: "NOT_FOUND", message: "Envelope not found" });
      return envelope;
    }),

  create: protectedProcedure
    .input(z.object({
      documentType: z.string().optional(),
      clientUserId: z.number().optional(),
      provider: z.enum(["docusign", "dropbox_sign", "manual"]).default("docusign"),
      relatedProductId: z.number().optional(),
      relatedQuoteId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { createEnvelope } = await import("../services/esignatureService");
      return createEnvelope({
        professionalId: ctx.user.id,
        clientUserId: input.clientUserId,
        provider: input.provider,
        documentType: input.documentType,
        relatedProductId: input.relatedProductId,
        relatedQuoteId: input.relatedQuoteId,
      });
    }),

  getPending: protectedProcedure.query(async ({ ctx }) => {
    const { getPendingEnvelopes } = await import("../services/esignatureService");
    return getPendingEnvelopes(ctx.user.id);
  }),

  getStats: protectedProcedure.query(async ({ ctx }) => {
    const { getSignatureStats } = await import("../services/esignatureService");
    return getSignatureStats(ctx.user.id);
  }),
});

// ─── PDF Generator Router ────────────────────────────────────────────────
export const pdfRouter = router({
  generateReport: protectedProcedure
    .input(z.object({
      type: z.enum(["financial", "conversation", "suitability"]),
      clientName: z.string(),
      advisorName: z.string().optional(),
      firmName: z.string().optional(),
      sections: z.array(z.object({
        title: z.string(),
        type: z.string(),
        data: z.any(),
      })).optional(),
      conversationTitle: z.string().optional(),
      messages: z.array(z.object({
        role: z.string(),
        content: z.string(),
        timestamp: z.string().optional(),
      })).optional(),
    }))
    .mutation(async ({ input }) => {
      const { generateFinancialReport, generateConversationPDF, generateSuitabilityPDF } = await import("../services/pdfGenerator");
      let buffer: Buffer;
      const now = new Date();
      switch (input.type) {
        case "financial":
          buffer = await generateFinancialReport({
            clientName: input.clientName,
            advisorName: input.advisorName,
            firmName: input.firmName,
            generatedAt: now,
            sections: (input.sections || []) as any,
          });
          break;
        case "conversation":
          buffer = await generateConversationPDF({
            clientName: input.clientName,
            advisorName: input.advisorName,
            firmName: input.firmName,
            conversationTitle: input.conversationTitle || "Conversation",
            mode: "chat",
            messages: (input.messages || []).map(m => ({
              role: m.role as "user" | "assistant" | "system",
              content: m.content,
              createdAt: m.timestamp ? new Date(m.timestamp) : now,
            })),
            generatedAt: now,
          });
          break;
        case "suitability":
          buffer = await generateSuitabilityPDF({
            clientName: input.clientName,
            advisorName: input.advisorName,
            firmName: input.firmName,
            generatedAt: now,
            overallScore: 0,
            dimensions: [],
            confidenceLevel: 0,
            dataCompleteness: 0,
            status: "draft",
          });
          break;
      }
      return { pdf: buffer.toString("base64"), filename: `${input.clientName}-${input.type}-report.pdf` };
    }),
});

// ─── Credit Bureau Router ────────────────────────────────────────────────
export const creditBureauRouter = router({
  getRating: protectedProcedure
    .input(z.object({ score: z.number().min(300).max(850) }))
    .query(async ({ input }) => {
      const { getCreditRating } = await import("../services/creditBureau");
      return getCreditRating(input.score);
    }),

  analyzeDTI: protectedProcedure
    .input(z.object({
      monthlyDebtPayments: z.number().min(0),
      grossMonthlyIncome: z.number().min(1),
    }))
    .query(async ({ input }) => {
      const { analyzeDTI } = await import("../services/creditBureau");
      return analyzeDTI(input.monthlyDebtPayments, input.grossMonthlyIncome);
    }),

  assessInsuranceImpact: protectedProcedure
    .input(z.object({ creditScore: z.number().min(300).max(850) }))
    .query(async ({ input }) => {
      const { assessInsuranceImpact } = await import("../services/creditBureau");
      return assessInsuranceImpact(input.creditScore);
    }),

  getHistory: protectedProcedure.query(async ({ ctx }) => {
    const { getCreditHistory } = await import("../services/creditBureau");
    return getCreditHistory(ctx.user.id);
  }),
});

// ─── CRM Adapter Router ─────────────────────────────────────────────────
export const crmRouter = router({
  sync: adminProcedure
    .input(z.object({
      provider: z.enum(["wealthbox", "salesforce", "redtail"]),
      direction: z.enum(["push", "pull", "bidirectional"]).default("pull"),
    }))
    .mutation(async ({ input }) => {
      const { syncCRM } = await import("../services/crmAdapter");
      return syncCRM(input.provider, {}, input.direction);
    }),
});
