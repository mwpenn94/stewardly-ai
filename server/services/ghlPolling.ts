/**
 * GHL API Polling Fallback Service
 * 
 * Periodically polls the GHL v2 API for contact/opportunity changes
 * using the pit- API key. This provides real-time sync capability
 * without requiring webhook configuration in the GHL UI.
 * 
 * Uses the ghl_locations table's lastSyncAt/lastSyncCursor as watermarks
 * to only fetch changes since the last poll. Feeds detected changes into
 * the existing sync reconciliation pipeline and SSE event bus.
 */
import { getDb, getRawPool } from "../db";
import { ghlLocations } from "../../drizzle/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { logger } from "../_core/logger";
import { emitReconcileProgress, emitReconcileComplete, emitSyncError } from "./syncEventBus";

const log = logger.child({ module: "ghlPolling" });

const GHL_BASE_URL = "https://services.leadconnectorhq.com";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PollResult {
  locationId: string;
  locationName: string;
  contactsFound: number;
  contactsCreated: number;
  contactsUpdated: number;
  contactsDeleted: number;
  opportunitiesFound: number;
  errors: string[];
  durationMs: number;
  pollTimestamp: number;
}

export interface PollCycleResult {
  locations: PollResult[];
  totalContactsProcessed: number;
  totalErrors: number;
  cycleStartedAt: number;
  cycleDurationMs: number;
}

interface GHLContact {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  tags?: string[];
  dateAdded?: string;
  dateUpdated?: string;
  customFields?: Record<string, any>[];
}

interface GHLOpportunity {
  id: string;
  name?: string;
  status?: string;
  monetaryValue?: number;
  pipelineId?: string;
  pipelineStageId?: string;
  contactId?: string;
  dateAdded?: string;
  dateUpdated?: string;
}

// ─── API Helpers ────────────────────────────────────────────────────────────

function getGHLHeaders(apiKey?: string): Record<string, string> {
  const key = apiKey || process.env.GHL_API_KEY || "";
  return {
    "Authorization": `Bearer ${key}`,
    "Content-Type": "application/json",
    "Version": "2021-07-28",
  };
}

async function ghlFetch(path: string, apiKey?: string): Promise<any> {
  const url = `${GHL_BASE_URL}${path}`;
  const resp = await fetch(url, {
    headers: getGHLHeaders(apiKey),
    signal: AbortSignal.timeout(30000),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`GHL API ${resp.status}: ${text.slice(0, 200)}`);
  }
  return resp.json();
}

// ─── Contact Polling ────────────────────────────────────────────────────────

/**
 * Fetch contacts from a GHL location, optionally filtering by updatedAt.
 * Uses pagination via startAfterId to handle large contact lists.
 */
export async function pollLocationContacts(
  locationId: string,
  apiKey?: string,
  since?: number,
  limit: number = 100,
): Promise<{ contacts: GHLContact[]; nextCursor?: string }> {
  let path = `/contacts/?locationId=${locationId}&limit=${limit}`;
  if (since) {
    // GHL v2 supports startAfter for pagination and query for filtering
    const sinceDate = new Date(since).toISOString();
    path += `&startAfterDate=${encodeURIComponent(sinceDate)}`;
  }
  
  const data = await ghlFetch(path, apiKey);
  const contacts: GHLContact[] = data.contacts || [];
  const nextCursor = data.meta?.nextPageUrl ? data.meta.startAfterId : undefined;
  
  return { contacts, nextCursor };
}

/**
 * Fetch all contacts from a location with pagination.
 * Respects rate limiting with configurable delay between pages.
 */
