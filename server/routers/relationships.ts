import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, or } from "drizzle-orm";
import {
  userRelationships,
  organizationRelationships,
  userOrganizationRoles,
  users,
  organizations,
} from "../../drizzle/schema";

/**
 * Relationships Router
 * Manages user-to-user and organization-to-organization connections.
 * Key relationship types:
 *   User-User: manager, team_member, mentor, mentee, peer, client, advisor, colleague
 *   Org-Org: partner, subsidiary, affiliate, referral, vendor, client
 */
export const relationshipsRouter = router({
  // ─── USER RELATIONSHIPS ──────────────────────────────────────────

  /**
   * Create a user-to-user relationship
   * Both users must exist. Optionally scoped to an organization.
   */
  createUserRelationship: protectedProcedure
    .input(
      z.object({
        relatedUserId: z.number(),
        relationshipType: z.enum([
          "manager", "team_member", "mentor", "mentee",
          "peer", "client", "advisor", "colleague",
        ]),
        organizationId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      if (input.relatedUserId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot create a relationship with yourself" });
      }

      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verify the related user exists
      const relatedUser = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, input.relatedUserId))
        .limit(1);

      if (!relatedUser.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Related user not found" });
      }

      // If org-scoped, verify both users are members
      if (input.organizationId) {
        const myMembership = await db
          .select()
          .from(userOrganizationRoles)
          .where(
            and(
              eq(userOrganizationRoles.userId, ctx.user.id),
              eq(userOrganizationRoles.organizationId, input.organizationId)
            )
          )
          .limit(1);

        const theirMembership = await db
          .select()
          .from(userOrganizationRoles)
          .where(
            and(
              eq(userOrganizationRoles.userId, input.relatedUserId),
              eq(userOrganizationRoles.organizationId, input.organizationId)
            )
          )
          .limit(1);

        if (!myMembership.length || !theirMembership.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Both users must be members of the organization",
          });
        }
      }

      // Check for duplicate relationship
      const existing = await db
        .select()
        .from(userRelationships)
        .where(
          and(
            eq(userRelationships.userId, ctx.user.id),
            eq(userRelationships.relatedUserId, input.relatedUserId),
            eq(userRelationships.relationshipType, input.relationshipType)
          )
        )
        .limit(1);

      if (existing.length) {
        throw new TRPCError({ code: "CONFLICT", message: "This relationship already exists" });
      }

      await db.insert(userRelationships).values({
        userId: ctx.user.id,
        relatedUserId: input.relatedUserId,
        relationshipType: input.relationshipType,
        organizationId: input.organizationId || null,
        status: "pending",
      });

      return { success: true };
    }),

  /**
   * List all user relationships for the current user
   * Returns both directions (where user is userId or relatedUserId)
   */
  listUserRelationships: protectedProcedure
    .input(
      z.object({
        organizationId: z.number().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const db = await (await import("../db")).getDb();
      if (!db) return [];

      // Get relationships where user is either side
      let conditions = or(
        eq(userRelationships.userId, ctx.user.id),
        eq(userRelationships.relatedUserId, ctx.user.id)
      );

      const rels = await db
        .select()
        .from(userRelationships)
        .where(conditions!);

      // Filter by org if specified
      const filtered = input?.organizationId
        ? rels.filter((r) => r.organizationId === input.organizationId)
        : rels;

      // Enrich with user names
      const userIds = new Set<number>();
      filtered.forEach((r) => {
        userIds.add(r.userId);
        userIds.add(r.relatedUserId);
      });

      if (userIds.size === 0) return [];

      const { inArray } = await import("drizzle-orm");
      const userList = await db
        .select({ id: users.id, name: users.name, email: users.email, avatarUrl: users.avatarUrl })
        .from(users)
        .where(inArray(users.id, Array.from(userIds)));

      const userMap = new Map(userList.map((u) => [u.id, u]));

      return filtered.map((rel) => {
        const isInitiator = rel.userId === ctx.user!.id;
        const otherUserId = isInitiator ? rel.relatedUserId : rel.userId;
        const otherUser = userMap.get(otherUserId);

        return {
          id: rel.id,
          relationshipType: rel.relationshipType,
          status: rel.status,
          organizationId: rel.organizationId,
          direction: isInitiator ? "outgoing" : "incoming",
          otherUser: otherUser
            ? { id: otherUser.id, name: otherUser.name, email: otherUser.email, avatarUrl: otherUser.avatarUrl }
            : null,
          createdAt: rel.createdAt,
        };
      });
    }),

  /**
   * Accept or reject a pending user relationship
   */
  respondToUserRelationship: protectedProcedure
    .input(
      z.object({
        relationshipId: z.number(),
        accept: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rel = await db
        .select()
        .from(userRelationships)
        .where(eq(userRelationships.id, input.relationshipId))
        .limit(1);

      if (!rel.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Relationship not found" });
      }

      // Only the target user can accept/reject
      if (rel[0].relatedUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the invited user can respond" });
      }

      if (rel[0].status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Relationship is not pending" });
      }

      if (input.accept) {
        await db
          .update(userRelationships)
          .set({ status: "active" })
          .where(eq(userRelationships.id, input.relationshipId));
      } else {
        await db
          .delete(userRelationships)
          .where(eq(userRelationships.id, input.relationshipId));
      }

      return { success: true };
    }),

  /**
   * Remove a user relationship
   * Either party can remove it
   */
  removeUserRelationship: protectedProcedure
    .input(z.object({ relationshipId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rel = await db
        .select()
        .from(userRelationships)
        .where(eq(userRelationships.id, input.relationshipId))
        .limit(1);

      if (!rel.length) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Either party can remove
      if (rel[0].userId !== ctx.user.id && rel[0].relatedUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await db
        .delete(userRelationships)
        .where(eq(userRelationships.id, input.relationshipId));

      return { success: true };
    }),

  /**
   * Connect with an advisor (Tier 3 auth upgrade)
   * Creates an advisor relationship and upgrades the client's auth tier
   */
  connectAdvisor: protectedProcedure
    .input(
      z.object({
        advisorId: z.number(),
        organizationId: z.number().optional(),
        message: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      if (input.advisorId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot connect with yourself" });
      }

      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verify advisor exists and has professional+ role
      const advisor = await db
        .select({ id: users.id, role: users.role, name: users.name })
        .from(users)
        .where(eq(users.id, input.advisorId))
        .limit(1);

      if (!advisor.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Advisor not found" });
      }

      const advisorRoles = ["professional", "manager", "org_admin", "admin"];
      if (!advisorRoles.includes(advisor[0].role || "")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Selected user is not a professional advisor" });
      }

      // Check for existing advisor relationship
      const existing = await db
        .select()
        .from(userRelationships)
        .where(
          and(
            eq(userRelationships.userId, ctx.user.id),
            eq(userRelationships.relatedUserId, input.advisorId),
            eq(userRelationships.relationshipType, "advisor")
          )
        )
        .limit(1);

      if (existing.length) {
        throw new TRPCError({ code: "CONFLICT", message: "Already connected with this advisor" });
      }

      // Create advisor relationship
      await db.insert(userRelationships).values({
        userId: ctx.user.id,
        relatedUserId: input.advisorId,
        relationshipType: "advisor",
        organizationId: input.organizationId || null,
        status: "pending",
        metadata: input.message ? JSON.stringify({ message: input.message }) : null,
      });

      // Upgrade auth tier to advisor_connected
      await db
        .update(users)
        .set({ authTier: "advisor_connected" })
        .where(eq(users.id, ctx.user.id));

      return { success: true, advisorName: advisor[0].name };
    }),

  // ─── ORGANIZATION RELATIONSHIPS ──────────────────────────────────

  /**
   * Create an org-to-org relationship
   * User must be org_admin of the parent org
   */
  createOrgRelationship: protectedProcedure
    .input(
      z.object({
        parentOrgId: z.number(),
        childOrgId: z.number(),
        relationshipType: z.enum([
          "partner", "subsidiary", "affiliate", "referral", "vendor", "client",
        ]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      if (input.parentOrgId === input.childOrgId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot relate an organization to itself" });
      }

      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verify user is org_admin of parent org
      const membership = await db
        .select()
        .from(userOrganizationRoles)
        .where(
          and(
            eq(userOrganizationRoles.userId, ctx.user.id),
            eq(userOrganizationRoles.organizationId, input.parentOrgId),
            eq(userOrganizationRoles.organizationRole, "org_admin")
          )
        )
        .limit(1);

      if (!membership.length) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You must be an admin of the parent organization" });
      }

      // Verify child org exists
      const childOrg = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.id, input.childOrgId))
        .limit(1);

      if (!childOrg.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Child organization not found" });
      }

      // Check for duplicate
      const existing = await db
        .select()
        .from(organizationRelationships)
        .where(
          and(
            eq(organizationRelationships.parentOrgId, input.parentOrgId),
            eq(organizationRelationships.childOrgId, input.childOrgId),
            eq(organizationRelationships.relationshipType, input.relationshipType)
          )
        )
        .limit(1);

      if (existing.length) {
        throw new TRPCError({ code: "CONFLICT", message: "This relationship already exists" });
      }

      await db.insert(organizationRelationships).values({
        parentOrgId: input.parentOrgId,
        childOrgId: input.childOrgId,
        relationshipType: input.relationshipType,
        status: "pending",
      });

      return { success: true };
    }),

  /**
   * List org relationships for an organization
   * User must be a member
   */
  listOrgRelationships: protectedProcedure
    .input(z.object({ organizationId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const db = await (await import("../db")).getDb();
      if (!db) return [];

      // Verify membership
      const membership = await db
        .select()
        .from(userOrganizationRoles)
        .where(
          and(
            eq(userOrganizationRoles.userId, ctx.user.id),
            eq(userOrganizationRoles.organizationId, input.organizationId)
          )
        )
        .limit(1);

      if (!membership.length) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const rels = await db
        .select()
        .from(organizationRelationships)
        .where(
          or(
            eq(organizationRelationships.parentOrgId, input.organizationId),
            eq(organizationRelationships.childOrgId, input.organizationId)
          )
        );

      // Enrich with org names
      const orgIds = new Set<number>();
      rels.forEach((r) => {
        orgIds.add(r.parentOrgId);
        orgIds.add(r.childOrgId);
      });

      if (orgIds.size === 0) return [];

      const { inArray } = await import("drizzle-orm");
      const orgList = await db
        .select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
        .from(organizations)
        .where(inArray(organizations.id, Array.from(orgIds)));

      const orgMap = new Map(orgList.map((o) => [o.id, o]));

      return rels.map((rel) => {
        const isParent = rel.parentOrgId === input.organizationId;
        const otherOrgId = isParent ? rel.childOrgId : rel.parentOrgId;
        const otherOrg = orgMap.get(otherOrgId);

        return {
          id: rel.id,
          relationshipType: rel.relationshipType,
          status: rel.status,
          direction: isParent ? "outgoing" : "incoming",
          otherOrg: otherOrg
            ? { id: otherOrg.id, name: otherOrg.name, slug: otherOrg.slug }
            : null,
          createdAt: rel.createdAt,
        };
      });
    }),

  /**
   * Update org relationship status
   * User must be org_admin of the receiving org to accept/reject
   */
  respondToOrgRelationship: protectedProcedure
    .input(
      z.object({
        relationshipId: z.number(),
        accept: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rel = await db
        .select()
        .from(organizationRelationships)
        .where(eq(organizationRelationships.id, input.relationshipId))
        .limit(1);

      if (!rel.length) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // User must be org_admin of the child org to accept/reject
      const membership = await db
        .select()
        .from(userOrganizationRoles)
        .where(
          and(
            eq(userOrganizationRoles.userId, ctx.user.id),
            eq(userOrganizationRoles.organizationId, rel[0].childOrgId),
            eq(userOrganizationRoles.organizationRole, "org_admin")
          )
        )
        .limit(1);

      if (!membership.length) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admins of the receiving organization can respond" });
      }

      if (input.accept) {
        await db
          .update(organizationRelationships)
          .set({ status: "active" })
          .where(eq(organizationRelationships.id, input.relationshipId));
      } else {
        await db
          .delete(organizationRelationships)
          .where(eq(organizationRelationships.id, input.relationshipId));
      }

      return { success: true };
    }),

  /**
   * Remove an org relationship
   * User must be org_admin of either org
   */
  removeOrgRelationship: protectedProcedure
    .input(z.object({ relationshipId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rel = await db
        .select()
        .from(organizationRelationships)
        .where(eq(organizationRelationships.id, input.relationshipId))
        .limit(1);

      if (!rel.length) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Check if user is org_admin of either org
      const { inArray } = await import("drizzle-orm");
      const memberships = await db
        .select()
        .from(userOrganizationRoles)
        .where(
          and(
            eq(userOrganizationRoles.userId, ctx.user.id),
            inArray(userOrganizationRoles.organizationId, [rel[0].parentOrgId, rel[0].childOrgId]),
            eq(userOrganizationRoles.organizationRole, "org_admin")
          )
        );

      if (!memberships.length) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await db
        .delete(organizationRelationships)
        .where(eq(organizationRelationships.id, input.relationshipId));

      return { success: true };
    }),
});
