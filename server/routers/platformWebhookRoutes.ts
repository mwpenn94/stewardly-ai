/**
 * Platform Webhook Routes
 * Registers Express-level webhook endpoints for all CRM/marketing platforms.
 * GHL already has its own route in ghlWebhook.ts; this file covers:
 *   - Dripify (LinkedIn automation)
 *   - SMS-iT (SMS/MMS marketing)
 *   - Workable (recruitment/hiring)
 *   - LinkedIn / Sales Navigator (direct webhooks)
 *
 * All routes accept raw JSON body and forward to platform-specific handlers.
 */
import type { Express, Request, Response } from "express";
import { logger } from "../_core/logger";
import { handleDripifyWebhook } from "./dripifyWebhook";
import { handleSMSiTWebhook } from "./smsitWebhook";
import { handleWorkableWebhook } from "./workableWebhook";
import { handleLinkedInWebhook } from "./linkedinWebhook";
import { getDb, getRawPool } from "../db";
import { integrationSyncLogs } from "../../drizzle/schema";
import { randomUUID } from "crypto";

/**
 * Helper: extract raw body from Express request
 */
function extractRawBody(req: Request): string {
  if (typeof req.body === "string") return req.body;
  if (req.body && typeof req.body === "object") return JSON.stringify(req.body);
  return "";
}

/**
 * Helper: log sync event to integration_sync_logs
 */
async function logSyncEvent(
  providerSlug: string,
  connectionId: string | null,
  direction: "inbound" | "outbound" | "bidirectional",
  status: "success" | "partial" | "failed",
  recordsCreated: number,
  recordsUpdated: number,
  recordsFailed: number,
  details?: Record<string, unknown>,
) {
  try {
    const db = await getDb();
    if (!db || !connectionId) return;
    await db.insert(integrationSyncLogs).values({
      id: randomUUID(),
      connectionId,
      syncType: "webhook",
      direction,
      startedAt: new Date(),
      completedAt: new Date(),
      status,
      recordsCreated,
      recordsUpdated,
      recordsFailed,
      triggeredBy: "webhook",
      errorDetails: details ? (details as any) : null,
    });
  } catch (err) {
    logger.warn({ err, providerSlug }, "Failed to log sync event");
  }
}

/**
 * Helper: find connectionId for a provider slug
 */
async function findConnectionId(providerSlug: string): Promise<string | null> {
  try {
    const rawPool = await getRawPool();
    if (!rawPool) return null;
    const [rows] = await rawPool.query(
      "SELECT ic.id FROM integration_connections ic JOIN integration_providers ip ON ic.provider_id = ip.id WHERE ip.slug = ? AND ic.status = 'connected' LIMIT 1",
      [providerSlug]
    ) as any;
    return rows.length > 0 ? rows[0].id : null;
  } catch {
    return null;
  }
}

export function registerPlatformWebhookRoutes(app: Express) {
  // ─── Dripify Webhook ─────────────────────────────────────────────────
  app.post("/api/webhooks/dripify", async (req: Request, res: Response) => {
    const rawBody = extractRawBody(req);
    if (!rawBody) { res.status(400).json({ error: "Empty body" }); return; }

    const headers: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      headers[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;
    }

    const connectionId = await findConnectionId("dripify");
    const result = await handleDripifyWebhook(rawBody, headers);

    // Log sync event
    if (result.status === 200) {
      await logSyncEvent("dripify", connectionId, "inbound", "success", 1, 0, 0, { eventId: result.body.eventId });
    }

    res.status(result.status).json(result.body);
  });

  // ─── SMS-iT Webhook ──────────────────────────────────────────────────
  app.post("/api/webhooks/smsit", async (req: Request, res: Response) => {
    const rawBody = extractRawBody(req);
    if (!rawBody) { res.status(400).json({ error: "Empty body" }); return; }

    const headers: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      headers[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;
    }

    const connectionId = await findConnectionId("smsit");
    const result = await handleSMSiTWebhook(rawBody, headers, connectionId || undefined);

    if (result.status === 200) {
      await logSyncEvent("smsit", connectionId, "inbound", "success", 1, 0, 0, { eventId: result.body.eventId });
    }

    res.status(result.status).json(result.body);
  });

  // ─── Workable Webhook ────────────────────────────────────────────────
  app.post("/api/webhooks/workable", async (req: Request, res: Response) => {
    const rawBody = extractRawBody(req);
    if (!rawBody) { res.status(400).json({ error: "Empty body" }); return; }

    const headers: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      headers[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;
    }

    const connectionId = await findConnectionId("workable");
    const result = await handleWorkableWebhook(rawBody, headers, connectionId || undefined);

    if (result.status === 200) {
      await logSyncEvent("workable", connectionId, "inbound", "success", 1, 0, 0, { eventId: result.body.eventId });
    }

    res.status(result.status).json(result.body);
  });

  // ─── LinkedIn / Sales Navigator Webhook ──────────────────────────────
  app.post("/api/webhooks/linkedin", async (req: Request, res: Response) => {
    const rawBody = extractRawBody(req);
    if (!rawBody) { res.status(400).json({ error: "Empty body" }); return; }

    const headers: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      headers[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;
    }

    const connectionId = await findConnectionId("linkedin");
    const result = await handleLinkedInWebhook(rawBody, headers, connectionId || undefined);

    if (result.status === 200) {
      await logSyncEvent("linkedin", connectionId, "inbound", "success", 1, 0, 0, { eventId: result.body.eventId });
    }

    res.status(result.status).json(result.body);
  });

  // ─── Health check for all platform webhooks ──────────────────────────
  app.get("/api/webhooks/platforms/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      platforms: ["gohighlevel", "dripify", "smsit", "workable", "linkedin"],
      timestamp: Date.now(),
    });
  });

  logger.info("[PlatformWebhooks] Registered routes: /api/webhooks/{dripify,smsit,workable,linkedin}");
}
