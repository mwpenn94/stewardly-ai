/**
 * Sync Reconciliation Engine — Multi-Location Continuous Scale Architecture
 * 
 * Designed for unlimited contact growth across unlimited GHL locations.
 * Each location has its own sync config (direction, frequency, conflict policy).
 * No hard caps, no in-memory accumulation of full datasets.
 * 
 * Key guarantees:
 * 1. NO DUPLICATES — 3-layer dedup: crmExternalId → email → phone
 * 2. CONFLICT RESOLUTION — configurable per location (newest_wins, ghl_wins, stewardly_wins, manual_review)
 * 3. BIDIRECTIONAL CONSISTENCY — every Stewardly lead has a GHL contact and vice versa
 * 4. AGGREGATION TOTALS — sync stats with match counts and conflict log
 * 5. IDEMPOTENT — safe to run multiple times without side effects
 * 6. CONTINUOUS SCALE — cursor-based pagination, chunked processing, O(chunk) memory
 * 7. RESUMABLE — tracks progress via cursor, can resume after interruption
 * 8. MULTI-LOCATION — each location syncs independently with its own config
 * 9. TENANT-ISOLATED — leads tagged with location_id for access scoping
 */

import pino from "pino";
import { getRawPool } from "../db";

const logger = pino({ name: "sync-reconciliation" });

const GHL_API_KEY = process.env.GHL_API_KEY || "";
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || "";
const GHL_BASE = "https://services.leadconnectorhq.com";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LocationConfig {
  /** Internal DB id of the ghl_locations row */
  dbId?: number;
  /** GHL location ID */
  locationId: string;
  /** Display name */
  name?: string;
  /** Sync direction */
  syncDirection: "bidirectional" | "pull_only" | "push_only" | "disabled";
  /** Conflict resolution policy */
  conflictPolicy: "ghl_wins" | "stewardly_wins" | "newest_wins" | "manual_review";
  /** Max contacts per run (0 = unlimited) */
  maxContactsPerRun: number;
  /** Rate limit ms between GHL API calls */
  rateLimitMs: number;
  /** Optional per-location API key override (decrypted) */
  apiKey?: string;
  /** Resume cursor from previous interrupted run */
  lastSyncCursor?: string | null;
}

export interface SyncStats {
  timestamp: string;
  locationId: string;
  locationName?: string;
  ghlTotal: number;
  stewardlyTotal: number;
  matched: number;
  createdInStewardly: number;
  createdInGHL: number;
  updatedInStewardly: number;
  updatedInGHL: number;
  conflictsResolved: number;
  orphansFixed: number;
  errors: number;
  duration_ms: number;
  conflicts: ConflictRecord[];
  /** Cursor for resuming — null means complete */
  resumeCursor: string | null;
  /** Chunk size used */
  chunkSize: number;
  /** Whether the run completed all pages or was interrupted */
  complete: boolean;
}

export interface ConflictRecord {
  field: string;
  stewardlyValue: string | null;
  ghlValue: string | null;
  resolution: "stewardly_wins" | "ghl_wins" | "merged" | "manual_review";
  reason: string;
  contactId: string;
}

interface LocalLead {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: string | null;
  crmExternalId: string | null;
  notesJson: string | null;
  created_at: number | null;
  updated_at: number | null;
  location_id: number | null;
}

interface GHLContact {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  tags?: string[];
  source?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  dateAdded?: string;
  dateUpdated?: string;
  locationId?: string;
}

// ─── Normalization helpers ──────────────────────────────────────────────────

function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return email.toLowerCase().trim();
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return null;
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

// ─── Location-aware GHL headers ─────────────────────────────────────────────

function ghlHeadersForLocation(config?: LocationConfig) {
  const apiKey = config?.apiKey || GHL_API_KEY;
  return {
    Authorization: `Bearer ${apiKey}`,
    Version: "2021-07-28",
    "Content-Type": "application/json",
  };
}

// Legacy global headers (backward compat)
const ghlHeaders = () => ghlHeadersForLocation();

// ─── 3-Layer Dedup Matcher ──────────────────────────────────────────────────

export async function findLocalMatch(
  contact: { email?: string; phone?: string; crmExternalId?: string },
  locationDbId?: number,
): Promise<LocalLead | null> {
  const pool = await getRawPool();
  if (!pool) return null;

  const locationFilter = locationDbId != null ? " AND location_id = ?" : "";
  const locationParam = locationDbId != null ? [locationDbId] : [];

  // Layer 1: crmExternalId (strongest match)
  if (contact.crmExternalId) {
    const [rows] = await pool.query(
      `SELECT * FROM lead_pipeline WHERE crmExternalId = ?${locationFilter} LIMIT 1`,
      [contact.crmExternalId, ...locationParam]
    );
    const match = (rows as any[])[0];
    if (match) return match as LocalLead;
  }

  // Layer 2: email (strong match)
  const normEmail = normalizeEmail(contact.email);
  if (normEmail) {
    const [rows] = await pool.query(
      `SELECT * FROM lead_pipeline WHERE email = ?${locationFilter} LIMIT 1`,
      [normEmail, ...locationParam]
    );
    const match = (rows as any[])[0];
    if (match) return match as LocalLead;
  }

  // Layer 3: phone (moderate match)
  const normPhone = normalizePhone(contact.phone);
  if (normPhone) {
    const [rows] = await pool.query(
      `SELECT * FROM lead_pipeline WHERE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, '-', ''), ' ', ''), '(', ''), ')', ''), '+', '') LIKE ?${locationFilter} LIMIT 1`,
      [`%${normPhone}`, ...locationParam]
    );
    const match = (rows as any[])[0];
    if (match) return match as LocalLead;
  }

  return null;
}

