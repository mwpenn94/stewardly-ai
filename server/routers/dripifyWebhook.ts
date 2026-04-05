/**
 * Dripify Webhook Router
 * Receives LinkedIn automation events from Dripify and ingests them as lead activities.
 * Uses dripifyWebhookEvents + leadPipeline tables from actual schema.
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { logger } from "../_core/logger";
import { getDb } from "../db";
import { eq, sql } from "drizzle-orm";
import {
  dripifyWebhookEvents,
  leadPipeline,
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
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const eventType = (payload.event || payload.type || "unknown") as string;

    // Log the event
    const [inserted] = await db.insert(dripifyWebhookEvents).values({
      eventType,
      payload: payload as any,
      processed: false,
    }).$returningId();

    // Process lead events
    if (eventType.startsWith("lead.")) {
      const lead = (payload.lead || payload.data || payload) as Record<string, unknown>;
      const email = (lead.email || "") as string;
      const linkedinUrl = (lead.profileUrl || lead.linkedin_url || "") as string;

      if (email || linkedinUrl) {
        // Try to match to existing lead
        if (email) {
          const emailHash = crypto.createHash("sha256").update(email.toLowerCase().trim()).digest("hex");
          const [existing] = await db.select().from(leadPipeline).where(eq(leadPipeline.emailHash, emailHash)).limit(1);

          if (existing) {
            // Update the webhook event with lead pipeline ID
            await db.update(dripifyWebhookEvents)
              .set({ leadPipelineId: existing.id, processed: true })
              .where(eq(dripifyWebhookEvents.id, inserted.id));
          }
        }
      }

      // Mark processed
      await db.update(dripifyWebhookEvents)
        .set({ processed: true, processedAt: new Date() })
        .where(eq(dripifyWebhookEvents.id, inserted.id));
    }

    logger.info({ eventType, id: inserted.id }, "Dripify webhook processed");
    return { status: 200, body: { received: true, eventId: inserted.id } };
  } catch (err) {
    logger.error({ err }, "Dripify webhook processing failed");
    return { status: 500, body: { error: "Processing failed" } };
  }
}
