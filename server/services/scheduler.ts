/**
 * Server-Side Scheduler
 * 
 * Manages recurring background tasks:
 * 1. Integration health checks (every 15 minutes)
 * 2. Government data pipeline fetches (every 6 hours)
 * 3. Stale data cleanup (daily)
 * 
 * Uses setInterval-based scheduling with error isolation.
 * Each job runs independently — a failure in one doesn't affect others.
 */

import { notifyOwner } from "../_core/notification";

// ─── Job Registry ──────────────────────────────────────────────────────
interface ScheduledJob {
  name: string;
  intervalMs: number;
  handler: () => Promise<void>;
  lastRun: Date | null;
  lastError: string | null;
  runCount: number;
  errorCount: number;
  isRunning: boolean;
  timerId: ReturnType<typeof setInterval> | null;
}

const jobs: Record<string, ScheduledJob> = {};
let isInitialized = false;

// ─── Health Check Job (every 15 minutes) ───────────────────────────────
async function runScheduledHealthChecks(): Promise<void> {
  const { runAllHealthChecks } = await import("./integrationHealth");
  const results = await runAllHealthChecks();
  
  // Check for critical failures and notify owner
  const criticalFailures = results.filter(r => r.status === "unhealthy");
  if (criticalFailures.length > 0) {
    const failedNames = criticalFailures.map(r => r.providerSlug).join(", ");
    try {
      await notifyOwner({
        title: `⚠️ Integration Health Alert: ${criticalFailures.length} connection(s) unhealthy`,
        content: `The following data sources failed health checks:\n\n${criticalFailures.map(f => 
          `• ${f.providerSlug}: ${f.message}`
        ).join("\n")}\n\nAffected connections: ${failedNames}\n\nVisit the Integration Health Dashboard to review and take action.`,
      });
    } catch (e) {
      console.warn("[Scheduler] Failed to send health alert notification:", e);
    }
  }
  
  console.log(`[Scheduler] Health checks complete: ${results.filter(r => r.status === "healthy").length}/${results.length} healthy`);
}

// ─── Data Pipeline Job (every 6 hours) ─────────────────────────────────
async function runScheduledDataPipelines(): Promise<void> {
  const { runAllDataPipelines } = await import("./governmentDataPipelines");
  const results = await runAllDataPipelines();
  
  const successful = results.filter((r: any) => r.status === "success").length;
  const failed = results.filter((r: any) => r.status === "error");
  
  if (failed.length > 0) {
    try {
      await notifyOwner({
        title: `📊 Data Pipeline Alert: ${failed.length} pipeline(s) failed`,
        content: `Data pipeline results:\n\n${results.map((r: any) => 
          `• ${r.pipeline}: ${r.status} — ${r.recordsFetched} records${r.error ? ` (${r.error})` : ""}`
        ).join("\n")}\n\nSuccessful: ${successful}/${results.length}`,
      });
    } catch (e) {
      console.warn("[Scheduler] Failed to send pipeline alert notification:", e);
    }
  }
  
  console.log(`[Scheduler] Data pipelines complete: ${successful}/${results.length} successful`);
}

// ─── Stale Data Cleanup (daily) ────────────────────────────────────────
async function runStaleDataCleanup(): Promise<void> {
  const { getDb } = await import("../db");
  const { enrichmentCache } = await import("../../drizzle/schema");
  const { lt } = await import("drizzle-orm");
  
  const db = (await getDb())!;
  const result = await db.delete(enrichmentCache)
    .where(lt(enrichmentCache.expiresAt, new Date()));
  
  console.log(`[Scheduler] Stale data cleanup complete`);
}

// ─── Scheduler Control ─────────────────────────────────────────────────
function registerJob(name: string, intervalMs: number, handler: () => Promise<void>): void {
  if (jobs[name]) {
    console.warn(`[Scheduler] Job "${name}" already registered, skipping`);
    return;
  }
  
  const job: ScheduledJob = {
    name,
    intervalMs,
    handler,
    lastRun: null,
    lastError: null,
    runCount: 0,
    errorCount: 0,
    isRunning: false,
    timerId: null,
  };
  
  jobs[name] = job;
}

async function executeJob(job: ScheduledJob): Promise<void> {
  if (job.isRunning) {
    console.log(`[Scheduler] Job "${job.name}" is already running, skipping`);
    return;
  }
  
  job.isRunning = true;
  try {
    await job.handler();
    job.lastRun = new Date();
    job.runCount++;
    job.lastError = null;
  } catch (error: any) {
    job.errorCount++;
    job.lastError = error.message || "Unknown error";
    console.error(`[Scheduler] Job "${job.name}" failed:`, error.message);
  } finally {
    job.isRunning = false;
  }
}

export function initScheduler(): void {
  if (isInitialized) {
    console.log("[Scheduler] Already initialized, skipping");
    return;
  }
  
  // Register all jobs
  registerJob("health_checks", 15 * 60 * 1000, runScheduledHealthChecks);      // 15 min
  registerJob("data_pipelines", 6 * 60 * 60 * 1000, runScheduledDataPipelines); // 6 hours
  registerJob("stale_cleanup", 24 * 60 * 60 * 1000, runStaleDataCleanup);       // 24 hours
  
  // Start all jobs with staggered initial runs
  // Use longer delays to ensure DB is fully ready in production
  let delay = 60_000; // Start first job 60s after server boot
  for (const [name, job] of Object.entries(jobs)) {
    // Schedule initial run with stagger
    setTimeout(() => {
      executeJob(job);
      // Then set up recurring interval
      job.timerId = setInterval(() => executeJob(job), job.intervalMs);
    }, delay);
    
    delay += 15_000; // Stagger each job by 15s
    console.log(`[Scheduler] Registered job "${name}" (interval: ${Math.round(job.intervalMs / 1000)}s, first run in ${Math.round(delay / 1000)}s)`);
  }
  
  isInitialized = true;
  console.log(`[Scheduler] Initialized with ${Object.keys(jobs).length} jobs`);
}

export function stopScheduler(): void {
  for (const [name, job] of Object.entries(jobs)) {
    if (job.timerId) {
      clearInterval(job.timerId);
      job.timerId = null;
    }
  }
  for (const key of Object.keys(jobs)) delete jobs[key];
  isInitialized = false;
  console.log("[Scheduler] All jobs stopped");
}

export function getSchedulerStatus(): {
  initialized: boolean;
  jobs: Array<{
    name: string;
    intervalMs: number;
    lastRun: Date | null;
    lastError: string | null;
    runCount: number;
    errorCount: number;
    isRunning: boolean;
    nextRun: Date | null;
  }>;
} {
  return {
    initialized: isInitialized,
    jobs: Object.values(jobs).map(job => ({
      name: job.name,
      intervalMs: job.intervalMs,
      lastRun: job.lastRun,
      lastError: job.lastError,
      runCount: job.runCount,
      errorCount: job.errorCount,
      isRunning: job.isRunning,
      nextRun: job.lastRun
        ? new Date(job.lastRun.getTime() + job.intervalMs)
        : null,
    })),
  };
}

/** Manually trigger a specific job by name */
export async function triggerJob(jobName: string): Promise<{ success: boolean; error?: string }> {
  const job = jobs[jobName];
  if (!job) {
    return { success: false, error: `Job "${jobName}" not found` };
  }
  
  try {
    await executeJob(job);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
