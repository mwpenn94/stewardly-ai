import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { organizations, userOrganizationRoles } from "../../drizzle/schema";

/**
 * Organizations Router
 * Allows users to create, read, update, and delete their own organizations.
 * Ownership is tracked via user_organization_roles with organizationRole = 'org_admin'.
 */
export const organizationsRouter = router({
  /**
   * Create a new organization
   * User becomes the org_admin via user_organization_roles
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Organization name is required").max(256),
        slug: z.string().min(1, "Slug is required").max(128).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
        description: z.string().max(1000).optional(),
        website: z.string().url().optional().or(z.literal("")),
        ein: z.string().max(20).optional(),
        industry: z.string().max(128).optional(),
        size: z.enum(["solo", "small", "medium", "large", "enterprise"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      try {
        // Create organization
        const result = await db.insert(organizations).values({
          name: input.name,
          slug: input.slug,
          description: input.description || null,
          website: input.website || null,
          ein: input.ein || null,
          industry: input.industry || null,
          size: input.size || "small",
        });

        const orgId = (result as any)[0]?.insertId || 0;

        // Assign user as org_admin
        if (orgId) {
          await db.insert(userOrganizationRoles).values({
            userId: ctx.user.id,
            organizationId: orgId,
            organizationRole: "org_admin",
            status: "active",
          });
        }

        return { success: true, organizationId: orgId };
      } catch (error: any) {
        if (error.message?.includes("Duplicate entry")) {
          throw new TRPCError({ code: "CONFLICT", message: "Organization slug already exists" });
        }
        throw error;
      }
    }),

  /**
   * List all organizations the user belongs to (any role)
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });

    const db = await (await import("../db")).getDb();
    if (!db) return [];

    try {
      // Get all org IDs the user belongs to
      const roles = await db
        .select()
        .from(userOrganizationRoles)
        .where(eq(userOrganizationRoles.userId, ctx.user.id));

      if (!roles.length) return [];

      const orgIds = roles.map((r) => r.organizationId);

      // Get all organizations
      const { inArray } = await import("drizzle-orm");
      const orgs = await db
        .select()
        .from(organizations)
        .where(inArray(organizations.id, orgIds));

      // Merge role info
      return orgs.map((org) => {
        const role = roles.find((r) => r.organizationId === org.id);
        return {
          ...org,
          userRole: role?.organizationRole || "user",
          memberStatus: role?.status || "active",
        };
      });
    } catch {
      return [];
    }
  }),

  /**
   * Get a specific organization by ID
   * User must be a member
   */
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verify membership
      const membership = await db
        .select()
        .from(userOrganizationRoles)
        .where(
          and(
            eq(userOrganizationRoles.userId, ctx.user.id),
            eq(userOrganizationRoles.organizationId, input.id)
          )
        )
        .limit(1);

      if (!membership.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      }

      const org = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, input.id))
        .limit(1);

      if (!org.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      }

      return {
        ...org[0],
        userRole: membership[0].organizationRole,
        memberStatus: membership[0].status,
      };
    }),

  /**
   * Get organization by slug (public — for landing pages)
   */
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const org = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, input.slug))
        .limit(1);

      if (!org.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      }

      return org[0];
    }),

  /**
   * Update an organization
   * User must be org_admin
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(256).optional(),
        description: z.string().max(1000).optional(),
        website: z.string().url().optional().or(z.literal("")),
        ein: z.string().max(20).optional(),
        industry: z.string().max(128).optional(),
        size: z.enum(["solo", "small", "medium", "large", "enterprise"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verify org_admin role
      const membership = await db
        .select()
        .from(userOrganizationRoles)
        .where(
          and(
            eq(userOrganizationRoles.userId, ctx.user.id),
            eq(userOrganizationRoles.organizationId, input.id),
            eq(userOrganizationRoles.organizationRole, "org_admin")
          )
        )
        .limit(1);

      if (!membership.length) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to update this organization" });
      }

      const updateData: Record<string, any> = {};
      if (input.name) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description || null;
      if (input.website !== undefined) updateData.website = input.website || null;
      if (input.ein !== undefined) updateData.ein = input.ein || null;
      if (input.industry !== undefined) updateData.industry = input.industry || null;
      if (input.size) updateData.size = input.size;

      await db
        .update(organizations)
        .set(updateData)
        .where(eq(organizations.id, input.id));

      return { success: true };
    }),

  /**
   * Delete an organization
   * User must be org_admin
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verify org_admin role
      const membership = await db
        .select()
        .from(userOrganizationRoles)
        .where(
          and(
            eq(userOrganizationRoles.userId, ctx.user.id),
            eq(userOrganizationRoles.organizationId, input.id),
            eq(userOrganizationRoles.organizationRole, "org_admin")
          )
        )
        .limit(1);

      if (!membership.length) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to delete this organization" });
      }

      // Delete all memberships first
      await db
        .delete(userOrganizationRoles)
        .where(eq(userOrganizationRoles.organizationId, input.id));

      // Delete organization
      await db.delete(organizations).where(eq(organizations.id, input.id));

      return { success: true };
    }),

  /**
   * List members of an organization
   * User must be a member
   */
  listMembers: protectedProcedure
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
        throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this organization" });
      }

      const { users } = await import("../../drizzle/schema");

      const members = await db
        .select({
          roleId: userOrganizationRoles.id,
          userId: userOrganizationRoles.userId,
          organizationRole: userOrganizationRoles.organizationRole,
          status: userOrganizationRoles.status,
          joinedAt: userOrganizationRoles.createdAt,
          userName: users.name,
          userEmail: users.email,
          userAvatar: users.avatarUrl,
        })
        .from(userOrganizationRoles)
        .innerJoin(users, eq(users.id, userOrganizationRoles.userId))
        .where(eq(userOrganizationRoles.organizationId, input.organizationId));

      return members;
    }),

  /**
   * Invite a user to an organization
   * User must be org_admin or manager
   */
  inviteMember: protectedProcedure
    .input(
      z.object({
        organizationId: z.number(),
        userId: z.number(),
        role: z.enum(["org_admin", "manager", "professional", "user"]).default("user"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verify org_admin or manager role
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

      if (!membership.length || !["org_admin", "manager"].includes(membership[0].organizationRole || "")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only org admins and managers can invite members" });
      }

      // Check if user is already a member
      const existing = await db
        .select()
        .from(userOrganizationRoles)
        .where(
          and(
            eq(userOrganizationRoles.userId, input.userId),
            eq(userOrganizationRoles.organizationId, input.organizationId)
          )
        )
        .limit(1);

      if (existing.length) {
        throw new TRPCError({ code: "CONFLICT", message: "User is already a member of this organization" });
      }

      await db.insert(userOrganizationRoles).values({
        userId: input.userId,
        organizationId: input.organizationId,
        organizationRole: input.role,
        status: "invited",
        invitedAt: new Date(),
      });

      return { success: true };
    }),

  /**
   * Remove a member from an organization
   * User must be org_admin
   */
  removeMember: protectedProcedure
    .input(
      z.object({
        organizationId: z.number(),
        userId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verify org_admin role
      const membership = await db
        .select()
        .from(userOrganizationRoles)
        .where(
          and(
            eq(userOrganizationRoles.userId, ctx.user.id),
            eq(userOrganizationRoles.organizationId, input.organizationId),
            eq(userOrganizationRoles.organizationRole, "org_admin")
          )
        )
        .limit(1);

      if (!membership.length) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only org admins can remove members" });
      }

      // Can't remove yourself
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot remove yourself. Transfer ownership first." });
      }

      await db
        .delete(userOrganizationRoles)
        .where(
          and(
            eq(userOrganizationRoles.userId, input.userId),
            eq(userOrganizationRoles.organizationId, input.organizationId)
          )
        );

      return { success: true };
    }),
});
