/**
 * toolTelemetry.test.ts — Parity Pass 7.
 *
 * Locks down the pure audit-event builder + redactor. No I/O, no
 * clock mocking — the builder accepts a timestamp override so
 * assertions are deterministic.
 */

import { describe, it, expect } from "vitest";
import {
  classifyToolKind,
  isMutation,
  redactToolArgs,
  normalizePathForAudit,
  buildToolCallAuditEvent,
  summarizeAuditEvents,
  TOOL_AUDIT_EVENT_VERSION,
  type ToolCallAuditEvent,
} from "./toolTelemetry";

// ─── classifyToolKind ─────────────────────────────────────────────────

describe("classifyToolKind", () => {
  it("buckets read-only tools", () => {
    expect(classifyToolKind("read_file")).toBe("read");
    expect(classifyToolKind("list_directory")).toBe("read");
    expect(classifyToolKind("grep_search")).toBe("read");
    expect(classifyToolKind("find_symbol")).toBe("read");
  });

  it("buckets write tools", () => {
    expect(classifyToolKind("write_file")).toBe("write");
    expect(classifyToolKind("edit_file")).toBe("write");
    expect(classifyToolKind("multi_edit")).toBe("write");
  });

  it("buckets shell tools", () => {
    expect(classifyToolKind("run_bash")).toBe("shell");
  });

  it("buckets network tools", () => {
    expect(classifyToolKind("web_fetch")).toBe("network");
  });

  it("buckets meta tools", () => {
    expect(classifyToolKind("update_todos")).toBe("meta");
    expect(classifyToolKind("finish")).toBe("meta");
  });

  it("falls back to unknown", () => {
    expect(classifyToolKind("mystery_tool")).toBe("unknown");
    expect(classifyToolKind("")).toBe("unknown");
  });
});

describe("isMutation", () => {
  it("flags write and shell as mutations", () => {
    expect(isMutation("write")).toBe(true);
    expect(isMutation("shell")).toBe(true);
  });
  it("does not flag read/network/meta/unknown", () => {
    expect(isMutation("read")).toBe(false);
    expect(isMutation("network")).toBe(false);
    expect(isMutation("meta")).toBe(false);
    expect(isMutation("unknown")).toBe(false);
  });
});

// ─── normalizePathForAudit ────────────────────────────────────────────

describe("normalizePathForAudit", () => {
  it("returns unchanged when no workspace root", () => {
    expect(normalizePathForAudit("/tmp/a.ts")).toBe("/tmp/a.ts");
  });

  it("strips workspace prefix", () => {
    expect(normalizePathForAudit("/home/user/ws/src/a.ts", "/home/user/ws")).toBe(
      "src/a.ts",
    );
  });

  it("replaces out-of-workspace paths", () => {
    expect(normalizePathForAudit("/etc/passwd", "/home/user/ws")).toBe(
      "[outside-workspace]",
    );
  });

  it("returns . for root-equal path", () => {
    expect(normalizePathForAudit("/home/user/ws", "/home/user/ws")).toBe(".");
  });

  it("tolerates trailing slashes on root", () => {
    expect(normalizePathForAudit("/home/user/ws/a.ts", "/home/user/ws/")).toBe(
      "a.ts",
    );
  });
});

// ─── redactToolArgs ───────────────────────────────────────────────────

