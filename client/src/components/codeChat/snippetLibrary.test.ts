/**
 * Tests for the code snippet library — Pass 254.
 */

import { describe, it, expect } from "vitest";
import {
  normalizeTag,
  sanitizeTags,
  clampBody,
  createSnippet,
  addSnippet,
  removeSnippet,
  updateSnippet,
  seedBuiltins,
  filterSnippets,
  sortForDisplay,
  allLanguages,
  allTags,
  parseSnippets,
  serializeSnippets,
  exportSnippets,
  parseSnippetExport,
  BUILT_IN_SNIPPETS,
  MAX_BODY_BYTES,
  MAX_SNIPPETS,
  type CodeSnippet,
} from "./snippetLibrary";

function makeSnippet(partial: Partial<CodeSnippet> = {}): CodeSnippet {
  return {
    id: partial.id ?? "x",
    name: partial.name ?? "test",
    language: partial.language ?? "ts",
    body: partial.body ?? "const x = 1;",
    tags: partial.tags ?? [],
    createdAt: partial.createdAt ?? 0,
    updatedAt: partial.updatedAt ?? 0,
    builtin: partial.builtin,
  };
}

describe("normalizeTag", () => {
  it("lowercases and trims", () => {
    expect(normalizeTag("  React ")).toBe("react");
  });

  it("strips leading hash", () => {
    expect(normalizeTag("#typescript")).toBe("typescript");
  });

  it("collapses whitespace to dash", () => {
    expect(normalizeTag("unit test")).toBe("unit-test");
  });
});

describe("sanitizeTags", () => {
  it("dedupes", () => {
    expect(sanitizeTags(["a", "A", "a"])).toEqual(["a"]);
  });

  it("drops empties", () => {
    expect(sanitizeTags(["", "  ", "a"])).toEqual(["a"]);
  });

  it("caps at 20", () => {
    const tags = Array.from({ length: 30 }, (_, i) => `t${i}`);
    expect(sanitizeTags(tags)).toHaveLength(20);
  });
});

describe("clampBody", () => {
  it("returns unchanged when under the cap", () => {
    expect(clampBody("abc")).toBe("abc");
  });

  it("adds truncation marker when over", () => {
    const long = "x".repeat(MAX_BODY_BYTES + 100);
    const out = clampBody(long);
    expect(out.length).toBeLessThanOrEqual(MAX_BODY_BYTES + 50);
    expect(out).toContain("(truncated)");
  });
});

describe("createSnippet", () => {
  it("assigns a stable-ish id", () => {
    const s = createSnippet({
      name: "foo",
      language: "ts",
      body: "1",
      tags: [],
    });
    expect(s.id).toMatch(/^snip-/);
  });

  it("sanitizes tags", () => {
    const s = createSnippet({
      name: "foo",
      language: "ts",
      body: "1",
      tags: [" React ", "REACT"],
    });
    expect(s.tags).toEqual(["react"]);
  });

  it("clamps body", () => {
    const s = createSnippet({
      name: "foo",
      language: "ts",
      body: "x".repeat(MAX_BODY_BYTES + 50),
      tags: [],
    });
    expect(s.body).toContain("(truncated)");
  });

  it("defaults language to 'text' when empty", () => {
    const s = createSnippet({
      name: "foo",
      language: "",
      body: "1",
      tags: [],
    });
    expect(s.language).toBe("text");
  });
});

describe("addSnippet / removeSnippet / updateSnippet", () => {
  it("addSnippet appends user snippets", () => {
    const initial = [makeSnippet({ id: "a", name: "existing", builtin: true })];
    const added = makeSnippet({ id: "b", name: "new-user-snippet" });
    const out = addSnippet(initial, added);
    expect(out).toHaveLength(2);
    expect(out[1].id).toBe("b");
  });

  it("addSnippet shadows a built-in by name", () => {
    const initial = [
      makeSnippet({
        id: "builtin-x",
        name: "React component stub",
        builtin: true,
      }),
    ];
    const added = makeSnippet({ id: "u1", name: "React component stub" });
    const out = addSnippet(initial, added);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("u1");
  });

  it("removeSnippet drops user snippets", () => {
    const initial = [
      makeSnippet({ id: "builtin-x", builtin: true }),
      makeSnippet({ id: "u1" }),
    ];
    const out = removeSnippet(initial, "u1");
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("builtin-x");
  });

  it("removeSnippet refuses to delete built-ins", () => {
    const initial = [makeSnippet({ id: "builtin-x", builtin: true })];
    const out = removeSnippet(initial, "builtin-x");
    expect(out).toHaveLength(1);
  });

  it("updateSnippet patches user snippets", () => {
    const initial = [makeSnippet({ id: "u1", name: "old", body: "a" })];
    const out = updateSnippet(initial, "u1", { name: "new", body: "b" });
    expect(out[0].name).toBe("new");
    expect(out[0].body).toBe("b");
    expect(out[0].updatedAt).toBeGreaterThan(0);
  });

  it("updateSnippet refuses to patch built-ins", () => {
    const initial = [
      makeSnippet({ id: "bx", name: "old", builtin: true }),
    ];
    const out = updateSnippet(initial, "bx", { name: "new" });
    expect(out[0].name).toBe("old");
  });
});

describe("seedBuiltins", () => {
  it("adds all built-ins to empty list", () => {
    const out = seedBuiltins([]);
    expect(out.length).toBe(BUILT_IN_SNIPPETS.length);
  });

  it("no duplicates on re-run", () => {
    const once = seedBuiltins([]);
    const twice = seedBuiltins(once);
    expect(twice.length).toBe(BUILT_IN_SNIPPETS.length);
  });

  it("preserves user snippets", () => {
    const mine = [makeSnippet({ id: "u1", name: "mine" })];
    const out = seedBuiltins(mine);
    expect(out.some((s) => s.id === "u1")).toBe(true);
    expect(out.length).toBe(BUILT_IN_SNIPPETS.length + 1);
  });
});

