/**
 * Tests for preset workspaces — Pass 260.
 */

import { describe, it, expect } from "vitest";
import {
  createPreset,
  addPreset,
  removePreset,
  updatePreset,
  seedBuiltins,
  captureCurrentAsPreset,
  parsePresets,
  serializePresets,
  BUILT_IN_PRESETS,
  MAX_PRESETS,
  type PresetWorkspace,
} from "./presetWorkspaces";

function makePreset(partial: Partial<PresetWorkspace> = {}): PresetWorkspace {
  return {
    id: partial.id ?? "p1",
    name: partial.name ?? "test",
    description: partial.description,
    modelOverride: partial.modelOverride,
    enabledTools: partial.enabledTools ?? ["read_file"],
    maxIterations: partial.maxIterations ?? 5,
    allowMutations: partial.allowMutations ?? false,
    includeProjectInstructions: partial.includeProjectInstructions !== false,
    createdAt: partial.createdAt ?? 0,
    updatedAt: partial.updatedAt ?? 0,
    builtin: partial.builtin,
  };
}

describe("createPreset", () => {
  it("assigns a stable id", () => {
    const p = createPreset({
      name: "foo",
      enabledTools: ["read_file"],
      maxIterations: 5,
      allowMutations: false,
      includeProjectInstructions: true,
    });
    expect(p.id).toMatch(/^ps-/);
  });

  it("trims name and description", () => {
    const p = createPreset({
      name: "  foo  ",
      description: "  desc  ",
      enabledTools: [],
      maxIterations: 5,
      allowMutations: false,
      includeProjectInstructions: true,
    });
    expect(p.name).toBe("foo");
    expect(p.description).toBe("desc");
  });

  it("clamps maxIterations to 1-50", () => {
    const low = createPreset({
      name: "low",
      enabledTools: [],
      maxIterations: 0,
      allowMutations: false,
      includeProjectInstructions: true,
    });
    const high = createPreset({
      name: "high",
      enabledTools: [],
      maxIterations: 999,
      allowMutations: false,
      includeProjectInstructions: true,
    });
    expect(low.maxIterations).toBe(1);
    expect(high.maxIterations).toBe(50);
  });

  it("clones enabledTools array (no shared mutation)", () => {
    const tools = ["read_file"];
    const p = createPreset({
      name: "x",
      enabledTools: tools,
      maxIterations: 5,
      allowMutations: false,
      includeProjectInstructions: true,
    });
    tools.push("write_file");
    expect(p.enabledTools).toEqual(["read_file"]);
  });
});

describe("addPreset / removePreset / updatePreset", () => {
  it("addPreset prepends and dedupes by name", () => {
    const existing = [makePreset({ id: "a", name: "same" })];
    const added = makePreset({ id: "b", name: "same" });
    const out = addPreset(existing, added);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("b");
  });

  it("addPreset does NOT replace built-ins with same name", () => {
    const existing = [makePreset({ id: "a", name: "Read-only exploration", builtin: true })];
    const added = makePreset({ id: "b", name: "Read-only exploration" });
    const out = addPreset(existing, added);
    expect(out).toHaveLength(2);
  });

  it("caps at MAX_PRESETS", () => {
    let list: PresetWorkspace[] = [];
    for (let i = 0; i < MAX_PRESETS + 5; i++) {
      list = addPreset(list, makePreset({ id: `p${i}`, name: `name${i}` }));
    }
    expect(list.length).toBe(MAX_PRESETS);
  });

  it("removePreset drops user presets", () => {
    const list = [makePreset({ id: "u1" }), makePreset({ id: "b1", builtin: true })];
    const out = removePreset(list, "u1");
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("b1");
  });

  it("removePreset refuses to delete built-ins", () => {
    const list = [makePreset({ id: "b1", builtin: true })];
    const out = removePreset(list, "b1");
    expect(out).toHaveLength(1);
  });

  it("updatePreset patches user presets", () => {
    const list = [makePreset({ id: "u1", name: "old" })];
    const out = updatePreset(list, "u1", { name: "new", maxIterations: 10 });
    expect(out[0].name).toBe("new");
    expect(out[0].maxIterations).toBe(10);
    expect(out[0].updatedAt).toBeGreaterThan(0);
  });

  it("updatePreset refuses to patch built-ins", () => {
    const list = [makePreset({ id: "b1", name: "old", builtin: true })];
    const out = updatePreset(list, "b1", { name: "new" });
    expect(out[0].name).toBe("old");
  });
});

describe("seedBuiltins", () => {
  it("adds all built-ins to empty list", () => {
    const out = seedBuiltins([]);
    expect(out.length).toBe(BUILT_IN_PRESETS.length);
  });

  it("does not duplicate on re-run", () => {
    const once = seedBuiltins([]);
    const twice = seedBuiltins(once);
    expect(twice.length).toBe(BUILT_IN_PRESETS.length);
  });

  it("preserves user presets", () => {
    const mine = [makePreset({ id: "u1", name: "mine" })];
    const out = seedBuiltins(mine);
    expect(out.some((p) => p.name === "mine")).toBe(true);
    expect(out.length).toBe(BUILT_IN_PRESETS.length + 1);
  });
});

describe("captureCurrentAsPreset", () => {
  it("captures runtime config", () => {
    const p = captureCurrentAsPreset("from runtime", "snapshot", {
      enabledTools: ["read_file", "grep_search"],
      maxIterations: 7,
      allowMutations: false,
      includeProjectInstructions: true,
      modelOverride: "claude-sonnet-4-6",
    });
    expect(p.name).toBe("from runtime");
    expect(p.description).toBe("snapshot");
    expect(p.modelOverride).toBe("claude-sonnet-4-6");
    expect(p.enabledTools).toHaveLength(2);
  });
});

describe("parsePresets / serializePresets", () => {
  it("round-trips user presets", () => {
    const list = seedBuiltins([makePreset({ id: "u1", name: "mine" })]);
    const raw = serializePresets(list);
    const out = parsePresets(raw);
    expect(out.some((p) => p.id === "u1")).toBe(true);
    expect(out.length).toBeGreaterThanOrEqual(BUILT_IN_PRESETS.length);
  });

  it("returns built-ins only on null", () => {
    const out = parsePresets(null);
    expect(out.length).toBe(BUILT_IN_PRESETS.length);
  });

  it("returns built-ins only on malformed", () => {
    const out = parsePresets("{oops");
    expect(out.length).toBe(BUILT_IN_PRESETS.length);
  });

  it("drops entries missing required fields", () => {
    const raw = JSON.stringify([
      { id: "a", name: "ok", enabledTools: ["read_file"] },
      { id: "b" }, // missing name + tools
    ]);
    const out = parsePresets(raw);
    expect(out.some((p) => p.id === "a")).toBe(true);
    expect(out.some((p) => p.id === "b")).toBe(false);
  });
});
