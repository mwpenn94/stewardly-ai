/**
 * Tests for pipelineTelemetry.ts (Pass 14 — run history + health observability).
 */

import { describe, it, expect } from "vitest";
import { PipelineTelemetryStore } from "./pipelineTelemetry";
import type { PipelineResult } from "./pipelineOrchestrator";

function mkResult(override: Partial<PipelineResult> = {}): PipelineResult {
  return {
    stopReason: "completed",
    stoppedAt: "complete",
    durationMs: 100,
    recordsFetched: 10,
    recordsUpserted: 10,
    recordsCreated: 10,
    recordsUpdated: 0,
    upsertErrors: 0,
    fetchRetries: 0,
    schema: null,
    drift: null,
    personalizationHints: null,
    ...override,
  };
}

function virtualClock(start = 1_700_000_000_000) {
  let current = start;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

describe("PipelineTelemetryStore — record + query", () => {
  it("records entries and returns them newest-first", () => {
    const clock = virtualClock();
    const store = new PipelineTelemetryStore({ now: clock.now });
    store.record("srcA", mkResult({ recordsFetched: 5 }));
    clock.advance(1000);
    store.record("srcA", mkResult({ recordsFetched: 10 }));
    clock.advance(1000);
    store.record("srcB", mkResult({ recordsFetched: 20 }));
    const all = store.query();
    expect(all).toHaveLength(3);
    expect(all[0].sourceKey).toBe("srcB");
    expect(all[2].sourceKey).toBe("srcA");
  });

  it("filters by sourceKey", () => {
    const store = new PipelineTelemetryStore();
    store.record("srcA", mkResult());
    store.record("srcB", mkResult());
    store.record("srcA", mkResult());
    const a = store.query({ sourceKey: "srcA" });
    expect(a).toHaveLength(2);
    expect(a.every((e) => e.sourceKey === "srcA")).toBe(true);
  });

  it("filters by time window", () => {
    const clock = virtualClock();
    const store = new PipelineTelemetryStore({ now: clock.now });
    store.record("src", mkResult());
    const mid = clock.now();
    clock.advance(1000);
    store.record("src", mkResult());
    clock.advance(1000);
    store.record("src", mkResult());
    const recent = store.query({ since: mid + 1 });
    expect(recent).toHaveLength(2);
  });

  it("onlyFailed filter excludes completed runs", () => {
    const store = new PipelineTelemetryStore();
    store.record("src", mkResult({ stopReason: "completed" }));
    store.record("src", mkResult({ stopReason: "breaking_drift" }));
    store.record("src", mkResult({ stopReason: "fetch_error" }));
    const failed = store.query({ onlyFailed: true });
    expect(failed).toHaveLength(2);
    expect(failed.every((e) => e.stopReason !== "completed")).toBe(true);
  });

  it("respects limit", () => {
    const store = new PipelineTelemetryStore();
    for (let i = 0; i < 20; i++) {
      store.record("src", mkResult());
    }
    expect(store.query({ limit: 5 })).toHaveLength(5);
  });

  it("maxEntries cap drops oldest entries", () => {
    const store = new PipelineTelemetryStore({ maxEntries: 3 });
    for (let i = 0; i < 5; i++) {
      store.record("src", mkResult({ recordsFetched: i }));
    }
    expect(store.size()).toBe(3);
    // Oldest two (recordsFetched 0, 1) dropped
    const all = store.query();
    expect(all.map((e) => e.recordsFetched).sort()).toEqual([2, 3, 4]);
  });
});

describe("PipelineTelemetryStore — sourceHealth", () => {
  it("returns null for unknown sources", () => {
    const store = new PipelineTelemetryStore();
    expect(store.sourceHealth("no-such")).toBeNull();
  });

  it("aggregates success/failure rate", () => {
    const store = new PipelineTelemetryStore();
    // 3 successful, 1 failed
    store.record("src", mkResult({ stopReason: "completed" }));
    store.record("src", mkResult({ stopReason: "completed" }));
    store.record("src", mkResult({ stopReason: "completed" }));
    store.record("src", mkResult({ stopReason: "fetch_error" }));
    const health = store.sourceHealth("src");
    expect(health?.totalRuns).toBe(4);
    expect(health?.successfulRuns).toBe(3);
    expect(health?.failedRuns).toBe(1);
    expect(health?.failureRate).toBeCloseTo(0.25, 2);
  });

  it("computes average records per run + total fetched", () => {
    const store = new PipelineTelemetryStore();
    store.record("src", mkResult({ recordsFetched: 10 }));
    store.record("src", mkResult({ recordsFetched: 20 }));
    store.record("src", mkResult({ recordsFetched: 30 }));
    const health = store.sourceHealth("src");
    expect(health?.avgRecordsPerRun).toBe(20);
    expect(health?.totalRecordsFetched).toBe(60);
  });

  it("flags recently flaky sources (last 10 runs > 25% failure)", () => {
    const store = new PipelineTelemetryStore();
    // 10 runs: 3 failures
    for (let i = 0; i < 7; i++) store.record("flaky", mkResult({ stopReason: "completed" }));
    for (let i = 0; i < 3; i++) store.record("flaky", mkResult({ stopReason: "fetch_error" }));
    const health = store.sourceHealth("flaky");
    expect(health?.recentlyFlaky).toBe(true);
  });

  it("does NOT flag stable sources as flaky", () => {
    const store = new PipelineTelemetryStore();
    for (let i = 0; i < 10; i++) store.record("stable", mkResult({ stopReason: "completed" }));
    const health = store.sourceHealth("stable");
    expect(health?.recentlyFlaky).toBe(false);
  });
});

describe("PipelineTelemetryStore — globalHealth", () => {
  it("rollups across all sources", () => {
    const store = new PipelineTelemetryStore();
    store.record("a", mkResult({ recordsFetched: 10 }));
    store.record("b", mkResult({ recordsFetched: 20 }));
    store.record("c", mkResult({ recordsFetched: 30, stopReason: "fetch_error" }));
    const g = store.globalHealth();
    expect(g.totalRuns).toBe(3);
    expect(g.totalSources).toBe(3);
    expect(g.totalRecordsFetched).toBe(60);
    expect(g.avgFailureRate).toBeCloseTo(1 / 3, 2);
  });

  it("counts breaking drift alerts", () => {
    const store = new PipelineTelemetryStore();
    store.record(
      "a",
      mkResult({
        drift: {
          compatible: false,
          reviewRequired: true,
          changes: [],
          summary: { breaking: 2, warning: 0, info: 0 },
          fieldsAdded: [],
          fieldsRemoved: [],
          fieldsChanged: [],
        },
      }),
    );
    store.record("b", mkResult());
    const g = store.globalHealth();
    expect(g.breakingDriftAlerts).toBe(1);
  });
});

describe("PipelineTelemetryStore — listSources", () => {
  it("returns unique sources sorted", () => {
    const store = new PipelineTelemetryStore();
    store.record("zeta", mkResult());
    store.record("alpha", mkResult());
    store.record("alpha", mkResult());
    store.record("beta", mkResult());
    expect(store.listSources()).toEqual(["alpha", "beta", "zeta"]);
  });
});

describe("PipelineTelemetryStore — drift + hint counts", () => {
  it("records drift breaking/warning counts", () => {
    const store = new PipelineTelemetryStore();
    store.record(
      "src",
      mkResult({
        drift: {
          compatible: false,
          reviewRequired: true,
          changes: [],
          summary: { breaking: 1, warning: 3, info: 2 },
          fieldsAdded: [],
          fieldsRemoved: [],
          fieldsChanged: [],
        },
      }),
    );
    const [entry] = store.query();
    expect(entry.driftBreaking).toBe(1);
    expect(entry.driftWarning).toBe(3);
  });

  it("records personalization hint count", () => {
    const store = new PipelineTelemetryStore();
    store.record(
      "src",
      mkResult({
        personalizationHints: {
          hints: [
            {
              category: "learning_track",
              key: "x",
              label: "y",
              rationale: "",
              confidence: 0.9,
              source: "s",
              priority: 1,
            },
            {
              category: "calculator_focus",
              key: "y",
              label: "z",
              rationale: "",
              confidence: 0.8,
              source: "s",
              priority: 2,
            },
          ],
          byCategory: {
            learning_track: [],
            calculator_focus: [],
            chat_context: [],
            crm_segment: [],
            risk_indicator: [],
            retention_signal: [],
          },
          overallConfidence: 0.85,
          recordCount: 10,
        },
      }),
    );
    const [entry] = store.query();
    expect(entry.hintCount).toBe(2);
  });
});

describe("PipelineTelemetryStore — clear", () => {
  it("removes all entries", () => {
    const store = new PipelineTelemetryStore();
    store.record("a", mkResult());
    store.record("b", mkResult());
    store.clear();
    expect(store.size()).toBe(0);
    expect(store.query()).toHaveLength(0);
  });
});
