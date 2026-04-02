/**
 * Cron Manager — Scheduled Data Pipeline Execution
 * 
 * Manages periodic execution of platform data pipelines and per-connection syncs.
 * Uses in-memory scheduling with configurable intervals per pipeline.
 * 
 * Default cadences:
 * - FRED: every 6 hours (rates change daily)
 * - BLS: every 24 hours (monthly data)
 * - Census: every 30 days (annual data)
 * - SEC EDGAR: every 12 hours (filings daily)
 * - BEA: every 7 days (quarterly data)
 * - User connections: per-connection sync interval
 * - Insight cache: every 15 minutes for active users
 */

import { getDb } from "../db";
import { integrationSyncLogs, integrationConnections, integrationProviders } from "../../drizzle/schema";
import { eq, and, sql, lte, isNull, or } from "drizzle-orm";
import crypto from "crypto";
import { logger } from "../_core/logger";

const uuid = () => crypto.randomUUID();

// ─── Types ─────────────────────────────────────────────────────────────
interface ScheduledJob {
  id: string;
  name: string;
  intervalMs: number;
  lastRun: Date | null;
  nextRun: Date;
  handler: () => Promise<JobResult>;
  enabled: boolean;
  tier: "platform" | "organization" | "professional" | "client";
}

interface JobResult {
  success: boolean;
  recordsProcessed: number;
  errors: string[];
  duration: number;
}

// ─── In-Memory Job Registry ────────────────────────────────────────────
const jobs: Map<string, ScheduledJob> = new Map();
let cronInterval: ReturnType<typeof setInterval> | null = null;

// ─── Job Registration ──────────────────────────────────────────────────
export function registerJob(job: Omit<ScheduledJob, "id" | "lastRun" | "nextRun"> & { id?: string }): string {
  const id = job.id || uuid();
  const now = new Date();
  jobs.set(id, {
    ...job,
    id,
    lastRun: null,
    nextRun: new Date(now.getTime() + Math.min(job.intervalMs, 60000)), // First run within 1 min or interval
  });
  return id;
}

export function unregisterJob(id: string): boolean {
  return jobs.delete(id);
}

export function getJobStatus(): Array<{
  id: string;
  name: string;
  tier: string;
  enabled: boolean;
  lastRun: string | null;
  nextRun: string;
  intervalMinutes: number;
}> {
  return Array.from(jobs.values()).map(j => ({
    id: j.id,
    name: j.name,
    tier: j.tier,
    enabled: j.enabled,
    lastRun: j.lastRun?.toISOString() || null,
    nextRun: j.nextRun.toISOString(),
    intervalMinutes: Math.round(j.intervalMs / 60000),
  }));
}

export function toggleJob(id: string, enabled: boolean): boolean {
  const job = jobs.get(id);
  if (!job) return false;
  job.enabled = enabled;
  return true;
}

// ─── Job Execution ─────────────────────────────────────────────────────
async function executeJob(job: ScheduledJob): Promise<void> {
  const start = Date.now();
  const db = await getDb(); if (!db) return null as any;

  try {
    const result = await job.handler();
    const duration = Date.now() - start;

    // Log the sync
    await db.insert(integrationSyncLogs).values({
      id: uuid(),
      connectionId: job.id,
      syncType: "full" as const,
      direction: "inbound" as const,
      status: (result.success ? "success" : "partial") as "success" | "partial",
      recordsCreated: result.recordsProcessed,
      recordsUpdated: 0,
      recordsFailed: result.errors.length,
      errorDetails: result.errors.length > 0 ? result.errors : null,
      triggeredBy: "schedule" as const,
      startedAt: new Date(start),
      completedAt: new Date(),
    });

    // Update job state
    job.lastRun = new Date();
    job.nextRun = new Date(Date.now() + job.intervalMs);

  } catch (e: any) {
    const duration = Date.now() - start;

    await db.insert(integrationSyncLogs).values({
      id: uuid(),
      connectionId: job.id,
      syncType: "full" as const,
      direction: "inbound" as const,
      status: "failed" as const,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 1,
      errorDetails: [e.message],
      triggeredBy: "schedule" as const,
      startedAt: new Date(start),
      completedAt: new Date(),
    }).catch(() => {}); // Don't fail on log errors

    job.lastRun = new Date();
    job.nextRun = new Date(Date.now() + job.intervalMs);
  }
}

// ─── Cron Loop ─────────────────────────────────────────────────────────
async function cronTick(): Promise<void> {
  const now = new Date();
  
  for (const job of Array.from(jobs.values())) {
    if (!job.enabled) continue;
    if (now < job.nextRun) continue;

    // Don't await — run jobs concurrently but don't block the tick
    executeJob(job).catch(e => {
      logger.error( { operation: "cronManager", err: e },`[CronManager] Job ${job.name} failed:`, e.message);
    });
  }
}

