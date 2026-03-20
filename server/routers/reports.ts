/**
 * Reports Router
 * Generates and serves PDF financial plan reports.
 */
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { generateFinancialReport, type ReportSection } from "../services/pdfGenerator";
import { getModelRunHistory } from "../services/modelEngine";
import { storagePut } from "../storage";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export const reportsRouter = router({
  // Generate a comprehensive financial plan PDF
  generate: protectedProcedure
    .input(z.object({
      modelSlugs: z.array(z.string()).optional(), // If empty, include all models with data
      clientName: z.string().optional(),
      advisorName: z.string().optional(),
      firmName: z.string().optional(),
      disclaimer: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get user info for client name
      const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      const clientName = input.clientName || user?.name || "Client";

      // Determine which models to include
      const allSlugs = [
        "monte-carlo-retirement",
        "debt-optimization",
        "tax-optimization",
        "cash-flow-projection",
        "insurance-gap-analysis",
        "estate-planning",
        "education-funding",
        "risk-tolerance-assessment",
      ];
      const slugs = input.modelSlugs?.length ? input.modelSlugs : allSlugs;

      // Fetch latest run for each model
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
            ? JSON.parse(runs[0].outputData)
            : runs[0].outputData;
          sections.push({
            title: modelLabels[slug] || slug,
            modelSlug: slug,
            data,
          });
        }
      }

      if (sections.length === 0) {
        throw new Error("No model results available. Run at least one model before generating a report.");
      }

      // Generate PDF
      const pdfBuffer = await generateFinancialReport({
        clientName,
        advisorName: input.advisorName,
        firmName: input.firmName || "Stewardly",
        generatedAt: new Date(),
        sections,
        disclaimer: input.disclaimer,
      });

      // Upload to S3
      const timestamp = Date.now();
      const suffix = Math.random().toString(36).substring(2, 8);
      const fileKey = `reports/${ctx.user.id}/financial-plan-${timestamp}-${suffix}.pdf`;
      const { url } = await storagePut(fileKey, pdfBuffer, "application/pdf");

      return {
        url,
        fileKey,
        sectionsIncluded: sections.map(s => s.title),
        generatedAt: new Date().toISOString(),
        sizeBytes: pdfBuffer.length,
      };
    }),

  // Generate a single model report
  generateSingle: protectedProcedure
    .input(z.object({
      modelSlug: z.string(),
      outputData: z.any(), // Pass the model output directly
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
        clientName,
        firmName: "Stewardly",
        generatedAt: new Date(),
        sections: [{
          title: modelLabels[input.modelSlug] || input.modelSlug,
          modelSlug: input.modelSlug,
          data: input.outputData,
        }],
      });

      const timestamp = Date.now();
      const suffix = Math.random().toString(36).substring(2, 8);
      const fileKey = `reports/${ctx.user.id}/${input.modelSlug}-${timestamp}-${suffix}.pdf`;
      const { url } = await storagePut(fileKey, pdfBuffer, "application/pdf");

      return { url, fileKey, generatedAt: new Date().toISOString(), sizeBytes: pdfBuffer.length };
    }),
});
