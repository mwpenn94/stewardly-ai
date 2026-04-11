/**
 * Tests for the checkpoint store — Pass 253.
 */

import { describe, it, expect } from "vitest";
import {
  autoCheckpointName,
  deriveStats,
  createCheckpoint,
  addCheckpoint,
  removeCheckpoint,
  renameCheckpoint,
  findCheckpoint,
  parseCheckpoints,
  serializeCheckpoints,
  diffStats,
  formatAge,
  MAX_CHECKPOINTS,
  type Checkpoint,
  type CheckpointPayload,
} from "./checkpoints";

function emptyPayload(): CheckpointPayload {
  return {
    messages: [],
    editHistory: { entries: [], cursor: 0 },
    runConfig: {},
  };
}

describe("autoCheckpointName", () => {
  it("uses the first user message", () => {
    const name = autoCheckpointName([
      { role: "user", content: "Refactor the auth module" },
    ]);
    expect(name).toBe("Refactor the auth module");
  });

  it("truncates long messages at 80 chars", () => {
    const name = autoCheckpointName([
      { role: "user", content: "x".repeat(200) },
    ]);
    expect(name.length).toBe(80);
  });

  it("uses only the first line", () => {
    const name = autoCheckpointName([
      { role: "user", content: "first line\nsecond line" },
    ]);
    expect(name).toBe("first line");
  });

  it("skips assistant messages", () => {
    const name = autoCheckpointName([
      { role: "assistant", content: "hi" },
      { role: "user", content: "do thing" },
    ]);
    expect(name).toBe("do thing");
  });

  it("falls back to timestamp label when no user message", () => {
    const name = autoCheckpointName([
      { role: "assistant", content: "hi" },
    ]);
    expect(name).toMatch(/^Checkpoint /);
  });

  it("falls back for empty message list", () => {
    expect(autoCheckpointName([])).toMatch(/^Checkpoint /);
  });
});

describe("deriveStats", () => {
  it("counts messages, tool events, edits", () => {
    const stats = deriveStats(
      [
        { role: "user" },
        { role: "assistant", toolEvents: [{}, {}] },
        { role: "user" },
        { role: "assistant", toolEvents: [{}] },
      ],
      { entries: [{}, {}, {}], cursor: 3 },
    );
    expect(stats.messageCount).toBe(4);
    expect(stats.toolCallCount).toBe(3);
    expect(stats.editCount).toBe(3);
    expect(stats.hasUnappliedEdits).toBe(false);
  });

  it("flags unapplied edits when cursor < entries", () => {
    const stats = deriveStats([], { entries: [{}, {}], cursor: 1 });
    expect(stats.hasUnappliedEdits).toBe(true);
  });

  it("handles undefined edit history", () => {
    const stats = deriveStats([], undefined);
    expect(stats.editCount).toBe(0);
    expect(stats.hasUnappliedEdits).toBe(false);
  });
});

describe("createCheckpoint", () => {
  it("uses provided name when set", () => {
    const cp = createCheckpoint("my state", emptyPayload());
    expect(cp.meta.name).toBe("my state");
  });

  it("auto-names from messages when name is null or empty", () => {
    const cp = createCheckpoint(null, {
      ...emptyPayload(),
      messages: [{ role: "user", content: "fix the bug" }],
    });
    expect(cp.meta.name).toBe("fix the bug");
  });

  it("trims whitespace from provided name", () => {
    const cp = createCheckpoint("  padded  ", emptyPayload());
    expect(cp.meta.name).toBe("padded");
  });

  it("sets note when provided", () => {
    const cp = createCheckpoint("n", emptyPayload(), "a reason");
    expect(cp.meta.note).toBe("a reason");
  });

  it("omits note when empty string", () => {
    const cp = createCheckpoint("n", emptyPayload(), "  ");
    expect(cp.meta.note).toBeUndefined();
  });

  it("assigns a stable-ish id", () => {
    const cp = createCheckpoint("x", emptyPayload());
    expect(cp.meta.id).toMatch(/^cp-/);
  });

  it("captures stats", () => {
    const cp = createCheckpoint("x", {
      ...emptyPayload(),
      messages: [{ role: "user" }, { role: "assistant", toolEvents: [{}] }],
    });
    expect(cp.meta.stats.messageCount).toBe(2);
    expect(cp.meta.stats.toolCallCount).toBe(1);
  });
});

