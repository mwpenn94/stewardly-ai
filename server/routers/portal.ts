import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, or, desc, sql, inArray } from "drizzle-orm";
import {
  users,
  clientAssociations,
  userOrganizationRoles,
  suitabilityAssessments,
  userProfiles,
  viewAsAuditLog,
  conversations,
  organizations,
} from "../../drizzle/schema";

// ─── HELPERS ────────────────────────────────────────────────────────

async function requireMinRole(userRole: string | null | undefined, minRole: string) {
  const hierarchy: Record<string, number> = { user: 0, advisor: 1, manager: 2, admin: 3 };
  const userLevel = hierarchy[userRole || "user"] ?? 0;
  const minLevel = hierarchy[minRole] ?? 0;
  if (userLevel < minLevel) {
    throw new TRPCError({ code: "FORBIDDEN", message: `Requires ${minRole} role or higher` });
  }
}

// ─── PORTAL ROUTER ──────────────────────────────────────────────────

export const portalRouter = router({
  // ─── PORTAL STATS (role-aware summary) ────────────────────────────
  stats: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
    await requireMinRole(ctx.user.role, "advisor");
    const db = await (await import("../db")).getDb();
    if (!db) return { totalClients: 0, activeClients: 0, teamSize: 0, orgs: 0 };

    const role = ctx.user.role;

    // Count clients associated with this professional
    const clientCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(clientAssociations)
      .where(
        role === "admin"
          ? sql`1=1`
          : eq(clientAssociations.professionalId, ctx.user.id)
      );

    const activeClientCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(clientAssociations)
      .where(
        and(
          role === "admin" ? sql`1=1` : eq(clientAssociations.professionalId, ctx.user.id),
          eq(clientAssociations.status, "active")
        )
      );

    // Team size (for managers: count professionals in their orgs)
    let teamSize = 0;
    if (role === "manager" || role === "admin") {
      const myOrgs = await db
        .select({ organizationId: userOrganizationRoles.organizationId })
        .from(userOrganizationRoles)
        .where(eq(userOrganizationRoles.userId, ctx.user.id));
      const orgIds = myOrgs.map(o => o.organizationId);
      if (orgIds.length > 0) {
        const team = await db
          .select({ count: sql<number>`COUNT(DISTINCT ${userOrganizationRoles.userId})` })
          .from(userOrganizationRoles)
          .where(inArray(userOrganizationRoles.organizationId, orgIds));
        teamSize = Number(team[0]?.count ?? 0);
      }
    }

    // Org count
    const myOrgCount = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${userOrganizationRoles.organizationId})` })
      .from(userOrganizationRoles)
      .where(eq(userOrganizationRoles.userId, ctx.user.id));

    return {
      totalClients: Number(clientCount[0]?.count ?? 0),
      activeClients: Number(activeClientCount[0]?.count ?? 0),
      teamSize,
      orgs: Number(myOrgCount[0]?.count ?? 0),
    };
  }),

  // ─── CLIENT BOOK ──────────────────────────────────────────────────
  clientBook: protectedProcedure
    .input(z.object({
      organizationId: z.number().optional(),
      status: z.enum(["active", "inactive"]).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      await requireMinRole(ctx.user.role, "advisor");
      const db = await (await import("../db")).getDb();
      if (!db) return [];

      const role = ctx.user.role;

      // Build conditions
      const conditions = [];
      if (role !== "admin") {
        // Advisors see their own clients; managers see clients of their team
        if (role === "manager") {
          // Get all professionals in the manager's orgs
          const myOrgs = await db
            .select({ organizationId: userOrganizationRoles.organizationId })
            .from(userOrganizationRoles)
            .where(eq(userOrganizationRoles.userId, ctx.user.id));
          const orgIds = myOrgs.map(o => o.organizationId);
          if (orgIds.length > 0) {
            const teamPros = await db
              .select({ userId: userOrganizationRoles.userId })
              .from(userOrganizationRoles)
              .where(
                and(
                  inArray(userOrganizationRoles.organizationId, orgIds),
                  or(
                    eq(userOrganizationRoles.organizationRole, "professional"),
                    eq(userOrganizationRoles.organizationRole, "manager")
                  )
                )
              );
            const proIds = teamPros.map(p => p.userId);
            proIds.push(ctx.user.id); // Include self
            conditions.push(inArray(clientAssociations.professionalId, proIds));
          } else {
            conditions.push(eq(clientAssociations.professionalId, ctx.user.id));
          }
        } else {
          conditions.push(eq(clientAssociations.professionalId, ctx.user.id));
        }
      }

      if (input?.organizationId) {
        conditions.push(eq(clientAssociations.organizationId, input.organizationId));
      }
      if (input?.status) {
        conditions.push(eq(clientAssociations.status, input.status));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const clients = await db
        .select({
          associationId: clientAssociations.id,
          clientId: clientAssociations.clientId,
          professionalId: clientAssociations.professionalId,
          status: clientAssociations.status,
          createdAt: clientAssociations.createdAt,
          organizationId: clientAssociations.organizationId,
          clientName: users.name,
          clientEmail: users.email,
          clientAvatar: users.avatarUrl,
          clientRole: users.role,
        })
        .from(clientAssociations)
        .innerJoin(users, eq(users.id, clientAssociations.clientId))
        .where(whereClause)
        .orderBy(desc(clientAssociations.createdAt));

      // Enrich with profile + suitability data
      const clientIds = clients.map(c => c.clientId);
      if (clientIds.length === 0) return [];

      const profiles = await db
        .select()
        .from(userProfiles)
        .where(inArray(userProfiles.userId, clientIds));
      const profileMap = new Map(profiles.map(p => [p.userId, p]));

      const suitabilities = await db
        .select()
        .from(suitabilityAssessments)
        .where(inArray(suitabilityAssessments.userId, clientIds));
      const suitMap = new Map(suitabilities.map(s => [s.userId, s]));

      // Get conversation counts
      const convCounts = await db
        .select({
          userId: conversations.userId,
          count: sql<number>`COUNT(*)`,
          lastActivity: sql<string>`MAX(${conversations.updatedAt})`,
        })
        .from(conversations)
        .where(inArray(conversations.userId, clientIds))
        .groupBy(conversations.userId);
      const convMap = new Map(convCounts.map(c => [c.userId, { count: Number(c.count), lastActivity: c.lastActivity }]));

      return clients.map(c => ({
        ...c,
        profile: profileMap.get(c.clientId) || null,
        suitability: suitMap.get(c.clientId) || null,
        conversationCount: convMap.get(c.clientId)?.count ?? 0,
        lastActivity: convMap.get(c.clientId)?.lastActivity ?? null,
      }));
    }),

  // ─── TEAM MEMBERS (for managers) ──────────────────────────────────
  teamMembers: protectedProcedure
    .input(z.object({ organizationId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      await requireMinRole(ctx.user.role, "manager");
      const db = await (await import("../db")).getDb();
      if (!db) return [];

      const myOrgs = await db
        .select({ organizationId: userOrganizationRoles.organizationId })
        .from(userOrganizationRoles)
        .where(eq(userOrganizationRoles.userId, ctx.user.id));
      const orgIds = input?.organizationId
        ? [input.organizationId]
        : myOrgs.map(o => o.organizationId);

      if (orgIds.length === 0) return [];

      const members = await db
        .select({
          roleId: userOrganizationRoles.id,
          userId: userOrganizationRoles.userId,
          organizationId: userOrganizationRoles.organizationId,
          organizationRole: userOrganizationRoles.organizationRole,
          status: userOrganizationRoles.status,
          userName: users.name,
          userEmail: users.email,
          userAvatar: users.avatarUrl,
          userRole: users.role,
        })
        .from(userOrganizationRoles)
        .innerJoin(users, eq(users.id, userOrganizationRoles.userId))
        .where(inArray(userOrganizationRoles.organizationId, orgIds));

      // Enrich with client counts per professional
      const memberIds = members.map(m => m.userId);
      if (memberIds.length === 0) return [];

      const clientCounts = await db
        .select({
          professionalId: clientAssociations.professionalId,
          count: sql<number>`COUNT(*)`,
        })
        .from(clientAssociations)
        .where(
          and(
            inArray(clientAssociations.professionalId, memberIds),
            eq(clientAssociations.status, "active")
          )
        )
        .groupBy(clientAssociations.professionalId);
      const ccMap = new Map(clientCounts.map(c => [c.professionalId, Number(c.count)]));

      return members.map(m => ({
        ...m,
        clientCount: ccMap.get(m.userId) ?? 0,
      }));
    }),

  // ─── MY ORGANIZATIONS ─────────────────────────────────────────────
  myOrganizations: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
    await requireMinRole(ctx.user.role, "advisor");
    const db = await (await import("../db")).getDb();
    if (!db) return [];

    const myRoles = await db
      .select({
        organizationId: userOrganizationRoles.organizationId,
        organizationRole: userOrganizationRoles.organizationRole,
        orgName: organizations.name,
        orgSlug: organizations.slug,
      })
      .from(userOrganizationRoles)
      .innerJoin(organizations, eq(organizations.id, userOrganizationRoles.organizationId))
      .where(eq(userOrganizationRoles.userId, ctx.user.id));

    return myRoles;
  }),

  // ─── VIEW-AS: START SESSION ───────────────────────────────────────
  viewAsStart: protectedProcedure
    .input(z.object({
      targetUserId: z.number(),
      organizationId: z.number().optional(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      await requireMinRole(ctx.user.role, "advisor");

      // Can't view-as yourself
      if (input.targetUserId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot view-as yourself" });
      }

      // Advisors can only view their own clients; managers can view team clients; admins can view anyone
      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      if (ctx.user.role === "advisor") {
        const assoc = await db
          .select()
          .from(clientAssociations)
          .where(
            and(
              eq(clientAssociations.professionalId, ctx.user.id),
              eq(clientAssociations.clientId, input.targetUserId),
              eq(clientAssociations.status, "active")
            )
          )
          .limit(1);
        if (!assoc.length) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You can only view your own clients" });
        }
      }

      // Create audit log entry
      await db.insert(viewAsAuditLog).values({
        actorId: ctx.user.id,
        targetUserId: input.targetUserId,
        organizationId: input.organizationId ?? null,
        startTime: new Date(),
        actions: JSON.stringify([]),
        reason: input.reason || null,
      });

      // Get target user info
      const target = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(eq(users.id, input.targetUserId))
        .limit(1);

      if (!target.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Target user not found" });
      }

      // Get suitability
      const suit = await db
        .select()
        .from(suitabilityAssessments)
        .where(eq(suitabilityAssessments.userId, input.targetUserId))
        .limit(1);

      // Get profile
      const profile = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, input.targetUserId))
        .limit(1);

      return {
        user: target[0],
        suitability: suit[0] || null,
        profile: profile[0] || null,
        sessionStarted: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
      };
    }),

  // ─── VIEW-AS: END SESSION ─────────────────────────────────────────
  viewAsEnd: protectedProcedure
    .input(z.object({
      targetUserId: z.number(),
      actions: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Find the most recent open session
      const sessions = await db
        .select()
        .from(viewAsAuditLog)
        .where(
          and(
            eq(viewAsAuditLog.actorId, ctx.user.id),
            eq(viewAsAuditLog.targetUserId, input.targetUserId),
            sql`${viewAsAuditLog.endTime} IS NULL`
          )
        )
        .orderBy(desc(viewAsAuditLog.startTime))
        .limit(1);

      if (sessions.length > 0) {
        const session = sessions[0];
        const duration = Math.round((Date.now() - new Date(session.startTime).getTime()) / 1000);
        await db
          .update(viewAsAuditLog)
          .set({
            endTime: new Date(),
            sessionDuration: duration,
            actions: JSON.stringify(input.actions || []),
          })
          .where(eq(viewAsAuditLog.id, session.id));
      }

      return { success: true };
    }),

  // ─── VIEW-AS: AUDIT LOG ───────────────────────────────────────────
  viewAsAudit: protectedProcedure
    .input(z.object({ limit: z.number().default(50) }).optional())
    .query(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      await requireMinRole(ctx.user.role, "manager");
      const db = await (await import("../db")).getDb();
      if (!db) return [];

      const logs = await db
        .select({
          id: viewAsAuditLog.id,
          actorId: viewAsAuditLog.actorId,
          targetUserId: viewAsAuditLog.targetUserId,
          organizationId: viewAsAuditLog.organizationId,
          startTime: viewAsAuditLog.startTime,
          endTime: viewAsAuditLog.endTime,
          actions: viewAsAuditLog.actions,
          reason: viewAsAuditLog.reason,
          sessionDuration: viewAsAuditLog.sessionDuration,
        })
        .from(viewAsAuditLog)
        .orderBy(desc(viewAsAuditLog.startTime))
        .limit(input?.limit ?? 50);

      // Enrich with user names
      const allUserIds = Array.from(new Set([...logs.map(l => l.actorId), ...logs.map(l => l.targetUserId)]));
      if (allUserIds.length === 0) return [];

      const userNames = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(inArray(users.id, allUserIds));
      const nameMap = new Map(userNames.map(u => [u.id, u.name]));

      return logs.map(l => ({
        ...l,
        actorName: nameMap.get(l.actorId) || "Unknown",
        targetName: nameMap.get(l.targetUserId) || "Unknown",
      }));
    }),

  // ─── ADD CLIENT ASSOCIATION ───────────────────────────────────────
  addClient: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      organizationId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      await requireMinRole(ctx.user.role, "advisor");
      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Check if association already exists
      const existing = await db
        .select()
        .from(clientAssociations)
        .where(
          and(
            eq(clientAssociations.clientId, input.clientId),
            eq(clientAssociations.professionalId, ctx.user.id)
          )
        )
        .limit(1);

      if (existing.length) {
        throw new TRPCError({ code: "CONFLICT", message: "Client already associated" });
      }

      await db.insert(clientAssociations).values({
        clientId: input.clientId,
        professionalId: ctx.user.id,
        organizationId: input.organizationId ?? null,
        status: "active",
      });

      return { success: true };
    }),

  // ─── REMOVE CLIENT ASSOCIATION ────────────────────────────────────
  removeClient: protectedProcedure
    .input(z.object({ associationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      await requireMinRole(ctx.user.role, "advisor");
      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db
        .update(clientAssociations)
        .set({ status: "inactive" })
        .where(eq(clientAssociations.id, input.associationId));

      return { success: true };
    }),

  // ─── SEARCH USERS (for adding clients) ────────────────────────────
  searchUsers: protectedProcedure
    .input(z.object({ query: z.string().min(1).max(100) }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      await requireMinRole(ctx.user.role, "advisor");
      const db = await (await import("../db")).getDb();
      if (!db) return [];

      const results = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(
          or(
            sql`${users.name} LIKE ${"%" + input.query + "%"}`,
            sql`${users.email} LIKE ${"%" + input.query + "%"}`
          )
        )
        .limit(20);

      return results;
    }),
});
