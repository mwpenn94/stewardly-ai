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
 * 
 * ALL notifications are in-app only (WebSocket broadcastToRole) — no external emails.
 */

import { broadcastToRole } from "./websocketNotifications";
import { ensureDbReady } from "./dbResilience";

// ─── In-App Alert Helper ──────────────────────────────────────────────────
function alertAdmins(title: string, body: string, priority: "low" | "medium" | "high" | "critical" = "high") {
  try {
    broadcastToRole("admin", {
      type: "system",
      priority,
      title,
      body,
      metadata: { source: "scheduler", timestamp: Date.now() },
    });
  } catch (e) {
    console.warn("[Scheduler] Failed to send in-app alert:", e);
  }
}

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
let lastSelfTestResult: any = null;

// ─── Health Check Job (every 15 minutes) ───────────────────────────────
async function runScheduledHealthChecks(): Promise<void> {
  const { runAllHealthChecks } = await import("./integrationHealth");
  const results = await runAllHealthChecks();
  
  // Check for critical failures and alert admins in-app
  const criticalFailures = results.filter(r => r.status === "unhealthy");
  if (criticalFailures.length > 0) {
    const failedNames = criticalFailures.map(r => r.providerSlug).join(", ");
    alertAdmins(
      `⚠️ Integration Health Alert: ${criticalFailures.length} connection(s) unhealthy`,
      `The following data sources failed health checks:\n\n${criticalFailures.map(f => 
        `• ${f.providerSlug}: ${f.message}`
      ).join("\n")}\n\nAffected connections: ${failedNames}\n\nVisit the Integration Health Dashboard to review and take action.`,
      "critical"
    );
  }
  
  console.log(`[Scheduler] Health checks complete: ${results.filter(r => r.status === "healthy").length}/${results.length} healthy`);
}

// ─── Data Pipeline Job (every 6 hours) ─────────────────────────────────
async function runScheduledDataPipelines(): Promise<void> {
  const startTime = Date.now();
  console.log(`[Scheduler] Starting data pipeline run at ${new Date().toISOString()}`);
  
  const { runAllDataPipelines } = await import("./governmentDataPipelines");
  const results = await runAllDataPipelines();
  const totalDuration = Date.now() - startTime;
  
  const successful = results.filter((r: any) => r.status === "success").length;
  const failed = results.filter((r: any) => r.status === "error");
  const totalRecords = results.reduce((sum: number, r: any) => sum + (r.recordsFetched || 0), 0);
  
  // Structured JSON log for every pipeline run (easy to grep/parse in production)
  console.log(JSON.stringify({
    event: "pipeline_run_complete",
    timestamp: new Date().toISOString(),
    durationMs: totalDuration,
    successful,
    failed: failed.length,
    totalRecords,
    results: results.map((r: any) => ({
      pipeline: r.pipeline,
      status: r.status,
      records: r.recordsFetched,
      durationMs: r.duration,
      error: r.error || null,
    })),
  }));
  
  // Only alert on failures (not on every run) — in-app only
  if (failed.length > 0) {
    alertAdmins(
      `📊 Data Pipeline Alert: ${failed.length}/${results.length} pipeline(s) failed`,
      `Data pipeline run completed in ${Math.round(totalDuration / 1000)}s:\n\n${results.map((r: any) => 
        `• ${r.pipeline}: ${r.status} — ${r.recordsFetched} records${r.error ? ` (${r.error})` : ""}`
      ).join("\n")}\n\nTotal records synced: ${totalRecords}\nSuccessful: ${successful}/${results.length}`,
      "high"
    );
  }
  
  console.log(`[Scheduler] Data pipelines complete: ${successful}/${results.length} successful, ${totalRecords} records, ${Math.round(totalDuration / 1000)}s`);
}

