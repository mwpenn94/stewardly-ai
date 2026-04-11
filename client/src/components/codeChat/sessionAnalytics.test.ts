/**
 * Tests for sessionAnalytics.ts (Pass 243).
 */

import { describe, it, expect } from "vitest";
import {
  aggregateByModel,
  topExpensiveTurns,
  toolUsageStats,
  bytesRatio,
  durationStats,
  analyzeSession,
} from "./sessionAnalytics";
import type { CodeChatMessage, ToolEvent } from "@/hooks/useCodeChatStream";

const mkUser = (content: string, id = "u1"): CodeChatMessage => ({
  id,
  role: "user",
  content,
  timestamp: new Date(1_700_000_000_000),
});

const mkAssistant = (
  content: string,
  overrides: Partial<CodeChatMessage> = {},
): CodeChatMessage => ({
  id: overrides.id ?? "a1",
  role: "assistant",
  content,
  timestamp: overrides.timestamp ?? new Date(1_700_000_000_000),
  model: overrides.model ?? "claude-sonnet-4-6",
  toolEvents: overrides.toolEvents ?? [],
  totalDurationMs: overrides.totalDurationMs ?? 1000,
  toolCallCount: overrides.toolCallCount,
  iterations: overrides.iterations,
});

const mkEvent = (overrides: Partial<ToolEvent> = {}): ToolEvent => ({
  stepIndex: overrides.stepIndex ?? 1,
  toolName: overrides.toolName ?? "read_file",
  status: overrides.status ?? "complete",
  durationMs: overrides.durationMs ?? 10,
  kind: overrides.kind,
  preview: overrides.preview,
  args: overrides.args,
});

describe("aggregateByModel", () => {
  it("returns empty for no messages", () => {
    expect(aggregateByModel([])).toEqual([]);
  });

  it("groups assistant messages by model", () => {
    const msgs: CodeChatMessage[] = [
      mkUser("q1"),
      mkAssistant("a1", { id: "m1", model: "claude-sonnet-4-6" }),
      mkUser("q2", "u2"),
      mkAssistant("a2", { id: "m2", model: "gpt-4o" }),
      mkUser("q3", "u3"),
      mkAssistant("a3", { id: "m3", model: "claude-sonnet-4-6" }),
    ];
    const buckets = aggregateByModel(msgs);
    expect(buckets).toHaveLength(2);
    const claude = buckets.find((b) => b.model === "claude-sonnet-4-6");
    expect(claude?.turns).toBe(2);
  });

  it("routes unknown models to an 'unknown' bucket", () => {
    const msgs: CodeChatMessage[] = [
      mkUser("q"),
      { ...mkAssistant("a"), model: undefined },
    ];
    const buckets = aggregateByModel(msgs);
    expect(buckets[0].model).toBe("unknown");
  });

  it("sorts buckets by cost (descending)", () => {
    const msgs: CodeChatMessage[] = [
      mkUser("a"),
      mkAssistant("x", { id: "m1", model: "claude-haiku-4-5" }),
      mkUser("b", "u2"),
      mkAssistant("this is a much longer response with more tokens", {
        id: "m2",
        model: "claude-sonnet-4-6",
      }),
    ];
    const buckets = aggregateByModel(msgs);
    // Sonnet costs more per token AND has more tokens → should rank first
    expect(buckets[0].model).toBe("claude-sonnet-4-6");
  });
});

describe("topExpensiveTurns", () => {
  it("returns empty when no priced turns exist", () => {
    const msgs: CodeChatMessage[] = [
      mkUser("a"),
      mkAssistant("b", { model: "unknown-model" }),
    ];
    expect(topExpensiveTurns(msgs)).toEqual([]);
  });

  it("returns top N turns sorted by cost", () => {
    const long = "x".repeat(5000);
    const msgs: CodeChatMessage[] = [
      mkUser("short"),
      mkAssistant("short reply", { id: "a1", model: "claude-sonnet-4-6" }),
      mkUser("long long long"),
      mkAssistant(long, { id: "a2", model: "claude-sonnet-4-6" }),
    ];
    const turns = topExpensiveTurns(msgs, 2);
    expect(turns[0].messageId).toBe("a2"); // more expensive
  });

  it("respects limit", () => {
    const msgs: CodeChatMessage[] = [];
    for (let i = 0; i < 10; i++) {
      msgs.push(mkUser(`q${i}`, `u${i}`));
      msgs.push(mkAssistant(`reply ${i}`, { id: `a${i}`, model: "claude-sonnet-4-6" }));
    }
    expect(topExpensiveTurns(msgs, 3)).toHaveLength(3);
  });
});

