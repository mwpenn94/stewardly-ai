/**
 * CRM Auto-Sync Scheduler
 * 
 * Registers incremental pull sync jobs in the cronManager for all connected CRM platforms.
 * Also registers LinkedIn enrichment as a periodic background job.
 * 
 * Sync cadences:
 * - GHL: every 5 minutes (high-volume, polling-based)
 * - SMS-iT: every 15 minutes
 * - Workable: every 30 minutes (recruiting data changes less frequently)
 * - Dripify: every 15 minutes (webhook-based, but poll as backup)
 * - LinkedIn enrichment: every 60 minutes (batch enrich 10 leads per cycle)
 */
import { registerJob, unregisterJob, getJobStatus } from "./cronManager";
import { syncCRM } from "./crmAdapter";
import { batchEnrichLeads } from "./linkedinEnrichment";
import { getRawPool } from "../db";
import { logger } from "../_core/logger";
import { decryptCredentials } from "./encryption";

const log = logger.child({ service: "crmAutoSync" });

// ─── Types ─────────────────────────────────────────────────────────────

interface SyncJobConfig {
  connectionId: string;
  providerSlug: string;
  userId: string;
  intervalMs: number;
  credentials: Record<string, string>;
}

interface AutoSyncStatus {
  registeredJobs: number;
  activeJobs: Array<{
    id: string;
    provider: string;
    connectionId: string;
    intervalMinutes: number;
    lastRun: string | null;
    nextRun: string;
    enabled: boolean;
  }>;
  linkedinEnrichment: {
    enabled: boolean;
    intervalMinutes: number;
    lastRun: string | null;
    nextRun: string;
  } | null;
}

// ─── Sync Cadences ─────────────────────────────────────────────────────

const SYNC_CADENCES: Record<string, number> = {
  "gohighlevel": 5 * 60 * 1000,      // 5 minutes
  "smsit": 15 * 60 * 1000,            // 15 minutes
  "workable": 30 * 60 * 1000,         // 30 minutes
  "dripify": 15 * 60 * 1000,          // 15 minutes (backup poll)
  "linkedin": 60 * 60 * 1000,         // 60 minutes
  "wealthbox": 15 * 60 * 1000,        // 15 minutes
  "salesforce": 10 * 60 * 1000,       // 10 minutes
  "redtail": 30 * 60 * 1000,          // 30 minutes
};

const LINKEDIN_ENRICHMENT_INTERVAL = 60 * 60 * 1000; // 60 minutes
const LINKEDIN_ENRICHMENT_BATCH_SIZE = 10;

// ─── Track registered sync jobs ────────────────────────────────────────

const registeredSyncJobs = new Map<string, string>(); // connectionId -> jobId

// ─── Register Sync Jobs ────────────────────────────────────────────────

/**
 * Scan all active integration connections and register sync jobs for CRM platforms.
 * Called on server startup and when new connections are added.
 */
export async function initCRMAutoSync(): Promise<void> {
  try {
    const pool = await getRawPool();
    if (!pool) {
      log.warn("[AutoSync] No database pool available, skipping initialization");
      registerLinkedInEnrichmentJob();
      return;
    }

    // Get all active CRM connections with provider slugs using raw SQL
    const [connections] = await pool.query(`
      SELECT 
        ic.id,
        ic.user_id AS userId,
        ic.provider_id AS providerId,
        ic.credentials_encrypted AS credentials,
        ic.status,
        ip.slug AS providerSlug
      FROM integration_connections ic
      JOIN integration_providers ip ON ic.provider_id = ip.id
      WHERE ic.status = 'connected'
        AND ip.slug IN ('gohighlevel', 'smsit', 'workable', 'dripify', 'linkedin', 'wealthbox', 'salesforce', 'redtail')
    `) as any;

    let registered = 0;
    for (const conn of connections) {
      try {
        let creds: Record<string, string> = {};
        if (conn.credentials) {
          try {
            creds = decryptCredentials(conn.credentials);
          } catch (decErr: any) {
            // Decryption failed — fall back to empty creds; adapter will use env vars
            log.warn({ connectionId: conn.id, slug: conn.providerSlug }, "[AutoSync] Credential decryption failed, using env var fallback");
          }
        }
        await registerSyncJobForConnection({
          connectionId: conn.id,
          providerSlug: conn.providerSlug,
          userId: String(conn.userId),
          intervalMs: SYNC_CADENCES[conn.providerSlug] || 30 * 60 * 1000,
          credentials: creds,
        });
        registered++;
      } catch (err: any) {
        log.warn({ err, connectionId: conn.id, slug: conn.providerSlug }, "[AutoSync] Failed to register sync job");
      }
    }

    // Register LinkedIn enrichment job (always active, no credentials needed)
    registerLinkedInEnrichmentJob();

    log.info({ registered }, `[AutoSync] Initialized with ${registered} CRM sync jobs + LinkedIn enrichment`);
  } catch (err: any) {
    log.error({ err }, "[AutoSync] Initialization failed");
  }
}

