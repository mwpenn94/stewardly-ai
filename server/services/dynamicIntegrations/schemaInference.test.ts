import { describe, it, expect } from "vitest";
import {
  classifyValue,
  flattenRecord,
  inferSchema,
  schemaToPersisted,
} from "./schemaInference";

describe("classifyValue", () => {
  it("detects null/undefined/empty", () => {
    expect(classifyValue(null)).toBe("null");
    expect(classifyValue(undefined)).toBe("null");
    expect(classifyValue("")).toBe("null");
    expect(classifyValue("   ")).toBe("null");
  });
  it("detects native types", () => {
    expect(classifyValue(true)).toBe("boolean");
    expect(classifyValue(1)).toBe("integer");
    expect(classifyValue(1.5)).toBe("number");
    expect(classifyValue([1, 2])).toBe("array");
    expect(classifyValue({ a: 1 })).toBe("object");
  });
  it("detects stringly-typed tokens", () => {
    expect(classifyValue("true")).toBe("boolean");
    expect(classifyValue("FALSE")).toBe("boolean");
    expect(classifyValue("42")).toBe("integer");
    expect(classifyValue("42.0")).toBe("number");
    expect(classifyValue("-12.5")).toBe("number");
  });
  it("detects rich string types", () => {
    expect(classifyValue("user@example.com")).toBe("email");
    expect(classifyValue("https://example.com/foo")).toBe("url");
    expect(classifyValue("+1 (555) 123-4567")).toBe("phone");
    expect(classifyValue("$1,234.56")).toBe("currency");
    expect(classifyValue("12.5%")).toBe("percentage");
    expect(classifyValue("2026-04-11")).toBe("date");
    expect(classifyValue("2026-04-11T12:34:56Z")).toBe("datetime");
  });
  it("falls back to string", () => {
    expect(classifyValue("hello world")).toBe("string");
  });
});

describe("flattenRecord", () => {
  it("flattens nested objects", () => {
    const flat = flattenRecord({ a: { b: { c: 1 } }, d: 2 });
    expect(flat).toEqual({ "a.b.c": 1, d: 2 });
  });
  it("preserves arrays as single values", () => {
    const flat = flattenRecord({ tags: ["a", "b"] });
    expect(flat).toEqual({ tags: ["a", "b"] });
  });
  it("handles null", () => {
    const flat = flattenRecord({ a: null });
    expect(flat).toEqual({ a: null });
  });
});

describe("inferSchema", () => {
  it("returns empty on no records", () => {
    const s = inferSchema([]);
    expect(s.recordCount).toBe(0);
    expect(s.fields).toEqual([]);
  });

  it("infers basic types from a uniform set", () => {
    const records = [
      { id: 1, name: "Alice", email: "alice@example.com" },
      { id: 2, name: "Bob", email: "bob@example.com" },
      { id: 3, name: "Carol", email: "carol@example.com" },
    ];
    const s = inferSchema(records);
    expect(s.recordCount).toBe(3);
    const byPath = Object.fromEntries(s.fields.map((f) => [f.path, f]));
    expect(byPath.id.type).toBe("integer");
    expect(byPath.id.unique).toBe(true);
    expect(byPath.name.type).toBe("string");
    expect(byPath.email.type).toBe("email");
    expect(s.primaryKey).toBe("id");
  });

  it("detects nullable when a field is missing on some records", () => {
    const s = inferSchema([{ a: 1, b: "x" }, { a: 2 }]);
    const b = s.fields.find((f) => f.path === "b")!;
    expect(b.nullable).toBe(true);
  });

  it("detects enum when cardinality is small", () => {
    const records = Array.from({ length: 10 }, (_, i) => ({
      status: i % 3 === 0 ? "new" : i % 3 === 1 ? "active" : "closed",
    }));
    const s = inferSchema(records);
    const status = s.fields.find((f) => f.path === "status")!;
    expect(status.type).toBe("enum");
    expect(status.enumValues).toEqual(["active", "closed", "new"]);
  });

  it("does not call high-cardinality string an enum", () => {
    const records = Array.from({ length: 20 }, (_, i) => ({ name: `user_${i}` }));
    const s = inferSchema(records);
    const name = s.fields.find((f) => f.path === "name")!;
    expect(name.type).toBe("string");
  });

  it("promotes richer type when dominant (≥90% of non-null)", () => {
    const records = [
      { contact: "a@b.com" },
      { contact: "c@d.com" },
      { contact: "e@f.com" },
      { contact: "g@h.com" },
      { contact: "i@j.com" },
      { contact: "k@l.com" },
      { contact: "m@n.com" },
      { contact: "o@p.com" },
      { contact: "q@r.com" },
      { contact: "s@t.com" },
    ];
    const s = inferSchema(records);
    expect(s.fields.find((f) => f.path === "contact")!.type).toBe("email");
  });

  it("drops richer type when not dominant", () => {
    const records = [
      { contact: "a@b.com" },
      { contact: "free text" },
      { contact: "more text" },
      { contact: "yet more" },
    ];
    const s = inferSchema(records);
    expect(s.fields.find((f) => f.path === "contact")!.type).toBe("string");
  });

  it("flattens nested records", () => {
    const records = [
      { user: { id: 1, email: "a@b.com" } },
      { user: { id: 2, email: "c@d.com" } },
    ];
    const s = inferSchema(records);
    const paths = s.fields.map((f) => f.path).sort();
    expect(paths).toEqual(["user.email", "user.id"]);
  });

  it("treats integer + number as number", () => {
    const records = [
      { price: 10 },
      { price: 10.5 },
      { price: 20 },
      { price: 20.25 },
    ];
    const s = inferSchema(records);
    expect(s.fields.find((f) => f.path === "price")!.type).toBe("number");
  });

  it("produces stable confidence scores in [0,1]", () => {
    const s = inferSchema([{ a: "hello" }, { a: "world" }, { a: "foo" }]);
    const f = s.fields[0];
    expect(f.confidence).toBeGreaterThan(0);
    expect(f.confidence).toBeLessThanOrEqual(1);
  });

  it("picks an id-like primary key when present", () => {
    const s = inferSchema([
      { uuid: "aaa", name: "x" },
      { uuid: "bbb", name: "y" },
    ]);
    expect(s.primaryKey).toBe("uuid");
  });

  it("caps samples at 5 distinct", () => {
    const s = inferSchema([
      { v: "a" }, { v: "b" }, { v: "c" }, { v: "d" }, { v: "e" }, { v: "f" }, { v: "g" },
    ]);
    // "v" becomes enum because distinct ≤ 20 but we can still check samples length
    const v = s.fields[0];
    expect(v.samples.length).toBeLessThanOrEqual(5);
  });

  it("schemaToPersisted strips long fields", () => {
    const s = inferSchema([{ id: 1, body: "a".repeat(300) }]);
    const persisted = schemaToPersisted(s);
    expect(persisted.recordCount).toBe(1);
    expect(persisted.fields.length).toBe(2);
    for (const f of persisted.fields) expect(f.samples.length).toBeLessThanOrEqual(3);
  });
});