describe("filterSnippets", () => {
  const sample: CodeSnippet[] = [
    makeSnippet({ id: "a", name: "React thing", language: "tsx", tags: ["react"] }),
    makeSnippet({ id: "b", name: "Zod thing", language: "ts", tags: ["zod", "validation"] }),
    makeSnippet({ id: "c", name: "Test thing", language: "ts", tags: ["test"] }),
  ];

  it("filters by language", () => {
    expect(filterSnippets(sample, { language: "tsx" })).toHaveLength(1);
  });

  it("filters by tag (all-match)", () => {
    expect(filterSnippets(sample, { tags: ["zod"] })).toHaveLength(1);
    expect(filterSnippets(sample, { tags: ["zod", "validation"] })).toHaveLength(1);
    expect(filterSnippets(sample, { tags: ["zod", "missing"] })).toHaveLength(0);
  });

  it("filters by search against name/body/tags/language", () => {
    expect(filterSnippets(sample, { search: "zod" })).toHaveLength(1);
    expect(filterSnippets(sample, { search: "REACT" })).toHaveLength(1);
  });

  it("composes multiple filters", () => {
    const out = filterSnippets(sample, {
      language: "ts",
      tags: ["zod"],
    });
    expect(out).toHaveLength(1);
  });
});

describe("sortForDisplay", () => {
  it("puts user snippets before built-ins", () => {
    const list = [
      makeSnippet({ id: "b", builtin: true, updatedAt: 10 }),
      makeSnippet({ id: "u1", updatedAt: 5 }),
    ];
    const out = sortForDisplay(list);
    expect(out[0].id).toBe("u1");
    expect(out[1].id).toBe("b");
  });

  it("within user snippets sorts by recency desc", () => {
    const list = [
      makeSnippet({ id: "a", updatedAt: 1 }),
      makeSnippet({ id: "b", updatedAt: 10 }),
      makeSnippet({ id: "c", updatedAt: 5 }),
    ];
    const out = sortForDisplay(list);
    expect(out.map((s) => s.id)).toEqual(["b", "c", "a"]);
  });
});

describe("allLanguages / allTags", () => {
  const sample: CodeSnippet[] = [
    makeSnippet({ id: "a", language: "ts", tags: ["react", "hook"] }),
    makeSnippet({ id: "b", language: "tsx", tags: ["react"] }),
    makeSnippet({ id: "c", language: "ts", tags: ["zod"] }),
  ];

  it("deduplicates languages", () => {
    expect(allLanguages(sample)).toEqual(["ts", "tsx"]);
  });

  it("deduplicates tags", () => {
    const tags = allTags(sample);
    expect(tags.sort()).toEqual(["hook", "react", "zod"]);
  });
});

describe("parseSnippets / serializeSnippets", () => {
  it("round-trips user snippets", () => {
    const list = seedBuiltins([
      makeSnippet({ id: "u1", name: "mine", body: "hi" }),
    ]);
    const raw = serializeSnippets(list);
    const out = parseSnippets(raw);
    expect(out.some((s) => s.id === "u1")).toBe(true);
    // Built-ins re-added
    expect(out.length).toBeGreaterThanOrEqual(BUILT_IN_SNIPPETS.length);
  });

  it("parses null as built-ins only", () => {
    const out = parseSnippets(null);
    expect(out.length).toBe(BUILT_IN_SNIPPETS.length);
  });

  it("parses malformed JSON as built-ins only", () => {
    const out = parseSnippets("{oops");
    expect(out.length).toBe(BUILT_IN_SNIPPETS.length);
  });

  it("drops entries with missing name", () => {
    const raw = JSON.stringify([{ id: "x", body: "1" }]);
    const out = parseSnippets(raw);
    // No user snippet; still seeded with built-ins
    expect(out.length).toBe(BUILT_IN_SNIPPETS.length);
  });

  it("caps on load", () => {
    const arr: unknown[] = [];
    for (let i = 0; i < MAX_SNIPPETS + 20; i++) {
      arr.push({ id: `u${i}`, name: `s${i}`, body: "x" });
    }
    const out = parseSnippets(JSON.stringify(arr));
    expect(out.length).toBeLessThanOrEqual(MAX_SNIPPETS + BUILT_IN_SNIPPETS.length);
  });
});

describe("exportSnippets / parseSnippetExport", () => {
  it("exports user snippets only", () => {
    const list = seedBuiltins([makeSnippet({ id: "u1", name: "mine" })]);
    const exported = exportSnippets(list);
    const parsed = JSON.parse(exported);
    expect(parsed.version).toBe(1);
    expect(parsed.snippets).toHaveLength(1);
    expect(parsed.snippets[0].name).toBe("mine");
  });

  it("parses wrapped export format", () => {
    const raw = JSON.stringify({
      version: 1,
      snippets: [
        { name: "imported", body: "1", language: "ts", tags: ["foo"] },
      ],
    });
    const out = parseSnippetExport(raw);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("imported");
  });

  it("parses bare-array export format", () => {
    const raw = JSON.stringify([
      { name: "bare", body: "1", language: "ts", tags: [] },
    ]);
    const out = parseSnippetExport(raw);
    expect(out).toHaveLength(1);
  });

  it("returns empty on malformed JSON", () => {
    expect(parseSnippetExport("{oops")).toEqual([]);
  });
});
