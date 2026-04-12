/**
 * GoHighLevel (GHL) Webhook Router
 * Receives contact/opportunity events from GHL CRM and ingests them into the platform.
 * Uses integrationWebhookEvents + leadPipeline tables from actual schema.
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { logger } from "../_core/logger";
import { getDb } from "../db";
import { eq, sql } from "drizzle-orm";
import {
  integrationWebhookEvents,
  leadPipeline,
} from "../../drizzle/schema";
import { nanoid } from "nanoid";
import crypto from "crypto";

const GHL_EVENT_TYPES = [
  "contact.create", "contact.update", "contact.delete",
  "contact.tag.create", "contact.tag.delete", "contact.note.create",
  "opportunity.create", "opportunity.update", "opportunity.status_change",
  "appointment.create", "appointment.update",
] as const;

function verifyGHLSignature(payload: string, signature: string | undefined, secret: string): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export const ghlWebhookRouter = router({
  /** List recent GHL webhook events */
  recentEvents: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select()
        .from(integrationWebhookEvents)
        .where(eq(integrationWebhookEvents.providerSlug, "ghl"))
        .orderBy(sql`${integrationWebhookEvents.receivedAt} DESC`)
        .limit(input.limit);
      return rows;
    }),
});

/** Express handler for incoming GHL webhooks */
export async function handleGHLWebhook(
  rawBody: string,
  headers: Record<string, string | undefined>,
  connectionId?: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const db = await getDb();
  if (!db) return { status: 503, body: { error: "Database unavailable" } };

  const eventId = nanoid();

  try {
    // CBL17 security hardening: verify webhook signature before processing
    const ghlSecret = process.env.GHL_WEBHOOK_SECRET || "";
    const signature = headers["x-ghl-signature"] || headers["x-hook-signature"];
    const signatureValid = ghlSecret
      ? verifyGHLSignature(rawBody, signature, ghlSecret)
      : true; // no secret configured = skip verification (log warning)

    if (ghlSecret && !signatureValid) {
      logger.warn({ eventId }, "GHL webhook rejected: invalid signature");
      return { status: 401, body: { error: "Invalid signature" } };
    }
    if (!ghlSecret) {
      logger.warn({ eventId }, "GHL_WEBHOOK_SECRET not set — signature verification skipped");
    }

    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const eventType = (payload.event || payload.type || "unknown") as string;

    // Log the event
    await db.insert(integrationWebhookEvents).values({
      id: eventId,
      connectionId: connectionId || "default-ghl",
      providerSlug: "ghl",
      eventType,
      payloadJson: payload as any,
      signatureValid,
      processingStatus: "pending",
    });

    // Process contact events → match to leadPipeline
    if (eventType.startsWith("contact.")) {
      const contact = (payload.contact || payload) as Record<string, unknown>;
      const email = (contact.email || "") as string;
      const ghlContactId = (contact.id || contact.contactId || "") as string;

      if (email) {
        const emailHash = crypto.createHash("sha256").update(email.toLowerCase().trim()).digest("hex");
        const [existing] = await db.select().from(leadPipeline).where(eq(leadPipeline.emailHash, emailHash)).limit(1);

        if (existing && ghlContactId) {
          await db.update(leadPipeline)
            .set({ ghlContactId })
            .where(eq(leadPipeline.id, existing.id));
        }
      }
    }

    // Mark processed
    await db.update(integrationWebhookEvents)
      .set({ processingStatus: "processed", processedAt: new Date() })
      .where(eq(integrationWebhookEvents.id, eventId));

    logger.info({ eventId, eventType }, "GHL webhook processed");
    return { status: 200, body: { received: true, eventId } };
  } catch (err) {
    logger.error({ eventId, err }, "GHL webhook processing failed");
    await db.update(integrationWebhookEvents)
      .set({ processingStatus: "failed", processingError: err instanceof Error ? err.message : "Unknown error" })
      .where(eq(integrationWebhookEvents.id, eventId))
      .catch(() => {});
    return { status: 500, body: { error: "Processing failed" } };
  }
}
