/**
 * Integration Failover Service
 *
 * Provides demo/sandbox data when live credentials are unavailable.
 * Each integration has a realistic data generator that mirrors the real API
 * response shape. When credentials become available, the system seamlessly
 * switches to live mode — no code changes needed.
 *
 * Failover strategy:
 *   1. Check if credentials exist for the provider
 *   2. If yes → use live adapter (real API calls)
 *   3. If no  → return demo data with [DEMO] markers
 *   4. Log failover events for monitoring
 */

import { logger } from "../_core/logger";
import type { CRMContact, CRMActivity } from "./crmAdapter";

const log = logger.child({ module: "integrationFailover" });

// ═══════════════════════════════════════════════════════════════════════
// Demo Data Generators
// ═══════════════════════════════════════════════════════════════════════

const DEMO_FIRST_NAMES = ["James", "Sarah", "Michael", "Emily", "Robert", "Jennifer", "David", "Lisa", "William", "Amanda"];
const DEMO_LAST_NAMES = ["Anderson", "Mitchell", "Thompson", "Garcia", "Martinez", "Robinson", "Clark", "Rodriguez", "Lewis", "Lee"];
const DEMO_COMPANIES = [
  "Meridian Wealth Partners", "Apex Financial Group", "Cornerstone Advisory",
  "Pinnacle Capital Management", "Summit Investment Advisors", "Horizon Financial Planning",
  "Vanguard Wealth Solutions", "Keystone Financial Services", "Atlas Capital Group",
  "Sterling Financial Advisors",
];
const DEMO_TAGS = ["high-net-worth", "retirement-planning", "estate-planning", "tax-optimization", "business-owner", "young-professional"];

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateDemoId(prefix: string, index: number): string {
  return `${prefix}_demo_${String(index).padStart(4, "0")}`;
}

// ─── GoHighLevel Demo Data ──────────────────────────────────────────────

export interface GHLDemoContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  companyName: string;
  tags: string[];
  source: string;
  dateAdded: string;
  customFields: Record<string, string>;
  _demo: true;
}

export interface GHLDemoPipeline {
  id: string;
  name: string;
  stages: { id: string; name: string; position: number }[];
  _demo: true;
}

export interface GHLDemoOpportunity {
  id: string;
  name: string;
  pipelineId: string;
  stageId: string;
  status: string;
  monetaryValue: number;
  contactId: string;
  _demo: true;
}