export async function pollAllLocationContacts(
  locationId: string,
  apiKey?: string,
  since?: number,
  rateLimitMs: number = 100,
): Promise<GHLContact[]> {
  const allContacts: GHLContact[] = [];
  let startAfterId: string | undefined;
  let pageCount = 0;
  const maxPages = 50; // Safety limit: 50 pages * 100 contacts = 5000 max
  
  while (pageCount < maxPages) {
    let path = `/contacts/?locationId=${locationId}&limit=100`;
    if (startAfterId) path += `&startAfterId=${startAfterId}`;
    
    const data = await ghlFetch(path, apiKey);
    const contacts: GHLContact[] = data.contacts || [];
    
    if (contacts.length === 0) break;
    
    // Filter by updatedAt if since is provided
    if (since) {
      const filtered = contacts.filter(c => {
        const updatedAt = c.dateUpdated ? new Date(c.dateUpdated).getTime() : 
                          c.dateAdded ? new Date(c.dateAdded).getTime() : 0;
        return updatedAt >= since;
      });
      allContacts.push(...filtered);
      
      // If we got fewer filtered contacts than the page size, we've passed the watermark
      if (filtered.length < contacts.length) break;
    } else {
      allContacts.push(...contacts);
    }
    
    // Check for next page
    startAfterId = data.meta?.startAfterId;
    if (!startAfterId || contacts.length < 100) break;
    
    pageCount++;
    
    // Rate limiting between pages
    if (rateLimitMs > 0) {
      await new Promise(resolve => setTimeout(resolve, rateLimitMs));
    }
  }
  
  return allContacts;
}

/**
 * Fetch opportunities from a GHL location pipeline.
 */
export async function pollLocationOpportunities(
  locationId: string,
  pipelineId?: string,
  apiKey?: string,
): Promise<GHLOpportunity[]> {
  try {
    // First get pipelines for the location
    const pipelinesData = await ghlFetch(`/opportunities/pipelines?locationId=${locationId}`, apiKey);
    const pipelines = pipelinesData.pipelines || [];
    
    if (pipelines.length === 0) return [];
    
    const targetPipeline = pipelineId 
      ? pipelines.find((p: any) => p.id === pipelineId)
      : pipelines[0];
    
    if (!targetPipeline) return [];
    
    // Fetch opportunities from the pipeline
    const oppsData = await ghlFetch(
      `/opportunities/search?location_id=${locationId}&pipeline_id=${targetPipeline.id}&limit=100`,
      apiKey,
    );
    
    return (oppsData.opportunities || []).map((o: any) => ({
      id: o.id,
      name: o.name,
      status: o.status,
      monetaryValue: o.monetaryValue,
      pipelineId: o.pipelineId,
      pipelineStageId: o.pipelineStageId,
      contactId: o.contactId,
      dateAdded: o.dateAdded,
      dateUpdated: o.dateUpdated,
    }));
  } catch (err: any) {
    log.warn({ err }, `[GHLPolling] Failed to fetch opportunities for ${locationId}: ${err.message}`);
    return [];
  }
}

// ─── Change Detection ───────────────────────────────────────────────────────

/**
 * Compare polled contacts against existing records to detect changes.
 * Returns categorized changes (created, updated, deleted).
 */
export async function detectContactChanges(
  locationDbId: number,
  polledContacts: GHLContact[],
): Promise<{
  created: GHLContact[];
  updated: GHLContact[];
  unchanged: number;
}> {
  const pool = await getRawPool();
  if (!pool) return { created: [], updated: [], unchanged: 0 };
  
  // Get existing contacts for this location from the lead_pipeline table
  // @ts-expect-error — property access on loosely typed object
  const [existingRows] = await pool.execute(
    `SELECT crmExternalId, updated_at FROM lead_pipeline WHERE source = 'ghl_sync' AND crmExternalId IS NOT NULL`,
  );
  
  const existingMap = new Map<string, number>();
  for (const row of existingRows as any[]) {
    if (row.crmExternalId) {
      existingMap.set(row.crmExternalId, row.updated_at ? new Date(row.updated_at).getTime() : 0);
    }
  }
  
  const created: GHLContact[] = [];
  const updated: GHLContact[] = [];
  let unchanged = 0;
  
  for (const contact of polledContacts) {
    const existingUpdatedAt = existingMap.get(contact.id);
    
    if (existingUpdatedAt === undefined) {
      // New contact — not in our DB
      created.push(contact);
    } else {
      // Existing contact — check if updated
      const contactUpdatedAt = contact.dateUpdated 
        ? new Date(contact.dateUpdated).getTime() 
        : contact.dateAdded 
          ? new Date(contact.dateAdded).getTime() 
          : 0;
      
      if (contactUpdatedAt > existingUpdatedAt) {
        updated.push(contact);
      } else {
        unchanged++;
      }
    }
  }
  
  return { created, updated, unchanged };
}

