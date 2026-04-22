/**
 * SMS-iT Webhook Router
 * Receives SMS/MMS events from SMS-iT and ingests them as lead activities.
 * Uses smsitSyncLog + integrationWebhookEvents from actual schema.
 * Express route registered in platformWebhookRoutes.ts
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { logger } from "../_core/logger";
import { getDb, getRawPool } from "../db";
import { eq, sql } from "drizzle-orm";
import {
  integrationWebhookEvents,
  smsitSyncLog,
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
    // Security: verify webhook signature before processing
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

    // Process contact events — upsert into lead_pipeline + smsitSyncLog
    if (eventType.startsWith("contact.")) {
      const contact = (payload.contact || payload.data || payload) as Record<string, unknown>;
      const smsitContactId = (contact.id || contact.contactId || "") as string;
      const email = ((contact.email || "") as string).toLowerCase().trim();
      const phone = (contact.phone || contact.mobile || "") as string;
      const firstName = (contact.firstName || contact.first_name || "") as string;
      const lastName = (contact.lastName || contact.last_name || "") as string;

      let leadPipelineId: number | null = null;

      // Upsert into lead_pipeline via raw SQL (actual DB columns)
      if (email || phone) {
        const rawPool = await getRawPool();
        if (rawPool) {
          // Try to find existing lead by email or phone
          let matchQuery = "SELECT id FROM lead_pipeline WHERE ";
          const matchParams: any[] = [];
          if (email) {
            matchQuery += "email = ?";
            matchParams.push(email);
          } else {
            matchQuery += "phone = ?";
            matchParams.push(phone);
          }
          matchQuery += " LIMIT 1";

          const [rows] = await rawPool.query(matchQuery, matchParams) as any;

          if (rows.length > 0) {
            leadPipelineId = rows[0].id;
            // Update existing lead
            const updateFields: string[] = [];
            const updateParams: any[] = [];
            if (firstName) { updateFields.push("firstName = ?"); updateParams.push(firstName); }
            if (lastName) { updateFields.push("lastName = ?"); updateParams.push(lastName); }
            if (phone) { updateFields.push("phone = ?"); updateParams.push(phone); }
            updateFields.push("updated_at = ?"); updateParams.push(Date.now());
            updateParams.push(leadPipelineId);
            await rawPool.query(
              `UPDATE lead_pipeline SET ${updateFields.join(", ")} WHERE id = ?`,
              updateParams
            );
          } else if (eventType !== "contact.opted_out") {
            // Create new lead (don't create for opt-outs)
            const [result] = await rawPool.query(
              "INSERT INTO lead_pipeline (firstName, lastName, email, phone, source, status, crmExternalId, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
              [firstName || null, lastName || null, email || null, phone || null, "smsit", "new", smsitContactId || null, Date.now(), Date.now()]
            ) as any;
            leadPipelineId = result.insertId;
          }
        }
      }

      // Log sync event
      if (smsitContactId) {
        await db.insert(smsitSyncLog).values({
          syncDirection: "inbound",
          smsitContactId,
          leadPipelineId,
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
