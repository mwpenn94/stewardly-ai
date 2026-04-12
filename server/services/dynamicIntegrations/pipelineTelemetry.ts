/**
 * Pipeline Run Telemetry Store
 *
 * Observability layer for the drift-aware pipeline orchestrator. Records
 * every pipeline run as a structured telemetry entry, then exposes query
 * + aggregation helpers so operators (or the auto-retry loop) can answer:
 *
 *   - What ran in the last hour?
 *   - Which sources are flaky (high fail rate)?
 *   - Average run duration per source?
 *   - Total records ingested across all sources today?
 *   - Breaking-drift alerts that need attention?
 *
 * In-memory ring buffer (default 500 entries) keyed by sourceKey so the
 * store stays cheap + bounded. Callers persist to a DB if they want
 * long-term retention.
 *
 * Pure state machine. No I/O. All clock access via injected `now` for
 * deterministic tests.
 */

import type { PipelineResult } from "./pipelineOrchestrator";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface TelemetryEntry {
  id: string;
  sourceKey: string;
  startedAt: number;
  endedAt: number;
  stopReason: PipelineResult["stopReason"];
  stoppedAt: PipelineResult["stoppedAt"];
  recordsFetched: number;
  recordsUpserted: number;
  recordsCreated: number;
  recordsUpdated: number;
  upsertErrors: number;
  fetchRetries: number;
  driftBreaking: number;
  driftWarning: number;
  hintCount: number;
  errorMessage?: string;
}

export interface TelemetryFilter {
  sourceKey?: string;
  since?: number;             // epoch ms
  until?: number;             // epoch ms
  minRecords?: number;
  onlyFailed?: boolean;
  limit?: number;             // default 100
}

export interface SourceHealthSummary {
  sourceKey: string;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  failureRate: number;
  avgDurationMs: number;
  avgRecordsPerRun: number;
  totalRecordsFetched: number;
  totalRecordsUpserted: number;
  lastRunAt: number;
  lastStopReason: PipelineResult["stopReason"];
  recentlyFlaky: boolean;   // failureRate > 0.25 over last 10 runs
}

export interface GlobalHealthSummary {
  totalRuns: number;
  totalSources: number;
  avgFailureRate: number;
  totalRecordsFetched: number;
  totalRecordsUpserted: number;
  breakingDriftAlerts: number;
  periodStart: number;
  periodEnd: number;
}

export interface TelemetryStoreOptions {
  maxEntries?: number;      // default 500
  now?: () => number;
}

// ─── Store implementation ────────────────────────────────────────────────

export class PipelineTelemetryStore {
  private readonly maxEntries: number;
  private readonly now: () => number;
  private entries: TelemetryEntry[];
  private idCounter = 0;

  constructor(options: TelemetryStoreOptions = {}) {
    this.maxEntries = Math.max(1, options.maxEntries ?? 500);
    this.now = options.now ?? Date.now;
    this.entries = [];
  }

  /**
   * Record a pipeline run result. Automatically fills in source key from
   * the caller + derives drift counts from result.drift. Returns the new
   * entry id.
   */
  record(
    sourceKey: string,
    result: PipelineResult,
    startedAt?: number,
  ): string {
    const endedAt = this.now();
    const start = startedAt ?? endedAt - result.durationMs;
    const id = `tel-${++this.idCounter}-${endedAt}`;
    const entry: TelemetryEntry = {
      id,
      sourceKey,
      startedAt: start,
      endedAt,
      stopReason: result.stopReason,
      stoppedAt: result.stoppedAt,
      recordsFetched: result.recordsFetched,
      recordsUpserted: result.recordsUpserted,
      recordsCreated: result.recordsCreated,
      recordsUpdated: result.recordsUpdated,
      upsertErrors: result.upsertErrors,
      fetchRetries: result.fetchRetries,
      driftBreaking: result.drift?.summary.breaking ?? 0,
      driftWarning: result.drift?.summary.warning ?? 0,
      hintCount: result.personalizationHints?.hints.length ?? 0,
      errorMessage: result.errorMessage,
    };
    this.entries.push(entry);
    // Drop oldest to stay under cap (newest-last ring buffer)
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
    return id;
  }

