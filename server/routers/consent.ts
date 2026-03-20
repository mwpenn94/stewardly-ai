import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { eq, and } from "drizzle-orm";
import { userConsents } from "../../drizzle/schema";

const CONSENT_TYPES = ["ai_chat", "voice_input", "document_upload", "data_sharing", "marketing", "analytics"] as const;

export const consentRouter = router({
  // Get all consents for current user
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await (await import("../db")).getDb();
    if (!db) return [];
    const rows = await db.select().from(userConsents).where(eq(userConsents.userId, ctx.user.id));
    return rows;
  }),

  // Check if a specific consent is granted
  check: protectedProcedure
    .input(z.object({ consentType: z.enum(CONSENT_TYPES) }))
    .query(async ({ ctx, input }) => {
      const db = await (await import("../db")).getDb();
      if (!db) return { granted: false, exists: false };
      const rows = await db.select().from(userConsents)
        .where(and(
          eq(userConsents.userId, ctx.user.id),
          eq(userConsents.consentType, input.consentType),
        ))
        .limit(1);
      if (rows.length === 0) return { granted: false, exists: false };
      return { granted: rows[0].granted, exists: true, grantedAt: rows[0].grantedAt, revokedAt: rows[0].revokedAt };
    }),

  // Grant consent
  grant: protectedProcedure
    .input(z.object({
      consentType: z.enum(CONSENT_TYPES),
      version: z.string().default("1.0"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await (await import("../db")).getDb();
      if (!db) throw new Error("Database unavailable");
      const now = Date.now();

      // Check if consent record exists
      const existing = await db.select().from(userConsents)
        .where(and(
          eq(userConsents.userId, ctx.user.id),
          eq(userConsents.consentType, input.consentType),
        ))
        .limit(1);

      if (existing.length > 0) {
        await db.update(userConsents)
          .set({ granted: true, grantedAt: now, revokedAt: null, version: input.version, updatedAt: now })
          .where(eq(userConsents.id, existing[0].id));
      } else {
        await db.insert(userConsents).values({
          userId: ctx.user.id,
          consentType: input.consentType,
          granted: true,
          grantedAt: now,
          version: input.version,
          createdAt: now,
          updatedAt: now,
        });
      }
      return { success: true, consentType: input.consentType };
    }),

  // Revoke consent
  revoke: protectedProcedure
    .input(z.object({ consentType: z.enum(CONSENT_TYPES) }))
    .mutation(async ({ ctx, input }) => {
      const db = await (await import("../db")).getDb();
      if (!db) throw new Error("Database unavailable");
      const now = Date.now();

      await db.update(userConsents)
        .set({ granted: false, revokedAt: now, updatedAt: now })
        .where(and(
          eq(userConsents.userId, ctx.user.id),
          eq(userConsents.consentType, input.consentType),
        ));
      return { success: true, consentType: input.consentType };
    }),

  // Revoke all consents
  revokeAll: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await (await import("../db")).getDb();
    if (!db) throw new Error("Database unavailable");
    const now = Date.now();

    await db.update(userConsents)
      .set({ granted: false, revokedAt: now, updatedAt: now })
      .where(eq(userConsents.userId, ctx.user.id));
    return { success: true };
  }),
});
