/**
 * Referrals Router — Track referral partner economics
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";

export const referralsRouter = router({
  track: protectedProcedure
    .input(z.object({
      referredEmail: z.string(),
      referredName: z.string().optional(),
      channel: z.string().default("direct_referral"),
    }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return { success: false };
      const { referralTracking } = await import("../../drizzle/schema");
      const [result] = await db.insert(referralTracking).values({
        referrerType: "professional",
        referrerId: ctx.user!.id,
        referredEmail: input.referredEmail,
        referredName: input.referredName,
        referralChannel: input.channel as any,
      }).$returningId();
      return { id: result.id };
    }),

  getPerformance: protectedProcedure.query(async ({ ctx }) => {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return [];
    const { referralTracking } = await import("../../drizzle/schema");
    const { eq, desc } = await import("drizzle-orm");
    return db.select().from(referralTracking).where(eq(referralTracking.referrerId, ctx.user!.id)).orderBy(desc(referralTracking.createdAt));
  }),
});
