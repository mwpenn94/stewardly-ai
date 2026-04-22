/**
 * dataPipelineUtils — Shared utilities for the data engine.
 *
 * Provides:
 *   1. Exponential-backoff retry wrapper for transient failures.
 *   2. Data freshness scoring for pipeline health monitoring.
 *   3. Cross-source reconciliation helpers for data aggregation.
 *   4. Pipeline health summary builder.
 *
 * All pure functions except `withRetry` which wraps an async operation.
 * No DB or network calls — callers inject those via callbacks.
 */
import { logger } from "../_core/logger";

const log = logger.child({ module: "dataPipelineUtils" });

// ─── Retry with exponential backoff ────────────────────────────────────────

export interface RetryOptions {
  /** Maximum number of attempts (including the first). Default 3. */
  maxAttempts?: number;
  /** Initial delay in ms before the first retry. Default 500. */
  initialDelayMs?: number;
  /** Multiplier applied to delay after each failure. Default 2. */
  backoffFactor?: number;
  /** Maximum delay cap in ms. Default 30_000. */
  maxDelayMs?: number;
  /** Optional predicate — return `true` if the error is retryable. Defaults to always true. */
  isRetryable?: (error: unknown) => boolean;
  /** Label for log messages. */
  label?: string;
}

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 500,
    backoffFactor = 2,
    maxDelayMs = 30_000,
    isRetryable = () => true,
    label = "operation",
  } = opts;

  let lastError: unknown;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);

      if (attempt >= maxAttempts || !isRetryable(err)) {
        log.error({ label, attempt, maxAttempts, error: msg }, `[Pipeline] ${label} failed permanently after ${attempt} attempt(s)`);
        throw err;
      }

      log.warn({ label, attempt, maxAttempts, nextDelayMs: delay, error: msg }, `[Pipeline] ${label} failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms`);
      await sleep(delay);
      delay = Math.min(delay * backoffFactor, maxDelayMs);
    }
  }

  throw lastError; // unreachable, but satisfies TS
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Data freshness scoring ────────────────────────────────────────────────

export interface FreshnessConfig {
  /** Maximum age in ms before data is considered "stale". Default 7 days. */
  staleThresholdMs?: number;
  /** Maximum age in ms before data is considered "expired". Default 30 days. */
  expiredThresholdMs?: number;
}

export type FreshnessLevel = "fresh" | "stale" | "expired" | "unknown";

export interface FreshnessResult {
  level: FreshnessLevel;
  /** Score 0–100 (100 = just fetched, 0 = expired). */
  score: number;
  /** Age in milliseconds. */
  ageMs: number;
  /** Human-readable age string. */
  ageLabel: string;
}

const DAY_MS = 86_400_000;

export function assessFreshness(
  lastUpdatedAt: Date | number | null | undefined,
  config: FreshnessConfig = {},
): FreshnessResult {
  const { staleThresholdMs = 7 * DAY_MS, expiredThresholdMs = 30 * DAY_MS } = config;

  if (lastUpdatedAt == null) {
    return { level: "unknown", score: 0, ageMs: Infinity, ageLabel: "never synced" };
  }

  const ts = typeof lastUpdatedAt === "number" ? lastUpdatedAt : lastUpdatedAt.getTime();
  const ageMs = Date.now() - ts;

  if (ageMs < 0) {
    return { level: "fresh", score: 100, ageMs: 0, ageLabel: "just now" };
  }

  const ageLabel = formatAge(ageMs);

  if (ageMs <= staleThresholdMs) {
    const score = Math.round(100 - (ageMs / staleThresholdMs) * 30); // 100→70
    return { level: "fresh", score, ageMs, ageLabel };
  }

  if (ageMs <= expiredThresholdMs) {
    const ratio = (ageMs - staleThresholdMs) / (expiredThresholdMs - staleThresholdMs);
    const score = Math.round(70 - ratio * 60); // 70→10
    return { level: "stale", score, ageMs, ageLabel };
  }

  return { level: "expired", score: 0, ageMs, ageLabel };
}

function formatAge(ms: number): string {
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  if (ms < DAY_MS) return `${Math.round(ms / 3_600_000)}h ago`;
  return `${Math.round(ms / DAY_MS)}d ago`;
}

// ─── Cross-source reconciliation ───────────────────────────────────────────

export interface DataSource {
  id: string;
  name: string;
  lastUpdatedAt: Date | number | null;
  recordCount: number;
  errorCount: number;
}

