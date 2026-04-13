import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { eq, and, like, or, desc, sql, inArray } from "drizzle-orm";
import { professionals, professionalRelationships, professionalReviews, userOrganizationRoles } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

const RELATIONSHIP_TYPES = [
  "financial_advisor", "insurance_agent", "tax_professional", "estate_attorney",
  "accountant", "mortgage_broker", "real_estate_agent", "other"
] as const;

const SPECIALIZATIONS = [
  "retirement", "estate", "insurance", "tax", "investment", "premium_financing",
  "wealth_management", "college_planning", "business_succession", "debt_management"
] as const;

export const professionalsRouter = router({
  // ─── CRUD: Create Professional ──────────────────────────────────────
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(256),
      title: z.string().max(256).optional(),
      firm: z.string().max(256).optional(),
      email: z.string().email().optional(),
      phone: z.string().max(32).optional(),
      website: z.string().max(512).optional(),
      location: z.string().max(256).optional(),
      state: z.string().max(64).optional(),
      bio: z.string().optional(),
      credentials: z.array(z.string()).optional(),
      licenses: z.array(z.string()).optional(),
      specializations: z.array(z.string()).optional(),
      yearsExperience: z.number().int().min(0).optional(),
      aumRange: z.string().optional(),
      feeStructure: z.string().optional(),
      minimumInvestment: z.string().optional(),
      servicesOffered: z.array(z.string()).optional(),
      languagesSpoken: z.array(z.string()).optional(),
      source: z.enum(["manual", "directory_import", "org_roster", "self_registered", "referral"]).default("manual"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const now = Date.now();

      await db.insert(professionals).values({
        ...input,
        credentials: input.credentials ? JSON.stringify(input.credentials) : null,
        licenses: input.licenses ? JSON.stringify(input.licenses) : null,
        specializations: input.specializations ? JSON.stringify(input.specializations) : null,
        servicesOffered: input.servicesOffered ? JSON.stringify(input.servicesOffered) : null,
        languagesSpoken: input.languagesSpoken ? JSON.stringify(input.languagesSpoken) : null,
        createdBy: ctx.user.id,
        createdAt: now,
        updatedAt: now,
      } as any);

      const created = await db.select().from(professionals)
        .where(eq(professionals.createdBy, ctx.user.id))
        .orderBy(desc(professionals.id))
        .limit(1);

      return created[0];
    }),

  // ─── CRUD: Read / List Professionals ────────────────────────────────
  list: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      specialization: z.string().optional(),
      state: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(20),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const db = await (await import("../db")).getDb();
      if (!db) return { items: [], total: 0 };

      let query = db.select().from(professionals)
        .where(eq(professionals.status, "active"));

      // Apply filters
      const conditions: any[] = [eq(professionals.status, "active")];
      if (input.search) {
        conditions.push(or(
          like(professionals.name, `%${input.search}%`),
          like(professionals.firm, `%${input.search}%`),
          like(professionals.title, `%${input.search}%`),
        ));
      }
      if (input.state) {
        conditions.push(eq(professionals.state, input.state));
      }

      const items = await db.select().from(professionals)
        .where(and(...conditions))
        .orderBy(desc(professionals.avgRating))
        .limit(input.limit)
        .offset(input.offset);

      // Filter by specialization in JS since it's JSON
      const filtered = input.specialization
        ? items.filter(p => {
            const specs = typeof p.specializations === "string" ? JSON.parse(p.specializations) : (p.specializations || []);
            return specs.includes(input.specialization);
          })
        : items;

      return { items: filtered, total: filtered.length };
    }),

  // ─── CRUD: Get Single Professional ──────────────────────────────────
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await (await import("../db")).getDb();
      if (!db) return null;
      const rows = await db.select().from(professionals).where(eq(professionals.id, input.id)).limit(1);
      if (rows.length === 0) return null;

      // Get reviews
      const reviews = await db.select().from(professionalReviews)
        .where(and(
          eq(professionalReviews.professionalId, input.id),
          eq(professionalReviews.status, "published"),
        ))
        .orderBy(desc(professionalReviews.createdAt))
        .limit(10);

      // Check if current user has a relationship
      const relationship = await db.select().from(professionalRelationships)
        .where(and(
          eq(professionalRelationships.userId, ctx.user.id),
          eq(professionalRelationships.professionalId, input.id),
        ))
        .limit(1);

      return {
        ...rows[0],
        reviews,
        userRelationship: relationship[0] || null,
      };
    }),

  // ─── CRUD: Update Professional ──────────────────────────────────────
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(256).optional(),
      title: z.string().max(256).optional(),
      firm: z.string().max(256).optional(),
      email: z.string().email().optional(),
      phone: z.string().max(32).optional(),
      website: z.string().max(512).optional(),
      location: z.string().max(256).optional(),
      state: z.string().max(64).optional(),
      bio: z.string().optional(),
      credentials: z.array(z.string()).optional(),
      licenses: z.array(z.string()).optional(),
      specializations: z.array(z.string()).optional(),
      yearsExperience: z.number().int().min(0).optional(),
      aumRange: z.string().optional(),
      feeStructure: z.string().optional(),
      minimumInvestment: z.string().optional(),
      servicesOffered: z.array(z.string()).optional(),
      languagesSpoken: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { id, credentials, licenses, specializations, servicesOffered, languagesSpoken, ...rest } = input;
      const updateData: any = { ...rest, updatedAt: Date.now() };
      if (credentials) updateData.credentials = JSON.stringify(credentials);
      if (licenses) updateData.licenses = JSON.stringify(licenses);
      if (specializations) updateData.specializations = JSON.stringify(specializations);
      if (servicesOffered) updateData.servicesOffered = JSON.stringify(servicesOffered);
      if (languagesSpoken) updateData.languagesSpoken = JSON.stringify(languagesSpoken);

      await db.update(professionals).set(updateData).where(eq(professionals.id, id));
      const updated = await db.select().from(professionals).where(eq(professionals.id, id)).limit(1);
      return updated[0];
    }),

  // ─── CRUD: Delete Professional ──────────────────────────────────────
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Soft delete — set status to inactive
      await db.update(professionals)
        .set({ status: "inactive", updatedAt: Date.now() })
        .where(eq(professionals.id, input.id));
      return { success: true };
    }),

  // ─── 5-TIER MATCHING ALGORITHM ─────────────────────────────────────
  match: protectedProcedure
    .input(z.object({
      needs: z.array(z.string()).optional(), // specializations needed
      location: z.string().optional(),
      limit: z.number().int().min(1).max(50).default(10),
    }))
    .query(async ({ ctx, input }) => {
      const db = await (await import("../db")).getDb();
      if (!db) return { tiers: [], total: 0 };

      const userId = ctx.user?.id;

      // ── TIER 1: Existing relationships (only for authenticated users) ──
      let existingRels: any[] = [];
      if (userId) {
        existingRels = await db.select().from(professionalRelationships)
          .where(and(
            eq(professionalRelationships.userId, userId),
            eq(professionalRelationships.status, "active"),
          ));
      }

      let tier1: any[] = [];
      if (existingRels.length > 0) {
        const proIds = existingRels.map(r => r.professionalId);
        const tier1Pros = await db.select().from(professionals)
          .where(and(
            inArray(professionals.id, proIds),
            eq(professionals.status, "active"),
          ));
        tier1 = tier1Pros.map(p => ({
          ...p,
          tier: "tier1_existing",
          matchReason: "Your existing professional",
          relationship: existingRels.find(r => r.professionalId === p.id),
        }));
      }

      // ── TIER 2: Organization-affiliated (only for authenticated users) ──
      let tier2: any[] = [];
      let userOrgs: any[] = [];
      if (userId) {
        userOrgs = await db.select().from(userOrganizationRoles)
          .where(eq(userOrganizationRoles.userId, userId));
      }
      if (userOrgs.length > 0) {
        const orgIds = userOrgs.map(o => o.organizationId);
        // Find professionals linked to users in same orgs
        const orgMembers = await db.select().from(userOrganizationRoles)
          .where(and(
            inArray(userOrganizationRoles.organizationId, orgIds),
            or(
              eq(userOrganizationRoles.organizationRole, "professional"),
              eq(userOrganizationRoles.organizationRole, "manager"),
            ),
          ));
        if (orgMembers.length > 0) {
          const memberUserIds = orgMembers.map(m => m.userId);
          const orgPros = await db.select().from(professionals)
            .where(and(
              inArray(professionals.linkedUserId, memberUserIds),
              eq(professionals.status, "active"),
            ));
          tier2 = orgPros
            .filter(p => !tier1.some(t => t.id === p.id))
            .map(p => ({
              ...p,
              tier: "tier2_org_affiliated",
              matchReason: "Affiliated with your organization",
            }));
        }
      }

      // ── TIER 3: Specialty match ─────────────────────────────────────
      const allActive = await db.select().from(professionals)
        .where(eq(professionals.status, "active"))
        .orderBy(desc(professionals.avgRating))
        .limit(100);

      const usedIds = new Set([...tier1, ...tier2].map(p => p.id));
      let tier3: any[] = [];
      if (input.needs && input.needs.length > 0) {
        tier3 = allActive
          .filter(p => {
            if (usedIds.has(p.id)) return false;
            const specs = typeof p.specializations === "string" ? JSON.parse(p.specializations) : (p.specializations || []);
            return input.needs!.some(n => specs.includes(n));
          })
          .map(p => ({
            ...p,
            tier: "tier3_specialty",
            matchReason: `Specializes in ${input.needs!.join(", ")}`,
          }));
      }

      // ── TIER 4: Location match ──────────────────────────────────────
      const usedIds2 = new Set([...Array.from(usedIds), ...tier3.map(p => p.id)]);
      let tier4: any[] = [];
      if (input.location) {
        tier4 = allActive
          .filter(p => {
            if (usedIds2.has(p.id)) return false;
            return p.location?.toLowerCase().includes(input.location!.toLowerCase()) ||
                   p.state?.toLowerCase().includes(input.location!.toLowerCase());
          })
          .map(p => ({
            ...p,
            tier: "tier4_location",
            matchReason: `Located near ${input.location}`,
          }));
      }

      // ── TIER 5: General directory ───────────────────────────────────
      const usedIds3 = new Set([...Array.from(usedIds2), ...tier4.map(p => p.id)]);
      const tier5 = allActive
        .filter(p => !usedIds3.has(p.id))
        .slice(0, 10)
        .map(p => ({
          ...p,
          tier: "tier5_general",
          matchReason: "Top-rated professional",
        }));

      const tiers = [
        { tier: 1, label: "Your Professionals", items: tier1 },
        { tier: 2, label: "Organization Network", items: tier2 },
        { tier: 3, label: "Specialty Match", items: tier3.slice(0, input.limit) },
        { tier: 4, label: "Near You", items: tier4.slice(0, input.limit) },
        { tier: 5, label: "Directory", items: tier5 },
      ].filter(t => t.items.length > 0);

      const total = tiers.reduce((sum, t) => sum + t.items.length, 0);
      return { tiers, total };
    }),

  // ─── RELATIONSHIPS ──────────────────────────────────────────────────
  myRelationships: protectedProcedure.query(async ({ ctx }) => {
    const db = await (await import("../db")).getDb();
    if (!db) return [];
    const rels = await db.select().from(professionalRelationships)
      .where(eq(professionalRelationships.userId, ctx.user.id))
      .orderBy(desc(professionalRelationships.createdAt));

    // Enrich with professional data
    if (rels.length === 0) return [];
    const proIds = rels.map(r => r.professionalId);
    const pros = await db.select().from(professionals)
      .where(inArray(professionals.id, proIds));
    const proMap = new Map(pros.map(p => [p.id, p]));

    return rels.map(r => ({
      ...r,
      professional: proMap.get(r.professionalId) || null,
    }));
  }),

  addRelationship: protectedProcedure
    .input(z.object({
      professionalId: z.number(),
      relationshipType: z.enum(RELATIONSHIP_TYPES),
      notes: z.string().optional(),
      referralSource: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const now = Date.now();

      // Check for existing relationship
      const existing = await db.select().from(professionalRelationships)
        .where(and(
          eq(professionalRelationships.userId, ctx.user.id),
          eq(professionalRelationships.professionalId, input.professionalId),
        ))
        .limit(1);

      if (existing.length > 0) {
        // Reactivate if ended
        await db.update(professionalRelationships)
          .set({ status: "active", endedAt: null, updatedAt: now, notes: input.notes || existing[0].notes })
          .where(eq(professionalRelationships.id, existing[0].id));
        return { success: true, reconnected: true };
      }

      await db.insert(professionalRelationships).values({
        userId: ctx.user.id,
        professionalId: input.professionalId,
        relationshipType: input.relationshipType,
        startedAt: now,
        notes: input.notes,
        referralSource: input.referralSource,
        createdAt: now,
        updatedAt: now,
      });
      return { success: true, reconnected: false };
    }),

  endRelationship: protectedProcedure
    .input(z.object({ relationshipId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const now = Date.now();

      await db.update(professionalRelationships)
        .set({ status: "ended", endedAt: now, updatedAt: now })
        .where(and(
          eq(professionalRelationships.id, input.relationshipId),
          eq(professionalRelationships.userId, ctx.user.id),
        ));
      return { success: true };
    }),

  // Reconnect with a previously ended relationship
  reconnect: protectedProcedure
    .input(z.object({ relationshipId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const now = Date.now();

      await db.update(professionalRelationships)
        .set({ status: "active", endedAt: null, lastContactAt: now, updatedAt: now })
        .where(and(
          eq(professionalRelationships.id, input.relationshipId),
          eq(professionalRelationships.userId, ctx.user.id),
        ));
      return { success: true };
    }),

  // ─── REVIEWS ────────────────────────────────────────────────────────
  addReview: protectedProcedure
    .input(z.object({
      professionalId: z.number(),
      rating: z.number().int().min(1).max(5),
      title: z.string().max(256).optional(),
      review: z.string().optional(),
      isAnonymous: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const now = Date.now();

      await db.insert(professionalReviews).values({
        professionalId: input.professionalId,
        userId: ctx.user.id,
        rating: input.rating,
        title: input.title,
        review: input.review,
        isAnonymous: input.isAnonymous,
        createdAt: now,
        updatedAt: now,
      });

      // Update average rating
      const allReviews = await db.select().from(professionalReviews)
        .where(and(
          eq(professionalReviews.professionalId, input.professionalId),
          eq(professionalReviews.status, "published"),
        ));
      // New review is pending, so add it manually
      const ratings = [...allReviews.map(r => r.rating), input.rating];
      const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;

      await db.update(professionals)
        .set({ avgRating: avg, reviewCount: ratings.length, updatedAt: now })
        .where(eq(professionals.id, input.professionalId));

      return { success: true };
    }),
});
