/**
 * Tests for schemaInference.ts (Pass 1 — dynamic CRUD integrations foundation).
 */

import { describe, it, expect } from "vitest";
import {
  normalizeFieldName,
  detectValueType,
  inferSchema,
  suggestCrudMapping,
  mergeSchemas,
  summarizeSchema,
} from "./schemaInference";

describe("normalizeFieldName", () => {
  it("lowercases camelCase into snake_case", () => {
    expect(normalizeFieldName("firstName")).toBe("first_name");
    expect(normalizeFieldName("customerID")).toBe("customer_id");
    expect(normalizeFieldName("HTTPStatus")).toBe("httpstatus");
  });

  it("replaces dots, dashes, and spaces with underscores", () => {
    expect(normalizeFieldName("contact.email")).toBe("contact_email");
    expect(normalizeFieldName("first-name")).toBe("first_name");
    expect(normalizeFieldName("First Name")).toBe("first_name");
  });

  it("strips special characters", () => {
    expect(normalizeFieldName("amount($)")).toBe("amount");
    expect(normalizeFieldName("e-mail@address")).toBe("e_mailaddress");
  });

  it("collapses repeated underscores", () => {
    expect(normalizeFieldName("foo__bar")).toBe("foo_bar");
    expect(normalizeFieldName("_leading_trailing_")).toBe("leading_trailing");
  });
});

describe("detectValueType", () => {
  it("distinguishes null variants", () => {
    expect(detectValueType(null)).toBe("null");
    expect(detectValueType(undefined)).toBe("null");
    expect(detectValueType("")).toBe("null");
    expect(detectValueType("   ")).toBe("null");
  });

  it("detects uuid", () => {
    expect(detectValueType("550e8400-e29b-41d4-a716-446655440000")).toBe("uuid");
    expect(detectValueType("550E8400-E29B-41D4-A716-446655440000")).toBe("uuid");
  });

  it("detects email", () => {
    expect(detectValueType("alice@example.com")).toBe("email");
    expect(detectValueType("a.b+tag@sub.domain.co.uk")).toBe("email");
  });

  it("detects phone only when it looks phone-like", () => {
    expect(detectValueType("+1 (415) 555-1234")).toBe("phone");
    expect(detectValueType("415-555-1234")).toBe("phone");
    // Small integers in string form should not be phone
    expect(detectValueType("42")).toBe("integer");
  });

  it("detects URL", () => {
    expect(detectValueType("https://example.com/path")).toBe("url");
    expect(detectValueType("www.example.com")).toBe("url");
  });

  it("detects currency and percentage", () => {
    expect(detectValueType("$1,234.56")).toBe("currency");
    expect(detectValueType("€42")).toBe("currency");
    expect(detectValueType("15.5%")).toBe("percentage");
  });

  it("detects date vs datetime", () => {
    expect(detectValueType("2024-01-15")).toBe("date");
    expect(detectValueType("2024-01-15T10:30:00Z")).toBe("datetime");
    expect(detectValueType("2024-01-15 10:30")).toBe("datetime");
  });

  it("detects integer, number, boolean", () => {
    expect(detectValueType(42)).toBe("integer");
    expect(detectValueType(3.14)).toBe("number");
    expect(detectValueType(true)).toBe("boolean");
    expect(detectValueType(false)).toBe("boolean");
  });

  it("detects epoch timestamps (ms and s) in the reasonable range", () => {
    expect(detectValueType(1710000000000)).toBe("timestamp"); // ms
    expect(detectValueType(1710000000)).toBe("timestamp"); // s
  });

  it("detects arrays and nested objects", () => {
    expect(detectValueType([])).toBe("array");
    expect(detectValueType({})).toBe("json");
  });
});