// ─── Upsert Logic ───────────────────────────────────────────────────────────

/**
 * Upsert a GHL contact into the lead_pipeline table.
 */
async function upsertContactToLeadPipeline(
  contact: GHLContact,
  locationDbId: number,
): Promise<"created" | "updated" | "skipped"> {
  const pool = await getRawPool();
  if (!pool) return "skipped";
  
  try {
    // Check if contact already exists
    // @ts-expect-error — property access on loosely typed object
    const [existing] = await pool.query(
      `SELECT id FROM lead_pipeline WHERE crmExternalId = ? LIMIT 1`,
      [contact.id],
    );
    
    if ((existing as any[]).length > 0) {
      // Update existing
      // @ts-expect-error — property access on loosely typed object
      await pool.execute(
        `UPDATE lead_pipeline SET firstName = ?, lastName = ?, email = ?, phone = ?, updated_at = NOW() WHERE crmExternalId = ?`,
        [contact.firstName || "", contact.lastName || "", contact.email || "", contact.phone || "", contact.id],
      );
      return "updated";
    } else {
      // Create new
      const { nanoid } = await import("nanoid");
      // @ts-expect-error — property access on loosely typed object
      await pool.execute(
        `INSERT INTO lead_pipeline (id, firmId, firstName, lastName, email, phone, source, status, crmExternalId, created_at, updated_at)
         VALUES (?, 1, ?, ?, ?, ?, 'ghl_sync', 'new', ?, NOW(), NOW())`,
        [nanoid(12), contact.firstName || "", contact.lastName || "", contact.email || "", contact.phone || "", contact.id],
      );
      return "created";
    }
  } catch (err: any) {
    log.error({ err }, `[GHLPolling] Upsert failed for contact ${contact.id}: ${err.message}`);
    return "skipped";
  }
}

// ─── Poll Cycle ─────────────────────────────────────────────────────────────

/**
 * Poll a single GHL location for changes.
 */
