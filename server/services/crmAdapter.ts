import { getDb } from "../db";
import { crmSyncLog, leadPipeline } from "../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { encrypt, decrypt } from "./encryption";
import { logger } from "../_core/logger";
import crypto from "crypto";

// ─── CRM Adapter Interface ──────────────────────────────────────────────
export interface CRMContact {
  externalId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  city?: string;
  state?: string;
  linkedinUrl?: string;
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
  contactsCreated: number;
  contactsUpdated: number;
  activitiesSynced: number;
  errors: Array<{ entity: string; error: string }>;
  lastSyncAt: number;
  error?: string;
}

export interface CRMAdapter {
  provider: string;
  testConnection(credentials: Record<string, string>): Promise<boolean>;
  pullContacts(credentials: Record<string, string>, since?: number): Promise<CRMContact[]>;
  pushContact(credentials: Record<string, string>, contact: CRMContact): Promise<string>;
  pullActivities(credentials: Record<string, string>, since?: number): Promise<CRMActivity[]>;
  pushActivity(credentials: Record<string, string>, activity: CRMActivity): Promise<string>;
}

// ─── Hash Helpers ───────────────────────────────────────────────────────
export function hashEmail(email: string): string {
  return crypto.createHash("sha256").update(email.toLowerCase().trim()).digest("hex");
}

export function hashPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return crypto.createHash("sha256").update(digits).digest("hex");
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
      logger.error({ operation: "crmAdapter", err }, "[CRM:Wealthbox] Pull contacts error:", err.message);
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
      logger.error({ operation: "crmAdapter", err }, "[CRM:Wealthbox] Push contact error:", err.message);
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
      logger.error({ operation: "crmAdapter", err }, "[CRM:Wealthbox] Pull activities error:", err.message);
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
      logger.error({ operation: "crmAdapter", err }, "[CRM:Wealthbox] Push activity error:", err.message);
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
      logger.error({ operation: "crmAdapter", err }, "[CRM:Redtail] Pull contacts error:", err.message);
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
      logger.error({ operation: "crmAdapter", err }, "[CRM:Redtail] Push contact error:", err.message);
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
      logger.error({ operation: "crmAdapter", err }, "[CRM:Redtail] Pull activities error:", err.message);
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
      logger.error({ operation: "crmAdapter", err }, "[CRM:Redtail] Push activity error:", err.message);
      throw err;
    }
  }
}

