/**
 * Security & Privacy Router
 *
 * Covers: encryptionKeys, encryptedFieldsRegistry, accessPolicies,
 *         delegations, fieldSharingControls, orgRetentionPolicies, retentionActionsLog
 */
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../db";
import {
  encryptionKeys, encryptedFieldsRegistry, accessPolicies,
  delegations, fieldSharingControls, orgRetentionPolicies, retentionActionsLog,
} from "../../drizzle/schema";

const dbOrThrow = async () => {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
};

// ─── Encryption Keys ─────────────────────────────────────────────
const keysRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    return db.select().from(encryptionKeys).orderBy(desc(encryptionKeys.id));
  }),
  create: adminProcedure.input(z.object({
    keyAlias: z.string().max(128),
    status: z.enum(["active","rotating","retired"]).default("active"),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(encryptionKeys).values(input);
    return { id: r.insertId };
  }),
  rotate: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await db.update(encryptionKeys).set({ status: "rotating" as const, rotatedAt: new Date() }).where(eq(encryptionKeys.id, input.id));
    return { success: true };
  }),
  retire: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await db.update(encryptionKeys).set({ status: "retired" as const, retiredAt: new Date() }).where(eq(encryptionKeys.id, input.id));
    return { success: true };
  }),
});

// ─── Encrypted Fields Registry ───────────────────────────────────
const fieldsRegistryRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    return db.select().from(encryptedFieldsRegistry).orderBy(desc(encryptedFieldsRegistry.id));
  }),
  register: adminProcedure.input(z.object({
    tableName: z.string().max(128), columnName: z.string().max(128),
    encryptionMethod: z.string().max(64).default("AES-256-GCM"),
    keyAlias: z.string().max(128),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(encryptedFieldsRegistry).values(input);
    return { id: r.insertId };
  }),
});

// ─── Access Policies ─────────────────────────────────────────────
const policiesRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    return db.select().from(accessPolicies).orderBy(desc(accessPolicies.id));
  }),
  create: adminProcedure.input(z.object({
    resourceType: z.string().max(128), requiredAttributes: z.any().optional(),
    effect: z.enum(["allow","deny"]).default("allow"), description: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(accessPolicies).values(input);
    return { id: r.insertId };
  }),
  remove: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await db.delete(accessPolicies).where(eq(accessPolicies.id, input.id));
    return { success: true };
  }),
});

// ─── Delegations ─────────────────────────────────────────────────
const delegationsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    return db.select().from(delegations)
      .where(eq(delegations.delegatorId, ctx.user.id))
      .orderBy(desc(delegations.grantedAt));
  }),
  listReceived: protectedProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    return db.select().from(delegations)
      .where(and(eq(delegations.delegateId, ctx.user.id), eq(delegations.active, true)));
  }),
  create: protectedProcedure.input(z.object({
    delegateId: z.number(), scope: z.any().optional(), expiresAt: z.date().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(delegations).values({ ...input, delegatorId: ctx.user.id });
    return { id: r.insertId };
  }),
  revoke: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await db.update(delegations).set({ active: false }).where(and(eq(delegations.id, input.id), eq(delegations.delegatorId, ctx.user.id)));
    return { success: true };
  }),
});

// ─── Field Sharing Controls ──────────────────────────────────────
const sharingRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    return db.select().from(fieldSharingControls).where(eq(fieldSharingControls.userId, ctx.user.id));
  }),
  create: protectedProcedure.input(z.object({
    fieldName: z.string().max(128), shareWithRole: z.string().max(32).optional(), expiresAt: z.date().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(fieldSharingControls).values({ ...input, userId: ctx.user.id });
    return { id: r.insertId };
  }),
  remove: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await db.delete(fieldSharingControls).where(and(eq(fieldSharingControls.id, input.id), eq(fieldSharingControls.userId, ctx.user.id)));
    return { success: true };
  }),
});

// ─── Org Retention Policies ──────────────────────────────────────
const retentionPoliciesRouter = router({
  list: adminProcedure.input(z.object({ orgId: z.number() })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    return db.select().from(orgRetentionPolicies).where(eq(orgRetentionPolicies.orgId, input.orgId));
  }),
  create: adminProcedure.input(z.object({
    orgId: z.number(), dataCategory: z.string().max(128), retentionDays: z.number(),
    action: z.enum(["delete","archive","anonymize"]).default("archive"),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(orgRetentionPolicies).values({ ...input, configuredBy: ctx.user.id });
    return { id: r.insertId };
  }),
  remove: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await db.delete(orgRetentionPolicies).where(eq(orgRetentionPolicies.id, input.id));
    return { success: true };
  }),
});

// ─── Retention Actions Log ───────────────────────────────────────
const retentionLogRouter = router({
  list: adminProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    return db.select().from(retentionActionsLog).orderBy(desc(retentionActionsLog.id)).limit(input.limit);
  }),
  record: adminProcedure.input(z.object({
    dataType: z.string().max(128), action: z.enum(["delete","archive","anonymize"]),
    recordsAffected: z.number().default(0),
  })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [r] = await db.insert(retentionActionsLog).values(input);
    return { id: r.insertId };
  }),
});

export const securityPrivacyRouter = router({
  keys: keysRouter,
  fieldsRegistry: fieldsRegistryRouter,
  policies: policiesRouter,
  delegations: delegationsRouter,
  sharing: sharingRouter,
  retentionPolicies: retentionPoliciesRouter,
  retentionLog: retentionLogRouter,
});
