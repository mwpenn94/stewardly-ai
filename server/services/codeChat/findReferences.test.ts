/**
 * Tests for the find-references module — Pass 252.
 */

import { describe, it, expect } from "vitest";
import {
  escapeRegex,
  stripComments,
  classifyReference,
  findInFile,
  groupReferences,
  summarizeReferences,
  filterReferences,
  type ReferenceHit,
} from "./findReferences";

describe("escapeRegex", () => {
  it("escapes regex metacharacters", () => {
    expect(escapeRegex("foo.bar")).toBe("foo\\.bar");
    expect(escapeRegex("a$b")).toBe("a\\$b");
    expect(escapeRegex("(x)")).toBe("\\(x\\)");
  });

  it("leaves plain names alone", () => {
    expect(escapeRegex("foo")).toBe("foo");
  });
});

describe("stripComments", () => {
  it("strips // line comments but preserves line break", () => {
    const out = stripComments("const x = 1; // a comment\nconst y = 2;");
    expect(out).toBe("const x = 1; \nconst y = 2;");
  });

  it("strips /* block */ comments and preserves newlines inside", () => {
    const src = "a /* line1\nline2 */ b";
    const out = stripComments(src);
    expect(out).toBe("a \n b");
  });

  it("leaves code untouched when no comments", () => {
    expect(stripComments("const x = 1;")).toBe("const x = 1;");
  });

  it("handles adjacent comment types", () => {
    const out = stripComments("/* block */ code // line");
    expect(out).toBe(" code ");
  });
});

describe("classifyReference", () => {
  it("classifies property access", () => {
    expect(classifyReference("obj.foo", 4, "foo")).toBe("property");
  });

  it("classifies definition via keyword", () => {
    expect(classifyReference("const foo = 1", 6, "foo")).toBe("definition");
    expect(classifyReference("function foo()", 9, "foo")).toBe("definition");
    expect(classifyReference("class foo {}", 6, "foo")).toBe("definition");
    expect(classifyReference("interface foo {}", 10, "foo")).toBe("definition");
  });

  it("classifies import", () => {
    expect(classifyReference("import { foo } from 'x'", 9, "foo")).toBe("import");
    expect(classifyReference('import foo from "x"', 7, "foo")).toBe("import");
  });

  it("classifies call site", () => {
    expect(classifyReference("foo()", 0, "foo")).toBe("call");
    expect(classifyReference("foo(1, 2)", 0, "foo")).toBe("call");
    expect(classifyReference("foo<T>()", 0, "foo")).toBe("call");
  });

  it("falls back to generic reference", () => {
    expect(classifyReference("return foo;", 7, "foo")).toBe("reference");
    expect(classifyReference("x = foo", 4, "foo")).toBe("reference");
  });
});

describe("findInFile", () => {
  it("returns empty for empty query or short name", () => {
    expect(findInFile("a.ts", "const foo = 1;", "")).toEqual([]);
    expect(findInFile("a.ts", "const a = 1;", "a")).toEqual([]); // 1-char too short
  });

  it("finds simple references", () => {
    const src = `const foo = 1;
console.log(foo);
foo = 2;
`;
    const hits = findInFile("src/x.ts", src, "foo");
    expect(hits.length).toBe(3);
    expect(hits[0].line).toBe(1);
    expect(hits[1].line).toBe(2);
    expect(hits[2].line).toBe(3);
  });

  it("uses word boundaries", () => {
    const hits = findInFile("a.ts", "foobar + foo + foobaz", "foo");
    expect(hits).toHaveLength(1);
    expect(hits[0].column).toBe(10); // "foo" between the two
  });

  it("classifies each hit", () => {
    const src = `import { foo } from 'x';
function caller() {
  return foo();
}
const bar = { foo: 1 };
`;
    const hits = findInFile("a.ts", src, "foo");
    const kinds = hits.map((h) => h.kind);
    expect(kinds).toContain("import");
    expect(kinds).toContain("call");
    // object literal key "foo:" — not a property access, just a reference
  });

  it("includes comments by default", () => {
    const src = `// foo is great
const foo = 1;`;
    const hits = findInFile("a.ts", src, "foo");
    expect(hits).toHaveLength(2);
    expect(hits[0].line).toBe(1);
  });

  it("excludes comments when includeComments=false", () => {
    const src = `// foo is great
const foo = 1;`;
    const hits = findInFile("a.ts", src, "foo", { includeComments: false });
    expect(hits).toHaveLength(1);
    expect(hits[0].line).toBe(2);
  });

  it("handles multiple matches on the same line", () => {
    const src = `const result = foo(foo(x));`;
    const hits = findInFile("a.ts", src, "foo");
    expect(hits).toHaveLength(2);
    expect(hits[0].line).toBe(1);
    expect(hits[1].line).toBe(1);
    expect(hits[0].column).not.toBe(hits[1].column);
  });

  it("truncates long lines", () => {
    const longLine = `foo ${"x".repeat(300)}`;
    const hits = findInFile("a.ts", longLine, "foo");
    expect(hits[0].text.length).toBeLessThanOrEqual(241);
    expect(hits[0].text.endsWith("…")).toBe(true);
  });

  it("handles CRLF line endings", () => {
    const src = `const foo = 1;\r\nreturn foo;\r\n`;
    const hits = findInFile("a.ts", src, "foo");
    expect(hits).toHaveLength(2);
    expect(hits[0].line).toBe(1);
    expect(hits[1].line).toBe(2);
  });
});