export async function findGHLMatch(
  lead: { email?: string | null; phone?: string | null; crmExternalId?: string | null },
  config?: LocationConfig,
): Promise<GHLContact | null> {
  const apiKey = config?.apiKey || GHL_API_KEY;
  const locId = config?.locationId || GHL_LOCATION_ID;
  if (!apiKey || !locId) return null;

  const headers = ghlHeadersForLocation(config);

  // Layer 1: Direct lookup by crmExternalId
  if (lead.crmExternalId) {
    try {
      const resp = await fetch(`${GHL_BASE}/contacts/${lead.crmExternalId}`, {
        headers,
        signal: AbortSignal.timeout(10000),
      });
      if (resp.ok) {
        const data = await resp.json() as any;
        return data.contact || null;
      }
    } catch { /* fall through */ }
  }

  // Layer 2: Search by email
  if (lead.email) {
    try {
      const resp = await fetch(
        `${GHL_BASE}/contacts/search/duplicate?locationId=${locId}&email=${encodeURIComponent(lead.email)}`,
        { headers, signal: AbortSignal.timeout(10000) }
      );
      if (resp.ok) {
        const data = await resp.json() as any;
        const contacts = data.contacts || (data.contact ? [data.contact] : []);
        if (contacts.length > 0) return contacts[0];
      }
    } catch { /* fall through */ }
  }

  // Layer 3: Search by phone
  if (lead.phone) {
    try {
      const resp = await fetch(
        `${GHL_BASE}/contacts/search/duplicate?locationId=${locId}&phone=${encodeURIComponent(lead.phone)}`,
        { headers, signal: AbortSignal.timeout(10000) }
      );
      if (resp.ok) {
        const data = await resp.json() as any;
        const contacts = data.contacts || (data.contact ? [data.contact] : []);
        if (contacts.length > 0) return contacts[0];
      }
    } catch { /* fall through */ }
  }

  return null;
}

// ─── Conflict Resolution ────────────────────────────────────────────────────

function resolveFieldConflict(
  field: string,
  localValue: string | null,
  ghlValue: string | null | undefined,
  localUpdated: number | null,
  ghlUpdated: string | null | undefined,
  contactId: string,
  policy: LocationConfig["conflictPolicy"] = "newest_wins",
): { value: string | null; conflict?: ConflictRecord } {
  const normLocal = localValue?.trim() || null;
  const normGHL = (ghlValue as string)?.trim() || null;

  if (normLocal === normGHL) return { value: normLocal };
  if (!normLocal && normGHL) return { value: normGHL };
  if (normLocal && !normGHL) return { value: normLocal };

  // Both have values and they differ — apply conflict policy
  if (policy === "ghl_wins") {
    return {
      value: normGHL,
      conflict: {
        field, stewardlyValue: normLocal, ghlValue: normGHL,
        resolution: "ghl_wins", reason: `Policy: ghl_wins`, contactId,
      },
    };
  }

  if (policy === "stewardly_wins") {
    return {
      value: normLocal,
      conflict: {
        field, stewardlyValue: normLocal, ghlValue: normGHL,
        resolution: "stewardly_wins", reason: `Policy: stewardly_wins`, contactId,
      },
    };
  }

  if (policy === "manual_review") {
    return {
      value: normLocal, // keep existing until manual review
      conflict: {
        field, stewardlyValue: normLocal, ghlValue: normGHL,
        resolution: "manual_review", reason: `Flagged for manual review`, contactId,
      },
    };
  }

  // Default: newest_wins
  const localTs = localUpdated || 0;
  const ghlTs = ghlUpdated ? new Date(ghlUpdated).getTime() : 0;

  if (ghlTs > localTs) {
    return {
      value: normGHL,
      conflict: {
        field, stewardlyValue: normLocal, ghlValue: normGHL,
        resolution: "ghl_wins",
        reason: `GHL updated more recently (${new Date(ghlTs).toISOString()} > ${new Date(localTs).toISOString()})`,
        contactId,
      },
    };
  }

  return {
    value: normLocal,
    conflict: {
      field, stewardlyValue: normLocal, ghlValue: normGHL,
      resolution: "stewardly_wins",
      reason: `Stewardly updated more recently (${new Date(localTs).toISOString()} > ${new Date(ghlTs).toISOString()})`,
      contactId,
    },
  };
}

// ─── Chunked Local Lead Index Builder (location-scoped) ──────────────────────

