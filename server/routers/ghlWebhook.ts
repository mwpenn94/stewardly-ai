/**
 * GoHighLevel (GHL) Webhook Router
 * Receives contact/opportunity events from GHL CRM and ingests them into the platform.
 *
 * IMPORTANT: Uses raw SQL because the Drizzle schema definition for lead_pipeline
 * does not match the actual database columns. Actual DB columns:
 *   id, firmId, professionalId, firstName, lastName, email, phone, source,
 *   status, propensityScore, primaryInterest, estimatedIncome, protectionScore,
 *   notesJson, crmExternalId, created_at, updated_at
 *
 * crmExternalId = GHL contact ID
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { logger } from "../_core/logger";
import { getDb, getRawPool } from "../db";
import { eq, sql } from "drizzle-orm";
import { integrationWebhookEvents } from "../../drizzle/schema";
import { nanoid } from "nanoid";
import crypto from "crypto";
import type { Express, Request, Response } from "express";

const GHL_EVENT_TYPES = [
  "contact.create", "contact.update", "contact.delete",
  "contact.tag.create", "contact.tag.delete", "contact.note.create",
  "opportunity.create", "opportunity.update", "opportunity.status_change",
  "appointment.create", "appointment.update",
  "ContactCreate", "ContactUpdate", "ContactDelete",
  "OpportunityCreate", "OpportunityStatusUpdate",
] as const;

// GHL Ed25519 public key for X-GHL-Signature verification
// See: https://marketplace.gohighlevel.com/docs/webhook/WebhookIntegrationGuide
const GHL_ED25519_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAoOF/3iMODmxMjAFy5uIbuLWqSQwlZ6EkF7VfOqBlHEM=
-----END PUBLIC KEY-----`;

// Legacy RSA public key for X-WH-Signature (deprecated July 1, 2026)
const GHL_RSA_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAokvo/r9tVgcfZ5DysOSC
Frm602qYV0MaAiNnX9O8KxMbiyRKWeL9JpCpVpt4XHIcBOK4u3cLSqJGOLaPuXw6
dO0t6Q/ZVdAV5Phz+ZtzPL16iCGeK9po6D6JHBpbi989mmzMryUnQJ/FPjHcXNKD
FLIzJpzSfJOCj+MFMhW7rvEBPDzJHBJCL1V5v2xay+C5xgP0GaISNzqNOFBJEMT
PHDkMKT0Baf0oHs9zGIyOCBzRJQIl6LSBKyBM/LGVklHNHPhFwBwnRWcO/Eo8w3u
iEeGBSMpOo6WP2GCCRSsafeyMnm1GOQK4esFEHCGsfmAOBBzaFDXSYIqKmFo6sSE
vMVMOGGF0RnXWMfmkKSgCRBgjJIH4JVqpLGHTfbk3gVLhVsDvkaGP08hVuaywKiN
T5sSEQIBpECEF0loj2ORj7VOBbELMFkxnCYjqG8U1AjkRYXpLhUMNqPjBRMBEMcU
Gw0Nh8zSFMBs3LAFi1mNsLLBpRKZgCb0l9P7Ch/dYVi/6V9BLfOBz3gfmiFKbGTR
f7cOx2MbEd8Di8026XMB1cOi8gRhJGGmrIQGYRaMkGTLHymEMGeFi4RYVI4qZ4KZ
kMvGMvRpHFID/xPMIFdqJCbSVWkGkseQ4vDMjfd1sMD3muGeDRFSMVxqMphquBaA
qaaEj2MN3VmCMOlwNMCPRVUCAwEAAQ==
-----END PUBLIC KEY-----`;

function verifyGHLSignature(payload: string, headers: Record<string, string | undefined>): boolean {
  // Try Ed25519 first (current, preferred)
  const ed25519Sig = headers["x-ghl-signature"];
  if (ed25519Sig) {
    try {
      const keyObj = crypto.createPublicKey(GHL_ED25519_PUBLIC_KEY);
      const isValid = crypto.verify(
        null, // Ed25519 doesn't use a separate hash algorithm
        Buffer.from(payload),
        keyObj,
        Buffer.from(ed25519Sig, "base64")
      );
      if (isValid) return true;
    } catch (err) {
      logger.warn({ err }, "Ed25519 signature verification failed");
    }
  }

  // Fallback to legacy RSA-SHA256 (X-WH-Signature, deprecated July 2026)
  const rsaSig = headers["x-wh-signature"];
  if (rsaSig) {
    try {
      const verifier = crypto.createVerify("RSA-SHA256");
      verifier.update(payload);
      const isValid = verifier.verify(GHL_RSA_PUBLIC_KEY, rsaSig, "base64");
      if (isValid) return true;
    } catch (err) {
      logger.warn({ err }, "RSA signature verification failed");
    }
  }

  // Fallback to HMAC-SHA256 with shared secret (for custom/self-signed webhooks)
  const hmacSecret = process.env.GHL_WEBHOOK_SECRET || "";
  const hookSig = headers["x-hook-signature"];
  if (hmacSecret && hookSig) {
    try {
      const expected = crypto.createHmac("sha256", hmacSecret).update(payload).digest("hex");
      return crypto.timingSafeEqual(Buffer.from(hookSig), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  return false;
}

// ─── tRPC Router (management) ──────────────────────────────────────────────
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

  /** Trigger bulk inbound sync from GHL */
  bulkSync: protectedProcedure.mutation(async () => {
    return bulkInboundSync();
  }),
});