// ─── Salesforce CRM Adapter ────────────────────────────────────────────
export class SalesforceAdapter implements CRMAdapter {
  provider = "salesforce";
  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    const instanceUrl = credentials.instanceUrl || "https://login.salesforce.com";
    try {
      const resp = await fetch(`${instanceUrl}/services/data/v59.0/`, {
        headers: { "Authorization": `Bearer ${credentials.accessToken}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(10000),
      });
      return resp.ok;
    } catch { return false; }
  }
  async pullContacts(credentials: Record<string, string>, since?: number): Promise<CRMContact[]> {
    try {
      const instanceUrl = credentials.instanceUrl || "https://login.salesforce.com";
      let soql = "SELECT Id, FirstName, LastName, Email, Phone, Account.Name FROM Contact";
      if (since) soql += ` WHERE LastModifiedDate > ${new Date(since).toISOString()}`;
      soql += " LIMIT 200";
      const resp = await fetch(`${instanceUrl}/services/data/v59.0/query?q=${encodeURIComponent(soql)}`, {
        headers: { "Authorization": `Bearer ${credentials.accessToken}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(30000),
      });
      if (!resp.ok) throw new Error(`Salesforce HTTP ${resp.status}`);
      const data = await resp.json() as any;
      return (data.records || []).map((c: any) => ({
        externalId: c.Id, firstName: c.FirstName || "", lastName: c.LastName || "",
        email: c.Email, phone: c.Phone, company: c.Account?.Name,
        tags: [], customFields: {},
        updatedAt: c.LastModifiedDate ? new Date(c.LastModifiedDate).getTime() : undefined,
      }));
    } catch (err: any) {
      logger.error({ operation: "crmAdapter", err }, "[CRM:Salesforce] Pull contacts error:", err.message);
      return [];
    }
  }
  async pushContact(credentials: Record<string, string>, contact: CRMContact): Promise<string> {
    try {
      const instanceUrl = credentials.instanceUrl || "https://login.salesforce.com";
      const resp = await fetch(`${instanceUrl}/services/data/v59.0/sobjects/Contact/`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${credentials.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ FirstName: contact.firstName, LastName: contact.lastName, Email: contact.email, Phone: contact.phone }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await resp.json() as any;
      return data.id || "";
    } catch (err: any) {
      logger.error({ operation: "crmAdapter", err }, "[CRM:Salesforce] Push contact error:", err.message);
      return "";
    }
  }
  async pullActivities(): Promise<CRMActivity[]> { return []; }
  async pushActivity(): Promise<string> { return ""; }
}

// ─── GoHighLevel CRM Adapter (uses GHL_API_KEY env var) ─────────────────
export class GoHighLevelCRMAdapter implements CRMAdapter {
  provider = "gohighlevel";
  private baseUrl = "https://services.leadconnectorhq.com";
  private headers(credentials: Record<string, string>) {
    return {
      "Authorization": `Bearer ${credentials.apiToken || credentials.accessToken || process.env.GHL_API_KEY || ""}`,
      "Content-Type": "application/json",
      "Version": "2021-07-28",
    };
  }
  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const locationId = credentials.locationId || process.env.GHL_LOCATION_ID || "";
      const resp = await fetch(`${this.baseUrl}/contacts/?locationId=${locationId}&limit=1`, {
        headers: this.headers(credentials), signal: AbortSignal.timeout(10000),
      });
      return resp.ok;
    } catch { return false; }
  }
  async pullContacts(credentials: Record<string, string>, since?: number): Promise<CRMContact[]> {
    try {
      const locationId = credentials.locationId || process.env.GHL_LOCATION_ID || "";
      const allContacts: CRMContact[] = [];
      let nextPageUrl: string | null = `${this.baseUrl}/contacts/?locationId=${locationId}&limit=100`;

      // Paginate through all contacts
      while (nextPageUrl) {
        const resp = await fetch(nextPageUrl, {
          headers: this.headers(credentials), signal: AbortSignal.timeout(30000),
        });
        if (!resp.ok) throw new Error(`GHL HTTP ${resp.status}`);
        const data = await resp.json() as any;
        const contacts = (data.contacts || []).map((c: any) => ({
          externalId: c.id,
          firstName: c.firstName || "",
          lastName: c.lastName || "",
          email: c.email,
          phone: c.phone,
          company: c.companyName,
          title: c.type || "",
          city: c.city || "",
          state: c.state || "",
          tags: c.tags || [],
          customFields: c.customField || {},
          updatedAt: c.dateAdded ? new Date(c.dateAdded).getTime() : undefined,
        }));
        allContacts.push(...contacts);

        // GHL v2 pagination: check for nextPageUrl or meta.nextPageUrl
        nextPageUrl = data.meta?.nextPageUrl || null;
        if (!nextPageUrl && data.meta?.nextPage) {
          nextPageUrl = `${this.baseUrl}/contacts/?locationId=${locationId}&limit=100&startAfterId=${contacts[contacts.length - 1]?.externalId}`;
        }
        // Safety: stop after 10k contacts to prevent infinite loops
        if (allContacts.length >= 10000) break;
      }

      return allContacts;
    } catch (err: any) {
      logger.error({ operation: "crmAdapter", err }, "[CRM:GHL] Pull contacts error:", err.message);
      return [];
    }
  }
  async pushContact(credentials: Record<string, string>, contact: CRMContact): Promise<string> {
    try {
      const locationId = credentials.locationId || process.env.GHL_LOCATION_ID || "";
      const resp = await fetch(`${this.baseUrl}/contacts/`, {
        method: "POST", headers: this.headers(credentials),
        body: JSON.stringify({ locationId, firstName: contact.firstName, lastName: contact.lastName, email: contact.email, phone: contact.phone, tags: contact.tags }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await resp.json() as any;
      return data.contact?.id || "";
    } catch (err: any) {
      logger.error({ operation: "crmAdapter", err }, "[CRM:GHL] Push contact error:", err.message);
      return "";
    }
  }
  async pullActivities(): Promise<CRMActivity[]> { return []; }
  async pushActivity(credentials: Record<string, string>, activity: CRMActivity): Promise<string> {
    try {
      if (!activity.contactExternalId) return "";
      const resp = await fetch(`${this.baseUrl}/contacts/${activity.contactExternalId}/notes`, {
        method: "POST", headers: this.headers(credentials),
        body: JSON.stringify({ body: `[${activity.type}] ${activity.subject}\n${activity.body || ""}` }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await resp.json() as any;
      return data.id || "";
    } catch (err: any) {
      logger.error({ operation: "crmAdapter", err }, "[CRM:GHL] Push activity error:", err.message);
      return "";
    }
  }
}

// ─── SMS-iT CRM Adapter ────────────────────────────────────────────────
export class SMSiTAdapter implements CRMAdapter {
  provider = "smsit";
  private getConfig() {
    const apiKey = process.env.SMSIT_API_KEY;
    const apiUrl = process.env.SMSIT_API_URL || "https://tool-it.smsit.ai/api";
    return { apiKey, apiUrl };
  }
  private headers(credentials: Record<string, string>) {
    const { apiKey } = this.getConfig();
    return {
      "Authorization": `Bearer ${credentials.apiKey || apiKey || ""}`,
      "Content-Type": "application/json",
    };
  }
  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const { apiUrl } = this.getConfig();
      const resp = await fetch(`${apiUrl}/user`, {
        headers: this.headers(credentials), signal: AbortSignal.timeout(10000),
      });
      return resp.ok;
    } catch { return false; }
  }
  async pullContacts(credentials: Record<string, string>, since?: number): Promise<CRMContact[]> {
    try {
      const { apiUrl } = this.getConfig();
      let url = `${apiUrl}/contacts?limit=100`;
      if (since) url += `&updated_after=${new Date(since).toISOString()}`;
      const resp = await fetch(url, {
        headers: this.headers(credentials), signal: AbortSignal.timeout(30000),
      });
      if (!resp.ok) throw new Error(`SMS-iT HTTP ${resp.status}`);
      const data = await resp.json() as any;
      const contacts = data?.data || data?.contacts || [];
      return contacts.map((c: any) => ({
        externalId: String(c.id || c._id),
        firstName: c.first_name || c.firstName || "",
        lastName: c.last_name || c.lastName || "",
        email: c.email,
        phone: c.phone || c.mobile,
        company: c.company || "",
        tags: c.tags || [],
        customFields: c.custom_fields || {},
        updatedAt: c.updated_at ? new Date(c.updated_at).getTime() : undefined,
      }));
    } catch (err: any) {
      logger.error({ operation: "crmAdapter", err }, "[CRM:SMS-iT] Pull contacts error:", err.message);
      return [];
    }
  }
  async pushContact(credentials: Record<string, string>, contact: CRMContact): Promise<string> {
    try {
      const { apiUrl } = this.getConfig();
      const resp = await fetch(`${apiUrl}/contacts`, {
        method: "POST", headers: this.headers(credentials),
        body: JSON.stringify({ first_name: contact.firstName, last_name: contact.lastName, email: contact.email, phone: contact.phone, tags: contact.tags }),
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) return "";
      const data = await resp.json() as any;
      return String(data.id || data._id || "");
    } catch (err: any) {
      logger.error({ operation: "crmAdapter", err }, "[CRM:SMS-iT] Push contact error:", err.message);
      return "";
    }
  }
  async pullActivities(): Promise<CRMActivity[]> { return []; }
  async pushActivity(): Promise<string> { return ""; }
}

// ─── Dripify CRM Adapter (LinkedIn Automation) ─────────────────────────
export class DripifyAdapter implements CRMAdapter {
  provider = "dripify";
  private baseUrl = "https://api.dripify.io/v1";
  private headers(credentials: Record<string, string>) {
    return {
      "Authorization": `Bearer ${credentials.apiKey || ""}`,
      "Content-Type": "application/json",
    };
  }
  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const resp = await fetch(`${this.baseUrl}/user`, {
        headers: this.headers(credentials), signal: AbortSignal.timeout(10000),
      });
      return resp.ok;
    } catch { return false; }
  }
  async pullContacts(credentials: Record<string, string>, since?: number): Promise<CRMContact[]> {
    try {
      // Dripify API: pull leads from campaigns
      let url = `${this.baseUrl}/leads?limit=100`;
      if (since) url += `&updated_after=${new Date(since).toISOString()}`;
      const resp = await fetch(url, {
        headers: this.headers(credentials), signal: AbortSignal.timeout(30000),
      });
      if (!resp.ok) throw new Error(`Dripify HTTP ${resp.status}`);
      const data = await resp.json() as any;
      const leads = data?.data || data?.leads || [];
      return leads.map((l: any) => ({
        externalId: String(l.id || l._id),
        firstName: l.first_name || l.firstName || "",
        lastName: l.last_name || l.lastName || "",
        email: l.email || "",
        phone: l.phone || "",
        company: l.company_name || l.company || "",
        title: l.headline || l.title || "",
        linkedinUrl: l.linkedin_url || l.profileUrl || "",
        city: l.location?.split(",")[0]?.trim() || "",
        state: l.location?.split(",").pop()?.trim() || "",
        tags: l.tags || [l.campaign_name].filter(Boolean),
        customFields: { campaignName: l.campaign_name, status: l.status },
        updatedAt: l.updated_at ? new Date(l.updated_at).getTime() : undefined,
      }));
    } catch (err: any) {
      logger.error({ operation: "crmAdapter", err }, "[CRM:Dripify] Pull contacts error:", err.message);
      return [];
    }
  }
  async pushContact(): Promise<string> { return ""; } // Dripify is read-only for leads
  async pullActivities(credentials: Record<string, string>, since?: number): Promise<CRMActivity[]> {
    try {
      let url = `${this.baseUrl}/activities?limit=100`;
      if (since) url += `&after=${new Date(since).toISOString()}`;
      const resp = await fetch(url, {
        headers: this.headers(credentials), signal: AbortSignal.timeout(30000),
      });
      if (!resp.ok) return [];
      const data = await resp.json() as any;
      const activities = data?.data || [];
      return activities.map((a: any) => ({
        externalId: String(a.id),
        type: "note" as const,
        subject: a.action_type || a.type || "Dripify Activity",
        body: a.message || a.description || "",
        contactExternalId: a.lead_id ? String(a.lead_id) : undefined,
        createdAt: a.created_at ? new Date(a.created_at).getTime() : undefined,
      }));
    } catch (err: any) {
      logger.error({ operation: "crmAdapter", err }, "[CRM:Dripify] Pull activities error:", err.message);
      return [];
    }
  }
  async pushActivity(): Promise<string> { return ""; }
}

// ─── LinkedIn / Sales Navigator Adapter ─────────────────────────────────
export class LinkedInAdapter implements CRMAdapter {
  provider = "linkedin";
  private baseUrl = "https://api.linkedin.com/v2";
  private headers(credentials: Record<string, string>) {
    return {
      "Authorization": `Bearer ${credentials.accessToken || ""}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    };
  }
  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const resp = await fetch(`${this.baseUrl}/me`, {
        headers: this.headers(credentials), signal: AbortSignal.timeout(10000),
      });
      return resp.ok;
    } catch { return false; }
  }
  async pullContacts(credentials: Record<string, string>, since?: number): Promise<CRMContact[]> {
    try {
      // LinkedIn Connections API
      const resp = await fetch(`${this.baseUrl}/connections?q=viewer&count=100&start=0`, {
        headers: this.headers(credentials), signal: AbortSignal.timeout(30000),
      });
      if (!resp.ok) throw new Error(`LinkedIn HTTP ${resp.status}`);
      const data = await resp.json() as any;
      const elements = data?.elements || [];
      return elements.map((c: any) => ({
        externalId: c.id || c.miniProfile?.entityUrn || "",
        firstName: c.firstName?.localized?.en_US || c.miniProfile?.firstName || "",
        lastName: c.lastName?.localized?.en_US || c.miniProfile?.lastName || "",
        email: "", // LinkedIn doesn't expose emails via connections API
        phone: "",
        company: c.miniProfile?.occupation || "",
        title: c.headline?.localized?.en_US || "",
        linkedinUrl: c.miniProfile?.publicIdentifier ? `https://linkedin.com/in/${c.miniProfile.publicIdentifier}` : "",
        tags: ["linkedin_connection"],
        customFields: {},
        updatedAt: c.createdAt || undefined,
      }));
    } catch (err: any) {
      logger.error({ operation: "crmAdapter", err }, "[CRM:LinkedIn] Pull contacts error:", err.message);
      return [];
    }
  }
  async pushContact(): Promise<string> { return ""; } // LinkedIn is read-only
  async pullActivities(): Promise<CRMActivity[]> { return []; }
  async pushActivity(): Promise<string> { return ""; }
}

