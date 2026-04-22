/**
 * Dripify Webhook Router
 * Receives LinkedIn automation events from Dripify and ingests them as lead activities.
 * Uses dripifyWebhookEvents + leadPipeline tables from actual schema.
 * Express route registered in platformWebhookRoutes.ts
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { logger } from "../_core/logger";
import { getDb, getRawPool } from "../db";
import { eq, sql } from "drizzle-orm";
import {
  dripifyWebhookEvents,
} from "../../drizzle/schema";
import crypto from "crypto";

const DRIPIFY_EVENT_TYPES = [
  "lead.connected",
  "lead.replied",
  "lead.profile_viewed",
  "lead.message_sent",
  "lead.endorsed",
  "lead.followed",
  "campaign.completed",
  "campaign.paused",
  "campaign.error",
] as const;

function verifyDripifySignature(
  payload: string,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export const dripifyWebhookRouter = router({
  /** List recent Dripify webhook events */
  recentEvents: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select()
        .from(dripifyWebhookEvents)
        .orderBy(sql`${dripifyWebhookEvents.receivedAt} DESC`)
        .limit(input.limit);
      return rows;
    }),
});

/** Express handler for incoming Dripify webhooks */
export async function handleDripifyWebhook(
  rawBody: string,
  headers: Record<string, string | undefined>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const db = await getDb();
  if (!db) return { status: 503, body: { error: "Database unavailable" } };

  try {
    // Security: verify webhook signature before processing
    const dripifySecret = process.env.DRIPIFY_WEBHOOK_SECRET || "";
    const signature = headers["x-dripify-signature"] || headers["x-hook-signature"];
    const signatureValid = dripifySecret
      ? verifyDripifySignature(rawBody, signature, dripifySecret)
      : true;

    if (dripifySecret && !signatureValid) {
      logger.warn("Dripify webhook rejected: invalid signature");
      return { status: 401, body: { error: "Invalid signature" } };
    }
    if (!dripifySecret) {
      logger.warn("DRIPIFY_WEBHOOK_SECRET not set — signature verification skipped");
    }

    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const eventType = (payload.event || payload.type || "unknown") as string;

    // Log the event
    const [inserted] = await db.insert(dripifyWebhookEvents).values({
      eventType,
      payload: payload as any,
      processed: false,
    }).$returningId();

    // Process lead events — upsert into lead_pipeline via raw SQL (actual DB columns)
    if (eventType.startsWith("lead.")) {
      const lead = (payload.lead || payload.data || payload) as Record<string, unknown>;
      const email = ((lead.email || "") as string).toLowerCase().trim();
      const firstName = (lead.firstName || lead.first_name || "") as string;
      const lastName = (lead.lastName || lead.last_name || "") as string;
      const dripifyLeadId = (lead.id || lead.leadId || "") as string;

      let leadPipelineId: number | null = null;

      if (email) {
        const rawPool = await getRawPool();
        if (rawPool) {
          const [rows] = await rawPool.query(
            "SELECT id FROM lead_pipeline WHERE email = ? LIMIT 1",
            [email]
          ) as any;

          if (rows.length > 0) {
            leadPipelineId = rows[0].id;
            await rawPool.query(
              "UPDATE lead_pipeline SET updated_at = ? WHERE id = ?",
              [Date.now(), leadPipelineId]
            );
          } else {
            // Create new lead from Dripify data
            const [result] = await rawPool.query(
              "INSERT INTO lead_pipeline (firstName, lastName, email, source, status, crmExternalId, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
              [firstName || null, lastName || null, email, "dripify", "new", dripifyLeadId || null, Date.now(), Date.now()]
            ) as any;
            leadPipelineId = result.insertId;
          }
        }
      }

      // Link webhook event to lead pipeline
      await db.update(dripifyWebhookEvents)
        .set({ leadPipelineId, processed: true, processedAt: new Date() })
        .where(eq(dripifyWebhookEvents.id, inserted.id));
    }

    logger.info({ eventType, id: inserted.id }, "Dripify webhook processed");
    return { status: 200, body: { received: true, eventId: inserted.id } };
  } catch (err) {
    logger.error({ err }, "Dripify webhook processing failed");
    return { status: 500, body: { error: "Processing failed" } };
  }
}
