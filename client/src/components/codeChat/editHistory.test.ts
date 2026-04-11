/**
 * Tests for editHistory.ts (Pass 239).
 */

import { describe, it, expect } from "vitest";
import {
  emptyHistory,
  recordEdit,
  undo,
  redo,
  canUndo,
  canRedo,
  dropEntry,
  clearHistory,
  summarizeHistory,
  serializeHistory,
  parseHistory,
  MAX_ENTRIES,
  type EditHistoryState,
} from "./editHistory";

const mkEntry = (overrides: Partial<{ path: string; before: string; after: string; origin: "agent" | "manual"; kind: "write" | "edit" }> = {}) => ({
  path: overrides.path ?? "a.ts",
  before: overrides.before ?? "old",
  after: overrides.after ?? "new",
  origin: overrides.origin ?? ("agent" as const),
  kind: overrides.kind ?? ("edit" as const),
});

describe("emptyHistory", () => {
  it("has zero entries and cursor -1", () => {
    const state = emptyHistory();
    expect(state.entries).toEqual([]);
    expect(state.cursor).toBe(-1);
  });
});

describe("recordEdit", () => {
  it("appends an entry and moves cursor to the end", () => {
    const state = recordEdit(emptyHistory(), mkEntry());
    expect(state.entries).toHaveLength(1);
    expect(state.cursor).toBe(0);
  });

  it("ignores no-op edits where before === after", () => {
    const state = recordEdit(emptyHistory(), mkEntry({ before: "x", after: "x" }));
    expect(state.entries).toHaveLength(0);
  });

  it("auto-generates id and timestamp", () => {
    const state = recordEdit(emptyHistory(), mkEntry());
    expect(state.entries[0].id).toMatch(/^edit-/);
    expect(state.entries[0].timestamp).toBeTypeOf("number");
  });

  it("caps at MAX_ENTRIES and drops oldest", () => {
    let state = emptyHistory();
    for (let i = 0; i < MAX_ENTRIES + 10; i++) {
      state = recordEdit(state, mkEntry({ before: `v${i}`, after: `v${i + 1}` }));
    }
    expect(state.entries).toHaveLength(MAX_ENTRIES);
    expect(state.entries[0].before).toBe("v10"); // oldest 10 dropped
  });

  it("drops forward history when recording after an undo", () => {
    let state = emptyHistory();
    state = recordEdit(state, mkEntry({ before: "a", after: "b" }));
    state = recordEdit(state, mkEntry({ before: "b", after: "c" }));
    state = recordEdit(state, mkEntry({ before: "c", after: "d" }));
    const u = undo(state)!;
    state = u.state;
    expect(canRedo(state)).toBe(true);
    // Recording a new edit should discard the forward history
    state = recordEdit(state, mkEntry({ before: "c", after: "e" }));
    expect(canRedo(state)).toBe(false);
    expect(state.entries).toHaveLength(3);
    expect(state.entries[2].after).toBe("e");
  });
});

describe("undo / redo", () => {
  const setupThree = (): EditHistoryState => {
    let s = emptyHistory();
    s = recordEdit(s, mkEntry({ before: "a", after: "b" }));
    s = recordEdit(s, mkEntry({ before: "b", after: "c" }));
    s = recordEdit(s, mkEntry({ before: "c", after: "d" }));
    return s;
  };

  it("undo returns the current-cursor entry and decrements cursor", () => {
    const state = setupThree();
    const result = undo(state)!;
    expect(result.entry.after).toBe("d");
    expect(result.state.cursor).toBe(1);
  });

  it("undo returns null at the start", () => {
    expect(undo(emptyHistory())).toBeNull();
  });

  it("redo returns the next entry and increments cursor", () => {
    let state = setupThree();
    state = undo(state)!.state;
    state = undo(state)!.state;
    const r = redo(state)!;
    expect(r.entry.after).toBe("c");
    expect(r.state.cursor).toBe(1);
  });

  it("redo returns null at the tip", () => {
    const state = setupThree();
    expect(redo(state)).toBeNull();
  });

  it("canUndo/canRedo track the cursor", () => {
    let state = setupThree();
    expect(canUndo(state)).toBe(true);
    expect(canRedo(state)).toBe(false);
    state = undo(state)!.state;
    expect(canRedo(state)).toBe(true);
    state = undo(state)!.state;
    state = undo(state)!.state;
    expect(canUndo(state)).toBe(false);
  });

  it("undo all then redo all round-trips the cursor", () => {
    let state = setupThree();
    state = undo(state)!.state;
    state = undo(state)!.state;
    state = undo(state)!.state;
    expect(state.cursor).toBe(-1);
    expect(canUndo(state)).toBe(false);
    state = redo(state)!.state;
    state = redo(state)!.state;
    state = redo(state)!.state;
    expect(state.cursor).toBe(2);
    expect(canRedo(state)).toBe(false);
  });
});

