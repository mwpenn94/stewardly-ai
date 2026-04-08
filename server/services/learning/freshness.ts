/**
 * EMBA Learning — content freshness + regulatory pipeline (Task 3).
 *
 * This module is the single source of truth for:
 *   - content version tracking (checksums + change logs)
 *   - regulatory feed ingestion from FINRA, NASAA, CFP Board, IRS, NAIC
 *   - admin review workflow for applying regulatory updates
 *
 * The live feed fetching is deliberately NOT wired to external HTTP
 * — that belongs in a scheduled cron + fetch wrapper that respects
 * rate limits and requires per-source credentials. Here we expose
 * the storage + merge helpers that the cron layer will drive.
 */

import crypto from "crypto";
import { getDb } from "../../db";
import {
  learningContentVersions,
  learningRegulatoryUpdates,
} from "../../../drizzle/schema";
import { and, eq, desc } from "drizzle-orm";
import { logger } from "../../_core/logger";

const log = logger.child({ module: "learning/freshness" });

// ─── Regulatory sources catalog ──────────────────────────────────────────

export interface RegulatorySource {
  name: string;
  url: string;
  affects: string[];
}

export const REGULATORY_SOURCES: RegulatorySource[] = [
  { name: "FINRA", url: "https://www.finra.org/rules-guidance/notices", affects: ["sie", "series7", "series66"] },
  { name: "NASAA", url: "https://www.nasaa.org/policy/model-rules/", affects: ["series66"] },
  { name: "CFP_Board", url: "https://www.cfp.net/ethics/compliance", affects: ["cfp"] },
  { name: "IRS", url: "https://www.irs.gov/newsroom", affects: ["cfp", "financial_planning", "estate_planning"] },
  { name: "NAIC", url: "https://content.naic.org/model-laws", affects: ["life_health", "general_insurance", "p_and_c", "surplus_lines"] },
  { name: "State_DOI", url: "https://content.naic.org/state-insurance-departments", affects: ["life_health", "general_insurance", "p_and_c", "surplus_lines"] },
];

// ─── Pure helpers ────────────────────────────────────────────────────────

export function computeChecksum(data: string | Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex").slice(0, 32);
}

export function diffChecksums(oldSum: string | null, newSum: string): { changed: boolean; reason: string } {
  if (!oldSum) return { changed: true, reason: "first-seed" };
  if (oldSum !== newSum) return { changed: true, reason: "checksum-mismatch" };
  return { changed: false, reason: "unchanged" };
}

// ─── Content version tracking ────────────────────────────────────────────

export async function getContentVersion(
  contentSource: string,
  contentKey: string,
): Promise<{ version: number; checksum: string | null; lastUpdated: Date } | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const [row] = await db
      .select()
      .from(learningContentVersions)
      .where(
        and(
          eq(learningContentVersions.contentSource, contentSource),
          eq(learningContentVersions.contentKey, contentKey),
        ),
      )
      .orderBy(desc(learningContentVersions.version))
      .limit(1);
    if (!row) return null;
    return {
      version: row.version,
      checksum: row.checksum ?? null,
      lastUpdated: row.lastUpdated as any,
    };
  } catch (err) {
    log.warn({ err: String(err) }, "getContentVersion failed");
    return null;
  }
}

export async function recordContentVersion(data: {
  contentSource: string;
  contentKey: string;
  checksum: string;
  updateSource?: string;
  changelog?: string;
}): Promise<{ version: number } | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const prior = await getContentVersion(data.contentSource, data.contentKey);
    const nextVersion = (prior?.version ?? 0) + 1;
    await db.insert(learningContentVersions).values({
      contentSource: data.contentSource,
      contentKey: data.contentKey,
      version: nextVersion,
      checksum: data.checksum,
      updateSource: data.updateSource ?? "manual",
      changelog: data.changelog ?? null,
    });
    return { version: nextVersion };
  } catch (err) {
    log.warn({ err: String(err) }, "recordContentVersion failed");
    return null;
  }
}

// ─── Regulatory updates (ingestion + review workflow) ───────────────────

export interface RegulatoryUpdateInput {
  source: string;
  category: string;
  title: string;
  summary: string;
  effectiveDate?: Date;
  affectedLicenses: string[];
  affectedContent?: string[];
}

export async function recordRegulatoryUpdate(input: RegulatoryUpdateInput): Promise<{ id: number } | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const [row] = await db.insert(learningRegulatoryUpdates).values({
      source: input.source,
      category: input.category,
      title: input.title,
      summary: input.summary,
      effectiveDate: input.effectiveDate ? (input.effectiveDate.toISOString().slice(0, 10) as any) : null,
      affectedLicenses: input.affectedLicenses,
      affectedContent: input.affectedContent ?? [],
    });
    return { id: row.insertId };
  } catch (err) {
    log.warn({ err: String(err) }, "recordRegulatoryUpdate failed");
    return null;
  }
}

export async function listPendingRegulatoryUpdates(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db
      .select()
      .from(learningRegulatoryUpdates)
      .where(eq(learningRegulatoryUpdates.status, "new"))
      .orderBy(desc(learningRegulatoryUpdates.createdAt))
      .limit(limit);
  } catch (err) {
    log.warn({ err: String(err) }, "listPendingRegulatoryUpdates failed");
    return [];
  }
}

export async function reviewRegulatoryUpdate(
  id: number,
  reviewedBy: number,
  decision: "reviewed" | "applied" | "dismissed",
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    await db
      .update(learningRegulatoryUpdates)
      .set({ status: decision, reviewedBy } as any)
      .where(eq(learningRegulatoryUpdates.id, id));
    return true;
  } catch (err) {
    log.warn({ err: String(err) }, "reviewRegulatoryUpdate failed");
    return false;
  }
}

// ─── Pipeline orchestration ──────────────────────────────────────────────

export async function onContentSourceUpdated(
  source: string,
  key: string,
  rawContent: string | Buffer,
  changelog?: string,
): Promise<{ changed: boolean; version: number | null; reason: string }> {
  const newChecksum = computeChecksum(rawContent);
  const prior = await getContentVersion(source, key);
  const diff = diffChecksums(prior?.checksum ?? null, newChecksum);
  if (!diff.changed) {
    return { changed: false, version: prior?.version ?? 0, reason: diff.reason };
  }
  const rec = await recordContentVersion({
    contentSource: source,
    contentKey: key,
    checksum: newChecksum,
    updateSource: "pipeline",
    changelog,
  });
  return { changed: true, version: rec?.version ?? null, reason: diff.reason };
}
