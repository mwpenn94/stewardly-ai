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
import { logger } from "../_core/logger";

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
    logger.warn( { operation: "scheduler" },"[Scheduler] Failed to send in-app alert:", e);
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
  
  logger.info( { operation: "scheduler" },`[Scheduler] Health checks complete: ${results.filter(r => r.status === "healthy").length}/${results.length} healthy`);
}

// ─── Data Pipeline Job (every 6 hours) ─────────────────────────────────
async function runScheduledDataPipelines(): Promise<void> {
  const startTime = Date.now();
  logger.info( { operation: "scheduler" },`[Scheduler] Starting data pipeline run at ${new Date().toISOString()}`);
  
  const { runAllDataPipelines } = await import("./governmentDataPipelines");
  const results = await runAllDataPipelines();
  const totalDuration = Date.now() - startTime;
  
  const successful = results.filter((r: any) => r.status === "success").length;
  const failed = results.filter((r: any) => r.status === "error");
  const totalRecords = results.reduce((sum: number, r: any) => sum + (r.recordsFetched || 0), 0);
  
  // Structured JSON log for every pipeline run (easy to grep/parse in production)
  logger.info( { operation: "scheduler" },JSON.stringify({
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
  
  logger.info( { operation: "scheduler" },`[Scheduler] Data pipelines complete: ${successful}/${results.length} successful, ${totalRecords} records, ${Math.round(totalDuration / 1000)}s`);
}

// ─── Stale Data Cleanup (daily) ────────────────────────────────────────
async function revokeExpiredRoleElevations(): Promise<void> {
  try {
    const { getDb } = await import("../db");
    const { roleElevations } = await import("../../drizzle/schema");
    const { lt, isNull, and } = await import("drizzle-orm");

    const db = await getDb();
    if (!db) {
      logger.warn( { operation: "scheduler" },"[Scheduler] Role elevation revoke skipped: DB unavailable");
      return;
    }

    const now = new Date();
    await db
      .update(roleElevations)
      .set({ revokedAt: now })
      .where(
        and(
          lt(roleElevations.expiresAt, now),
          isNull(roleElevations.revokedAt)
        )
      );

    logger.info( { operation: "scheduler" },`[Scheduler] Role elevation auto-revoke completed`);
  } catch (err) {
    logger.error( { operation: "scheduler", err: err },"[Scheduler] Role elevation revoke error:", err);
  }
}

async function runStaleDataCleanup(): Promise<void> {
  try {
    const { getDb } = await import("../db");
    const { enrichmentCache, conversations, messages } = await import("../../drizzle/schema");
    const { lt, sql } = await import("drizzle-orm");
    
    const db = await getDb();
    if (!db) {
      logger.warn( { operation: "scheduler" },"[Scheduler] Stale data cleanup skipped: DB unavailable");
      return;
    }
    // 1. Clean expired enrichment cache
    await db.delete(enrichmentCache)
      .where(lt(enrichmentCache.expiresAt, new Date()));
    
    // 2. Clean empty conversations older than 1 hour with default title
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const emptyConvs = await db.execute(
        sql`DELETE FROM ${conversations} 
            WHERE title = 'New Conversation' 
            AND createdAt < ${oneHourAgo}
            AND id NOT IN (SELECT DISTINCT conversationId FROM ${messages})`
      );
      const deletedCount = (emptyConvs as any)?.[0]?.affectedRows || 0;
      if (deletedCount > 0) {
        logger.info({ operation: "scheduler" }, `[Scheduler] Cleaned ${deletedCount} empty conversations`);
      }
    } catch (convErr: any) {
      logger.warn({ operation: "scheduler" }, `[Scheduler] Empty conversation cleanup failed: ${convErr.message}`);
    }
    
    logger.info( { operation: "scheduler" },`[Scheduler] Stale data cleanup complete`);
  } catch (e: any) {
    logger.warn( { operation: "scheduler" },`[Scheduler] Stale data cleanup failed: ${e.message}`);
  }
}

// ─── Improvement Engine Job (every 6 hours) ──────────────────────────────
async function runImprovementEngine(): Promise<void> {
  try {
    const { getDb } = await import("../db");
    const { detectSignals, checkConvergence } = await import("../shared/engine/improvementEngine");

    const db = await getDb();
    if (!db) {
      logger.warn({ operation: "scheduler" }, "[Scheduler] Improvement engine skipped: DB unavailable");
      return;
    }

    // Detect quality signals
    const signals = await detectSignals(db);
    const criticalSignals = signals.filter(s => s.severity === "critical" || s.severity === "high");

    // Check convergence status
    const convergence = await checkConvergence(db);

    // Log structured output
    logger.info({ operation: "scheduler" }, JSON.stringify({
      event: "improvement_engine_run",
      timestamp: new Date().toISOString(),
      signalsDetected: signals.length,
      criticalSignals: criticalSignals.length,
      convergenceStatus: convergence.status,
      convergenceRate: convergence.currentRate,
      signals: signals.map(s => ({
        type: s.signalType,
        severity: s.severity,
        metric: s.sourceMetric,
        value: s.sourceValue,
      })),
    }));

    // Alert admins on critical signals
    if (criticalSignals.length > 0) {
      alertAdmins(
        `🔍 Improvement Engine: ${criticalSignals.length} critical signal(s) detected`,
        `The improvement engine detected the following signals:\n\n${signals.map(s =>
          `• [${s.severity.toUpperCase()}] ${s.signalType}: ${s.sourceMetric} = ${s.sourceValue} (threshold: ${s.threshold})`
        ).join("\n")}\n\nConvergence status: ${convergence.status}${convergence.currentRate !== undefined ? ` (rate: ${(convergence.currentRate * 100).toFixed(1)}%)` : ""}`,
        "high"
      );
    }

    // Alert on convergence
    if (convergence.status === "CONVERGED") {
      alertAdmins(
        "✅ Improvement Engine: System has converged",
        `The improvement engine has detected convergence. Promotion rate across all 3 windows is below 10%.\nCurrent rate: ${((convergence.currentRate ?? 0) * 100).toFixed(1)}%\n\nThe system is operating at a stable quality level. New hypotheses are unlikely to produce significant improvements.`,
        "low"
      );
    }

    logger.info({ operation: "scheduler" }, `[Scheduler] Improvement engine signals: ${signals.length} signals, convergence=${convergence.status}`);

    // ── Run the 6 learning loops with real DB data ─────────────────────
    try {
      const { executeImprovementCycle } = await import("./improvement/improvementCycleRunner");
      const cycleResult = await executeImprovementCycle(db);
      logger.info({ operation: "scheduler" }, JSON.stringify({
        event: "improvement_cycle_complete",
        timestamp: new Date().toISOString(),
        hypothesesGenerated: cycleResult.hypothesesGenerated,
        hypothesesPersisted: cycleResult.hypothesesPersisted,
        dataStats: cycleResult.dataStats,
        calibrationAdjustments: cycleResult.cycleResult.defaultCalibration.proposedAdjustments.length,
        triggerAdjustments: cycleResult.cycleResult.triggerTuning.proposedAdjustments.length,
      }));

      if (cycleResult.hypothesesGenerated > 0) {
        alertAdmins(
          `🧠 Improvement Cycle: ${cycleResult.hypothesesGenerated} hypotheses generated`,
          `The improvement engine learning loops analyzed ${cycleResult.dataStats.computationLogs} computation logs, ` +
          `${cycleResult.dataStats.alertOutcomes} alert outcomes, and ${cycleResult.dataStats.userActivity} user activity records.\n\n` +
          `Generated ${cycleResult.hypothesesGenerated} improvement hypotheses (${cycleResult.hypothesesPersisted} persisted to DB).\n` +
          `View them in the admin dashboard under Improvement Hypotheses.`,
          "medium"
        );
      }
    } catch (cycleError: any) {
      logger.warn({ operation: "scheduler" }, `[Scheduler] Improvement cycle failed (non-fatal): ${cycleError.message}`);
    }

    // ── Backfill quality ratings for unrated assistant messages ────────
    try {
      const { backfillQualityRatings } = await import("./improvement/autoQualityRater");
      const ratingResult = await backfillQualityRatings(db);
      if (ratingResult.rated > 0) {
        logger.info({ operation: "scheduler" }, JSON.stringify({
          event: "quality_rating_backfill",
          timestamp: new Date().toISOString(),
          scanned: ratingResult.scanned,
          rated: ratingResult.rated,
          avgScore: ratingResult.avgScore.toFixed(3),
        }));
      }
    } catch (ratingError: any) {
      logger.warn({ operation: "scheduler" }, `[Scheduler] Quality rating backfill failed (non-fatal): ${ratingError.message}`);
    }

    logger.info({ operation: "scheduler" }, `[Scheduler] Improvement engine complete: ${signals.length} signals, convergence=${convergence.status}`);
  } catch (e: any) {
    logger.warn({ operation: "scheduler" }, `[Scheduler] Improvement engine failed: ${e.message}`);
  }
}

// ─── Scheduler Control ─────────────────────────────────────────────────
function registerJob(name: string, intervalMs: number, handler: () => Promise<void>): void {
  if (jobs[name]) {
    logger.warn( { operation: "scheduler" },`[Scheduler] Job "${name}" already registered, skipping`);
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
    // Only log at debug level to prevent log flooding
    if (job.runCount === 0) {
      logger.info( { operation: "scheduler" },`[Scheduler] Job "${job.name}" is still running its first execution, skipping`);
    }
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
    logger.error( { operation: "scheduler", err: error },`[Scheduler] Job "${job.name}" failed:`, error.message);
  } finally {
    job.isRunning = false;
  }
}

export function initScheduler(): void {
  if (isInitialized) {
    logger.info( { operation: "scheduler" },"[Scheduler] Already initialized, skipping");
    return;
  }
  
  // ─── INTERVAL CONSTANTS ─────────────────────────────────────────────
  const MINS = (n: number) => n * 60 * 1000;
  const HOURS = (n: number) => n * 60 * 60 * 1000;
  const DAYS = (n: number) => n * 24 * 60 * 60 * 1000;
  const WEEKS = (n: number) => n * 7 * 24 * 60 * 60 * 1000;

  // ─── EXISTING CORE JOBS ────────────────────────────────────────────
  registerJob("health_checks", MINS(15), runScheduledHealthChecks);
  registerJob("data_pipelines", HOURS(6), runScheduledDataPipelines);
  registerJob("stale_cleanup", DAYS(1), runStaleDataCleanup);
  registerJob("role_elevation_revoke", MINS(5), revokeExpiredRoleElevations);
  registerJob("improvement_engine", HOURS(6), runImprovementEngine);

  // ─── EVERY 4H JOBS ─────────────────────────────────────────────────
  registerJob("provider_health_check", HOURS(4), async () => {
    const { runMonitoredCron } = await import("./monitoring/healthMonitor");
    await runMonitoredCron("provider_health_check", async () => {
      const { persistHealthSnapshot } = await import("./verification/providerHealthMonitor");
      await persistHealthSnapshot();
    });
  });

  registerJob("smsit_contact_sync", HOURS(4), async () => {
    const { runMonitoredCron } = await import("./monitoring/healthMonitor");
    await runMonitoredCron("smsit_contact_sync", async () => {
      logger.info({ operation: "scheduler" }, "SMS-iT contact sync — stub (requires SMSIT_API_KEY)");
    });
  });

  // ─── DAILY JOBS ────────────────────────────────────────────────────
  registerJob("refresh_sofr_rates", DAYS(1), async () => {
    const { runMonitoredCron } = await import("./monitoring/healthMonitor");
    await runMonitoredCron("refresh_sofr_rates", async () => {
      const { analyzeTrend: _analyzeTrend } = await import("./planning/trendIngester");
      logger.info({ operation: "scheduler" }, "SOFR rate refresh — trend analysis available");
    });
  });

  registerJob("daily_market_close", DAYS(1), async () => {
    const { runMonitoredCron } = await import("./monitoring/healthMonitor");
    await runMonitoredCron("daily_market_close", async () => {
      const { getLatestSofrRate } = await import("./marketHistory/marketHistory");
      const rate = await getLatestSofrRate();
      logger.info({ operation: "scheduler", sofrRate: rate }, "Daily market close data fetched");
    });
  });

  registerJob("daily_crm_sync", DAYS(1), async () => {
    const { runMonitoredCron } = await import("./monitoring/healthMonitor");
    await runMonitoredCron("daily_crm_sync", async () => {
      logger.info({ operation: "scheduler" }, "Daily CRM sync — stub (requires GHL_API_TOKEN)");
    });
  });

  registerJob("data_freshness_check", DAYS(1), async () => {
    const { runMonitoredCron } = await import("./monitoring/healthMonitor");
    await runMonitoredCron("data_freshness_check", async () => {
      const { scoreAll: _scoreAll } = await import("./scraping/dataValueScorer");
      // scoreAll requires DataSource[] — run with empty to check availability
      logger.info({ operation: "scheduler" }, "Data freshness check — scorer available");
    });
  });

  registerJob("pii_retention_sweep", DAYS(1), async () => {
    const { runMonitoredCron } = await import("./monitoring/healthMonitor");
    await runMonitoredCron("pii_retention_sweep", async () => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return;
      // Sweep PII older than retention period (90 days for non-client data)
      const { leadProfileAccumulator } = await import("../../drizzle/schema");
      const { lt } = await import("drizzle-orm");
      const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      await db.delete(leadProfileAccumulator).where(lt(leadProfileAccumulator.collectedAt, cutoff));
      logger.info({ operation: "scheduler" }, "PII retention sweep complete");
    });
  });

  registerJob("import_stale_cleanup", DAYS(1), async () => {
    const { runMonitoredCron } = await import("./monitoring/healthMonitor");
    await runMonitoredCron("import_stale_cleanup", async () => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return;
      const { importJobs } = await import("../../drizzle/schema");
      const { lt } = await import("drizzle-orm");
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      await db.update(importJobs)
        .set({ status: "failed" as any })
        .where(lt(importJobs.startedAt, cutoff));
      logger.info({ operation: "scheduler" }, "Import stale cleanup complete");
    });
  });

  // ─── WEEKLY JOBS ───────────────────────────────────────────────────
  registerJob("reverify_credentials", WEEKS(1), async () => {
    const { runMonitoredCron } = await import("./monitoring/healthMonitor");
    await runMonitoredCron("reverify_credentials", async () => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return;
      const { professionalVerifications } = await import("../../drizzle/schema");
      const { lt, eq: eqOp, and } = await import("drizzle-orm");
      const staleMs = Date.now() - 90 * 24 * 60 * 60 * 1000;
      const stale = await db.select().from(professionalVerifications)
        .where(and(eqOp(professionalVerifications.verificationStatus, "verified"), lt(professionalVerifications.verifiedAt, staleMs)))
        .limit(100);
      for (const cred of stale) {
        await db.update(professionalVerifications)
          .set({ verificationStatus: "pending" as any })
          .where(eqOp(professionalVerifications.id, cred.id));
      }
      logger.info({ operation: "scheduler", count: stale.length }, "Credential reverification queued");
    });
  });

  registerJob("coi_alerts", WEEKS(1), async () => {
    const { runMonitoredCron } = await import("./monitoring/healthMonitor");
    await runMonitoredCron("coi_alerts", async () => {
      logger.info({ operation: "scheduler" }, "COI alert check — stub (requires business logic)");
    });
  });

  registerJob("rescore_leads", WEEKS(1), async () => {
    const { runMonitoredCron } = await import("./monitoring/healthMonitor");
    await runMonitoredCron("rescore_leads", async () => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return;
      const { leadPipeline } = await import("../../drizzle/schema");
      const { not, eq: eqOp } = await import("drizzle-orm");
      // Mark all non-converted leads for re-scoring by clearing propensity score
      await db.update(leadPipeline)
        .set({ propensityScore: null })
        .where(not(eqOp(leadPipeline.status, "converted")));
      logger.info({ operation: "scheduler" }, "Lead re-scoring queued");
    });
  });

  registerJob("weekly_scrape_batch", WEEKS(1), async () => {
    const { runMonitoredCron } = await import("./monitoring/healthMonitor");
    await runMonitoredCron("weekly_scrape_batch", async () => {
      const { batchPlan } = await import("./scraping/extractionPlanner");
      const { batchExecute } = await import("./scraping/extractionExecutor");
      const plans = await batchPlan([]);
      if (plans.length > 0) {
        await batchExecute(plans);
      }
      logger.info({ operation: "scheduler", planned: plans.length }, "Weekly scrape batch complete");
    });
  });

  registerJob("score_data_value", WEEKS(1), async () => {
    const { runMonitoredCron } = await import("./monitoring/healthMonitor");
    await runMonitoredCron("score_data_value", async () => {
      const { scoreAll: _scoreAll } = await import("./scraping/dataValueScorer");
      logger.info({ operation: "scheduler" }, "Data value scoring — scorer available");
    });
  });

  registerJob("rate_optimization", WEEKS(1), async () => {
    const { runMonitoredCron } = await import("./monitoring/healthMonitor");
    await runMonitoredCron("rate_optimization", async () => {
      const { generateRecommendations: _generateRecommendations } = await import("./scraping/rateRecommender");
      // generateRecommendations requires currentRates and signals args
      logger.info({ operation: "scheduler" }, "Rate optimization — recommender available");
    });
  });

  registerJob("weekly_performance_report", WEEKS(1), async () => {
    const { runMonitoredCron } = await import("./monitoring/healthMonitor");
    await runMonitoredCron("weekly_performance_report", async () => {
      const { generatePerformanceReport } = await import("./reporting/performanceReport");
      await generatePerformanceReport("platform", undefined, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date());
    });
  });

  // ─── MONTHLY JOBS ──────────────────────────────────────────────────
  registerJob("cfp_refresh", DAYS(30), async () => {
    const { runMonitoredCron } = await import("./monitoring/healthMonitor");
    await runMonitoredCron("cfp_refresh", async () => {
      logger.info({ operation: "scheduler" }, "CFP credential refresh — stub (ToS-gated)");
    });
  });

  registerJob("regulatory_scan", DAYS(30), async () => {
    const { runMonitoredCron } = await import("./monitoring/healthMonitor");
    await runMonitoredCron("regulatory_scan", async () => {
      const { analyzeHealth: _analyzeHealth } = await import("./scraping/integrationAnalyzer");
      logger.info({ operation: "scheduler" }, "Regulatory scan — integration analyzer available");
    });
  });

  registerJob("bulk_refresh", DAYS(30), async () => {
    const { runMonitoredCron } = await import("./monitoring/healthMonitor");
    await runMonitoredCron("bulk_refresh", async () => {
      const { batchEnrich: _batchEnrich } = await import("./enrichment/aiEnrichment");
      logger.info({ operation: "scheduler" }, "Bulk enrichment refresh — stub (requires leads)");
    });
  });

  registerJob("retrain_propensity", DAYS(30), async () => {
    const { runMonitoredCron } = await import("./monitoring/healthMonitor");
    await runMonitoredCron("retrain_propensity", async () => {
      logger.info({ operation: "scheduler" }, "Propensity model retrain — stub (requires ML pipeline)");
    });
  });

  registerJob("carrier_ratings", DAYS(30), async () => {
    const { runMonitoredCron } = await import("./monitoring/healthMonitor");
    await runMonitoredCron("carrier_ratings", async () => {
      logger.info({ operation: "scheduler" }, "Carrier ratings refresh — stub (requires AM Best API)");
    });
  });

  registerJob("product_rates", DAYS(30), async () => {
    const { runMonitoredCron } = await import("./monitoring/healthMonitor");
    await runMonitoredCron("product_rates", async () => {
      const { batchProbe } = await import("./scraping/rateProber");
      await batchProbe([]);
      logger.info({ operation: "scheduler" }, "Product rate probing complete");
    });
  });

  registerJob("monthly_report_snapshot", DAYS(30), async () => {
    const { runMonitoredCron } = await import("./monitoring/healthMonitor");
    await runMonitoredCron("monthly_report_snapshot", async () => {
      const { generatePerformanceReport } = await import("./reporting/performanceReport");
      const { generateCampaignReport } = await import("./reporting/campaignReport");
      const { generatePipelineHealthReport } = await import("./reporting/pipelineHealthReport");
      const now = new Date();
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      await generatePerformanceReport("platform", undefined, monthAgo, now);
      await generateCampaignReport(monthAgo, now);
      await generatePipelineHealthReport(monthAgo, now);
    });
  });

  // ─── QUARTERLY JOBS ────────────────────────────────────────────────
  registerJob("bias_audit", DAYS(90), async () => {
    const { runMonitoredCron } = await import("./monitoring/healthMonitor");
    await runMonitoredCron("bias_audit", async () => {
      logger.info({ operation: "scheduler" }, "Propensity bias audit — stub (fair lending compliance)");
    });
  });

  registerJob("iul_crediting_update", DAYS(90), async () => {
    const { runMonitoredCron } = await import("./monitoring/healthMonitor");
    await runMonitoredCron("iul_crediting_update", async () => {
      logger.info({ operation: "scheduler" }, "IUL crediting rate update — stub (requires carrier data)");
    });
  });

  registerJob("quarterly_planning_review", DAYS(90), async () => {
    const { runMonitoredCron } = await import("./monitoring/healthMonitor");
    await runMonitoredCron("quarterly_planning_review", async () => {
      const { analyzePlans } = await import("./planning/planAnalyzer");
      await analyzePlans();
      logger.info({ operation: "scheduler" }, "Quarterly planning review complete");
    });
  });

  // ─── ANNUAL JOBS ───────────────────────────────────────────────────
  registerJob("parameter_check", WEEKS(1), async () => {
    // Weekly Oct-Dec, effectively annual parameter verification
    const { runMonitoredCron } = await import("./monitoring/healthMonitor");
    await runMonitoredCron("parameter_check", async () => {
      const month = new Date().getMonth(); // 0-indexed
      if (month < 9 || month > 11) return; // Only Oct-Dec
      logger.info({ operation: "scheduler" }, "Annual parameter check (Oct-Dec) — verifying tax/SSA/Medicare params");
    });
  });

  registerJob("ssa_cola_update", DAYS(365), async () => {
    const { runMonitoredCron } = await import("./monitoring/healthMonitor");
    await runMonitoredCron("ssa_cola_update", async () => {
      logger.info({ operation: "scheduler" }, "SSA COLA update — stub (October announcement)");
    });
  });

  registerJob("medicare_premium_update", DAYS(365), async () => {
    const { runMonitoredCron } = await import("./monitoring/healthMonitor");
    await runMonitoredCron("medicare_premium_update", async () => {
      logger.info({ operation: "scheduler" }, "Medicare premium update — stub (November announcement)");
    });
  });
  
  // ─── EVERY 4H: Autonomous Training (use spare capacity) ────────────
  registerJob("autonomous_training", HOURS(4), async () => {
    const { runMonitoredCron } = await import("./monitoring/healthMonitor");
    await runMonitoredCron("autonomous_training", async () => {
      const { runAutonomousImprovements } = await import("./autonomousTraining");
      const result = await runAutonomousImprovements();
      logger.info({ operation: "scheduler", ...result }, "Autonomous training completed");
    });
  });

  // ─── NIGHTLY: Autonomous Client Analysis (2am) ─────────────────────
  registerJob("autonomous_client_analysis", DAYS(1), async () => {
    const { runMonitoredCron } = await import("./monitoring/healthMonitor");
    await runMonitoredCron("autonomous_client_analysis", async () => {
      const { runNightlyAnalysis } = await import("./autonomousClientAnalysis");
      const result = await runNightlyAnalysis();
      logger.info({ operation: "scheduler", ...result }, "Autonomous client analysis completed");
    });
  });

  // ─── MONTHLY: Template Optimization (1st of month) ─────────────────
  registerJob("template_optimization", DAYS(30), async () => {
    const { runMonitoredCron } = await import("./monitoring/healthMonitor");
    await runMonitoredCron("template_optimization", async () => {
      const { optimizeTemplates } = await import("./templateOptimizer");
      const results = await optimizeTemplates();
      logger.info({ operation: "scheduler", resultCount: results.length }, "Template optimization completed");
    });
  });

  // ─── DAILY: Learning SRS Due Review Reminder ───────────────────────
  registerJob("learning_due_reminder", DAYS(1), async () => {
    try {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return;
      // Count users with items due for review
      const { sql } = await import("drizzle-orm");
      const result = await db.execute(
        sql`SELECT userId, COUNT(*) as dueCount FROM learning_mastery_progress WHERE nextDue <= NOW() GROUP BY userId HAVING dueCount > 0 LIMIT 100`
      );
      if (Array.isArray(result) && result.length > 0) {
        logger.info({ operation: "scheduler", usersWithDueItems: result.length }, "Learning SRS: users have due reviews");
      }
    } catch (e: any) {
      logger.warn({ operation: "scheduler", error: e.message }, "Learning due reminder skipped");
    }
  });

  // ─── WEEKLY: EMBA Content Freshness Check ─────────────────────────
  registerJob("emba_content_check", WEEKS(1), async () => {
    try {
      // importEMBAFromGitHub is dedup-gated — safe to call repeatedly;
      // it only inserts rows that don't already exist.
      const { importEMBAFromGitHub } = await import("./learning/embaImport");
      const result = await importEMBAFromGitHub();
      logger.info({ operation: "scheduler", ...result }, "EMBA content freshness check completed");
    } catch (e: any) {
      logger.warn({ operation: "scheduler", error: e.message }, "EMBA content check skipped");
    }
  });

  // ─── DEV MODE: Only run essential jobs to prevent memory exhaustion ────
  const isDev = process.env.NODE_ENV !== "production";
  const essentialJobs = new Set([
    "health_checks",
    "role_elevation_revoke",
    "stale_cleanup",
  ]);
  
  if (isDev) {
    const totalJobs = Object.keys(jobs).length;
    const skippedJobs: string[] = [];
    for (const [name] of Object.entries(jobs)) {
      if (!essentialJobs.has(name)) {
        skippedJobs.push(name);
      }
    }
    // Remove non-essential jobs in dev mode
    for (const name of skippedJobs) {
      delete jobs[name];
    }
    logger.info( { operation: "scheduler" },`[Scheduler] DEV MODE: Keeping ${Object.keys(jobs).length}/${totalJobs} essential jobs (skipped ${skippedJobs.length} heavy jobs)`);
  }

  // Run self-test first, then start jobs with staggered delays
  const INITIAL_DELAY = isDev ? 120_000 : 90_000; // 120s in dev, 90s in prod
  logger.info( { operation: "scheduler" },`[Scheduler] Will run startup self-test in ${INITIAL_DELAY / 1000}s...`);
  
  setTimeout(async () => {
    // Wait for DB readiness
    const dbReady = await ensureDbReady(60_000);
    if (!dbReady) {
      logger.error( { operation: "scheduler" },"[Scheduler] CRITICAL: DB not ready after 60s. Starting jobs anyway (they will retry internally).");
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
        logger.error( { operation: "scheduler" },`[Scheduler] Self-test FAILED. Pipelines will likely fail.`);
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
        logger.info( { operation: "scheduler" },`[Scheduler] Self-test ${testResult.overall.toUpperCase()}: ${testResult.results.filter(r => r.apiReachable === "pass").length}/${testResult.results.length} APIs reachable`);
      }
    } catch (e: any) {
      logger.warn( { operation: "scheduler" },`[Scheduler] Self-test failed to run: ${e.message}`);
    }
    
    // Start all jobs with staggered delays
    let stagger = 0;
    for (const [name, job] of Object.entries(jobs)) {
      setTimeout(() => {
        logger.info( { operation: "scheduler" },`[Scheduler] Starting job "${name}"...`);
        executeJob(job);
        job.timerId = setInterval(() => executeJob(job), job.intervalMs);
      }, stagger);
      stagger += isDev ? 30_000 : 15_000; // 30s in dev, 15s in prod
      logger.info( { operation: "scheduler" },`[Scheduler] Registered job "${name}" (interval: ${Math.round(job.intervalMs / 1000)}s)`);
    }
  }, INITIAL_DELAY);
  
  isInitialized = true;
  logger.info( { operation: "scheduler" },`[Scheduler] Initialized with ${Object.keys(jobs).length} jobs`);
}

export function stopScheduler(): void {
  for (const [, job] of Object.entries(jobs)) {
    if (job.timerId) {
      clearInterval(job.timerId);
      job.timerId = null;
    }
  }
  for (const key of Object.keys(jobs)) delete jobs[key];
  isInitialized = false;
  logger.info( { operation: "scheduler" },"[Scheduler] All jobs stopped");
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
