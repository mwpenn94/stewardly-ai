import { describe, it, expect, beforeEach } from "vitest";
import {
  validateSnippet,
  inferCategory,
  loadUserSnippets,
  saveUserSnippets,
  allSnippets,
  addSnippet,
  updateSnippet,
  removeSnippet,
  filterSnippets,
  toMarkdownFence,
  computeSnippetStats,
  BUILTIN_SNIPPETS,
  MAX_SNIPPETS,
  type CodeSnippet,
} from "./codeSnippets";

const makeSnippet = (over: Partial<CodeSnippet> = {}): CodeSnippet =>
  validateSnippet({
    id: "test:1",
    name: "test snippet",
    code: "console.log('hi');",
    language: "javascript",
    ...over,
  });

// Polyfill localStorage for node env
const storageBacking: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => (k in storageBacking ? storageBacking[k] : null),
  setItem: (k: string, v: string) => {
    storageBacking[k] = v;
  },
  removeItem: (k: string) => {
    delete storageBacking[k];
  },
  clear: () => {
    for (const k of Object.keys(storageBacking)) delete storageBacking[k];
  },
};

beforeEach(() => {
  localStorage.clear();
});

describe("codeSnippets — validateSnippet", () => {
  it("throws on empty name", () => {
    expect(() =>
      validateSnippet({ name: "", code: "ok" }),
    ).toThrow();
  });

  it("throws on empty code", () => {
    expect(() =>
      validateSnippet({ name: "test", code: "" }),
    ).toThrow();
  });

  it("throws on code longer than MAX_CODE_LENGTH", () => {
    const huge = "x".repeat(100_000);
    expect(() => validateSnippet({ name: "test", code: huge })).toThrow();
  });

  it("trims whitespace from name", () => {
    const s = validateSnippet({ name: "  test  ", code: "ok" });
    expect(s.name).toBe("test");
  });

  it("normalizes language to lowercase", () => {
    const s = validateSnippet({
      name: "test",
      code: "ok",
      language: "TypeScript",
    });
    expect(s.language).toBe("typescript");
  });

  it("normalizes and dedupes tags", () => {
    const s = validateSnippet({
      name: "test",
      code: "ok",
      tags: ["React", "react", "bad space", "ok"],
    });
    expect(s.tags).toContain("react");
    expect(s.tags).toContain("ok");
    expect(s.tags.filter((t) => t === "react").length).toBe(1);
    expect(s.tags).not.toContain("bad space");
  });

  it("generates a stable id when none provided", () => {
    const s1 = validateSnippet({ name: "test", code: "ok" });
    const s2 = validateSnippet({ name: "test", code: "ok" });
    expect(s1.id).not.toBe(s2.id);
    expect(s1.id.startsWith("snip_")).toBe(true);
  });
});

describe("codeSnippets — inferCategory", () => {
  it("picks react for JSX-like code", () => {
    expect(inferCategory("typescript", "const x = useEffect(() => {}, []);")).toBe("react");
  });

  it("picks trpc for trpc usage", () => {
    expect(inferCategory("typescript", "const q = trpc.foo.useQuery();")).toBe("trpc");
  });

  it("picks test for vitest patterns", () => {
    expect(inferCategory("typescript", "describe('x', () => { it('does', () => {}); });")).toBe(
      "test",
    );
  });

  it("picks sql for sql language", () => {
    expect(inferCategory("sql", "SELECT * FROM foo")).toBe("sql");
  });

  it("picks shell for bash", () => {
    expect(inferCategory("bash", "npm test")).toBe("shell");
  });

  it("falls back to other", () => {
    expect(inferCategory("plaintext", "nothing special")).toBe("other");
  });
});

describe("codeSnippets — localStorage persistence", () => {
  it("round-trips snippets through localStorage", () => {
    const s = makeSnippet({ name: "round trip" });
    saveUserSnippets([s]);
    const loaded = loadUserSnippets();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.name).toBe("round trip");
  });

  it("returns empty on malformed JSON", () => {
    localStorage.setItem("stewardly-codechat-snippets", "not json");
    expect(loadUserSnippets()).toEqual([]);
  });

  it("filters built-in ids from localStorage to prevent shadowing", () => {
    localStorage.setItem(
      "stewardly-codechat-snippets",
      JSON.stringify([
        { id: "builtin:react-use-query", name: "hacked", code: "bad" },
        { id: "user:ok", name: "ok", code: "good" },
      ]),
    );
    const loaded = loadUserSnippets();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.id).toBe("user:ok");
  });

  it("does not persist built-ins even when passed in", () => {
    saveUserSnippets([
      makeSnippet({ name: "user" }),
      { ...BUILTIN_SNIPPETS[0]! } as CodeSnippet,
    ]);
    const loaded = loadUserSnippets();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.name).toBe("user");
  });
});

