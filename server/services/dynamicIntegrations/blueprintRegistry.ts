/**
 * Dynamic Integration — Blueprint Registry
 *
 * CRUD + version snapshots over integrationBlueprints / integrationBlueprintVersions.
 * Centralizes permission checks (owner vs admin) and the version-snapshot semantics
 * so every router entry point behaves the same way.
 */

import { randomUUID } from "crypto";
import { and, desc, eq, or } from "drizzle-orm";
import { getDb } from "../../db";
import {
  integrationBlueprints,
  integrationBlueprintVersions,
} from "../../../drizzle/schema";
import type {
  BlueprintDefinition,
  BlueprintDraftInput,
} from "./types";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db;
}

function nowMs(): number {
  return Date.now();
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function defaultExtractionConfig() {
  return { formatHint: "auto" as const, maxRecords: 1000 };
}

function defaultSinkConfig() {
  return { kind: "ingested_records" as const, target: "entity", autoVerify: false };
}

function defaultSourceConfig() {
  return { kind: "http_any" as const, method: "GET" as const };
}

/** Build a new Blueprint DB row from partial draft input. */
function draftToDbRow(
  draft: BlueprintDraftInput,
  owner: { userId: number | null; organizationId: number | null; ownershipTier: BlueprintDefinition["ownershipTier"] },
  now: number,
): {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  ownerId: number | null;
  organizationId: number | null;
  ownershipTier: BlueprintDefinition["ownershipTier"];
  visibility: BlueprintDefinition["visibility"];
  status: BlueprintDefinition["status"];
  sourceKind: string;
  sourceConfig: unknown;
  authConfig: unknown | null;
  extractionConfig: unknown;
  transformSteps: unknown;
  validationRules: unknown | null;
  sinkConfig: unknown;
  scheduleCron: string | null;
  rateLimitPerMin: number;
  maxRecordsPerRun: number;
  currentVersion: number;
  aiDrafted: boolean;
  aiDraftedBy: string | null;
  tags: unknown;
  totalRuns: number;
  totalRecordsIngested: number;
  createdBy: number | null;
  createdAt: number;
  updatedAt: number;
} {
  const id = randomUUID();
  const name = draft.name?.trim() || "Untitled Blueprint";
  return {
    id,
    slug: slugify(name) || `bp-${id.slice(0, 8)}`,
    name,
    description: draft.description ?? null,
    ownerId: owner.userId,
    organizationId: owner.organizationId,
    ownershipTier: owner.ownershipTier,
    visibility: draft.visibility ?? "private",
    status: "draft",
    sourceKind: draft.sourceKind ?? "http_any",
    sourceConfig: draft.sourceConfig ?? defaultSourceConfig(),
    authConfig: draft.authConfig ?? null,
    extractionConfig: draft.extractionConfig ?? defaultExtractionConfig(),
    transformSteps: draft.transformSteps ?? [],
    validationRules: draft.validationRules ?? null,
    sinkConfig: draft.sinkConfig ?? defaultSinkConfig(),
    scheduleCron: draft.scheduleCron ?? null,
    rateLimitPerMin: draft.rateLimitPerMin ?? 60,
    maxRecordsPerRun: draft.maxRecordsPerRun ?? 10000,
    currentVersion: 1,
    aiDrafted: false,
    aiDraftedBy: null,
    tags: draft.tags ?? [],
    totalRuns: 0,
    totalRecordsIngested: 0,
    createdBy: owner.userId,
    createdAt: now,
    updatedAt: now,
  };
}

/** Convert a DB row into the typed BlueprintDefinition the rest of the app uses. */
export function rowToBlueprint(row: Record<string, unknown>): BlueprintDefinition {
  const asObj = <T>(v: unknown, fallback: T): T => (v && typeof v === "object" ? (v as T) : fallback);
  const asArray = <T>(v: unknown, fallback: T[]): T[] => (Array.isArray(v) ? (v as T[]) : fallback);
  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    description: (row.description ?? null) as string | null,
    ownerId: (row.ownerId as number | null) ?? null,
    organizationId: (row.organizationId as number | null) ?? null,
    ownershipTier: (row.ownershipTier as BlueprintDefinition["ownershipTier"]) ?? "professional",
    visibility: (row.visibility as BlueprintDefinition["visibility"]) ?? "private",
    status: (row.status as BlueprintDefinition["status"]) ?? "draft",
    sourceKind: (row.sourceKind as BlueprintDefinition["sourceKind"]) ?? "http_any",
    sourceConfig: asObj(row.sourceConfig, defaultSourceConfig()) as BlueprintDefinition["sourceConfig"],
    authConfig: (row.authConfig ?? null) as BlueprintDefinition["authConfig"],
    extractionConfig: asObj(
      row.extractionConfig,
      defaultExtractionConfig(),
    ) as BlueprintDefinition["extractionConfig"],
    transformSteps: asArray(row.transformSteps, []) as BlueprintDefinition["transformSteps"],
    validationRules: (row.validationRules ?? null) as BlueprintDefinition["validationRules"],
    sinkConfig: asObj(row.sinkConfig, defaultSinkConfig()) as BlueprintDefinition["sinkConfig"],
    scheduleCron: (row.scheduleCron as string | null) ?? null,
    rateLimitPerMin: (row.rateLimitPerMin as number | null) ?? 60,
    maxRecordsPerRun: (row.maxRecordsPerRun as number | null) ?? 10000,
    currentVersion: (row.currentVersion as number) ?? 1,
    aiDrafted: Boolean(row.aiDrafted),
    aiDraftedBy: (row.aiDraftedBy as string | null) ?? null,
    tags: asArray(row.tags, []) as string[],
    lastRunAt: (row.lastRunAt as number | null) ?? null,
    lastRunStatus: (row.lastRunStatus as string | null) ?? null,
    lastRunError: (row.lastRunError as string | null) ?? null,
    totalRuns: (row.totalRuns as number) ?? 0,
    totalRecordsIngested: (row.totalRecordsIngested as number) ?? 0,
    createdBy: (row.createdBy as number | null) ?? null,
    createdAt: (row.createdAt as number) ?? 0,
    updatedAt: (row.updatedAt as number) ?? 0,
  };
}

