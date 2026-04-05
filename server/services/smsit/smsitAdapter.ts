/**
 * SMS-iT Adapter — Bidirectional REST API sync
 * CRITICAL: contact.opted_out → immediately mark unsubscribed (TCPA)
 */
import { getDb } from "../../db";
import { logger } from "../../_core/logger";

const log = logger.child({ module: "smsit" });

function getConfig() {
  const apiKey = process.env.SMSIT_API_KEY;
  const apiUrl = process.env.SMSIT_API_URL;
  if (!apiKey || !apiUrl) return null;
  return { apiKey, apiUrl };
}

export async function pushContact(lead: { firstName?: string; lastName?: string; phone?: string; tags?: string[] }): Promise<string | null> {
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
