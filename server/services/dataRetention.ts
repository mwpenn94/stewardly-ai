/**
 * Data Retention Service
 *
 * Handles automated purging of time-sensitive data to comply with
 * data minimization principles and reduce storage costs.
 *
 * Retention Policies:
 * - Enrichment logs: 90 days (GDPR/CCPA data minimization)
 * - Audit trail entries: 7 years (SEC/FINRA record-keeping)
 * - Expired sessions: 30 days past expiration
 * - Notification logs: 180 days
 * - Data access audit: 1 year
 * - Sync history: 1 year
 * - Failed login attempts: 90 days
 */

import { getDb, getRawPool } from "../db";
import { logger } from "../_core/logger";

// ─── RETENTION PERIODS (in days) ─────────────────────────────────

const RETENTION_POLICIES = {
  enrichmentLogs: 90,
  expiredSessions: 30,
  notificationLogs: 180,
  dataAccessAudit: 365,
  syncHistory: 365,
  failedLoginAttempts: 90,
  temporaryTokens: 7,
  staleGuestSessions: 14,
  // Audit trail: 7 years (2555 days) — regulatory requirement
  auditTrail: 2555,
} as const;

// ─── PURGE FUNCTIONS ─────────────────────────────────────────────

interface PurgeResult {
  table: string;
  rowsDeleted: number;
  retentionDays: number;
  error?: string;
}

/**
 * Purge enrichment logs older than 90 days.
 * Required by GDPR Article 5(1)(e) — storage limitation.
 */
async function purgeEnrichmentLogs(): Promise<PurgeResult> {
  const pool = await getRawPool();
  if (!pool) return { table: "auth_enrichment_log", rowsDeleted: 0, retentionDays: RETENTION_POLICIES.enrichmentLogs, error: "No DB" };

  try {
    const cutoff = Date.now() - RETENTION_POLICIES.enrichmentLogs * 86400000;
    const [result] = await pool.query(
      "DELETE FROM auth_enrichment_log WHERE enriched_at < ? LIMIT 10000",
      [new Date(cutoff)]
    );
    const deleted = (result as any).affectedRows || 0;
    logger.info({ operation: "dataRetention", table: "auth_enrichment_log", deleted }, `Purged ${deleted} enrichment log entries`);
    return { table: "auth_enrichment_log", rowsDeleted: deleted, retentionDays: RETENTION_POLICIES.enrichmentLogs };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ operation: "dataRetention", err: msg }, "Failed to purge enrichment logs");
    return { table: "auth_enrichment_log", rowsDeleted: 0, retentionDays: RETENTION_POLICIES.enrichmentLogs, error: msg };
  }
}

/**
 * Purge expired notification log entries older than 180 days.
 */
async function purgeNotificationLogs(): Promise<PurgeResult> {
  const pool = await getRawPool();
  if (!pool) return { table: "notification_log", rowsDeleted: 0, retentionDays: RETENTION_POLICIES.notificationLogs, error: "No DB" };

  try {
    const cutoff = Date.now() - RETENTION_POLICIES.notificationLogs * 86400000;
    const [result] = await pool.query(
      "DELETE FROM notification_log WHERE created_at < ? LIMIT 10000",
      [new Date(cutoff)]
    );
    const deleted = (result as any).affectedRows || 0;
    logger.info({ operation: "dataRetention", table: "notification_log", deleted }, `Purged ${deleted} notification log entries`);
    return { table: "notification_log", rowsDeleted: deleted, retentionDays: RETENTION_POLICIES.notificationLogs };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { table: "notification_log", rowsDeleted: 0, retentionDays: RETENTION_POLICIES.notificationLogs, error: msg };
  }
}

/**
 * Purge data access audit entries older than 1 year.
 */
async function purgeDataAccessAudit(): Promise<PurgeResult> {
  const pool = await getRawPool();
  if (!pool) return { table: "data_access_audit", rowsDeleted: 0, retentionDays: RETENTION_POLICIES.dataAccessAudit, error: "No DB" };

  try {
    const cutoff = Date.now() - RETENTION_POLICIES.dataAccessAudit * 86400000;
    const [result] = await pool.query(
      "DELETE FROM data_access_audit WHERE queried_at < ? LIMIT 10000",
      [new Date(cutoff)]
    );
    const deleted = (result as any).affectedRows || 0;
    logger.info({ operation: "dataRetention", table: "data_access_audit", deleted }, `Purged ${deleted} data access audit entries`);
    return { table: "data_access_audit", rowsDeleted: deleted, retentionDays: RETENTION_POLICIES.dataAccessAudit };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { table: "data_access_audit", rowsDeleted: 0, retentionDays: RETENTION_POLICIES.dataAccessAudit, error: msg };
  }
}

/**
 * Purge expired temporary tokens (magic links, MFA backup codes).
 */