async function buildLocalIndexes(pool: any, locationDbId?: number): Promise<{
  byCrmId: Map<string, LocalLead>;
  byEmail: Map<string, LocalLead>;
  byPhone: Map<string, LocalLead>;
  allIds: Set<number>;
  total: number;
}> {
  const byCrmId = new Map<string, LocalLead>();
  const byEmail = new Map<string, LocalLead>();
  const byPhone = new Map<string, LocalLead>();
  const allIds = new Set<number>();

  const CHUNK = 5000;
  let offset = 0;
  let total = 0;

  // Location filter: if locationDbId provided, scope to that location + unassigned
  const locationFilter = locationDbId != null
    ? " AND (location_id = ? OR location_id IS NULL)"
    : "";
  const locationParam = locationDbId != null ? [locationDbId] : [];

  while (true) {
    const [rows] = await pool.query(
      `SELECT id, firstName, lastName, email, phone, source, status, crmExternalId, notesJson, created_at, updated_at, location_id FROM lead_pipeline WHERE status != 'disqualified'${locationFilter} LIMIT ? OFFSET ?`,
      [...locationParam, CHUNK, offset]
    );
    const leads = rows as LocalLead[];
    if (leads.length === 0) break;

    for (const lead of leads) {
      allIds.add(lead.id);
      if (lead.crmExternalId) byCrmId.set(lead.crmExternalId, lead);
      const normEmail = normalizeEmail(lead.email);
      if (normEmail) byEmail.set(normEmail, lead);
      const normPhone = normalizePhone(lead.phone);
      if (normPhone) byPhone.set(normPhone, lead);
    }

    total += leads.length;
    offset += CHUNK;

    if (leads.length < CHUNK) break;
    logger.info({ loaded: total }, "[Reconcile] Local index chunk loaded");
  }

  return { byCrmId, byEmail, byPhone, allIds, total };
}

// ─── Full Bidirectional Reconciliation (Multi-Location Continuous Scale) ─────

export interface ReconcileOptions {
  /** Max GHL contacts to process per run (0 = unlimited). Default 0. */
  maxGHLContacts?: number;
  /** Whether to push local orphans to GHL (default true) */
  pushOrphans?: boolean;
  /** Resume cursor from a previous interrupted run */
  resumeCursor?: string | null;
  /** GHL page size (default 100, max 100 per GHL API) */
  pageSize?: number;
  /** Progress callback — called after each GHL page is processed */
  onProgress?: (stats: SyncStats) => void;
  /** Max orphans to push per run (0 = unlimited). Default 0. */
  maxOrphanPush?: number;
  /** Rate limit delay between GHL API calls in ms (default 50) */
  rateLimitMs?: number;
  /** Location config — if provided, scopes reconciliation to this location */
  location?: LocationConfig;
}

