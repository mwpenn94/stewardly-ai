import { getDb } from "../db";
import { crmSyncLog } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { encrypt, decrypt } from "./encryption";

// ─── CRM Adapter Interface ──────────────────────────────────────────────
export interface CRMContact {
  externalId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  company?: string;
  tags?: string[];
  customFields?: Record<string, unknown>;
  updatedAt?: number;
}

export interface CRMActivity {
  externalId: string;
  type: "note" | "meeting" | "task" | "email" | "call";
  subject: string;
  body?: string;
  contactExternalId?: string;
  createdAt?: number;
}

export interface CRMSyncResult {
  provider: string;
  direction: "push" | "pull";
  contactsSynced: number;
  activitiesSynced: number;
  errors: Array<{ entity: string; error: string }>;
  lastSyncAt: number;
}

export interface CRMAdapter {
  provider: string;
  testConnection(credentials: Record<string, string>): Promise<boolean>;
  pullContacts(credentials: Record<string, string>, since?: number): Promise<CRMContact[]>;
  pushContact(credentials: Record<string, string>, contact: CRMContact): Promise<string>;
  pullActivities(credentials: Record<string, string>, since?: number): Promise<CRMActivity[]>;
  pushActivity(credentials: Record<string, string>, activity: CRMActivity): Promise<string>;
}

// ─── Wealthbox CRM Adapter ──────────────────────────────────────────────
export class WealthboxAdapter implements CRMAdapter {
  provider = "wealthbox";
  private baseUrl = "https://api.crmworkspace.com/v1";