// ─── Stale Data Cleanup (daily) ────────────────────────────────────────
async function runStaleDataCleanup(): Promise<void> {
  try {
    const { getDb } = await import("../db");
    const { enrichmentCache } = await import("../../drizzle/schema");
    const { lt } = await import("drizzle-orm");
    
    const db = await getDb();
    if (!db) {
      console.warn("[Scheduler] Stale data cleanup skipped: DB unavailable");
      return;
    }
    await db.delete(enrichmentCache)
      .where(lt(enrichmentCache.expiresAt, new Date()));
    
    console.log(`[Scheduler] Stale data cleanup complete`);
  } catch (e: any) {
    console.warn(`[Scheduler] Stale data cleanup failed: ${e.message}`);
  }
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
  
  // Run self-test first, then start jobs with staggered delays
  const INITIAL_DELAY = 90_000; // 90s after boot
  console.log(`[Scheduler] Will run startup self-test in ${INITIAL_DELAY / 1000}s...`);
  
  setTimeout(async () => {
    // Wait for DB readiness
    const dbReady = await ensureDbReady(60_000);
    if (!dbReady) {
      console.error("[Scheduler] CRITICAL: DB not ready after 60s. Starting jobs anyway (they will retry internally).");
      alertAdmins(
        "⚠️ Scheduler: Database not ready at startup",
        "The scheduler started but the database was not ready after 60 seconds. Pipelines may fail on their first run but will retry automatically.",
        "critical"
      );
    }
    
    // Run self-test
    try {
      const { runPipelineSelfTest } = await import("./pipelineSelfTest");
      const testResult = await runPipelineSelfTest();
      lastSelfTestResult = testResult;
      
      if (testResult.overall === "fail") {
        console.error(`[Scheduler] Self-test FAILED. Pipelines will likely fail.`);
        const failedProviders = testResult.results
          .filter(r => r.dbLookup === "fail" || r.apiReachable === "fail")
          .map(r => `• ${r.slug}: db=${r.dbLookup}, api=${r.apiReachable}${r.error ? ` — ${r.error}` : ""}`)
          .join("\n");
        alertAdmins(
          "🚨 Pipeline Self-Test Failed",
          `The startup self-test detected critical issues:\n\n${failedProviders}\n\nPipelines will attempt to run but may fail. Check the Integration Health Dashboard for details.`,
          "critical"
        );
      } else {
        console.log(`[Scheduler] Self-test ${testResult.overall.toUpperCase()}: ${testResult.results.filter(r => r.apiReachable === "pass").length}/${testResult.results.length} APIs reachable`);
      }
    } catch (e: any) {
      console.warn(`[Scheduler] Self-test failed to run: ${e.message}`);
    }
    
    // Start all jobs with staggered delays
    let stagger = 0;
    for (const [name, job] of Object.entries(jobs)) {
      setTimeout(() => {
        console.log(`[Scheduler] Starting job "${name}"...`);
        executeJob(job);
        job.timerId = setInterval(() => executeJob(job), job.intervalMs);
      }, stagger);
      stagger += 15_000; // 15s between each job start
      console.log(`[Scheduler] Registered job "${name}" (interval: ${Math.round(job.intervalMs / 1000)}s)`);
    }
  }, INITIAL_DELAY);
  
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
  selfTest: any;
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
    selfTest: lastSelfTestResult,
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

/** Manually trigger a job by name. Returns success/failure. */
export async function triggerJob(name: string): Promise<{ success: boolean; error?: string }> {
  const job = jobs[name];
  if (!job) return { success: false, error: `Unknown job: ${name}` };
  if (job.isRunning) return { success: false, error: `Job "${name}" is already running` };
  try {
    job.isRunning = true;
    await job.handler();
    job.runCount++;
    job.lastRun = new Date();
    job.lastError = null;
    return { success: true };
  } catch (e: any) {
    job.errorCount++;
    job.lastError = e.message;
    return { success: false, error: e.message };
  } finally {
    job.isRunning = false;
  }
}
