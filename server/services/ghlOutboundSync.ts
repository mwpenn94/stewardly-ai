/**
 * GHL Outbound Sync Service
 * Pushes leads/contacts to GoHighLevel when created in Stewardly.
 * Uses the GoHighLevelAdapter from orgProviders.ts for live API calls,
 * with graceful degradation if GHL credentials are not configured.
 */
import pino from "pino";

const logger = pino({ name: "ghl-outbound-sync" });

const GHL_API_KEY = process.env.GHL_API_KEY || "";
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || "";

export interface LeadToSync {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  source?: string;
  /** Any extra metadata to store as custom fields or notes */
  metadata?: Record<string, unknown>;
}

export interface SyncResult {
  success: boolean;
  ghlContactId?: string;
  message: string;
  mode: "live" | "skipped" | "error";
}

/**
 * Push a lead/contact to GHL. Gracefully skips if credentials are not configured.
 */
export async function pushLeadToGHL(lead: LeadToSync): Promise<SyncResult> {
  if (!GHL_API_KEY || !GHL_LOCATION_ID) {
    logger.info("GHL credentials not configured — skipping outbound sync");
    return { success: false, message: "GHL not configured", mode: "skipped" };
  }

  const BASE = "https://services.leadconnectorhq.com";
  const headers = {
    Authorization: `Bearer ${GHL_API_KEY}`,
    Version: "2021-07-28",
    "Content-Type": "application/json",
  };

  const contactPayload = {
    locationId: GHL_LOCATION_ID,
    firstName: lead.firstName || "",
    lastName: lead.lastName || "",
    email: lead.email || "",
    phone: lead.phone || "",
    tags: [
      ...(lead.tags || []),
      "stewardly-synced",
      lead.source ? `source:${lead.source}` : "source:stewardly",
    ],
  };

  try {
    const resp = await fetch(`${BASE}/contacts/`, {
      method: "POST",
      headers,
      body: JSON.stringify(contactPayload),
      signal: AbortSignal.timeout(15000),
    });

    if (resp.ok) {
      const data = await resp.json() as any;
      const ghlContactId = data.contact?.id;
      logger.info({ ghlContactId, email: lead.email }, "Lead pushed to GHL");
      return { success: true, ghlContactId, message: "Contact synced to GoHighLevel", mode: "live" };
    }

    // Handle duplicate contact — GHL returns 400 with contactId in meta
    if (resp.status === 400) {
      const errBody = await resp.json().catch(() => ({})) as any;
      const existingId = errBody?.meta?.contactId;

      if (existingId && errBody?.message?.includes("duplicate")) {
        // Update existing contact with new tags
        try {
          const updateResp = await fetch(`${BASE}/contacts/${existingId}`, {
            method: "PUT",
            headers,
            body: JSON.stringify({
              tags: contactPayload.tags,
              firstName: contactPayload.firstName || undefined,
              lastName: contactPayload.lastName || undefined,
            }),
            signal: AbortSignal.timeout(15000),
          });
          if (updateResp.ok) {
            logger.info({ ghlContactId: existingId, email: lead.email }, "Duplicate detected — updated existing GHL contact");
            return { success: true, ghlContactId: existingId, message: "Duplicate detected — updated existing contact", mode: "live" };
          }
        } catch { /* fall through */ }
      }

      // Still a success if the contact exists
      if (existingId) {
        return { success: true, ghlContactId: existingId, message: "Contact already exists in GoHighLevel", mode: "live" };
      }

      return { success: false, message: `GHL 400: ${errBody?.message || "Bad Request"}`, mode: "error" };
    }

    return { success: false, message: `GHL HTTP ${resp.status}`, mode: "error" };
  } catch (err: any) {
    logger.error({ err: err.message, email: lead.email }, "Failed to push lead to GHL");
    return { success: false, message: `GHL sync error: ${err.message}`, mode: "error" };
  }
}

/**
 * Push multiple leads to GHL in batch. Returns results for each.
 */
export async function pushLeadsBatchToGHL(leads: LeadToSync[]): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  for (const lead of leads) {
    const result = await pushLeadToGHL(lead);
    results.push(result);
    // Small delay to avoid GHL rate limiting
    if (result.mode === "live") {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  return results;
}

/**
 * Update an existing GHL contact by ID.
 */
export async function updateGHLContact(
  ghlContactId: string,
  updates: Partial<LeadToSync>
): Promise<SyncResult> {
  if (!GHL_API_KEY || !GHL_LOCATION_ID) {
    return { success: false, message: "GHL not configured", mode: "skipped" };
  }

  try {
    const { GoHighLevelAdapter } = await import("./orgProviders");
    const adapter = new GoHighLevelAdapter(GHL_API_KEY, GHL_LOCATION_ID);

    await adapter.updateContact(ghlContactId, {
      firstName: updates.firstName,
      lastName: updates.lastName,
      email: updates.email,
      phone: updates.phone,
      tags: updates.tags,
    });

    return {
      success: true,
      ghlContactId,
      message: "Contact updated in GoHighLevel",
      mode: "live",
    };
  } catch (err: any) {
    logger.error({ err: err.message, ghlContactId }, "Failed to update GHL contact");
    return {
      success: false,
      message: `GHL update error: ${err.message}`,
      mode: "error",
    };
  }
}

/**
 * Delete a GHL contact by ID (for cleanup/GDPR).
 */
export async function deleteGHLContact(ghlContactId: string): Promise<SyncResult> {
  if (!GHL_API_KEY || !GHL_LOCATION_ID) {
    return { success: false, message: "GHL not configured", mode: "skipped" };
  }

  try {
    const resp = await fetch(
      `https://services.leadconnectorhq.com/contacts/${ghlContactId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${GHL_API_KEY}`,
          Version: "2021-07-28",
        },
      }
    );

    if (resp.ok) {
      return { success: true, ghlContactId, message: "Contact deleted from GHL", mode: "live" };
    }
    return { success: false, message: `Delete failed: HTTP ${resp.status}`, mode: "error" };
  } catch (err: any) {
    return { success: false, message: `Delete error: ${err.message}`, mode: "error" };
  }
}