export function startCronManager(): void {
  if (cronInterval) return; // Already running
  
  // Check every 30 seconds
  cronInterval = setInterval(() => {
    cronTick().catch(e => {
      logger.error( { operation: "cronManager", err: e },"[CronManager] Tick error:", e.message);
    });
  }, 30000);

  logger.info( { operation: "cronManager" },`[CronManager] Started with ${jobs.size} registered jobs`);
}

export function stopCronManager(): void {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
    logger.info( { operation: "cronManager" },"[CronManager] Stopped");
  }
}

// ─── Default Platform Jobs ─────────────────────────────────────────────
// These are registered when the server starts, using available API keys
export function registerPlatformJobs(apiKeys: {
  fred?: string;
  bls?: string;
  census?: string;
  bea?: string;
}): void {
  // Lazy import to avoid circular deps
  const pipelines = require("./platformPipelines");

  if (apiKeys.fred) {
    registerJob({
      id: "platform-fred",
      name: "FRED Economic Data",
      intervalMs: 6 * 60 * 60 * 1000, // 6 hours
      handler: async () => {
        const r = await pipelines.fetchFREDData(apiKeys.fred);
        return { success: r.success, recordsProcessed: r.seriesFetched, errors: r.errors, duration: 0 };
      },
      enabled: true,
      tier: "platform",
    });
  }

  if (apiKeys.bls) {
    registerJob({
      id: "platform-bls",
      name: "BLS Labor Statistics",
      intervalMs: 24 * 60 * 60 * 1000, // 24 hours
      handler: async () => {
        const r = await pipelines.fetchBLSData(apiKeys.bls);
        return { success: r.success, recordsProcessed: r.seriesFetched, errors: r.errors, duration: 0 };
      },
      enabled: true,
      tier: "platform",
    });
  }

  if (apiKeys.census) {
    registerJob({
      id: "platform-census",
      name: "Census Bureau Demographics",
      intervalMs: 30 * 24 * 60 * 60 * 1000, // 30 days
      handler: async () => {
        const r = await pipelines.fetchCensusData(apiKeys.census);
        return { success: r.success, recordsProcessed: r.recordsFetched, errors: r.errors, duration: 0 };
      },
      enabled: true,
      tier: "platform",
    });
  }

  // SEC EDGAR — no key needed
  registerJob({
    id: "platform-sec",
    name: "SEC EDGAR Filings",
    intervalMs: 12 * 60 * 60 * 1000, // 12 hours
    handler: async () => {
      const r = await pipelines.fetchSECFilings();
      return { success: r.success, recordsProcessed: r.filingsFetched, errors: r.errors, duration: 0 };
    },
    enabled: true,
    tier: "platform",
  });

  if (apiKeys.bea) {
    registerJob({
      id: "platform-bea",
      name: "BEA Economic Analysis",
      intervalMs: 7 * 24 * 60 * 60 * 1000, // 7 days
      handler: async () => {
        const r = await pipelines.fetchBEAData(apiKeys.bea);
        return { success: r.success, recordsProcessed: r.datasetsFetched, errors: r.errors, duration: 0 };
      },
      enabled: true,
      tier: "platform",
    });
  }

  // Insight cache refresh — runs every 15 minutes
  registerJob({
    id: "platform-insight-refresh",
    name: "User Insight Cache Refresh",
    intervalMs: 15 * 60 * 1000, // 15 minutes
    handler: async () => {
      // Refresh insights for recently active users
      const db = await getDb(); if (!db) return null as any;
      const { userInsightsCache } = require("../../drizzle/schema");
      const staleThreshold = new Date(Date.now() - 15 * 60 * 1000);
      
      // Find stale caches for users who were recently active
      const staleCaches = await db.select()
        .from(userInsightsCache)
        .where(lte(userInsightsCache.refreshedAt, staleThreshold))
        .limit(50);

      let refreshed = 0;
      for (const cache of staleCaches) {
        try {
          const { buildInsightContext } = require("../insightCollectors");
          await buildInsightContext(cache.userId, "user"); // Force refresh
          refreshed++;
        } catch (e) {
          // Skip failed refreshes
        }
      }

      return { success: true, recordsProcessed: refreshed, errors: [], duration: 0 };
    },
    enabled: true,
    tier: "platform",
  });
}

// ─── Connection Sync Jobs ──────────────────────────────────────────────
// Register a sync job for a specific user connection
export function registerConnectionSyncJob(
  connectionId: string,
  providerSlug: string,
  syncHandler: () => Promise<{ success: boolean; records: number; errors: string[] }>,
  intervalMs: number = 60 * 60 * 1000, // Default: 1 hour
): string {
  return registerJob({
    id: `conn-${connectionId}`,
    name: `Sync: ${providerSlug} (${connectionId.slice(0, 8)})`,
    intervalMs,
    handler: async () => {
      const r = await syncHandler();
      return { success: r.success, recordsProcessed: r.records, errors: r.errors, duration: 0 };
    },
    enabled: true,
    tier: "client",
  });
}

export function unregisterConnectionSyncJob(connectionId: string): boolean {
  return unregisterJob(`conn-${connectionId}`);
}
