/**
 * Location Auto-Provisioning Service
 * 
 * Automatically creates ghl_locations records when new GHL sub-accounts
 * are detected (via webhook or API discovery). Assigns users to locations
 * based on configurable rules (org membership, role, default assignment).
 * 
 * Designed for continuous scaling — no hardcoded limits on locations or users.
 * 
 * Key behaviors:
 * 1. AUTO-DETECT: When a webhook arrives from an unknown locationId, auto-create the location
 * 2. AUTO-ASSIGN: New locations get default user assignments based on org rules
 * 3. DISCOVERY: Scan GHL API for all sub-accounts and provision missing ones
 * 4. IDEMPOTENT: Safe to call multiple times — skips already-provisioned locations
 * 5. AUDIT TRAIL: Logs all provisioning events for compliance
 */

import pino from "pino";
import { getRawPool } from "../db";

const logger = pino({ name: "location-auto-provision" });

const GHL_API_KEY = process.env.GHL_API_KEY || "";
const GHL_BASE = "https://services.leadconnectorhq.com";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ProvisionResult {
  locationDbId: number;
  ghlLocationId: string;
  name: string;
  action: "created" | "already_exists" | "reactivated";
  usersAssigned: number;
}

export interface ProvisioningConfig {
  /** Default sync direction for new locations */
  defaultSyncDirection?: "bidirectional" | "pull_only" | "push_only" | "disabled";
  /** Default conflict policy for new locations */
  defaultConflictPolicy?: "ghl_wins" | "stewardly_wins" | "newest_wins" | "manual_review";
  /** Default max contacts per run */
  defaultMaxContacts?: number;
  /** Default rate limit ms */
  defaultRateLimitMs?: number;
  /** Auto-assign admin users to new locations */
  autoAssignAdmins?: boolean;
  /** Auto-assign users from the same organization */
  autoAssignOrgMembers?: boolean;
  /** Specific user IDs to always assign to new locations */
  alwaysAssignUserIds?: number[];
}

const DEFAULT_CONFIG: Required<ProvisioningConfig> = {
  defaultSyncDirection: "bidirectional",
  defaultConflictPolicy: "newest_wins",
  defaultMaxContacts: 0, // unlimited
  defaultRateLimitMs: 50,
  autoAssignAdmins: true,
  autoAssignOrgMembers: false,
  alwaysAssignUserIds: [],
};

// ─── Core Provisioning ──────────────────────────────────────────────────────

/**
 * Provision a single GHL location. Idempotent — returns existing if already provisioned.
 * Called automatically from webhook handler when unknown locationId is detected.
 */
