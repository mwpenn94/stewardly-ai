/**
 * Tests for the run timeline store. Cover parse tolerance,
 * appendEntry (with dedupe window + cap), filter/group helpers,
 * and stats aggregation.
 */

import { describe, it, expect } from "vitest";
import {
  EMPTY_TIMELINE,
  RUN_TIMELINE_MAX_ENTRIES,
  appendEntry,
  clearTimeline,
  filterByTool,
  findEntry,
  groupByTool,
  parseTimeline,
  removeEntry,
  serializeTimeline,
  timelineStats,
  type RunTimeline,
  type TimelineEntry,
} from "./runTimeline";

function mkEntry(
  patch: Partial<TimelineEntry> & { tool: string; label: string },
): Omit<TimelineEntry, "id" | "timestamp"> & { id?: string; timestamp?: string } {
  return {
    tool: patch.tool,
    label: patch.label,
    inputSummary: patch.inputSummary ?? "",
    outputSummary: patch.outputSummary ?? "",
    id: patch.id,
    timestamp: patch.timestamp,
    confidence: patch.confidence,
    route: patch.route,
    inputs: patch.inputs,
  };
}

describe("runTimeline / parseTimeline", () => {
  it("returns empty timeline for null", () => {
    expect(parseTimeline(null).entries).toEqual([]);
  });

  it("tolerates malformed JSON", () => {
    expect(parseTimeline("{").entries).toEqual([]);
  });

  it("tolerates non-object top-level shapes", () => {
    expect(parseTimeline("[]").entries).toEqual([]);
    expect(parseTimeline("42").entries).toEqual([]);
  });

  it("drops entries missing required fields", () => {
    const raw = JSON.stringify({
      version: 1,
      entries: [
        { id: "e1", tool: "uwe.simulate", timestamp: "2026-04-11" },
        { tool: "uwe.simulate" }, // no id
        { id: "e3", timestamp: "2026-04-11" }, // no tool
      ],
    });
    expect(parseTimeline(raw).entries.length).toBe(1);
  });

  it("clamps oversized summaries", () => {
    const raw = JSON.stringify({
      version: 1,
      entries: [
        {
          id: "e1",
          tool: "uwe.simulate",
          timestamp: "2026-04-11",
          label: "x".repeat(300),
          inputSummary: "i".repeat(800),
          outputSummary: "o".repeat(800),
        },
      ],
    });
    const t = parseTimeline(raw);
    expect(t.entries[0].label.length).toBeLessThanOrEqual(200);
    expect(t.entries[0].inputSummary.length).toBeLessThanOrEqual(500);
    expect(t.entries[0].outputSummary.length).toBeLessThanOrEqual(500);
  });

  it("clamps confidence to 0..1", () => {
    const raw = JSON.stringify({
      version: 1,
      entries: [
        {
          id: "e1",
          tool: "uwe.simulate",
          timestamp: "2026-04-11",
          label: "test",
          confidence: 5,
        },
      ],
    });
    expect(parseTimeline(raw).entries[0].confidence).toBe(1);
  });
});