describe("groupReferences", () => {
  it("groups by file sorted by count desc", () => {
    const hits: ReferenceHit[] = [
      { path: "a.ts", line: 1, column: 1, text: "", kind: "reference" },
      { path: "b.ts", line: 1, column: 1, text: "", kind: "reference" },
      { path: "a.ts", line: 2, column: 1, text: "", kind: "reference" },
      { path: "a.ts", line: 3, column: 1, text: "", kind: "reference" },
    ];
    const groups = groupReferences(hits);
    expect(groups[0].path).toBe("a.ts");
    expect(groups[0].hits).toHaveLength(3);
    expect(groups[1].path).toBe("b.ts");
  });

  it("breaks ties alphabetically", () => {
    const hits: ReferenceHit[] = [
      { path: "z.ts", line: 1, column: 1, text: "", kind: "reference" },
      { path: "a.ts", line: 1, column: 1, text: "", kind: "reference" },
    ];
    const groups = groupReferences(hits);
    expect(groups[0].path).toBe("a.ts");
  });
});

describe("summarizeReferences", () => {
  it("counts per kind and file count", () => {
    const hits: ReferenceHit[] = [
      { path: "a.ts", line: 1, column: 1, text: "", kind: "import" },
      { path: "a.ts", line: 2, column: 1, text: "", kind: "call" },
      { path: "b.ts", line: 1, column: 1, text: "", kind: "definition" },
    ];
    const s = summarizeReferences(hits);
    expect(s.total).toBe(3);
    expect(s.fileCount).toBe(2);
    expect(s.byKind.import).toBe(1);
    expect(s.byKind.call).toBe(1);
    expect(s.byKind.definition).toBe(1);
  });

  it("returns zeros for empty hits", () => {
    const s = summarizeReferences([]);
    expect(s.total).toBe(0);
    expect(s.fileCount).toBe(0);
  });
});

describe("filterReferences", () => {
  const sample: ReferenceHit[] = [
    { path: "src/a.ts", line: 1, column: 1, text: "", kind: "import" },
    { path: "src/b.ts", line: 1, column: 1, text: "", kind: "call" },
    { path: "server/c.ts", line: 1, column: 1, text: "", kind: "definition" },
  ];

  it("filters by kind", () => {
    expect(filterReferences(sample, { kinds: ["import"] })).toHaveLength(1);
    expect(filterReferences(sample, { kinds: ["import", "call"] })).toHaveLength(2);
    expect(filterReferences(sample, { kinds: "all" })).toHaveLength(3);
  });

  it("filters by path prefix", () => {
    expect(filterReferences(sample, { pathPrefix: "src/" })).toHaveLength(2);
    expect(filterReferences(sample, { pathPrefix: "server/" })).toHaveLength(1);
  });

  it("composes kind + path filters", () => {
    const out = filterReferences(sample, {
      kinds: ["import", "call"],
      pathPrefix: "src/",
    });
    expect(out).toHaveLength(2);
  });

  it("no-op when no filters given", () => {
    expect(filterReferences(sample)).toHaveLength(3);
  });
});
