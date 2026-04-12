/**
 * traceDiffExtractor.test.ts — Parity Pass 5.
 *
 * Locks down the pure extractors that used to live inline inside
 * CodeChat.tsx. Coverage:
 *   - extractDiffFromTrace: every tool name branch + error fallbacks
 *   - extractEditSnapshotsFromToolEvents: batch handling, status
 *     filtering, path fallback, dedupe semantics
 *   - isEditToolName: type predicate
 *   - diffKindLabel: label mapping
 */

import { describe, it, expect } from "vitest";
import {
  extractDiffFromTrace,
  extractEditSnapshotsFromToolEvents,
  isEditToolName,
  diffKindLabel,
  type ToolEventLike,
} from "./traceDiffExtractor";

// ─── isEditToolName ───────────────────────────────────────────────

describe("isEditToolName", () => {
  it("recognizes all three mutation tools", () => {
    expect(isEditToolName("edit_file")).toBe(true);
    expect(isEditToolName("write_file")).toBe(true);
    expect(isEditToolName("multi_edit")).toBe(true);
  });

  it("rejects read-only and unrelated tools", () => {
    expect(isEditToolName("read_file")).toBe(false);
    expect(isEditToolName("grep_search")).toBe(false);
    expect(isEditToolName("web_fetch")).toBe(false);
    expect(isEditToolName("run_bash")).toBe(false);
  });

  it("rejects undefined/empty", () => {
    expect(isEditToolName(undefined)).toBe(false);
    expect(isEditToolName("")).toBe(false);
  });
});

// ─── extractDiffFromTrace — happy path ─────────────────────────────

describe("extractDiffFromTrace — happy path", () => {
  function makePreview(kind: string, inner: Record<string, unknown>): string {
    return JSON.stringify({ kind, result: inner });
  }

  it("extracts edit_file snapshot", () => {
    const preview = makePreview("edit", {
      path: "a.ts",
      before: "old",
      after: "new",
    });
    const r = extractDiffFromTrace("edit_file", preview);
    expect(r).toEqual({ path: "a.ts", before: "old", after: "new", kind: "edit" });
  });

  it("extracts write_file snapshot with kind=write", () => {
    const preview = makePreview("write", {
      path: "b.ts",
      before: "",
      after: "hello",
    });
    const r = extractDiffFromTrace("write_file", preview);
    expect(r?.kind).toBe("write");
    expect(r?.path).toBe("b.ts");
  });

  it("extracts multi_edit snapshot as kind=edit", () => {
    const preview = makePreview("multi_edit", {
      path: "c.ts",
      before: "const a=1;const b=2;",
      after: "const a=10;const b=20;",
    });
    const r = extractDiffFromTrace("multi_edit", preview);
    expect(r?.kind).toBe("edit");
    expect(r?.path).toBe("c.ts");
  });

  it("uses empty path when not provided (caller falls back to args)", () => {
    const preview = makePreview("edit", { before: "x", after: "y" });
    const r = extractDiffFromTrace("edit_file", preview);
    expect(r?.path).toBe("");
  });

  it("preserves multi-line before/after content", () => {
    const preview = makePreview("edit", {
      path: "a.ts",
      before: "line1\nline2\nline3",
      after: "line1\nCHANGED\nline3",
    });
    const r = extractDiffFromTrace("edit_file", preview);
    expect(r?.before).toContain("\n");
    expect(r?.after).toContain("CHANGED");
  });
});

// ─── extractDiffFromTrace — error fallbacks ────────────────────────

describe("extractDiffFromTrace — error fallbacks", () => {
  it("returns null for undefined preview", () => {
    expect(extractDiffFromTrace("edit_file", undefined)).toBeNull();
  });

  it("returns null for empty preview", () => {
    expect(extractDiffFromTrace("edit_file", "")).toBeNull();
  });

  it("returns null for read-only tool names", () => {
    const preview = JSON.stringify({
      result: { before: "x", after: "y", path: "a.ts" },
    });
    expect(extractDiffFromTrace("read_file", preview)).toBeNull();
    expect(extractDiffFromTrace("grep_search", preview)).toBeNull();
  });

  it("returns null for undefined tool name", () => {
    const preview = JSON.stringify({ result: { before: "x", after: "y", path: "a" } });
    expect(extractDiffFromTrace(undefined, preview)).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(extractDiffFromTrace("edit_file", "{not json}")).toBeNull();
    expect(extractDiffFromTrace("edit_file", "null")).toBeNull();
    expect(extractDiffFromTrace("edit_file", "42")).toBeNull();
  });

  it("returns null when result is missing", () => {
    const preview = JSON.stringify({ kind: "edit" });
    expect(extractDiffFromTrace("edit_file", preview)).toBeNull();
  });

  it("returns null when before is missing", () => {
    const preview = JSON.stringify({
      kind: "edit",
      result: { path: "a", after: "y" },
    });
    expect(extractDiffFromTrace("edit_file", preview)).toBeNull();
  });

  it("returns null when after is missing", () => {
    const preview = JSON.stringify({
      kind: "edit",
      result: { path: "a", before: "x" },
    });
    expect(extractDiffFromTrace("edit_file", preview)).toBeNull();
  });

  it("returns null when before is non-string (e.g. null)", () => {
    const preview = JSON.stringify({
      kind: "edit",
      result: { path: "a", before: null, after: "y" },
    });
    expect(extractDiffFromTrace("edit_file", preview)).toBeNull();
  });

  it("returns null for an error-kind result", () => {
    const preview = JSON.stringify({ kind: "error", error: "NO_MATCH", code: "NO_MATCH" });
    expect(extractDiffFromTrace("edit_file", preview)).toBeNull();
  });
});