describe("redactToolArgs", () => {
  it("returns an empty object for undefined", () => {
    expect(redactToolArgs(undefined)).toEqual({});
  });

  it("masks secret-like keys", () => {
    const r = redactToolArgs({
      path: "a.ts",
      token: "abcd1234",
      apiKey: "sk-live-xxx",
      password: "hunter2",
      authorization: "Bearer xyz",
    });
    expect(r.token).toBe("[redacted]");
    expect(r.apiKey).toBe("[redacted]");
    expect(r.password).toBe("[redacted]");
    expect(r.authorization).toBe("[redacted]");
    expect(r.path).toBe("a.ts"); // non-secret preserved
  });

  it("truncates long string values", () => {
    const long = "a".repeat(2000);
    const r = redactToolArgs({ content: long }, { maxStringBytes: 100 });
    expect(typeof r.content).toBe("string");
    expect((r.content as string).length).toBeLessThan(long.length);
    expect(r.content).toMatch(/truncated/);
  });

  it("normalizes paths through workspace root", () => {
    const r = redactToolArgs(
      { path: "/home/user/ws/server/auth.ts" },
      { workspaceRoot: "/home/user/ws" },
    );
    expect(r.path).toBe("server/auth.ts");
  });

  it("marks out-of-workspace paths", () => {
    const r = redactToolArgs(
      { path: "/etc/passwd" },
      { workspaceRoot: "/home/user/ws" },
    );
    expect(r.path).toBe("[outside-workspace]");
  });

  it("redacts inside nested objects", () => {
    const r = redactToolArgs({
      nested: { token: "secret", path: "a.ts" },
    });
    expect((r.nested as any).token).toBe("[redacted]");
    expect((r.nested as any).path).toBe("a.ts");
  });

  it("redacts inside arrays", () => {
    const r = redactToolArgs({
      edits: [
        { oldString: "x", newString: "y" },
        { oldString: "a", newString: "b" },
      ],
    });
    expect(Array.isArray(r.edits)).toBe(true);
    expect((r.edits as any[]).length).toBe(2);
  });

  it("caps array size at 50", () => {
    const big = Array.from({ length: 200 }, (_, i) => `val${i}`);
    const r = redactToolArgs({ items: big });
    expect((r.items as string[]).length).toBe(50);
  });

  it("passes through numbers + booleans", () => {
    const r = redactToolArgs({ count: 42, enabled: true, path: "a.ts" });
    expect(r.count).toBe(42);
    expect(r.enabled).toBe(true);
  });

  it("preserves null + undefined", () => {
    const r = redactToolArgs({ a: null, b: undefined });
    expect(r.a).toBeNull();
    expect(r.b).toBeUndefined();
  });

  it("does not mutate the input", () => {
    const input = { token: "secret", path: "a.ts" };
    const r = redactToolArgs(input);
    expect(input.token).toBe("secret"); // input unchanged
    expect(r.token).toBe("[redacted]");
  });
});

// ─── buildToolCallAuditEvent ──────────────────────────────────────────

describe("buildToolCallAuditEvent", () => {
  const baseTs = new Date("2026-04-12T00:00:00Z");

  it("produces a stable shape for a happy-path read", () => {
    const ev = buildToolCallAuditEvent({
      userId: 7,
      toolName: "read_file",
      args: { path: "server/auth.ts" },
      resultKind: "read",
      error: false,
      durationMs: 42,
      resultBytes: 1024,
      timestamp: baseTs,
      eventId: "fixed-id",
    });
    expect(ev.v).toBe(TOOL_AUDIT_EVENT_VERSION);
    expect(ev.eventId).toBe("fixed-id");
    expect(ev.timestamp).toBe(baseTs.toISOString());
    expect(ev.userId).toBe(7);
    expect(ev.toolName).toBe("read_file");
    expect(ev.kind).toBe("read");
    expect(ev.mutation).toBe(false);
    expect(ev.resultKind).toBe("read");
    expect(ev.error).toBe(false);
    expect(ev.durationMs).toBe(42);
    expect(ev.resultBytes).toBe(1024);
    expect(ev.args).toEqual({ path: "server/auth.ts" });
  });

  it("flags mutation for write tools", () => {
    const ev = buildToolCallAuditEvent({
      userId: 1,
      toolName: "write_file",
      args: { path: "a.ts", content: "x" },
      resultKind: "write",
      error: false,
      durationMs: 5,
      resultBytes: 1,
      timestamp: baseTs,
    });
    expect(ev.kind).toBe("write");
    expect(ev.mutation).toBe(true);
  });

  it("embeds an error message and code when error=true", () => {
    const ev = buildToolCallAuditEvent({
      userId: 1,
      toolName: "edit_file",
      args: { path: "a.ts" },
      resultKind: "error",
      error: true,
      errorMessage: "oldString not found",
      errorCode: "NO_MATCH",
      durationMs: 2,
      resultBytes: 0,
      timestamp: baseTs,
    });
    expect(ev.error).toBe(true);
    expect(ev.errorMessage).toBe("oldString not found");
    expect(ev.errorCode).toBe("NO_MATCH");
  });

  it("truncates long error messages", () => {
    const long = "x".repeat(1000);
    const ev = buildToolCallAuditEvent({
      userId: 1,
      toolName: "run_bash",
      args: {},
      resultKind: "error",
      error: true,
      errorMessage: long,
      durationMs: 1,
      resultBytes: 0,
      timestamp: baseTs,
    });
    expect(ev.errorMessage?.length).toBeLessThan(long.length);
    expect(ev.errorMessage).toMatch(/truncated/);
  });

  it("rounds and clamps durationMs + resultBytes to non-negative", () => {
    const ev = buildToolCallAuditEvent({
      userId: 1,
      toolName: "read_file",
      args: {},
      resultKind: "read",
      error: false,
      durationMs: -5,
      resultBytes: -100,
      timestamp: baseTs,
    });
    expect(ev.durationMs).toBe(0);
    expect(ev.resultBytes).toBe(0);
  });

  it("auto-generates an eventId when omitted", () => {
    const e1 = buildToolCallAuditEvent({
      userId: 1,
      toolName: "read_file",
      args: {},
      resultKind: "read",
      error: false,
      durationMs: 1,
      resultBytes: 0,
      timestamp: baseTs,
    });
    expect(e1.eventId).toMatch(/^t-/);
  });

  it("defaults sessionId to null when missing", () => {
    const ev = buildToolCallAuditEvent({
      userId: 1,
      toolName: "read_file",
      args: {},
      resultKind: "read",
      error: false,
      durationMs: 1,
      resultBytes: 0,
    });
    expect(ev.sessionId).toBeNull();
  });

  it("applies workspace-relative path normalization inside args", () => {
    const ev = buildToolCallAuditEvent(
      {
        userId: 1,
        toolName: "read_file",
        args: { path: "/home/user/ws/a.ts" },
        resultKind: "read",
        error: false,
        durationMs: 1,
        resultBytes: 0,
        timestamp: baseTs,
      },
      { workspaceRoot: "/home/user/ws" },
    );
    expect(ev.args.path).toBe("a.ts");
  });

  it("applies secret redaction inside args", () => {
    const ev = buildToolCallAuditEvent({
      userId: 1,
      toolName: "web_fetch",
      args: { url: "https://x", authorization: "Bearer token123" },
      resultKind: "web",
      error: false,
      durationMs: 1,
      resultBytes: 0,
    });
    expect((ev.args as any).authorization).toBe("[redacted]");
    expect((ev.args as any).url).toBe("https://x");
  });
});