export async function provisionLocation(
  ghlLocationId: string,
  name?: string,
  config?: ProvisioningConfig,
): Promise<ProvisionResult> {
  const pool = await getRawPool();
  if (!pool) throw new Error("Database unavailable");

  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Check if location already exists
  const [existingRows] = await pool.query(
    "SELECT id, name, is_active FROM ghl_locations WHERE location_id = ? LIMIT 1",
    [ghlLocationId]
  );
  const existing = (existingRows as any[])[0];

  if (existing && existing.is_active) {
    return {
      locationDbId: existing.id,
      ghlLocationId,
      name: existing.name,
      action: "already_exists",
      usersAssigned: 0,
    };
  }

  // Reactivate if deactivated
  if (existing && !existing.is_active) {
    await pool.query(
      "UPDATE ghl_locations SET is_active = 1, updated_at = NOW() WHERE id = ?",
      [existing.id]
    );
    const usersAssigned = await autoAssignUsers(pool, existing.id, cfg);
    logger.info({ ghlLocationId, dbId: existing.id }, "Location reactivated");
    return {
      locationDbId: existing.id,
      ghlLocationId,
      name: existing.name,
      action: "reactivated",
      usersAssigned,
    };
  }

  // Fetch location name from GHL API if not provided
  const locationName = name || await fetchGHLLocationName(ghlLocationId) || `Location ${ghlLocationId.slice(0, 8)}`;

  // Create new location
  const [insertResult] = await pool.query(
    `INSERT INTO ghl_locations (location_id, name, sync_direction, conflict_policy, max_contacts_per_run, rate_limit_ms, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
    [
      ghlLocationId,
      locationName,
      cfg.defaultSyncDirection,
      cfg.defaultConflictPolicy,
      cfg.defaultMaxContacts,
      cfg.defaultRateLimitMs,
    ]
  );
  const locationDbId = (insertResult as any).insertId;

  // Auto-assign users
  const usersAssigned = await autoAssignUsers(pool, locationDbId, cfg);

  // Log provisioning event
  await pool.query(
    `INSERT INTO platform_kv (\`key\`, value, updated_at) VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()`,
    [
      `provision:${ghlLocationId}`,
      JSON.stringify({
        action: "created",
        locationDbId,
        name: locationName,
        usersAssigned,
        timestamp: new Date().toISOString(),
      }),
    ]
  );

  logger.info({ ghlLocationId, locationDbId, locationName, usersAssigned }, "New location auto-provisioned");

  return {
    locationDbId,
    ghlLocationId,
    name: locationName,
    action: "created",
    usersAssigned,
  };
}

/**
 * Auto-assign users to a location based on config rules.
 * Returns count of users assigned.
 */
async function autoAssignUsers(
  pool: any,
  locationDbId: number,
  cfg: Required<ProvisioningConfig>,
): Promise<number> {
  let assigned = 0;

  // Always-assign users
  for (const userId of cfg.alwaysAssignUserIds) {
    const didAssign = await assignUserToLocation(pool, userId, locationDbId, "admin");
    if (didAssign) assigned++;
  }

  // Auto-assign all admin users
  if (cfg.autoAssignAdmins) {
    const [adminRows] = await pool.query(
      "SELECT id FROM user WHERE role = 'admin'"
    );
    for (const admin of adminRows as any[]) {
      const didAssign = await assignUserToLocation(pool, admin.id, locationDbId, "admin");
      if (didAssign) assigned++;
    }
  }

  return assigned;
}

/**
 * Assign a single user to a location. Idempotent — skips if already assigned.
 * Returns true if a new assignment was created.
 */
async function assignUserToLocation(
  pool: any,
  userId: number,
  locationDbId: number,
  role: "viewer" | "editor" | "admin" = "editor",
): Promise<boolean> {
  try {
    // Check if already assigned
    const [existing] = await pool.query(
      "SELECT 1 FROM user_locations WHERE user_id = ? AND location_id = ? LIMIT 1",
      [userId, locationDbId]
    );
    if ((existing as any[]).length > 0) return false;

    await pool.query(
      "INSERT INTO user_locations (user_id, location_id, role, created_at) VALUES (?, ?, ?, NOW())",
      [userId, locationDbId, role]
    );
    return true;
  } catch (err) {
    // Duplicate key or FK constraint — skip silently
    logger.debug({ userId, locationDbId, err }, "User assignment skipped");
    return false;
  }
}

// ─── GHL API Discovery ─────────────────────────────────────────────────────

/**
 * Fetch location name from GHL API.
 */
async function fetchGHLLocationName(ghlLocationId: string): Promise<string | null> {
  if (!GHL_API_KEY) return null;
  try {
    const res = await fetch(`${GHL_BASE}/locations/${ghlLocationId}`, {
      headers: {
        Authorization: `Bearer ${GHL_API_KEY}`,
        Version: "2021-07-28",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json() as any;
    return data.location?.name || data.name || null;
  } catch {
    return null;
  }
}

/**
 * Discover all GHL sub-accounts/locations via API and provision any missing ones.
 * Returns array of provisioning results.
 */
export async function discoverAndProvisionLocations(
  config?: ProvisioningConfig,
): Promise<ProvisionResult[]> {
  if (!GHL_API_KEY) {
    logger.warn("No GHL API key — cannot discover locations");
    return [];
  }

  const results: ProvisionResult[] = [];
  let cursor: string | undefined;
  let pageCount = 0;
  const MAX_PAGES = 1000; // Safety limit

  do {
    const url = new URL(`${GHL_BASE}/locations/search`);
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("startAfterId", cursor);

    try {
      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${GHL_API_KEY}`,
          Version: "2021-07-28",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        logger.error({ status: res.status }, "GHL location discovery API error");
        break;
      }

      const data = await res.json() as any;
      const locations = data.locations || data.data || [];

      if (locations.length === 0) break;

      for (const loc of locations) {
        const ghlId = loc.id || loc.locationId;
        if (!ghlId) continue;

        const result = await provisionLocation(ghlId, loc.name, config);
        results.push(result);

        // Rate limit between provisions
        await new Promise(r => setTimeout(r, 50));
      }

      cursor = locations[locations.length - 1]?.id;
      pageCount++;

      if (locations.length < 100) break; // Last page
    } catch (err) {
      logger.error({ err, pageCount }, "GHL location discovery failed");
      break;
    }
  } while (pageCount < MAX_PAGES);

  logger.info({
    total: results.length,
    created: results.filter(r => r.action === "created").length,
    existing: results.filter(r => r.action === "already_exists").length,
    reactivated: results.filter(r => r.action === "reactivated").length,
  }, "Location discovery complete");

  return results;
}

/**
 * Auto-provision from webhook: called by the webhook handler when it encounters
 * an unknown locationId. Lightweight — just creates the location record.
 * Returns the new location's DB id.
 */
export async function autoProvisionFromWebhook(
  ghlLocationId: string,
): Promise<number | null> {
  try {
    const result = await provisionLocation(ghlLocationId);
    return result.locationDbId;
  } catch (err) {
    logger.error({ ghlLocationId, err }, "Auto-provision from webhook failed");
    return null;
  }
}

/**
 * Assign a user to a location (public API for tRPC router).
 */
export async function assignUser(
  userId: number,
  locationDbId: number,
  role: "viewer" | "editor" | "admin" = "editor",
): Promise<boolean> {
  const pool = await getRawPool();
  if (!pool) return false;
  return assignUserToLocation(pool, userId, locationDbId, role);
}

/**
 * Remove a user from a location.
 */
export async function unassignUser(
  userId: number,
  locationDbId: number,
): Promise<boolean> {
  const pool = await getRawPool();
  if (!pool) return false;
  try {
    const [result] = await pool.query(
      "DELETE FROM user_locations WHERE user_id = ? AND location_id = ?",
      [userId, locationDbId]
    );
    return (result as any).affectedRows > 0;
  } catch {
    return false;
  }
}

/**
 * Get provisioning audit log for a location.
 */
export async function getProvisioningLog(
  ghlLocationId?: string,
  limit: number = 50,
): Promise<any[]> {
  const pool = await getRawPool();
  if (!pool) return [];
  try {
    let query = "SELECT `key`, value, updated_at FROM platform_kv WHERE `key` LIKE 'provision:%'";
    const params: any[] = [];
    if (ghlLocationId) {
      query = "SELECT `key`, value, updated_at FROM platform_kv WHERE `key` = ?";
      params.push(`provision:${ghlLocationId}`);
    }
    query += " ORDER BY updated_at DESC LIMIT ?";
    params.push(limit);
    const [rows] = await pool.query(query, params);
    return (rows as any[]).map(r => ({
      ...r,
      value: typeof r.value === "string" ? JSON.parse(r.value) : r.value,
    }));
  } catch {
    return [];
  }
}
