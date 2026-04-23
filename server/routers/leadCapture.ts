/**
 * Lead Capture Router — Calculator gates and unsubscribe
 */
import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";

export const leadCaptureRouter = router({
  getGateConfig: publicProcedure
    .input(z.object({ calculatorType: z.string() }))
    .query(async ({ input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return null;
      const { leadCaptureConfig } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const [config] = await db.select().from(leadCaptureConfig).where(eq(leadCaptureConfig.calculatorType, input.calculatorType)).limit(1);
      return config;
    }),

  captureFromCalculator: publicProcedure
    .input(z.object({
      calculatorType: z.string(),
      email: z.string(),
      firstName: z.string().optional(),
      sessionId: z.string().optional(),
      results: z.any().optional(),
    }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return { success: false, ghlSync: null };
      const { leadPipeline } = await import("../../drizzle/schema");
      await db.insert(leadPipeline).values({
        email: input.email,
        firstName: input.firstName,
        targetSegment: input.calculatorType,
        segmentData: input.results as any,
        status: "new",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Push to GHL asynchronously (fire-and-forget, don't block lead capture)
      let ghlSync = null;
      try {
        const { pushLeadToGHL } = await import("../services/ghlOutboundSync");
        ghlSync = await pushLeadToGHL({
          firstName: input.firstName,
          email: input.email,
          tags: ["calculator-lead", `calc:${input.calculatorType}`],
          source: `calculator:${input.calculatorType}`,
        });
      } catch (err) {
        // GHL sync failure should never block lead capture
      }

      return { success: true, ghlSync };
    }),

  configureGate: protectedProcedure
    .input(z.object({
      calculatorType: z.string(),
      gateType: z.string(),
      valueProposition: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return { success: false };
      const { leadCaptureConfig } = await import("../../drizzle/schema");
      await db.insert(leadCaptureConfig).values({
        calculatorType: input.calculatorType,
        gateType: input.gateType as any,
        valueProposition: input.valueProposition,
      });
      return { success: true };
    }),

  unsubscribe: publicProcedure
    .input(z.object({ email: z.string() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return { success: false };
      const { leadPipeline } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.update(leadPipeline).set({ unsubscribed: true, updatedAt: Date.now() }).where(eq(leadPipeline.email, input.email));
      return { success: true };
    }),
});
