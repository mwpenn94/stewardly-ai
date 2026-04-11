/**
 * Tests for symbolIndex.ts (Pass 242).
 */

import { describe, it, expect } from "vitest";
import {
  extractSymbols,
  buildSymbolIndex,
  findSymbols,
  findExactName,
  symbolIndexStats,
  emptyIndex,
} from "./symbolIndex";

describe("extractSymbols", () => {
  it("extracts a plain function", () => {
    const symbols = extractSymbols(`function foo() {}`, "a.ts");
    expect(symbols).toHaveLength(1);
    expect(symbols[0].name).toBe("foo");
    expect(symbols[0].kind).toBe("function");
    expect(symbols[0].exported).toBe(false);
    expect(symbols[0].line).toBe(1);
  });

  it("extracts an exported function with async", () => {
    const symbols = extractSymbols(`export async function bar() {}`, "a.ts");
    expect(symbols).toHaveLength(1);
    expect(symbols[0].name).toBe("bar");
    expect(symbols[0].exported).toBe(true);
  });

  it("extracts a class with extends clause", () => {
    const symbols = extractSymbols(`class Foo extends Bar {}`, "a.ts");
    expect(symbols[0].name).toBe("Foo");
    expect(symbols[0].kind).toBe("class");
  });

  it("extracts export default class", () => {
    const symbols = extractSymbols(`export default class Widget {}`, "a.ts");
    expect(symbols[0].name).toBe("Widget");
    expect(symbols[0].kind).toBe("class");
    expect(symbols[0].exported).toBe(true);
  });

  it("extracts interface", () => {
    const symbols = extractSymbols(`export interface Point { x: number }`, "a.ts");
    expect(symbols[0].name).toBe("Point");
    expect(symbols[0].kind).toBe("interface");
    expect(symbols[0].exported).toBe(true);
  });

  it("extracts type alias", () => {
    const symbols = extractSymbols(`export type ID = string;`, "a.ts");
    expect(symbols[0].name).toBe("ID");
    expect(symbols[0].kind).toBe("type");
  });

  it("extracts const top-level", () => {
    const symbols = extractSymbols(`export const MAX_SIZE = 100;`, "a.ts");
    expect(symbols[0].name).toBe("MAX_SIZE");
    expect(symbols[0].kind).toBe("const");
  });

  it("extracts let and var", () => {
    const symbols = extractSymbols(`let counter = 0;\nvar flag: boolean = true;`, "a.ts");
    expect(symbols).toHaveLength(2);
    expect(symbols[0].kind).toBe("let");
    expect(symbols[1].kind).toBe("var");
  });

  it("extracts enum", () => {
    const symbols = extractSymbols(`export enum Status { Active, Inactive }`, "a.ts");
    expect(symbols[0].name).toBe("Status");
    expect(symbols[0].kind).toBe("enum");
  });

  it("captures correct line numbers", () => {
    const src = `// comment\n// more\nfunction foo() {}\n\nclass Bar {}`;
    const symbols = extractSymbols(src, "a.ts");
    expect(symbols[0].line).toBe(3);
    expect(symbols[1].line).toBe(5);
  });

  it("returns snippet of the raw line, trimmed", () => {
    const symbols = extractSymbols(`   function foo() { return 1; }`, "a.ts");
    expect(symbols[0].snippet).toBe("function foo() { return 1; }");
  });

  it("ignores deeply-nested symbols", () => {
    const src = `function outer() {\n            const nested = 1;\n}`;
    const symbols = extractSymbols(src, "a.ts");
    expect(symbols).toHaveLength(1);
    expect(symbols[0].name).toBe("outer");
  });

  it("handles multiple symbols in one file", () => {
    const src = `export function a() {}\nexport function b() {}\nexport class C {}`;
    const symbols = extractSymbols(src, "file.ts");
    expect(symbols).toHaveLength(3);
    expect(symbols.map((s) => s.name)).toEqual(["a", "b", "C"]);
  });

  it("skips reserved words", () => {
    // `default` would otherwise match the const pattern
    const src = `export default { foo: 1 };`;
    const symbols = extractSymbols(src, "a.ts");
    // Should not capture `default` as a symbol
    expect(symbols.some((s) => s.name === "default")).toBe(false);
  });
});