/** Create a new draft blueprint + the initial version snapshot. */
export async function createBlueprint(
  draft: BlueprintDraftInput,
  owner: { userId: number | null; organizationId: number | null; ownershipTier: BlueprintDefinition["ownershipTier"] },
  options?: { aiDrafted?: boolean; aiDraftedBy?: string | null },
): Promise<BlueprintDefinition> {
  const db = await requireDb();
  const now = nowMs();
  const row = draftToDbRow(draft, owner, now);
  if (options?.aiDrafted) {
    row.aiDrafted = true;
    row.aiDraftedBy = options.aiDraftedBy ?? "contextualLLM";
  }

  await db.insert(integrationBlueprints).values(row as never);

  // Snapshot v1 so rollbacks always have a target.
  await db.insert(integrationBlueprintVersions).values({
    id: randomUUID(),
    blueprintId: row.id,
    version: 1,
    snapshotJson: sanitizeSnapshot(row),
    changeNote: "initial draft",
    createdBy: owner.userId,
    createdAt: now,
  } as never);

  const [created] = await db
    .select()
    .from(integrationBlueprints)
    .where(eq(integrationBlueprints.id, row.id));
  return rowToBlueprint(created as unknown as Record<string, unknown>);
}

/** Update a blueprint, bumping currentVersion and snapshotting the new state. */
export async function updateBlueprint(
  blueprintId: string,
  patch: BlueprintDraftInput & {
    status?: BlueprintDefinition["status"];
    name?: string;
    description?: string | null;
  },
  caller: { userId: number; role: string },
  changeNote?: string,
): Promise<BlueprintDefinition> {
  const db = await requireDb();
  const [existing] = await db
    .select()
    .from(integrationBlueprints)
    .where(eq(integrationBlueprints.id, blueprintId));
  if (!existing) throw new Error("Blueprint not found");
  assertCanEdit(existing as unknown as Record<string, unknown>, caller);

  const now = nowMs();
  const merged: Record<string, unknown> = {
    ...(existing as Record<string, unknown>),
    updatedAt: now,
  };
  if (patch.name !== undefined) {
    merged.name = patch.name;
    merged.slug = slugify(patch.name) || (existing as unknown as { slug: string }).slug;
  }
  if (patch.description !== undefined) merged.description = patch.description;
  if (patch.sourceKind !== undefined) merged.sourceKind = patch.sourceKind;
  if (patch.sourceConfig !== undefined) merged.sourceConfig = patch.sourceConfig;
  if (patch.authConfig !== undefined) merged.authConfig = patch.authConfig;
  if (patch.extractionConfig !== undefined) merged.extractionConfig = patch.extractionConfig;
  if (patch.transformSteps !== undefined) merged.transformSteps = patch.transformSteps;
  if (patch.validationRules !== undefined) merged.validationRules = patch.validationRules;
  if (patch.sinkConfig !== undefined) merged.sinkConfig = patch.sinkConfig;
  if (patch.scheduleCron !== undefined) merged.scheduleCron = patch.scheduleCron;
  if (patch.rateLimitPerMin !== undefined) merged.rateLimitPerMin = patch.rateLimitPerMin;
  if (patch.maxRecordsPerRun !== undefined) merged.maxRecordsPerRun = patch.maxRecordsPerRun;
  if (patch.visibility !== undefined) merged.visibility = patch.visibility;
  if (patch.tags !== undefined) merged.tags = patch.tags;
  if (patch.status !== undefined) merged.status = patch.status;

  const nextVersion = ((existing as unknown as { currentVersion?: number }).currentVersion ?? 1) + 1;
  merged.currentVersion = nextVersion;

  await db
    .update(integrationBlueprints)
    .set({
      name: merged.name as string,
      slug: merged.slug as string,
      description: (merged.description ?? null) as string | null,
      sourceKind: merged.sourceKind as string,
      sourceConfig: merged.sourceConfig as unknown,
      authConfig: (merged.authConfig ?? null) as unknown,
      extractionConfig: merged.extractionConfig as unknown,
      transformSteps: merged.transformSteps as unknown,
      validationRules: (merged.validationRules ?? null) as unknown,
      sinkConfig: merged.sinkConfig as unknown,
      scheduleCron: (merged.scheduleCron ?? null) as string | null,
      rateLimitPerMin: merged.rateLimitPerMin as number,
      maxRecordsPerRun: merged.maxRecordsPerRun as number,
      visibility: merged.visibility as string,
      tags: merged.tags as unknown,
      status: merged.status as string,
      currentVersion: nextVersion,
      updatedAt: now,
    } as never)
    .where(eq(integrationBlueprints.id, blueprintId));

  await db.insert(integrationBlueprintVersions).values({
    id: randomUUID(),
    blueprintId,
    version: nextVersion,
    snapshotJson: sanitizeSnapshot(merged),
    changeNote: changeNote ?? "update",
    createdBy: caller.userId,
    createdAt: now,
  } as never);

  const [reloaded] = await db
    .select()
    .from(integrationBlueprints)
    .where(eq(integrationBlueprints.id, blueprintId));
  return rowToBlueprint(reloaded as unknown as Record<string, unknown>);
}

