/**
 * Hub Allocations Router — CRUD for wealth hub allocation presets.
 * 
 * General defaults (isDefault=true, userId=null) are available to all users
 * including guests for general planning. Authenticated users can save their
 * own custom allocations and override defaults.
 */
import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { wealthHubAllocations } from "../../drizzle/schema";
import { eq, and, isNull, or, desc } from "drizzle-orm";

export const hubAllocationsRouter = router({
  /** List all allocations for a hub type: general defaults + user's own */
  list: publicProcedure
    .input(z.object({
      hubType: z.enum(["client", "advanced", "practice"]),
    }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.user?.id;
      // Always include general defaults (userId IS NULL, isDefault = true)
      // Plus user's own if authenticated
      const db = (await getDb())!;
      const rows = await db
        .select()
        .from(wealthHubAllocations)
        .where(
          and(
            eq(wealthHubAllocations.hubType, input.hubType),
            eq(wealthHubAllocations.isActive, true),
            userId
              ? or(
                  isNull(wealthHubAllocations.userId),
                  eq(wealthHubAllocations.userId, userId),
                )
              : isNull(wealthHubAllocations.userId),
          ),
        )
        .orderBy(desc(wealthHubAllocations.isDefault), desc(wealthHubAllocations.updatedAt));

      return rows.map(r => ({
        id: r.id,
        hubType: r.hubType,
        label: r.label,
        allocations: r.allocations as Record<string, number>,
        inputOverrides: r.inputOverrides as Record<string, number> | null,
        isDefault: r.isDefault ?? false,
        isOwn: r.userId === userId,
        updatedAt: r.updatedAt,
      }));
    }),

  /** Save a new allocation preset (authenticated users only) */
  save: protectedProcedure
    .input(z.object({
      hubType: z.enum(["client", "advanced", "practice"]),
      label: z.string().min(1).max(100),
      // @ts-expect-error — argument count mismatch with drizzle overload
      allocations: z.record(z.number()),
      // @ts-expect-error — strict mode fix
      inputOverrides: z.record(z.number()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const now = Date.now();
      const db = (await getDb())!;
      const [result] = await db.insert(wealthHubAllocations).values({
        userId: ctx.user.id,
        hubType: input.hubType,
        label: input.label,
        allocations: input.allocations,
        inputOverrides: input.inputOverrides ?? null,
        isDefault: false,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      return { id: result.insertId, success: true };
    }),

  /** Update an existing allocation (own only) */
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      label: z.string().min(1).max(100).optional(),
      // @ts-expect-error — argument count mismatch with drizzle overload
      allocations: z.record(z.number()).optional(),
      // @ts-expect-error — strict mode fix
      inputOverrides: z.record(z.number()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = (await getDb())!;
      // Verify ownership
      const [existing] = await db
        .select()
        .from(wealthHubAllocations)
        .where(and(
          eq(wealthHubAllocations.id, input.id),
          eq(wealthHubAllocations.userId, ctx.user.id),
        ));
      if (!existing) throw new Error("Allocation not found or not owned by you");

      const updates: Record<string, unknown> = { updatedAt: Date.now() };
      if (input.label) updates.label = input.label;
      if (input.allocations) updates.allocations = input.allocations;
      if (input.inputOverrides) updates.inputOverrides = input.inputOverrides;

      await db
        .update(wealthHubAllocations)
        .set(updates)
        .where(eq(wealthHubAllocations.id, input.id));

      return { success: true };
    }),

  /** Soft-delete an allocation (own only, cannot delete defaults) */
  remove: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = (await getDb())!;
      const [existing] = await db
        .select()
        .from(wealthHubAllocations)
        .where(and(
          eq(wealthHubAllocations.id, input.id),
          eq(wealthHubAllocations.userId, ctx.user.id),
          eq(wealthHubAllocations.isDefault, false),
        ));
      if (!existing) throw new Error("Cannot delete: not found, not owned, or is a default");

      await db
        .update(wealthHubAllocations)
        .set({ isActive: false, updatedAt: Date.now() })
        .where(eq(wealthHubAllocations.id, input.id));

      return { success: true };
    }),
});
