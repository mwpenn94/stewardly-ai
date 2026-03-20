import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { featureFlags } from "../../drizzle/schema";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";

async function requireAdmin(userId: number, role?: string) {
  if (role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
}

export const featureFlagsRouter = router({
  // Public: get all enabled platform flags (for frontend feature gating)
  getEnabled: publicProcedure.query(async () => {
    const db = await (await import("../db")).getDb();
    if (!db) return {};
    const flags = await db.select().from(featureFlags).where(eq(featureFlags.scope, "platform"));
    const result: Record<string, boolean> = {};
    for (const f of flags) {
      result[f.flagKey] = f.enabled;
    }
    return result;
  }),

  // Admin: list all flags with full details
  list: protectedProcedure.query(async ({ ctx }) => {
    await requireAdmin(ctx.user.id, ctx.user.role);
    const db = await (await import("../db")).getDb();
    if (!db) return [];
    return db.select().from(featureFlags);
  }),

  // Admin: toggle a flag
  toggle: protectedProcedure
    .input(z.object({ id: z.number(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx.user.id, ctx.user.role);
      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(featureFlags)
        .set({ enabled: input.enabled, updatedBy: ctx.user.id })
        .where(eq(featureFlags.id, input.id));
      return { success: true };
    }),

  // Admin: create a new flag
  create: protectedProcedure
    .input(z.object({
      flagKey: z.string().min(1).max(128),
      label: z.string().min(1).max(256),
      description: z.string().optional(),
      enabled: z.boolean().default(true),
      scope: z.enum(["platform", "organization"]).default("platform"),
      organizationId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx.user.id, ctx.user.role);
      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.insert(featureFlags).values({
        flagKey: input.flagKey,
        label: input.label,
        description: input.description || null,
        enabled: input.enabled,
        scope: input.scope,
        organizationId: input.organizationId || null,
        updatedBy: ctx.user.id,
      });
      return { success: true };
    }),

  // Admin: delete a flag
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx.user.id, ctx.user.role);
      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(featureFlags).where(eq(featureFlags.id, input.id));
      return { success: true };
    }),
});