// ─── Contact Upsert Logic (raw SQL matching actual DB) ────────────────────

interface GHLContact {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  tags?: string[];
  source?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  dateAdded?: string;
  locationId?: string;
}

/** Resolve GHL locationId to internal ghl_locations.id */
async function resolveLocationDbId(ghlLocationId: string | undefined): Promise<number | null> {
  if (!ghlLocationId) return null;
  const pool = await getRawPool();
  if (!pool) return null;
  try {
    const [rows] = await pool.query(
      "SELECT id FROM ghl_locations WHERE location_id = ? LIMIT 1",
      [ghlLocationId]
    );
    const existingId = (rows as any[])[0]?.id;
    if (existingId != null) return existingId;

    // Auto-provision: unknown location detected from webhook
    try {
      const { autoProvisionFromWebhook } = await import("../services/locationAutoProvisioning");
      const newId = await autoProvisionFromWebhook(ghlLocationId);
      if (newId != null) {
        logger.info({ ghlLocationId, newLocationDbId: newId }, "Auto-provisioned new location from webhook");
      }
      return newId;
    } catch (provErr) {
      logger.warn({ ghlLocationId, err: provErr }, "Auto-provision failed — continuing without location");
      return null;
    }
  } catch {
    return null;
  }
}

async function upsertContactToLeadPipeline(
  contact: GHLContact,
  eventType: string,
  locationDbId?: number | null,
): Promise<{ action: string; leadPipelineId?: number }> {
  const pool = await getRawPool();
  if (!pool) return { action: "skip_no_db" };

  const now = Date.now();

  // Check if contact already exists by crmExternalId (= GHL contact ID)
  const [existingRows] = await pool.query(
    "SELECT id, firstName, lastName, phone, source, notesJson FROM lead_pipeline WHERE crmExternalId = ? LIMIT 1",
    [contact.id]
  );
  const existing = (existingRows as any[])[0];

  if (existing) {
    // Update existing record
    const notesJson = {
      ...(typeof existing.notesJson === "string" ? JSON.parse(existing.notesJson) : existing.notesJson || {}),
      ghlTags: contact.tags || [],
      ghlCity: contact.city,
      ghlState: contact.state,
      ghlPostalCode: contact.postalCode,
      ghlCompany: contact.companyName,
      lastSyncEvent: eventType,
      lastSyncAt: new Date().toISOString(),
    };

    await pool.query(
      "UPDATE lead_pipeline SET firstName = ?, lastName = ?, phone = ?, source = ?, notesJson = ?, updated_at = ? WHERE id = ?",
      [
        contact.firstName || existing.firstName,
        contact.lastName || existing.lastName,
        contact.phone || existing.phone,
        contact.source || existing.source,
        JSON.stringify(notesJson),
        now,
        existing.id,
      ]
    );

    return { action: "updated", leadPipelineId: existing.id };
  }

  // Also check by email
  if (contact.email) {
    const [byEmailRows] = await pool.query(
      "SELECT id, firstName, lastName, phone, source, notesJson FROM lead_pipeline WHERE email = ? LIMIT 1",
      [contact.email.toLowerCase().trim()]
    );
    const byEmail = (byEmailRows as any[])[0];

    if (byEmail) {
      const notesJson = {
        ...(typeof byEmail.notesJson === "string" ? JSON.parse(byEmail.notesJson) : byEmail.notesJson || {}),
        ghlTags: contact.tags || [],
        ghlCity: contact.city,
        ghlState: contact.state,
        ghlPostalCode: contact.postalCode,
        ghlCompany: contact.companyName,
        linkedByEmail: true,
        lastSyncEvent: eventType,
        lastSyncAt: new Date().toISOString(),
      };

      await pool.query(
        "UPDATE lead_pipeline SET crmExternalId = ?, firstName = ?, lastName = ?, phone = ?, source = ?, notesJson = ?, updated_at = ? WHERE id = ?",
        [
          contact.id,
          contact.firstName || byEmail.firstName,
          contact.lastName || byEmail.lastName,
          contact.phone || byEmail.phone,
          contact.source || byEmail.source,
          JSON.stringify(notesJson),
          now,
          byEmail.id,
        ]
      );

      return { action: "linked_by_email", leadPipelineId: byEmail.id };
    }
  }

  // Create new lead pipeline record (with location_id)
  const [insertResult] = await pool.query(
    `INSERT INTO lead_pipeline (firstName, lastName, email, phone, source, crmExternalId, status, notesJson, location_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?)`,
    [
      contact.firstName || null,
      contact.lastName || null,
      contact.email?.toLowerCase().trim() || null,
      contact.phone || null,
      contact.source || "ghl_webhook",
      contact.id,
      JSON.stringify({
        ghlTags: contact.tags || [],
        ghlCity: contact.city,
        ghlState: contact.state,
        ghlPostalCode: contact.postalCode,
        ghlCompany: contact.companyName,
        ghlDateAdded: contact.dateAdded,
        inboundEvent: eventType,
      }),
      locationDbId ?? null,
      now,
      now,
    ]
  );

  return { action: "created", leadPipelineId: (insertResult as any).insertId };
}