async function purgeExpiredTokens(): Promise<PurgeResult> {
  const pool = await getRawPool();
  if (!pool) return { table: "magic_link_tokens", rowsDeleted: 0, retentionDays: RETENTION_POLICIES.temporaryTokens, error: "No DB" };

  try {
    const cutoff = Date.now() - RETENTION_POLICIES.temporaryTokens * 86400000;
    const [result] = await pool.query(
      "DELETE FROM magic_link_tokens WHERE expires_at < ? LIMIT 10000",
      [new Date(cutoff)]
    );
    const deleted = (result as any).affectedRows || 0;
    logger.info({ operation: "dataRetention", table: "magic_link_tokens", deleted }, `Purged ${deleted} expired tokens`);
    return { table: "magic_link_tokens", rowsDeleted: deleted, retentionDays: RETENTION_POLICIES.temporaryTokens };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { table: "magic_link_tokens", rowsDeleted: 0, retentionDays: RETENTION_POLICIES.temporaryTokens, error: msg };
  }
}

/**
 * Purge failed login attempts older than 90 days.
 */
async function purgeFailedLoginAttempts(): Promise<PurgeResult> {
  const pool = await getRawPool();
  if (!pool) return { table: "login_attempts", rowsDeleted: 0, retentionDays: RETENTION_POLICIES.failedLoginAttempts, error: "No DB" };

  try {
    const cutoff = Date.now() - RETENTION_POLICIES.failedLoginAttempts * 86400000;
    const [result] = await pool.query(
      "DELETE FROM login_attempts WHERE attempted_at < ? LIMIT 10000",
      [new Date(cutoff)]
    );
    const deleted = (result as any).affectedRows || 0;
    logger.info({ operation: "dataRetention", table: "login_attempts", deleted }, `Purged ${deleted} failed login attempts`);
    return { table: "login_attempts", rowsDeleted: deleted, retentionDays: RETENTION_POLICIES.failedLoginAttempts };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { table: "login_attempts", rowsDeleted: 0, retentionDays: RETENTION_POLICIES.failedLoginAttempts, error: msg };
  }
}

// ─── MAIN RETENTION JOB ──────────────────────────────────────────

/**
 * Run all data retention purge jobs.
 * Should be called daily by the scheduler.
 */
export async function runDataRetentionJobs(): Promise<{
  totalDeleted: number;
  results: PurgeResult[];
  executedAt: string;
}> {
  logger.info({ operation: "dataRetention" }, "Starting data retention purge cycle");

  const results: PurgeResult[] = [];

  // Run each purge in sequence to avoid overwhelming the database
  results.push(await purgeEnrichmentLogs());
  results.push(await purgeNotificationLogs());
  results.push(await purgeDataAccessAudit());
  results.push(await purgeExpiredTokens());
  results.push(await purgeFailedLoginAttempts());

  const totalDeleted = results.reduce((sum, r) => sum + r.rowsDeleted, 0);
  const errors = results.filter(r => r.error);

  if (errors.length > 0) {
    logger.warn(
      { operation: "dataRetention", errors: errors.map(e => `${e.table}: ${e.error}`) },
      `Data retention completed with ${errors.length} errors`
    );
  } else {
    logger.info(
      { operation: "dataRetention", totalDeleted },
      `Data retention completed: ${totalDeleted} rows purged across ${results.length} tables`
    );
  }

  return {
    totalDeleted,
    results,
    executedAt: new Date().toISOString(),
  };
}

/**
 * Get current retention policy configuration.
 */
export function getRetentionPolicies(): typeof RETENTION_POLICIES {
  return { ...RETENTION_POLICIES };
}

/**
 * Estimate how many rows would be purged without actually deleting.
 */
export async function estimateRetentionPurge(): Promise<{
  estimates: Array<{ table: string; estimatedRows: number; retentionDays: number }>;
}> {
  const pool = await getRawPool();
  if (!pool) return { estimates: [] };

  const estimates: Array<{ table: string; estimatedRows: number; retentionDays: number }> = [];

  const tables = [
    { name: "auth_enrichment_log", dateCol: "enriched_at", days: RETENTION_POLICIES.enrichmentLogs },
    { name: "notification_log", dateCol: "created_at", days: RETENTION_POLICIES.notificationLogs },
    { name: "data_access_audit", dateCol: "queried_at", days: RETENTION_POLICIES.dataAccessAudit },
    { name: "magic_link_tokens", dateCol: "expires_at", days: RETENTION_POLICIES.temporaryTokens },
  ];

  for (const t of tables) {
    try {
      const cutoff = new Date(Date.now() - t.days * 86400000);
      const [rows] = await pool.query(
        `SELECT COUNT(*) as cnt FROM ${t.name} WHERE ${t.dateCol} < ?`,
        [cutoff]
      );
      estimates.push({ table: t.name, estimatedRows: (rows as any)[0]?.cnt || 0, retentionDays: t.days });
    } catch {
      estimates.push({ table: t.name, estimatedRows: -1, retentionDays: t.days });
    }
  }

  return { estimates };
}
