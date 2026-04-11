/**
 * Tests for response rate meter — Pass 273.
 */

import { describe, it, expect } from "vitest";
import {
  emptyRateMeter,
  recordChunk,
  snapshot,
  formatTps,
  classifyRate,
  resetRateMeter,
  WINDOW_MS,
} from "./responseRateMeter";

describe("emptyRateMeter", () => {
  it("returns zero state", () => {
    const state = emptyRateMeter();
    expect(state.totalBytes).toBe(0);
    expect(state.samples).toEqual([]);
    expect(state.startedAt).toBeNull();
  });
});

describe("recordChunk", () => {
  it("appends a sample", () => {
    const state = recordChunk(emptyRateMeter(), 100, 1000);
    expect(state.samples).toHaveLength(1);
    expect(state.totalBytes).toBe(100);
  });

  it("ignores non-positive chunks", () => {
    const state = recordChunk(emptyRateMeter(), 0);
    expect(state.samples).toHaveLength(0);
  });

  it("accumulates totalBytes", () => {
    let state = recordChunk(emptyRateMeter(), 100, 1000);
    state = recordChunk(state, 50, 1100);
    expect(state.totalBytes).toBe(150);
  });

  it("prunes samples older than WINDOW_MS", () => {
    let state = recordChunk(emptyRateMeter(), 100, 1000);
    state = recordChunk(state, 100, 1500);
    // Third sample far enough ahead that both prior ones fall out
    state = recordChunk(state, 100, 1500 + WINDOW_MS + 100);
    // Only the most recent sample should survive window prune
    expect(state.samples.length).toBeLessThanOrEqual(1);
  });

  it("sets startedAt on first sample", () => {
    const state = recordChunk(emptyRateMeter(), 50, 5000);
    expect(state.startedAt).toBe(5000);
  });

  it("preserves startedAt on subsequent samples", () => {
    let state = recordChunk(emptyRateMeter(), 50, 5000);
    state = recordChunk(state, 50, 6000);
    expect(state.startedAt).toBe(5000);
  });
});

describe("snapshot", () => {
  it("returns zero snapshot for empty state", () => {
    const s = snapshot(emptyRateMeter(), 1000);
    expect(s.totalBytes).toBe(0);
    expect(s.windowTokensPerSecond).toBe(0);
  });

  it("derives totalTokens from totalBytes", () => {
    let state = recordChunk(emptyRateMeter(), 380, 1000); // ~100 tokens
    const s = snapshot(state, 2000);
    expect(s.totalTokens).toBe(100);
  });

  it("computes avg tokens/sec over full elapsed time", () => {
    let state = recordChunk(emptyRateMeter(), 380, 1000);
    state = recordChunk(state, 380, 2000);
    // 200 tokens over 1 second elapsed (from 1000 to 2000)
    const s = snapshot(state, 2000);
    expect(s.totalTokens).toBe(200);
    expect(s.avgTokensPerSecond).toBeGreaterThan(150);
  });

  it("window rate uses recent samples only", () => {
    // Fast burst: two samples 500ms apart
    let state = recordChunk(emptyRateMeter(), 380, 1000);
    state = recordChunk(state, 380, 1500);
    const s = snapshot(state, 1500);
    expect(s.windowSize).toBeGreaterThan(0);
    expect(s.windowTokensPerSecond).toBeGreaterThan(0);
  });
});

describe("formatTps", () => {
  it("returns '0 tok/s' for zero", () => {
    expect(formatTps(0)).toBe("0 tok/s");
  });

  it("returns one decimal for low rates", () => {
    expect(formatTps(5.7)).toBe("5.7 tok/s");
  });

  it("returns whole number for high rates", () => {
    expect(formatTps(42.9)).toBe("43 tok/s");
  });

  it("handles NaN", () => {
    expect(formatTps(NaN)).toBe("0 tok/s");
  });

  it("handles infinity", () => {
    expect(formatTps(Infinity)).toBe("0 tok/s");
  });
});

describe("classifyRate", () => {
  it("classifies as idle at zero", () => {
    expect(classifyRate(0)).toBe("idle");
  });

  it("slow < 20", () => {
    expect(classifyRate(10)).toBe("slow");
  });

  it("normal 20-79", () => {
    expect(classifyRate(50)).toBe("normal");
  });

  it("fast >= 80", () => {
    expect(classifyRate(100)).toBe("fast");
  });

  it("negative treated as idle", () => {
    expect(classifyRate(-5)).toBe("idle");
  });
});

describe("resetRateMeter", () => {
  it("returns empty state", () => {
    const state = resetRateMeter();
    expect(state.samples).toEqual([]);
    expect(state.totalBytes).toBe(0);
  });
});