  /**
   * Query entries with a flexible filter. Returns newest-first.
   */
  query(filter: TelemetryFilter = {}): TelemetryEntry[] {
    const limit = filter.limit ?? 100;
    const reversed = [...this.entries].reverse();
    const filtered = reversed.filter((e) => {
      if (filter.sourceKey && e.sourceKey !== filter.sourceKey) return false;
      if (filter.since !== undefined && e.endedAt < filter.since) return false;
      if (filter.until !== undefined && e.endedAt > filter.until) return false;
      if (filter.minRecords !== undefined && e.recordsFetched < filter.minRecords) return false;
      if (filter.onlyFailed && e.stopReason === "completed") return false;
      return true;
    });
    return filtered.slice(0, limit);
  }

  /**
   * Per-source health summary across all recorded runs for that source.
   */
  sourceHealth(sourceKey: string): SourceHealthSummary | null {
    const runs = this.entries.filter((e) => e.sourceKey === sourceKey);
    if (runs.length === 0) return null;

    const successful = runs.filter((r) => r.stopReason === "completed");
    const failed = runs.filter((r) => r.stopReason !== "completed");
    const avgDuration =
      runs.reduce((sum, r) => sum + (r.endedAt - r.startedAt), 0) / runs.length;
    const totalFetched = runs.reduce((sum, r) => sum + r.recordsFetched, 0);
    const totalUpserted = runs.reduce((sum, r) => sum + r.recordsUpserted, 0);
    const lastRun = runs[runs.length - 1];

    // Recent flaky check: failure rate over last 10 runs
    const last10 = runs.slice(-10);
    const last10Failed = last10.filter((r) => r.stopReason !== "completed").length;
    const recentlyFlaky = last10.length >= 3 && last10Failed / last10.length > 0.25;

    return {
      sourceKey,
      totalRuns: runs.length,
      successfulRuns: successful.length,
      failedRuns: failed.length,
      failureRate: runs.length === 0 ? 0 : failed.length / runs.length,
      avgDurationMs: Math.round(avgDuration),
      avgRecordsPerRun: Math.round(totalFetched / runs.length),
      totalRecordsFetched: totalFetched,
      totalRecordsUpserted: totalUpserted,
      lastRunAt: lastRun.endedAt,
      lastStopReason: lastRun.stopReason,
      recentlyFlaky,
    };
  }

  /**
   * List all unique source keys that have recorded runs.
   */
  listSources(): string[] {
    const set = new Set<string>();
    for (const e of this.entries) set.add(e.sourceKey);
    return Array.from(set).sort();
  }

  /**
   * Cross-source global health rollup — for a platform-level dashboard.
   */
  globalHealth(periodSinceMs?: number): GlobalHealthSummary {
    const since = periodSinceMs ?? 0;
    const scoped = this.entries.filter((e) => e.endedAt >= since);
    const failures = scoped.filter((e) => e.stopReason !== "completed").length;
    const sources = new Set(scoped.map((e) => e.sourceKey));
    return {
      totalRuns: scoped.length,
      totalSources: sources.size,
      avgFailureRate: scoped.length === 0 ? 0 : failures / scoped.length,
      totalRecordsFetched: scoped.reduce((sum, e) => sum + e.recordsFetched, 0),
      totalRecordsUpserted: scoped.reduce((sum, e) => sum + e.recordsUpserted, 0),
      breakingDriftAlerts: scoped.reduce((sum, e) => sum + (e.driftBreaking > 0 ? 1 : 0), 0),
      periodStart: scoped[0]?.startedAt ?? since,
      periodEnd: scoped[scoped.length - 1]?.endedAt ?? this.now(),
    };
  }

  /**
   * Total entry count (for diagnostics).
   */
  size(): number {
    return this.entries.length;
  }

  /**
   * Clear all entries — useful for tests and for the "reset metrics" button.
   */
  clear(): void {
    this.entries = [];
  }
}

// Process-global store for production use
export const globalPipelineTelemetry = new PipelineTelemetryStore();
