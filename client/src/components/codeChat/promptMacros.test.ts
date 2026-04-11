/**
 * Tests for prompt macros — Pass 266.
 */

import { describe, it, expect } from "vitest";
import {
  createMacro,
  addMacro,
  removeMacro,
  updateMacro,
  recordPlay,
  seedBuiltins,
  startRecording,
  appendToRecording,
  stopRecording,
  clearRecording,
  parseMacros,
  serializeMacros,
  BUILT_IN_MACROS,
  MAX_MACROS,
  MAX_STEPS,
  type PromptMacro,
} from "./promptMacros";

function makeMacro(partial: Partial<PromptMacro> = {}): PromptMacro {
  return {
    id: partial.id ?? "m1",
    name: partial.name ?? "test",
    description: partial.description,
    steps: partial.steps ?? ["step one", "step two"],
    createdAt: partial.createdAt ?? 0,
    updatedAt: partial.updatedAt ?? 0,
    lastPlayedAt: partial.lastPlayedAt,
    playCount: partial.playCount ?? 0,
    builtin: partial.builtin,
  };
}

describe("createMacro", () => {
  it("assigns a stable id", () => {
    const m = createMacro({ name: "foo", steps: ["a"] });
    expect(m.id).toMatch(/^macro-/);
  });

  it("trims name + description", () => {
    const m = createMacro({
      name: "  foo  ",
      description: "  desc  ",
      steps: ["a"],
    });
    expect(m.name).toBe("foo");
    expect(m.description).toBe("desc");
  });

  it("trims steps and drops empty strings", () => {
    const m = createMacro({
      name: "x",
      steps: ["  a  ", "", "  b  ", "  "],
    });
    expect(m.steps).toEqual(["a", "b"]);
  });

  it("caps steps at MAX_STEPS", () => {
    const steps = Array.from({ length: MAX_STEPS + 5 }, (_, i) => `step${i}`);
    const m = createMacro({ name: "x", steps });
    expect(m.steps).toHaveLength(MAX_STEPS);
  });
});

describe("addMacro / removeMacro / updateMacro", () => {
  it("addMacro prepends", () => {
    const list = [makeMacro({ id: "a" })];
    const added = makeMacro({ id: "b", name: "other" });
    const out = addMacro(list, added);
    expect(out[0].id).toBe("b");
  });

  it("addMacro dedupes user macros by name", () => {
    const list = [makeMacro({ id: "a", name: "same" })];
    const added = makeMacro({ id: "b", name: "same" });
    const out = addMacro(list, added);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("b");
  });

  it("addMacro does NOT dedupe built-ins", () => {
    const list = [makeMacro({ id: "a", name: "same", builtin: true })];
    const added = makeMacro({ id: "b", name: "same" });
    const out = addMacro(list, added);
    expect(out).toHaveLength(2);
  });

  it("caps at MAX_MACROS", () => {
    let list: PromptMacro[] = [];
    for (let i = 0; i < MAX_MACROS + 5; i++) {
      list = addMacro(list, makeMacro({ id: `m${i}`, name: `n${i}` }));
    }
    expect(list.length).toBe(MAX_MACROS);
  });

  it("removeMacro drops user macros", () => {
    const list = [makeMacro({ id: "u1" })];
    expect(removeMacro(list, "u1")).toHaveLength(0);
  });

  it("removeMacro refuses to delete built-ins", () => {
    const list = [makeMacro({ id: "b1", builtin: true })];
    expect(removeMacro(list, "b1")).toHaveLength(1);
  });

  it("updateMacro patches user macros", () => {
    const list = [makeMacro({ id: "u1", name: "old" })];
    const out = updateMacro(list, "u1", { name: "new" });
    expect(out[0].name).toBe("new");
    expect(out[0].updatedAt).toBeGreaterThan(0);
  });

  it("updateMacro refuses to patch built-ins", () => {
    const list = [makeMacro({ id: "b1", name: "old", builtin: true })];
    const out = updateMacro(list, "b1", { name: "new" });
    expect(out[0].name).toBe("old");
  });

  it("updateMacro caps patched steps at MAX_STEPS", () => {
    const list = [makeMacro({ id: "u1" })];
    const newSteps = Array.from({ length: MAX_STEPS + 5 }, (_, i) => `s${i}`);
    const out = updateMacro(list, "u1", { steps: newSteps });
    expect(out[0].steps).toHaveLength(MAX_STEPS);
  });
});

