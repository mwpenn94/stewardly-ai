/**
 * GHL monitoring + DLQ + reconciliation — Phase 3E (Part 2).
 *
 * This module provides:
 *  - DLQ retry loop with exponential backoff (baseMs 1s, cap 16s, 5 retries)
 *  - Reconciliation: compare Stewardly-side run counts to GHL contact counts
 *  - Monitoring stats: sync status, failure rate, field mapping health
 *  - Alert threshold: flag when failure rate > 5%
 *
 * All three features are exposed as tRPC-friendly queries so the admin
 * dashboard (Phase 7B) can render them without needing its own DB layer.
 */

import { getDb } from "../../db";
import {
  integrationWebhookEvents,
  integrationConnections,
  integrationSyncLogs,
  integrationFieldMappings,
} from "../../../drizzle/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { computeNextRetry, MAX_DLQ_RETRIES } from "./inboundWebhook";
import { REQUIRED_FIELDS } from "./fieldProvisioning";
import { logger } from "../../_core/logger";

// ─── DLQ ──────────────────────────────────────────────────────────────────

export interface DLQEntry {
  eventId: string;
  connectionId: string;
  eventType: string;
  attempt: number;
  nextRetryAt: Date;
  lastError: string | null;
}

/**
 * Return failed webhook events that are eligible for a retry. Callers
 * invoke this on a cron (every minute in prod) and re-process each
 * entry with `processInboundWebhook`.
 */
export async function getRetryableEvents(): Promise<DLQEntry[]> {
  const db = await getDb();
  if (!db) return [];

  const now = new Date();
  const rows = await db
    .select()
    .from(integrationWebhookEvents)
    .where(
      and(
        eq(integrationWebhookEvents.providerSlug, "ghl"),
        eq(integrationWebhookEvents.processingStatus, "failed"),
      ),
    )
    .limit(100);

  const entries: DLQEntry[] = [];
  for (const row of rows) {
    // Attempt counter is stored in the processingError string as
    // "attempt=<n>|...". Parse defensively.
    const m = (row.processingError ?? "").match(/attempt=(\d+)/);
    const attempt = m ? Number(m[1]) : 0;
    if (attempt >= MAX_DLQ_RETRIES) continue;
    const delay = computeNextRetry(attempt);
    const nextRetryAt = new Date(
      (row.receivedAt?.getTime() ?? Date.now()) + delay,
    );
    if (nextRetryAt > now) continue;
    entries.push({
      eventId: row.id,
      connectionId: row.connectionId,
      eventType: row.eventType,
      attempt,
      nextRetryAt,
      lastError: row.processingError,
    });
  }
  return entries;
}

/**
 * Mark an event as retried by bumping the attempt counter. If the
 * retry succeeds, the caller sets `processingStatus` to `processed`
 * via `processInboundWebhook`. If it fails again, we rewrite the
 * error with the incremented attempt so the next cron pass picks it
 * up after the next backoff window.
 */
export async function markRetryAttempted(
  eventId: string,
  previousAttempt: number,
  newError: string,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const attempt = previousAttempt + 1;
  await db
    .update(integrationWebhookEvents)
    .set({
      processingError: `attempt=${attempt}|${newError.slice(0, 200)}`,
      processingStatus: attempt >= MAX_DLQ_RETRIES ? "failed" : "pending",
    })
    .where(eq(integrationWebhookEvents.id, eventId));
}

// ─── Monitoring stats ─────────────────────────────────────────────────────

export interface ConnectionHealth {
  connectionId: string;
  providerSlug: string;
  status: string;
  lastSyncAt: Date | null;
  lastSyncStatus: string | null;
  totalEvents24h: number;
  failedEvents24h: number;
  failureRatePct: number;
  unmappedFieldCount: number;
  failureRateOverThreshold: boolean;
}

export const FAILURE_RATE_ALERT_THRESHOLD = 0.05;

