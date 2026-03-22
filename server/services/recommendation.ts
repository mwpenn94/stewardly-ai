/**
 * Recommendation & Matching Service
 * - Best-fit user-professional matching algorithm
 * - Best-fit org-org matching recommendations
 * - Invitation system (on-platform and off-platform)
 * - Org-level recommendation generation
 */
import { getDb } from "../db";
import { users, userProfiles, organizations, userOrganizationRoles, userRelationships, organizationRelationships } from "../../drizzle/schema";
import { eq, and, sql, ne, inArray } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { notifyOwner } from "../_core/notification";

// ─── Matching Score Weights ────────────────────────────────────────────────
const WEIGHTS = {
  specialtyMatch: 0.30,
  locationProximity: 0.15,
  experienceLevel: 0.15,
  clientFit: 0.20,
  availability: 0.10,
  rating: 0.10,
};

// ─── User-Professional Matching ────────────────────────────────────────────
export class MatchingService {
  /**
   * Find best-fit professionals for a user based on their profile and needs
   */
  async findBestFitProfessionals(userId: number, preferences?: {
    specialties?: string[];
    location?: string;
    maxResults?: number;
  }): Promise<Array<{
    professionalId: number;
    name: string;
    score: number;
    matchReasons: string[];
    specialties: string[];
    organizationName: string | null;
  }>> {
    const db = await getDb();
    if (!db) return [];

    // Get user profile
    const [userProfile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);

    // Get all professionals
    const professionals = await db
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
        settings: users.settings,
      })
      .from(users)
      .where(
        and(
          eq(users.role, "advisor"),
          ne(users.id, userId),
        )
      )
      .limit(100);

    // Get org affiliations for professionals
    const profIds = professionals.map(p => p.id);
    const orgRoles = profIds.length > 0
      ? await db.select({
          userId: userOrganizationRoles.userId,
          orgId: userOrganizationRoles.organizationId,
          orgName: organizations.name,
        })
        .from(userOrganizationRoles)
        .leftJoin(organizations, eq(userOrganizationRoles.organizationId, organizations.id))
        .where(inArray(userOrganizationRoles.userId, profIds))
      : [];

    const orgMap = new Map<number, string>();
    orgRoles.forEach(r => { if (r.orgName) orgMap.set(r.userId, r.orgName); });

    // Score each professional
    const scored = professionals.map(prof => {
      let score = 0;
      const reasons: string[] = [];
      const settings = (prof.settings as any) || {};
      const specialties = (settings.specialties as string[]) || [];

      // Specialty match
      if (preferences?.specialties?.length) {
        const overlap = specialties.filter(s =>
          preferences.specialties!.some(ps => s.toLowerCase().includes(ps.toLowerCase()))
        );
        if (overlap.length > 0) {
          score += WEIGHTS.specialtyMatch * (overlap.length / preferences.specialties.length);
          reasons.push(`Specializes in ${overlap.join(", ")}`);
        }
      } else {
        score += WEIGHTS.specialtyMatch * 0.5; // Neutral
      }

      // Location proximity (simplified — zip code prefix match)
      if (preferences?.location && settings.location) {
        const match = preferences.location.slice(0, 3) === String(settings.location).slice(0, 3);
        if (match) {
          score += WEIGHTS.locationProximity;
          reasons.push("Located in your area");
        }
      }

      // Client fit based on profile
      if (userProfile) {
        const incomeRange = userProfile.incomeRange || "";
        const isHighNet = incomeRange.includes("250") || incomeRange.includes("500") || incomeRange.includes("1M");
        if (isHighNet && specialties.some(s => /wealth|estate|tax/i.test(s))) {
          score += WEIGHTS.clientFit;
          reasons.push("Experienced with high-net-worth clients");
        } else {
          score += WEIGHTS.clientFit * 0.5;
        }
      }

      // Base availability and rating scores
      score += WEIGHTS.availability * 0.7;
      score += WEIGHTS.rating * 0.7;

      if (reasons.length === 0) reasons.push("General financial advisor");

      return {
        professionalId: prof.id,
        name: prof.name || "Advisor",
        score: Math.round(score * 100) / 100,
        matchReasons: reasons,
        specialties,
        organizationName: orgMap.get(prof.id) || null,
      };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, preferences?.maxResults || 10);
  }

  /**
   * Find best-fit organizations for an organization
   */
  async findBestFitOrgs(orgId: number, criteria?: {
    relationshipType?: string;
    industry?: string;
    maxResults?: number;
  }): Promise<Array<{
    organizationId: number;
    name: string;
    score: number;
    matchReasons: string[];
    industry: string | null;
    size: string | null;
  }>> {
    const db = await getDb();
    if (!db) return [];

    // Get source org
    const [sourceOrg] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
    if (!sourceOrg) return [];

    // Get existing relationships to exclude
    const existingRels = await db.select({ childOrgId: organizationRelationships.childOrgId })
      .from(organizationRelationships)
      .where(eq(organizationRelationships.parentOrgId, orgId));
    const excludeIds = new Set([orgId, ...existingRels.map(r => r.childOrgId)]);

    // Get candidate orgs
    const candidates = await db.select().from(organizations)
      .where(ne(organizations.id, orgId))
      .limit(100);

    const scored = candidates
      .filter(c => !excludeIds.has(c.id))
      .map(org => {
        let score = 0;
        const reasons: string[] = [];

        // Industry complementarity
        if (criteria?.industry && org.industry?.toLowerCase().includes(criteria.industry.toLowerCase())) {
          score += 0.35;
          reasons.push(`Same industry: ${org.industry}`);
        } else if (org.industry && sourceOrg.industry && org.industry !== sourceOrg.industry) {
          score += 0.20;
          reasons.push(`Complementary industry: ${org.industry}`);
        }

        // Size compatibility
        if (org.size === sourceOrg.size) {
          score += 0.15;
          reasons.push("Similar organization size");
        }

        // Base score
        score += 0.3;
        if (reasons.length === 0) reasons.push("Potential partnership opportunity");

        return {
          organizationId: org.id,
          name: org.name,
          score: Math.round(score * 100) / 100,
          matchReasons: reasons,
          industry: org.industry,
          size: org.size,
        };
      });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, criteria?.maxResults || 10);
  }

  /**
   * Generate org-level recommendations using AI
   */
  async generateOrgRecommendations(orgId: number): Promise<{
    recommendations: Array<{
      type: string;
      title: string;
      description: string;
      priority: string;
      actionItems: string[];
    }>;
  }> {
    const db = await getDb();
    if (!db) return { recommendations: [] };

    // Get org info
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
    if (!org) return { recommendations: [] };

    // Get member count
    const [memberCount] = await db.select({ count: sql<number>`count(*)` })
      .from(userOrganizationRoles)
      .where(eq(userOrganizationRoles.organizationId, orgId));

    // Get relationship count
    const [relCount] = await db.select({ count: sql<number>`count(*)` })
      .from(organizationRelationships)
      .where(eq(organizationRelationships.parentOrgId, orgId));

    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are a business strategy advisor. Generate actionable recommendations for a financial services organization based on their profile.",
        },
        {
          role: "user",
          content: `Organization: ${org.name}\nIndustry: ${org.industry || "Financial Services"}\nSize: ${org.size || "unknown"}\nMembers: ${memberCount?.count || 0}\nPartner Relationships: ${relCount?.count || 0}\n\nGenerate 3-5 strategic recommendations for growth, partnerships, and operational improvement.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "org_recommendations",
          strict: true,
          schema: {
            type: "object",
            properties: {
              recommendations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: { type: "string" },
                    title: { type: "string" },
                    description: { type: "string" },
                    priority: { type: "string" },
                    actionItems: { type: "array", items: { type: "string" } },
                  },
                  required: ["type", "title", "description", "priority", "actionItems"],
                  additionalProperties: false,
                },
              },
            },
            required: ["recommendations"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = String(result.choices[0]?.message?.content || "{}");
    try {
      return JSON.parse(content);
    } catch {
      return { recommendations: [] };
    }
  }
}

// ─── Invitation Service ────────────────────────────────────────────────────
export class InvitationService {
  /**
   * Send an on-platform connection invitation
   */
  async sendInvitation(fromUserId: number, toUserId: number, message?: string): Promise<{
    success: boolean;
    invitationId: number | null;
  }> {
    const db = await getDb();
    if (!db) return { success: false, invitationId: null };

    // Check if relationship already exists
    const [existing] = await db.select().from(userRelationships)
      .where(and(
        eq(userRelationships.userId, fromUserId),
        eq(userRelationships.relatedUserId, toUserId),
      ))
      .limit(1);

    if (existing) return { success: false, invitationId: null };

    // Create pending relationship
    const [rel] = await db.insert(userRelationships).values({
      userId: fromUserId,
      relatedUserId: toUserId,
      relationshipType: "peer",
      status: "pending",
      metadata: message ? { inviteMessage: message } : undefined,
    }).$returningId();

    return { success: true, invitationId: rel?.id || null };
  }

  /**
   * Send an in-app invitation notification (no external email)
   */
  async sendEmailInvitation(fromUserId: number, email: string, orgId?: number, message?: string): Promise<{
    success: boolean;
  }> {
    const db = await getDb();
    if (!db) return { success: false };

    // Get sender info
    const [sender] = await db.select().from(users).where(eq(users.id, fromUserId)).limit(1);
    const senderName = sender?.name || "A Stewardly user";

    // Deliver invitation as in-app notification (no external email)
    await notifyOwner({
      title: "New Invitation Sent",
      content: `${senderName} invited ${email} to join${orgId ? ` organization #${orgId}` : " the platform"}. Message: ${message || "No message"}. Invitation delivered via in-app notification.`,
    });

    return { success: true };
  }

  /**
   * Accept/decline a connection request
   */
  async respondToInvitation(userId: number, invitationId: number, accept: boolean): Promise<{
    success: boolean;
  }> {
    const db = await getDb();
    if (!db) return { success: false };

    const [invitation] = await db.select().from(userRelationships)
      .where(and(
        eq(userRelationships.id, invitationId),
        eq(userRelationships.relatedUserId, userId),
        eq(userRelationships.status, "pending"),
      ))
      .limit(1);

    if (!invitation) return { success: false };

    await db.update(userRelationships)
      .set({ status: accept ? "active" : "inactive" })
      .where(eq(userRelationships.id, invitationId));

    return { success: true };
  }
}

export const matchingService = new MatchingService();
export const invitationService = new InvitationService();