// ─── Express Handler ───────────────────────────────────────────────────────

export async function handleGHLWebhook(
  rawBody: string,
  headers: Record<string, string | undefined>,
  connectionId?: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const db = await getDb();
  if (!db) return { status: 503, body: { error: "Database unavailable" } };

  const eventId = nanoid();

  try {
    // Verify webhook signature (Ed25519 → RSA → HMAC fallback chain)
    const hasAnySignature = headers["x-ghl-signature"] || headers["x-wh-signature"] || headers["x-hook-signature"];
    const signatureValid = hasAnySignature ? verifyGHLSignature(rawBody, headers) : false;

    if (hasAnySignature && !signatureValid) {
      logger.warn({ eventId }, "GHL webhook signature verification failed — processing anyway (may be test event)");
      // Don't reject — GHL test events may not have valid signatures
    }
    if (!hasAnySignature) {
      logger.info({ eventId }, "GHL webhook received without signature headers — accepting (internal/test)");
    }

    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const eventType = (payload.event || payload.type || "unknown") as string;

    // Resolve GHL location from payload
    const payloadLocationId = (payload.locationId || (payload.contact as any)?.locationId || (payload.opportunity as any)?.locationId) as string | undefined;
    const locationDbId = await resolveLocationDbId(payloadLocationId);

    // Log the event to integration_webhook_events (with location_id)
    await db.insert(integrationWebhookEvents).values({
      id: eventId,
      connectionId: connectionId || "default-ghl",
      providerSlug: "ghl",
      eventType,
      payloadJson: payload as any,
      signatureValid,
      processingStatus: "pending",
    });

    // Also set location_id on the webhook event row via raw SQL (Drizzle schema may not have it yet)
    if (locationDbId != null) {
      const pool = await getRawPool();
      if (pool) {
        await pool.query("UPDATE integration_webhook_events SET location_id = ? WHERE id = ?", [locationDbId, eventId]).catch(() => {});
      }
    }

    // Process contact events → upsert to leadPipeline via raw SQL
    let upsertResult: { action: string; leadPipelineId?: number } | null = null;

    if (eventType.includes("contact") || eventType.includes("Contact")) {
      const contact = (payload.contact || payload) as Record<string, unknown>;
      const ghlContactId = (contact.id || contact.contactId || "") as string;

      if (ghlContactId) {
        if (eventType.includes("delete") || eventType.includes("Delete")) {
          // Soft-delete: mark as disqualified
          const pool = await getRawPool();
          if (pool) {
            const [existingRows] = await pool.query(
              "SELECT id, notesJson FROM lead_pipeline WHERE crmExternalId = ? LIMIT 1",
              [ghlContactId]
            );
            const existing = (existingRows as any[])[0];
            if (existing) {
              const notesJson = {
                ...(typeof existing.notesJson === "string" ? JSON.parse(existing.notesJson) : existing.notesJson || {}),
                deletedFromGHL: true,
                deletedAt: new Date().toISOString(),
              };
              await pool.query(
                "UPDATE lead_pipeline SET status = 'disqualified', notesJson = ?, updated_at = ? WHERE id = ?",
                [JSON.stringify(notesJson), Date.now(), existing.id]
              );
              upsertResult = { action: "soft_deleted", leadPipelineId: existing.id };
            } else {
              upsertResult = { action: "no_local_record" };
            }
          }
        } else {
          // Create or update
          upsertResult = await upsertContactToLeadPipeline({
            id: ghlContactId,
            firstName: contact.firstName as string | undefined,
            lastName: contact.lastName as string | undefined,
            email: contact.email as string | undefined,
            phone: contact.phone as string | undefined,
            companyName: contact.companyName as string | undefined,
            tags: contact.tags as string[] | undefined,
            source: contact.source as string | undefined,
            city: contact.city as string | undefined,
            state: contact.state as string | undefined,
            postalCode: contact.postalCode as string | undefined,
            dateAdded: contact.dateAdded as string | undefined,
            locationId: contact.locationId as string | undefined,
          }, eventType, locationDbId);
        }
      }
    }

    // Process opportunity events → link to lead
    if (eventType.includes("opportunity") || eventType.includes("Opportunity")) {
      const opp = (payload.opportunity || payload) as Record<string, unknown>;
      const oppId = (opp.id || "") as string;
      const contactId = (opp.contactId || "") as string;

      if (oppId && contactId) {
        const pool = await getRawPool();
        if (pool) {
          const [existingRows] = await pool.query(
            "SELECT id, status, notesJson FROM lead_pipeline WHERE crmExternalId = ? LIMIT 1",
            [contactId]
          );
          const existing = (existingRows as any[])[0];
          if (existing) {
            const notesJson = {
              ...(typeof existing.notesJson === "string" ? JSON.parse(existing.notesJson) : existing.notesJson || {}),
              ghlOpportunityId: oppId,
              opportunityLinkedAt: new Date().toISOString(),
            };
            const newStatus = existing.status === "new" ? "qualified" : existing.status;
            await pool.query(
              "UPDATE lead_pipeline SET status = ?, notesJson = ?, updated_at = ? WHERE id = ?",
              [newStatus, JSON.stringify(notesJson), Date.now(), existing.id]
            );
            upsertResult = { action: "opportunity_linked", leadPipelineId: existing.id };
          }
        }
      }
    }

    // Mark processed
    await db.update(integrationWebhookEvents)
      .set({ processingStatus: "processed", processedAt: new Date() })
      .where(eq(integrationWebhookEvents.id, eventId));

    // Emit SSE events for real-time streaming
    try {
      const { emitWebhookReceived, emitContactSynced } = await import("../services/syncEventBus");
      const contactData = (payload.contact || payload) as Record<string, unknown>;
      const contactName = [contactData.firstName, contactData.lastName].filter(Boolean).join(" ") || undefined;
      emitWebhookReceived({
        locationId: locationDbId ?? undefined,
        ghlLocationId: payloadLocationId,
        eventType,
        contactId: (contactData.id || contactData.contactId) as string | undefined,
        contactName,
      });
      if (upsertResult?.action && upsertResult.action !== "no_local_record") {
        const actionMap: Record<string, "created" | "updated" | "linked" | "deleted"> = {
          created: "created", updated: "updated", linked: "linked",
          soft_deleted: "deleted", opportunity_linked: "linked",
        };
        emitContactSynced({
          locationId: locationDbId ?? undefined,
          action: actionMap[upsertResult.action] || "updated",
          contactName,
          direction: "inbound",
        });
      }
    } catch { /* SSE emit is best-effort */ }

    // Record sync metric for webhook vs polling comparison
    try {
      const { recordWebhookEvent: recordWH } = await import("../services/syncMetrics");
      const contactData = (payload.contact || payload) as Record<string, unknown>;
      const ghlContactId = (contactData.id || contactData.contactId) as string | undefined;
      // Map GHL event type to our normalized event type
      const metricEventType = eventType.includes("delete") || eventType.includes("Delete")
        ? "contact_delete" as const
        : eventType.includes("opportunity") || eventType.includes("Opportunity")
          ? (eventType.includes("create") || eventType.includes("Create") ? "opportunity_create" as const : "opportunity_update" as const)
          : eventType.includes("create") || eventType.includes("Create")
            ? "contact_create" as const
            : "contact_update" as const;
      // Try to extract GHL timestamp for latency calculation
      const ghlDateAdded = (contactData.dateAdded || contactData.dateUpdated) as string | undefined;
      const ghlTimestamp = ghlDateAdded ? new Date(ghlDateAdded).getTime() : undefined;
      await recordWH({
        eventType: metricEventType,
        locationId: payloadLocationId,
        locationDbId: locationDbId ?? undefined,
        contactExternalId: ghlContactId,
        ghlTimestamp: ghlTimestamp && !isNaN(ghlTimestamp) ? ghlTimestamp : undefined,
        payloadSize: rawBody.length,
        success: true,
      });
    } catch { /* metric recording is best-effort */ }

    logger.info({ eventId, eventType, upsertResult }, "GHL webhook processed");
    return {
      status: 200,
      body: {
        received: true,
        eventId,
        eventType,
        ...(upsertResult || {}),
      },
    };
  } catch (err) {
    logger.error({ eventId, err }, "GHL webhook processing failed");
    await db.update(integrationWebhookEvents)
      .set({ processingStatus: "failed", processingError: err instanceof Error ? err.message : "Unknown error" })
      .where(eq(integrationWebhookEvents.id, eventId))
      .catch(() => {});
    // Record failed webhook metric
    try {
      const { recordWebhookEvent: recordWH } = await import("../services/syncMetrics");
      await recordWH({
        eventType: "contact_update",
        locationId: undefined,
        success: false,
        errorMessage: err instanceof Error ? err.message : "Unknown error",
      });
    } catch { /* best-effort */ }
    return { status: 500, body: { error: "Processing failed" } };
  }
}

