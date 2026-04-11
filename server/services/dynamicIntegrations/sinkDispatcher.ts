/**
 * Dynamic Integration — Sink Dispatcher
 *
 * Writes validated records into the appropriate sink table. Every sink is
 * best-effort — a sink failure does not take down the whole pipeline, it just
 * increments the errored counter and leaves a warning on the run row.
 *
 * Supported sinks:
 *   - ingested_records (default): generic entity/metric/news/etc. rows
 *   - learning_definitions: financial terminology (dedup by slug)
 *   - lead_captures: lead-pipeline-adjacent rows (skipped if table missing)
 *   - user_memories: push into per-user memory store for chat retrieval
 *   - proactive_insights: create insights flagged for display
 *   - none: dry-run / preview only
 *
 * Every sink is idempotent where possible — we dedup by entity_id / slug so
 * repeated runs of the same blueprint don't double-ingest.
 */

import { getDb } from "../../db";
import crypto from "crypto";
import { eq, and } from "drizzle-orm";
import {
  ingestedRecords,
  learningDefinitions,
  leadPipeline,
  userMemories,
  proactiveInsights,
} from "../../../drizzle/schema";
import { getByPath } from "./transformEngine";
import type { BlueprintDefinition } from "./types";

export interface SinkWriteResult {
  written: number;
  skipped: number;
  errored: number;
  warnings: string[];
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db;
}

function nowMs(): number {
  return Date.now();
}

function resolveField(record: Record<string, unknown>, fieldMap: Record<string, string> | undefined, canonical: string): unknown {
  const mapped = fieldMap?.[canonical];
  if (mapped) {
    const v = getByPath(record, mapped);
    if (v !== undefined) return v;
  }
  return getByPath(record, canonical);
}

function asString(v: unknown, fallback = ""): string {
  if (v === null || v === undefined) return fallback;
  if (typeof v === "string") return v;
  try {
    return String(v);
  } catch {
    return fallback;
  }
}

/**
 * Dispatch records to the configured sink. If dryRun is true, just count —
 * do not hit any DB table.
 */
export async function dispatchToSink(
  blueprint: BlueprintDefinition,
  records: Record<string, unknown>[],
  options: { dryRun: boolean; triggeredBy?: number | null; jobId?: number | null },
): Promise<SinkWriteResult> {
  const sink = blueprint.sinkConfig;
  const result: SinkWriteResult = { written: 0, skipped: 0, errored: 0, warnings: [] };

  if (options.dryRun || sink.kind === "none") {
    result.written = records.length;
    return result;
  }

  switch (sink.kind) {
    case "ingested_records":
      return writeIngestedRecords(blueprint, records, options);
    case "learning_definitions":
      return writeLearningDefinitions(blueprint, records);
    case "lead_captures":
      return writeLeadPipeline(blueprint, records);
    case "user_memories":
      return writeUserMemories(blueprint, records, options);
    case "proactive_insights":
      return writeProactiveInsights(blueprint, records, options);
    default:
      result.warnings.push(`unknown sink kind "${(sink as { kind?: string }).kind}"`);
      return result;
  }
}

// ─── hash helper for emailHash / phoneHash ──────────────────────────────
function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input.trim().toLowerCase()).digest("hex");
}

