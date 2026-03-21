/**
 * Reports Router
 * Generates and serves PDF financial plan reports, conversation exports, and suitability assessments.
 */
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import {
  generateFinancialReport,
  generateConversationPDF,
  generateSuitabilityPDF,
  type ReportSection,
} from "../services/pdfGenerator";
import { getModelRunHistory } from "../services/modelEngine";
import { storagePut } from "../storage";
import { getDb, addAuditEntry, AUDIT_EVENTS } from "../db";
import {
  users,
  conversations,
  messages,
  suitabilityProfiles,
  suitabilityDimensions,
  suitabilityChangeEvents,
} from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

export const reportsRouter = router({
  // Generate a comprehensive financial plan PDF
  generate: protectedProcedure
    .input(z.object({
      modelSlugs: z.array(z.string()).optional(),
      clientName: z.string().optional(),
      advisorName: z.string().optional(),
      firmName: z.string().optional(),
      disclaimer: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      const clientName = input.clientName || user?.name || "Client";

      const allSlugs = [
        "monte-carlo-retirement", "debt-optimization", "tax-optimization",
        "cash-flow-projection", "insurance-gap-analysis", "estate-planning",
        "education-funding", "risk-tolerance-assessment",
      ];
      const slugs = input.modelSlugs?.length ? input.modelSlugs : allSlugs;

      const sections: ReportSection[] = [];
      const modelLabels: Record<string, string> = {
        "monte-carlo-retirement": "Retirement Planning (Monte Carlo)",
        "debt-optimization": "Debt Optimization Strategy",
        "tax-optimization": "Tax Strategy Analysis",
        "cash-flow-projection": "Cash Flow Projection",
        "insurance-gap-analysis": "Insurance Gap Analysis",
        "estate-planning": "Estate Planning Analysis",
        "education-funding": "Education Funding Projection",
        "risk-tolerance-assessment": "Risk Tolerance Assessment",
      };

      for (const slug of slugs) {
        const runs = await getModelRunHistory(slug, 1);
        if (runs.length > 0 && runs[0].status === "completed" && runs[0].outputData) {
          const data = typeof runs[0].outputData === "string"
            ? JSON.parse(runs[0].outputData) : runs[0].outputData;
          sections.push({ title: modelLabels[slug] || slug, modelSlug: slug, data });
        }
      }

      if (sections.length === 0) {
        throw new Error("No model results available. Run at least one model before generating a report.");
      }

      const pdfBuffer = await generateFinancialReport({
        clientName, advisorName: input.advisorName,
        firmName: input.firmName || "Stewardly",
        generatedAt: new Date(), sections, disclaimer: input.disclaimer,
      });

      const timestamp = Date.now();
      const suffix = Math.random().toString(36).substring(2, 8);
      const fileKey = `reports/${ctx.user.id}/financial-plan-${timestamp}-${suffix}.pdf`;
      const { url } = await storagePut(fileKey, pdfBuffer, "application/pdf");

      await addAuditEntry({ userId: ctx.user.id, action: AUDIT_EVENTS.PDF_EXPORT, details: `Financial plan PDF: ${sections.map(s => s.title).join(", ")}` });
      return { url, fileKey, sectionsIncluded: sections.map(s => s.title), generatedAt: new Date().toISOString(), sizeBytes: pdfBuffer.length };
    }),

  // Generate a single model report
  generateSingle: protectedProcedure
    .input(z.object({
      modelSlug: z.string(),
      outputData: z.any(),
      clientName: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      const clientName = input.clientName || user?.name || "Client";

      const modelLabels: Record<string, string> = {
        "monte-carlo-retirement": "Retirement Planning (Monte Carlo)",
        "debt-optimization": "Debt Optimization Strategy",
        "tax-optimization": "Tax Strategy Analysis",
        "cash-flow-projection": "Cash Flow Projection",
        "insurance-gap-analysis": "Insurance Gap Analysis",
        "estate-planning": "Estate Planning Analysis",
        "education-funding": "Education Funding Projection",
        "risk-tolerance-assessment": "Risk Tolerance Assessment",
      };

      const pdfBuffer = await generateFinancialReport({
        clientName, firmName: "Stewardly", generatedAt: new Date(),
        sections: [{ title: modelLabels[input.modelSlug] || input.modelSlug, modelSlug: input.modelSlug, data: input.outputData }],
      });

      const timestamp = Date.now();
      const suffix = Math.random().toString(36).substring(2, 8);
      const fileKey = `reports/${ctx.user.id}/${input.modelSlug}-${timestamp}-${suffix}.pdf`;
      const { url } = await storagePut(fileKey, pdfBuffer, "application/pdf");

      return { url, fileKey, generatedAt: new Date().toISOString(), sizeBytes: pdfBuffer.length };
    }),

  // ─── CONVERSATION EXPORT PDF ───────────────────────────────────────
  exportConversation: protectedProcedure
    .input(z.object({
      conversationId: z.number(),
      advisorName: z.string().optional(),
      firmName: z.string().optional(),
      disclaimer: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Fetch conversation
      const [conv] = await db.select().from(conversations)
        .where(and(eq(conversations.id, input.conversationId), eq(conversations.userId, ctx.user.id)))
        .limit(1);
      if (!conv) throw new Error("Conversation not found or access denied");

      // Fetch messages
      const msgs = await db.select().from(messages)
        .where(eq(messages.conversationId, input.conversationId))
        .orderBy(messages.createdAt);

      if (msgs.length === 0) throw new Error("No messages in this conversation");

      // Get user info
      const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);

      const pdfBuffer = await generateConversationPDF({
        clientName: user?.name || "Client",
        advisorName: input.advisorName,
        firmName: input.firmName || "Stewardly",
        conversationTitle: conv.title || "Conversation",
        mode: conv.mode,
        messages: msgs.map(m => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
          createdAt: m.createdAt,
          confidenceScore: m.confidenceScore,
          complianceStatus: m.complianceStatus,
        })),
        generatedAt: new Date(),
        disclaimer: input.disclaimer,
      });

      const timestamp = Date.now();
      const suffix = Math.random().toString(36).substring(2, 8);
      const fileKey = `reports/${ctx.user.id}/conversation-${input.conversationId}-${timestamp}-${suffix}.pdf`;
      const { url } = await storagePut(fileKey, pdfBuffer, "application/pdf");

      return {
        url, fileKey,
        conversationTitle: conv.title,
        messageCount: msgs.filter(m => m.role !== "system").length,
        generatedAt: new Date().toISOString(),
        sizeBytes: pdfBuffer.length,
      };
    }),

  // ─── SUITABILITY ASSESSMENT PDF ────────────────────────────────────
  exportSuitability: protectedProcedure
    .input(z.object({
      profileId: z.string().optional(), // If not provided, use latest
      advisorName: z.string().optional(),
      firmName: z.string().optional(),
      includeHistory: z.boolean().default(true),
      disclaimer: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get profile
      let profile;
      if (input.profileId) {
        [profile] = await db.select().from(suitabilityProfiles)
          .where(and(eq(suitabilityProfiles.id, input.profileId), eq(suitabilityProfiles.userId, ctx.user.id)))
          .limit(1);
      } else {
        [profile] = await db.select().from(suitabilityProfiles)
          .where(eq(suitabilityProfiles.userId, ctx.user.id))
          .orderBy(desc(suitabilityProfiles.updatedAt))
          .limit(1);
      }
      if (!profile) throw new Error("No suitability profile found. Complete a suitability assessment first.");

      // Get dimensions
      const dims = await db.select().from(suitabilityDimensions)
        .where(eq(suitabilityDimensions.profileId, profile.id));

      // Get change history
      let changeHistory: Array<{ date: string; dimension: string; changeType: string; previousScore?: number; newScore?: number; notes?: string }> = [];
      if (input.includeHistory) {
        const events = await db.select().from(suitabilityChangeEvents)
          .where(eq(suitabilityChangeEvents.profileId, profile.id))
          .orderBy(desc(suitabilityChangeEvents.createdAt))
          .limit(50);
        changeHistory = events.map(e => ({
          date: new Date(e.createdAt).toLocaleDateString("en-US"),
          dimension: e.dimensionKey || "Overall",
          changeType: e.changeType,
          previousScore: e.previousValue ? (typeof e.previousValue === "object" ? (e.previousValue as any).score : undefined) : undefined,
          newScore: e.newValue ? (typeof e.newValue === "object" ? (e.newValue as any).score : undefined) : undefined,
          notes: e.notes || undefined,
        }));
      }

      const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);

      const pdfBuffer = await generateSuitabilityPDF({
        clientName: user?.name || "Client",
        advisorName: input.advisorName,
        firmName: input.firmName || "Stewardly",
        generatedAt: new Date(),
        overallScore: profile.overallScore || 0,
        confidenceLevel: (profile.confidenceLevel || 0) * 100,
        dataCompleteness: (profile.dataCompleteness || 0) * 100,
        status: profile.status || "draft",
        dimensions: dims.map(d => ({
          key: d.dimensionKey,
          label: d.dimensionLabel,
          score: d.score || 0,
          confidence: (d.confidence || 0) * 100,
          value: d.value,
          sources: Array.isArray(d.sources) ? d.sources as string[] : undefined,
        })),
        changeHistory: changeHistory.length > 0 ? changeHistory : undefined,
        disclaimer: input.disclaimer,
      });

      const timestamp = Date.now();
      const suffix = Math.random().toString(36).substring(2, 8);
      const fileKey = `reports/${ctx.user.id}/suitability-${timestamp}-${suffix}.pdf`;
      const { url } = await storagePut(fileKey, pdfBuffer, "application/pdf");

      return {
        url, fileKey,
        overallScore: profile.overallScore,
        dimensionCount: dims.length,
        generatedAt: new Date().toISOString(),
        sizeBytes: pdfBuffer.length,
      };
    }),
});