export async function getConnectionHealth(
  connectionId: string,
): Promise<ConnectionHealth | null> {
  const db = await getDb();
  if (!db) return null;
  const conn = await db
    .select()
    .from(integrationConnections)
    .where(eq(integrationConnections.id, connectionId))
    .limit(1);
  if (!conn[0]) return null;

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const totalRows = await db
    .select({ c: sql<number>`count(*)` })
    .from(integrationWebhookEvents)
    .where(
      and(
        eq(integrationWebhookEvents.connectionId, connectionId),
        gte(integrationWebhookEvents.receivedAt, twentyFourHoursAgo),
      ),
    );
  const failedRows = await db
    .select({ c: sql<number>`count(*)` })
    .from(integrationWebhookEvents)
    .where(
      and(
        eq(integrationWebhookEvents.connectionId, connectionId),
        eq(integrationWebhookEvents.processingStatus, "failed"),
        gte(integrationWebhookEvents.receivedAt, twentyFourHoursAgo),
      ),
    );

  const total = Number(totalRows[0]?.c ?? 0);
  const failed = Number(failedRows[0]?.c ?? 0);
  const failureRate = total > 0 ? failed / total : 0;

  const mappedRows = await db
    .select({ externalField: integrationFieldMappings.externalField })
    .from(integrationFieldMappings)
    .where(
      and(
        eq(integrationFieldMappings.connectionId, connectionId),
        eq(integrationFieldMappings.isActive, true),
      ),
    );
  const mappedSet = new Set(mappedRows.map((r) => r.externalField));
  const unmappedFieldCount = REQUIRED_FIELDS.filter(
    (f) => !mappedSet.has(f.slug),
  ).length;

  return {
    connectionId,
    providerSlug: "ghl",
    status: conn[0].status ?? "unknown",
    lastSyncAt: conn[0].lastSyncAt ?? null,
    lastSyncStatus: conn[0].lastSyncStatus ?? null,
    totalEvents24h: total,
    failedEvents24h: failed,
    failureRatePct: Math.round(failureRate * 10000) / 100,
    unmappedFieldCount,
    failureRateOverThreshold: failureRate > FAILURE_RATE_ALERT_THRESHOLD,
  };
}

// ─── Reconciliation ───────────────────────────────────────────────────────
// Runs daily. Compares Stewardly's run count to GHL's contact count for
// this connection and writes an entry to integrationSyncLogs.

export interface ReconciliationResult {
  connectionId: string;
  stewardlyCount: number;
  ghlCount: number;
  delta: number;
  reconciledAt: Date;
  status: "aligned" | "drift_minor" | "drift_major";
}

export function classifyDrift(
  stewardly: number,
  ghl: number,
): ReconciliationResult["status"] {
  const delta = Math.abs(stewardly - ghl);
  const base = Math.max(stewardly, ghl, 1);
  const pct = delta / base;
  if (pct < 0.01) return "aligned";
  if (pct < 0.05) return "drift_minor";
  return "drift_major";
}

export async function logReconciliation(
  connectionId: string,
  stewardlyCount: number,
  ghlCount: number,
): Promise<ReconciliationResult> {
  const db = await getDb();
  const status = classifyDrift(stewardlyCount, ghlCount);
  const result: ReconciliationResult = {
    connectionId,
    stewardlyCount,
    ghlCount,
    delta: stewardlyCount - ghlCount,
    reconciledAt: new Date(),
    status,
  };
  if (!db) return result;

  await db.insert(integrationSyncLogs).values({
    id: crypto.randomUUID(),
    connectionId,
    syncType: "on_demand",
    direction: "bidirectional",
    startedAt: result.reconciledAt,
    completedAt: result.reconciledAt,
    status: status === "aligned" ? "success" : "partial",
    recordsCreated: 0,
    recordsUpdated: 0,
    recordsFailed: status === "drift_major" ? Math.abs(result.delta) : 0,
    errorDetails:
      status === "aligned"
        ? null
        : { stewardlyCount, ghlCount, pct: result.delta / Math.max(stewardlyCount, 1) },
    triggeredBy: "schedule",
  });

  if (status === "drift_major") {
    logger.warn(
      { connectionId, stewardlyCount, ghlCount, delta: result.delta },
      "GHL reconciliation detected major drift",
    );
  }

  return result;
}

// Node's crypto module has randomUUID at top-level; import is declared
// lazily inside the function to avoid pulling a second import statement.
import crypto from "crypto";
