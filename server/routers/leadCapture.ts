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
      emailHash: z.string(),
      firstName: z.string().optional(),
      sessionId: z.string().optional(),
      results: z.any().optional(),
    }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return { success: false };
      const { leadPipeline } = await import("../../drizzle/schema");
      await db.insert(leadPipeline).values({
        emailHash: input.emailHash,
        firstName: input.firstName,
        targetSegment: input.calculatorType,
        segmentData: input.results as any,
        status: "new",
      });
      return { success: true };
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
    .input(z.object({ emailHash: z.string() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return { success: false };
      const { leadPipeline } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.update(leadPipeline).set({ unsubscribed: true, updatedAt: new Date() }).where(eq(leadPipeline.emailHash, input.emailHash));
      return { success: true };
    }),
});
