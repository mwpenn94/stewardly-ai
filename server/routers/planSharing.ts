/**
 * Plan Sharing Router — Create and resolve read-only shared plan links.
 *
 * Uses the existing `shared_links` table with contentType='plan_summary'.
 * Stores a full JSON snapshot of the plan at share-time so the recipient
 * always sees the version that was shared, not the latest.
 */
import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { sharedLinks } from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import crypto from "crypto";

function generateToken(): string {
  return crypto.randomBytes(24).toString("base64url"); // 32-char URL-safe
}

export const planSharingRouter = router({
  /** Create a shareable link for the current plan snapshot */
  createShare: protectedProcedure
    .input(z.object({
      planSnapshot: z.any(), // full WealthEngineData JSON
      label: z.string().max(200).optional(),
      expiresInDays: z.number().min(1).max(365).default(30),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      // Per-user shared link count limit
      const MAX_SHARED_LINKS_PER_USER = 20;
      const existing = await db
        .select({ id: sharedLinks.id })
        .from(sharedLinks)
        .where(
          and(
            eq(sharedLinks.userId, ctx.user.id),
            eq(sharedLinks.contentType, "plan_summary"),
          ),
        );
      if (existing.length >= MAX_SHARED_LINKS_PER_USER) {
        throw new Error(`You have reached the maximum of ${MAX_SHARED_LINKS_PER_USER} shared links. Please delete some before creating new ones.`);
      }
      const token = generateToken();
      const expiresAt = new Date(Date.now() + input.expiresInDays * 86_400_000);

      // Store snapshot in a separate column via JSON — contentId references nothing
      await db.insert(sharedLinks).values({
        userId: ctx.user.id,
        contentType: "plan_summary",
        contentId: 0, // not referencing a specific row
        shareToken: token,
        expiresAt,
        viewCount: 0,
        maxViews: 1000,
        metadata: {
          label: input.label || "Shared Financial Plan",
          snapshot: input.planSnapshot,
          sharedAt: Date.now(),
          sharedBy: ctx.user.name || "Financial Professional",
        },
      });

      return { token, expiresAt: expiresAt.toISOString() };
    }),

  /** Resolve a share token — public, no auth required */
  getShare: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const [row] = await db
        .select()
        .from(sharedLinks)
        .where(
          and(
            eq(sharedLinks.shareToken, input.token),
            eq(sharedLinks.contentType, "plan_summary"),
          ),
        );

      if (!row) return { found: false as const };

      // Check expiry
      if (row.expiresAt && new Date(row.expiresAt) < new Date()) {
        return { found: false as const, reason: "expired" };
      }

      // Check max views
      if (row.maxViews && (row.viewCount ?? 0) >= row.maxViews) {
        return { found: false as const, reason: "max_views" };
      }

      // Increment view count
      await db
        .update(sharedLinks)
        .set({ viewCount: sql`${sharedLinks.viewCount} + 1` })
        .where(eq(sharedLinks.id, row.id));

      const meta = row.metadata as any;
      return {
        found: true as const,
        label: meta?.label || "Shared Financial Plan",
        snapshot: meta?.snapshot || null,
        sharedAt: meta?.sharedAt || row.createdAt?.getTime(),
        sharedBy: meta?.sharedBy || "Financial Professional",
        viewCount: (row.viewCount ?? 0) + 1,
        expiresAt: row.expiresAt?.toISOString(),
      };
    }),

  /** List my shared links */
  myShares: protectedProcedure.query(async ({ ctx }) => {
    const db = (await getDb())!;
    const rows = await db
      .select({
        id: sharedLinks.id,
        shareToken: sharedLinks.shareToken,
        viewCount: sharedLinks.viewCount,
        maxViews: sharedLinks.maxViews,
        expiresAt: sharedLinks.expiresAt,
        createdAt: sharedLinks.createdAt,
        metadata: sharedLinks.metadata,
      })
      .from(sharedLinks)
      .where(
        and(
          eq(sharedLinks.userId, ctx.user.id),
          eq(sharedLinks.contentType, "plan_summary"),
        ),
      );

    return rows.map(r => ({
      id: r.id,
      token: r.shareToken,
      label: (r.metadata as any)?.label || "Shared Plan",
      viewCount: r.viewCount ?? 0,
      maxViews: r.maxViews ?? 1000,
      expiresAt: r.expiresAt?.toISOString(),
      createdAt: r.createdAt?.toISOString(),
    }));
  }),

  /** Update expiration on an existing shared link */
  updateExpiration: protectedProcedure
    .input(z.object({
      id: z.number(),
      expiresInDays: z.number().min(1).max(365),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const newExpiry = new Date(Date.now() + input.expiresInDays * 86_400_000);
      await db
        .update(sharedLinks)
        .set({ expiresAt: newExpiry })
        .where(
          and(
            eq(sharedLinks.id, input.id),
            eq(sharedLinks.userId, ctx.user.id),
            eq(sharedLinks.contentType, "plan_summary"),
          ),
        );
      return { success: true, expiresAt: newExpiry.toISOString() };
    }),

  /** Revoke a shared link */
  revokeShare: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      // Set maxViews to 0 to effectively revoke
      await db
        .update(sharedLinks)
        .set({ maxViews: 0 })
        .where(
          and(
            eq(sharedLinks.id, input.id),
            eq(sharedLinks.userId, ctx.user.id),
          ),
        );
      return { success: true };
    }),
});