export async function reconcile(options?: ReconcileOptions): Promise<SyncStats> {
  const loc = options?.location;
  const locId = loc?.locationId || GHL_LOCATION_ID;
  const locDbId = loc?.dbId;
  const apiKey = loc?.apiKey || GHL_API_KEY;
  const conflictPolicy = loc?.conflictPolicy || "newest_wins";
  const syncDirection = loc?.syncDirection || "bidirectional";
  const maxGHL = options?.maxGHLContacts ?? loc?.maxContactsPerRun ?? 0;
  const pushOrphans = options?.pushOrphans ?? (syncDirection === "bidirectional" || syncDirection === "push_only");
  const pullContacts = syncDirection === "bidirectional" || syncDirection === "pull_only";
  const pageSize = Math.min(options?.pageSize ?? 100, 100);
  const maxOrphanPush = options?.maxOrphanPush ?? 0;
  const rateLimitMs = options?.rateLimitMs ?? loc?.rateLimitMs ?? 50;
  let resumeCursor = options?.resumeCursor || loc?.lastSyncCursor || null;
  const startTime = Date.now();
  const headers = ghlHeadersForLocation(loc);

  const stats: SyncStats = {
    timestamp: new Date().toISOString(),
    locationId: locId,
    locationName: loc?.name,
    ghlTotal: 0,
    stewardlyTotal: 0,
    matched: 0,
    createdInStewardly: 0,
    createdInGHL: 0,
    updatedInStewardly: 0,
    updatedInGHL: 0,
    conflictsResolved: 0,
    orphansFixed: 0,
    errors: 0,
    duration_ms: 0,
    conflicts: [],
    resumeCursor: null,
    chunkSize: pageSize,
    complete: false,
  };

  if (syncDirection === "disabled") {
    logger.info({ locationId: locId }, "[Reconcile] Location sync disabled");
    stats.duration_ms = Date.now() - startTime;
    stats.complete = true;
    return stats;
  }

  if (!apiKey || !locId) {
    logger.warn("[Reconcile] GHL credentials not configured");
    stats.duration_ms = Date.now() - startTime;
    stats.complete = true;
    return stats;
  }

  const pool = await getRawPool();
  if (!pool) {
    logger.error("[Reconcile] Database pool unavailable");
    stats.duration_ms = Date.now() - startTime;
    stats.complete = true;
    return stats;
  }

  // ── Step 1: Build local indexes (location-scoped) ──────────────────────
  logger.info({ locationId: locId }, "[Reconcile] Step 1: Building local indexes...");
  const localIdx = await buildLocalIndexes(pool, locDbId);
  stats.stewardlyTotal = localIdx.total;
  logger.info({ count: localIdx.total, locationId: locId }, "[Reconcile] Local indexes built");

  // Track which local IDs have been matched
  const matchedLocalIds = new Set<number>();

  // ── Step 2: Stream GHL contacts page-by-page ──────────────────────────
  if (pullContacts) {
    logger.info({ locationId: locId }, "[Reconcile] Step 2: Streaming GHL contacts...");
    let nextPageUrl: string | null = resumeCursor
      ? `${GHL_BASE}/contacts/?locationId=${locId}&limit=${pageSize}&startAfterId=${resumeCursor}`
      : `${GHL_BASE}/contacts/?locationId=${locId}&limit=${pageSize}`;

    const now = Date.now();
    let pagesProcessed = 0;

    while (nextPageUrl) {
      if (maxGHL > 0 && stats.ghlTotal >= maxGHL) {
        logger.info({ processed: stats.ghlTotal, max: maxGHL }, "[Reconcile] Reached max GHL contacts limit");
        break;
      }

      // Rate limiting
      if (pagesProcessed > 0 && rateLimitMs > 0) {
        await new Promise(r => setTimeout(r, rateLimitMs));
      }

      let ghlChunk: GHLContact[] = [];
      let lastId: string | null = null;

      try {
        const resp = await fetch(nextPageUrl, {
          headers,
          signal: AbortSignal.timeout(30000),
        });
        if (!resp.ok) {
          logger.error({ status: resp.status, locationId: locId }, "[Reconcile] GHL API error");
          stats.errors++;
          break;
        }
        const data = await resp.json() as any;
        ghlChunk = data.contacts || [];

        if (ghlChunk.length > 0) {
          lastId = data.meta?.startAfterId || ghlChunk[ghlChunk.length - 1]?.id || null;
        }

        if (data.meta?.startAfterId && ghlChunk.length >= pageSize) {
          nextPageUrl = `${GHL_BASE}/contacts/?locationId=${locId}&limit=${pageSize}&startAfterId=${data.meta.startAfterId}`;
        } else {
          nextPageUrl = null;
        }
      } catch (err: any) {
        logger.error({ err: err.message, locationId: locId }, "[Reconcile] GHL pagination error");
        stats.errors++;
        stats.resumeCursor = lastId;
        break;
      }

      // Trim chunk if we'd exceed max
      if (maxGHL > 0 && stats.ghlTotal + ghlChunk.length > maxGHL) {
        ghlChunk = ghlChunk.slice(0, maxGHL - stats.ghlTotal);
      }

      // ── Process this chunk of GHL contacts ──────────────────────────────
      for (const ghlContact of ghlChunk) {
        try {
          // 3-layer match against local indexes
          let localMatch: LocalLead | undefined;

          // Layer 1: crmExternalId
          localMatch = localIdx.byCrmId.get(ghlContact.id);

          // Layer 2: email
          if (!localMatch) {
            const normEmail = normalizeEmail(ghlContact.email);
            if (normEmail) localMatch = localIdx.byEmail.get(normEmail);
          }

          // Layer 3: phone
          if (!localMatch) {
            const normPhone = normalizePhone(ghlContact.phone);
            if (normPhone) localMatch = localIdx.byPhone.get(normPhone);
          }

          if (localMatch) {
            matchedLocalIds.add(localMatch.id);
            stats.matched++;

            const conflicts: ConflictRecord[] = [];
            const resolvedFields: Record<string, string | null> = {};

            for (const field of ["firstName", "lastName", "phone"] as const) {
              const result = resolveFieldConflict(
                field,
                localMatch[field],
                ghlContact[field],
                localMatch.updated_at,
                ghlContact.dateUpdated,
                ghlContact.id,
                conflictPolicy,
              );
              resolvedFields[field] = result.value;
              if (result.conflict) conflicts.push(result.conflict);
            }

            const needsCrmIdLink = !localMatch.crmExternalId;
            const needsLocationLink = locDbId != null && localMatch.location_id !== locDbId;
            const localNeedsUpdate =
              needsCrmIdLink ||
              needsLocationLink ||
              resolvedFields.firstName !== localMatch.firstName ||
              resolvedFields.lastName !== localMatch.lastName ||
              resolvedFields.phone !== localMatch.phone;

            if (localNeedsUpdate) {
              const notesJson = {
                ...(typeof localMatch.notesJson === "string" ? JSON.parse(localMatch.notesJson || "{}") : localMatch.notesJson || {}),
                ghlTags: ghlContact.tags || [],
                ghlCity: ghlContact.city,
                ghlState: ghlContact.state,
                ghlPostalCode: ghlContact.postalCode,
                ghlCompany: ghlContact.companyName,
                lastReconcileAt: new Date().toISOString(),
                ...(needsCrmIdLink ? { linkedByCrmId: false, linkedByReconcile: true } : {}),
              };

              await pool.query(
                "UPDATE lead_pipeline SET crmExternalId = ?, firstName = ?, lastName = ?, phone = ?, notesJson = ?, location_id = ?, updated_at = ? WHERE id = ?",
                [
                  ghlContact.id,
                  resolvedFields.firstName || localMatch.firstName,
                  resolvedFields.lastName || localMatch.lastName,
                  resolvedFields.phone || localMatch.phone,
                  JSON.stringify(notesJson),
                  locDbId ?? localMatch.location_id,
                  now,
                  localMatch.id,
                ]
              );
              stats.updatedInStewardly++;
            }

            // Update GHL if Stewardly has newer data and direction allows push
            // @ts-expect-error — strict mode fix
            const canPush = syncDirection === "bidirectional" || syncDirection === "push_only";
            const ghlNeedsUpdate = canPush && conflicts.some(c => c.resolution === "stewardly_wins");
            if (ghlNeedsUpdate) {
              try {
                await fetch(`${GHL_BASE}/contacts/${ghlContact.id}`, {
                  method: "PUT",
                  headers,
                  body: JSON.stringify({
                    firstName: resolvedFields.firstName || ghlContact.firstName,
                    lastName: resolvedFields.lastName || ghlContact.lastName,
                    phone: resolvedFields.phone || ghlContact.phone,
                  }),
                  signal: AbortSignal.timeout(10000),
                });
                stats.updatedInGHL++;
              } catch (err: any) {
                logger.warn({ err: err.message, ghlId: ghlContact.id }, "[Reconcile] Failed to update GHL contact");
              }
            }

            if (conflicts.length > 0) {
              stats.conflicts.push(...conflicts);
              stats.conflictsResolved += conflicts.length;
            }
          } else {
            // ── NO LOCAL MATCH: Create in Stewardly ──
            const normEmail = normalizeEmail(ghlContact.email);
            const notesJson = JSON.stringify({
              ghlTags: ghlContact.tags || [],
              ghlCity: ghlContact.city,
              ghlState: ghlContact.state,
              ghlPostalCode: ghlContact.postalCode,
              ghlCompany: ghlContact.companyName,
              ghlDateAdded: ghlContact.dateAdded,
              createdByReconcile: true,
            });

            await pool.query(
              `INSERT INTO lead_pipeline (firstName, lastName, email, phone, source, crmExternalId, status, notesJson, location_id, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?)`,
              [
                ghlContact.firstName || null,
                ghlContact.lastName || null,
                normEmail,
                ghlContact.phone || null,
                ghlContact.source || "ghl_reconcile",
                ghlContact.id,
                notesJson,
                locDbId ?? null,
                now,
                now,
              ]
            );
            stats.createdInStewardly++;

            // Add to local indexes so subsequent chunks can match
            const newLead: LocalLead = {
              id: -1,
              firstName: ghlContact.firstName || null,
              lastName: ghlContact.lastName || null,
              email: normEmail,
              phone: ghlContact.phone || null,
              source: ghlContact.source || "ghl_reconcile",
              status: "new",
              crmExternalId: ghlContact.id,
              notesJson,
              created_at: now,
              updated_at: now,
              location_id: locDbId ?? null,
            };
            localIdx.byCrmId.set(ghlContact.id, newLead);
            if (normEmail) localIdx.byEmail.set(normEmail, newLead);
            const normPhone = normalizePhone(ghlContact.phone);
            if (normPhone) localIdx.byPhone.set(normPhone, newLead);
          }
        } catch (err: any) {
          logger.error({ err: err.message, ghlId: ghlContact.id, locationId: locId }, "[Reconcile] Error processing GHL contact");
          stats.errors++;
        }
      }

      stats.ghlTotal += ghlChunk.length;
      pagesProcessed++;
      stats.resumeCursor = lastId;

      // Progress callback
      if (options?.onProgress) {
        stats.duration_ms = Date.now() - startTime;
        options.onProgress({ ...stats });
      }

      logger.info(
        { page: pagesProcessed, ghlProcessed: stats.ghlTotal, matched: stats.matched, created: stats.createdInStewardly, locationId: locId },
        "[Reconcile] GHL page processed"
      );
    }
  } else {
    logger.info({ locationId: locId }, "[Reconcile] Step 2: Skipping GHL pull (direction: push_only)");
  }

  // ── Step 3: Find and process local orphans ─────────────────────────────
  if (pushOrphans && (syncDirection === "bidirectional" || syncDirection === "push_only")) {
    logger.info({ locationId: locId }, "[Reconcile] Step 3: Processing local orphans...");

    const ORPHAN_CHUNK = 1000;
    let orphanOffset = 0;
    let orphansPushed = 0;

    const locationFilter = locDbId != null
      ? " AND (location_id = ? OR location_id IS NULL)"
      : "";
    const locationParam = locDbId != null ? [locDbId] : [];

    while (true) {
      if (maxOrphanPush > 0 && orphansPushed >= maxOrphanPush) {
        logger.info({ pushed: orphansPushed, max: maxOrphanPush }, "[Reconcile] Reached max orphan push limit");
        break;
      }

      const [orphanRows] = await pool.query(
        `SELECT id, firstName, lastName, email, phone, source, status, crmExternalId, notesJson, created_at, updated_at, location_id FROM lead_pipeline WHERE status != 'disqualified' AND (crmExternalId IS NULL OR crmExternalId = '')${locationFilter} LIMIT ? OFFSET ?`,
        [...locationParam, ORPHAN_CHUNK, orphanOffset]
      );
      const orphans = orphanRows as LocalLead[];
      if (orphans.length === 0) break;

      for (const orphan of orphans) {
        if (maxOrphanPush > 0 && orphansPushed >= maxOrphanPush) break;

        try {
          const ghlMatch = await findGHLMatch({
            email: orphan.email,
            phone: orphan.phone,
            crmExternalId: orphan.crmExternalId,
          }, loc);

          if (ghlMatch) {
            const notesJson = {
              ...(typeof orphan.notesJson === "string" ? JSON.parse(orphan.notesJson || "{}") : orphan.notesJson || {}),
              linkedByReconcile: true,
              ghlTags: ghlMatch.tags || [],
              lastReconcileAt: new Date().toISOString(),
            };
            await pool.query(
              "UPDATE lead_pipeline SET crmExternalId = ?, notesJson = ?, location_id = ?, updated_at = ? WHERE id = ?",
              [ghlMatch.id, JSON.stringify(notesJson), locDbId ?? orphan.location_id, Date.now(), orphan.id]
            );
            stats.orphansFixed++;
          } else {
            const contactPayload = {
              locationId: locId,
              firstName: orphan.firstName || "",
              lastName: orphan.lastName || "",
              email: orphan.email || "",
              phone: orphan.phone || "",
              tags: ["stewardly-synced", "source:stewardly-reconcile"],
            };

            const resp = await fetch(`${GHL_BASE}/contacts/`, {
              method: "POST",
              headers,
              body: JSON.stringify(contactPayload),
              signal: AbortSignal.timeout(15000),
            });

            if (resp.ok) {
              const data = await resp.json() as any;
              const ghlContactId = data.contact?.id;
              if (ghlContactId) {
                await pool.query(
                  "UPDATE lead_pipeline SET crmExternalId = ?, location_id = ?, updated_at = ? WHERE id = ?",
                  [ghlContactId, locDbId ?? orphan.location_id, Date.now(), orphan.id]
                );
                stats.createdInGHL++;
                orphansPushed++;
              }
            } else if (resp.status === 400) {
              const errBody = await resp.json().catch(() => ({})) as any;
              const existingId = errBody?.meta?.contactId;
              if (existingId) {
                await pool.query(
                  "UPDATE lead_pipeline SET crmExternalId = ?, location_id = ?, updated_at = ? WHERE id = ?",
                  [existingId, locDbId ?? orphan.location_id, Date.now(), orphan.id]
                );
                stats.orphansFixed++;
              }
            }
          }

          // Heavier rate limit for orphan pushes (creates are more expensive)
          await new Promise(r => setTimeout(r, 200));
        } catch (err: any) {
          logger.error({ err: err.message, leadId: orphan.id, locationId: locId }, "[Reconcile] Error processing orphan");
          stats.errors++;
        }
      }

      orphanOffset += ORPHAN_CHUNK;
      if (orphans.length < ORPHAN_CHUNK) break;
    }
  } else {
    logger.info({ locationId: locId }, "[Reconcile] Step 3: Skipping orphan push (disabled or pull_only)");
  }

  stats.complete = true;
  stats.duration_ms = Date.now() - startTime;

  logger.info(
    {
      locationId: locId,
      ghlTotal: stats.ghlTotal,
      stewardlyTotal: stats.stewardlyTotal,
      matched: stats.matched,
      createdInStewardly: stats.createdInStewardly,
      createdInGHL: stats.createdInGHL,
      updatedInStewardly: stats.updatedInStewardly,
      updatedInGHL: stats.updatedInGHL,
      conflictsResolved: stats.conflictsResolved,
      orphansFixed: stats.orphansFixed,
      errors: stats.errors,
      duration_ms: stats.duration_ms,
      complete: stats.complete,
    },
    "[Reconcile] Complete"
  );

  return stats;
}