/** Soft-delete by setting status=archived. Hard delete is admin-only. */
export async function archiveBlueprint(
  blueprintId: string,
  caller: { userId: number; role: string },
): Promise<void> {
  const db = await requireDb();
  const [existing] = await db
    .select()
    .from(integrationBlueprints)
    .where(eq(integrationBlueprints.id, blueprintId));
  if (!existing) throw new Error("Blueprint not found");
  assertCanEdit(existing as unknown as Record<string, unknown>, caller);
  await db
    .update(integrationBlueprints)
    .set({ status: "archived", updatedAt: nowMs() } as never)
    .where(eq(integrationBlueprints.id, blueprintId));
}

export async function hardDeleteBlueprint(
  blueprintId: string,
  caller: { userId: number; role: string },
): Promise<void> {
  if (caller.role !== "admin") throw new Error("Only admins can hard-delete blueprints");
  const db = await requireDb();
  await db.delete(integrationBlueprintVersions).where(eq(integrationBlueprintVersions.blueprintId, blueprintId));
  await db.delete(integrationBlueprints).where(eq(integrationBlueprints.id, blueprintId));
}

/** Fetch one blueprint, gated by visibility. */
export async function getBlueprint(
  blueprintId: string,
  caller: { userId: number; role: string },
): Promise<BlueprintDefinition | null> {
  const db = await requireDb();
  const [row] = await db
    .select()
    .from(integrationBlueprints)
    .where(eq(integrationBlueprints.id, blueprintId));
  if (!row) return null;
  const blueprint = rowToBlueprint(row as unknown as Record<string, unknown>);
  if (!canView(blueprint, caller)) return null;
  return blueprint;
}

/** List blueprints visible to the caller. */
export async function listBlueprints(caller: {
  userId: number;
  role: string;
  organizationId?: number | null;
}): Promise<BlueprintDefinition[]> {
  const db = await requireDb();
  let rows: unknown[];
  if (caller.role === "admin") {
    rows = await db.select().from(integrationBlueprints).orderBy(desc(integrationBlueprints.updatedAt));
  } else {
    rows = await db
      .select()
      .from(integrationBlueprints)
      .where(
        or(
          eq(integrationBlueprints.ownerId, caller.userId),
          eq(integrationBlueprints.visibility, "public"),
        )!,
      )
      .orderBy(desc(integrationBlueprints.updatedAt));
  }
  return rows.map((r) => rowToBlueprint(r as Record<string, unknown>));
}

/** Fetch version history. */
export async function listVersions(
  blueprintId: string,
  caller: { userId: number; role: string },
): Promise<Array<{ version: number; createdAt: number; changeNote: string | null; createdBy: number | null }>> {
  const bp = await getBlueprint(blueprintId, caller);
  if (!bp) return [];
  const db = await requireDb();
  const rows = await db
    .select()
    .from(integrationBlueprintVersions)
    .where(eq(integrationBlueprintVersions.blueprintId, blueprintId))
    .orderBy(desc(integrationBlueprintVersions.version));
  return rows.map((r: any) => ({
    version: r.version,
    createdAt: r.createdAt,
    changeNote: r.changeNote ?? null,
    createdBy: r.createdBy ?? null,
  }));
}

