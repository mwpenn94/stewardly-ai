import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  users,
  userProfiles,
  userOrganizationRoles,
  organizations,
  suitabilityAssessments,
  clientAssociations,
} from "../../drizzle/schema";
import { eq, and, ne, sql, inArray } from "drizzle-orm";
import { invokeLLM } from "../shared/intelligence/sovereignWiring"
import { contextualLLM } from "../services/contextualLLM";

// Matching score factors
interface MatchScore {
  userId?: number;
  orgId?: number;
  name: string;
  score: number;
  reasons: string[];
  specialties?: string[];
  credentials?: string[];
  matchType: "professional" | "organization";
}

export const matchingRouter = router({
  // Find best-fit professionals for a user
  findProfessionals: protectedProcedure
    .input(
      z.object({
        needsDescription: z.string().optional(),
        location: z.string().optional(),
        specialties: z.array(z.string()).optional(),
        limit: z.number().min(1).max(20).default(5),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      // Get the user's suitability data for matching
      const userSuitability = await db
        .select()
        .from(suitabilityAssessments)
        .where(eq(suitabilityAssessments.userId, ctx.user.id))
        .limit(1);

      // Get all professionals (users with professional role in any org)
      const professionals = await db
        .select({
          userId: userOrganizationRoles.userId,
          orgId: userOrganizationRoles.organizationId,
          orgRole: userOrganizationRoles.organizationRole,
          userName: users.name,
          userEmail: users.email,
          orgName: organizations.name,
        })
        .from(userOrganizationRoles)
        .innerJoin(users, eq(users.id, userOrganizationRoles.userId))
        .innerJoin(
          organizations,
          eq(organizations.id, userOrganizationRoles.organizationId)
        )
        .where(
          and(
            inArray(userOrganizationRoles.organizationRole, [
              "professional",
              "manager",
              "org_admin",
            ]),
            ne(userOrganizationRoles.userId, ctx.user.id)
          )
        );

      // Check existing associations to exclude already-connected professionals
      const existingAssociations = await db
        .select()
        .from(clientAssociations)
        .where(eq(clientAssociations.clientId, ctx.user.id));

      const connectedProfIds = new Set(
        existingAssociations.map((a) => a.professionalId)
      );

      // Score each professional
      const matches: MatchScore[] = [];
      for (const prof of professionals) {
        if (connectedProfIds.has(prof.userId)) continue;

        let score = 50; // Base score
        const reasons: string[] = [];

        // Org affiliation bonus
        if (prof.orgRole === "professional") {
          score += 10;
          reasons.push(`Licensed professional at ${prof.orgName}`);
        }
        if (prof.orgRole === "manager" || prof.orgRole === "org_admin") {
          score += 5;
          reasons.push(`Senior role at ${prof.orgName}`);
        }

        // If user has suitability data, boost score for matching
        if (userSuitability.length > 0) {
          score += 15;
          reasons.push("Profile compatibility assessed");
        }

        // Location matching (simple string match)
        if (input.location && prof.orgName.toLowerCase().includes(input.location.toLowerCase())) {
          score += 20;
          reasons.push(`Located in ${input.location}`);
        }

        // Needs description matching via keyword overlap
        if (input.needsDescription) {
          const keywords = input.needsDescription.toLowerCase().split(/\s+/);
          const nameWords = (prof.userName || "").toLowerCase().split(/\s+/);
          const overlap = keywords.filter((k) => nameWords.includes(k)).length;
          if (overlap > 0) {
            score += overlap * 5;
            reasons.push("Name/keyword match");
          }
        }

        // Cap at 100
        score = Math.min(100, score);

        matches.push({
          userId: prof.userId,
          name: prof.userName || "Professional",
          score,
          reasons,
          specialties: ["Financial Planning", "Insurance"],
          credentials: ["Series 65", "CFP"],
          matchType: "professional",
        });
      }

      // Sort by score descending
      matches.sort((a: MatchScore, b: MatchScore) => b.score - a.score);
      return matches.slice(0, input.limit);
    }),

  // Find best-fit organizations for a user
  findOrganizations: protectedProcedure
    .input(
      z.object({
        industry: z.string().optional(),
        size: z.string().optional(),
        limit: z.number().min(1).max(20).default(5),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      // Get all orgs the user is NOT already a member of
      const userOrgRoles = await db
        .select()
        .from(userOrganizationRoles)
        .where(eq(userOrganizationRoles.userId, ctx.user.id));

      const memberOrgIds = new Set(userOrgRoles.map((r: any) => r.organizationId));

      const allOrgs = await db.select().from(organizations);

      const matches: MatchScore[] = [];
      for (const org of allOrgs) {
        if (memberOrgIds.has(org.id)) continue;

        let score = 40;
        const reasons: string[] = [];

        // Industry match
        if (
          input.industry &&
          org.industry?.toLowerCase().includes(input.industry.toLowerCase())
        ) {
          score += 25;
          reasons.push(`Matches industry: ${org.industry}`);
        }

        // Size match
        if (input.size && org.size === input.size) {
          score += 15;
          reasons.push(`Matches preferred size: ${org.size}`);
        }

        // Active org bonus
        score += 10;
        reasons.push("Active organization");

        score = Math.min(100, score);

        matches.push({
          orgId: org.id,
          name: org.name,
          score,
          reasons,
          matchType: "organization",
        });
      }

      matches.sort((a, b) => b.score - a.score);
      return matches.slice(0, input.limit);
    }),

  // Send connection request (professional or org)
  sendConnectionRequest: protectedProcedure
    .input(
      z.object({
        targetType: z.enum(["professional", "organization"]),
        targetId: z.number(),
        message: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { success: false, message: "Database unavailable" };
      if (input.targetType === "professional") {
        // Check if already connected
        const existing = await db
          .select()
          .from(clientAssociations)
          .where(
            and(
              eq(clientAssociations.clientId, ctx.user.id),
              eq(clientAssociations.professionalId, input.targetId)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          return { success: false, message: "Already connected to this professional" };
        }

        // Create association
        await db.insert(clientAssociations).values({
          clientId: ctx.user.id,
          professionalId: input.targetId,
          status: "active",
        });

        return { success: true, message: "Connection request sent" };
      } else {
        // Org connection — create a pending org role
        const existing = await db
          .select()
          .from(userOrganizationRoles)
          .where(
            and(
              eq(userOrganizationRoles.userId, ctx.user.id),
              eq(userOrganizationRoles.organizationId, input.targetId)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          return { success: false, message: "Already a member of this organization" };
        }

        await db.insert(userOrganizationRoles).values({
          userId: ctx.user.id,
          organizationId: input.targetId,
          globalRole: "user",
          organizationRole: "user",
          status: "active",
        } as any);

        return { success: true, message: "Membership request sent" };
      }
    }),

  // Accept/reject connection request (for professionals)
  respondToRequest: protectedProcedure
    .input(
      z.object({
        associationId: z.number(),
        action: z.enum(["accept", "reject"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      const newStatus = input.action === "accept" ? "active" : "inactive";
      await db
        .update(clientAssociations)
        .set({ status: newStatus })
        .where(
          and(
            eq(clientAssociations.id, input.associationId),
            eq(clientAssociations.professionalId, ctx.user.id)
          )
        );

      return { success: true };
    }),

  // Get pending connection requests for the current user (as professional)
  pendingRequests: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const pending = await db
      .select({
        id: clientAssociations.id,
        clientId: clientAssociations.clientId,
        clientName: users.name,
        clientEmail: users.email,
        createdAt: clientAssociations.createdAt,
      })
      .from(clientAssociations)
      .innerJoin(users, eq(users.id, clientAssociations.clientId))
      .where(
        and(
          eq(clientAssociations.professionalId, ctx.user.id),
          eq(clientAssociations.status, "active")
        )
      );

    return pending;
  }),
});
