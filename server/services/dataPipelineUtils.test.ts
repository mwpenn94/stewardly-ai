import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  withRetry,
  assessFreshness,
  reconcileSources,
  summarizePipelineHealth,
  type DataSource,
  type PipelineStep,
} from "./dataPipelineUtils";

// ─── withRetry ─────────────────────────────────────────────────────────────

describe("withRetry", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("returns the result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, { maxAttempts: 3 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on transient failure then succeeds", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValue("recovered");

    const promise = withRetry(fn, { maxAttempts: 3, initialDelayMs: 10 });
    // Advance timers to trigger the retry delay
    await vi.advanceTimersByTimeAsync(50);
    const result = await promise;
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting all attempts", async () => {
    vi.useRealTimers(); // real timers needed for rapid retry
    const fn = vi.fn().mockRejectedValue(new Error("permanent"));
    await expect(withRetry(fn, { maxAttempts: 2, initialDelayMs: 1 })).rejects.toThrow("permanent");
    expect(fn).toHaveBeenCalledTimes(2);
    vi.useFakeTimers(); // restore for afterEach
  });

  it("respects isRetryable predicate", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("not retryable"));
    const promise = withRetry(fn, {
      maxAttempts: 3,
      initialDelayMs: 10,
      isRetryable: () => false,
    });
    await expect(promise).rejects.toThrow("not retryable");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("passes attempt number to the function", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue("ok");

    const promise = withRetry(fn, { maxAttempts: 3, initialDelayMs: 10 });
    await vi.advanceTimersByTimeAsync(50);
    await promise;
    expect(fn).toHaveBeenNthCalledWith(1, 1);
    expect(fn).toHaveBeenNthCalledWith(2, 2);
  });
});

// ─── assessFreshness ───────────────────────────────────────────────────────

describe("assessFreshness", () => {
  it("returns 'unknown' for null input", () => {
    const result = assessFreshness(null);
    expect(result.level).toBe("unknown");
    expect(result.score).toBe(0);
    expect(result.ageLabel).toBe("never synced");
  });

  it("returns 'unknown' for undefined input", () => {
    const result = assessFreshness(undefined);
    expect(result.level).toBe("unknown");
  });

  it("returns 'fresh' for recent data", () => {
    const result = assessFreshness(Date.now() - 30_000); // 30 seconds ago
    expect(result.level).toBe("fresh");
    expect(result.score).toBeGreaterThan(90);
    expect(result.ageLabel).toBe("just now");
  });

  it("returns 'fresh' for data within stale threshold", () => {
    const threeDaysAgo = Date.now() - 3 * 86_400_000;
    const result = assessFreshness(threeDaysAgo);
    expect(result.level).toBe("fresh");
    expect(result.score).toBeGreaterThanOrEqual(70);
  });

  it("returns 'stale' for data between stale and expired thresholds", () => {
    const fifteenDaysAgo = Date.now() - 15 * 86_400_000;
    const result = assessFreshness(fifteenDaysAgo);
    expect(result.level).toBe("stale");
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(70);
  });

  it("returns 'expired' for data beyond expired threshold", () => {
    const sixtyDaysAgo = Date.now() - 60 * 86_400_000;
    const result = assessFreshness(sixtyDaysAgo);
    expect(result.level).toBe("expired");
    expect(result.score).toBe(0);
  });

  it("accepts Date objects", () => {
    const result = assessFreshness(new Date());
    expect(result.level).toBe("fresh");
  });

  it("handles future timestamps gracefully", () => {
    const result = assessFreshness(Date.now() + 60_000);
    expect(result.level).toBe("fresh");
    expect(result.score).toBe(100);
  });

  it("respects custom thresholds", () => {
    const twoDaysAgo = Date.now() - 2 * 86_400_000;
    const result = assessFreshness(twoDaysAgo, {
      staleThresholdMs: 1 * 86_400_000, // 1 day
      expiredThresholdMs: 3 * 86_400_000, // 3 days
    });
    expect(result.level).toBe("stale");
  });
});

// ─── reconcileSources ──────────────────────────────────────────────────────

