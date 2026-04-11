/**
 * Tests for the gitignore matcher — Pass 268.
 */

import { describe, it, expect } from "vitest";
import {
  parseGitignore,
  compilePattern,
  isIgnored,
  filterIgnored,
  summarizeRules,
} from "./gitignoreMatcher";

describe("parseGitignore", () => {
  it("returns empty for empty input", () => {
    expect(parseGitignore("")).toEqual([]);
  });

  it("skips blank lines and comments", () => {
    const rules = parseGitignore(`
# a comment
node_modules/

dist
`);
    expect(rules).toHaveLength(2);
    expect(rules[0].raw).toBe("node_modules/");
    expect(rules[1].raw).toBe("dist");
  });

  it("detects directory-only patterns", () => {
    const rules = parseGitignore("node_modules/");
    expect(rules[0].directoryOnly).toBe(true);
  });

  it("detects negation", () => {
    const rules = parseGitignore("!important.txt");
    expect(rules[0].negate).toBe(true);
    expect(rules[0].raw).toBe("!important.txt");
  });

  it("detects anchored patterns", () => {
    const rules = parseGitignore("/build");
    expect(rules[0].anchored).toBe(true);
  });
});

describe("compilePattern", () => {
  it("anchors when anchored=true", () => {
    const re = compilePattern("build", true);
    expect(re.test("build")).toBe(true);
    expect(re.test("src/build")).toBe(false);
  });

  it("matches anywhere when not anchored", () => {
    const re = compilePattern("dist", false);
    expect(re.test("dist")).toBe(true);
    expect(re.test("src/dist")).toBe(true);
    expect(re.test("distance")).toBe(false);
  });

  it("single star matches within segment", () => {
    const re = compilePattern("*.log", false);
    expect(re.test("error.log")).toBe(true);
    expect(re.test("logs/error.log")).toBe(true);
    expect(re.test("error.logic")).toBe(false);
  });

  it("double star with leading slash matches any depth", () => {
    const re = compilePattern("**/node_modules", false);
    expect(re.test("node_modules")).toBe(true);
    expect(re.test("packages/a/node_modules")).toBe(true);
  });

  it("double star trailing matches under directory", () => {
    const re = compilePattern("dist/**", true);
    expect(re.test("dist/a.js")).toBe(true);
    expect(re.test("dist/sub/b.js")).toBe(true);
  });

  it("question mark matches a single char", () => {
    const re = compilePattern("?.log", false);
    expect(re.test("a.log")).toBe(true);
    expect(re.test("ab.log")).toBe(false);
  });

  it("char class matches", () => {
    const re = compilePattern("[abc].ts", false);
    expect(re.test("a.ts")).toBe(true);
    expect(re.test("b.ts")).toBe(true);
    expect(re.test("d.ts")).toBe(false);
  });
});

describe("isIgnored", () => {
  const rules = parseGitignore(`
node_modules/
dist
*.log
!important.log
/build/
`);

  it("ignores node_modules directory", () => {
    expect(isIgnored(rules, "node_modules", true)).toBe(true);
  });

  it("ignores dist files", () => {
    expect(isIgnored(rules, "dist")).toBe(true);
    expect(isIgnored(rules, "client/dist")).toBe(true);
  });

  it("ignores .log files at any depth", () => {
    expect(isIgnored(rules, "error.log")).toBe(true);
    expect(isIgnored(rules, "logs/debug.log")).toBe(true);
  });

  it("un-ignores negated patterns", () => {
    expect(isIgnored(rules, "important.log")).toBe(false);
  });

  it("anchored /build only matches at root", () => {
    expect(isIgnored(rules, "build", true)).toBe(true);
    expect(isIgnored(rules, "src/build", true)).toBe(false);
  });

  it("non-matching paths are kept", () => {
    expect(isIgnored(rules, "src/index.ts")).toBe(false);
    expect(isIgnored(rules, "README.md")).toBe(false);
  });

  it("empty path returns false", () => {
    expect(isIgnored(rules, "")).toBe(false);
  });

  it("directoryOnly rules don't match files", () => {
    const r = parseGitignore("build/");
    expect(isIgnored(r, "build", false)).toBe(false);
    expect(isIgnored(r, "build", true)).toBe(true);
  });
});

describe("filterIgnored", () => {
  it("removes ignored entries", () => {
    const rules = parseGitignore("*.log\ndist/");
    const out = filterIgnored(rules, [
      "src/a.ts",
      "error.log",
      "dist",
      "README.md",
    ]);
    expect(out).toContain("src/a.ts");
    expect(out).toContain("README.md");
    expect(out).not.toContain("error.log");
  });
});

describe("summarizeRules", () => {
  it("counts rule categories", () => {
    const rules = parseGitignore(`
node_modules/
!important.log
/build
dist
*.log
`);
    const summary = summarizeRules(rules);
    expect(summary.total).toBe(5);
    expect(summary.negated).toBe(1);
    expect(summary.directoryOnly).toBe(1);
    expect(summary.anchored).toBe(1);
  });
});
