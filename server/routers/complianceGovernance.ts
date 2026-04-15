/**
 * Compliance & Governance Router
 *
 * Covers: complianceAudit, privacyAudit, constitutionalViolations,
 *         compliancePredictions, orgPromptCustomizations, userAiBoundaries
 */
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, sql, count } from "drizzle-orm";
import { getDb } from "../db";
import {
  complianceAudit, privacyAudit, constitutionalViolations,
  compliancePredictions, orgPromptCustomizations, userAiBoundaries,
} from "../../drizzle/schema";

const dbOrThrow = async () => {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
};

const complianceAuditRouter = router({
  list: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50), offset: z.number().min(0).default(0) }))
    .query(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      return db.select().from(complianceAudit)
        .where(eq(complianceAudit.userId, ctx.user.id))
        .orderBy(desc(complianceAudit.id))
        .limit(input.limit).offset(input.offset);
    }),
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      const [row] = await db.select().from(complianceAudit)
        .where(and(eq(complianceAudit.id, input.id), eq(complianceAudit.userId, ctx.user.id)));
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),
  create: protectedProcedure
    .input(z.object({
      messageId: z.number(),
      conversationId: z.number().optional(),
      classification: z.enum(["general_education", "product_discussion", "personalized_recommendation", "investment_advice"]),
      confidenceScore: z.number().min(0).max(1),
      flagsJson: z.any().optional(),
      reasoningChainJson: z.any().optional(),
      modificationsJson: z.any().optional(),
      reviewTier: z.enum(["auto_approved", "auto_modified", "human_review", "blocked"]),
      modelVersion: z.string().max(64).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      const [result] = await db.insert(complianceAudit).values({ ...input, userId: ctx.user.id });
      return { id: result.insertId };
    }),
  stats: protectedProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    const [stats] = await db.select({
      total: count(),
      autoApproved: count(sql`CASE WHEN ${complianceAudit.reviewTier} = 'auto_approved' THEN 1 END`),
      blocked: count(sql`CASE WHEN ${complianceAudit.reviewTier} = 'blocked' THEN 1 END`),
    }).from(complianceAudit).where(eq(complianceAudit.userId, ctx.user.id));
    return stats;
  }),
});

const privacyAuditRouter = router({
  list: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50), offset: z.number().min(0).default(0) }))
    .query(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      return db.select().from(privacyAudit)
        .where(eq(privacyAudit.userId, ctx.user.id))
        .orderBy(desc(privacyAudit.id))
        .limit(input.limit).offset(input.offset);
    }),
  create: protectedProcedure
    .input(z.object({
      apiCallPurpose: z.string().max(128),
      dataCategories: z.array(z.string()).optional(),
      piiMasked: z.boolean().default(false),
      modelUsed: z.string().max(64).optional(),
      tokensSent: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      const [result] = await db.insert(privacyAudit).values({ ...input, userId: ctx.user.id });
      return { id: result.insertId };
    }),
});

const constitutionalViolationsRouter = router({
  list: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50) }))
    .query(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      return db.select().from(constitutionalViolations)
        .orderBy(desc(constitutionalViolations.id)).limit(input.limit);
    }),
  create: adminProcedure
    .input(z.object({
      messageId: z.number().optional(),
      principleNumber: z.number(),
      principleText: z.string().optional(),
      violationDescription: z.string().optional(),
      severity: z.enum(["low", "medium", "high"]).default("low"),
      originalResponseHash: z.string().max(64).optional(),
      correctedResponseHash: z.string().max(64).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      const [result] = await db.insert(constitutionalViolations).values(input);
      return { id: result.insertId };
    }),
  stats: adminProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    const [stats] = await db.select({
      total: count(),
      high: count(sql`CASE WHEN ${constitutionalViolations.severity} = 'high' THEN 1 END`),
      medium: count(sql`CASE WHEN ${constitutionalViolations.severity} = 'medium' THEN 1 END`),
      low: count(sql`CASE WHEN ${constitutionalViolations.severity} = 'low' THEN 1 END`),
    }).from(constitutionalViolations);
    return stats;
  }),
});

const compliancePredictionsRouter = router({
  list: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50) }))
    .query(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      return db.select().from(compliancePredictions)
        .orderBy(desc(compliancePredictions.id)).limit(input.limit);
    }),
  create: protectedProcedure
    .input(z.object({
      agentActionId: z.number().optional(),
      predictedRiskScore: z.number().min(0).max(100).optional(),
      riskFactors: z.any().optional(),
      predictionModelVersion: z.string().max(32).optional(),
      requiresApproval: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      const [result] = await db.insert(compliancePredictions).values(input);
      return { id: result.insertId };
    }),
  approve: adminProcedure
    .input(z.object({ id: z.number(), approved: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      await db.update(compliancePredictions)
        .set({ approved: input.approved, approvedBy: ctx.user.id })
        .where(eq(compliancePredictions.id, input.id));
      return { success: true };
    }),
});

const orgPromptCustomizationsRouter = router({
  list: adminProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      return db.select().from(orgPromptCustomizations)
        .where(eq(orgPromptCustomizations.orgId, input.orgId))
        .orderBy(desc(orgPromptCustomizations.id));
    }),
  create: adminProcedure
    .input(z.object({ orgId: z.number(), promptText: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      const [result] = await db.insert(orgPromptCustomizations).values({ ...input, status: "pending" as const });
      return { id: result.insertId };
    }),
  review: adminProcedure
    .input(z.object({ id: z.number(), status: z.enum(["approved", "rejected"]) }))
    .mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      await db.update(orgPromptCustomizations)
        .set({ status: input.status, reviewedBy: ctx.user.id, approvedAt: input.status === "approved" ? new Date() : undefined })
        .where(eq(orgPromptCustomizations.id, input.id));
      return { success: true };
    }),
});

const userAiBoundariesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    return db.select().from(userAiBoundaries)
      .where(eq(userAiBoundaries.userId, ctx.user.id))
      .orderBy(desc(userAiBoundaries.id));
  }),
  create: protectedProcedure
    .input(z.object({ boundaryType: z.string().max(64), value: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      const [result] = await db.insert(userAiBoundaries).values({ ...input, userId: ctx.user.id });
      return { id: result.insertId };
    }),
  remove: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      await db.delete(userAiBoundaries)
        .where(and(eq(userAiBoundaries.id, input.id), eq(userAiBoundaries.userId, ctx.user.id)));
      return { success: true };
    }),
});

export const complianceGovernanceRouter = router({
  audit: complianceAuditRouter,
  privacy: privacyAuditRouter,
  violations: constitutionalViolationsRouter,
  predictions: compliancePredictionsRouter,
  orgPrompts: orgPromptCustomizationsRouter,
  aiBoundaries: userAiBoundariesRouter,
});
