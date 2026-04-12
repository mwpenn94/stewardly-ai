import { describe, it, expect } from "vitest";
import {
  startComparisonRun,
  updateSlot,
  setWinner,
  summarizeRun,
  isComparisonComplete,
  type ComparisonRun,
} from "./modelComparison";

describe("startComparisonRun", () => {
  it("creates a slot per model", () => {
    const run = startComparisonRun("hello", ["claude-sonnet-4-6", "gpt-5"]);
    expect(run.slots).toHaveLength(2);
    expect(run.slots[0].model).toBe("claude-sonnet-4-6");
    expect(run.slots[1].model).toBe("gpt-5");
    expect(run.slots.every((s) => s.status === "pending")).toBe(true);
    expect(run.winnerSlotId).toBeNull();
  });

  it("dedupes case-insensitively", () => {
    const run = startComparisonRun("hello", [
      "claude-sonnet-4-6",
      "Claude-Sonnet-4-6",
      "gpt-5",
    ]);
    expect(run.slots).toHaveLength(2);
  });

  it("caps at 4 slots", () => {
    const run = startComparisonRun("hello", [
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
    ]);
    expect(run.slots).toHaveLength(4);
  });

  it("filters out non-string + empty entries", () => {
    const run = startComparisonRun("hello", [
      "claude-sonnet-4-6",
      "",
      null as unknown as string,
      42 as unknown as string,
      "gpt-5",
    ]);
    expect(run.slots).toHaveLength(2);
  });

  it("trims whitespace from model names", () => {
    const run = startComparisonRun("hello", ["  claude  "]);
    expect(run.slots[0].model).toBe("claude");
  });

  it("sets a unique deterministic id per slot", () => {
    const run = startComparisonRun("hello", ["a", "b", "c"]);
    const ids = run.slots.map((s) => s.id);
    expect(new Set(ids).size).toBe(3);
  });
});

describe("updateSlot", () => {
  const base: ComparisonRun = startComparisonRun("hi", [
    "model-a",
    "model-b",
  ]);

  it("returns a new run with the patched slot", () => {
    const next = updateSlot(base, base.slots[0].id, {
      status: "running",
    });
    expect(next).not.toBe(base);
    expect(next.slots[0].status).toBe("running");
    expect(next.slots[1].status).toBe("pending");
  });

  it("merges multiple fields in one patch", () => {
    const next = updateSlot(base, base.slots[0].id, {
      status: "done",
      response: "hello world",
      iterations: 3,
      costUSD: 0.012,
    });
    expect(next.slots[0].response).toBe("hello world");
    expect(next.slots[0].iterations).toBe(3);
    expect(next.slots[0].costUSD).toBe(0.012);
  });

  it("is a no-op for unknown slot id", () => {
    const next = updateSlot(base, "unknown", { status: "done" });
    expect(next).toBe(base);
  });

  it("does not mutate the original run", () => {
    const before = JSON.stringify(base);
    updateSlot(base, base.slots[0].id, { status: "done" });
    expect(JSON.stringify(base)).toBe(before);
  });
});

describe("setWinner", () => {
  const base: ComparisonRun = startComparisonRun("hi", [
    "model-a",
    "model-b",
  ]);

  it("marks a slot as the winner", () => {
    const next = setWinner(base, base.slots[0].id);
    expect(next.winnerSlotId).toBe(base.slots[0].id);
  });

  it("clears the winner with null", () => {
    const withWinner = setWinner(base, base.slots[0].id);
    const cleared = setWinner(withWinner, null);
    expect(cleared.winnerSlotId).toBeNull();
  });

  it("ignores unknown slot ids", () => {
    const next = setWinner(base, "unknown");
    expect(next).toBe(base);
  });
});

describe("summarizeRun", () => {
  it("counts statuses correctly", () => {
    let run = startComparisonRun("hi", ["a", "b", "c", "d"]);
    run = updateSlot(run, run.slots[0].id, { status: "running" });
    run = updateSlot(run, run.slots[1].id, {
      status: "done",
      durationMs: 1000,
      costUSD: 0.01,
    });
    run = updateSlot(run, run.slots[2].id, {
      status: "done",
      durationMs: 500,
      costUSD: 0.005,
    });
    run = updateSlot(run, run.slots[3].id, { status: "error" });
    const sum = summarizeRun(run);
    expect(sum.total).toBe(4);
    expect(sum.pending).toBe(0);
    expect(sum.running).toBe(1);
    expect(sum.done).toBe(2);
    expect(sum.errored).toBe(1);
  });

  it("identifies the fastest done slot", () => {
    let run = startComparisonRun("hi", ["a", "b"]);
    run = updateSlot(run, run.slots[0].id, {
      status: "done",
      durationMs: 1000,
    });
    run = updateSlot(run, run.slots[1].id, {
      status: "done",
      durationMs: 500,
    });
    expect(summarizeRun(run).fastest?.id).toBe(run.slots[1].id);
  });

  it("identifies the cheapest done slot", () => {
    let run = startComparisonRun("hi", ["a", "b"]);
    run = updateSlot(run, run.slots[0].id, {
      status: "done",
      costUSD: 0.05,
    });
    run = updateSlot(run, run.slots[1].id, {
      status: "done",
      costUSD: 0.01,
    });
    expect(summarizeRun(run).cheapest?.id).toBe(run.slots[1].id);
  });

  it("flags unpriced slots without breaking the total", () => {
    let run = startComparisonRun("hi", ["a", "b"]);
    run = updateSlot(run, run.slots[0].id, {
      status: "done",
      costUSD: 0.01,
    });
    run = updateSlot(run, run.slots[1].id, {
      status: "done",
      costUSD: null,
    });
    const sum = summarizeRun(run);
    expect(sum.totalCostUSD).toBeCloseTo(0.01, 5);
    expect(sum.hasUnpriced).toBe(true);
  });

  it("returns null fastest/cheapest for an empty/all-pending run", () => {
    const run = startComparisonRun("hi", ["a", "b"]);
    const sum = summarizeRun(run);
    expect(sum.fastest).toBeNull();
    expect(sum.cheapest).toBeNull();
  });
});

describe("isComparisonComplete", () => {
  it("returns false when any slot is pending or running", () => {
    let run = startComparisonRun("hi", ["a", "b"]);
    expect(isComparisonComplete(run)).toBe(false);
    run = updateSlot(run, run.slots[0].id, { status: "running" });
    expect(isComparisonComplete(run)).toBe(false);
  });

  it("returns true when every slot is in a terminal state", () => {
    let run = startComparisonRun("hi", ["a", "b"]);
    run = updateSlot(run, run.slots[0].id, { status: "done" });
    run = updateSlot(run, run.slots[1].id, { status: "error" });
    expect(isComparisonComplete(run)).toBe(true);
  });

  it("treats aborted as terminal", () => {
    let run = startComparisonRun("hi", ["a"]);
    run = updateSlot(run, run.slots[0].id, { status: "aborted" });
    expect(isComparisonComplete(run)).toBe(true);
  });
});
