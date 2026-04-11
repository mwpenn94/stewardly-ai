import { describe, it, expect } from "vitest";
import {
  compileGlobPattern,
  expandBraces,
  matchGlob,
  rankGlobMatches,
} from "./globMatcher";

describe("expandBraces", () => {
  it("returns the pattern unchanged if there are no braces", () => {
    expect(expandBraces("src/foo.ts")).toEqual(["src/foo.ts"]);
  });

  it("expands a single top-level alternation", () => {
    expect(expandBraces("src/{a,b,c}.ts")).toEqual([
      "src/a.ts",
      "src/b.ts",
      "src/c.ts",
    ]);
  });

  it("expands multiple alternations combinatorially", () => {
    expect(expandBraces("{a,b}/{x,y}.ts")).toEqual([
      "a/x.ts",
      "a/y.ts",
      "b/x.ts",
      "b/y.ts",
    ]);
  });

  it("handles nested braces", () => {
    const out = expandBraces("src/{{a,b},c}.ts");
    expect(out).toContain("src/a.ts");
    expect(out).toContain("src/b.ts");
    expect(out).toContain("src/c.ts");
  });

  it("returns the literal pattern on unbalanced braces", () => {
    expect(expandBraces("src/{a,b.ts")).toEqual(["src/{a,b.ts"]);
  });

  it("preserves empty alternatives", () => {
    expect(expandBraces("foo{,.bak}")).toEqual(["foo", "foo.bak"]);
  });
});

describe("compileGlobPattern", () => {
  it("matches simple literal paths", () => {
    const rx = compileGlobPattern("src/foo.ts");
    expect(rx.test("src/foo.ts")).toBe(true);
    expect(rx.test("src/bar.ts")).toBe(false);
  });

  it("matches a single `*` wildcard within a segment", () => {
    const rx = compileGlobPattern("src/*.ts");
    expect(rx.test("src/foo.ts")).toBe(true);
    expect(rx.test("src/bar.ts")).toBe(true);
    expect(rx.test("src/nested/foo.ts")).toBe(false);
  });

  it("does not cross directory boundaries with `*`", () => {
    const rx = compileGlobPattern("src/*");
    expect(rx.test("src/foo.ts")).toBe(true);
    expect(rx.test("src/a/b.ts")).toBe(false);
  });

  it("matches `**` across directories", () => {
    const rx = compileGlobPattern("src/**/*.tsx");
    expect(rx.test("src/foo.tsx")).toBe(true);
    expect(rx.test("src/a/b/c.tsx")).toBe(true);
    expect(rx.test("src/foo.ts")).toBe(false);
  });

  it("matches `**` at the start", () => {
    const rx = compileGlobPattern("**/*.md");
    expect(rx.test("README.md")).toBe(true);
    expect(rx.test("docs/a.md")).toBe(true);
    expect(rx.test("docs/nested/deep/a.md")).toBe(true);
    expect(rx.test("src/foo.ts")).toBe(false);
  });

  it("matches `**` at the end", () => {
    const rx = compileGlobPattern("server/**");
    expect(rx.test("server")).toBe(true);
    expect(rx.test("server/foo.ts")).toBe(true);
    expect(rx.test("server/a/b/c.ts")).toBe(true);
    expect(rx.test("client/foo.ts")).toBe(false);
  });

  it("matches `?` as a single non-slash char", () => {
    const rx = compileGlobPattern("src/f?o.ts");
    expect(rx.test("src/foo.ts")).toBe(true);
    expect(rx.test("src/fxo.ts")).toBe(true);
    expect(rx.test("src/fooo.ts")).toBe(false);
  });

  it("matches character classes", () => {
    const rx = compileGlobPattern("src/[abc].ts");
    expect(rx.test("src/a.ts")).toBe(true);
    expect(rx.test("src/b.ts")).toBe(true);
    expect(rx.test("src/d.ts")).toBe(false);
  });

  it("matches character ranges", () => {
    const rx = compileGlobPattern("src/file[0-9].ts");
    expect(rx.test("src/file3.ts")).toBe(true);
    expect(rx.test("src/filea.ts")).toBe(false);
  });

  it("honors negation inside character classes", () => {
    const rx = compileGlobPattern("src/[!a-c].ts");
    expect(rx.test("src/a.ts")).toBe(false);
    expect(rx.test("src/d.ts")).toBe(true);
  });

  it("escapes regex metacharacters in literals", () => {
    const rx = compileGlobPattern("src/foo.bar+baz.ts");
    expect(rx.test("src/foo.bar+baz.ts")).toBe(true);
    expect(rx.test("src/fooxbarxbaz.ts")).toBe(false);
  });

  it("hides dot-prefixed files at segment start by default", () => {
    const rx = compileGlobPattern("*.ts");
    expect(rx.test("foo.ts")).toBe(true);
    expect(rx.test(".eslintrc.ts")).toBe(false);
  });

  it("includes dot-prefixed files when dot:true", () => {
    const rx = compileGlobPattern("*.ts", { dot: true });
    expect(rx.test(".eslintrc.ts")).toBe(true);
  });

  it("is case-sensitive by default", () => {
    const rx = compileGlobPattern("src/Foo.ts");
    expect(rx.test("src/Foo.ts")).toBe(true);
    expect(rx.test("src/foo.ts")).toBe(false);
  });

  it("supports case-insensitive mode", () => {
    const rx = compileGlobPattern("src/foo.ts", { caseInsensitive: true });
    expect(rx.test("src/FOO.ts")).toBe(true);
  });
});