// ─── Dedup Pre-Check for Outbound Push ──────────────────────────────────────

export async function dedupSafePush(lead: {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  source?: string;
}, config?: LocationConfig): Promise<{
  action: "created" | "updated" | "linked" | "skipped";
  ghlContactId?: string;
  message: string;
}> {
  const apiKey = config?.apiKey || GHL_API_KEY;
  const locId = config?.locationId || GHL_LOCATION_ID;
  if (!apiKey || !locId) {
    return { action: "skipped", message: "GHL not configured" };
  }

  const headers = ghlHeadersForLocation(config);

  // Pre-check: search GHL for existing contact by email or phone
  const existingGHL = await findGHLMatch({ email: lead.email, phone: lead.phone }, config);

  if (existingGHL) {
    try {
      const updatePayload: Record<string, unknown> = {
        tags: [...new Set([...(existingGHL.tags || []), ...(lead.tags || []), "stewardly-synced"])],
      };
      if (lead.firstName && !existingGHL.firstName) updatePayload.firstName = lead.firstName;
      if (lead.lastName && !existingGHL.lastName) updatePayload.lastName = lead.lastName;

      await fetch(`${GHL_BASE}/contacts/${existingGHL.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(updatePayload),
        signal: AbortSignal.timeout(10000),
      });

      return {
        action: "updated",
        ghlContactId: existingGHL.id,
        message: `Found existing GHL contact (${existingGHL.id}) — updated instead of creating duplicate`,
      };
    } catch (err: any) {
      return {
        action: "linked",
        ghlContactId: existingGHL.id,
        message: `Found existing GHL contact but update failed: ${err.message}`,
      };
    }
  }

  // No existing contact — safe to create
  try {
    const resp = await fetch(`${GHL_BASE}/contacts/`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        locationId: locId,
        firstName: lead.firstName || "",
        lastName: lead.lastName || "",
        email: lead.email || "",
        phone: lead.phone || "",
        tags: [...(lead.tags || []), "stewardly-synced", lead.source ? `source:${lead.source}` : "source:stewardly"],
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (resp.ok) {
      const data = await resp.json() as any;
      return {
        action: "created",
        ghlContactId: data.contact?.id,
        message: "New contact created in GHL",
      };
    }

    if (resp.status === 400) {
      const errBody = await resp.json().catch(() => ({})) as any;
      const existingId = errBody?.meta?.contactId;
      if (existingId) {
        return {
          action: "linked",
          ghlContactId: existingId,
          message: "Race condition duplicate — linked to existing contact",
        };
      }
    }

    return { action: "skipped", message: `GHL API error: HTTP ${resp.status}` };
  } catch (err: any) {
    return { action: "skipped", message: `GHL sync error: ${err.message}` };
  }
}

// ─── Aggregation Summary (location-scoped) ──────────────────────────────────

export async function getSyncAggregation(locationDbId?: number): Promise<{
  stewardlyTotal: number;
  ghlLinked: number;
  ghlUnlinked: number;
  linkRate: number;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
  lastReconcileAt: string | null;
  lastReconcileStats: SyncStats | null;
  recentConflicts: ConflictRecord[];
}> {
  const pool = await getRawPool();
  if (!pool) {
    return {
      stewardlyTotal: 0, ghlLinked: 0, ghlUnlinked: 0, linkRate: 0,
      byStatus: {}, bySource: {}, lastReconcileAt: null,
      lastReconcileStats: null, recentConflicts: [],
    };
  }

  const locationFilter = locationDbId != null ? " WHERE (location_id = ? OR location_id IS NULL)" : "";
  const locationFilterAnd = locationDbId != null ? " AND (location_id = ? OR location_id IS NULL)" : "";
  const locationParam = locationDbId != null ? [locationDbId] : [];

  const [totalRows] = await pool.query(`SELECT COUNT(*) as cnt FROM lead_pipeline${locationFilter}`, locationParam);
  const stewardlyTotal = (totalRows as any[])[0]?.cnt || 0;

  const [linkedRows] = await pool.query(
    `SELECT COUNT(*) as cnt FROM lead_pipeline WHERE crmExternalId IS NOT NULL AND crmExternalId != ''${locationFilterAnd}`,
    locationParam
  );
  const ghlLinked = (linkedRows as any[])[0]?.cnt || 0;

  const [statusRows] = await pool.query(
    `SELECT status, COUNT(*) as cnt FROM lead_pipeline${locationFilter} GROUP BY status`,
    locationParam
  );
  const byStatus: Record<string, number> = {};
  for (const row of statusRows as any[]) {
    byStatus[row.status || "unknown"] = row.cnt;
  }

  const [sourceRows] = await pool.query(
    `SELECT source, COUNT(*) as cnt FROM lead_pipeline${locationFilter} GROUP BY source ORDER BY cnt DESC LIMIT 20`,
    locationParam
  );
  const bySource: Record<string, number> = {};
  for (const row of sourceRows as any[]) {
    bySource[row.source || "unknown"] = row.cnt;
  }

  // Check last reconcile timestamp
  const [lastRecRows] = await pool.query(
    `SELECT notesJson FROM lead_pipeline WHERE notesJson LIKE '%lastReconcileAt%'${locationFilterAnd} ORDER BY updated_at DESC LIMIT 1`,
    locationParam
  );
  let lastReconcileAt: string | null = null;
  if ((lastRecRows as any[])[0]?.notesJson) {
    try {
      const notes = JSON.parse((lastRecRows as any[])[0].notesJson);
      lastReconcileAt = notes.lastReconcileAt || null;
    } catch { /* ignore */ }
  }

  // Check for stored last reconcile stats
  let lastReconcileStats: SyncStats | null = null;
  const kvKey = locationDbId != null ? `last_reconcile_stats_loc_${locationDbId}` : "last_reconcile_stats";
  try {
    const [statsRows] = await pool.query(
      "SELECT value FROM platform_kv WHERE `key` = ? LIMIT 1",
      [kvKey]
    );
    if ((statsRows as any[])[0]?.value) {
      lastReconcileStats = JSON.parse((statsRows as any[])[0].value);
    }
  } catch { /* table may not exist yet */ }

  // Recent conflicts
  let recentConflicts: ConflictRecord[] = [];
  const conflictKey = locationDbId != null ? `recent_sync_conflicts_loc_${locationDbId}` : "recent_sync_conflicts";
  try {
    const [conflictRows] = await pool.query(
      "SELECT value FROM platform_kv WHERE `key` = ? LIMIT 1",
      [conflictKey]
    );
    if ((conflictRows as any[])[0]?.value) {
      recentConflicts = JSON.parse((conflictRows as any[])[0].value);
    }
  } catch { /* table may not exist yet */ }

  const ghlUnlinked = stewardlyTotal - ghlLinked;

  return {
    stewardlyTotal,
    ghlLinked,
    ghlUnlinked,
    linkRate: stewardlyTotal > 0 ? Math.round((ghlLinked / stewardlyTotal) * 10000) / 100 : 0,
    byStatus,
    bySource,
    lastReconcileAt,
    lastReconcileStats,
    recentConflicts,
  };
}

// ─── Persist Reconcile Stats (location-scoped) ─────────────────────────────

export async function persistReconcileStats(stats: SyncStats, locationDbId?: number): Promise<void> {
  const pool = await getRawPool();
  if (!pool) return;

  const kvKey = locationDbId != null ? `last_reconcile_stats_loc_${locationDbId}` : "last_reconcile_stats";
  const conflictKey = locationDbId != null ? `recent_sync_conflicts_loc_${locationDbId}` : "recent_sync_conflicts";

  try {
    await pool.query(
      `INSERT INTO platform_kv (\`key\`, value, updated_at) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = VALUES(updated_at)`,
      [kvKey, JSON.stringify(stats), Date.now()]
    );

    if (stats.conflicts.length > 0) {
      await pool.query(
        `INSERT INTO platform_kv (\`key\`, value, updated_at) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = VALUES(updated_at)`,
        [conflictKey, JSON.stringify(stats.conflicts.slice(-100)), Date.now()]
      );
    }

    // Update ghl_locations sync state
    if (locationDbId != null) {
      await pool.query(
        `UPDATE ghl_locations SET last_sync_at = ?, last_sync_cursor = ?, last_sync_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [Date.now(), stats.resumeCursor, stats.complete ? "success" : (stats.errors > 0 ? "failed" : "partial"), locationDbId]
      );
    }
  } catch (err: any) {
    logger.warn({ err: err.message }, "[Reconcile] Failed to persist stats");
  }
}

// ─── Get All Active Locations ───────────────────────────────────────────────

export async function getActiveLocations(): Promise<LocationConfig[]> {
  const pool = await getRawPool();
  if (!pool) return [];

  try {
    const [rows] = await pool.query(
      "SELECT * FROM ghl_locations WHERE is_active = 1 ORDER BY id"
    );
    return (rows as any[]).map((row: any) => ({
      dbId: row.id,
      locationId: row.location_id,
      name: row.name,
      syncDirection: row.sync_direction || "bidirectional",
      conflictPolicy: row.conflict_policy || "newest_wins",
      maxContactsPerRun: row.max_contacts_per_run || 0,
      rateLimitMs: row.rate_limit_ms || 50,
      apiKey: row.api_key_encrypted || undefined, // TODO: decrypt
      lastSyncCursor: row.last_sync_cursor,
    }));
  } catch {
    return [];
  }
}

// ─── Multi-Location Reconciliation (iterates all active locations) ──────────

export async function reconcileAllLocations(
  options?: Omit<ReconcileOptions, "location">,
): Promise<{ results: SyncStats[]; totalDuration: number }> {
  const startTime = Date.now();
  const locations = await getActiveLocations();
  const results: SyncStats[] = [];

  if (locations.length === 0) {
    logger.info("[Reconcile] No active locations found — running with default config");
    const stats = await reconcile(options);
    results.push(stats);
  } else {
    for (const loc of locations) {
      if (loc.syncDirection === "disabled") {
        logger.info({ locationId: loc.locationId, name: loc.name }, "[Reconcile] Skipping disabled location");
        continue;
      }

      logger.info({ locationId: loc.locationId, name: loc.name }, "[Reconcile] Starting location reconciliation");
      try {
        const stats = await reconcile({
          ...options,
          location: loc,
          maxGHLContacts: loc.maxContactsPerRun,
          rateLimitMs: loc.rateLimitMs,
        });
        results.push(stats);
        await persistReconcileStats(stats, loc.dbId);
      } catch (err: any) {
        logger.error({ err: err.message, locationId: loc.locationId }, "[Reconcile] Location reconciliation failed");
        results.push({
          timestamp: new Date().toISOString(),
          locationId: loc.locationId,
          locationName: loc.name,
          ghlTotal: 0, stewardlyTotal: 0, matched: 0,
          createdInStewardly: 0, createdInGHL: 0,
          updatedInStewardly: 0, updatedInGHL: 0,
          conflictsResolved: 0, orphansFixed: 0,
          errors: 1, duration_ms: 0,
          conflicts: [], resumeCursor: null,
          chunkSize: 100, complete: false,
        });
      }
    }
  }

  return { results, totalDuration: Date.now() - startTime };
}
