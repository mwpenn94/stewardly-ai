/**
 * Professional Practice Router
 *
 * Covers: professionalContext, professionalDocuments, compensationBrackets,
 *         userCapabilities, clientSegments, practiceMetrics, annualReviews,
 *         commsLog, portalEngagement, coiContacts, affiliatedResources
 */
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, count } from "drizzle-orm";
import { getDb } from "../db";
import {
  professionalContext, professionalDocuments, compensationBrackets,
  userCapabilities, clientSegments, practiceMetrics, annualReviews,
  commsLog, portalEngagement, coiContacts, affiliatedResources,
} from "../../drizzle/schema";

const dbOrThrow = async () => {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
  return db;
};

// ─── Professional Context ────────────────────────────────────────
const contextRouter = router({
  list: protectedProcedure.input(z.object({ userId: z.number().optional() })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const targetId = input.userId ?? ctx.user.id;
    return db.select().from(professionalContext).where(eq(professionalContext.userId, targetId)).orderBy(desc(professionalContext.id));
  }),
  create: protectedProcedure.input(z.object({
    userId: z.number(), rawInput: z.string(), parsedDomains: z.array(z.string()).optional(), visibleToClient: z.boolean().default(true),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(professionalContext).values({ ...input, addedBy: ctx.user.id });
    return { id: r.insertId };
  }),
});

// ─── Professional Documents ──────────────────────────────────────
const documentsRouter = router({
  list: protectedProcedure.input(z.object({ professionalId: z.number() })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    return db.select().from(professionalDocuments).where(eq(professionalDocuments.professionalId, input.professionalId));
  }),
  create: protectedProcedure.input(z.object({
    professionalId: z.number(), documentType: z.string().max(100).optional(), fileUrl: z.string().max(500).optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(professionalDocuments).values(input);
    return { id: r.insertId };
  }),
  verify: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await db.update(professionalDocuments).set({ verified: true }).where(eq(professionalDocuments.id, input.id));
    return { success: true };
  }),
});

// ─── Compensation Brackets ───────────────────────────────────────
const compensationRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    return db.select().from(compensationBrackets).orderBy(compensationBrackets.id);
  }),
  create: adminProcedure.input(z.object({
    bracketName: z.string().max(100), gdcMin: z.string().optional(), gdcMax: z.string().optional(),
    commissionRate: z.string().optional(), roleSegment: z.string().max(100).optional(), effectiveDate: z.date().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(compensationBrackets).values(input);
    return { id: r.insertId };
  }),
  remove: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await db.delete(compensationBrackets).where(eq(compensationBrackets.id, input.id));
    return { success: true };
  }),
});

// ─── User Capabilities ──────────────────────────────────────────
const capabilitiesRouter = router({
  list: protectedProcedure.input(z.object({ userId: z.number().optional() })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    return db.select().from(userCapabilities).where(eq(userCapabilities.userId, input.userId ?? ctx.user.id));
  }),
  grant: adminProcedure.input(z.object({
    userId: z.number(), capability: z.string().max(100),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(userCapabilities).values({ ...input, granted: true, grantedBy: ctx.user.id });
    return { id: r.insertId };
  }),
  revoke: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await db.update(userCapabilities).set({ granted: false }).where(eq(userCapabilities.id, input.id));
    return { success: true };
  }),
});

// ─── Client Segments ─────────────────────────────────────────────
const segmentsRouter = router({
  list: protectedProcedure.input(z.object({ professionalId: z.number().optional(), limit: z.number().min(1).max(200).default(50) })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    if (input.professionalId) {
      return db.select().from(clientSegments).where(eq(clientSegments.professionalId, input.professionalId)).orderBy(desc(clientSegments.totalScore)).limit(input.limit);
    }
    return db.select().from(clientSegments).orderBy(desc(clientSegments.totalScore)).limit(input.limit);
  }),
  upsert: protectedProcedure.input(z.object({
    clientId: z.number(), professionalId: z.number(),
    valueScore: z.number().default(0), growthScore: z.number().default(0),
    engagementScore: z.number().default(0), relationshipScore: z.number().default(0),
    totalScore: z.number().default(0), tier: z.enum(["platinum","gold","silver","bronze"]).default("silver"),
    serviceModelJson: z.any().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(clientSegments).values(input);
    return { id: r.insertId };
  }),
});