describe("codeSnippets — list mutations", () => {
  it("allSnippets combines user + builtins", () => {
    const s = makeSnippet();
    const all = allSnippets([s]);
    expect(all.length).toBe(BUILTIN_SNIPPETS.length + 1);
    expect(all[0]!.name).toBe("test snippet");
  });

  it("addSnippet prepends and dedupes", () => {
    const a = makeSnippet({ id: "a" });
    const b = makeSnippet({ id: "b" });
    let list: CodeSnippet[] = [];
    list = addSnippet(list, a);
    list = addSnippet(list, b);
    list = addSnippet(list, { ...a, name: "updated" });
    expect(list).toHaveLength(2);
    expect(list[0]!.name).toBe("updated");
  });

  it("addSnippet caps at MAX_SNIPPETS", () => {
    let list: CodeSnippet[] = [];
    for (let i = 0; i < MAX_SNIPPETS + 10; i++) {
      list = addSnippet(list, makeSnippet({ id: `s${i}` }));
    }
    expect(list.length).toBe(MAX_SNIPPETS);
  });

  it("addSnippet refuses to add built-ins", () => {
    const list = addSnippet([], { ...BUILTIN_SNIPPETS[0]! });
    expect(list).toHaveLength(0);
  });

  it("updateSnippet patches a user snippet", () => {
    const s = makeSnippet();
    const list = updateSnippet([s], s.id, { name: "new" });
    expect(list[0]!.name).toBe("new");
  });

  it("updateSnippet leaves built-ins untouched", () => {
    const builtin = { ...BUILTIN_SNIPPETS[0]! };
    const list = updateSnippet([builtin], builtin.id, { name: "new" });
    expect(list[0]!.name).toBe(BUILTIN_SNIPPETS[0]!.name);
  });

  it("removeSnippet removes user but keeps built-ins", () => {
    const s = makeSnippet({ id: "user:x" });
    const list = [...BUILTIN_SNIPPETS.slice(0, 1), s];
    const after = removeSnippet(list, "user:x");
    expect(after).toHaveLength(1);
    expect(after[0]!.builtin).toBe(true);
  });

  it("removeSnippet refuses to remove built-ins", () => {
    const id = BUILTIN_SNIPPETS[0]!.id;
    const list = removeSnippet([...BUILTIN_SNIPPETS], id);
    expect(list.find((s) => s.id === id)).toBeDefined();
  });
});

describe("codeSnippets — filterSnippets", () => {
  const list: CodeSnippet[] = [
    makeSnippet({ id: "1", name: "alpha", tags: ["react"], category: "react" }),
    makeSnippet({ id: "2", name: "beta", tags: ["trpc"], category: "trpc" }),
    makeSnippet({
      id: "3",
      name: "gamma",
      code: "const foo = useEffect();",
      tags: ["react"],
      category: "react",
    }),
  ];

  it("filters by query across name/code/description/tags", () => {
    expect(filterSnippets(list, { query: "alpha" })).toHaveLength(1);
    expect(filterSnippets(list, { query: "useEffect" })).toHaveLength(1);
    expect(filterSnippets(list, { query: "trpc" })).toHaveLength(1);
  });

  it("filters by category", () => {
    expect(filterSnippets(list, { category: "react" })).toHaveLength(2);
  });

  it("filters by tag", () => {
    expect(filterSnippets(list, { tag: "react" })).toHaveLength(2);
    expect(filterSnippets(list, { tag: "trpc" })).toHaveLength(1);
  });

  it("composes multiple filters", () => {
    expect(
      filterSnippets(list, { category: "react", query: "useEffect" }),
    ).toHaveLength(1);
  });
});

describe("codeSnippets — toMarkdownFence", () => {
  it("wraps code in a fenced block with language", () => {
    const s = makeSnippet({ language: "typescript", code: "const x = 1;" });
    const fence = toMarkdownFence(s);
    expect(fence).toBe("```typescript\nconst x = 1;\n```");
  });

  it("omits language when empty", () => {
    const s = makeSnippet({ language: "", code: "content" });
    const fence = toMarkdownFence(s);
    expect(fence).toBe("```\ncontent\n```");
  });
});

describe("codeSnippets — computeSnippetStats", () => {
  it("aggregates counts and top tags", () => {
    const list = [
      makeSnippet({ id: "1", tags: ["react"], category: "react" }),
      makeSnippet({ id: "2", tags: ["react", "trpc"], category: "trpc" }),
      makeSnippet({ id: "3", tags: ["react"], category: "react" }),
      ...BUILTIN_SNIPPETS,
    ];
    const stats = computeSnippetStats(list);
    expect(stats.total).toBe(list.length);
    expect(stats.userCount).toBe(3);
    expect(stats.builtinCount).toBe(BUILTIN_SNIPPETS.length);
    expect(stats.topTags[0]!.tag).toBe("react");
  });
});
