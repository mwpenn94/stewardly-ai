/**
 * LinkedIn / Sales Navigator Webhook Handler
 * Receives events from LinkedIn integrations (via partner API or third-party connectors).
 *
 * LinkedIn doesn't have native webhooks for most actions, but this handler supports:
 *   - Events from LinkedIn partner integrations
 *   - Events forwarded from Dripify/PhantomBuster/other LinkedIn automation tools
 *   - Manual webhook forwarding from n8n/Zapier
 *
 * Events:
 *   - lead.connected, lead.messaged, lead.profile_viewed
 *   - connection.accepted, connection.requested
 *   - inmail.sent, inmail.replied
 */
import { logger } from "../_core/logger";
import { getDb, getRawPool } from "../db";
import { eq } from "drizzle-orm";
import { integrationWebhookEvents } from "../../drizzle/schema";
import { nanoid } from "nanoid";
import crypto from "crypto";

function verifyLinkedInSignature(
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

/** Express handler for incoming LinkedIn webhooks */
export async function handleLinkedInWebhook(
  rawBody: string,
  headers: Record<string, string | undefined>,
  connectionId?: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const db = await getDb();
  if (!db) return { status: 503, body: { error: "Database unavailable" } };

  const eventId = nanoid();

  try {
    // Security: verify webhook signature
    const linkedinSecret = process.env.LINKEDIN_WEBHOOK_SECRET || "";
    const signature = headers["x-linkedin-signature"] || headers["x-hook-signature"];
    let signatureValid = true;

    if (linkedinSecret) {
      signatureValid = verifyLinkedInSignature(rawBody, signature, linkedinSecret);
      if (!signatureValid) {
        logger.warn({ eventId }, "LinkedIn webhook rejected: invalid signature");
        return { status: 401, body: { error: "Invalid signature" } };
      }
    } else {
      logger.warn({ eventId }, "LINKEDIN_WEBHOOK_SECRET not set — signature verification skipped");
    }

    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const eventType = (payload.event || payload.type || "unknown") as string;

    // Log the event
    await db.insert(integrationWebhookEvents).values({
      id: eventId,
      connectionId: connectionId || "default-linkedin",
      providerSlug: "linkedin",
      eventType,
      payloadJson: payload as any,
      signatureValid,
      processingStatus: "pending",
    });

    // Process lead/connection events — upsert into lead_pipeline
    const isLeadEvent = eventType.startsWith("lead.") || eventType.startsWith("connection.") || eventType.startsWith("inmail.");
    if (isLeadEvent) {
      const lead = (payload.lead || payload.connection || payload.profile || payload.data || payload) as Record<string, unknown>;
      const email = ((lead.email || lead.emailAddress || "") as string).toLowerCase().trim();
      const firstName = (lead.firstName || lead.first_name || "") as string;
      const lastName = (lead.lastName || lead.last_name || "") as string;
      const linkedinUrl = (lead.profileUrl || lead.linkedin_url || lead.publicProfileUrl || "") as string;
      const linkedinId = (lead.id || lead.linkedinId || lead.memberId || "") as string;

      if (email || linkedinUrl) {
        const rawPool = await getRawPool();
        if (rawPool) {
          // Try to find existing lead by email first, then by crmExternalId (LinkedIn URL)
          let existingId: number | null = null;

          if (email) {
            const [rows] = await rawPool.query(
              "SELECT id FROM lead_pipeline WHERE email = ? LIMIT 1",
              [email]
            ) as any;
            if (rows.length > 0) existingId = rows[0].id;
          }

          if (!existingId && linkedinUrl) {
            const [rows] = await rawPool.query(
              "SELECT id FROM lead_pipeline WHERE crmExternalId = ? LIMIT 1",
              [linkedinUrl]
            ) as any;
            if (rows.length > 0) existingId = rows[0].id;
          }

          if (existingId) {
            // Update existing lead
            const updateFields: string[] = ["updated_at = ?"];
            const updateParams: any[] = [Date.now()];
            if (firstName) { updateFields.push("firstName = ?"); updateParams.push(firstName); }
            if (lastName) { updateFields.push("lastName = ?"); updateParams.push(lastName); }
            if (email) { updateFields.push("email = ?"); updateParams.push(email); }
            updateParams.push(existingId);
            await rawPool.query(
              `UPDATE lead_pipeline SET ${updateFields.join(", ")} WHERE id = ?`,
              updateParams
            );
          } else {
            // Create new lead
            await rawPool.query(
              "INSERT INTO lead_pipeline (firstName, lastName, email, source, status, crmExternalId, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
              [firstName || null, lastName || null, email || null, "linkedin", "new", linkedinUrl || linkedinId || null, Date.now(), Date.now()]
            );
          }
        }
      }
    }

    // Mark processed
    await db.update(integrationWebhookEvents)
      .set({ processingStatus: "processed", processedAt: new Date() })
      .where(eq(integrationWebhookEvents.id, eventId));

    logger.info({ eventId, eventType }, "LinkedIn webhook processed");
    return { status: 200, body: { received: true, eventId } };
  } catch (err) {
    logger.error({ eventId, err }, "LinkedIn webhook processing failed");
    await db.update(integrationWebhookEvents)
      .set({ processingStatus: "failed", processingError: err instanceof Error ? err.message : "Unknown error" })
      .where(eq(integrationWebhookEvents.id, eventId))
      .catch(() => {});
    return { status: 500, body: { error: "Processing failed" } };
  }
}