// ─── Practice Metrics ────────────────────────────────────────────
const metricsRouter = router({
  list: protectedProcedure.input(z.object({ professionalId: z.number().optional(), limit: z.number().min(1).max(100).default(12) })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const pid = input.professionalId ?? ctx.user.id;
    return db.select().from(practiceMetrics).where(eq(practiceMetrics.professionalId, pid)).orderBy(desc(practiceMetrics.periodEndDate)).limit(input.limit);
  }),
  create: protectedProcedure.input(z.object({
    professionalId: z.number().optional(), firmId: z.number().optional(),
    periodEndDate: z.date(), organicGrowthRate: z.number().optional(),
    netNewClients: z.number().optional(), revenuePerClient: z.number().optional(),
    costToServeJson: z.any().optional(), attritionRiskClientsJson: z.any().optional(),
    engagementScoresJson: z.any().optional(), benchmarkPercentilesJson: z.any().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(practiceMetrics).values({ ...input, professionalId: input.professionalId ?? ctx.user.id });
    return { id: r.insertId };
  }),
});

// ─── Annual Reviews ──────────────────────────────────────────────
const reviewsRouter = router({
  list: protectedProcedure.input(z.object({ clientId: z.number().optional(), limit: z.number().min(1).max(100).default(20) })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    if (input.clientId) {
      return db.select().from(annualReviews).where(eq(annualReviews.clientId, input.clientId)).orderBy(desc(annualReviews.id)).limit(input.limit);
    }
    return db.select().from(annualReviews).where(eq(annualReviews.professionalId, ctx.user.id)).orderBy(desc(annualReviews.id)).limit(input.limit);
  }),
  create: protectedProcedure.input(z.object({
    clientId: z.number(), dueDate: z.date().optional(), scheduledDate: z.date().optional(),
    phase: z.enum(["identify","prepare","schedule","conduct","document","followup"]).default("identify"),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(annualReviews).values({ ...input, professionalId: ctx.user.id, status: "pending" as const });
    return { id: r.insertId };
  }),
  updatePhase: protectedProcedure.input(z.object({
    id: z.number(), phase: z.enum(["identify","prepare","schedule","conduct","document","followup"]),
    meetingSummary: z.string().optional(), actionItemsJson: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const { id, ...updates } = input;
    await db.update(annualReviews).set(updates).where(and(eq(annualReviews.id, id), eq(annualReviews.professionalId, ctx.user.id)));
    return { success: true };
  }),
  complete: protectedProcedure.input(z.object({ id: z.number(), meetingSummary: z.string().optional() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await db.update(annualReviews).set({ status: "completed" as const, completedDate: new Date(), meetingSummary: input.meetingSummary }).where(eq(annualReviews.id, input.id));
    return { success: true };
  }),
});

// ─── Communications Log ──────────────────────────────────────────
const commsRouter = router({
  list: protectedProcedure.input(z.object({ clientId: z.number().optional(), limit: z.number().min(1).max(200).default(50) })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    if (input.clientId) {
      return db.select().from(commsLog).where(and(eq(commsLog.userId, ctx.user.id), eq(commsLog.clientId, input.clientId))).orderBy(desc(commsLog.id)).limit(input.limit);
    }
    return db.select().from(commsLog).where(eq(commsLog.userId, ctx.user.id)).orderBy(desc(commsLog.id)).limit(input.limit);
  }),
  create: protectedProcedure.input(z.object({
    clientId: z.number().optional(), channel: z.enum(["email","sms","letter","portal_message"]).default("email"),
    category: z.string().max(64).optional(), subject: z.string().max(512).optional(), body: z.string().optional(),
    status: z.enum(["draft","sent","scheduled","failed"]).default("draft"),
    scheduledAt: z.date().optional(), complianceFlags: z.any().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(commsLog).values({ ...input, userId: ctx.user.id });
    return { id: r.insertId };
  }),
  markSent: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await db.update(commsLog).set({ status: "sent" as const, sentAt: new Date() }).where(and(eq(commsLog.id, input.id), eq(commsLog.userId, ctx.user.id)));
    return { success: true };
  }),
});

