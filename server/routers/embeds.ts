/**
 * Embeds Router — Calculator embed configuration and management
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";

export const embedsRouter = router({
  configure: protectedProcedure
    .input(z.object({
      calculatorType: z.string(),
      embedDomain: z.string().optional(),
      theme: z.string().default("dark"),
      customCta: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return { success: false };
      const { embedConfigurations } = await import("../../drizzle/schema");
      const [result] = await db.insert(embedConfigurations).values({
        advisorId: ctx.user!.id,
        calculatorType: input.calculatorType,
        embedDomain: input.embedDomain,
        theme: input.theme,
        customCta: input.customCta,
      }).$returningId();
      return { id: result.id };
    }),

  getLeads: protectedProcedure.query(async ({ ctx }) => {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return [];
    const { embedConfigurations } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    return db.select().from(embedConfigurations).where(eq(embedConfigurations.advisorId, ctx.user!.id));
  }),

  generateCode: protectedProcedure
    .input(z.object({ calculatorType: z.string(), theme: z.string().default("dark") }))
    .query(async ({ ctx, input }) => {
      const { generateEmbedCode } = await import("../services/leadEngine/embedManager");
      const baseUrl = process.env.BASE_URL || "https://stewardly.manus.space";
      return { code: generateEmbedCode(baseUrl, ctx.user!.id, input.calculatorType, input.theme) };
    }),
});
