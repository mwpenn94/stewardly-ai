/**
 * Workable Webhook Handler
 * Receives recruitment/hiring events from Workable and ingests candidates as leads.
 * Workable webhooks: https://workable.readme.io/reference/webhooks
 *
 * Events:
 *   - candidate.created, candidate.moved, candidate.hired, candidate.disqualified
 *   - job.published, job.closed
 */
import { logger } from "../_core/logger";
import { getDb, getRawPool } from "../db";
import { eq } from "drizzle-orm";
import { integrationWebhookEvents } from "../../drizzle/schema";
import { nanoid } from "nanoid";
import crypto from "crypto";

function verifyWorkableSignature(
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

/** Express handler for incoming Workable webhooks */
export async function handleWorkableWebhook(
  rawBody: string,
  headers: Record<string, string | undefined>,
  connectionId?: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const db = await getDb();
  if (!db) return { status: 503, body: { error: "Database unavailable" } };

  const eventId = nanoid();

  try {
    // Security: verify webhook signature
    const workableSecret = process.env.WORKABLE_WEBHOOK_SECRET || "";
    const signature = headers["x-workable-signature"] || headers["x-hook-signature"];
    let signatureValid = true;

    if (workableSecret) {
      signatureValid = verifyWorkableSignature(rawBody, signature, workableSecret);
      if (!signatureValid) {
        logger.warn({ eventId }, "Workable webhook rejected: invalid signature");
        return { status: 401, body: { error: "Invalid signature" } };
      }
    } else {
      logger.warn({ eventId }, "WORKABLE_WEBHOOK_SECRET not set — signature verification skipped");
    }

    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const eventType = (payload.event || payload.type || "unknown") as string;

    // Log the event
    await db.insert(integrationWebhookEvents).values({
      id: eventId,
      connectionId: connectionId || "default-workable",
      providerSlug: "workable",
      eventType,
      payloadJson: payload as any,
      signatureValid,
      processingStatus: "pending",
    });

    // Process candidate events — upsert into lead_pipeline
    if (eventType.startsWith("candidate.")) {
      const candidate = (payload.candidate || payload.data || payload) as Record<string, unknown>;
      const email = ((candidate.email || "") as string).toLowerCase().trim();
      const firstName = (candidate.firstname || candidate.firstName || candidate.first_name || "") as string;
      const lastName = (candidate.lastname || candidate.lastName || candidate.last_name || "") as string;
      const phone = (candidate.phone || "") as string;
      const workableCandidateId = (candidate.id || "") as string;

      if (email) {
        const rawPool = await getRawPool();
        if (rawPool) {
          const [rows] = await rawPool.query(
            "SELECT id FROM lead_pipeline WHERE email = ? LIMIT 1",
            [email]
          ) as any;

          if (rows.length > 0) {
            // Update existing lead
            const updateFields: string[] = ["updated_at = ?"];
            const updateParams: any[] = [Date.now()];
            if (firstName) { updateFields.push("firstName = ?"); updateParams.push(firstName); }
            if (lastName) { updateFields.push("lastName = ?"); updateParams.push(lastName); }
            if (phone) { updateFields.push("phone = ?"); updateParams.push(phone); }
            // Map Workable status to lead status
            if (eventType === "candidate.hired") {
              updateFields.push("status = ?"); updateParams.push("converted");
            } else if (eventType === "candidate.disqualified") {
              updateFields.push("status = ?"); updateParams.push("disqualified");
            }
            updateParams.push(rows[0].id);
            await rawPool.query(
              `UPDATE lead_pipeline SET ${updateFields.join(", ")} WHERE id = ?`,
              updateParams
            );
          } else if (eventType !== "candidate.disqualified") {
            // Create new lead (don't create for disqualified)
            await rawPool.query(
              "INSERT INTO lead_pipeline (firstName, lastName, email, phone, source, status, crmExternalId, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
              [firstName || null, lastName || null, email, phone || null, "workable", "new", workableCandidateId || null, Date.now(), Date.now()]
            );
          }
        }
      }
    }

    // Mark processed
    await db.update(integrationWebhookEvents)
      .set({ processingStatus: "processed", processedAt: new Date() })
      .where(eq(integrationWebhookEvents.id, eventId));

    logger.info({ eventId, eventType }, "Workable webhook processed");
    return { status: 200, body: { received: true, eventId } };
  } catch (err) {
    logger.error({ eventId, err }, "Workable webhook processing failed");
    await db.update(integrationWebhookEvents)
      .set({ processingStatus: "failed", processingError: err instanceof Error ? err.message : "Unknown error" })
      .where(eq(integrationWebhookEvents.id, eventId))
      .catch(() => {});
    return { status: 500, body: { error: "Processing failed" } };
  }
}
