/**
 * tRPC router for Dynamic Integrations (user/AI-defined adapters).
 *
 * Power users can:
 *   - probe a URL or paste sample → preview inferred schema
 *   - draftFromDescription → LLM-drafted blueprint
 *   - create/update/archive/delete blueprints with version history
 *   - run a blueprint (dry or live) → records sink + audit trail
 *   - list runs, list versions, revert to a prior version
 *
 * Gating:
 *   - Professional+ can manage their own blueprints
 *   - Admin can manage all blueprints
 *   - Public read of "public" visibility blueprints
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure, adminProcedure } from "../_core/trpc";
import { getDb } from "../db";
import {
  integrationBlueprints,
  integrationBlueprintRuns,
  integrationBlueprintSamples,
} from "../../drizzle/schema";
import {
  listBlueprints,
  getBlueprint,
  createBlueprint,
  updateBlueprint,
  archiveBlueprint,
  hardDeleteBlueprint,
  listVersions,
  revertToVersion,
  executeBlueprint,
  draftBlueprint,
  probeBody,
  inferSchema,
  schemaToPersisted,
  rowToBlueprint,
  runPipeline,
  type BlueprintDraftInput,
  type BlueprintDefinition,
} from "../services/dynamicIntegrations";

// ─── Zod helpers ─────────────────────────────────────────────────────────
// Keep Zod shapes permissive on nested JSON fields — the runtime modules
// already do their own validation, and tightening here would explode.

const zSourceKind = z.enum([
  "http_json", "http_csv", "http_html", "http_rss", "http_any",
  "webhook", "manual_paste", "email_fwd", "file_upload",
]);
const zSinkKind = z.enum([
  "ingested_records", "learning_definitions", "lead_captures",
  "user_memories", "proactive_insights", "none",
]);
const zVisibility = z.enum(["private", "org", "public"]);
const zStatus = z.enum(["draft", "active", "paused", "error", "archived"]);

const zJson = z.any();

const zDraftInput = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  sourceKind: zSourceKind.optional(),
  sourceConfig: zJson.optional(),
  authConfig: zJson.optional(),
  extractionConfig: zJson.optional(),
  transformSteps: z.array(zJson).optional(),
  validationRules: zJson.optional(),
  sinkConfig: zJson.optional(),
  scheduleCron: z.string().max(100).nullable().optional(),
  rateLimitPerMin: z.number().int().positive().max(10000).optional(),
  maxRecordsPerRun: z.number().int().positive().max(1000000).optional(),
  visibility: zVisibility.optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
});

// ─── Router ──────────────────────────────────────────────────────────────

export const dynamicIntegrationsRouter = router({
  // ── READ ──────────────────────────────────────────────────────────────
  list: protectedProcedure.query(async ({ ctx }) => {
    return listBlueprints({
      userId: ctx.user.id,
      role: ctx.user.role,
      organizationId: null,
    });
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBlueprint(input.id, { userId: ctx.user.id, role: ctx.user.role });
      if (!bp) throw new TRPCError({ code: "NOT_FOUND", message: "Blueprint not found" });
      return bp;
    }),

  listVersions: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return listVersions(input.id, { userId: ctx.user.id, role: ctx.user.role });
    }),

  // ── PROBE / DRAFT ─────────────────────────────────────────────────────
  probeInline: protectedProcedure
    .input(
      z.object({
        body: z.string().min(1).max(2_000_000),
        contentType: z.string().max(200).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const probe = probeBody(input.body, input.contentType);
      const schema = probe.records.length > 0 ? inferSchema(probe.records) : null;
      return {
        format: probe.detectedFormat,
        recordCount: probe.records.length,
        notes: probe.notes,
        sampleRecords: probe.records.slice(0, 5),
        schemaPreview: schema ? schemaToPersisted(schema) : null,
      };
    }),

  probeUrl: protectedProcedure
    .input(
      z.object({
        url: z.string().url(),
        method: z.enum(["GET", "POST"]).optional(),
        headers: z.record(z.string(), z.string()).optional(),
        body: z.string().max(100_000).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const resp = await fetch(input.url, {
          method: input.method ?? "GET",
          headers: input.headers ?? {},
          body: input.method === "POST" ? input.body : undefined,
          signal: AbortSignal.timeout(15_000),
        });
        const contentType = resp.headers.get("content-type") ?? "";
        const buf = await resp.arrayBuffer();
        if (buf.byteLength > 1_000_000) {
          throw new TRPCError({
            code: "PAYLOAD_TOO_LARGE",
            message: `Response too large: ${buf.byteLength} bytes`,
          });
        }
        const body = Buffer.from(buf).toString("utf-8");
        const probe = probeBody(body, contentType);
        const schema = probe.records.length > 0 ? inferSchema(probe.records) : null;
        return {
          status: resp.status,
          contentType,
          format: probe.detectedFormat,
          recordCount: probe.records.length,
          notes: probe.notes,
          sampleRecords: probe.records.slice(0, 5),
          schemaPreview: schema ? schemaToPersisted(schema) : null,
          bodyPreview: body.slice(0, 4000),
        };
      } catch (e: unknown) {
        if (e instanceof TRPCError) throw e;
        throw new TRPCError({ code: "BAD_REQUEST", message: (e as Error).message });
      }
    }),

  draftFromDescription: protectedProcedure
    .input(
      z.object({
        name: z.string().max(200).optional(),
        description: z.string().min(3).max(2000),
        url: z.string().url().optional(),
        inlineSample: z.string().max(500_000).optional(),
        preferSink: zSinkKind.optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const result = await draftBlueprint({
        name: input.name,
        description: input.description,
        url: input.url,
        inlineSample: input.inlineSample,
        preferSink: input.preferSink,
      });
      return result;
    }),

  // ── WRITE / CRUD ──────────────────────────────────────────────────────
  create: protectedProcedure
    .input(zDraftInput.extend({ aiDrafted: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { aiDrafted, ...draft } = input;
      return createBlueprint(
        draft as BlueprintDraftInput,
        { userId: ctx.user.id, organizationId: null, ownershipTier: "professional" },
        aiDrafted ? { aiDrafted: true, aiDraftedBy: "contextualLLM" } : undefined,
      );
    }),

  update: protectedProcedure
    .input(
      zDraftInput.extend({
        id: z.string(),
        status: zStatus.optional(),
        changeNote: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, changeNote, ...patch } = input;
      return updateBlueprint(
        id,
        patch as BlueprintDraftInput & { status?: BlueprintDefinition["status"] },
        { userId: ctx.user.id, role: ctx.user.role },
        changeNote,
      );
    }),

  archive: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await archiveBlueprint(input.id, { userId: ctx.user.id, role: ctx.user.role });
      return { success: true };
    }),

  hardDelete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await hardDeleteBlueprint(input.id, { userId: ctx.user.id, role: ctx.user.role });
      return { success: true };
    }),

  revert: protectedProcedure
    .input(z.object({ id: z.string(), version: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      return revertToVersion(input.id, input.version, { userId: ctx.user.id, role: ctx.user.role });
    }),

  // ── RUN ───────────────────────────────────────────────────────────────
  run: protectedProcedure
    .input(z.object({ id: z.string(), dryRun: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const bp = await getBlueprint(input.id, { userId: ctx.user.id, role: ctx.user.role });
      if (!bp) throw new TRPCError({ code: "NOT_FOUND", message: "Blueprint not found" });
      return executeBlueprint(bp, {
        dryRun: !!input.dryRun,
        triggeredBy: ctx.user.id,
        triggerSource: "manual",
      });
    }),

  /** Run an unsaved draft end-to-end without persisting it. */
  testDraft: protectedProcedure
    .input(
      z.object({
        draft: zDraftInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Wrap the draft in a transient BlueprintDefinition and run in dryRun.
      const now = Date.now();
      const draft = input.draft as BlueprintDraftInput;
      const ephemeral: BlueprintDefinition = {
        id: `ephemeral-${now}`,
        slug: "ephemeral",
        name: draft.name ?? "Draft",
        description: draft.description ?? null,
        ownerId: ctx.user.id,
        organizationId: null,
        ownershipTier: "professional",
        visibility: "private",
        status: "draft",
        sourceKind: draft.sourceKind ?? "http_any",
        sourceConfig: (draft.sourceConfig ?? { kind: "http_any" }) as BlueprintDefinition["sourceConfig"],
        authConfig: (draft.authConfig ?? null) as BlueprintDefinition["authConfig"],
        extractionConfig: (draft.extractionConfig ?? { formatHint: "auto" }) as BlueprintDefinition["extractionConfig"],
        transformSteps: (draft.transformSteps ?? []) as BlueprintDefinition["transformSteps"],
        validationRules: (draft.validationRules ?? null) as BlueprintDefinition["validationRules"],
        sinkConfig: (draft.sinkConfig ?? { kind: "none" }) as BlueprintDefinition["sinkConfig"],
        scheduleCron: draft.scheduleCron ?? null,
        rateLimitPerMin: draft.rateLimitPerMin ?? 60,
        maxRecordsPerRun: draft.maxRecordsPerRun ?? 1000,
        currentVersion: 0,
        aiDrafted: false,
        aiDraftedBy: null,
        tags: draft.tags ?? [],
        lastRunAt: null,
        lastRunStatus: null,
        lastRunError: null,
        totalRuns: 0,
        totalRecordsIngested: 0,
        createdBy: ctx.user.id,
        createdAt: now,
        updatedAt: now,
      };
      // Since the ephemeral blueprint is not persisted, bypass the
      // executor's run-row writes by running a minimal inline pipeline.
      const inline = ephemeral.sourceConfig.inlineSample;
      if (!inline) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "testDraft requires inlineSample for now (avoids network I/O on unsaved drafts)",
        });
      }
      const probe = probeBody(inline);
      const { accepted, rejected } = runPipeline(probe.records, ephemeral.transformSteps);
      const schema = accepted.length > 0 ? inferSchema(accepted.slice(0, 200)) : null;
      return {
        status: "success" as const,
        format: probe.detectedFormat,
        recordsParsed: probe.records.length,
        recordsTransformed: accepted.length,
        rejected: rejected.slice(0, 20),
        sample: accepted.slice(0, 5),
        schemaPreview: schema ? schemaToPersisted(schema) : null,
        notes: probe.notes,
      };
    }),

  // ── RUNS / SAMPLES ────────────────────────────────────────────────────
  listRuns: protectedProcedure
    .input(z.object({ id: z.string(), limit: z.number().int().positive().max(100).default(20) }))
    .query(async ({ ctx, input }) => {
      const bp = await getBlueprint(input.id, { userId: ctx.user.id, role: ctx.user.role });
      if (!bp) throw new TRPCError({ code: "NOT_FOUND", message: "Blueprint not found" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const rows = await db
        .select()
        .from(integrationBlueprintRuns)
        .where(eq(integrationBlueprintRuns.blueprintId, input.id))
        .orderBy(desc(integrationBlueprintRuns.startedAt))
        .limit(input.limit);
      return rows;
    }),

  latestSample: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBlueprint(input.id, { userId: ctx.user.id, role: ctx.user.role });
      if (!bp) throw new TRPCError({ code: "NOT_FOUND", message: "Blueprint not found" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [row] = await db
        .select()
        .from(integrationBlueprintSamples)
        .where(eq(integrationBlueprintSamples.blueprintId, input.id))
        .orderBy(desc(integrationBlueprintSamples.fetchedAt))
        .limit(1);
      return row ?? null;
    }),

  // ── PUBLIC GALLERY ────────────────────────────────────────────────────
  listPublic: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select()
      .from(integrationBlueprints)
      .where(eq(integrationBlueprints.visibility, "public"))
      .orderBy(desc(integrationBlueprints.updatedAt))
      .limit(50);
    return rows.map((r) => rowToBlueprint(r as unknown as Record<string, unknown>));
  }),
});

export type DynamicIntegrationsRouter = typeof dynamicIntegrationsRouter;