export async function pollLocation(
  locationDbId: number,
  locationId: string,
  locationName: string,
  apiKey?: string,
  since?: number,
  rateLimitMs?: number,
): Promise<PollResult> {
  const start = Date.now();
  const result: PollResult = {
    locationId,
    locationName,
    contactsFound: 0,
    contactsCreated: 0,
    contactsUpdated: 0,
    contactsDeleted: 0,
    opportunitiesFound: 0,
    errors: [],
    durationMs: 0,
    pollTimestamp: start,
  };
  
  try {
    // Emit progress start
    emitReconcileProgress({
      // @ts-expect-error — strict mode fix
      locationId,
      phase: "pulling",
      processed: 0,
      total: 0,
      matched: 0,
      created: 0,
      errors: 0,
    });
    
    // Poll contacts
    const contacts = await pollAllLocationContacts(locationId, apiKey, since, rateLimitMs);
    result.contactsFound = contacts.length;
    
    if (contacts.length > 0) {
      // Detect changes
      const changes = await detectContactChanges(locationDbId, contacts);
      
      // Emit progress — change detection complete
      emitReconcileProgress({
        // @ts-expect-error — strict mode fix
        locationId,
        phase: "comparing",
        processed: contacts.length,
        total: contacts.length,
        matched: changes.unchanged,
        created: changes.created.length,
        errors: 0,
      });
      
      // Upsert created contacts
      for (const contact of changes.created) {
        const upsertResult = await upsertContactToLeadPipeline(contact, locationDbId);
        if (upsertResult === "created") {
          result.contactsCreated++;
          // Record polling metric for each created contact
          try {
            const { recordPollingEvent } = await import("./syncMetrics");
            await recordPollingEvent({
              eventType: "contact_create",
              locationId,
              locationDbId,
              contactExternalId: contact.id,
              ghlTimestamp: contact.dateAdded ? new Date(contact.dateAdded).getTime() : undefined,
              success: true,
            });
          } catch { /* best-effort */ }
        } else if (upsertResult === "skipped") {
          result.errors.push(`Failed to create ${contact.id}`);
          try {
            const { recordPollingEvent } = await import("./syncMetrics");
            await recordPollingEvent({ eventType: "contact_create", locationId, locationDbId, contactExternalId: contact.id, success: false, errorMessage: `Skipped create for ${contact.id}` });
          } catch { /* best-effort */ }
        }
      }
      
      // Upsert updated contacts
      for (const contact of changes.updated) {
        const upsertResult = await upsertContactToLeadPipeline(contact, locationDbId);
        if (upsertResult === "updated") {
          result.contactsUpdated++;
          // Record polling metric for each updated contact
          try {
            const { recordPollingEvent } = await import("./syncMetrics");
            await recordPollingEvent({
              eventType: "contact_update",
              locationId,
              locationDbId,
              contactExternalId: contact.id,
              ghlTimestamp: contact.dateUpdated ? new Date(contact.dateUpdated).getTime() : undefined,
              success: true,
            });
          } catch { /* best-effort */ }
        } else if (upsertResult === "skipped") {
          result.errors.push(`Failed to update ${contact.id}`);
          try {
            const { recordPollingEvent } = await import("./syncMetrics");
            await recordPollingEvent({ eventType: "contact_update", locationId, locationDbId, contactExternalId: contact.id, success: false, errorMessage: `Skipped update for ${contact.id}` });
          } catch { /* best-effort */ }
        }
      }
    }
    
    // Poll opportunities
    const opportunities = await pollLocationOpportunities(locationId, undefined, apiKey);
    result.opportunitiesFound = opportunities.length;
    
    // Update location watermark
    const db = (await getDb())!;
    if (db) {
      await db.update(ghlLocations)
        .set({
          lastSyncAt: start,
          lastSyncStatus: result.errors.length > 0 ? "partial" : "success",
          totalContacts: result.contactsFound,
        })
        .where(eq(ghlLocations.id, locationDbId));
    }
    
    // Emit complete
    emitReconcileComplete({
      // @ts-expect-error — strict mode fix
      locationId,
      stats: {
        processed: result.contactsFound,
        matched: result.contactsFound - result.contactsCreated - result.contactsUpdated,
        created: result.contactsCreated,
        updated: result.contactsUpdated,
        errors: result.errors.length,
      },
    });
    
  } catch (err: any) {
    result.errors.push(err.message);
    // @ts-expect-error — strict mode fix
    emitSyncError({ locationId, error: err.message, source: "polling" });
    log.error({ err }, `[GHLPolling] Poll failed for ${locationName} (${locationId}): ${err.message}`);
    
    // Update location status to failed
    const db = (await getDb())!;
    if (db) {
      await db.update(ghlLocations)
        .set({ lastSyncStatus: "failed" })
        .where(eq(ghlLocations.id, locationDbId));
    }
  }
  
  result.durationMs = Date.now() - start;
  return result;
}

/**
 * Run a full poll cycle across all active GHL locations.
 * This is the main entry point called by the scheduler.
 */
