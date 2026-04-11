/**
 * Tests for tool argument templates — Pass 270.
 */

import { describe, it, expect } from "vitest";
import {
  extractVariables,
  applyVariables,
  createTemplate,
  addTemplate,
  removeTemplate,
  updateTemplate,
  seedBuiltins,
  filterTemplates,
  parseTemplates,
  serializeTemplates,
  BUILT_IN_TOOL_TEMPLATES,
  MAX_TOOL_TEMPLATES,
  type ToolTemplate,
} from "./toolTemplates";

function makeTemplate(partial: Partial<ToolTemplate> = {}): ToolTemplate {
  return {
    id: partial.id ?? "t1",
    name: partial.name ?? "test",
    description: partial.description ?? "",
    tool: partial.tool ?? "read_file",
    args: partial.args ?? { path: "a.ts" },
    variables: partial.variables ?? [],
    builtin: partial.builtin,
  };
}

describe("extractVariables", () => {
  it("returns empty when no placeholders", () => {
    expect(extractVariables({ path: "a.ts" })).toEqual([]);
  });

  it("extracts simple placeholders", () => {
    expect(extractVariables({ path: "{{file}}" })).toEqual(["file"]);
  });

  it("extracts across multiple args", () => {
    const out = extractVariables({
      pattern: "{{pattern}}",
      path: "{{dir}}",
    });
    expect(out).toContain("pattern");
    expect(out).toContain("dir");
  });

  it("dedupes repeated variables", () => {
    const out = extractVariables({
      a: "{{name}} and {{name}}",
      b: "{{name}}",
    });
    expect(out).toEqual(["name"]);
  });

  it("tolerates whitespace inside braces", () => {
    expect(extractVariables({ a: "{{ foo }}" })).toEqual(["foo"]);
  });
});

describe("applyVariables", () => {
  it("substitutes known values", () => {
    const out = applyVariables(
      { path: "{{file}}" },
      { file: "a.ts" },
    );
    expect(out.path).toBe("a.ts");
  });

  it("leaves unknown variables in place", () => {
    const out = applyVariables(
      { path: "{{file}}" },
      {},
    );
    expect(out.path).toBe("{{file}}");
  });

  it("handles multiple placeholders in one value", () => {
    const out = applyVariables(
      { cmd: "cp {{from}} {{to}}" },
      { from: "a.ts", to: "b.ts" },
    );
    expect(out.cmd).toBe("cp a.ts b.ts");
  });
});

describe("createTemplate", () => {
  it("assigns stable id", () => {
    const t = createTemplate({
      name: "x",
      description: "y",
      tool: "read_file",
      args: { path: "a.ts" },
    });
    expect(t.id).toMatch(/^tt-/);
  });

  it("auto-extracts variables", () => {
    const t = createTemplate({
      name: "x",
      description: "y",
      tool: "read_file",
      args: { path: "{{file}}" },
    });
    expect(t.variables).toEqual(["file"]);
  });
});

