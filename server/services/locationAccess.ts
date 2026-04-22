/**
 * Location Access Control — Tenant-isolated visibility layer
 *
 * Resolves a user's allowed location IDs from user_locations table.
 * Admin users bypass location filtering (see all data).
 * Users with no location assignments see nothing (zero-trust default).
 *
 * Usage:
 *   const scope = await getLocationScope(pool, ctx.user);
 *   // scope.isAdmin → true if user is admin (no filtering needed)
 *   // scope.locationIds → array of allowed ghl_locations.id values
 *   // scope.sqlFilter → " AND location_id IN (1,2,3)" or "" for admin
 *   // scope.sqlWhere → " WHERE location_id IN (1,2,3)" or "" for admin
 */

import { logger } from "../_core/logger";

export interface LocationScope {
  isAdmin: boolean;
  locationIds: number[];
  /** Append to existing WHERE clause: " AND location_id IN (...)" or "" for admin */
  sqlFilter: string;
  /** Standalone WHERE clause: " WHERE location_id IN (...)" or "" for admin */
  sqlWhere: string;
  /** For Drizzle: returns the location IDs to filter by, or null if admin (no filter) */
  drizzleIds: number[] | null;
}

interface UserContext {
  id: number;
  role?: string;
  openId?: string;
}

/**
 * Resolve a user's location scope.
 * Admin users get unrestricted access.
 * Regular users get access only to their assigned locations.
 * Users with no assignments get zero access (empty array).
 */
export async function getLocationScope(
  pool: any,
  user: UserContext | null | undefined
): Promise<LocationScope> {
  // No user → no access
  if (!user) {
    return { isAdmin: false, locationIds: [], sqlFilter: " AND 1=0", sqlWhere: " WHERE 1=0", drizzleIds: [] };
  }

  // Admin users bypass location filtering
  if (user.role === "admin") {
    return { isAdmin: true, locationIds: [], sqlFilter: "", sqlWhere: "", drizzleIds: null };
  }

  // Check OWNER_OPEN_ID — owner is always admin-level
  try {
    if (user.openId && process.env.OWNER_OPEN_ID && user.openId === process.env.OWNER_OPEN_ID) {
      return { isAdmin: true, locationIds: [], sqlFilter: "", sqlWhere: "", drizzleIds: null };
    }
  } catch { /* ignore */ }

  // Regular user — resolve assigned locations
  if (!pool) {
    return { isAdmin: false, locationIds: [], sqlFilter: " AND 1=0", sqlWhere: " WHERE 1=0", drizzleIds: [] };
  }

  try {
    const [rows] = await pool.query(
      `SELECT ul.ghl_location_id FROM user_locations ul
       JOIN ghl_locations gl ON ul.ghl_location_id = gl.id
       WHERE ul.user_id = ? AND gl.is_active = 1`,
      [user.id]
    );
    const ids = (rows as any[]).map((r: any) => r.ghl_location_id);

    if (ids.length === 0) {
      // User has no location assignments — zero access
      // Note: In early setup, you may want to grant all locations by default.
      // For now, zero-trust: no assignments = no access.
      // @ts-expect-error — overload resolution mismatch
      logger.debug("[locationAccess] User has no location assignments", { userId: user.id });
      return { isAdmin: false, locationIds: [], sqlFilter: " AND 1=0", sqlWhere: " WHERE 1=0", drizzleIds: [] };
    }

    const inClause = ids.join(",");
    return {
      isAdmin: false,
      locationIds: ids,
      sqlFilter: ` AND location_id IN (${inClause})`,
      sqlWhere: ` WHERE location_id IN (${inClause})`,
      drizzleIds: ids,
    };
  } catch (err: any) {
    // @ts-expect-error — overload resolution mismatch
    logger.warn("[locationAccess] Failed to resolve location scope", { error: err.message });
    // Fail-closed: no access on error
    return { isAdmin: false, locationIds: [], sqlFilter: " AND 1=0", sqlWhere: " WHERE 1=0", drizzleIds: [] };
  }
}

/**
 * Check if a specific lead is accessible to the user.
 * Returns true if the lead's location_id is in the user's scope (or user is admin).
 */
export async function canAccessLead(
  pool: any,
  user: UserContext | null | undefined,
  leadId: number
): Promise<boolean> {
  const scope = await getLocationScope(pool, user);
  if (scope.isAdmin) return true;
  if (scope.locationIds.length === 0) return false;

  try {
    const [rows] = await pool.query(
      `SELECT location_id FROM lead_pipeline WHERE id = ? LIMIT 1`,
      [leadId]
    );
    if (!(rows as any[]).length) return false;
    const leadLocationId = (rows as any[])[0].location_id;
    // Leads with null location_id are accessible to all (legacy data)
    if (leadLocationId == null) return true;
    return scope.locationIds.includes(leadLocationId);
  } catch {
    return false;
  }
}
