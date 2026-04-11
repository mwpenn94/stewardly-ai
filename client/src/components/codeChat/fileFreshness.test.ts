/**
 * Tests for the client-side file freshness store — Pass 255.
 */

import { describe, it, expect } from "vitest";
import {
  emptyTrackedSet,
  recordFile,
  removeTrackedFile,
  applyFreshnessResult,
  buildChecks,
  extractTrackedFromTools,
  parseTrackedSet,
  serializeTrackedSet,
  MAX_TRACKED_FILES,
} from "./fileFreshness";

describe("recordFile", () => {
  it("adds a new entry", () => {
    const out = recordFile(emptyTrackedSet(), "a.ts", 100, "read");
    expect(out.entries).toHaveLength(1);
    expect(out.entries[0].path).toBe("a.ts");
    expect(out.entries[0].lastKnownMtime).toBe(100);
  });

  it("updates mtime for existing entry", () => {
    let set = recordFile(emptyTrackedSet(), "a.ts", 100, "read");
    set = recordFile(set, "a.ts", 200, "edit");
    expect(set.entries).toHaveLength(1);
    expect(set.entries[0].lastKnownMtime).toBe(200);
    expect(set.entries[0].origin).toBe("edit");
  });

  it("preserves prior mtime when new mtime is null", () => {
    let set = recordFile(emptyTrackedSet(), "a.ts", 100, "read");
    set = recordFile(set, "a.ts", null, "read");
    expect(set.entries[0].lastKnownMtime).toBe(100);
  });

  it("caps at MAX_TRACKED_FILES, dropping oldest lastSeenAt", async () => {
    let set = emptyTrackedSet();
    for (let i = 0; i < MAX_TRACKED_FILES + 5; i++) {
      set = recordFile(set, `f${i}.ts`, i, "read");
      await new Promise((r) => setTimeout(r, 1));
    }
    expect(set.entries.length).toBe(MAX_TRACKED_FILES);
    // The newest entries should survive
    const paths = new Set(set.entries.map((e) => e.path));
    expect(paths.has(`f${MAX_TRACKED_FILES + 4}.ts`)).toBe(true);
  });

  it("rejects empty path", () => {
    const out = recordFile(emptyTrackedSet(), "", 100, "read");
    expect(out.entries).toHaveLength(0);
  });
});

describe("removeTrackedFile", () => {
  it("removes matching entry", () => {
    let set = recordFile(emptyTrackedSet(), "a.ts", 100, "read");
    set = recordFile(set, "b.ts", 200, "read");
    const out = removeTrackedFile(set, "a.ts");
    expect(out.entries).toHaveLength(1);
    expect(out.entries[0].path).toBe("b.ts");
  });

  it("is a no-op for missing path", () => {
    const set = recordFile(emptyTrackedSet(), "a.ts", 100, "read");
    const out = removeTrackedFile(set, "z.ts");
    expect(out.entries).toHaveLength(1);
  });
});

describe("applyFreshnessResult", () => {
  it("updates mtime for fresh entries", () => {
    const set = recordFile(emptyTrackedSet(), "a.ts", 100, "read");
    const out = applyFreshnessResult(set, {
      entries: [
        { path: "a.ts", currentMtime: 150, missing: false, stale: false },
      ],
    });
    expect(out.entries[0].lastKnownMtime).toBe(150);
  });

  it("leaves stale entries' mtime alone", () => {
    const set = recordFile(emptyTrackedSet(), "a.ts", 100, "read");
    const out = applyFreshnessResult(set, {
      entries: [
        { path: "a.ts", currentMtime: 500, missing: false, stale: true },
      ],
    });
    expect(out.entries[0].lastKnownMtime).toBe(100);
  });

  it("leaves missing entries alone", () => {
    const set = recordFile(emptyTrackedSet(), "a.ts", 100, "read");
    const out = applyFreshnessResult(set, {
      entries: [
        { path: "a.ts", currentMtime: null, missing: true, stale: true },
      ],
    });
    expect(out.entries[0].lastKnownMtime).toBe(100);
  });

  it("ignores result entries for paths we don't track", () => {
    const set = recordFile(emptyTrackedSet(), "a.ts", 100, "read");
    const out = applyFreshnessResult(set, {
      entries: [
        { path: "z.ts", currentMtime: 200, missing: false, stale: false },
      ],
    });
    expect(out.entries).toHaveLength(1);
    expect(out.entries[0].path).toBe("a.ts");
  });
});

describe("buildChecks", () => {
  it("returns empty for empty set", () => {
    expect(buildChecks(emptyTrackedSet())).toEqual([]);
  });

  it("maps each entry to a check record", () => {
    let set = recordFile(emptyTrackedSet(), "a.ts", 100, "read");
    set = recordFile(set, "b.ts", null, "read");
    const out = buildChecks(set);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ path: "b.ts", expectedMtime: null });
    expect(out[1]).toEqual({ path: "a.ts", expectedMtime: 100 });
  });
});

describe("extractTrackedFromTools", () => {
  it("extracts read_file path", () => {
    const out = extractTrackedFromTools([
      {
        toolName: "read_file",
        preview: JSON.stringify({
          kind: "read",
          result: { path: "src/a.ts", content: "hi" },
        }),
      },
    ]);
    expect(out).toEqual([{ path: "src/a.ts", origin: "read" }]);
  });

  it("extracts edit_file path", () => {
    const out = extractTrackedFromTools([
      {
        toolName: "edit_file",
        preview: JSON.stringify({
          kind: "edit",
          result: { path: "src/a.ts" },
        }),
      },
    ]);
    expect(out).toEqual([{ path: "src/a.ts", origin: "edit" }]);
  });

  it("ignores non-file tools", () => {
    const out = extractTrackedFromTools([
      { toolName: "grep_search", preview: "{}" },
      { toolName: "run_bash", preview: "{}" },
    ]);
    expect(out).toEqual([]);
  });

  it("dedupes by path+origin", () => {
    const preview = JSON.stringify({
      kind: "read",
      result: { path: "src/a.ts" },
    });
    const out = extractTrackedFromTools([
      { toolName: "read_file", preview },
      { toolName: "read_file", preview },
    ]);
    expect(out).toHaveLength(1);
  });

  it("skips malformed preview JSON", () => {
    const out = extractTrackedFromTools([
      { toolName: "read_file", preview: "{oops" },
    ]);
    expect(out).toEqual([]);
  });
});

describe("parseTrackedSet / serializeTrackedSet", () => {
  it("round-trips through JSON", () => {
    const set = recordFile(emptyTrackedSet(), "a.ts", 100, "read");
    const raw = serializeTrackedSet(set);
    const out = parseTrackedSet(raw);
    expect(out.entries).toHaveLength(1);
    expect(out.entries[0].path).toBe("a.ts");
  });

  it("returns empty on null input", () => {
    expect(parseTrackedSet(null).entries).toEqual([]);
  });

  it("returns empty on malformed JSON", () => {
    expect(parseTrackedSet("{oops").entries).toEqual([]);
  });

  it("drops entries with invalid origin", () => {
    const raw = JSON.stringify({
      entries: [
        { path: "a.ts", origin: "bogus" },
        { path: "b.ts", origin: "read" },
      ],
    });
    const out = parseTrackedSet(raw);
    expect(out.entries).toHaveLength(1);
    expect(out.entries[0].path).toBe("b.ts");
  });
});
