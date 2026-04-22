/**
 * auditLog.ts — CRM Audit Logging Service
 *
 * Provides comprehensive audit trail for:
 * - Permission changes (assign/unassign/role updates)
 * - Sync events (reconciliation runs, conflicts, errors)
 * - Location config changes (sync direction, frequency, conflict policy)
 * - Location provisioning events
 *
 * Stores in `crm_audit_log` table with actor, action, target, before/after state,
 * and timestamps for full compliance trail.
 */
import { getRawPool } from "../db";
import { logger } from "../_core/logger";

// ─── Types ───────────────────────────────────────────────────────────────

export type AuditCategory =
  | "permission"
  | "sync"
  | "location_config"
  | "provisioning"
  | "system";

export type AuditAction =
  // Permission actions
  | "user_assigned"
  | "user_unassigned"
  | "role_updated"
  | "bulk_assign"
  | "bulk_unassign"
  // Sync actions
  | "reconciliation_started"
  | "reconciliation_completed"
  | "reconciliation_failed"
  | "conflict_resolved"
  | "orphan_pushed"
  | "contact_synced"
  // Location config actions
  | "location_config_updated"
  | "location_activated"
  | "location_deactivated"
  // Provisioning actions
  | "location_provisioned"
  | "location_discovered"
  // System actions
  | "system_event";

