/**
 * Wealthbox CRM REST Client
 * https://api.crmworkspace.com/v1/
 */
import { logger } from "../_core/logger";

const log = logger.child({ module: "wealthboxClient" });
const BASE_URL = "https://api.crmworkspace.com/v1";

interface WealthboxConfig {
  accessToken: string;
}

function getConfig(): WealthboxConfig | null {
  const accessToken = process.env.WEALTHBOX_ACCESS_TOKEN;
  if (!accessToken) {
    log.warn("WEALTHBOX_ACCESS_TOKEN not set, client disabled");
    return null;
  }
  return { accessToken };
}

async function request(path: string, options: RequestInit = {}): Promise<any> {
  const config = getConfig();
  if (!config) return null;

  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${config.accessToken}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };

  try {
    const res = await fetch(url, { ...options, headers });

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") || "60");
      log.warn({ retryAfter }, "Wealthbox rate limited");
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      return request(path, options);
    }

    if (!res.ok) {
      log.error({ status: res.status, path }, "Wealthbox API error");
      return null;
    }

    return res.json();
  } catch (err) {
    log.error({ err, path }, "Wealthbox request failed");
    return null;
  }
}

export async function getContacts(page = 1, perPage = 25) {
  return request(`/contacts?page=${page}&per_page=${perPage}`);
}

export async function createContact(data: { first_name: string; last_name: string; email?: string; phone?: string }) {
  return request("/contacts", { method: "POST", body: JSON.stringify({ contact: data }) });
}

export async function updateContact(id: number, data: Record<string, unknown>) {
  return request(`/contacts/${id}`, { method: "PUT", body: JSON.stringify({ contact: data }) });
}

export async function getTasks(page = 1) {
  return request(`/tasks?page=${page}`);
}

export async function createTask(data: { name: string; due_date?: string; assigned_to?: number; contact_id?: number }) {
  return request("/tasks", { method: "POST", body: JSON.stringify({ task: data }) });
}

export async function createNote(data: { content: string; contact_id: number }) {
  return request("/notes", { method: "POST", body: JSON.stringify({ note: data }) });
}