describe("addTemplate / removeTemplate / updateTemplate", () => {
  it("prepends new entries", () => {
    const list = [makeTemplate({ id: "a", name: "A" })];
    const out = addTemplate(list, makeTemplate({ id: "b", name: "B" }));
    expect(out[0].id).toBe("b");
  });

  it("dedupes user templates by name", () => {
    const list = [makeTemplate({ id: "a", name: "same" })];
    const out = addTemplate(list, makeTemplate({ id: "b", name: "same" }));
    expect(out).toHaveLength(1);
  });

  it("does not dedupe against built-ins", () => {
    const list = [makeTemplate({ id: "a", name: "same", builtin: true })];
    const out = addTemplate(list, makeTemplate({ id: "b", name: "same" }));
    expect(out).toHaveLength(2);
  });

  it("caps at MAX_TOOL_TEMPLATES", () => {
    let list: ToolTemplate[] = [];
    for (let i = 0; i < MAX_TOOL_TEMPLATES + 5; i++) {
      list = addTemplate(list, makeTemplate({ id: `t${i}`, name: `n${i}` }));
    }
    expect(list.length).toBe(MAX_TOOL_TEMPLATES);
  });

  it("removeTemplate drops user entries", () => {
    const list = [makeTemplate({ id: "u1" })];
    expect(removeTemplate(list, "u1")).toHaveLength(0);
  });

  it("removeTemplate refuses to delete built-ins", () => {
    const list = [makeTemplate({ id: "b1", builtin: true })];
    expect(removeTemplate(list, "b1")).toHaveLength(1);
  });

  it("updateTemplate re-extracts variables on args change", () => {
    const list = [makeTemplate({ id: "u1", args: { path: "a.ts" } })];
    const out = updateTemplate(list, "u1", { args: { path: "{{file}}" } });
    expect(out[0].variables).toEqual(["file"]);
  });

  it("updateTemplate refuses to patch built-ins", () => {
    const list = [makeTemplate({ id: "b1", name: "old", builtin: true })];
    const out = updateTemplate(list, "b1", { name: "new" });
    expect(out[0].name).toBe("old");
  });
});

describe("seedBuiltins", () => {
  it("adds all built-ins to empty list", () => {
    expect(seedBuiltins([]).length).toBe(BUILT_IN_TOOL_TEMPLATES.length);
  });

  it("no duplicates on re-run", () => {
    const once = seedBuiltins([]);
    expect(seedBuiltins(once).length).toBe(BUILT_IN_TOOL_TEMPLATES.length);
  });
});

describe("filterTemplates", () => {
  const sample = [
    makeTemplate({ id: "a", name: "Read README", tool: "read_file" }),
    makeTemplate({ id: "b", name: "Grep TODO", tool: "grep_search" }),
    makeTemplate({ id: "c", name: "Run vitest", tool: "run_bash" }),
  ];

  it("filters by tool", () => {
    expect(filterTemplates(sample, { tool: "read_file" })).toHaveLength(1);
    expect(filterTemplates(sample, { tool: "all" })).toHaveLength(3);
  });

  it("filters by search", () => {
    expect(filterTemplates(sample, { search: "grep" })).toHaveLength(1);
    expect(filterTemplates(sample, { search: "README" })).toHaveLength(1);
  });

  it("composes tool + search", () => {
    const out = filterTemplates(sample, { tool: "run_bash", search: "vitest" });
    expect(out).toHaveLength(1);
  });
});

describe("parseTemplates / serializeTemplates", () => {
  it("round-trips user templates", () => {
    const list = seedBuiltins([
      makeTemplate({ id: "u1", name: "mine", args: { path: "a.ts" } }),
    ]);
    const out = parseTemplates(serializeTemplates(list));
    expect(out.some((t) => t.id === "u1")).toBe(true);
  });

  it("returns built-ins only on null", () => {
    expect(parseTemplates(null).length).toBe(BUILT_IN_TOOL_TEMPLATES.length);
  });

  it("returns built-ins only on malformed", () => {
    expect(parseTemplates("{oops").length).toBe(BUILT_IN_TOOL_TEMPLATES.length);
  });

  it("drops entries with invalid tool", () => {
    const raw = JSON.stringify([
      {
        id: "a",
        name: "bad",
        description: "",
        tool: "bogus",
        args: {},
      },
    ]);
    const out = parseTemplates(raw);
    expect(out.some((t) => t.id === "a")).toBe(false);
  });

  it("drops non-string arg values", () => {
    const raw = JSON.stringify([
      {
        id: "a",
        name: "ok",
        description: "",
        tool: "read_file",
        args: { path: "a.ts", weird: 42 },
      },
    ]);
    const out = parseTemplates(raw);
    const found = out.find((t) => t.id === "a");
    expect(found?.args.path).toBe("a.ts");
    expect(found?.args.weird).toBeUndefined();
  });
});