describe("runTimeline / appendEntry", () => {
  it("adds a new entry newest-first", () => {
    let t: RunTimeline = EMPTY_TIMELINE;
    t = appendEntry(t, mkEntry({ tool: "uwe.simulate", label: "UWE", id: "e1" }));
    t = appendEntry(t, mkEntry({ tool: "bie.simulate", label: "BIE", id: "e2" }));
    expect(t.entries[0].id).toBe("e2");
    expect(t.entries[1].id).toBe("e1");
  });

  it("auto-generates an id if none provided", () => {
    const t = appendEntry(
      EMPTY_TIMELINE,
      mkEntry({ tool: "uwe.simulate", label: "UWE" }),
    );
    expect(t.entries[0].id).toMatch(/^run_\d+_/);
  });

  it("dedupes on identical tool+inputSummary within 10s", () => {
    let t: RunTimeline = EMPTY_TIMELINE;
    const now = new Date();
    t = appendEntry(
      t,
      mkEntry({
        tool: "uwe.simulate",
        label: "UWE",
        inputSummary: "age 40, income 120k",
        id: "e1",
        timestamp: now.toISOString(),
      }),
    );
    // 5 seconds later, same input — should replace e1
    const later = new Date(now.getTime() + 5000).toISOString();
    t = appendEntry(
      t,
      mkEntry({
        tool: "uwe.simulate",
        label: "UWE",
        inputSummary: "age 40, income 120k",
        id: "e2",
        timestamp: later,
      }),
    );
    expect(t.entries.length).toBe(1);
    expect(t.entries[0].id).toBe("e2");
  });

  it("does NOT dedupe across tool boundaries", () => {
    let t: RunTimeline = EMPTY_TIMELINE;
    t = appendEntry(
      t,
      mkEntry({
        tool: "uwe.simulate",
        label: "UWE",
        inputSummary: "age 40",
        id: "e1",
      }),
    );
    t = appendEntry(
      t,
      mkEntry({
        tool: "bie.simulate",
        label: "BIE",
        inputSummary: "age 40",
        id: "e2",
      }),
    );
    expect(t.entries.length).toBe(2);
  });

  it("does NOT dedupe after the 10s window", () => {
    let t: RunTimeline = EMPTY_TIMELINE;
    const now = new Date();
    t = appendEntry(
      t,
      mkEntry({
        tool: "uwe.simulate",
        label: "UWE",
        inputSummary: "age 40",
        id: "e1",
        timestamp: now.toISOString(),
      }),
    );
    const later = new Date(now.getTime() + 30_000).toISOString();
    t = appendEntry(
      t,
      mkEntry({
        tool: "uwe.simulate",
        label: "UWE",
        inputSummary: "age 40",
        id: "e2",
        timestamp: later,
      }),
    );
    expect(t.entries.length).toBe(2);
  });

  it("drops oldest when over the cap", () => {
    let t: RunTimeline = EMPTY_TIMELINE;
    for (let i = 0; i < RUN_TIMELINE_MAX_ENTRIES + 5; i++) {
      t = appendEntry(
        t,
        mkEntry({
          tool: "uwe.simulate",
          label: `run ${i}`,
          inputSummary: `input ${i}`,
          id: `e${i}`,
        }),
      );
    }
    expect(t.entries.length).toBe(RUN_TIMELINE_MAX_ENTRIES);
    // Newest is the last inserted
    expect(t.entries[0].id).toBe(`e${RUN_TIMELINE_MAX_ENTRIES + 4}`);
  });
});

describe("runTimeline / removeEntry + clearTimeline", () => {
  it("removes a specific entry", () => {
    let t: RunTimeline = EMPTY_TIMELINE;
    t = appendEntry(t, mkEntry({ tool: "uwe.simulate", label: "A", id: "e1", inputSummary: "a" }));
    t = appendEntry(t, mkEntry({ tool: "bie.simulate", label: "B", id: "e2", inputSummary: "b" }));
    t = removeEntry(t, "e1");
    expect(t.entries.length).toBe(1);
    expect(t.entries[0].id).toBe("e2");
  });

  it("clearTimeline returns empty", () => {
    expect(clearTimeline().entries).toEqual([]);
  });
});

describe("runTimeline / findEntry + filterByTool", () => {
  it("findEntry returns the matching entry", () => {
    let t: RunTimeline = EMPTY_TIMELINE;
    t = appendEntry(t, mkEntry({ tool: "uwe.simulate", label: "A", id: "e1", inputSummary: "a" }));
    t = appendEntry(t, mkEntry({ tool: "bie.simulate", label: "B", id: "e2", inputSummary: "b" }));
    expect(findEntry(t, "e1")?.label).toBe("A");
    expect(findEntry(t, "nope")).toBeUndefined();
  });

  it("filterByTool returns only matching tool entries", () => {
    let t: RunTimeline = EMPTY_TIMELINE;
    t = appendEntry(t, mkEntry({ tool: "uwe.simulate", label: "A", id: "e1", inputSummary: "A" }));
    t = appendEntry(t, mkEntry({ tool: "bie.simulate", label: "B", id: "e2", inputSummary: "B" }));
    t = appendEntry(t, mkEntry({ tool: "uwe.simulate", label: "C", id: "e3", inputSummary: "C" }));
    const uwe = filterByTool(t, "uwe.simulate");
    expect(uwe.length).toBe(2);
    expect(uwe.map((e) => e.id).sort()).toEqual(["e1", "e3"]);
  });
});

