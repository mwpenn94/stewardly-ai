/**
 * GHL Outbound Sync Service
 * Pushes leads/contacts to GoHighLevel when created in Stewardly.
 * Uses the GoHighLevelAdapter from orgProviders.ts for live API calls,
 * with graceful degradation if GHL credentials are not configured.
 */
import pino from "pino";
import { dedupSafePush } from "./syncReconciliation";

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
 * Push a lead/contact to GHL using dedup-safe push.
 * Pre-checks GHL for existing contacts by email/phone before creating,
 * preventing duplicates even in race conditions.
 */
/**
 * OUTREACH SAFEGUARD: All GHL outbound sync is disabled until external outreach is explicitly enabled.
 * This prevents any automated workflows, emails, or SMS from being triggered via GHL.
 * To enable: set OUTREACH_ENABLED=true in environment variables.
 */
const OUTREACH_ENABLED = (process.env.OUTREACH_ENABLED || "false").toLowerCase() === "true";

export async function pushLeadToGHL(lead: LeadToSync): Promise<SyncResult> {
  // Owner-only safeguard: block all GHL outbound sync unless explicitly enabled
  if (!OUTREACH_ENABLED) {
    logger.info(
      { email: lead.email },
      "[GHL Outbound] Blocked — outreach disabled (OUTREACH_ENABLED=false). Contact NOT pushed to GHL."
    );
    return { success: false, message: "Outreach disabled (owner-only mode)", mode: "skipped" };
  }

  if (!GHL_API_KEY || !GHL_LOCATION_ID) {
    logger.info("GHL credentials not configured — skipping outbound sync");
    return { success: false, message: "GHL not configured", mode: "skipped" };
  }

  try {
    // Use dedup-safe push from reconciliation engine
    const result = await dedupSafePush({
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      phone: lead.phone,
      tags: lead.tags,
      source: lead.source,
    });

    if (result.action === "skipped") {
      return { success: false, message: result.message, mode: "skipped" };
    }

    logger.info(
      { ghlContactId: result.ghlContactId, email: lead.email, action: result.action },
      `Lead pushed to GHL via dedup-safe push (${result.action})`
    );

    return {
      success: true,
      ghlContactId: result.ghlContactId,
      message: result.message,
      mode: "live",
    };
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