export interface ReconciliationResult {
  totalSources: number;
  healthySources: number;
  staleSources: number;
  expiredSources: number;
  unknownSources: number;
  totalRecords: number;
  totalErrors: number;
  errorRate: number;
  overallHealth: "healthy" | "degraded" | "critical";
  sourceDetails: Array<DataSource & { freshness: FreshnessResult }>;
}

export function reconcileSources(
  sources: DataSource[],
  freshnessConfig?: FreshnessConfig,
): ReconciliationResult {
  const sourceDetails = sources.map((s) => ({
    ...s,
    freshness: assessFreshness(s.lastUpdatedAt, freshnessConfig),
  }));

  const healthySources = sourceDetails.filter((s) => s.freshness.level === "fresh").length;
  const staleSources = sourceDetails.filter((s) => s.freshness.level === "stale").length;
  const expiredSources = sourceDetails.filter((s) => s.freshness.level === "expired").length;
  const unknownSources = sourceDetails.filter((s) => s.freshness.level === "unknown").length;
  const totalRecords = sources.reduce((sum, s) => sum + s.recordCount, 0);
  const totalErrors = sources.reduce((sum, s) => sum + s.errorCount, 0);
  const errorRate = totalRecords > 0 ? totalErrors / totalRecords : 0;

  let overallHealth: "healthy" | "degraded" | "critical" = "healthy";
  if (expiredSources > 0 || errorRate > 0.1) overallHealth = "critical";
  else if (staleSources > 0 || errorRate > 0.05) overallHealth = "degraded";

  return {
    totalSources: sources.length,
    healthySources,
    staleSources,
    expiredSources,
    unknownSources,
    totalRecords,
    totalErrors,
    errorRate: Math.round(errorRate * 10000) / 10000,
    overallHealth,
    sourceDetails,
  };
}

// ─── Pipeline health summary ───────────────────────────────────────────────

export interface PipelineStep {
  name: string;
  status: "idle" | "running" | "completed" | "failed";
  durationMs?: number;
  recordsProcessed?: number;
  recordsFailed?: number;
  lastRunAt?: Date | number | null;
  errorMessage?: string;
}

export interface PipelineHealthSummary {
  pipelineName: string;
  status: "healthy" | "degraded" | "failed" | "idle";
  steps: Array<PipelineStep & { freshness: FreshnessResult }>;
  totalDurationMs: number;
  totalRecordsProcessed: number;
  totalRecordsFailed: number;
  successRate: number;
  lastCompletedAt: Date | null;
}

export function summarizePipelineHealth(
  pipelineName: string,
  steps: PipelineStep[],
  freshnessConfig?: FreshnessConfig,
): PipelineHealthSummary {
  const enrichedSteps = steps.map((s) => ({
    ...s,
    freshness: assessFreshness(s.lastRunAt, freshnessConfig),
  }));

  const totalDurationMs = steps.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);
  const totalRecordsProcessed = steps.reduce((sum, s) => sum + (s.recordsProcessed ?? 0), 0);
  const totalRecordsFailed = steps.reduce((sum, s) => sum + (s.recordsFailed ?? 0), 0);
  const successRate = totalRecordsProcessed > 0
    ? (totalRecordsProcessed - totalRecordsFailed) / totalRecordsProcessed
    : 1;

  const failedSteps = steps.filter((s) => s.status === "failed").length;
  const runningSteps = steps.filter((s) => s.status === "running").length;
  const completedSteps = steps.filter((s) => s.status === "completed");

  let status: PipelineHealthSummary["status"] = "idle";
  if (failedSteps > 0) status = "failed";
  else if (runningSteps > 0) status = "healthy";
  else if (completedSteps.length > 0) {
    const anyStale = enrichedSteps.some((s) => s.freshness.level === "stale" || s.freshness.level === "expired");
    status = anyStale ? "degraded" : "healthy";
  }

  const lastCompletedStep = completedSteps
    .filter((s) => s.lastRunAt != null)
    .sort((a, b) => {
      const ta = typeof a.lastRunAt === "number" ? a.lastRunAt : (a.lastRunAt as Date).getTime();
      const tb = typeof b.lastRunAt === "number" ? b.lastRunAt : (b.lastRunAt as Date).getTime();
      return tb - ta;
    })[0];

  const lastCompletedAt = lastCompletedStep?.lastRunAt
    ? new Date(typeof lastCompletedStep.lastRunAt === "number" ? lastCompletedStep.lastRunAt : (lastCompletedStep.lastRunAt as Date).getTime())
    : null;

  return {
    pipelineName,
    status,
    steps: enrichedSteps,
    totalDurationMs,
    totalRecordsProcessed,
    totalRecordsFailed,
    successRate: Math.round(successRate * 10000) / 10000,
    lastCompletedAt,
  };
}