describe("runTimeline / groupByTool", () => {
  it("counts runs per tool", () => {
    let t: RunTimeline = EMPTY_TIMELINE;
    t = appendEntry(t, mkEntry({ tool: "uwe.simulate", label: "A", id: "e1", inputSummary: "run1" }));
    t = appendEntry(t, mkEntry({ tool: "uwe.simulate", label: "B", id: "e2", inputSummary: "run2" }));
    t = appendEntry(t, mkEntry({ tool: "bie.simulate", label: "C", id: "e3", inputSummary: "run3" }));
    const grouped = groupByTool(t);
    expect(grouped["uwe.simulate"].count).toBe(2);
    expect(grouped["bie.simulate"].count).toBe(1);
  });
});

describe("runTimeline / timelineStats", () => {
  it("returns zeros for empty timeline", () => {
    const stats = timelineStats(EMPTY_TIMELINE);
    expect(stats.totalRuns).toBe(0);
    expect(stats.uniqueTools).toBe(0);
    expect(stats.avgConfidence).toBe(0);
    expect(stats.newest).toBeNull();
  });

  it("counts unique tools and total runs", () => {
    let t: RunTimeline = EMPTY_TIMELINE;
    t = appendEntry(t, mkEntry({ tool: "uwe.simulate", label: "A", id: "e1", inputSummary: "a" }));
    t = appendEntry(t, mkEntry({ tool: "bie.simulate", label: "B", id: "e2", inputSummary: "b" }));
    t = appendEntry(t, mkEntry({ tool: "he.simulate", label: "C", id: "e3", inputSummary: "c" }));
    const stats = timelineStats(t);
    expect(stats.totalRuns).toBe(3);
    expect(stats.uniqueTools).toBe(3);
  });

  it("averages confidence across entries with a confidence", () => {
    let t: RunTimeline = EMPTY_TIMELINE;
    t = appendEntry(
      t,
      mkEntry({ tool: "uwe.simulate", label: "A", id: "e1", inputSummary: "a", confidence: 0.6 }),
    );
    t = appendEntry(
      t,
      mkEntry({ tool: "uwe.simulate", label: "B", id: "e2", inputSummary: "b", confidence: 0.8 }),
    );
    // Entry with no confidence shouldn't pull the average down
    t = appendEntry(t, mkEntry({ tool: "uwe.simulate", label: "C", id: "e3", inputSummary: "c" }));
    const stats = timelineStats(t);
    expect(stats.avgConfidence).toBeCloseTo(0.7, 4);
  });

  it("buckets runs per day", () => {
    let t: RunTimeline = EMPTY_TIMELINE;
    t = appendEntry(
      t,
      mkEntry({
        tool: "uwe.simulate",
        label: "A",
        id: "e1",
        timestamp: "2026-04-10T12:00:00.000Z",
      }),
    );
    t = appendEntry(
      t,
      mkEntry({
        tool: "uwe.simulate",
        label: "B",
        id: "e2",
        inputSummary: "different",
        timestamp: "2026-04-10T14:00:00.000Z",
      }),
    );
    t = appendEntry(
      t,
      mkEntry({
        tool: "uwe.simulate",
        label: "C",
        id: "e3",
        timestamp: "2026-04-11T09:00:00.000Z",
      }),
    );
    const stats = timelineStats(t);
    expect(stats.runsPerDay["2026-04-10"]).toBe(2);
    expect(stats.runsPerDay["2026-04-11"]).toBe(1);
  });
});

describe("runTimeline / serialize round-trip", () => {
  it("round-trips a non-trivial timeline", () => {
    let t: RunTimeline = EMPTY_TIMELINE;
    t = appendEntry(
      t,
      mkEntry({
        tool: "uwe.simulate",
        label: "UWE run",
        inputSummary: "age 40, income 120k",
        outputSummary: "$1.2M at year 30",
        confidence: 0.75,
        route: "/wealth-engine/retirement",
      }),
    );
    const raw = serializeTimeline(t);
    const rehydrated = parseTimeline(raw);
    expect(rehydrated.entries.length).toBe(1);
    expect(rehydrated.entries[0].tool).toBe("uwe.simulate");
    expect(rehydrated.entries[0].confidence).toBe(0.75);
    expect(rehydrated.entries[0].route).toBe("/wealth-engine/retirement");
  });
});
