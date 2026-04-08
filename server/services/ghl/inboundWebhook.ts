/**
 * GHL inbound webhook handler — Phase 3E.
 *
 * Receives contact updates, tag changes, and appointment events from
 * GHL and translates them into Stewardly-side state updates.
 *
 * Responsibilities:
 *  - HMAC signature verification with 5-minute replay protection (done
 *    in ghlClient.verifyWebhookSignature).
 *  - Conflict resolution: last-write-wins using `calculatorLastRunDate`
 *    as the authoritative field.
 *  - DLQ: failed events write to `integration_webhook_events` with
 *    status=failed so `dlq.ts` can pick them up with exponential backoff.
 *  - Raw event audit log for every received webhook, regardless of
 *    processing success.
 *
 * The existing ghlWebhookRouter in server/routers/ghlWebhook.ts already
 * provides the Express-level entry point. This module exposes the
 * business logic the router calls into.
 */

import { getDb } from "../../db";
import {
  integrationWebhookEvents,
  integrationConnections,
} from "../../../drizzle/schema";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { verifyWebhookSignature } from "./ghlClient";
import { logger } from "../../_core/logger";

export type InboundEventType =
  | "contact.create"
  | "contact.update"
  | "contact.delete"
  | "contact.tag.create"
  | "contact.tag.delete"
  | "contact.note.create"
  | "opportunity.create"
  | "opportunity.update"
  | "opportunity.status_change"
  | "appointment.create"
  | "appointment.update";

export interface InboundWebhookContext {
  connectionId: string;
  rawBody: string;
  parsedBody: {
    type?: string;
    locationId?: string;
    contactId?: string;
    calculatorLastRunDate?: string;
    [k: string]: unknown;
  };
  signature?: string;
  timestamp?: string;
}

export interface ProcessResult {
  status: number;
  eventId?: string;
  action: "accepted" | "rejected" | "queued" | "stale";
  reason?: string;
}

/**
 * Process an inbound webhook from GHL. Called by the Express handler
 * in server/routers/ghlWebhook.ts (existing) or by any transport-layer
 * code that parses and forwards webhooks here.
 */
export async function processInboundWebhook(
  ctx: InboundWebhookContext,
): Promise<ProcessResult> {
  const db = await getDb();
  if (!db) return { status: 503, action: "rejected", reason: "db_unavailable" };

  // Load the connection so we know which HMAC secret to verify against.
  const connRows = await db
    .select()
    .from(integrationConnections)
    .where(eq(integrationConnections.id, ctx.connectionId))
    .limit(1);
  const conn = connRows[0];
  if (!conn) {
    return { status: 404, action: "rejected", reason: "unknown_connection" };
  }

  // Pull the HMAC secret from configJson.
  const cfg = (conn.configJson as Record<string, unknown> | null) ?? {};
  const secret = typeof cfg.webhookSecret === "string" ? cfg.webhookSecret : "";

  // Always write an audit row first (even for invalid signatures) so
  // the monitoring dashboard can track failure rate.
  const signatureCheck = secret
    ? verifyWebhookSignature(ctx.rawBody, ctx.signature, secret, ctx.timestamp)
    : { valid: false, reason: "no_secret_configured" as const };

  const eventId = randomUUID();
  await db.insert(integrationWebhookEvents).values({
    id: eventId,
    connectionId: ctx.connectionId,
    providerSlug: "ghl",
    eventType: String(ctx.parsedBody.type ?? "unknown"),
    payloadJson: ctx.parsedBody,
    signatureValid: signatureCheck.valid,
    processingStatus: signatureCheck.valid ? "pending" : "failed",
    processingError: signatureCheck.valid ? null : signatureCheck.reason ?? null,
  });

  if (!signatureCheck.valid) {
    return {
      status: 401,
      eventId,
      action: "rejected",
      reason: `signature_invalid:${signatureCheck.reason ?? "unknown"}`,
    };
  }

  // Conflict resolution: if the caller sent a stale calculatorLastRunDate
  // (older than what Stewardly currently has for this contact), we accept
  // the event for audit but mark it as stale so it doesn't overwrite.
  const incomingTs = ctx.parsedBody.calculatorLastRunDate
    ? Date.parse(ctx.parsedBody.calculatorLastRunDate)
    : NaN;
  if (Number.isFinite(incomingTs)) {
    const latestKnown = await getLastKnownRunDate(ctx.parsedBody.contactId);
    if (latestKnown && latestKnown.getTime() > incomingTs) {
      await db
        .update(integrationWebhookEvents)
        .set({
          processingStatus: "skipped",
          processingError: "stale_last_write_wins",
          processedAt: new Date(),
        })
        .where(eq(integrationWebhookEvents.id, eventId));
      return { status: 200, eventId, action: "stale", reason: "older_than_known" };
    }
  }

  // Happy path: mark as processed. Domain-specific downstream handlers
  // (tag sync, appointment sync, etc.) can subscribe off of
  // integration_webhook_events in future phases; for Phase 3E we just
  // acknowledge the webhook so the HMAC-valid audit row is durable.
  await db
    .update(integrationWebhookEvents)
    .set({
      processingStatus: "processed",
      processedAt: new Date(),
    })
    .where(eq(integrationWebhookEvents.id, eventId));

  return { status: 200, eventId, action: "accepted" };
}

// ─── Helper: look up the last-known calculatorLastRunDate for a contact
// In Phase 3 this is a stub. Phase 7 will wire in the real contact
// mapping once plaidProduction + user → GHL contact linking land.
async function getLastKnownRunDate(
  _contactId: string | undefined,
): Promise<Date | null> {
  return null;
}

// ─── Retry helper ──────────────────────────────────────────────────────────
// Pure retry calculator — used by dlq.ts for exponential backoff.
export function computeNextRetry(
  attempt: number,
  baseMs = 1000,
  maxMs = 16_000,
): number {
  const delay = Math.min(baseMs * Math.pow(2, attempt), maxMs);
  return delay;
}

export const MAX_DLQ_RETRIES = 5;