// ─── Workable Adapter (Recruiting/HR) ───────────────────────────────────
export class WorkableAdapter implements CRMAdapter {
  provider = "workable";
  private headers(credentials: Record<string, string>) {
    return {
      "Authorization": `Bearer ${credentials.apiKey || credentials.accessToken || ""}`,
      "Content-Type": "application/json",
    };
  }
  private getBaseUrl(credentials: Record<string, string>): string {
    const subdomain = credentials.subdomain || credentials.accountName || "app";
    return `https://${subdomain}.workable.com/spi/v3`;
  }
  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    try {
      const resp = await fetch(`${this.getBaseUrl(credentials)}/members`, {
        headers: this.headers(credentials), signal: AbortSignal.timeout(10000),
      });
      return resp.ok;
    } catch { return false; }
  }
  async pullContacts(credentials: Record<string, string>, since?: number): Promise<CRMContact[]> {
    try {
      let url = `${this.getBaseUrl(credentials)}/candidates?limit=100`;
      if (since) url += `&updated_after=${new Date(since).toISOString()}`;
      const resp = await fetch(url, {
        headers: this.headers(credentials), signal: AbortSignal.timeout(30000),
      });
      if (!resp.ok) throw new Error(`Workable HTTP ${resp.status}`);
      const data = await resp.json() as any;
      const candidates = data?.candidates || [];
      return candidates.map((c: any) => ({
        externalId: String(c.id),
        firstName: c.firstname || c.name?.split(" ")[0] || "",
        lastName: c.lastname || c.name?.split(" ").slice(1).join(" ") || "",
        email: c.email,
        phone: c.phone,
        company: c.headline || "",
        title: c.headline || "",
        city: c.address?.city || "",
        state: c.address?.region || "",
        tags: c.tags || ["workable_candidate"],
        customFields: { stage: c.stage, disqualified: c.disqualified, job: c.job?.title },
        updatedAt: c.updated_at ? new Date(c.updated_at).getTime() : undefined,
      }));
    } catch (err: any) {
      logger.error({ operation: "crmAdapter", err }, "[CRM:Workable] Pull contacts error:", err.message);
      return [];
    }
  }
  async pushContact(credentials: Record<string, string>, contact: CRMContact): Promise<string> {
    try {
      const resp = await fetch(`${this.getBaseUrl(credentials)}/candidates`, {
        method: "POST", headers: this.headers(credentials),
        body: JSON.stringify({
          firstname: contact.firstName, lastname: contact.lastName,
          email: contact.email, phone: contact.phone, headline: contact.title,
          tags: contact.tags,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) throw new Error(`Workable push HTTP ${resp.status}`);
      const data = await resp.json() as any;
      return String(data.id || "");
    } catch (err: any) {
      logger.error({ operation: "crmAdapter", err }, "[CRM:Workable] Push contact error:", err.message);
      return "";
    }
  }
  async pullActivities(credentials: Record<string, string>, since?: number): Promise<CRMActivity[]> {
    try {
      let url = `${this.getBaseUrl(credentials)}/events?limit=100`;
      if (since) url += `&since=${new Date(since).toISOString()}`;
      const resp = await fetch(url, {
        headers: this.headers(credentials), signal: AbortSignal.timeout(30000),
      });
      if (!resp.ok) return [];
      const data = await resp.json() as any;
      return (data?.events || []).map((e: any) => ({
        externalId: String(e.id),
        type: "note" as const,
        subject: e.action || e.type || "Workable Event",
        body: e.body || "",
        contactExternalId: e.candidate_id ? String(e.candidate_id) : undefined,
        createdAt: e.created_at ? new Date(e.created_at).getTime() : undefined,
      }));
    } catch (err: any) {
      logger.error({ operation: "crmAdapter", err }, "[CRM:Workable] Pull activities error:", err.message);
      return [];
    }
  }
  async pushActivity(): Promise<string> { return ""; }
}

// ─── Adapter Factory ────────────────────────────────────────────────────
export function getCRMAdapter(provider: string): CRMAdapter {
  if (!provider || typeof provider !== 'string') {
    throw new Error(`Unsupported CRM provider: ${provider}`);
  }
  switch (provider.toLowerCase()) {
    case "wealthbox": return new WealthboxAdapter();
    case "redtail": return new RedtailAdapter();
    case "salesforce": return new SalesforceAdapter();
    case "gohighlevel": return new GoHighLevelCRMAdapter();
    case "smsit": return new SMSiTAdapter();
    case "dripify": return new DripifyAdapter();
    case "linkedin": return new LinkedInAdapter();
    case "workable": return new WorkableAdapter();
    default: throw new Error(`Unsupported CRM provider: ${provider}`);
  }
}

// ─── Contact Persistence (upsert into leadPipeline) ─────────────────────
export async function persistContactsToLeadPipeline(
  contacts: CRMContact[],
  provider: string,
): Promise<{ created: number; updated: number; errors: number }> {
  const db = await getDb();
  if (!db) return { created: 0, updated: 0, errors: 0 };

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const contact of contacts) {
    try {
      // Normalize email for dedup
      const email = contact.email?.toLowerCase().trim() || null;
      if (!email) {
        // No email — skip if also no phone
        if (!contact.phone) {
          errors++;
          continue;
        }
      }
      const phone = contact.phone || null;

      // Build the ghlContactId field based on provider
      const ghlContactId = provider === "gohighlevel" ? contact.externalId : null;

      // Check if contact already exists by email
      const existing = email
        ? await db.select({ id: leadPipeline.id })
            .from(leadPipeline)
            .where(eq(leadPipeline.email, email))
            .limit(1)
        : [];

      if (existing.length > 0) {
        // Update existing contact
        await db.update(leadPipeline)
          .set({
            firstName: contact.firstName || undefined,
            lastName: contact.lastName || undefined,
            phone: phone || undefined,
            company: contact.company || undefined,
            title: contact.title || undefined,
            city: contact.city || undefined,
            state: contact.state || undefined,
            linkedinUrl: contact.linkedinUrl || undefined,
            enrichmentData: contact.customFields ? JSON.stringify(contact.customFields) : undefined,
            ...(ghlContactId ? { ghlContactId } : {}),
            updatedAt: Date.now(),
          })
          .where(eq(leadPipeline.id, existing[0]!.id));
        updated++;
      } else {
        // Insert new contact
        await db.insert(leadPipeline).values({
          email,
          firstName: contact.firstName || null,
          lastName: contact.lastName || null,
          phone,
          company: contact.company || null,
          title: contact.title || null,
          city: contact.city || null,
          state: contact.state || null,
          linkedinUrl: contact.linkedinUrl || null,
          enrichmentData: contact.customFields ? JSON.stringify(contact.customFields) : null,
          ghlContactId,
          status: "new",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        created++;
      }
    } catch (err: any) {
      logger.error({ operation: "crmAdapter", err }, `[CRM:${provider}] Persist contact error:`, err.message);
      errors++;
    }
  }

  return { created, updated, errors };
}

// ─── Sync Orchestrator (REAL — persists to DB) ──────────────────────────
export async function syncCRM(
  provider: string,
  credentials: Record<string, string>,
  direction: "push" | "pull" | "bidirectional",
  lastSyncAt?: number,
): Promise<CRMSyncResult> {
  let adapter: CRMAdapter;
  try {
    adapter = getCRMAdapter(provider);
  } catch (err: any) {
    return {
      provider: typeof provider === 'string' ? provider : String(provider),
      direction: direction === "bidirectional" ? "pull" : direction,
      contactsSynced: 0,
      contactsCreated: 0,
      contactsUpdated: 0,
      activitiesSynced: 0,
      errors: [{ entity: "adapter", error: err.message }],
      lastSyncAt: Date.now(),
      error: err.message,
    };
  }
  const result: CRMSyncResult = {
    provider,
    direction: direction === "bidirectional" ? "pull" : direction,
    contactsSynced: 0,
    contactsCreated: 0,
    contactsUpdated: 0,
    activitiesSynced: 0,
    errors: [],
    lastSyncAt: Date.now(),
  };

  // ─── PULL direction ─────────────────────────────────────────────────
  try {
    if (direction === "pull" || direction === "bidirectional") {
      const contacts = await adapter.pullContacts(credentials, lastSyncAt);
      logger.info({ provider, contactsPulled: contacts.length }, `[CRM:${provider}] Pulled ${contacts.length} contacts`);

      if (contacts.length > 0) {
        const persistResult = await persistContactsToLeadPipeline(contacts, provider);
        result.contactsSynced += persistResult.created + persistResult.updated;
        result.contactsCreated += persistResult.created;
        result.contactsUpdated += persistResult.updated;
        if (persistResult.errors > 0) {
          result.errors.push({ entity: "contacts", error: `${persistResult.errors} contacts failed to persist` });
        }
        logger.info({ provider, created: persistResult.created, updated: persistResult.updated, errors: persistResult.errors },
          `[CRM:${provider}] Persisted: ${persistResult.created} created, ${persistResult.updated} updated, ${persistResult.errors} errors`);
      }

      const activities = await adapter.pullActivities(credentials, lastSyncAt);
      result.activitiesSynced += activities.length;
    }
  } catch (err: any) {
    result.errors.push({ entity: "pull", error: err.message });
    logger.error({ operation: "crmAdapter", err, provider }, `[CRM:${provider}] Pull error:`, err.message);
  }

  // ─── PUSH direction ─────────────────────────────────────────────────
  try {
    if (direction === "push" || direction === "bidirectional") {
      const pushResult = await pushLeadsToCRM(adapter, provider, credentials, lastSyncAt);
      result.contactsSynced += pushResult.pushed;
      result.contactsCreated += pushResult.created;
      result.contactsUpdated += pushResult.updated;
      if (pushResult.errors > 0) {
        result.errors.push({ entity: "push", error: `${pushResult.errors} contacts failed to push` });
      }
      logger.info({ provider, pushed: pushResult.pushed, created: pushResult.created, updated: pushResult.updated, errors: pushResult.errors },
        `[CRM:${provider}] Pushed: ${pushResult.created} created, ${pushResult.updated} updated, ${pushResult.errors} errors`);
    }
  } catch (err: any) {
    result.errors.push({ entity: "push", error: err.message });
    logger.error({ operation: "crmAdapter", err, provider }, `[CRM:${provider}] Push error:`, err.message);
  }

  // Log sync to crmSyncLog
  const db = await getDb();
  if (db) {
    await db.insert(crmSyncLog).values({
      crmProvider: provider,
      direction: direction,
      syncType: "contacts",
      recordsSynced: result.contactsSynced + result.activitiesSynced,
      status: result.errors.length > 0 ? "failed" : "completed",
      errorDetails: result.errors.length > 0 ? JSON.stringify(result.errors) : null,
      completedAt: new Date(),
    });
  }

  return result;
}

/**
 * Push leads from lead_pipeline to an external CRM.
 * Reads leads that haven't been synced to this provider yet (no crmExternalId for this provider).
 * Uses raw SQL because actual DB columns are camelCase (not matching Drizzle schema).
 */
async function pushLeadsToCRM(
  adapter: CRMAdapter,
  provider: string,
  credentials: Record<string, string>,
  since?: number,
): Promise<{ pushed: number; created: number; updated: number; errors: number }> {
  const { getRawPool } = await import("../db");
  const pool = await getRawPool();
  if (!pool) return { pushed: 0, created: 0, updated: 0, errors: 0 };

  let created = 0;
  let updated = 0;
  let errors = 0;

  // Read leads that need to be pushed to this provider
  // For GHL: check crmExternalId is null (not yet pushed)
  // For others: check source !== provider (not originally from this CRM)
  let query = `
    SELECT id, firstName, lastName, email, phone, source, status, crmExternalId,
           primaryInterest, estimatedIncome, notesJson
    FROM lead_pipeline
    WHERE email IS NOT NULL AND email != ''
  `;
  const params: any[] = [];

  if (since) {
    query += " AND updated_at > ?";
    params.push(since);
  }

  // Don't push leads that originally came from this provider (avoid circular sync)
  query += " AND (source IS NULL OR source != ?)";
  params.push(provider);

  // Limit batch size to avoid overwhelming external APIs
  query += " ORDER BY id DESC LIMIT 100";

  const [rows] = await pool.query(query, params) as any;
  const leads = rows as any[];

  logger.info({ provider, leadsToSync: leads.length }, `[CRM:${provider}] Found ${leads.length} leads to push`);

  for (const lead of leads) {
    try {
      const contact: CRMContact = {
        externalId: lead.crmExternalId || "",
        firstName: lead.firstName || "",
        lastName: lead.lastName || "",
        email: lead.email,
        phone: lead.phone || undefined,
        tags: ["stewardly-synced", lead.status || "new"],
        customFields: {
          stewardlyId: lead.id,
          primaryInterest: lead.primaryInterest,
          source: lead.source,
        },
      };

      // If lead already has a crmExternalId, it was previously pushed — skip or update
      if (lead.crmExternalId && provider === "gohighlevel") {
        // Update existing contact in external CRM
        try {
          await adapter.pushContact(credentials, { ...contact, externalId: lead.crmExternalId });
          updated++;
        } catch {
          errors++;
        }
        continue;
      }

      // Push new contact
      const externalId = await adapter.pushContact(credentials, contact);

      if (externalId) {
        // Update lead_pipeline with the external CRM ID
        await pool.query(
          "UPDATE lead_pipeline SET crmExternalId = ?, updated_at = ? WHERE id = ?",
          [externalId, Date.now(), lead.id],
        );
        created++;
      } else {
        // pushContact returned empty string — platform may be read-only
        errors++;
      }

      // Rate limiting — 200ms between API calls
      await new Promise(r => setTimeout(r, 200));
    } catch (err: any) {
      logger.error({ operation: "crmAdapter", err, provider, leadId: lead.id }, `[CRM:${provider}] Push lead error:`, err.message);
      errors++;
    }
  }

  return { pushed: created + updated, created, updated, errors };
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
