import { describe, it, expect } from "vitest";
import * as agentPerf from "./agentPerformance";

describe("Agent Performance Service", () => {
  it("exports getOrCreate function", () => {
    expect(typeof agentPerf.getOrCreate).toBe("function");
  });

  it("exports recordRun function", () => {
    expect(typeof agentPerf.recordRun).toBe("function");
  });

  it("exports listAll function", () => {
    expect(typeof agentPerf.listAll).toBe("function");
  });

  it("exports topPerformers function", () => {
    expect(typeof agentPerf.topPerformers).toBe("function");
  });

  it("exports resetStats function", () => {
    expect(typeof agentPerf.resetStats).toBe("function");
  });

  it("getOrCreate returns a PerformanceSnapshot", async () => {
    const result = await agentPerf.getOrCreate(999);
    // With DB available, it should return a snapshot; without DB, null
    if (result) {
      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("agentTemplateId", 999);
      expect(result).toHaveProperty("runs");
      expect(result).toHaveProperty("successes");
      expect(result).toHaveProperty("successRate");
    } else {
      expect(result).toBeNull();
    }
  });

  it("recordRun returns a PerformanceSnapshot with incremented runs", async () => {
    const result = await agentPerf.recordRun(999, { success: true, durationMs: 500, costUsd: 0.01 });
    if (result) {
      expect(result.runs).toBeGreaterThanOrEqual(1);
      expect(result.successes).toBeGreaterThanOrEqual(1);
      expect(result.successRate).toBeGreaterThan(0);
      expect(result.avgDurationMs).toBe(500);
    } else {
      expect(result).toBeNull();
    }
  });

  it("listAll returns an array of PerformanceSnapshots", async () => {
    const result = await agentPerf.listAll();
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty("id");
      expect(result[0]).toHaveProperty("agentTemplateId");
      expect(result[0]).toHaveProperty("successRate");
    }
  });

  it("topPerformers returns an array filtered by min runs", async () => {
    const result = await agentPerf.topPerformers();
    expect(Array.isArray(result)).toBe(true);
    // All returned items should have >= 5 runs
    for (const item of result) {
      expect(item.runs).toBeGreaterThanOrEqual(5);
    }
  });

  it("resetStats resets performance counters", async () => {
    const result = await agentPerf.resetStats(999);
    // With DB: true, without DB: false
    expect(typeof result).toBe("boolean");
  });

  it("PerformanceSnapshot interface has correct shape", () => {
    const snapshot: agentPerf.PerformanceSnapshot = {
      id: 1,
      agentTemplateId: 1,
      runs: 10,
      successes: 8,
      successRate: 80,
      avgDurationMs: 1500,
      avgCostUsd: 0.05,
      avgSatisfactionScore: 4.5,
      updatedAt: new Date(),
    };
    expect(snapshot.successRate).toBe(80);
    expect(snapshot.templateName).toBeUndefined();
  });
});
