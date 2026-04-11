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
import { eq, and } from "drizzle-orm";
import {
  ingestedRecords,
  learningDefinitions,
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
      result.warnings.push("lead_captures sink: not yet implemented — records passed through");
      return result;
    case "user_memories":
      result.warnings.push("user_memories sink: not yet implemented — records passed through");
      return result;
    case "proactive_insights":
      result.warnings.push("proactive_insights sink: not yet implemented — records passed through");
      return result;
    default:
      result.warnings.push(`unknown sink kind "${(sink as { kind?: string }).kind}"`);
      return result;
  }
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
