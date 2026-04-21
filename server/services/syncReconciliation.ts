/**
 * Sync Reconciliation Engine
 * 
 * Ensures total aggregation, consistency, and stability between
 * Stewardly lead_pipeline and GoHighLevel contacts.
 * 
 * Key guarantees:
 * 1. NO DUPLICATES — 3-layer dedup: crmExternalId → email → phone
 * 2. CONFLICT RESOLUTION — newer timestamp wins, with full audit trail
 * 3. BIDIRECTIONAL CONSISTENCY — every Stewardly lead has a GHL contact and vice versa
 * 4. AGGREGATION TOTALS — sync stats with match counts and conflict log
 * 5. IDEMPOTENT — safe to run multiple times without side effects
 */

import pino from "pino";
import { getRawPool } from "../db";

const logger = pino({ name: "sync-reconciliation" });

const GHL_API_KEY = process.env.GHL_API_KEY || "";
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || "";
const GHL_BASE = "https://services.leadconnectorhq.com";

const ghlHeaders = () => ({
  Authorization: `Bearer ${GHL_API_KEY}`,
  Version: "2021-07-28",
  "Content-Type": "application/json",
});

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SyncStats {
  timestamp: string;
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
}

export interface ConflictRecord {
  field: string;
  stewardlyValue: string | null;
  ghlValue: string | null;
  resolution: "stewardly_wins" | "ghl_wins" | "merged";
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
}

// ─── Normalization helpers ──────────────────────────────────────────────────

function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return email.toLowerCase().trim();
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  // Strip all non-digit characters, keep last 10 digits
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return null; // too short to be a real phone
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

// ─── 3-Layer Dedup Matcher ──────────────────────────────────────────────────

export async function findLocalMatch(
  contact: { email?: string; phone?: string; crmExternalId?: string },
): Promise<LocalLead | null> {
  const pool = await getRawPool();
  if (!pool) return null;

  // Layer 1: crmExternalId (strongest match)
  if (contact.crmExternalId) {
    const [rows] = await pool.query(
      "SELECT * FROM lead_pipeline WHERE crmExternalId = ? LIMIT 1",
      [contact.crmExternalId]
    );
    const match = (rows as any[])[0];
    if (match) return match as LocalLead;
  }

  // Layer 2: email (strong match)
  const normEmail = normalizeEmail(contact.email);
  if (normEmail) {
    const [rows] = await pool.query(
      "SELECT * FROM lead_pipeline WHERE email = ? LIMIT 1",
      [normEmail]
    );
    const match = (rows as any[])[0];
    if (match) return match as LocalLead;
  }

  // Layer 3: phone (moderate match — only if email didn't match)
  const normPhone = normalizePhone(contact.phone);
  if (normPhone) {
    const [rows] = await pool.query(
      "SELECT * FROM lead_pipeline WHERE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, '-', ''), ' ', ''), '(', ''), ')', ''), '+', '') LIKE ? LIMIT 1",
      [`%${normPhone}`]
    );
    const match = (rows as any[])[0];
    if (match) return match as LocalLead;
  }

  return null;
}