export function generateGHLDemoContacts(count = 25): GHLDemoContact[] {
  return Array.from({ length: count }, (_, i) => {
    const first = randomPick(DEMO_FIRST_NAMES);
    const last = randomPick(DEMO_LAST_NAMES);
    return {
      id: generateDemoId("ghl_contact", i),
      firstName: first,
      lastName: last,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@${randomPick(["gmail.com", "outlook.com", "yahoo.com"])}`,
      phone: `+1${String(Math.floor(2000000000 + Math.random() * 8000000000))}`,
      companyName: randomPick(DEMO_COMPANIES),
      tags: [randomPick(DEMO_TAGS), randomPick(DEMO_TAGS)].filter((v, idx, a) => a.indexOf(v) === idx),
      source: randomPick(["Website", "Referral", "LinkedIn", "Seminar", "Cold Call"]),
      dateAdded: new Date(Date.now() - Math.random() * 180 * 86400000).toISOString(),
      customFields: {
        "AUM Range": randomPick(["$100K-$500K", "$500K-$1M", "$1M-$5M", "$5M+"]),
        "Life Stage": randomPick(["Pre-Retirement", "Retirement", "Accumulation", "Distribution"]),
      },
      _demo: true,
    };
  });
}

export function generateGHLDemoPipelines(): GHLDemoPipeline[] {
  return [
    {
      id: "ghl_pipeline_demo_0001",
      name: "Financial Planning Pipeline",
      stages: [
        { id: "stage_1", name: "Lead", position: 0 },
        { id: "stage_2", name: "Discovery Call", position: 1 },
        { id: "stage_3", name: "Needs Analysis", position: 2 },
        { id: "stage_4", name: "Proposal", position: 3 },
        { id: "stage_5", name: "Closed Won", position: 4 },
        { id: "stage_6", name: "Closed Lost", position: 5 },
      ],
      _demo: true,
    },
    {
      id: "ghl_pipeline_demo_0002",
      name: "Insurance Pipeline",
      stages: [
        { id: "stage_a", name: "Inquiry", position: 0 },
        { id: "stage_b", name: "Underwriting", position: 1 },
        { id: "stage_c", name: "Policy Issued", position: 2 },
        { id: "stage_d", name: "In Force", position: 3 },
      ],
      _demo: true,
    },
  ];
}

export function generateGHLDemoOpportunities(count = 15): GHLDemoOpportunity[] {
  const pipelines = generateGHLDemoPipelines();
  return Array.from({ length: count }, (_, i) => {
    const pipeline = randomPick(pipelines);
    const stage = randomPick(pipeline.stages);
    return {
      id: generateDemoId("ghl_opp", i),
      name: `${randomPick(DEMO_FIRST_NAMES)} ${randomPick(DEMO_LAST_NAMES)} — ${randomPick(["Retirement Plan", "Life Insurance", "Estate Plan", "Tax Strategy"])}`,
      pipelineId: pipeline.id,
      stageId: stage.id,
      status: stage.name === "Closed Won" ? "won" : stage.name === "Closed Lost" ? "lost" : "open",
      monetaryValue: Math.round((50000 + Math.random() * 450000) / 100) * 100,
      contactId: generateDemoId("ghl_contact", Math.floor(Math.random() * 25)),
      _demo: true,
    };
  });
}

// ─── Wealthbox Demo Data ────────────────────────────────────────────────

export function generateWealthboxDemoContacts(count = 20): CRMContact[] {
  return Array.from({ length: count }, (_, i) => {
    const first = randomPick(DEMO_FIRST_NAMES);
    const last = randomPick(DEMO_LAST_NAMES);
    return {
      externalId: generateDemoId("wb_contact", i),
      firstName: `[DEMO] ${first}`,
      lastName: last,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
      phone: `+1${String(Math.floor(2000000000 + Math.random() * 8000000000))}`,
      company: randomPick(DEMO_COMPANIES),
      tags: [randomPick(DEMO_TAGS), "demo-data"],
      customFields: {
        aum: String(Math.round(100000 + Math.random() * 900000)),
        riskTolerance: randomPick(["Conservative", "Moderate", "Aggressive"]),
      },
      updatedAt: Date.now() - Math.floor(Math.random() * 30 * 86400000),
    };
  });
}

export function generateWealthboxDemoActivities(count = 10): CRMActivity[] {
  return Array.from({ length: count }, (_, i) => ({
    externalId: generateDemoId("wb_activity", i),
    type: randomPick(["meeting" as const, "call" as const, "email" as const, "task" as const]),
    subject: `[DEMO] ${randomPick(["Quarterly Review", "Portfolio Rebalance", "Tax Planning Session", "Estate Plan Update", "Insurance Review", "Retirement Projection"])}`,
    body: "This is demo activity data. Connect your Wealthbox account to see real activities.",
    contactExternalId: generateDemoId("wb_contact", Math.floor(Math.random() * 20)),
    createdAt: Date.now() - Math.floor(Math.random() * 60 * 86400000),
  }));
}

// ─── Redtail Demo Data ──────────────────────────────────────────────────

export function generateRedtailDemoContacts(count = 20): CRMContact[] {
  return Array.from({ length: count }, (_, i) => {
    const first = randomPick(DEMO_FIRST_NAMES);
    const last = randomPick(DEMO_LAST_NAMES);
    return {
      externalId: generateDemoId("rt_contact", i),
      firstName: `[DEMO] ${first}`,
      lastName: last,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
      phone: `+1${String(Math.floor(2000000000 + Math.random() * 8000000000))}`,
      company: randomPick(DEMO_COMPANIES),
      tags: [randomPick(DEMO_TAGS), "demo-data"],
      customFields: {
        clientType: randomPick(["Individual", "Joint", "Trust", "Corporate"]),
        status: randomPick(["Active", "Prospect", "Former"]),
      },
      updatedAt: Date.now() - Math.floor(Math.random() * 30 * 86400000),
    };
  });
}

export function generateRedtailDemoActivities(count = 10): CRMActivity[] {
  return Array.from({ length: count }, (_, i) => ({
    externalId: generateDemoId("rt_activity", i),
    type: randomPick(["meeting" as const, "call" as const, "email" as const, "task" as const]),
    subject: `[DEMO] ${randomPick(["Annual Review", "Compliance Check", "New Account Setup", "Beneficiary Update", "RMD Calculation", "Rollover Processing"])}`,
    body: "This is demo activity data. Connect your Redtail account to see real activities.",
    contactExternalId: generateDemoId("rt_contact", Math.floor(Math.random() * 20)),
    createdAt: Date.now() - Math.floor(Math.random() * 60 * 86400000),
  }));
}

// ─── SMS-iT Demo Data ───────────────────────────────────────────────────

export interface SMSiTDemoMessage {
  id: string;
  to: string;
  from: string;
  body: string;
  channel: string;
  status: string;
  sentAt: string;
  _demo: true;
}

export interface SMSiTDemoCampaign {
  id: string;
  name: string;
  channel: string;
  status: string;
  recipientCount: number;
  sentCount: number;
  openRate: number;
  clickRate: number;
  _demo: true;
}

export function generateSMSiTDemoMessages(count = 15): SMSiTDemoMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    id: generateDemoId("smsit_msg", i),
    to: `+1${String(Math.floor(2000000000 + Math.random() * 8000000000))}`,
    from: "+18005551234",
    body: randomPick([
      "[DEMO] Your quarterly financial review is scheduled for next Tuesday at 2 PM.",
      "[DEMO] Reminder: Open enrollment deadline is approaching. Let's review your options.",
      "[DEMO] Thank you for attending our retirement planning seminar!",
      "[DEMO] Your portfolio has been rebalanced per our discussion.",
      "[DEMO] New tax law changes may affect your estate plan. Schedule a review.",
    ]),
    channel: randomPick(["sms", "whatsapp", "email"]),
    status: randomPick(["delivered", "sent", "read", "failed"]),
    sentAt: new Date(Date.now() - Math.random() * 30 * 86400000).toISOString(),
    _demo: true,
  }));
}

export function generateSMSiTDemoCampaigns(count = 5): SMSiTDemoCampaign[] {
  const campaigns = [
    "Q1 Portfolio Review Outreach",
    "Tax Season Reminder",
    "Retirement Seminar Invite",
    "Year-End Planning Campaign",
    "New Client Welcome Series",
  ];
  return campaigns.slice(0, count).map((name, i) => ({
    id: generateDemoId("smsit_campaign", i),
    name: `[DEMO] ${name}`,
    channel: randomPick(["sms", "email", "whatsapp"]),
    status: randomPick(["active", "completed", "draft"]),
    recipientCount: Math.floor(50 + Math.random() * 450),
    sentCount: Math.floor(40 + Math.random() * 400),
    openRate: Math.round((40 + Math.random() * 50) * 10) / 10,
    clickRate: Math.round((5 + Math.random() * 25) * 10) / 10,
    _demo: true,
  }));
}

// ═══════════════════════════════════════════════════════════════════════
// Failover Orchestrator
// ═══════════════════════════════════════════════════════════════════════

export type FailoverMode = "live" | "demo" | "degraded";

export interface FailoverStatus {
  provider: string;
  mode: FailoverMode;
  reason: string;
  hasCredentials: boolean;
  lastChecked: number;
  demoDataAvailable: boolean;
}

/**
 * Check if a provider has valid credentials in the integration_connections table.
 * Returns the decrypted credentials if available, null otherwise.
 */
export async function checkProviderCredentials(
  providerSlug: string,
  userId?: number,
): Promise<Record<string, string> | null> {
  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return null;

    const { integrationConnections, integrationProviders } = await import("../../drizzle/schema");
    const { eq, and } = await import("drizzle-orm");
    const { decryptCredentials } = await import("./encryption");

    // Find the provider
    const providerRows = await db.select().from(integrationProviders)
      .where(eq(integrationProviders.slug, providerSlug));
    if (!providerRows.length) return null;

    // Find an active connection
    const connRows = await db.select().from(integrationConnections)
      .where(and(
        eq(integrationConnections.providerId, providerRows[0].id),
        eq(integrationConnections.status, "connected"),
      ));

    if (!connRows.length || !connRows[0].credentialsEncrypted) return null;

    return decryptCredentials(connRows[0].credentialsEncrypted) as Record<string, string>;
  } catch (err) {
    log.warn({ provider: providerSlug, err }, "Failed to check provider credentials");
    return null;
  }
}

/**
 * Get the failover status for a provider.
 */
export async function getFailoverStatus(providerSlug: string, userId?: number): Promise<FailoverStatus> {
  const creds = await checkProviderCredentials(providerSlug, userId);
  const hasCredentials = creds !== null;

  return {
    provider: providerSlug,
    mode: hasCredentials ? "live" : "demo",
    reason: hasCredentials
      ? "Live credentials available"
      : "No credentials configured — using demo data. Connect your account in Integrations to switch to live mode.",
    hasCredentials,
    lastChecked: Date.now(),
    demoDataAvailable: true,
  };
}

/**
 * Get data from a provider with automatic failover to demo data.
 */
export async function getWithFailover<T>(
  providerSlug: string,
  liveFetcher: (creds: Record<string, string>) => Promise<T>,
  demoGenerator: () => T,
  userId?: number,
): Promise<{ data: T; mode: FailoverMode; message: string }> {
  const creds = await checkProviderCredentials(providerSlug, userId);

  if (creds) {
    try {
      const data = await liveFetcher(creds);
      return { data, mode: "live", message: "Live data from connected account" };
    } catch (err: any) {
      log.warn({ provider: providerSlug, err: err.message }, "Live fetch failed, falling back to demo");
      return {
        data: demoGenerator(),
        mode: "degraded",
        message: `Live connection error: ${err.message}. Showing demo data as fallback.`,
      };
    }
  }

  log.info({ provider: providerSlug }, "No credentials, using demo data");
  return {
    data: demoGenerator(),
    mode: "demo",
    message: "Showing demo data. Connect your account in Integrations to see live data.",
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Provider-Specific Failover Functions
// ═══════════════════════════════════════════════════════════════════════

export async function getGHLContactsWithFailover(userId?: number) {
  return getWithFailover(
    "gohighlevel",
    async (creds) => {
      const { GoHighLevelAdapter } = await import("./orgProviders");
      const adapter = new GoHighLevelAdapter(creds.api_key || creds.apiKey || "", creds.location_id || creds.locationId || "");
      const result = await adapter.getContacts(100);
      return result.contacts as any;
    },
    () => generateGHLDemoContacts(25),
    userId,
  );
}

export async function getGHLPipelinesWithFailover(userId?: number) {
  return getWithFailover(
    "gohighlevel",
    async (creds) => {
      const { GoHighLevelAdapter } = await import("./orgProviders");
      const adapter = new GoHighLevelAdapter(creds.api_key || creds.apiKey || "", creds.location_id || creds.locationId || "");
      return adapter.getPipelines();
    },
    () => generateGHLDemoPipelines(),
    userId,
  );
}

export async function getWealthboxContactsWithFailover(userId?: number) {
  return getWithFailover(
    "wealthbox",
    async (creds) => {
      const { WealthboxAdapter } = await import("./crmAdapter");
      const adapter = new WealthboxAdapter();
      return adapter.pullContacts(creds as Record<string, string>);
    },
    () => generateWealthboxDemoContacts(20),
    userId,
  );
}

export async function getRedtailContactsWithFailover(userId?: number) {
  return getWithFailover(
    "redtail",
    async (creds) => {
      const { RedtailAdapter } = await import("./crmAdapter");
      const adapter = new RedtailAdapter();
      return adapter.pullContacts(creds as Record<string, string>);
    },
    () => generateRedtailDemoContacts(20),
    userId,
  );
}

export async function getSMSiTMessagesWithFailover(userId?: number) {
  return getWithFailover(
    "smsit",
    async (creds) => {
      const { SMSiTAdapter } = await import("./orgProviders");
      const adapter = new SMSiTAdapter(creds.api_key || creds.apiKey || creds.access_token || "");
      return adapter.getCampaigns() as any;
    },
    () => generateSMSiTDemoMessages(15),
    userId,
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Bulk Status Check
// ═══════════════════════════════════════════════════════════════════════

const FAILOVER_PROVIDERS = ["gohighlevel", "wealthbox", "redtail", "smsit"] as const;

export async function getAllFailoverStatuses(userId?: number): Promise<FailoverStatus[]> {
  const statuses = await Promise.all(
    FAILOVER_PROVIDERS.map(slug => getFailoverStatus(slug, userId)),
  );
  return statuses;
}