describe("buildSymbolIndex", () => {
  it("collects symbols across files", () => {
    const index = buildSymbolIndex([
      { path: "a.ts", content: `export function foo() {}` },
      { path: "b.ts", content: `export function bar() {}` },
    ]);
    expect(index.symbols).toHaveLength(2);
  });

  it("indexes by lowercased name", () => {
    const index = buildSymbolIndex([
      { path: "a.ts", content: `export function Foo() {}` },
    ]);
    expect(index.byName.get("foo")).toEqual([0]);
  });
});

describe("findSymbols", () => {
  const setup = () =>
    buildSymbolIndex([
      { path: "a.ts", content: `export function getUser() {}` },
      { path: "b.ts", content: `export function getUserById() {}` },
      { path: "c.ts", content: `export interface UserProfile {}` },
      { path: "d.ts", content: `const user = 1;` },
    ]);

  it("finds exact name first", () => {
    const hits = findSymbols(setup(), "getUser");
    expect(hits[0].name).toBe("getUser");
  });

  it("prefix match ranks above substring", () => {
    const hits = findSymbols(setup(), "get");
    expect(hits[0].name).toMatch(/^get/);
  });

  it("substring match finds UserProfile from 'user'", () => {
    const hits = findSymbols(setup(), "user");
    expect(hits.some((h) => h.name === "UserProfile")).toBe(true);
  });

  it("subsequence match as last resort", () => {
    const hits = findSymbols(setup(), "gu");
    // Matches 'getUser' via subsequence
    expect(hits.length).toBeGreaterThan(0);
  });

  it("exported symbols rank above non-exported", () => {
    const index = buildSymbolIndex([
      { path: "a.ts", content: `const foo = 1;` },
      { path: "b.ts", content: `export const foo = 2;` },
    ]);
    const hits = findSymbols(index, "foo");
    expect(hits[0].exported).toBe(true);
  });

  it("respects limit", () => {
    const hits = findSymbols(setup(), "", 2);
    expect(hits.length).toBeLessThanOrEqual(2);
  });

  it("returns empty for no match", () => {
    const hits = findSymbols(setup(), "nonexistent_zzz");
    expect(hits).toEqual([]);
  });
});

describe("findExactName", () => {
  it("returns all definitions with exact name", () => {
    const index = buildSymbolIndex([
      { path: "a.ts", content: `function foo() {}` },
      { path: "b.ts", content: `function foo() {}` },
    ]);
    const hits = findExactName(index, "foo");
    expect(hits).toHaveLength(2);
  });

  it("is case-insensitive", () => {
    const index = buildSymbolIndex([
      { path: "a.ts", content: `function Foo() {}` },
    ]);
    expect(findExactName(index, "FOO")).toHaveLength(1);
    expect(findExactName(index, "foo")).toHaveLength(1);
  });

  it("returns empty for unknown name", () => {
    const index = emptyIndex();
    expect(findExactName(index, "foo")).toEqual([]);
  });
});

describe("symbolIndexStats", () => {
  it("counts by kind and file", () => {
    const index = buildSymbolIndex([
      { path: "a.ts", content: `export function foo() {}\nexport class Bar {}` },
      { path: "b.ts", content: `export interface Point {}` },
    ]);
    const stats = symbolIndexStats(index);
    expect(stats.total).toBe(3);
    expect(stats.files).toBe(2);
    expect(stats.byKind.function).toBe(1);
    expect(stats.byKind.class).toBe(1);
    expect(stats.byKind.interface).toBe(1);
    expect(stats.exported).toBe(3);
  });
});
