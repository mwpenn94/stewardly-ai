/**
 * Redtail CRM REST Client
 */
import { logger } from "../_core/logger";

const log = logger.child({ module: "redtailClient" });
const BASE_URL = "https://smf.crm3.redtailtechnology.com/api/public/v1";

function getHeaders(): Record<string, string> | null {
  const apiKey = process.env.REDTAIL_API_KEY;
  const userKey = process.env.REDTAIL_USER_KEY;
  if (!apiKey || !userKey) {
    log.warn("REDTAIL_API_KEY or REDTAIL_USER_KEY not set, client disabled");
    return null;
  }
  return {
    "Authorization": `Userkeyauth ${userKey}`,
    "Content-Type": "application/json",
    "Include-Count": "true",
  };
}

async function request(path: string, options: RequestInit = {}): Promise<any> {
  const headers = getHeaders();
  if (!headers) return null;

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers as Record<string, string> || {}) },
    });

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") || "60");
      log.warn({ retryAfter }, "Redtail rate limited");
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      return request(path, options);
    }

    if (!res.ok) {
      log.error({ status: res.status, path }, "Redtail API error");
      return null;
    }
    return res.json();
  } catch (err) {
    log.error({ err, path }, "Redtail request failed");
    return null;
  }
}

export async function getContacts(page = 1, perPage = 25) {
  return request(`/contacts?page=${page}&page_size=${perPage}`);
}

export async function createActivity(data: { subject: string; start_date: string; contact_id: number; activity_type?: string }) {
  return request("/activities", { method: "POST", body: JSON.stringify(data) });
}

export async function createNote(data: { body: string; contact_id: number }) {
  return request("/notes", { method: "POST", body: JSON.stringify(data) });
}