describe("toolUsageStats", () => {
  it("returns empty for no tool events", () => {
    expect(toolUsageStats([mkAssistant("a")])).toEqual([]);
  });

  it("counts tool calls and aggregates duration", () => {
    const msgs: CodeChatMessage[] = [
      mkAssistant("", {
        toolEvents: [
          mkEvent({ toolName: "read_file", durationMs: 10 }),
          mkEvent({ toolName: "read_file", durationMs: 20 }),
          mkEvent({ toolName: "grep_search", durationMs: 100 }),
        ],
      }),
    ];
    const stats = toolUsageStats(msgs);
    expect(stats).toHaveLength(2);
    const read = stats.find((s) => s.toolName === "read_file");
    expect(read?.count).toBe(2);
    expect(read?.totalDurationMs).toBe(30);
    expect(read?.avgDurationMs).toBe(15);
  });

  it("sorts by totalDurationMs descending", () => {
    const msgs: CodeChatMessage[] = [
      mkAssistant("", {
        toolEvents: [
          mkEvent({ toolName: "read_file", durationMs: 10 }),
          mkEvent({ toolName: "run_bash", durationMs: 500 }),
        ],
      }),
    ];
    const stats = toolUsageStats(msgs);
    expect(stats[0].toolName).toBe("run_bash");
  });

  it("counts errors separately", () => {
    const msgs: CodeChatMessage[] = [
      mkAssistant("", {
        toolEvents: [
          mkEvent({ toolName: "read_file", kind: "error" }),
          mkEvent({ toolName: "read_file", kind: "read" }),
        ],
      }),
    ];
    const stats = toolUsageStats(msgs);
    expect(stats[0].errorCount).toBe(1);
    expect(stats[0].count).toBe(2);
  });
});

describe("bytesRatio", () => {
  it("returns zero for no tool events", () => {
    const r = bytesRatio([]);
    expect(r.bytesRead).toBe(0);
    expect(r.bytesWritten).toBe(0);
    expect(r.writeRatio).toBe(0);
  });

  it("sums read bytes from read_file events", () => {
    const preview = JSON.stringify({
      kind: "read",
      result: { byteLength: 1024, path: "a.ts" },
    });
    const msgs: CodeChatMessage[] = [
      mkAssistant("", {
        toolEvents: [mkEvent({ toolName: "read_file", preview })],
      }),
    ];
    const r = bytesRatio(msgs);
    expect(r.bytesRead).toBe(1024);
    expect(r.filesRead).toBe(1);
  });

  it("sums write bytes from write_file events", () => {
    const preview = JSON.stringify({
      kind: "write",
      result: { byteLength: 2048, path: "a.ts" },
    });
    const msgs: CodeChatMessage[] = [
      mkAssistant("", {
        toolEvents: [mkEvent({ toolName: "write_file", preview })],
      }),
    ];
    const r = bytesRatio(msgs);
    expect(r.bytesWritten).toBe(2048);
    expect(r.filesWritten).toBe(1);
  });

  it("computes writeRatio correctly", () => {
    const readPrev = JSON.stringify({
      kind: "read",
      result: { byteLength: 300, path: "r.ts" },
    });
    const writePrev = JSON.stringify({
      kind: "write",
      result: { byteLength: 100, path: "w.ts" },
    });
    const msgs: CodeChatMessage[] = [
      mkAssistant("", {
        toolEvents: [
          mkEvent({ toolName: "read_file", preview: readPrev }),
          mkEvent({ toolName: "write_file", preview: writePrev }),
        ],
      }),
    ];
    const r = bytesRatio(msgs);
    expect(r.writeRatio).toBeCloseTo(0.25, 2);
  });

  it("dedupes file counts across multiple reads", () => {
    const preview = JSON.stringify({
      kind: "read",
      result: { byteLength: 100, path: "a.ts" },
    });
    const msgs: CodeChatMessage[] = [
      mkAssistant("", {
        toolEvents: [
          mkEvent({ toolName: "read_file", preview }),
          mkEvent({ toolName: "read_file", preview }),
        ],
      }),
    ];
    const r = bytesRatio(msgs);
    expect(r.filesRead).toBe(1);
    expect(r.bytesRead).toBe(200);
  });
});

describe("durationStats", () => {
  it("returns zero for no messages", () => {
    const d = durationStats([]);
    expect(d.turns).toBe(0);
    expect(d.totalMs).toBe(0);
  });

  it("sums totalDurationMs across assistant turns", () => {
    const msgs: CodeChatMessage[] = [
      mkAssistant("a", { id: "m1", totalDurationMs: 500 }),
      mkAssistant("b", { id: "m2", totalDurationMs: 1500 }),
    ];
    const d = durationStats(msgs);
    expect(d.totalMs).toBe(2000);
    expect(d.turns).toBe(2);
    expect(d.avgMs).toBe(1000);
  });

  it("tracks first and last message timestamps", () => {
    const msgs: CodeChatMessage[] = [
      { ...mkAssistant("a"), timestamp: new Date(1000), id: "m1" },
      { ...mkAssistant("b"), timestamp: new Date(5000), id: "m2" },
    ];
    const d = durationStats(msgs);
    expect(d.firstMessageAt).toBe(1000);
    expect(d.lastMessageAt).toBe(5000);
    expect(d.spanMs).toBe(4000);
  });
});

describe("analyzeSession", () => {
  it("returns a complete summary", () => {
    const msgs: CodeChatMessage[] = [
      mkUser("q1", "u1"),
      mkAssistant("a1", { id: "m1", model: "claude-sonnet-4-6" }),
      mkUser("q2", "u2"),
      mkAssistant("a2", { id: "m2", model: "claude-sonnet-4-6" }),
    ];
    const summary = analyzeSession(msgs);
    expect(summary.totalMessages).toBe(4);
    expect(summary.userTurns).toBe(2);
    expect(summary.assistantTurns).toBe(2);
    expect(summary.byModel).toHaveLength(1);
  });
});
