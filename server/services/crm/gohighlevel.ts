/**
 * GoHighLevel CRM V2 API Client
 * Maps Stewardly leads → GHL contacts/opportunities
 */
import { logger } from "../../_core/logger";

const log = logger.child({ module: "gohighlevel" });
const BASE_URL = "https://services.leadconnectorhq.com";

function getConfig() {
  const locationId = process.env.GHL_LOCATION_ID;
  const apiToken = process.env.GHL_API_TOKEN;
  if (!locationId || !apiToken) {
    log.warn("GHL_LOCATION_ID or GHL_API_TOKEN not set, CRM disabled");
    return null;
  }
  return { locationId, apiToken, pipelineId: process.env.GHL_PIPELINE_ID };
}

async function ghlRequest(path: string, options: RequestInit = {}): Promise<any> {
  const config = getConfig();
  if (!config) return null;

  const headers: Record<string, string> = {
    "Authorization": `Bearer ${config.apiToken}`,
    "Content-Type": "application/json",
    "Version": "2021-07-28",
  };

  try {
    const res = await fetch(`${BASE_URL}${path}`, { ...headers, ...options, headers });
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") || "60");
      log.warn({ retryAfter }, "GHL rate limited");
      return null;
    }
    if (!res.ok) {
      log.error({ status: res.status, path }, "GHL API error");
      return null;
    }
    return res.json();
  } catch (err: any) {
    log.error({ err: err.message, path }, "GHL request failed");
    return null;
  }
}

export async function createContact(data: {
  firstName?: string; lastName?: string; email?: string; phone?: string;
  tags?: string[]; customFields?: Record<string, string>;
}) {
  const config = getConfig();
  if (!config) return null;
  return ghlRequest(`/contacts/`, {
    method: "POST",
    body: JSON.stringify({ ...data, locationId: config.locationId }),
  });
}

export async function updateContact(contactId: string, data: Record<string, unknown>) {
  return ghlRequest(`/contacts/${contactId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function createOpportunity(data: {
  contactId: string; name: string; stageId: string; monetaryValue?: number;
}) {
  const config = getConfig();
  if (!config) return null;
  return ghlRequest(`/opportunities/`, {
    method: "POST",
    body: JSON.stringify({ ...data, locationId: config.locationId, pipelineId: config.pipelineId }),
  });
}

export async function deleteContact(contactId: string) {
  return ghlRequest(`/contacts/${contactId}`, { method: "DELETE" });
}

export async function handleWebhook(eventType: string, payload: unknown): Promise<void> {
  log.info({ eventType }, "GHL webhook received");
  // Process based on event type — ContactCreate, ContactUpdate, OpportunityStageUpdate, AppointmentCreate
}