describe("dropEntry", () => {
  it("removes the matching entry and shifts cursor", () => {
    let state = emptyHistory();
    state = recordEdit(state, mkEntry({ before: "a", after: "b" }));
    state = recordEdit(state, mkEntry({ before: "b", after: "c" }));
    const targetId = state.entries[0].id;
    state = dropEntry(state, targetId);
    expect(state.entries).toHaveLength(1);
    expect(state.cursor).toBe(0);
  });

  it("is a no-op for unknown id", () => {
    const state = recordEdit(emptyHistory(), mkEntry());
    const next = dropEntry(state, "missing");
    expect(next).toBe(state);
  });

  it("resets cursor to -1 when list becomes empty", () => {
    let state = recordEdit(emptyHistory(), mkEntry());
    state = dropEntry(state, state.entries[0].id);
    expect(state.cursor).toBe(-1);
    expect(state.entries).toHaveLength(0);
  });
});

describe("clearHistory", () => {
  it("returns empty state", () => {
    let state = emptyHistory();
    state = recordEdit(state, mkEntry());
    state = clearHistory();
    expect(state.entries).toEqual([]);
    expect(state.cursor).toBe(-1);
  });
});

describe("summarizeHistory", () => {
  it("counts total, undoCount, redoCount, and byPath", () => {
    let state = emptyHistory();
    state = recordEdit(state, mkEntry({ path: "a.ts", before: "1", after: "2" }));
    state = recordEdit(state, mkEntry({ path: "a.ts", before: "2", after: "3" }));
    state = recordEdit(state, mkEntry({ path: "b.ts", before: "x", after: "y" }));
    state = undo(state)!.state;
    const s = summarizeHistory(state);
    expect(s.total).toBe(3);
    expect(s.undoCount).toBe(2);
    expect(s.redoCount).toBe(1);
    expect(s.byPath.get("a.ts")).toBe(2);
    expect(s.byPath.get("b.ts")).toBe(1);
    expect(s.canUndo).toBe(true);
    expect(s.canRedo).toBe(true);
  });
});

describe("serialize / parse round-trip", () => {
  it("survives a JSON round-trip", () => {
    let state = emptyHistory();
    state = recordEdit(state, mkEntry({ before: "a", after: "b" }));
    state = recordEdit(state, mkEntry({ before: "b", after: "c" }));
    state = undo(state)!.state;
    const raw = serializeHistory(state);
    const restored = parseHistory(raw);
    expect(restored.entries).toHaveLength(2);
    expect(restored.cursor).toBe(0);
  });

  it("returns empty on null input", () => {
    expect(parseHistory(null)).toEqual(emptyHistory());
  });

  it("returns empty on malformed JSON", () => {
    expect(parseHistory("{{{")).toEqual(emptyHistory());
  });

  it("filters out malformed entries", () => {
    const raw = JSON.stringify({
      entries: [
        { id: "a", path: "x", before: "1", after: "2", origin: "agent", kind: "edit", timestamp: 1 },
        { id: "b", path: "x", before: 1 }, // bad: before not string
        { id: "c", path: "x", before: "1", after: "2", origin: "bad", kind: "edit", timestamp: 1 }, // bad origin
      ],
      cursor: 0,
    });
    const restored = parseHistory(raw);
    expect(restored.entries).toHaveLength(1);
    expect(restored.entries[0].id).toBe("a");
  });

  it("clamps cursor to valid range", () => {
    const raw = JSON.stringify({
      entries: [
        { id: "a", path: "x", before: "1", after: "2", origin: "agent", kind: "edit", timestamp: 1 },
      ],
      cursor: 99, // out of range
    });
    const restored = parseHistory(raw);
    expect(restored.cursor).toBe(0);
  });
});