// ─── Express Route Registration ────────────────────────────────────────────

export function registerGHLWebhookRoutes(app: Express) {
  app.post("/api/webhooks/ghl", async (req: Request, res: Response) => {
    const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    const headers: Record<string, string | undefined> = {
      "x-ghl-signature": req.headers["x-ghl-signature"] as string | undefined,
      "x-wh-signature": req.headers["x-wh-signature"] as string | undefined,
      "x-hook-signature": req.headers["x-hook-signature"] as string | undefined,
    };

    const result = await handleGHLWebhook(rawBody, headers);
    res.status(result.status).json(result.body);
  });

  app.get("/api/webhooks/ghl/health", (_req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      provider: "gohighlevel",
      supportedEvents: [...GHL_EVENT_TYPES],
      timestamp: Date.now(),
    });
  });

  logger.info("[GHL Webhook] Routes registered at /api/webhooks/ghl");
}

// ─── Bulk Inbound Sync (pull all contacts from GHL into lead pipeline) ─────

export async function bulkInboundSync(): Promise<{
  total: number;
  created: number;
  updated: number;
  linked: number;
  errors: number;
}> {
  const GHL_API_KEY = process.env.GHL_API_KEY || "";
  const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || "";

  if (!GHL_API_KEY || !GHL_LOCATION_ID) {
    logger.warn("[GHL Bulk Sync] No credentials configured");
    return { total: 0, created: 0, updated: 0, linked: 0, errors: 0 };
  }

  const headers = {
    Authorization: `Bearer ${GHL_API_KEY}`,
    Version: "2021-07-28",
    "Content-Type": "application/json",
  };

  let allContacts: any[] = [];
  let nextPageUrl: string | null = `https://services.leadconnectorhq.com/contacts/?locationId=${GHL_LOCATION_ID}&limit=100`;

  // Paginate through all contacts
  while (nextPageUrl) {
    try {
      const resp = await fetch(nextPageUrl, { headers, signal: AbortSignal.timeout(30000) });
      if (!resp.ok) {
        logger.error({ status: resp.status }, "[GHL Bulk Sync] API error");
        break;
      }
      const data = await resp.json() as any;
      const contacts = data.contacts || [];
      allContacts = allContacts.concat(contacts);

      // GHL pagination
      if (data.meta?.nextPageUrl) {
        nextPageUrl = data.meta.nextPageUrl;
      } else if (data.meta?.startAfterId && contacts.length >= 100) {
        nextPageUrl = `https://services.leadconnectorhq.com/contacts/?locationId=${GHL_LOCATION_ID}&limit=100&startAfterId=${data.meta.startAfterId}`;
      } else {
        nextPageUrl = null;
      }
    } catch (err: any) {
      logger.error({ err: err.message }, "[GHL Bulk Sync] Pagination error");
      break;
    }
  }

  logger.info({ total: allContacts.length }, "[GHL Bulk Sync] Fetched contacts from GHL");

  let created = 0, updated = 0, linked = 0, errors = 0;

  for (const ghlContact of allContacts) {
    try {
      const result = await upsertContactToLeadPipeline({
        id: ghlContact.id,
        firstName: ghlContact.firstName,
        lastName: ghlContact.lastName,
        email: ghlContact.email,
        phone: ghlContact.phone,
        companyName: ghlContact.companyName,
        tags: ghlContact.tags,
        source: ghlContact.source,
        city: ghlContact.city,
        state: ghlContact.state,
        postalCode: ghlContact.postalCode,
        dateAdded: ghlContact.dateAdded,
      }, "bulk_sync");

      if (result.action === "created") created++;
      else if (result.action === "updated") updated++;
      else if (result.action === "linked_by_email") linked++;
    } catch (err: any) {
      errors++;
      logger.error({ err: err.message, ghlId: ghlContact.id }, "[GHL Bulk Sync] Error processing contact");
    }
  }

  logger.info({ total: allContacts.length, created, updated, linked, errors }, "[GHL Bulk Sync] Complete");
  return { total: allContacts.length, created, updated, linked, errors };
}