// ─── Portal Engagement ───────────────────────────────────────────
const engagementRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(100).default(30) })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    return db.select().from(portalEngagement).where(eq(portalEngagement.userId, ctx.user.id)).orderBy(desc(portalEngagement.id)).limit(input.limit);
  }),
  record: protectedProcedure.input(z.object({
    sessionDate: z.date(), loginCount: z.number().default(0), timeSpentSeconds: z.number().default(0),
    pagesVisited: z.number().default(0), featuresUsed: z.string().optional(),
    goalsChecked: z.number().default(0), actionsCompleted: z.number().default(0), engagementScore: z.number().default(0),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(portalEngagement).values({ ...input, userId: ctx.user.id });
    return { id: r.insertId };
  }),
});

// ─── COI Contacts ────────────────────────────────────────────────
const coiRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    return db.select().from(coiContacts).where(eq(coiContacts.professionalId, ctx.user.id)).orderBy(desc(coiContacts.updatedAt)).limit(input.limit);
  }),
  create: protectedProcedure.input(z.object({
    name: z.string().max(256), coiFirm: z.string().max(256).optional(),
    specialty: z.enum(["cpa","attorney","insurance_agent","mortgage_broker","real_estate","other"]),
    contactJson: z.any().optional(), relationshipStrength: z.enum(["strong","moderate","new"]).default("new"),
    firmId: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(coiContacts).values({ ...input, professionalId: ctx.user.id });
    return { id: r.insertId };
  }),
  update: protectedProcedure.input(z.object({
    id: z.number(), name: z.string().max(256).optional(), coiFirm: z.string().max(256).optional(),
    contactJson: z.any().optional(), relationshipStrength: z.enum(["strong","moderate","new"]).optional(),
    referralsSent: z.number().optional(), referralsReceived: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const { id, ...updates } = input;
    await db.update(coiContacts).set(updates).where(and(eq(coiContacts.id, id), eq(coiContacts.professionalId, ctx.user.id)));
    return { success: true };
  }),
  remove: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await db.delete(coiContacts).where(and(eq(coiContacts.id, input.id), eq(coiContacts.professionalId, ctx.user.id)));
    return { success: true };
  }),
});

// ─── Affiliated Resources ────────────────────────────────────────
const resourcesRouter = router({
  list: protectedProcedure.input(z.object({ organizationId: z.number().optional() })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    if (input.organizationId) {
      return db.select().from(affiliatedResources).where(eq(affiliatedResources.organizationId, input.organizationId));
    }
    return db.select().from(affiliatedResources).where(eq(affiliatedResources.isActive, true));
  }),
  create: adminProcedure.input(z.object({
    organizationId: z.number().optional(), name: z.string().max(256),
    category: z.enum(["carrier","lender","ria","advanced_markets","general_partner"]),
    description: z.string().optional(), contactInfo: z.any().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(affiliatedResources).values(input);
    return { id: r.insertId };
  }),
  toggle: adminProcedure.input(z.object({ id: z.number(), isActive: z.boolean() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await db.update(affiliatedResources).set({ isActive: input.isActive }).where(eq(affiliatedResources.id, input.id));
    return { success: true };
  }),
});

export const professionalPracticeRouter = router({
  context: contextRouter,
  documents: documentsRouter,
  compensation: compensationRouter,
  capabilities: capabilitiesRouter,
  segments: segmentsRouter,
  metrics: metricsRouter,
  reviews: reviewsRouter,
  comms: commsRouter,
  engagement: engagementRouter,
  coi: coiRouter,
  resources: resourcesRouter,
});
