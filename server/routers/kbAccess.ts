/**
 * Knowledge Base Access Control Router
 * 
 * Granular topic-scoped sharing for client data:
 * - Professionals only see what clients share by topic
 * - Smart defaults per relationship type (insurance agent → insurance data)
 * - Easy granular or universal controls for clients
 * - Access transitions when clients change providers
 */

import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb } from "../db";
import { eq, and, inArray } from "drizzle-orm";
import {
  kbSharingPermissions, kbSharingDefaults, kbAccessTransitions,
  professionalRelationships, users,
} from "../../drizzle/schema";

const TOPICS = [
  "insurance", "investments", "tax", "estate", "retirement",
  "debt", "budgeting", "real_estate", "business", "education",
  "health_finance", "general", "all"
] as const;

const ACCESS_LEVELS = ["none", "summary", "read", "contribute", "full"] as const;

const GRANTEE_TYPES = ["professional", "manager", "organization", "admin"] as const;

const RELATIONSHIP_TYPES = [
  "financial_advisor", "insurance_agent", "tax_professional", "estate_attorney",
  "accountant", "mortgage_broker", "real_estate_agent", "other"
] as const;

export const kbAccessRouter = router({

  // ─── GET MY SHARING PERMISSIONS (client view) ──────────────────────
  // Returns all sharing permissions the current user has granted
  getMyPermissions: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const perms = await db.select().from(kbSharingPermissions)
      .where(eq(kbSharingPermissions.ownerId, ctx.user.id));
    return perms;
  }),

  // ─── GET PERMISSIONS FOR A SPECIFIC GRANTEE ────────────────────────
  getPermissionsForGrantee: protectedProcedure
    .input(z.object({ granteeId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(kbSharingPermissions)
        .where(and(
          eq(kbSharingPermissions.ownerId, ctx.user.id),
          eq(kbSharingPermissions.granteeId, input.granteeId),
          eq(kbSharingPermissions.isActive, true),
        ));
    }),

  // ─── GET ACCESS I HAVE (professional view) ─────────────────────────
  // Returns what data the current user can access from their clients
  getAccessIHave: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(kbSharingPermissions)
      .where(and(
        eq(kbSharingPermissions.granteeId, ctx.user.id),
        eq(kbSharingPermissions.isActive, true),
      ));
  }),

  // ─── GET SHARING DEFAULTS ─────────────────────────────────────────
  getDefaults: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(kbSharingDefaults);
  }),

  // ─── SET PERMISSION (granular) ────────────────────────────────────
  // Client sets access for a specific grantee + topic
  setPermission: protectedProcedure
    .input(z.object({
      granteeId: z.number(),
      granteeType: z.enum(GRANTEE_TYPES),
      topic: z.enum(TOPICS),
      accessLevel: z.enum(ACCESS_LEVELS),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const now = Date.now();

      // Check if permission already exists
      const existing = await db.select().from(kbSharingPermissions)
        .where(and(
          eq(kbSharingPermissions.ownerId, ctx.user.id),
          eq(kbSharingPermissions.granteeId, input.granteeId),
          eq(kbSharingPermissions.topic, input.topic),
        ))
        .limit(1);

      if (existing.length > 0) {
        // Update existing
        await db.update(kbSharingPermissions)
          .set({
            accessLevel: input.accessLevel,
            source: "user_set",
            isActive: input.accessLevel !== "none",
            updatedAt: now,
            revokedAt: input.accessLevel === "none" ? now : null,
          })
          .where(eq(kbSharingPermissions.id, existing[0].id));
      } else {
        // Create new
        await db.insert(kbSharingPermissions).values({
          ownerId: ctx.user.id,
          granteeId: input.granteeId,
          granteeType: input.granteeType,
          topic: input.topic,
          accessLevel: input.accessLevel,
          source: "user_set",
          isActive: input.accessLevel !== "none",
          grantedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      }

      return { success: true };
    }),

  // ─── SET UNIVERSAL SHARING (all topics at once) ───────────────────
  setUniversalSharing: protectedProcedure
    .input(z.object({
      granteeId: z.number(),
      granteeType: z.enum(GRANTEE_TYPES),
      accessLevel: z.enum(ACCESS_LEVELS),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const now = Date.now();

      // Remove all existing permissions for this grantee
      await db.delete(kbSharingPermissions)
        .where(and(
          eq(kbSharingPermissions.ownerId, ctx.user.id),
          eq(kbSharingPermissions.granteeId, input.granteeId),
        ));

      // Set "all" topic permission
      await db.insert(kbSharingPermissions).values({
        ownerId: ctx.user.id,
        granteeId: input.granteeId,
        granteeType: input.granteeType,
        topic: "all",
        accessLevel: input.accessLevel,
        source: "user_set",
        isActive: input.accessLevel !== "none",
        grantedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      return { success: true };
    }),

  // ─── APPLY DEFAULTS FOR NEW RELATIONSHIP ──────────────────────────
  // Called when a client connects with a new professional.
  // Applies smart defaults based on relationship type.
  applyDefaults: protectedProcedure
    .input(z.object({
      granteeId: z.number(),
      granteeType: z.enum(GRANTEE_TYPES),
      relationshipType: z.enum(RELATIONSHIP_TYPES),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Get defaults for this relationship type
      const defaults = await db.select().from(kbSharingDefaults)
        .where(eq(kbSharingDefaults.relationshipType, input.relationshipType));

      const now = Date.now();

      // Apply each default as a permission
      for (const def of defaults) {
        await db.insert(kbSharingPermissions).values({
          ownerId: ctx.user.id,
          granteeId: input.granteeId,
          granteeType: input.granteeType,
          topic: def.topic,
          accessLevel: def.defaultAccessLevel,
          source: "default",
          isActive: def.defaultAccessLevel !== "none",
          grantedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      }

      return { success: true, appliedCount: defaults.length };
    }),

  // ─── TRANSITION ACCESS ────────────────────────────────────────────
  // When a client switches from one professional to another in the same role.
  // Revokes old access, applies defaults for new, logs the transition.
  transitionAccess: protectedProcedure
    .input(z.object({
      fromGranteeId: z.number(),
      toGranteeId: z.number(),
      toGranteeType: z.enum(GRANTEE_TYPES),
      relationshipType: z.enum(RELATIONSHIP_TYPES),
      reason: z.enum(["client_switched", "professional_left", "org_change", "manual", "expired"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const now = Date.now();

      // Get current permissions for the old grantee
      const oldPerms = await db.select().from(kbSharingPermissions)
        .where(and(
          eq(kbSharingPermissions.ownerId, ctx.user.id),
          eq(kbSharingPermissions.granteeId, input.fromGranteeId),
          eq(kbSharingPermissions.isActive, true),
        ));

      // Log transitions and revoke old access
      for (const perm of oldPerms) {
        // Log the transition
        await db.insert(kbAccessTransitions).values({
          ownerId: ctx.user.id,
          fromGranteeId: input.fromGranteeId,
          toGranteeId: input.toGranteeId,
          topic: perm.topic,
          previousAccessLevel: perm.accessLevel,
          newAccessLevel: "none",
          reason: input.reason,
          transitionedAt: now,
          transitionedBy: ctx.user.id,
        });

        // Revoke old permission
        await db.update(kbSharingPermissions)
          .set({ isActive: false, revokedAt: now, updatedAt: now })
          .where(eq(kbSharingPermissions.id, perm.id));
      }

      // Apply defaults for new professional
      const defaults = await db.select().from(kbSharingDefaults)
        .where(eq(kbSharingDefaults.relationshipType, input.relationshipType));

      for (const def of defaults) {
        // Log the transition (new access)
        await db.insert(kbAccessTransitions).values({
          ownerId: ctx.user.id,
          fromGranteeId: input.fromGranteeId,
          toGranteeId: input.toGranteeId,
          topic: def.topic,
          previousAccessLevel: "none",
          newAccessLevel: def.defaultAccessLevel,
          reason: input.reason,
          transitionedAt: now,
          transitionedBy: ctx.user.id,
        });

        await db.insert(kbSharingPermissions).values({
          ownerId: ctx.user.id,
          granteeId: input.toGranteeId,
          granteeType: input.toGranteeType,
          topic: def.topic,
          accessLevel: def.defaultAccessLevel,
          source: "default",
          isActive: def.defaultAccessLevel !== "none",
          grantedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      }

      return { success: true, revokedCount: oldPerms.length, appliedCount: defaults.length };
    }),

  // ─── GET TRANSITION HISTORY ───────────────────────────────────────
  getTransitionHistory: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(kbAccessTransitions)
      .where(eq(kbAccessTransitions.ownerId, ctx.user.id))
      .orderBy(kbAccessTransitions.transitionedAt);
  }),

  // ─── CHECK ACCESS (used by RAG/context assembly) ──────────────────
  // Given a professional and a topic, check what access level they have
  checkAccess: protectedProcedure
    .input(z.object({
      ownerId: z.number(),
      topic: z.enum(TOPICS),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { accessLevel: "none" as const, source: "none" as const };

      // Check for "all" topic permission first
      const allPerm = await db.select().from(kbSharingPermissions)
        .where(and(
          eq(kbSharingPermissions.ownerId, input.ownerId),
          eq(kbSharingPermissions.granteeId, ctx.user.id),
          eq(kbSharingPermissions.topic, "all"),
          eq(kbSharingPermissions.isActive, true),
        ))
        .limit(1);

      if (allPerm.length > 0) {
        return { accessLevel: allPerm[0].accessLevel, source: allPerm[0].source };
      }

      // Check specific topic permission
      const topicPerm = await db.select().from(kbSharingPermissions)
        .where(and(
          eq(kbSharingPermissions.ownerId, input.ownerId),
          eq(kbSharingPermissions.granteeId, ctx.user.id),
          eq(kbSharingPermissions.topic, input.topic),
          eq(kbSharingPermissions.isActive, true),
        ))
        .limit(1);

      if (topicPerm.length > 0) {
        return { accessLevel: topicPerm[0].accessLevel, source: topicPerm[0].source };
      }

      return { accessLevel: "none" as const, source: "none" as const };
    }),

  // ─── REVOKE ALL ACCESS FOR A GRANTEE ──────────────────────────────
  revokeAll: protectedProcedure
    .input(z.object({ granteeId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const now = Date.now();
      await db.update(kbSharingPermissions)
        .set({ isActive: false, revokedAt: now, updatedAt: now })
        .where(and(
          eq(kbSharingPermissions.ownerId, ctx.user.id),
          eq(kbSharingPermissions.granteeId, input.granteeId),
        ));

      return { success: true };
    }),
});