  private headers(credentials: Record<string, string>) {
    return {
      "Authorization": `Bearer ${credentials.accessToken}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    };
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const resp = await fetch(`${this.baseUrl}/me`, {
        headers: this.headers(credentials),
        signal: AbortSignal.timeout(10000),
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  async pullContacts(credentials: Record<string, string>, since?: number): Promise<CRMContact[]> {
    try {
      let url = `${this.baseUrl}/contacts?per_page=100`;
      if (since) {
        const sinceDate = new Date(since).toISOString();
        url += `&updated_since=${sinceDate}`;
      }
      const resp = await fetch(url, {
        headers: this.headers(credentials),
        signal: AbortSignal.timeout(30000),
      });
      if (!resp.ok) throw new Error(`Wealthbox HTTP ${resp.status}`);
      const data = await resp.json() as any;
      const contacts = data?.contacts || [];
      return contacts.map((c: any) => ({
        externalId: String(c.id),
        firstName: c.first_name || "",
        lastName: c.last_name || "",
        email: c.email_addresses?.[0]?.address,
        phone: c.phone_numbers?.[0]?.number,
        company: c.company_name,
        tags: c.tags?.map((t: any) => t.name) || [],
        customFields: c.custom_fields || {},
        updatedAt: c.updated_at ? new Date(c.updated_at).getTime() : undefined,
      }));
    } catch (err: any) {
      console.error("[CRM:Wealthbox] Pull contacts error:", err.message);
      return [];
    }
  }

  async pushContact(credentials: Record<string, string>, contact: CRMContact): Promise<string> {
    try {
      const body = {
        first_name: contact.firstName,
        last_name: contact.lastName,
        email_addresses: contact.email ? [{ address: contact.email, kind: "work" }] : [],
        phone_numbers: contact.phone ? [{ number: contact.phone, kind: "work" }] : [],
        company_name: contact.company,
        tags: contact.tags?.map(t => ({ name: t })) || [],
      };
      const resp = await fetch(`${this.baseUrl}/contacts`, {
        method: "POST",
        headers: this.headers(credentials),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) throw new Error(`Wealthbox push HTTP ${resp.status}`);
      const data = await resp.json() as any;
      return String(data.id);
    } catch (err: any) {
      console.error("[CRM:Wealthbox] Push contact error:", err.message);
      throw err;
    }
  }

  async pullActivities(credentials: Record<string, string>, since?: number): Promise<CRMActivity[]> {
    try {
      let url = `${this.baseUrl}/events?per_page=100`;
      if (since) {
        url += `&updated_since=${new Date(since).toISOString()}`;
      }
      const resp = await fetch(url, {
        headers: this.headers(credentials),
        signal: AbortSignal.timeout(30000),
      });
      if (!resp.ok) return [];
      const data = await resp.json() as any;
      const events = data?.events || [];
      return events.map((e: any) => ({
        externalId: String(e.id),
        type: mapWealthboxEventType(e.kind),
        subject: e.title || e.subject || "",
        body: e.description || "",
        contactExternalId: e.linked_to?.[0]?.id ? String(e.linked_to[0].id) : undefined,
        createdAt: e.created_at ? new Date(e.created_at).getTime() : undefined,
      }));
    } catch (err: any) {
      console.error("[CRM:Wealthbox] Pull activities error:", err.message);
      return [];
    }
  }

  async pushActivity(credentials: Record<string, string>, activity: CRMActivity): Promise<string> {
    try {
      const body = {
        title: activity.subject,
        description: activity.body,
        kind: mapToWealthboxEventType(activity.type),
      };
      const resp = await fetch(`${this.baseUrl}/events`, {
        method: "POST",
        headers: this.headers(credentials),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) throw new Error(`Wealthbox push activity HTTP ${resp.status}`);
      const data = await resp.json() as any;
      return String(data.id);
    } catch (err: any) {
      console.error("[CRM:Wealthbox] Push activity error:", err.message);
      throw err;
    }
  }
}

// ─── Redtail CRM Adapter ───────────────────────────────────────────────
export class RedtailAdapter implements CRMAdapter {
  provider = "redtail";
  private baseUrl = "https://api2.redtailtechnology.com/crm/v1/rest";

  private headers(credentials: Record<string, string>) {
    return {
      "Authorization": `Userkeyauth ${credentials.apiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    };
  }

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const resp = await fetch(`${this.baseUrl}/authentication`, {
        headers: this.headers(credentials),
        signal: AbortSignal.timeout(10000),
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  async pullContacts(credentials: Record<string, string>, since?: number): Promise<CRMContact[]> {
    try {
      let url = `${this.baseUrl}/contacts?page_size=100`;
      if (since) {
        url += `&updated_since=${new Date(since).toISOString()}`;
      }
      const resp = await fetch(url, {
        headers: this.headers(credentials),
        signal: AbortSignal.timeout(30000),
      });
      if (!resp.ok) throw new Error(`Redtail HTTP ${resp.status}`);
      const data = await resp.json() as any;
      const contacts = data?.contacts || [];
      return contacts.map((c: any) => ({
        externalId: String(c.id),
        firstName: c.first_name || "",
        lastName: c.last_name || "",
        email: c.emails?.[0]?.address,
        phone: c.phones?.[0]?.number,
        company: c.company_name,
        tags: c.tag_list || [],
        customFields: c.udfs || {},
        updatedAt: c.updated_at ? new Date(c.updated_at).getTime() : undefined,
      }));
    } catch (err: any) {
      console.error("[CRM:Redtail] Pull contacts error:", err.message);
      return [];
    }
  }

  async pushContact(credentials: Record<string, string>, contact: CRMContact): Promise<string> {
    try {
      const body = {
        first_name: contact.firstName,
        last_name: contact.lastName,
        emails: contact.email ? [{ address: contact.email, email_type: "work" }] : [],
        phones: contact.phone ? [{ number: contact.phone, phone_type: "work" }] : [],
        company_name: contact.company,
        tag_list: contact.tags || [],
      };
      const resp = await fetch(`${this.baseUrl}/contacts`, {
        method: "POST",
        headers: this.headers(credentials),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) throw new Error(`Redtail push HTTP ${resp.status}`);
      const data = await resp.json() as any;
      return String(data.contact?.id || data.id);
    } catch (err: any) {
      console.error("[CRM:Redtail] Push contact error:", err.message);
      throw err;
    }
  }

  async pullActivities(credentials: Record<string, string>, since?: number): Promise<CRMActivity[]> {
    try {
      let url = `${this.baseUrl}/activities?page_size=100`;
      if (since) {
        url += `&updated_since=${new Date(since).toISOString()}`;
      }
      const resp = await fetch(url, {
        headers: this.headers(credentials),
        signal: AbortSignal.timeout(30000),
      });
      if (!resp.ok) return [];
      const data = await resp.json() as any;
      const activities = data?.activities || [];
      return activities.map((a: any) => ({
        externalId: String(a.id),
        type: mapRedtailActivityType(a.type_id),
        subject: a.subject || "",
        body: a.body || a.notes || "",
        contactExternalId: a.contact_id ? String(a.contact_id) : undefined,
        createdAt: a.created_at ? new Date(a.created_at).getTime() : undefined,
      }));
    } catch (err: any) {
      console.error("[CRM:Redtail] Pull activities error:", err.message);
      return [];
    }
  }

  async pushActivity(credentials: Record<string, string>, activity: CRMActivity): Promise<string> {
    try {
      const body = {
        subject: activity.subject,
        body: activity.body,
        type_id: mapToRedtailActivityType(activity.type),
        contact_id: activity.contactExternalId ? parseInt(activity.contactExternalId) : undefined,
      };
      const resp = await fetch(`${this.baseUrl}/activities`, {
        method: "POST",
        headers: this.headers(credentials),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) throw new Error(`Redtail push activity HTTP ${resp.status}`);
      const data = await resp.json() as any;
      return String(data.activity?.id || data.id);
    } catch (err: any) {
      console.error("[CRM:Redtail] Push activity error:", err.message);
      throw err;
    }
  }
}

// ─── Adapter Factory ────────────────────────────────────────────────────
export function getCRMAdapter(provider: string): CRMAdapter {
  switch (provider.toLowerCase()) {
    case "wealthbox": return new WealthboxAdapter();
    case "redtail": return new RedtailAdapter();
    default: throw new Error(`Unsupported CRM provider: ${provider}`);
  }
}

// ─── Sync Orchestrator ──────────────────────────────────────────────────
export async function syncCRM(
  provider: string,
  credentials: Record<string, string>,
  direction: "push" | "pull" | "bidirectional",
  lastSyncAt?: number,
): Promise<CRMSyncResult> {
  const adapter = getCRMAdapter(provider);
  const result: CRMSyncResult = {
    provider,
    direction: direction === "bidirectional" ? "pull" : direction,
    contactsSynced: 0,
    activitiesSynced: 0,
    errors: [],
    lastSyncAt: Date.now(),
  };

  try {
    if (direction === "pull" || direction === "bidirectional") {
      const contacts = await adapter.pullContacts(credentials, lastSyncAt);
      result.contactsSynced += contacts.length;
      const activities = await adapter.pullActivities(credentials, lastSyncAt);
      result.activitiesSynced += activities.length;
    }
  } catch (err: any) {
    result.errors.push({ entity: "pull", error: err.message });
  }

  // Log sync
  const db = await getDb();
  if (db) {
    await db.insert(crmSyncLog).values({
      crmProvider: provider,
      direction: direction === "bidirectional" ? "pull" : direction,
      syncType: "contacts",
      recordsSynced: result.contactsSynced + result.activitiesSynced,
      status: result.errors.length > 0 ? "failed" : "completed",
      errorDetails: result.errors.length > 0 ? JSON.stringify(result.errors) : null,
      completedAt: new Date(),
    });
  }

  return result;
}

// ─── Helper Mappers ─────────────────────────────────────────────────────
function mapWealthboxEventType(kind: string): CRMActivity["type"] {
  const map: Record<string, CRMActivity["type"]> = {
    note: "note", meeting: "meeting", task: "task", email: "email", call: "call",
  };
  return map[kind?.toLowerCase()] || "note";
}

function mapToWealthboxEventType(type: CRMActivity["type"]): string {
  return type;
}

function mapRedtailActivityType(typeId: number): CRMActivity["type"] {
  const map: Record<number, CRMActivity["type"]> = {
    1: "note", 2: "meeting", 3: "task", 4: "email", 5: "call",
  };
  return map[typeId] || "note";
}

function mapToRedtailActivityType(type: CRMActivity["type"]): number {
  const map: Record<string, number> = {
    note: 1, meeting: 2, task: 3, email: 4, call: 5,
  };
  return map[type] || 1;
}