async function writeLeadPipeline(
  blueprint: BlueprintDefinition,
  records: Record<string, unknown>[],
): Promise<SinkWriteResult> {
  const result: SinkWriteResult = { written: 0, skipped: 0, errored: 0, warnings: [] };
  const db = await requireDb();
  const sink = blueprint.sinkConfig;
  const targetSegment = sink.target || "dynamic_blueprint";
  for (const record of records) {
    try {
      const rawEmail = asString(
        resolveField(record, sink.fieldMap, "email") ??
          resolveField(record, sink.fieldMap, "email_address") ??
          "",
      );
      if (!rawEmail || !rawEmail.includes("@")) {
        result.skipped++;
        continue;
      }
      const emailHash = sha256Hex(rawEmail);
      // Dedup on emailHash
      const existing = await db
        .select()
        .from(leadPipeline)
        .where(eq(leadPipeline.emailHash, emailHash))
        .limit(1);
      if (existing.length > 0) {
        result.skipped++;
        continue;
      }
      const rawPhone = asString(
        resolveField(record, sink.fieldMap, "phone") ??
          resolveField(record, sink.fieldMap, "phone_number") ??
          "",
      );
      const phoneHash = rawPhone ? sha256Hex(rawPhone) : null;
      const firstName = asString(
        resolveField(record, sink.fieldMap, "first_name") ??
          resolveField(record, sink.fieldMap, "firstName") ??
          resolveField(record, sink.fieldMap, "name") ??
          "",
      ).slice(0, 100);
      const lastName = asString(
        resolveField(record, sink.fieldMap, "last_name") ??
          resolveField(record, sink.fieldMap, "lastName") ??
          "",
      ).slice(0, 100);
      const linkedinUrl = asString(
        resolveField(record, sink.fieldMap, "linkedin_url") ??
          resolveField(record, sink.fieldMap, "linkedin") ??
          "",
      ).slice(0, 500);
      const company = asString(
        resolveField(record, sink.fieldMap, "company") ??
          resolveField(record, sink.fieldMap, "organization") ??
          "",
      ).slice(0, 200);
      const title = asString(
        resolveField(record, sink.fieldMap, "title") ??
          resolveField(record, sink.fieldMap, "job_title") ??
          "",
      ).slice(0, 200);
      const city = asString(resolveField(record, sink.fieldMap, "city") ?? "").slice(0, 100);
      const state = asString(resolveField(record, sink.fieldMap, "state") ?? "").slice(0, 50);
      const zip = asString(resolveField(record, sink.fieldMap, "zip") ?? resolveField(record, sink.fieldMap, "postal_code") ?? "").slice(0, 20);

      await db.insert(leadPipeline).values({
        leadSourceId: null,
        firstName: firstName || null,
        lastName: lastName || null,
        emailHash,
        phoneHash,
        linkedinUrl: linkedinUrl || null,
        company: company || null,
        title: title || null,
        city: city || null,
        state: state || null,
        zip: zip || null,
        targetSegment,
        segmentData: { blueprintId: blueprint.id, blueprintSlug: blueprint.slug } as unknown,
        enrichmentData: record as unknown,
        status: "new" as never,
      } as never);
      result.written++;
    } catch (e: unknown) {
      result.errored++;
      result.warnings.push(`lead_pipeline insert failed: ${(e as Error).message}`);
    }
  }
  return result;
}

async function writeUserMemories(
  blueprint: BlueprintDefinition,
  records: Record<string, unknown>[],
  options: { triggeredBy?: number | null; jobId?: number | null },
): Promise<SinkWriteResult> {
  const result: SinkWriteResult = { written: 0, skipped: 0, errored: 0, warnings: [] };
  const db = await requireDb();
  const sink = blueprint.sinkConfig;
  const userId = options.triggeredBy ?? blueprint.createdBy ?? blueprint.ownerId;
  if (!userId) {
    result.warnings.push("user_memories sink: no userId available on blueprint or trigger");
    return result;
  }
  const category = (sink.target || "fact") as "fact" | "preference" | "episodic" | "amp_engagement" | "ho_domain_trajectory";
  for (const record of records) {
    try {
      const content = asString(
        resolveField(record, sink.fieldMap, "content") ??
          resolveField(record, sink.fieldMap, "text") ??
          resolveField(record, sink.fieldMap, "summary") ??
          JSON.stringify(record),
      ).slice(0, 4000);
      if (!content) {
        result.skipped++;
        continue;
      }
      await db.insert(userMemories).values({
        userId,
        category: category as never,
        content,
        confidence: "0.80",
        source: `blueprint:${blueprint.slug}`,
        sessionId: null,
      } as never);
      result.written++;
    } catch (e: unknown) {
      result.errored++;
      result.warnings.push(`user_memories insert failed: ${(e as Error).message}`);
    }
  }
  return result;
}