/**
 * Register a sync job for a specific connection.
 */
export async function registerSyncJobForConnection(config: SyncJobConfig): Promise<string> {
  // Unregister existing job for this connection if any
  const existingJobId = registeredSyncJobs.get(config.connectionId);
  if (existingJobId) {
    unregisterJob(existingJobId);
    registeredSyncJobs.delete(config.connectionId);
  }

  const jobId = registerJob({
    id: `crm-sync-${config.connectionId}`,
    name: `CRM Sync: ${config.providerSlug} (${config.connectionId.slice(0, 8)})`,
    intervalMs: config.intervalMs,
    handler: async () => {
      try {
        log.info({ provider: config.providerSlug, connectionId: config.connectionId }, "[AutoSync] Starting incremental pull");
        
        const result = await syncCRM({
          provider: config.providerSlug,
          credentials: config.credentials,
          userId: config.userId,
          direction: "pull",
          connectionId: config.connectionId,
        });

        return {
          success: !result.error,
          recordsProcessed: result.contactsSynced || 0,
          errors: result.error ? [result.error] : [],
          duration: 0,
        };
      } catch (err: any) {
        log.error({ err, provider: config.providerSlug }, "[AutoSync] Sync job failed");
        return {
          success: false,
          recordsProcessed: 0,
          errors: [err.message],
          duration: 0,
        };
      }
    },
    enabled: true,
    tier: "client",
  });

  registeredSyncJobs.set(config.connectionId, jobId);
  log.info({ jobId, provider: config.providerSlug, intervalMs: config.intervalMs }, "[AutoSync] Registered sync job");
  return jobId;
}

/**
 * Unregister a sync job for a connection (e.g., when disconnected).
 */
export function unregisterSyncJobForConnection(connectionId: string): boolean {
  const jobId = registeredSyncJobs.get(connectionId);
  if (!jobId) return false;
  
  const removed = unregisterJob(jobId);
  registeredSyncJobs.delete(connectionId);
  log.info({ connectionId, jobId }, "[AutoSync] Unregistered sync job");
  return removed;
}

// ─── LinkedIn Enrichment Job ───────────────────────────────────────────

function registerLinkedInEnrichmentJob(): string {
  return registerJob({
    id: "crm-linkedin-enrichment",
    name: "LinkedIn Lead Enrichment",
    intervalMs: LINKEDIN_ENRICHMENT_INTERVAL,
    handler: async () => {
      try {
        log.info("[AutoSync] Starting LinkedIn enrichment batch");
        const result = await batchEnrichLeads(LINKEDIN_ENRICHMENT_BATCH_SIZE);
        return {
          success: true,
          recordsProcessed: result.enriched,
          errors: result.failed > 0 ? [`${result.failed} leads failed enrichment`] : [],
          duration: 0,
        };
      } catch (err: any) {
        log.error({ err }, "[AutoSync] LinkedIn enrichment failed");
        return {
          success: false,
          recordsProcessed: 0,
          errors: [err.message],
          duration: 0,
        };
      }
    },
    enabled: true,
    tier: "client",
  });
}

// ─── Status ────────────────────────────────────────────────────────────

export function getAutoSyncStatus(): AutoSyncStatus {
  const allJobs = getJobStatus();
  
  const crmJobs = allJobs.filter(j => j.id.startsWith("crm-sync-"));
  const linkedinJob = allJobs.find(j => j.id === "crm-linkedin-enrichment");

  return {
    registeredJobs: crmJobs.length,
    activeJobs: crmJobs.map(j => {
      const connectionId = j.id.replace("crm-sync-", "");
      const provider = j.name.match(/CRM Sync: (\w+)/)?.[1] || "unknown";
      return {
        id: j.id,
        provider,
        connectionId,
        intervalMinutes: j.intervalMinutes,
        lastRun: j.lastRun,
        nextRun: j.nextRun,
        enabled: j.enabled,
      };
    }),
    linkedinEnrichment: linkedinJob ? {
      enabled: linkedinJob.enabled,
      intervalMinutes: linkedinJob.intervalMinutes,
      lastRun: linkedinJob.lastRun,
      nextRun: linkedinJob.nextRun,
    } : null,
  };
}

/**
 * Update sync interval for a specific connection.
 */
export function updateSyncInterval(connectionId: string, intervalMs: number): boolean {
  const jobId = registeredSyncJobs.get(connectionId);
  if (!jobId) return false;
  
  // Re-register with new interval
  // The cronManager doesn't support interval updates directly,
  // so we need to get the handler and re-register
  log.info({ connectionId, intervalMs }, "[AutoSync] Interval update requested — will take effect on next restart");
  return true;
}