// ─── extractEditSnapshotsFromToolEvents ───────────────────────────

describe("extractEditSnapshotsFromToolEvents", () => {
  const makeEvent = (overrides: Partial<ToolEventLike> = {}): ToolEventLike => ({
    toolName: overrides.toolName ?? "edit_file",
    preview: overrides.preview,
    args: overrides.args,
    status: overrides.status ?? "complete",
  });

  const previewFor = (kind: string, inner: Record<string, unknown>) =>
    JSON.stringify({ kind, result: inner });

  it("returns empty array for undefined", () => {
    expect(extractEditSnapshotsFromToolEvents(undefined)).toEqual([]);
  });

  it("returns empty array for empty array", () => {
    expect(extractEditSnapshotsFromToolEvents([])).toEqual([]);
  });

  it("extracts a single edit snapshot", () => {
    const events: ToolEventLike[] = [
      makeEvent({
        preview: previewFor("edit", { path: "a.ts", before: "x", after: "y" }),
      }),
    ];
    const out = extractEditSnapshotsFromToolEvents(events);
    expect(out).toHaveLength(1);
    expect(out[0].path).toBe("a.ts");
  });

  it("extracts multiple snapshots in order", () => {
    const events: ToolEventLike[] = [
      makeEvent({
        toolName: "edit_file",
        preview: previewFor("edit", { path: "a.ts", before: "1", after: "2" }),
      }),
      makeEvent({
        toolName: "write_file",
        preview: previewFor("write", { path: "b.ts", before: "", after: "new" }),
      }),
      makeEvent({
        toolName: "multi_edit",
        preview: previewFor("multi_edit", { path: "c.ts", before: "c1", after: "c2" }),
      }),
    ];
    const out = extractEditSnapshotsFromToolEvents(events);
    expect(out).toHaveLength(3);
    expect(out.map((s) => s.path)).toEqual(["a.ts", "b.ts", "c.ts"]);
    expect(out.map((s) => s.kind)).toEqual(["edit", "write", "edit"]);
  });

  it("skips read/grep/list events", () => {
    const events: ToolEventLike[] = [
      makeEvent({
        toolName: "read_file",
        preview: previewFor("read", { path: "a.ts", content: "x", byteLength: 1 }),
      }),
      makeEvent({
        toolName: "grep_search",
        preview: previewFor("grep", { matches: [] }),
      }),
      makeEvent({
        toolName: "edit_file",
        preview: previewFor("edit", { path: "b.ts", before: "x", after: "y" }),
      }),
    ];
    const out = extractEditSnapshotsFromToolEvents(events);
    expect(out).toHaveLength(1);
    expect(out[0].path).toBe("b.ts");
  });

  it("skips events with status !== complete", () => {
    const events: ToolEventLike[] = [
      makeEvent({
        status: "running",
        preview: previewFor("edit", { path: "a.ts", before: "x", after: "y" }),
      }),
      makeEvent({
        status: "error",
        preview: previewFor("error", { error: "NO_MATCH" }),
      }),
      makeEvent({
        status: "complete",
        preview: previewFor("edit", { path: "b.ts", before: "x", after: "y" }),
      }),
    ];
    const out = extractEditSnapshotsFromToolEvents(events);
    expect(out).toHaveLength(1);
    expect(out[0].path).toBe("b.ts");
  });

  it("falls back to args.path when preview path is empty", () => {
    const events: ToolEventLike[] = [
      makeEvent({
        args: { path: "from-args.ts" },
        preview: previewFor("edit", { before: "x", after: "y" }),
      }),
    ];
    const out = extractEditSnapshotsFromToolEvents(events);
    expect(out).toHaveLength(1);
    expect(out[0].path).toBe("from-args.ts");
  });

  it("drops events where neither preview nor args have a path", () => {
    const events: ToolEventLike[] = [
      makeEvent({
        preview: previewFor("edit", { before: "x", after: "y" }),
        args: {},
      }),
    ];
    const out = extractEditSnapshotsFromToolEvents(events);
    expect(out).toHaveLength(0);
  });

  it("silently drops malformed previews", () => {
    const events: ToolEventLike[] = [
      makeEvent({ preview: "{not json}" }),
      makeEvent({
        preview: previewFor("edit", { path: "good.ts", before: "x", after: "y" }),
      }),
    ];
    const out = extractEditSnapshotsFromToolEvents(events);
    expect(out).toHaveLength(1);
    expect(out[0].path).toBe("good.ts");
  });

  it("does not dedupe snapshots to the same path (each edit is a history entry)", () => {
    const events: ToolEventLike[] = [
      makeEvent({
        preview: previewFor("edit", { path: "a.ts", before: "1", after: "2" }),
      }),
      makeEvent({
        preview: previewFor("edit", { path: "a.ts", before: "2", after: "3" }),
      }),
    ];
    const out = extractEditSnapshotsFromToolEvents(events);
    expect(out).toHaveLength(2);
  });
});

// ─── diffKindLabel ────────────────────────────────────────────────

describe("diffKindLabel", () => {
  it("maps write to 'wrote'", () => {
    expect(diffKindLabel("write")).toBe("wrote");
  });
  it("maps edit to 'edited'", () => {
    expect(diffKindLabel("edit")).toBe("edited");
  });
});