describe("recordPlay", () => {
  it("increments playCount and sets lastPlayedAt", () => {
    const list = [makeMacro({ id: "m1" })];
    const out = recordPlay(list, "m1");
    expect(out[0].playCount).toBe(1);
    expect(out[0].lastPlayedAt).toBeGreaterThan(0);
  });

  it("ignores missing id", () => {
    const list = [makeMacro({ id: "m1" })];
    const out = recordPlay(list, "missing");
    expect(out[0].playCount).toBe(0);
  });
});

describe("seedBuiltins", () => {
  it("adds built-ins to empty list", () => {
    expect(seedBuiltins([]).length).toBe(BUILT_IN_MACROS.length);
  });

  it("no duplicates on re-run", () => {
    const once = seedBuiltins([]);
    const twice = seedBuiltins(once);
    expect(twice.length).toBe(BUILT_IN_MACROS.length);
  });

  it("preserves user macros", () => {
    const mine = [makeMacro({ id: "u1", name: "mine" })];
    const out = seedBuiltins(mine);
    expect(out.some((m) => m.name === "mine")).toBe(true);
  });
});

describe("recording session", () => {
  it("startRecording returns active empty", () => {
    const s = startRecording();
    expect(s.active).toBe(true);
    expect(s.steps).toEqual([]);
  });

  it("appendToRecording adds steps", () => {
    let s = startRecording();
    s = appendToRecording(s, "step one");
    s = appendToRecording(s, "step two");
    expect(s.steps).toEqual(["step one", "step two"]);
  });

  it("trims steps before adding", () => {
    let s = startRecording();
    s = appendToRecording(s, "  trimmed  ");
    expect(s.steps[0]).toBe("trimmed");
  });

  it("ignores empty prompts", () => {
    let s = startRecording();
    s = appendToRecording(s, "");
    s = appendToRecording(s, "  ");
    expect(s.steps).toEqual([]);
  });

  it("does nothing when recording is inactive", () => {
    const s = { active: false, steps: [] };
    const out = appendToRecording(s, "x");
    expect(out.steps).toEqual([]);
  });

  it("caps at MAX_STEPS", () => {
    let s = startRecording();
    for (let i = 0; i < MAX_STEPS + 5; i++) {
      s = appendToRecording(s, `step${i}`);
    }
    expect(s.steps.length).toBe(MAX_STEPS);
  });

  it("stopRecording flips active", () => {
    const s = stopRecording(startRecording());
    expect(s.active).toBe(false);
  });

  it("clearRecording resets", () => {
    expect(clearRecording()).toEqual({ active: false, steps: [] });
  });
});

describe("parseMacros / serializeMacros", () => {
  it("round-trips user macros", () => {
    const list = seedBuiltins([
      makeMacro({ id: "u1", name: "mine", steps: ["a", "b"] }),
    ]);
    const out = parseMacros(serializeMacros(list));
    expect(out.some((m) => m.id === "u1")).toBe(true);
  });

  it("returns built-ins only on null", () => {
    expect(parseMacros(null).length).toBe(BUILT_IN_MACROS.length);
  });

  it("returns built-ins only on malformed", () => {
    expect(parseMacros("{oops").length).toBe(BUILT_IN_MACROS.length);
  });

  it("drops entries missing required fields", () => {
    const raw = JSON.stringify([{ id: "a", name: "ok", steps: ["x"] }, { id: "b" }]);
    const out = parseMacros(raw);
    expect(out.some((m) => m.id === "a")).toBe(true);
    expect(out.some((m) => m.id === "b")).toBe(false);
  });
});