describe("inferSchema — basic records", () => {
  it("returns an empty schema for empty input", () => {
    const result = inferSchema([]);
    expect(result.recordCount).toBe(0);
    expect(result.fields).toHaveLength(0);
    expect(result.confidence).toBe(0);
    expect(result.warnings).toContain("No records supplied");
  });

  it("returns an empty-field schema when records have no keys", () => {
    const result = inferSchema([{}, {}, {}]);
    expect(result.recordCount).toBe(3);
    expect(result.fields).toHaveLength(0);
  });

  it("infers a clean schema from uniform records", () => {
    const records = [
      { id: "a1", email: "alice@x.com", balance: "$1,000" },
      { id: "a2", email: "bob@y.com", balance: "$2,500" },
      { id: "a3", email: "carol@z.com", balance: "$450" },
    ];
    const schema = inferSchema(records);
    expect(schema.recordCount).toBe(3);
    expect(schema.fields.length).toBe(3);
    const byName = Object.fromEntries(schema.fields.map((f) => [f.normalizedName, f]));
    expect(byName.email.type).toBe("email");
    expect(byName.email.semanticHints).toContain("email");
    expect(byName.balance.type).toBe("currency");
    expect(byName.balance.semanticHints).toContain("currency_amount");
  });

  it("picks the id field as primary key candidate", () => {
    const records = [
      { id: "550e8400-e29b-41d4-a716-446655440000", name: "A" },
      { id: "550e8400-e29b-41d4-a716-446655440001", name: "B" },
      { id: "550e8400-e29b-41d4-a716-446655440002", name: "C" },
    ];
    const schema = inferSchema(records);
    expect(schema.primaryKey).toBe("id");
    const idField = schema.fields.find((f) => f.normalizedName === "id")!;
    expect(idField.isPrimaryKeyCandidate).toBe(true);
    expect(idField.uniqueRate).toBe(1);
  });

  it("finds foreign key candidates by naming convention", () => {
    const records = [
      { id: "1", user_id: "u1", policy_id: "p1" },
      { id: "2", user_id: "u2", policy_id: "p2" },
    ];
    const schema = inferSchema(records);
    const userIdField = schema.fields.find((f) => f.normalizedName === "user_id")!;
    expect(userIdField.isForeignKeyCandidate).toBe(true);
    const policyIdField = schema.fields.find((f) => f.normalizedName === "policy_id")!;
    expect(policyIdField.isForeignKeyCandidate).toBe(true);
  });

  it("marks created_at / updated_at as timestamp fields and read-only", () => {
    const records = [
      { id: 1, name: "A", created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-05T00:00:00Z" },
      { id: 2, name: "B", created_at: "2024-02-01T00:00:00Z", updated_at: "2024-02-05T00:00:00Z" },
    ];
    const schema = inferSchema(records);
    expect(schema.timestampField).toBe("updated_at");
    const updatedAt = schema.fields.find((f) => f.normalizedName === "updated_at")!;
    expect(updatedAt.semanticHints).toContain("timestamp_updated");
    expect(updatedAt.isReadOnlySuggested).toBe(true);
  });

  it("detects enum-like fields with a small distinct set", () => {
    const records = [
      { id: 1, status: "active" },
      { id: 2, status: "inactive" },
      { id: 3, status: "active" },
      { id: 4, status: "pending" },
    ];
    const schema = inferSchema(records);
    const statusField = schema.fields.find((f) => f.normalizedName === "status")!;
    expect(statusField.distinctValues).toBeDefined();
    expect(statusField.distinctValues!.length).toBeLessThanOrEqual(3);
    expect(statusField.semanticHints).toContain("enum");
    expect(statusField.semanticHints).toContain("status");
  });

  it("marks sparse fields with a warning", () => {
    const records = [
      { id: 1, name: "A" },
      { id: 2, name: "B" },
      { id: 3, name: "C", optional: "sometimes" },
      { id: 4, name: "D" },
      { id: 5, name: "E" },
    ];
    const schema = inferSchema(records);
    expect(schema.warnings.some((w) => w.includes("optional"))).toBe(true);
  });

  it("detects the collection field (nested array)", () => {
    const records = [
      { id: 1, name: "A", tags: ["x", "y"] },
      { id: 2, name: "B", tags: ["z"] },
    ];
    const schema = inferSchema(records);
    expect(schema.detectedCollection).toBe("tags");
  });

  it("flags mixed-type fields with low confidence and skip suggestion", () => {
    const records = [
      { id: 1, weird: 42 },
      { id: 2, weird: "hello" },
      { id: 3, weird: { nested: true } },
      { id: 4, weird: [1, 2, 3] },
    ];
    const schema = inferSchema(records);
    const weird = schema.fields.find((f) => f.normalizedName === "weird")!;
    expect(weird.confidence).toBeLessThan(0.6);
  });
});

describe("suggestCrudMapping", () => {
  it("splits fields into identifier / readable / writable / derived / skip", () => {
    const records = [
      { id: "u1", email: "a@x.com", name: "A", status: "active", created_at: "2024-01-01T00:00:00Z" },
      { id: "u2", email: "b@y.com", name: "B", status: "inactive", created_at: "2024-01-02T00:00:00Z" },
      { id: "u3", email: "c@z.com", name: "C", status: "active", created_at: "2024-01-03T00:00:00Z" },
    ];
    const schema = inferSchema(records);
    const mapping = suggestCrudMapping(schema);
    expect(mapping.primaryKey).toBe("id");
    expect(mapping.identifier.some((f) => f.field === "id")).toBe(true);
    expect(mapping.derived.some((f) => f.field === "created_at")).toBe(true);
    expect(mapping.writable.some((f) => f.field === "email")).toBe(true);
    expect(mapping.writable.some((f) => f.field === "name")).toBe(true);
  });

  it("moves mixed-type fields to skip", () => {
    const records = [
      { id: "1", weird: 42 },
      { id: "2", weird: "hello" },
      { id: "3", weird: [1, 2] },
    ];
    const schema = inferSchema(records);
    const mapping = suggestCrudMapping(schema);
    expect(mapping.skip.some((f) => f.field === "weird")).toBe(true);
  });
});

describe("mergeSchemas", () => {
  it("unions fields from two batches", () => {
    const a = inferSchema([
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ]);
    const b = inferSchema([
      { id: 3, name: "C", email: "a@x.com" },
      { id: 4, name: "D", email: "b@y.com" },
    ]);
    const merged = mergeSchemas(a, b);
    const byName = Object.fromEntries(merged.fields.map((f) => [f.normalizedName, f]));
    expect(byName.id).toBeDefined();
    expect(byName.name).toBeDefined();
    expect(byName.email).toBeDefined();
    expect(merged.recordCount).toBe(4);
  });

  it("combines unique-rate across batches", () => {
    const a = inferSchema([{ id: 1 }, { id: 2 }]);
    const b = inferSchema([{ id: 3 }, { id: 4 }]);
    const merged = mergeSchemas(a, b);
    const idField = merged.fields.find((f) => f.normalizedName === "id")!;
    expect(idField.sampleCount).toBe(4);
  });
});

describe("summarizeSchema", () => {
  it("produces a compact human-readable summary", () => {
    const records = [
      { id: "u1", email: "a@x.com", created_at: "2024-01-01T00:00:00Z" },
      { id: "u2", email: "b@y.com", created_at: "2024-01-02T00:00:00Z" },
    ];
    const schema = inferSchema(records);
    const summary = summarizeSchema(schema);
    expect(summary).toContain("2 records");
    expect(summary).toContain("pk=id");
  });

  it("handles empty schemas", () => {
    expect(summarizeSchema(inferSchema([]))).toContain("Empty schema");
  });
});