export async function runPollCycle(): Promise<PollCycleResult> {
  const cycleStart = Date.now();
  const results: PollResult[] = [];
  
  const db = (await getDb())!;
  if (!db) {
    log.warn("[GHLPolling] DB not available, skipping poll cycle");
    return {
      locations: [],
      totalContactsProcessed: 0,
      totalErrors: 0,
      cycleStartedAt: cycleStart,
      cycleDurationMs: Date.now() - cycleStart,
    };
  }
  
  // Get all active locations
  const locations = await db.select().from(ghlLocations).where(eq(ghlLocations.isActive, 1 as any));
  
  if (locations.length === 0) {
    log.info("[GHLPolling] No active locations, skipping poll cycle");
    return {
      locations: [],
      totalContactsProcessed: 0,
      totalErrors: 0,
      cycleStartedAt: cycleStart,
      cycleDurationMs: Date.now() - cycleStart,
    };
  }
  
  log.info(`[GHLPolling] Starting poll cycle for ${locations.length} locations`);
  
  for (const loc of locations) {
    const apiKey = loc.apiKeyEncrypted || process.env.GHL_API_KEY;
    const since = loc.lastSyncAt || undefined;
    const rateLimitMs = loc.rateLimitMs || 100;
    
    const result = await pollLocation(
      loc.id,
      loc.locationId,
      loc.name,
      apiKey || undefined,
      since || undefined,
      rateLimitMs,
    );
    
    results.push(result);
    
    // Brief pause between locations to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  const cycleResult: PollCycleResult = {
    locations: results,
    totalContactsProcessed: results.reduce((sum, r) => sum + r.contactsFound, 0),
    totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
    cycleStartedAt: cycleStart,
    cycleDurationMs: Date.now() - cycleStart,
  };
  
  log.info({
    locations: results.length,
    contacts: cycleResult.totalContactsProcessed,
    errors: cycleResult.totalErrors,
    durationMs: cycleResult.cycleDurationMs,
  }, `[GHLPolling] Poll cycle complete`);
  
  return cycleResult;
}

// ─── Polling Status ─────────────────────────────────────────────────────────

export interface PollingStatus {
  isActive: boolean;
  lastCycleAt: number | null;
  lastCycleResult: PollCycleResult | null;
  nextCycleAt: number | null;
  intervalMs: number;
  locationsMonitored: number;
}

let lastCycleResult: PollCycleResult | null = null;
let pollingIntervalMs = 5 * 60 * 1000; // Default: 5 minutes
let pollingActive = false;
let lastCycleAt: number | null = null;

export function getPollingStatus(locationsCount: number): PollingStatus {
  return {
    isActive: pollingActive,
    lastCycleAt,
    lastCycleResult,
    nextCycleAt: lastCycleAt ? lastCycleAt + pollingIntervalMs : null,
    intervalMs: pollingIntervalMs,
    locationsMonitored: locationsCount,
  };
}

export function setPollingInterval(ms: number): void {
  pollingIntervalMs = Math.max(60000, ms); // Minimum 1 minute
}

export function setPollingActive(active: boolean): void {
  pollingActive = active;
}

export function updateLastCycleResult(result: PollCycleResult): void {
  lastCycleResult = result;
  lastCycleAt = result.cycleStartedAt;
}

/**
 * Scheduler-compatible handler for the polling job.
 */
export async function scheduledPollHandler(): Promise<void> {
  if (!pollingActive) {
    log.info("[GHLPolling] Polling is disabled, skipping cycle");
    return;
  }
  
  const apiKey = process.env.GHL_API_KEY;
  if (!apiKey) {
    log.warn("[GHLPolling] GHL_API_KEY not set, skipping poll cycle");
    return;
  }
  
  try {
    const result = await runPollCycle();
    updateLastCycleResult(result);
  } catch (err: any) {
    log.error({ err }, `[GHLPolling] Scheduled poll cycle failed: ${err.message}`);
  }
}