async function writeProactiveInsights(
  blueprint: BlueprintDefinition,
  records: Record<string, unknown>[],
  options: { triggeredBy?: number | null; jobId?: number | null },
): Promise<SinkWriteResult> {
  const result: SinkWriteResult = { written: 0, skipped: 0, errored: 0, warnings: [] };
  const db = await requireDb();
  const sink = blueprint.sinkConfig;
  const userId = options.triggeredBy ?? blueprint.createdBy ?? blueprint.ownerId;
  if (!userId) {
    result.warnings.push("proactive_insights sink: no userId available on blueprint or trigger");
    return result;
  }
  const category = (sink.target || "engagement") as
    | "compliance" | "portfolio" | "tax" | "engagement" | "spending" | "life_event";
  for (const record of records) {
    try {
      const title = asString(
        resolveField(record, sink.fieldMap, "title") ??
          resolveField(record, sink.fieldMap, "name") ??
          resolveField(record, sink.fieldMap, "headline") ??
          "",
      ).slice(0, 255);
      const description = asString(
        resolveField(record, sink.fieldMap, "description") ??
          resolveField(record, sink.fieldMap, "summary") ??
          resolveField(record, sink.fieldMap, "content") ??
          "",
      ).slice(0, 4000);
      const suggestedAction = asString(
        resolveField(record, sink.fieldMap, "suggested_action") ??
          resolveField(record, sink.fieldMap, "action") ??
          "",
      ).slice(0, 4000);
      const priorityRaw = asString(
        resolveField(record, sink.fieldMap, "priority") ?? "",
      ).toLowerCase();
      const priority = ["low", "medium", "high", "critical"].includes(priorityRaw) ? priorityRaw : "medium";
      if (!title) {
        result.skipped++;
        continue;
      }
      await db.insert(proactiveInsights).values({
        userId,
        organizationId: null,
        clientId: null,
        category: category as never,
        priority: priority as never,
        title,
        description: description || null,
        suggestedAction: suggestedAction || null,
        status: "new" as never,
        metadata: { blueprintId: blueprint.id, blueprintSlug: blueprint.slug, record } as unknown,
      } as never);
      result.written++;
    } catch (e: unknown) {
      result.errored++;
      result.warnings.push(`proactive_insights insert failed: ${(e as Error).message}`);
    }
  }
  return result;
}

