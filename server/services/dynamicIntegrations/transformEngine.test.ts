import { describe, it, expect } from "vitest";
import {
  getByPath,
  setByPath,
  deleteByPath,
  applyStep,
  applyPipeline,
  runPipeline,
  type TransformStep,
} from "./transformEngine";

describe("dot-path helpers", () => {
  it("get/set/delete by path", () => {
    const rec: Record<string, unknown> = {};
    setByPath(rec, "a.b.c", 1);
    expect(getByPath(rec, "a.b.c")).toBe(1);
    deleteByPath(rec, "a.b.c");
    expect(getByPath(rec, "a.b.c")).toBeUndefined();
  });
  it("overwrites non-object segments when setting", () => {
    const rec: Record<string, unknown> = { a: 42 };
    setByPath(rec, "a.b", 1);
    expect(getByPath(rec, "a.b")).toBe(1);
  });
});

describe("applyStep", () => {
  it("pick keeps only listed fields", () => {
    const r = applyStep({ a: 1, b: 2, c: 3 }, { kind: "pick", fields: ["a", "c"] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.record).toEqual({ a: 1, c: 3 });
  });
  it("drop removes listed fields", () => {
    const r = applyStep({ a: 1, b: 2 }, { kind: "drop", fields: ["b"] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.record).toEqual({ a: 1 });
  });
  it("rename relocates the value", () => {
    const r = applyStep({ old: "v" }, { kind: "rename", from: "old", to: "new" });
    if (r.ok) expect(r.record).toEqual({ new: "v" });
  });
  it("map substitutes by lookup", () => {
    const r = applyStep({ status: "NEW" }, { kind: "map", field: "status", values: { NEW: "open", OLD: "closed" } });
    if (r.ok) expect((r.record as any).status).toBe("open");
  });
  it("map uses fallback when key missing", () => {
    const r = applyStep({ status: "XYZ" }, { kind: "map", field: "status", values: { NEW: "open" }, fallback: "unknown" });
    if (r.ok) expect((r.record as any).status).toBe("unknown");
  });
  it("coerce: number strips formatting", () => {
    const r = applyStep({ v: "$1,234.56" }, { kind: "coerce", field: "v", to: "number" });
    if (r.ok) expect((r.record as any).v).toBe(1234.56);
  });
  it("coerce: integer truncates", () => {
    const r = applyStep({ v: "42.9" }, { kind: "coerce", field: "v", to: "integer" });
    if (r.ok) expect((r.record as any).v).toBe(42);
  });
  it("coerce: boolean parses", () => {
    const r1 = applyStep({ v: "yes" }, { kind: "coerce", field: "v", to: "boolean" });
    const r2 = applyStep({ v: "NO" }, { kind: "coerce", field: "v", to: "boolean" });
    if (r1.ok) expect((r1.record as any).v).toBe(true);
    if (r2.ok) expect((r2.record as any).v).toBe(false);
  });
  it("coerce: date_ms parses ISO", () => {
    const r = applyStep({ v: "2026-01-01T00:00:00Z" }, { kind: "coerce", field: "v", to: "date_ms" });
    if (r.ok) expect(typeof (r.record as any).v).toBe("number");
  });
  it("default sets when missing/empty", () => {
    const r1 = applyStep({}, { kind: "default", field: "a", value: "hi" });
    const r2 = applyStep({ a: "" }, { kind: "default", field: "a", value: "hi" });
    const r3 = applyStep({ a: "keep" }, { kind: "default", field: "a", value: "hi" });
    if (r1.ok) expect((r1.record as any).a).toBe("hi");
    if (r2.ok) expect((r2.record as any).a).toBe("hi");
    if (r3.ok) expect((r3.record as any).a).toBe("keep");
  });
  it("trim whitespace", () => {
    const r = applyStep({ v: "  hi  " }, { kind: "trim", field: "v" });
    if (r.ok) expect((r.record as any).v).toBe("hi");
  });
  it("lowercase/uppercase — single or multi", () => {
    const lo = applyStep({ a: "HI" }, { kind: "lowercase", field: "a" });
    const up = applyStep({ a: "hi", b: "lo" }, { kind: "uppercase", fields: ["a", "b"] });
    if (lo.ok) expect((lo.record as any).a).toBe("hi");
    if (up.ok) {
      expect((up.record as any).a).toBe("HI");
      expect((up.record as any).b).toBe("LO");
    }
  });
  it("concat with separator", () => {
    const r = applyStep(
      { first: "Jane", last: "Doe" },
      { kind: "concat", target: "full", parts: ["first", "last"], separator: " " },
    );
    if (r.ok) expect((r.record as any).full).toBe("Jane Doe");
  });
  it("split produces an array", () => {
    const r = applyStep({ tags: "a,b,c" }, { kind: "split", field: "tags", separator: "," });
    if (r.ok) expect((r.record as any).tags).toEqual(["a", "b", "c"]);
  });
  it("regex rewrite", () => {
    const r = applyStep({ v: "hello world" }, { kind: "regex", field: "v", pattern: "world", replace: "planet" });
    if (r.ok) expect((r.record as any).v).toBe("hello planet");
  });
  it("regex safely no-ops on invalid pattern", () => {
    const r = applyStep({ v: "x" }, { kind: "regex", field: "v", pattern: "[invalid", replace: "" });
    if (r.ok) expect((r.record as any).v).toBe("x");
  });
  it("regex blocks nested-quantifier ReDoS pattern (a+)+", () => {
    const r = applyStep({ v: "aaaaaa" }, { kind: "regex", field: "v", pattern: "(a+)+", replace: "x" });
    if (r.ok) expect((r.record as any).v).toBe("aaaaaa"); // no-op
  });
  it("regex blocks (a*)* ReDoS pattern", () => {
    const r = applyStep({ v: "bbbbbb" }, { kind: "regex", field: "v", pattern: "(b*)*", replace: "x" });
    if (r.ok) expect((r.record as any).v).toBe("bbbbbb");
  });
  it("regex blocks patterns with too many open parens", () => {
    const r = applyStep(
      { v: "abc" },
      { kind: "regex", field: "v", pattern: "(a)(b)(c)(d)(e)(f)(g)(h)(i)(j)(k)", replace: "x" },
    );
    if (r.ok) expect((r.record as any).v).toBe("abc");
  });
  it("regex blocks patterns longer than 200 chars", () => {
    const r = applyStep(
      { v: "xxx" },
      { kind: "regex", field: "v", pattern: "a".repeat(250), replace: "y" },
    );
    if (r.ok) expect((r.record as any).v).toBe("xxx");
  });
  it("jsonPath extracts nested value", () => {
    const r = applyStep(
      { payload: { a: { b: "deep" } } },
      { kind: "jsonPath", field: "payload", path: "a.b", target: "val" },
    );
    if (r.ok) expect((r.record as any).val).toBe("deep");
  });
  it("arithmetic add literal+field", () => {
    const r = applyStep({ x: 10 }, { kind: "arithmetic", target: "y", op: "add", left: "$x", right: 5 });
    if (r.ok) expect((r.record as any).y).toBe(15);
  });
  it("arithmetic div by zero → null", () => {
    const r = applyStep({ x: 5 }, { kind: "arithmetic", target: "y", op: "div", left: "$x", right: 0 });
    if (r.ok) expect((r.record as any).y).toBeNull();
  });
  it("constant sets literal", () => {
    const r = applyStep({}, { kind: "constant", target: "src", value: "api" });
    if (r.ok) expect((r.record as any).src).toBe("api");
  });
  it("require rejects missing field", () => {
    const r = applyStep({ a: "x" }, { kind: "require", fields: ["a", "b"] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/b/);
  });
  it("dropEmpty rejects when all empty", () => {
    const r = applyStep({ a: "", b: null }, { kind: "dropEmpty", fields: ["a", "b"] });
    expect(r.ok).toBe(false);
  });
  it("dropEmpty accepts when any non-empty", () => {
    const r = applyStep({ a: "", b: "hi" }, { kind: "dropEmpty", fields: ["a", "b"] });
    expect(r.ok).toBe(true);
  });
});

describe("applyPipeline", () => {
  it("runs steps in order", () => {
    const steps: TransformStep[] = [
      { kind: "rename", from: "email_addr", to: "email" },
      { kind: "lowercase", field: "email" },
      { kind: "require", fields: ["email"] },
    ];
    const r = applyPipeline({ email_addr: "Foo@Bar.com" }, steps);
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.record as any).email).toBe("foo@bar.com");
  });
  it("short-circuits on rejection", () => {
    const r = applyPipeline({}, [{ kind: "require", fields: ["id"] }]);
    expect(r.ok).toBe(false);
  });
});

describe("runPipeline", () => {
  it("partitions accepted vs rejected", () => {
    const steps: TransformStep[] = [{ kind: "require", fields: ["id"] }];
    const result = runPipeline([{ id: 1 }, {}, { id: 2 }], steps);
    expect(result.accepted.length).toBe(2);
    expect(result.rejected.length).toBe(1);
    expect(result.rejected[0].index).toBe(1);
  });
});