describe("reconcileSources", () => {
  it("returns healthy for all fresh sources", () => {
    const sources: DataSource[] = [
      { id: "s1", name: "Source 1", lastUpdatedAt: Date.now(), recordCount: 100, errorCount: 0 },
      { id: "s2", name: "Source 2", lastUpdatedAt: Date.now(), recordCount: 200, errorCount: 0 },
    ];
    const result = reconcileSources(sources);
    expect(result.overallHealth).toBe("healthy");
    expect(result.totalSources).toBe(2);
    expect(result.healthySources).toBe(2);
    expect(result.totalRecords).toBe(300);
    expect(result.errorRate).toBe(0);
  });

  it("returns degraded when some sources are stale", () => {
    const sources: DataSource[] = [
      { id: "s1", name: "Fresh", lastUpdatedAt: Date.now(), recordCount: 100, errorCount: 0 },
      { id: "s2", name: "Stale", lastUpdatedAt: Date.now() - 15 * 86_400_000, recordCount: 100, errorCount: 0 },
    ];
    const result = reconcileSources(sources);
    expect(result.overallHealth).toBe("degraded");
    expect(result.staleSources).toBe(1);
  });

  it("returns critical when sources are expired", () => {
    const sources: DataSource[] = [
      { id: "s1", name: "Expired", lastUpdatedAt: Date.now() - 60 * 86_400_000, recordCount: 100, errorCount: 0 },
    ];
    const result = reconcileSources(sources);
    expect(result.overallHealth).toBe("critical");
    expect(result.expiredSources).toBe(1);
  });

  it("returns critical when error rate exceeds 10%", () => {
    const sources: DataSource[] = [
      { id: "s1", name: "Errored", lastUpdatedAt: Date.now(), recordCount: 100, errorCount: 15 },
    ];
    const result = reconcileSources(sources);
    expect(result.overallHealth).toBe("critical");
    expect(result.errorRate).toBeGreaterThan(0.1);
  });

  it("handles empty sources array", () => {
    const result = reconcileSources([]);
    expect(result.totalSources).toBe(0);
    expect(result.overallHealth).toBe("healthy");
  });

  it("includes enriched source details", () => {
    const sources: DataSource[] = [
      { id: "s1", name: "Source 1", lastUpdatedAt: Date.now(), recordCount: 50, errorCount: 1 },
    ];
    const result = reconcileSources(sources);
    expect(result.sourceDetails).toHaveLength(1);
    expect(result.sourceDetails[0].freshness.level).toBe("fresh");
  });
});

// ─── summarizePipelineHealth ───────────────────────────────────────────────

describe("summarizePipelineHealth", () => {
  it("returns idle for all idle steps", () => {
    const steps: PipelineStep[] = [
      { name: "Extract", status: "idle" },
      { name: "Transform", status: "idle" },
    ];
    const result = summarizePipelineHealth("test-pipeline", steps);
    expect(result.status).toBe("idle");
    expect(result.pipelineName).toBe("test-pipeline");
  });

  it("returns healthy for running steps", () => {
    const steps: PipelineStep[] = [
      { name: "Extract", status: "completed", durationMs: 1000, recordsProcessed: 100, lastRunAt: Date.now() },
      { name: "Transform", status: "running", durationMs: 500 },
    ];
    const result = summarizePipelineHealth("test-pipeline", steps);
    expect(result.status).toBe("healthy");
    expect(result.totalDurationMs).toBe(1500);
  });

  it("returns failed when any step failed", () => {
    const steps: PipelineStep[] = [
      { name: "Extract", status: "completed", durationMs: 1000, recordsProcessed: 100, lastRunAt: Date.now() },
      { name: "Transform", status: "failed", errorMessage: "Parse error" },
    ];
    const result = summarizePipelineHealth("test-pipeline", steps);
    expect(result.status).toBe("failed");
  });

  it("computes success rate correctly", () => {
    const steps: PipelineStep[] = [
      { name: "Extract", status: "completed", recordsProcessed: 100, recordsFailed: 5, lastRunAt: Date.now() },
      { name: "Transform", status: "completed", recordsProcessed: 95, recordsFailed: 3, lastRunAt: Date.now() },
    ];
    const result = summarizePipelineHealth("test-pipeline", steps);
    expect(result.totalRecordsProcessed).toBe(195);
    expect(result.totalRecordsFailed).toBe(8);
    expect(result.successRate).toBeGreaterThan(0.95);
  });

  it("returns degraded when completed steps are stale", () => {
    const steps: PipelineStep[] = [
      { name: "Extract", status: "completed", recordsProcessed: 100, lastRunAt: Date.now() - 15 * 86_400_000 },
    ];
    const result = summarizePipelineHealth("test-pipeline", steps);
    expect(result.status).toBe("degraded");
  });

  it("handles empty steps array", () => {
    const result = summarizePipelineHealth("empty-pipeline", []);
    expect(result.status).toBe("idle");
    expect(result.totalDurationMs).toBe(0);
    expect(result.successRate).toBe(1);
  });

  it("tracks lastCompletedAt correctly", () => {
    const now = Date.now();
    const steps: PipelineStep[] = [
      { name: "Step1", status: "completed", lastRunAt: now - 5000 },
      { name: "Step2", status: "completed", lastRunAt: now },
    ];
    const result = summarizePipelineHealth("test", steps);
    expect(result.lastCompletedAt).toBeTruthy();
    expect(result.lastCompletedAt!.getTime()).toBe(now);
  });
});
