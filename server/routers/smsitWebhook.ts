/**
 * SMS-iT Webhook Router
 * Receives SMS/MMS events from SMS-iT and ingests them as lead activities.
 * Uses smsitSyncLog + integrationWebhookEvents from actual schema.
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { logger } from "../_core/logger";
import { getDb } from "../db";
import { eq, sql } from "drizzle-orm";
import {
  integrationWebhookEvents,
  smsitSyncLog,
  leadPipeline,
} from "../../drizzle/schema";
import { nanoid } from "nanoid";
import crypto from "crypto";

const SMSIT_EVENT_TYPES = [
  "message.received", "message.sent", "message.delivered", "message.failed",
  "contact.created", "contact.updated", "contact.opted_out",
  "campaign.sent", "campaign.completed", "campaign.failed",
] as const;

export const smsitWebhookRouter = router({
  /** List recent SMS-iT webhook events */
  recentEvents: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select()
        .from(integrationWebhookEvents)
        .where(eq(integrationWebhookEvents.providerSlug, "smsit"))
        .orderBy(sql`${integrationWebhookEvents.receivedAt} DESC`)
        .limit(input.limit);
      return rows;
    }),

  /** Get SMS-iT sync log */
  syncLog: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select()
        .from(smsitSyncLog)
        .orderBy(sql`${smsitSyncLog.syncedAt} DESC`)
        .limit(input.limit);
      return rows;
    }),
});

/** Express handler for incoming SMS-iT webhooks */
export async function handleSMSiTWebhook(
  rawBody: string,
  headers: Record<string, string | undefined>,
  connectionId?: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const db = await getDb();
  if (!db) return { status: 503, body: { error: "Database unavailable" } };

  const eventId = nanoid();

  try {
    // CBL17 security hardening: verify webhook signature before processing
    const smsitSecret = process.env.SMSIT_WEBHOOK_SECRET || "";
    const signature = headers["x-smsit-signature"] || headers["x-hook-signature"];
    let signatureValid = true;
    if (smsitSecret) {
      if (!signature) {
        signatureValid = false;
      } else {
        const expected = crypto.createHmac("sha256", smsitSecret).update(rawBody).digest("hex");
        try {
          signatureValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
        } catch {
          signatureValid = false;
        }
      }
      if (!signatureValid) {
        logger.warn({ eventId }, "SMS-iT webhook rejected: invalid signature");
        return { status: 401, body: { error: "Invalid signature" } };
      }
    } else {
      logger.warn({ eventId }, "SMSIT_WEBHOOK_SECRET not set — signature verification skipped");
    }

    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const eventType = (payload.event || payload.type || "unknown") as string;

    // Log the event
    await db.insert(integrationWebhookEvents).values({
      id: eventId,
      connectionId: connectionId || "default-smsit",
      providerSlug: "smsit",
      eventType,
      payloadJson: payload as any,
      signatureValid,
      processingStatus: "pending",
    });

    // Process contact events
    if (eventType.startsWith("contact.")) {
      const contact = (payload.contact || payload.data || payload) as Record<string, unknown>;
      const smsitContactId = (contact.id || contact.contactId || "") as string;

      if (smsitContactId) {
        // Log sync event
        await db.insert(smsitSyncLog).values({
          syncDirection: "inbound",
          smsitContactId,
          syncType: eventType === "contact.opted_out" ? "opt_out" : eventType === "contact.created" ? "create" : "update",
          fieldsSynced: contact as any,
          status: "success",
        });
      }
    }

    // Mark processed
    await db.update(integrationWebhookEvents)
      .set({ processingStatus: "processed", processedAt: new Date() })
      .where(eq(integrationWebhookEvents.id, eventId));

    logger.info({ eventId, eventType }, "SMS-iT webhook processed");
    return { status: 200, body: { received: true, eventId } };
  } catch (err) {
    logger.error({ eventId, err }, "SMS-iT webhook processing failed");
    await db.update(integrationWebhookEvents)
      .set({ processingStatus: "failed", processingError: err instanceof Error ? err.message : "Unknown error" })
      .where(eq(integrationWebhookEvents.id, eventId))
      .catch(() => {});
    return { status: 500, body: { error: "Processing failed" } };
  }
}