describe("addCheckpoint / removeCheckpoint / renameCheckpoint", () => {
  it("addCheckpoint prepends newest first", () => {
    const a = createCheckpoint("a", emptyPayload());
    const b = createCheckpoint("b", emptyPayload());
    const list = addCheckpoint(addCheckpoint([], a), b);
    expect(list[0].meta.name).toBe("b");
    expect(list[1].meta.name).toBe("a");
  });

  it("caps at MAX_CHECKPOINTS and drops oldest", () => {
    let list: Checkpoint[] = [];
    for (let i = 0; i < MAX_CHECKPOINTS + 5; i++) {
      list = addCheckpoint(list, createCheckpoint(`cp${i}`, emptyPayload()));
    }
    expect(list.length).toBe(MAX_CHECKPOINTS);
    // Newest is first
    expect(list[0].meta.name).toBe(`cp${MAX_CHECKPOINTS + 4}`);
  });

  it("removeCheckpoint drops matching id", () => {
    const a = createCheckpoint("a", emptyPayload());
    const b = createCheckpoint("b", emptyPayload());
    const list = addCheckpoint(addCheckpoint([], a), b);
    const out = removeCheckpoint(list, a.meta.id);
    expect(out).toHaveLength(1);
    expect(out[0].meta.id).toBe(b.meta.id);
  });

  it("renameCheckpoint updates name + note", () => {
    const a = createCheckpoint("a", emptyPayload());
    const list = addCheckpoint([], a);
    const out = renameCheckpoint(list, a.meta.id, "A renamed", "new note");
    expect(out[0].meta.name).toBe("A renamed");
    expect(out[0].meta.note).toBe("new note");
  });

  it("renameCheckpoint ignores blank name", () => {
    const a = createCheckpoint("a", emptyPayload());
    const list = addCheckpoint([], a);
    const out = renameCheckpoint(list, a.meta.id, "  ", "x");
    expect(out[0].meta.name).toBe("a");
  });

  it("findCheckpoint returns null for missing id", () => {
    expect(findCheckpoint([], "missing")).toBeNull();
  });
});

describe("parseCheckpoints / serializeCheckpoints", () => {
  it("round-trips through JSON", () => {
    const a = createCheckpoint("a", {
      ...emptyPayload(),
      messages: [{ role: "user", content: "x" }],
    });
    const raw = serializeCheckpoints([a]);
    const out = parseCheckpoints(raw);
    expect(out).toHaveLength(1);
    expect(out[0].meta.id).toBe(a.meta.id);
    expect(out[0].payload.messages).toEqual([{ role: "user", content: "x" }]);
  });

  it("returns empty array for null", () => {
    expect(parseCheckpoints(null)).toEqual([]);
  });

  it("returns empty array for malformed JSON", () => {
    expect(parseCheckpoints("{oops")).toEqual([]);
  });

  it("drops entries with missing metadata", () => {
    const raw = JSON.stringify([
      { meta: { id: "x" }, payload: {} }, // missing name
      { meta: { id: "y", name: "ok", createdAt: 1 }, payload: {} },
    ]);
    const out = parseCheckpoints(raw);
    expect(out).toHaveLength(1);
    expect(out[0].meta.id).toBe("y");
  });

  it("fills default stats when missing", () => {
    const raw = JSON.stringify([
      { meta: { id: "x", name: "n", createdAt: 1 }, payload: {} },
    ]);
    const out = parseCheckpoints(raw);
    expect(out[0].meta.stats.messageCount).toBe(0);
  });

  it("caps at MAX_CHECKPOINTS on load", () => {
    const list: Checkpoint[] = [];
    for (let i = 0; i < MAX_CHECKPOINTS + 10; i++) {
      list.push(createCheckpoint(`cp${i}`, emptyPayload()));
    }
    const raw = serializeCheckpoints(list);
    const out = parseCheckpoints(raw);
    expect(out.length).toBe(MAX_CHECKPOINTS);
  });
});

describe("diffStats", () => {
  const base = {
    messageCount: 5,
    editCount: 3,
    toolCallCount: 10,
    hasUnappliedEdits: false,
  };

  it("detects messages added", () => {
    const diff = diffStats({ ...base, messageCount: 8 }, base);
    expect(diff.messagesAdded).toBe(3);
    expect(diff.messagesRemoved).toBe(0);
  });

  it("detects messages removed", () => {
    const diff = diffStats({ ...base, messageCount: 2 }, base);
    expect(diff.messagesAdded).toBe(0);
    expect(diff.messagesRemoved).toBe(3);
  });

  it("computes positive and negative deltas", () => {
    const diff = diffStats(
      { ...base, toolCallCount: 20, editCount: 1 },
      base,
    );
    expect(diff.toolCallsDelta).toBe(10);
    expect(diff.editsDelta).toBe(-2);
  });
});

describe("formatAge", () => {
  it("returns 'just now' for recent", () => {
    const now = Date.now();
    expect(formatAge(now - 1000, now)).toBe("just now");
  });

  it("returns minutes", () => {
    const now = Date.now();
    expect(formatAge(now - 5 * 60_000, now)).toBe("5m ago");
  });

  it("returns hours", () => {
    const now = Date.now();
    expect(formatAge(now - 2 * 3600_000, now)).toBe("2h ago");
  });

  it("returns days up to 7", () => {
    const now = Date.now();
    expect(formatAge(now - 3 * 86_400_000, now)).toBe("3d ago");
  });

  it("returns absolute date after 7 days", () => {
    const now = Date.now();
    const age = formatAge(now - 10 * 86_400_000, now);
    expect(age).not.toContain("ago");
  });
});
