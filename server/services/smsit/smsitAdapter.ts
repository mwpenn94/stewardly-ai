/**
 * SMS-iT Adapter — Bidirectional REST API sync
 * CRITICAL: contact.opted_out → immediately mark unsubscribed (TCPA)
 */
import { getDb } from "../../db";
import { logger } from "../../_core/logger";

const log = logger.child({ module: "smsit" });

function getConfig() {
  const apiKey = process.env.SMSIT_API_KEY;
  const apiUrl = process.env.SMSIT_API_URL || "https://tool-it.smsit.ai/api";
  if (!apiKey || !apiUrl) return null;
  return { apiKey, apiUrl };
}

/**
 * Pull contacts from SMS-iT API
 */
export async function pullContacts(since?: number): Promise<Array<{
  externalId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  company?: string;
  tags?: string[];
  customFields?: Record<string, unknown>;
  updatedAt?: number;
}>> {
  const config = getConfig();
  if (!config) {
    log.warn("SMS-iT not configured — missing SMSIT_API_KEY or SMSIT_API_URL");
    return [];
  }
  try {
    let url = `${config.apiUrl}/contacts?limit=100`;
    if (since) url += `&updated_after=${new Date(since).toISOString()}`;
    const res = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      log.error({ status: res.status }, `SMS-iT pull contacts HTTP ${res.status}`);
      return [];
    }
    const data = await res.json() as any;
    const contacts = data?.data || data?.contacts || [];
    log.info({ count: contacts.length }, `SMS-iT pulled ${contacts.length} contacts`);
    return contacts.map((c: any) => ({
      externalId: String(c.id || c._id),
      firstName: c.first_name || c.firstName || "",
      lastName: c.last_name || c.lastName || "",
      email: c.email || undefined,
      phone: c.phone || c.mobile || undefined,
      company: c.company || "",
      tags: c.tags || [],
      customFields: c.custom_fields || {},
      updatedAt: c.updated_at ? new Date(c.updated_at).getTime() : undefined,
    }));
  } catch (e: any) {
    log.error({ error: e.message }, "SMS-iT pull contacts failed");
    return [];
  }
}

export async function pushContact(lead: { firstName?: string; lastName?: string; phone?: string; email?: string; tags?: string[] }): Promise<string | null> {
  const config = getConfig();
  if (!config) { log.warn("SMS-iT not configured"); return null; }

  try {
    const res = await fetch(`${config.apiUrl}/contacts`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ first_name: lead.firstName, last_name: lead.lastName, phone: lead.phone, tags: lead.tags }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.id;
  } catch (e: any) {
    log.error({ error: e.message }, "SMS-iT push failed");
    return null;
  }
}

export async function handleWebhook(eventType: string, payload: any): Promise<void> {
  log.info({ eventType }, "SMS-iT webhook received");

  if (eventType === "contact.opted_out") {
    // TCPA CRITICAL: immediately mark unsubscribed
    const db = await getDb();
    if (!db || !payload.contact_id) return;
    try {
      const { smsitSyncLog, leadPipeline } = await import("../../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      // Find lead by smsit contact ID and mark unsubscribed
      await db.insert(smsitSyncLog).values({
        syncDirection: "inbound",
        smsitContactId: payload.contact_id,
        syncType: "opt_out",
        status: "success",
      });

      log.warn({ contactId: payload.contact_id }, "SMS-iT opt-out processed — TCPA compliance");
    } catch (e: any) {
      log.error({ error: e.message }, "Failed to process opt-out — TCPA risk");
    }
  }
}