// ─── summarizeAuditEvents ─────────────────────────────────────────────

describe("summarizeAuditEvents", () => {
  const make = (override: Partial<ToolCallAuditEvent>): ToolCallAuditEvent => ({
    v: 1,
    eventId: "e",
    timestamp: "2026-04-12T00:00:00Z",
    userId: 1,
    sessionId: null,
    toolName: "read_file",
    kind: "read",
    mutation: false,
    resultKind: "read",
    error: false,
    durationMs: 10,
    resultBytes: 0,
    args: {},
    ...override,
  });

  it("returns zeros for empty input", () => {
    const s = summarizeAuditEvents([]);
    expect(s.total).toBe(0);
    expect(s.errors).toBe(0);
    expect(s.mutations).toBe(0);
    expect(s.totalDurationMs).toBe(0);
    expect(s.distinctTools).toEqual([]);
    expect(s.byKind.read).toBe(0);
  });

  it("aggregates by kind + error + mutation", () => {
    const events = [
      make({ toolName: "read_file", kind: "read", durationMs: 10 }),
      make({
        toolName: "write_file",
        kind: "write",
        mutation: true,
        durationMs: 20,
      }),
      make({
        toolName: "run_bash",
        kind: "shell",
        mutation: true,
        durationMs: 30,
      }),
      make({
        toolName: "edit_file",
        kind: "write",
        mutation: true,
        error: true,
        durationMs: 40,
      }),
      make({ toolName: "web_fetch", kind: "network", durationMs: 50 }),
    ];
    const s = summarizeAuditEvents(events);
    expect(s.total).toBe(5);
    expect(s.byKind.read).toBe(1);
    expect(s.byKind.write).toBe(2);
    expect(s.byKind.shell).toBe(1);
    expect(s.byKind.network).toBe(1);
    expect(s.errors).toBe(1);
    expect(s.mutations).toBe(3);
    expect(s.totalDurationMs).toBe(150);
    expect(s.distinctTools).toEqual([
      "edit_file",
      "read_file",
      "run_bash",
      "web_fetch",
      "write_file",
    ]);
  });
});