async function writeIngestedRecords(
  blueprint: BlueprintDefinition,
  records: Record<string, unknown>[],
  _options: { triggeredBy?: number | null; jobId?: number | null },
): Promise<SinkWriteResult> {
  const result: SinkWriteResult = { written: 0, skipped: 0, errored: 0, warnings: [] };
  const db = await requireDb();
  const sink = blueprint.sinkConfig;
  const recordType = (sink.target || "entity") as
    | "customer_profile" | "organization" | "product" | "market_price"
    | "regulatory_update" | "news_article" | "competitor_intel"
    | "document_extract" | "entity" | "metric";
  const tags = [...(sink.tags ?? []), `blueprint:${blueprint.slug}`];
  // We don't have a `dataSourceId` row for dynamic blueprints — use a synthetic one if present.
  const dataSourceId = 0;

  for (const record of records) {
    try {
      const entityId = asString(
        resolveField(record, sink.fieldMap, "id") ??
          resolveField(record, sink.fieldMap, "entity_id") ??
          resolveField(record, sink.fieldMap, "uuid") ??
          resolveField(record, sink.fieldMap, "slug") ??
          `${blueprint.slug}-${nowMs()}-${result.written}`,
      );
      const title = asString(
        resolveField(record, sink.fieldMap, "title") ??
          resolveField(record, sink.fieldMap, "name") ??
          resolveField(record, sink.fieldMap, "headline") ??
          entityId,
      ).slice(0, 499);
      const summary = asString(
        resolveField(record, sink.fieldMap, "summary") ??
          resolveField(record, sink.fieldMap, "description") ??
          resolveField(record, sink.fieldMap, "content") ??
          "",
      ).slice(0, 4000);

      // Dedup: look for an existing row with the same entityId + recordType.
      const existing = await db
        .select()
        .from(ingestedRecords)
        .where(and(eq(ingestedRecords.entityId, entityId), eq(ingestedRecords.recordType, recordType as never)))
        .limit(1);

      if (existing.length > 0) {
        // Update: only bump freshness + merge structured data.
        await db
          .update(ingestedRecords)
          .set({
            title,
            contentSummary: summary,
            structuredData: record as unknown,
            freshnessAt: nowMs(),
            tags: tags as unknown,
            updatedAt: nowMs(),
          } as never)
          .where(eq(ingestedRecords.id, existing[0].id));
        result.skipped++;
      } else {
        await db.insert(ingestedRecords).values({
          dataSourceId,
          ingestionJobId: null,
          recordType: recordType as never,
          entityId,
          title,
          contentSummary: summary,
          structuredData: record as unknown,
          confidenceScore: "0.85",
          freshnessAt: nowMs(),
          tags: tags as unknown,
          isVerified: !!sink.autoVerify,
          verifiedBy: null,
          createdAt: nowMs(),
          updatedAt: nowMs(),
        } as never);
        result.written++;
      }
    } catch (e: unknown) {
      result.errored++;
      result.warnings.push(`ingested_records insert failed: ${(e as Error).message}`);
    }
  }
  return result;
}

async function writeLearningDefinitions(
  blueprint: BlueprintDefinition,
  records: Record<string, unknown>[],
): Promise<SinkWriteResult> {
  const result: SinkWriteResult = { written: 0, skipped: 0, errored: 0, warnings: [] };
  const db = await requireDb();
  const sink = blueprint.sinkConfig;
  const tags = [...(sink.tags ?? []), `blueprint:${blueprint.slug}`];

  for (const record of records) {
    try {
      const term = asString(
        resolveField(record, sink.fieldMap, "term") ??
          resolveField(record, sink.fieldMap, "name") ??
          resolveField(record, sink.fieldMap, "title") ??
          "",
      ).slice(0, 500);
      const definition = asString(
        resolveField(record, sink.fieldMap, "definition") ??
          resolveField(record, sink.fieldMap, "description") ??
          resolveField(record, sink.fieldMap, "content") ??
          "",
      ).slice(0, 4000);
      if (!term || !definition) {
        result.skipped++;
        continue;
      }

      // Dedup on term alone — the schema has no slug column and no composite
      // unique key, so we match the first existing row with the same term
      // and update-in-place instead of double-inserting.
      const existing = await db
        .select()
        .from(learningDefinitions)
        .where(eq(learningDefinitions.term, term))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(learningDefinitions)
          .set({
            definition,
            sourceRef: blueprint.sourceConfig.url ?? `blueprint:${blueprint.slug}`,
            tags: tags as unknown,
          } as never)
          .where(eq(learningDefinitions.id, existing[0].id));
        result.skipped++;
      } else {
        await db.insert(learningDefinitions).values({
          disciplineId: null,
          term,
          definition,
          createdBy: null,
          visibility: "public" as never,
          status: "published" as never,
          version: 1,
          sourceRef: blueprint.sourceConfig.url ?? `blueprint:${blueprint.slug}`,
          tags: tags as unknown,
        } as never);
        result.written++;
      }
    } catch (e: unknown) {
      result.errored++;
      result.warnings.push(`learning_definitions insert failed: ${(e as Error).message}`);
    }
  }
  return result;
}
