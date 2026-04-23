/**
 * Sync History Service — Unified timeline of all sync events across all channels
 * Combines crm_sync_log, integration_sync_logs, integration_webhook_events, and conflict resolutions
 * into a single chronological timeline with field-level change details.
 */
import { getDb } from "../db";
import { crmSyncLog, integrationSyncLogs, integrationWebhookEvents } from "../../drizzle/schema";
import { desc, sql, and, gte, lte, eq, like } from "drizzle-orm";

// ─── Types ──────────────────────────────────────────────────────────────
export interface SyncTimelineEvent {
  id: string;
  eventType: "pull" | "push" | "webhook" | "conflict_resolved" | "auto_sync" | "manual_sync";
  provider: string;
  direction: "inbound" | "outbound" | "bidirectional";
  status: "success" | "partial" | "failed" | "pending";
  contactCount: number;
  contactsCreated: number;
  contactsUpdated: number;
  errorCount: number;
  details: string;
  fieldChanges?: FieldChange[];
  timestamp: string; // ISO string
  durationMs?: number;
}

export interface FieldChange {
  contactName: string;
  contactId: string;
  field: string;
  oldValue: string;
  newValue: string;
  resolution?: "kept_ours" | "kept_theirs" | "merged" | "pending";
}

export interface TimelineFilter {
  provider?: string;
  direction?: "inbound" | "outbound" | "bidirectional";
  eventType?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

export interface TimelineSummary {
  totalEvents: number;
  totalContactsSynced: number;
  totalConflictsResolved: number;
  totalErrors: number;
  lastSyncAt: string | null;
  eventsByProvider: Record<string, number>;
  eventsByType: Record<string, number>;
  successRate: number;
}

// ─── Unified Timeline Query ──────────────────────────────────────────────
export async function getUnifiedTimeline(filter: TimelineFilter = {}): Promise<SyncTimelineEvent[]> {
  const db = await getDb();
  if (!db) return [];

  const limit = filter.limit || 100;
  const offset = filter.offset || 0;
  const events: SyncTimelineEvent[] = [];

  // 1. Fetch from crm_sync_log
  try {
    const conditions: any[] = [];
    if (filter.provider) {
      conditions.push(eq(crmSyncLog.crmProvider, filter.provider));
    }
    if (filter.direction) {
      const dirMap: Record<string, string> = { inbound: "pull", outbound: "push", bidirectional: "bidirectional" };
      conditions.push(eq(crmSyncLog.direction, dirMap[filter.direction] || filter.direction));
    }
    if (filter.dateFrom) {
      conditions.push(gte(crmSyncLog.createdAt, filter.dateFrom));
    }
    if (filter.dateTo) {
      conditions.push(lte(crmSyncLog.createdAt, filter.dateTo));
    }

    const query = conditions.length > 0
      ? db.select().from(crmSyncLog).where(and(...conditions)).orderBy(desc(crmSyncLog.createdAt)).limit(limit)
      : db.select().from(crmSyncLog).orderBy(desc(crmSyncLog.createdAt)).limit(limit);

    const rows = await query;
    for (const row of rows) {
      events.push({
        id: `crm-${row.id}`,
        eventType: row.syncType === "contacts" ? (row.direction === "push" ? "push" : "pull") : "manual_sync",
        provider: row.crmProvider,
        direction: row.direction === "push" ? "outbound" : row.direction === "bidirectional" ? "bidirectional" : "inbound",
        status: row.status === "completed" ? "success" : row.status === "failed" ? "failed" : "pending",
        contactCount: row.recordsSynced || 0,
        contactsCreated: 0,
        contactsUpdated: row.recordsSynced || 0,
        errorCount: row.errorDetails ? 1 : 0,
        details: row.errorDetails || `${row.direction} sync: ${row.recordsSynced || 0} records`,
        timestamp: row.createdAt?.toISOString() || new Date().toISOString(),
        durationMs: row.completedAt && row.createdAt
          ? new Date(row.completedAt).getTime() - new Date(row.createdAt).getTime()
          : undefined,
      });
    }
  } catch (err) {
    // Table may not exist yet
  }

  // 2. Fetch from integration_sync_logs
  try {
    const rows = await db.select().from(integrationSyncLogs)
      .orderBy(desc(integrationSyncLogs.startedAt))
      .limit(limit);

    for (const row of rows) {
      events.push({
        id: `int-${row.id}`,
        eventType: row.triggeredBy === "webhook" ? "webhook" : row.triggeredBy === "schedule" ? "auto_sync" : "manual_sync",
        provider: row.connectionId,
        direction: row.direction as "inbound" | "outbound" | "bidirectional",
        status: row.status === "success" ? "success" : row.status === "partial" ? "partial" : row.status === "failed" ? "failed" : "pending",
        contactCount: (row.recordsCreated || 0) + (row.recordsUpdated || 0),
        contactsCreated: row.recordsCreated || 0,
        contactsUpdated: row.recordsUpdated || 0,
        errorCount: row.recordsFailed || 0,
        details: `${row.syncType} sync: ${row.recordsCreated || 0} created, ${row.recordsUpdated || 0} updated`,
        timestamp: row.startedAt?.toISOString() || new Date().toISOString(),
        durationMs: row.completedAt && row.startedAt
          ? new Date(row.completedAt).getTime() - new Date(row.startedAt).getTime()
          : undefined,
      });
    }
  } catch (err) {
    // Table may not exist yet
  }

  // 3. Fetch from integration_webhook_events
  try {
    const rows = await db.select().from(integrationWebhookEvents)
      .orderBy(desc(integrationWebhookEvents.receivedAt))
      .limit(limit);

    for (const row of rows) {
      events.push({
        id: `wh-${row.id}`,
        eventType: "webhook",
        provider: row.providerSlug,
        direction: "inbound",
        status: row.processingStatus === "processed" ? "success" : row.processingStatus === "failed" ? "failed" : "pending",
        contactCount: 1,
        contactsCreated: row.eventType?.includes("Create") ? 1 : 0,
        contactsUpdated: row.eventType?.includes("Update") ? 1 : 0,
        errorCount: row.processingError ? 1 : 0,
        details: `Webhook: ${row.eventType} from ${row.providerSlug}`,
        timestamp: row.receivedAt?.toISOString() || new Date().toISOString(),
      });
    }
  } catch (err) {
    // Table may not exist yet
  }

  // Sort all events by timestamp descending
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Apply offset and limit
  return events.slice(offset, offset + limit);
}

// ─── Timeline Summary ──────────────────────────────────────────────────
export async function getTimelineSummary(): Promise<TimelineSummary> {
  const events = await getUnifiedTimeline({ limit: 1000 });

  const eventsByProvider: Record<string, number> = {};
  const eventsByType: Record<string, number> = {};
  let totalContactsSynced = 0;
  let totalErrors = 0;
  let successCount = 0;

  for (const e of events) {
    eventsByProvider[e.provider] = (eventsByProvider[e.provider] || 0) + 1;
    eventsByType[e.eventType] = (eventsByType[e.eventType] || 0) + 1;
    totalContactsSynced += e.contactCount;
    totalErrors += e.errorCount;
    if (e.status === "success") successCount++;
  }

  return {
    totalEvents: events.length,
    totalContactsSynced,
    totalConflictsResolved: events.filter(e => e.eventType === "conflict_resolved").length,
    totalErrors,
    lastSyncAt: events.length > 0 ? events[0].timestamp : null,
    eventsByProvider,
    eventsByType,
    successRate: events.length > 0 ? Math.round((successCount / events.length) * 100) : 0,
  };
}

// ─── Live Sync Test ─────────────────────────────────────────────────────
export interface LiveSyncTestResult {
  ghlContactsFetched: number;
  realContacts: number;
  testContacts: number;
  sampleContacts: Array<{
    id: string;
    name: string;
    email: string;
    city: string;
    state: string;
    tags: string[];
  }>;
  conflictsDetected: number;
  conflictDetails: Array<{
    contactId: string;
    contactName: string;
    field: string;
    ghlValue: string;
    stewardlyValue: string;
  }>;
  syncLogId?: number;
  timestamp: string;
}

export async function runLiveSyncTest(): Promise<LiveSyncTestResult> {
  const GHL_API_KEY = process.env.GHL_API_KEY;
  const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

  if (!GHL_API_KEY || !GHL_LOCATION_ID) {
    return {
      ghlContactsFetched: 0,
      realContacts: 0,
      testContacts: 0,
      sampleContacts: [],
      conflictsDetected: 0,
      conflictDetails: [],
      timestamp: new Date().toISOString(),
    };
  }

  // Fetch contacts from GHL
  const resp = await fetch(
    `https://services.leadconnectorhq.com/contacts/?locationId=${GHL_LOCATION_ID}&limit=100`,
    {
      headers: {
        Authorization: `Bearer ${GHL_API_KEY}`,
        Version: "2021-07-28",
      },
    }
  );

  if (!resp.ok) {
    return {
      ghlContactsFetched: 0,
      realContacts: 0,
      testContacts: 0,
      sampleContacts: [],
      conflictsDetected: 0,
      conflictDetails: [],
      timestamp: new Date().toISOString(),
    };
  }

  const data = await resp.json();
  const contacts = data.contacts || [];
  const testContacts = contacts.filter((c: any) =>
    (c.email || "").includes("vitest") || (c.email || "").includes("stewardly-e2e") || (c.email || "").includes("stewardly.test")
  );
  const realContacts = contacts.filter((c: any) =>
    !(c.email || "").includes("vitest") &&
    !(c.email || "").includes("stewardly-e2e") &&
    !(c.email || "").includes("stewardly.test") &&
    !(c.email || "").includes("@test.stewardly")
  );

  // Sample contacts
  const sampleContacts = realContacts.slice(0, 10).map((c: any) => ({
    id: c.id,
    name: `${c.firstName || ""} ${c.lastName || ""}`.trim(),
    email: c.email || "",
    city: c.city || "",
    state: c.state || "",
    tags: (c.tags || []).slice(0, 5),
  }));

  // Detect conflicts by comparing with lead_pipeline
  const conflictDetails: LiveSyncTestResult["conflictDetails"] = [];
  const db = await getDb();
  if (db) {
    const { leadPipeline } = await import("../../drizzle/schema");

    for (const ghlContact of realContacts.slice(0, 20)) {
      if (!ghlContact.email) continue;
      const normalizedEmail = ghlContact.email.trim().toLowerCase();
      const existing = await db.select().from(leadPipeline).where(eq(leadPipeline.email, normalizedEmail)).limit(1);

      if (existing.length > 0) {
        const local = existing[0];
        // Check for field mismatches
        const checks = [
          { field: "firstName", ghl: ghlContact.firstName, local: local.firstName },
          { field: "lastName", ghl: ghlContact.lastName, local: local.lastName },
          { field: "company", ghl: ghlContact.companyName, local: local.company },
          { field: "city", ghl: ghlContact.city, local: local.city },
          { field: "state", ghl: ghlContact.state, local: local.state },
        ];

        for (const check of checks) {
          const ghlVal = (check.ghl || "").trim().toLowerCase();
          const localVal = (check.local || "").trim().toLowerCase();
          if (ghlVal && localVal && ghlVal !== localVal) {
            conflictDetails.push({
              contactId: ghlContact.id,
              contactName: `${ghlContact.firstName || ""} ${ghlContact.lastName || ""}`.trim(),
              field: check.field,
              ghlValue: check.ghl || "",
              stewardlyValue: check.local || "",
            });
          }
        }
      }
    }

    // Log the sync test to crm_sync_log
    await db.insert(crmSyncLog).values({
      crmProvider: "gohighlevel",
      direction: "pull",
      syncType: "live_test",
      recordsSynced: contacts.length,
      status: "completed",
      completedAt: new Date(),
    });
  }

  return {
    ghlContactsFetched: contacts.length,
    realContacts: realContacts.length,
    testContacts: testContacts.length,
    sampleContacts,
    conflictsDetected: conflictDetails.length,
    conflictDetails,
    timestamp: new Date().toISOString(),
  };
}