describe("matchGlob", () => {
  const files = [
    "README.md",
    "package.json",
    "src/index.ts",
    "src/pages/Chat.tsx",
    "src/pages/CodeChat.tsx",
    "src/components/Button.tsx",
    "server/_core/index.ts",
    "server/services/codeChat/fileTools.ts",
    "server/services/codeChat/globMatcher.ts",
    "docs/PARITY.md",
  ];

  it("returns an empty array for an empty pattern list", () => {
    expect(matchGlob(files, [])).toEqual([]);
  });

  it("matches a single include pattern", () => {
    expect(matchGlob(files, "src/**/*.tsx")).toEqual([
      "src/pages/Chat.tsx",
      "src/pages/CodeChat.tsx",
      "src/components/Button.tsx",
    ]);
  });

  it("matches multiple include patterns as OR", () => {
    const result = matchGlob(files, ["**/*.md", "**/*.json"]);
    expect(result).toEqual(
      expect.arrayContaining([
        "README.md",
        "package.json",
        "docs/PARITY.md",
      ]),
    );
    expect(result).toHaveLength(3);
  });

  it("applies negation patterns as post-filters", () => {
    const result = matchGlob(files, ["src/**/*.tsx", "!**/CodeChat.tsx"]);
    expect(result).toContain("src/pages/Chat.tsx");
    expect(result).not.toContain("src/pages/CodeChat.tsx");
  });

  it("treats negation-only patterns as 'all, except'", () => {
    const result = matchGlob(files, ["!**/*.ts", "!**/*.tsx"]);
    expect(result).toEqual(
      expect.arrayContaining(["README.md", "package.json", "docs/PARITY.md"]),
    );
  });

  it("expands braces in the pattern", () => {
    const result = matchGlob(files, "**/*.{ts,tsx}");
    expect(result).toContain("src/index.ts");
    expect(result).toContain("src/pages/Chat.tsx");
    expect(result).toContain("server/services/codeChat/fileTools.ts");
    expect(result).not.toContain("README.md");
  });

  it("deduplicates nothing — callers get exactly the file set", () => {
    const result = matchGlob(
      ["a.ts", "b.ts"],
      ["*.ts", "*.ts"], // same pattern twice
    );
    expect(result).toEqual(["a.ts", "b.ts"]);
  });

  it("returns empty when nothing matches", () => {
    expect(matchGlob(files, "nothing/**/matches.xyz")).toEqual([]);
  });
});

describe("rankGlobMatches", () => {
  it("puts shorter paths first", () => {
    const matches = [
      "src/components/ui/very/deep/Widget.tsx",
      "src/Button.tsx",
      "src/components/Card.tsx",
    ];
    const ranked = rankGlobMatches(matches);
    expect(ranked[0]).toBe("src/Button.tsx");
  });

  it("breaks length ties alphabetically", () => {
    // All three have identical length (7 chars) so ranking falls
    // through to the alphabetical tie-break.
    const matches = ["zeta.ts", "ceta.ts", "beta.ts"];
    expect(rankGlobMatches(matches)).toEqual([
      "beta.ts",
      "ceta.ts",
      "zeta.ts",
    ]);
  });

  it("does not mutate its input", () => {
    const input = ["b.ts", "a.ts"];
    const copy = [...input];
    rankGlobMatches(input);
    expect(input).toEqual(copy);
  });
});