export interface AuditLogEntry {
  actorId?: number | null;
  actorName?: string | null;
  actorRole?: string | null;
  action: AuditAction;
  category: AuditCategory;
  targetType?: string | null;
  targetId?: string | null;
  targetLabel?: string | null;
  locationId?: number | null;
  locationName?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

export interface AuditLogRecord extends AuditLogEntry {
  id: number;
  createdAt: number;
}

export interface AuditLogFilter {
  actorId?: number;
  action?: AuditAction;
  category?: AuditCategory;
  locationId?: number;
  targetType?: string;
  targetId?: string;
  startDate?: number;
  endDate?: number;
  limit?: number;
  offset?: number;
}

// ─── Core Logging Function ───────────────────────────────────────────────

/**
 * Log an audit event to the crm_audit_log table.
 * Non-blocking: errors are logged but never thrown to avoid disrupting the caller.
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<number | null> {
  try {
    const pool = await getRawPool();
    if (!pool) {
      logger.warn("[AuditLog] Pool unavailable, skipping audit log");
      return null;
    }

    const now = Date.now();
    const [result] = await pool.query(
      `INSERT INTO crm_audit_log
        (actor_id, actor_name, actor_role, action, category, target_type, target_id,
         target_label, location_id, location_name, before_state, after_state, metadata,
         ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.actorId ?? null,
        entry.actorName ?? null,
        entry.actorRole ?? null,
        entry.action,
        entry.category,
        entry.targetType ?? null,
        entry.targetId ?? null,
        entry.targetLabel ?? null,
        entry.locationId ?? null,
        entry.locationName ?? null,
        entry.beforeState ? JSON.stringify(entry.beforeState) : null,
        entry.afterState ? JSON.stringify(entry.afterState) : null,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        entry.ipAddress ?? null,
        now,
      ]
    );

    return (result as any).insertId ?? null;
  } catch (err) {
    // @ts-expect-error — overload resolution mismatch
    logger.error("[AuditLog] Failed to log audit event:", err);
    return null;
  }
}

// ─── Query Functions ─────────────────────────────────────────────────────

/**
 * Query audit log with flexible filters and pagination.
 */
export async function queryAuditLog(filter: AuditLogFilter = {}): Promise<{
  entries: AuditLogRecord[];
  total: number;
}> {
  const pool = await getRawPool();
  if (!pool) return { entries: [], total: 0 };

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter.actorId != null) {
    conditions.push("actor_id = ?");
    params.push(filter.actorId);
  }
  if (filter.action) {
    conditions.push("action = ?");
    params.push(filter.action);
  }
  if (filter.category) {
    conditions.push("category = ?");
    params.push(filter.category);
  }
  if (filter.locationId != null) {
    conditions.push("location_id = ?");
    params.push(filter.locationId);
  }
  if (filter.targetType) {
    conditions.push("target_type = ?");
    params.push(filter.targetType);
  }
  if (filter.targetId) {
    conditions.push("target_id = ?");
    params.push(filter.targetId);
  }
  if (filter.startDate != null) {
    conditions.push("created_at >= ?");
    params.push(filter.startDate);
  }
  if (filter.endDate != null) {
    conditions.push("created_at <= ?");
    params.push(filter.endDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Get total count
  const countParams = [...params];
  const [countRows] = await pool.query(
    `SELECT COUNT(*) as total FROM crm_audit_log ${whereClause}`,
    countParams
  );
  const total = (countRows as any[])[0]?.total ?? 0;

  // Get paginated entries
  const limit = Math.min(filter.limit ?? 50, 500);
  const offset = filter.offset ?? 0;
  const queryParams = [...params, limit, offset];

  const [rows] = await pool.query(
    `SELECT id, actor_id, actor_name, actor_role, action, category,
            target_type, target_id, target_label, location_id, location_name,
            before_state, after_state, metadata, ip_address, created_at
     FROM crm_audit_log ${whereClause}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    queryParams
  );

  const entries: AuditLogRecord[] = (rows as any[]).map((r) => ({
    id: r.id,
    actorId: r.actor_id,
    actorName: r.actor_name,
    actorRole: r.actor_role,
    action: r.action,
    category: r.category,
    targetType: r.target_type,
    targetId: r.target_id,
    targetLabel: r.target_label,
    locationId: r.location_id,
    locationName: r.location_name,
    beforeState: typeof r.before_state === "string" ? JSON.parse(r.before_state) : r.before_state,
    afterState: typeof r.after_state === "string" ? JSON.parse(r.after_state) : r.after_state,
    metadata: typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata,
    ipAddress: r.ip_address,
    createdAt: Number(r.created_at),
  }));

  return { entries, total };
}

/**
 * Get audit log summary statistics for a given time range.
 */
export async function getAuditSummary(
  startDate?: number,
  endDate?: number,
  locationId?: number
): Promise<{
  totalEvents: number;
  byCategory: Record<string, number>;
  byAction: Record<string, number>;
  topActors: Array<{ actorId: number; actorName: string; count: number }>;
  recentActivity: AuditLogRecord[];
}> {
  const pool = await getRawPool();
  if (!pool) {
    return { totalEvents: 0, byCategory: {}, byAction: {}, topActors: [], recentActivity: [] };
  }

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (startDate != null) {
    conditions.push("created_at >= ?");
    params.push(startDate);
  }
  if (endDate != null) {
    conditions.push("created_at <= ?");
    params.push(endDate);
  }
  if (locationId != null) {
    conditions.push("location_id = ?");
    params.push(locationId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Total events
  const [totalRows] = await pool.query(
    `SELECT COUNT(*) as cnt FROM crm_audit_log ${whereClause}`,
    params
  );
  const totalEvents = (totalRows as any[])[0]?.cnt ?? 0;

  // By category
  const [catRows] = await pool.query(
    `SELECT category, COUNT(*) as cnt FROM crm_audit_log ${whereClause} GROUP BY category`,
    params
  );
  const byCategory: Record<string, number> = {};
  for (const r of catRows as any[]) {
    byCategory[r.category] = Number(r.cnt);
  }

  // By action
  const [actRows] = await pool.query(
    `SELECT action, COUNT(*) as cnt FROM crm_audit_log ${whereClause} GROUP BY action ORDER BY cnt DESC LIMIT 20`,
    params
  );
  const byAction: Record<string, number> = {};
  for (const r of actRows as any[]) {
    byAction[r.action] = Number(r.cnt);
  }

  // Top actors
  const [actorRows] = await pool.query(
    `SELECT actor_id, actor_name, COUNT(*) as cnt FROM crm_audit_log
     ${whereClause ? whereClause + " AND" : "WHERE"} actor_id IS NOT NULL
     GROUP BY actor_id, actor_name ORDER BY cnt DESC LIMIT 10`,
    params
  );
  const topActors = (actorRows as any[]).map((r) => ({
    actorId: r.actor_id,
    actorName: r.actor_name || "Unknown",
    count: Number(r.cnt),
  }));

  // Recent activity (last 10)
  const [recentRows] = await pool.query(
    `SELECT id, actor_id, actor_name, actor_role, action, category,
            target_type, target_id, target_label, location_id, location_name,
            before_state, after_state, metadata, ip_address, created_at
     FROM crm_audit_log ${whereClause}
     ORDER BY created_at DESC LIMIT 10`,
    params
  );
  const recentActivity: AuditLogRecord[] = (recentRows as any[]).map((r) => ({
    id: r.id,
    actorId: r.actor_id,
    actorName: r.actor_name,
    actorRole: r.actor_role,
    action: r.action,
    category: r.category,
    targetType: r.target_type,
    targetId: r.target_id,
    targetLabel: r.target_label,
    locationId: r.location_id,
    locationName: r.location_name,
    beforeState: typeof r.before_state === "string" ? JSON.parse(r.before_state) : r.before_state,
    afterState: typeof r.after_state === "string" ? JSON.parse(r.after_state) : r.after_state,
    metadata: typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata,
    ipAddress: r.ip_address,
    createdAt: Number(r.created_at),
  }));

  return { totalEvents, byCategory, byAction, topActors, recentActivity };
}

// ─── Convenience Loggers ─────────────────────────────────────────────────

/** Log a permission assignment event */
export function logPermissionAssign(opts: {
  actorId: number;
  actorName: string;
  actorRole: string;
  userId: number;
  userName?: string;
  locationId: number;
  locationName?: string;
  role: string;
}): Promise<number | null> {
  return logAuditEvent({
    actorId: opts.actorId,
    actorName: opts.actorName,
    actorRole: opts.actorRole,
    action: "user_assigned",
    category: "permission",
    targetType: "user",
    targetId: String(opts.userId),
    targetLabel: opts.userName || `User #${opts.userId}`,
    locationId: opts.locationId,
    locationName: opts.locationName,
    afterState: { role: opts.role },
  });
}

/** Log a permission unassignment event */
export function logPermissionUnassign(opts: {
  actorId: number;
  actorName: string;
  actorRole: string;
  userId: number;
  userName?: string;
  locationId: number;
  locationName?: string;
  previousRole?: string;
}): Promise<number | null> {
  return logAuditEvent({
    actorId: opts.actorId,
    actorName: opts.actorName,
    actorRole: opts.actorRole,
    action: "user_unassigned",
    category: "permission",
    targetType: "user",
    targetId: String(opts.userId),
    targetLabel: opts.userName || `User #${opts.userId}`,
    locationId: opts.locationId,
    locationName: opts.locationName,
    beforeState: opts.previousRole ? { role: opts.previousRole } : null,
  });
}

/** Log a role update event */
export function logRoleUpdate(opts: {
  actorId: number;
  actorName: string;
  actorRole: string;
  userId: number;
  userName?: string;
  locationId: number;
  locationName?: string;
  previousRole: string;
  newRole: string;
}): Promise<number | null> {
  return logAuditEvent({
    actorId: opts.actorId,
    actorName: opts.actorName,
    actorRole: opts.actorRole,
    action: "role_updated",
    category: "permission",
    targetType: "user",
    targetId: String(opts.userId),
    targetLabel: opts.userName || `User #${opts.userId}`,
    locationId: opts.locationId,
    locationName: opts.locationName,
    beforeState: { role: opts.previousRole },
    afterState: { role: opts.newRole },
  });
}

/** Log a reconciliation event */
export function logReconciliationEvent(opts: {
  action: "reconciliation_started" | "reconciliation_completed" | "reconciliation_failed";
  locationId?: number;
  locationName?: string;
  metadata?: Record<string, unknown>;
  actorId?: number;
  actorName?: string;
}): Promise<number | null> {
  return logAuditEvent({
    actorId: opts.actorId ?? null,
    actorName: opts.actorName ?? "System",
    actorRole: "system",
    action: opts.action,
    category: "sync",
    targetType: "location",
    targetId: opts.locationId ? String(opts.locationId) : null,
    targetLabel: opts.locationName,
    locationId: opts.locationId,
    locationName: opts.locationName,
    metadata: opts.metadata,
  });
}

/** Log a location config change */
export function logLocationConfigChange(opts: {
  actorId: number;
  actorName: string;
  actorRole: string;
  locationId: number;
  locationName?: string;
  beforeConfig: Record<string, unknown>;
  afterConfig: Record<string, unknown>;
}): Promise<number | null> {
  return logAuditEvent({
    actorId: opts.actorId,
    actorName: opts.actorName,
    actorRole: opts.actorRole,
    action: "location_config_updated",
    category: "location_config",
    targetType: "location",
    targetId: String(opts.locationId),
    targetLabel: opts.locationName,
    locationId: opts.locationId,
    locationName: opts.locationName,
    beforeState: opts.beforeConfig,
    afterState: opts.afterConfig,
  });
}

/** Log a location provisioning event */
export function logLocationProvisioned(opts: {
  locationId: number;
  locationName: string;
  ghlLocationId: string;
  source: string;
  actorId?: number;
  actorName?: string;
}): Promise<number | null> {
  return logAuditEvent({
    actorId: opts.actorId ?? null,
    actorName: opts.actorName ?? "System",
    actorRole: "system",
    action: "location_provisioned",
    category: "provisioning",
    targetType: "location",
    targetId: String(opts.locationId),
    targetLabel: opts.locationName,
    locationId: opts.locationId,
    locationName: opts.locationName,
    metadata: { ghlLocationId: opts.ghlLocationId, source: opts.source },
  });
}