/** Return the snapshot JSON for a specific version (for rollback preview). */
export async function getVersionSnapshot(
  blueprintId: string,
  version: number,
  caller: { userId: number; role: string },
): Promise<Record<string, unknown> | null> {
  const bp = await getBlueprint(blueprintId, caller);
  if (!bp) return null;
  const db = await requireDb();
  const [row] = await db
    .select()
    .from(integrationBlueprintVersions)
    .where(
      and(
        eq(integrationBlueprintVersions.blueprintId, blueprintId),
        eq(integrationBlueprintVersions.version, version),
      ),
    );
  return (row as unknown as { snapshotJson: Record<string, unknown> } | undefined)?.snapshotJson ?? null;
}

/** Revert to a prior version — replays the snapshot as a new current version. */
export async function revertToVersion(
  blueprintId: string,
  version: number,
  caller: { userId: number; role: string },
): Promise<BlueprintDefinition> {
  const snapshot = await getVersionSnapshot(blueprintId, version, caller);
  if (!snapshot) throw new Error("Version snapshot not found");
  return updateBlueprint(
    blueprintId,
    {
      name: snapshot.name as string | undefined,
      description: (snapshot.description ?? null) as string | null,
      sourceKind: snapshot.sourceKind as BlueprintDefinition["sourceKind"] | undefined,
      sourceConfig: snapshot.sourceConfig as BlueprintDefinition["sourceConfig"] | undefined,
      authConfig: snapshot.authConfig as BlueprintDefinition["authConfig"] | undefined,
      extractionConfig: snapshot.extractionConfig as BlueprintDefinition["extractionConfig"] | undefined,
      transformSteps: snapshot.transformSteps as BlueprintDefinition["transformSteps"] | undefined,
      validationRules: snapshot.validationRules as BlueprintDefinition["validationRules"] | undefined,
      sinkConfig: snapshot.sinkConfig as BlueprintDefinition["sinkConfig"] | undefined,
      scheduleCron: (snapshot.scheduleCron ?? null) as string | null,
      rateLimitPerMin: snapshot.rateLimitPerMin as number | undefined,
      maxRecordsPerRun: snapshot.maxRecordsPerRun as number | undefined,
      visibility: snapshot.visibility as BlueprintDefinition["visibility"] | undefined,
      tags: (snapshot.tags ?? []) as string[],
    },
    caller,
    `revert to version ${version}`,
  );
}

/** Record run stats on the blueprint row. */
export async function recordRunStats(
  blueprintId: string,
  args: {
    status: "success" | "partial" | "failed";
    recordsWritten: number;
    error?: string | null;
  },
): Promise<void> {
  const db = await requireDb();
  const [row] = await db
    .select()
    .from(integrationBlueprints)
    .where(eq(integrationBlueprints.id, blueprintId));
  if (!row) return;
  const current = row as unknown as { totalRuns?: number; totalRecordsIngested?: number };
  await db
    .update(integrationBlueprints)
    .set({
      lastRunAt: nowMs(),
      lastRunStatus: args.status,
      lastRunError: args.error ?? null,
      totalRuns: (current.totalRuns ?? 0) + 1,
      totalRecordsIngested:
        (current.totalRecordsIngested ?? 0) + Math.max(0, args.recordsWritten),
      updatedAt: nowMs(),
    } as never)
    .where(eq(integrationBlueprints.id, blueprintId));
}

// ─── Permission helpers ────────────────────────────────────────────────────

function canView(bp: BlueprintDefinition, caller: { userId: number; role: string }): boolean {
  if (caller.role === "admin") return true;
  if (bp.visibility === "public") return true;
  if (bp.ownerId === caller.userId) return true;
  return false;
}

export function assertCanEdit(row: Record<string, unknown>, caller: { userId: number; role: string }): void {
  if (caller.role === "admin") return;
  if ((row.ownerId as number | null) === caller.userId) return;
  throw new Error("Insufficient permissions to edit this blueprint");
}

/** Strip transient fields before snapshotting (keeps snapshots stable and small). */
function sanitizeSnapshot(row: Record<string, unknown>): Record<string, unknown> {
  const {
    lastRunAt, lastRunStatus, lastRunError,
    totalRuns, totalRecordsIngested,
    createdAt, updatedAt, ...rest
  } = row;
  return rest;
}

// Expose the slugify + default helpers for tests/other modules that need them
export const _internals = { slugify, defaultExtractionConfig, defaultSinkConfig, defaultSourceConfig };