export async function findGHLMatch(
  lead: { email?: string | null; phone?: string | null; crmExternalId?: string | null },
): Promise<GHLContact | null> {
  if (!GHL_API_KEY || !GHL_LOCATION_ID) return null;

  // Layer 1: Direct lookup by crmExternalId
  if (lead.crmExternalId) {
    try {
      const resp = await fetch(`${GHL_BASE}/contacts/${lead.crmExternalId}`, {
        headers: ghlHeaders(),
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
        `${GHL_BASE}/contacts/search/duplicate?locationId=${GHL_LOCATION_ID}&email=${encodeURIComponent(lead.email)}`,
        { headers: ghlHeaders(), signal: AbortSignal.timeout(10000) }
      );
      if (resp.ok) {
        const data = await resp.json() as any;
        const contact = data.contact;
        if (contact?.id) return contact;
      }
    } catch { /* fall through */ }
  }

  // Layer 3: Search by phone
  if (lead.phone) {
    try {
      const resp = await fetch(
        `${GHL_BASE}/contacts/search/duplicate?locationId=${GHL_LOCATION_ID}&phone=${encodeURIComponent(lead.phone)}`,
        { headers: ghlHeaders(), signal: AbortSignal.timeout(10000) }
      );
      if (resp.ok) {
        const data = await resp.json() as any;
        const contact = data.contact;
        if (contact?.id) return contact;
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
): { value: string | null; conflict?: ConflictRecord } {
  const normLocal = localValue?.trim() || null;
  const normGHL = (ghlValue as string)?.trim() || null;

  // No conflict if values match or one is empty
  if (normLocal === normGHL) return { value: normLocal };
  if (!normLocal && normGHL) return { value: normGHL };
  if (normLocal && !normGHL) return { value: normLocal };

  // Both have values — newer timestamp wins
  const localTs = localUpdated || 0;
  const ghlTs = ghlUpdated ? new Date(ghlUpdated).getTime() : 0;

  if (ghlTs > localTs) {
    return {
      value: normGHL,
      conflict: {
        field,
        stewardlyValue: normLocal,
        ghlValue: normGHL,
        resolution: "ghl_wins",
        reason: `GHL updated more recently (${new Date(ghlTs).toISOString()} > ${new Date(localTs).toISOString()})`,
        contactId,
      },
    };
  }

  return {
    value: normLocal,
    conflict: {
      field,
      stewardlyValue: normLocal,
      ghlValue: normGHL,
      resolution: "stewardly_wins",
      reason: `Stewardly updated more recently (${new Date(localTs).toISOString()} > ${new Date(ghlTs).toISOString()})`,
      contactId,
    },
  };
}

// ─── Full Bidirectional Reconciliation ──────────────────────────────────────

export interface ReconcileOptions {
  /** Max GHL contacts to fetch (default 500, set 0 for unlimited) */
  maxGHLContacts?: number;
  /** Whether to push local orphans to GHL (default true) */
  pushOrphans?: boolean;
}

export async function reconcile(options?: ReconcileOptions): Promise<SyncStats> {
  const maxGHL = options?.maxGHLContacts ?? 500;
  const pushOrphans = options?.pushOrphans ?? true;
  const startTime = Date.now();
  const stats: SyncStats = {
    timestamp: new Date().toISOString(),
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
  };

  if (!GHL_API_KEY || !GHL_LOCATION_ID) {
    logger.warn("[Reconcile] GHL credentials not configured");
    stats.duration_ms = Date.now() - startTime;
    return stats;
  }

  const pool = await getRawPool();
  if (!pool) {
    logger.error("[Reconcile] Database pool unavailable");
    stats.duration_ms = Date.now() - startTime;
    return stats;
  }

  // ── Step 1: Fetch all GHL contacts ──────────────────────────────────────
  logger.info("[Reconcile] Step 1: Fetching all GHL contacts...");
  const ghlContacts: GHLContact[] = [];
  let nextPageUrl: string | null = `${GHL_BASE}/contacts/?locationId=${GHL_LOCATION_ID}&limit=100`;

  while (nextPageUrl) {
    if (maxGHL > 0 && ghlContacts.length >= maxGHL) {
      logger.info({ fetched: ghlContacts.length, max: maxGHL }, "[Reconcile] Reached max GHL contacts limit");
      break;
    }
    try {
      const resp = await fetch(nextPageUrl, {
        headers: ghlHeaders(),
        signal: AbortSignal.timeout(30000),
      });
      if (!resp.ok) {
        logger.error({ status: resp.status }, "[Reconcile] GHL API error");
        break;
      }
      const data = await resp.json() as any;
      ghlContacts.push(...(data.contacts || []));
      logger.info({ fetched: ghlContacts.length }, "[Reconcile] GHL contacts page fetched");
      if (data.meta?.startAfterId && (data.contacts?.length || 0) >= 100) {
        nextPageUrl = `${GHL_BASE}/contacts/?locationId=${GHL_LOCATION_ID}&limit=100&startAfterId=${data.meta.startAfterId}`;
      } else {
        nextPageUrl = null;
      }
    } catch (err: any) {
      logger.error({ err: err.message }, "[Reconcile] GHL pagination error");
      break;
    }
  }
  // Trim to max if we over-fetched
  if (maxGHL > 0 && ghlContacts.length > maxGHL) {
    ghlContacts.length = maxGHL;
  }
  stats.ghlTotal = ghlContacts.length;
  logger.info({ count: ghlContacts.length }, "[Reconcile] GHL contacts fetched");

  // ── Step 2: Fetch all local leads ───────────────────────────────────────
  logger.info("[Reconcile] Step 2: Fetching all local leads...");
  const [localRows] = await pool.query(
    "SELECT id, firstName, lastName, email, phone, source, status, crmExternalId, notesJson, created_at, updated_at FROM lead_pipeline WHERE status != 'disqualified'"
  );
  const localLeads = localRows as LocalLead[];
  stats.stewardlyTotal = localLeads.length;
  logger.info({ count: localLeads.length }, "[Reconcile] Local leads fetched");

  // Build lookup indexes for fast matching
  const localByCrmId = new Map<string, LocalLead>();
  const localByEmail = new Map<string, LocalLead>();
  const localByPhone = new Map<string, LocalLead>();
  const matchedLocalIds = new Set<number>();
  const matchedGHLIds = new Set<string>();

  for (const lead of localLeads) {
    if (lead.crmExternalId) localByCrmId.set(lead.crmExternalId, lead);
    const normEmail = normalizeEmail(lead.email);
    if (normEmail) localByEmail.set(normEmail, lead);
    const normPhone = normalizePhone(lead.phone);
    if (normPhone) localByPhone.set(normPhone, lead);
  }

  // ── Step 3: Match GHL contacts to local leads ──────────────────────────
  logger.info("[Reconcile] Step 3: Matching GHL contacts to local leads...");
  const now = Date.now();

  for (const ghlContact of ghlContacts) {
    try {
      // 3-layer match
      let localMatch: LocalLead | undefined;

      // Layer 1: crmExternalId
      localMatch = localByCrmId.get(ghlContact.id);

      // Layer 2: email
      if (!localMatch) {
        const normEmail = normalizeEmail(ghlContact.email);
        if (normEmail) localMatch = localByEmail.get(normEmail);
      }

      // Layer 3: phone
      if (!localMatch) {
        const normPhone = normalizePhone(ghlContact.phone);
        if (normPhone) localMatch = localByPhone.get(normPhone);
      }

      if (localMatch) {
        // ── MATCHED: Reconcile field-level conflicts ──
        matchedLocalIds.add(localMatch.id);
        matchedGHLIds.add(ghlContact.id);
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
          );
          resolvedFields[field] = result.value;
          if (result.conflict) conflicts.push(result.conflict);
        }

        // Link crmExternalId if not already linked
        const needsCrmIdLink = !localMatch.crmExternalId;

        // Check if local needs update
        const localNeedsUpdate =
          needsCrmIdLink ||
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
            "UPDATE lead_pipeline SET crmExternalId = ?, firstName = ?, lastName = ?, phone = ?, notesJson = ?, updated_at = ? WHERE id = ?",
            [
              ghlContact.id,
              resolvedFields.firstName || localMatch.firstName,
              resolvedFields.lastName || localMatch.lastName,
              resolvedFields.phone || localMatch.phone,
              JSON.stringify(notesJson),
              now,
              localMatch.id,
            ]
          );
          stats.updatedInStewardly++;
        }

        // Check if GHL needs update (Stewardly has newer data for a field)
        const ghlNeedsUpdate = conflicts.some(c => c.resolution === "stewardly_wins");
        if (ghlNeedsUpdate) {
          try {
            const updatePayload: Record<string, string | string[]> = {};
            for (const c of conflicts) {
              if (c.resolution === "stewardly_wins" && c.stewardlyValue) {
                updatePayload[c.field] = c.stewardlyValue;
              }
            }
            // Add stewardly-synced tag if not present
            if (!ghlContact.tags?.includes("stewardly-synced")) {
              updatePayload.tags = [...(ghlContact.tags || []), "stewardly-synced"];
            }

            await fetch(`${GHL_BASE}/contacts/${ghlContact.id}`, {
              method: "PUT",
              headers: ghlHeaders(),
              body: JSON.stringify(updatePayload),
              signal: AbortSignal.timeout(10000),
            });
            stats.updatedInGHL++;
          } catch (err: any) {
            logger.error({ err: err.message, ghlId: ghlContact.id }, "[Reconcile] Failed to update GHL contact");
            stats.errors++;
          }
        }

        stats.conflictsResolved += conflicts.length;
        stats.conflicts.push(...conflicts);
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
          `INSERT INTO lead_pipeline (firstName, lastName, email, phone, source, crmExternalId, status, notesJson, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'new', ?, ?, ?)`,
          [
            ghlContact.firstName || null,
            ghlContact.lastName || null,
            normEmail,
            ghlContact.phone || null,
            ghlContact.source || "ghl_reconcile",
            ghlContact.id,
            notesJson,
            now,
            now,
          ]
        );
        matchedGHLIds.add(ghlContact.id);
        stats.createdInStewardly++;
      }

      // Rate limit protection
      await new Promise(r => setTimeout(r, 50));
    } catch (err: any) {
      logger.error({ err: err.message, ghlId: ghlContact.id }, "[Reconcile] Error processing GHL contact");
      stats.errors++;
    }
  }

  // ── Step 4: Find local orphans (leads without GHL contact) ─────────────
  if (!pushOrphans) {
    logger.info("[Reconcile] Step 4: Skipping orphan push (disabled)");
    stats.duration_ms = Date.now() - startTime;
    logger.info(stats, "[Reconcile] Complete (orphan push disabled)");
    return stats;
  }
  logger.info("[Reconcile] Step 4: Finding local orphans...");
  const orphanLeads = localLeads.filter(l => !matchedLocalIds.has(l.id));

  for (const orphan of orphanLeads) {
    try {
      // Search GHL for this lead before creating (dedup pre-check)
      const ghlMatch = await findGHLMatch({
        email: orphan.email,
        phone: orphan.phone,
        crmExternalId: orphan.crmExternalId,
      });

      if (ghlMatch) {
        // Link the orphan to the existing GHL contact
        const notesJson = {
          ...(typeof orphan.notesJson === "string" ? JSON.parse(orphan.notesJson || "{}") : orphan.notesJson || {}),
          linkedByReconcile: true,
          ghlTags: ghlMatch.tags || [],
          lastReconcileAt: new Date().toISOString(),
        };
        await pool.query(
          "UPDATE lead_pipeline SET crmExternalId = ?, notesJson = ?, updated_at = ? WHERE id = ?",
          [ghlMatch.id, JSON.stringify(notesJson), now, orphan.id]
        );
        stats.orphansFixed++;
      } else {
        // Create in GHL (push orphan)
        const contactPayload = {
          locationId: GHL_LOCATION_ID,
          firstName: orphan.firstName || "",
          lastName: orphan.lastName || "",
          email: orphan.email || "",
          phone: orphan.phone || "",
          tags: ["stewardly-synced", "source:stewardly-reconcile"],
        };

        const resp = await fetch(`${GHL_BASE}/contacts/`, {
          method: "POST",
          headers: ghlHeaders(),
          body: JSON.stringify(contactPayload),
          signal: AbortSignal.timeout(15000),
        });

        if (resp.ok) {
          const data = await resp.json() as any;
          const ghlContactId = data.contact?.id;
          if (ghlContactId) {
            await pool.query(
              "UPDATE lead_pipeline SET crmExternalId = ?, updated_at = ? WHERE id = ?",
              [ghlContactId, now, orphan.id]
            );
            stats.createdInGHL++;
          }
        } else if (resp.status === 400) {
          // Duplicate in GHL — extract existing ID
          const errBody = await resp.json().catch(() => ({})) as any;
          const existingId = errBody?.meta?.contactId;
          if (existingId) {
            await pool.query(
              "UPDATE lead_pipeline SET crmExternalId = ?, updated_at = ? WHERE id = ?",
              [existingId, now, orphan.id]
            );
            stats.orphansFixed++;
          }
        }
      }

      // Rate limit protection
      await new Promise(r => setTimeout(r, 200));
    } catch (err: any) {
      logger.error({ err: err.message, leadId: orphan.id }, "[Reconcile] Error processing orphan");
      stats.errors++;
    }
  }

  stats.duration_ms = Date.now() - startTime;
  logger.info(
    {
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
}): Promise<{
  action: "created" | "updated" | "linked" | "skipped";
  ghlContactId?: string;
  message: string;
}> {
  if (!GHL_API_KEY || !GHL_LOCATION_ID) {
    return { action: "skipped", message: "GHL not configured" };
  }

  // Pre-check: search GHL for existing contact by email or phone
  const existingGHL = await findGHLMatch({ email: lead.email, phone: lead.phone });

  if (existingGHL) {
    // Update existing instead of creating duplicate
    try {
      const updatePayload: Record<string, unknown> = {
        tags: [...new Set([...(existingGHL.tags || []), ...(lead.tags || []), "stewardly-synced"])],
      };
      if (lead.firstName && !existingGHL.firstName) updatePayload.firstName = lead.firstName;
      if (lead.lastName && !existingGHL.lastName) updatePayload.lastName = lead.lastName;

      await fetch(`${GHL_BASE}/contacts/${existingGHL.id}`, {
        method: "PUT",
        headers: ghlHeaders(),
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
      headers: ghlHeaders(),
      body: JSON.stringify({
        locationId: GHL_LOCATION_ID,
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

    // Handle 400 duplicate (race condition — contact created between our check and create)
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

// ─── Aggregation Summary ────────────────────────────────────────────────────

export async function getSyncAggregation(): Promise<{
  stewardlyTotal: number;
  ghlLinked: number;
  ghlUnlinked: number;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
  lastReconcileAt: string | null;
}> {
  const pool = await getRawPool();
  if (!pool) {
    return { stewardlyTotal: 0, ghlLinked: 0, ghlUnlinked: 0, byStatus: {}, bySource: {}, lastReconcileAt: null };
  }

  const [totalRows] = await pool.query("SELECT COUNT(*) as cnt FROM lead_pipeline");
  const stewardlyTotal = (totalRows as any[])[0]?.cnt || 0;

  const [linkedRows] = await pool.query("SELECT COUNT(*) as cnt FROM lead_pipeline WHERE crmExternalId IS NOT NULL AND crmExternalId != ''");
  const ghlLinked = (linkedRows as any[])[0]?.cnt || 0;

  const [statusRows] = await pool.query("SELECT status, COUNT(*) as cnt FROM lead_pipeline GROUP BY status");
  const byStatus: Record<string, number> = {};
  for (const row of statusRows as any[]) {
    byStatus[row.status || "unknown"] = row.cnt;
  }

  const [sourceRows] = await pool.query("SELECT source, COUNT(*) as cnt FROM lead_pipeline GROUP BY source ORDER BY cnt DESC LIMIT 20");
  const bySource: Record<string, number> = {};
  for (const row of sourceRows as any[]) {
    bySource[row.source || "unknown"] = row.cnt;
  }

  // Check last reconcile timestamp from notesJson
  const [lastRecRows] = await pool.query(
    "SELECT notesJson FROM lead_pipeline WHERE notesJson LIKE '%lastReconcileAt%' ORDER BY updated_at DESC LIMIT 1"
  );
  let lastReconcileAt: string | null = null;
  if ((lastRecRows as any[])[0]?.notesJson) {
    try {
      const notes = JSON.parse((lastRecRows as any[])[0].notesJson);
      lastReconcileAt = notes.lastReconcileAt || null;
    } catch { /* ignore */ }
  }

  return {
    stewardlyTotal,
    ghlLinked,
    ghlUnlinked: stewardlyTotal - ghlLinked,
    byStatus,
    bySource,
    lastReconcileAt,
  };
}
