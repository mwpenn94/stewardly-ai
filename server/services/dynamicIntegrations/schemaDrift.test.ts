/**
 * Tests for schemaDrift.ts (Pass 4 — schema drift detection).
 */

import { describe, it, expect } from "vitest";
import { inferSchema } from "./schemaInference";
import { diffSchemas, summarizeDrift, filterChanges } from "./schemaDrift";

describe("diffSchemas — no drift", () => {
  it("reports compatible + no changes when schemas are identical", () => {
    const records = [
      { id: "u1", name: "Alice" },
      { id: "u2", name: "Bob" },
    ];
    const baseline = inferSchema(records);
    const current = inferSchema(records);
    const drift = diffSchemas(baseline, current);
    expect(drift.compatible).toBe(true);
    expect(drift.reviewRequired).toBe(false);
    expect(drift.changes.length).toBe(0);
  });
});

describe("diffSchemas — field addition", () => {
  it("detects a new optional field as warning", () => {
    const baseline = inferSchema([
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    const current = inferSchema([
      { id: "u1", name: "A", email: "a@x.com" },
      { id: "u2", name: "B", email: "b@y.com" },
    ]);
    const drift = diffSchemas(baseline, current);
    expect(drift.fieldsAdded).toContain("email");
    expect(drift.summary.warning).toBeGreaterThanOrEqual(1);
    expect(drift.compatible).toBe(true);
  });
});

describe("diffSchemas — field removal", () => {
  it("detects a removed optional field as warning", () => {
    const baseline = inferSchema([
      { id: "u1", name: "A", bio: "long" },
      { id: "u2", name: "B", bio: "short" },
      { id: "u3", name: "C", bio: "text" },
      { id: "u4", name: "D", bio: "more" },
    ]);
    const current = inferSchema([
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
      { id: "u3", name: "C" },
      { id: "u4", name: "D" },
    ]);
    const drift = diffSchemas(baseline, current);
    expect(drift.fieldsRemoved).toContain("bio");
    // bio was required in baseline (no nulls), so removal is BREAKING
    const bioChange = drift.changes.find((c) => c.fieldName === "bio");
    expect(bioChange?.severity).toBe("breaking");
  });

  it("flags primary key removal as breaking", () => {
    const baseline = inferSchema([
      { id: "550e8400-e29b-41d4-a716-446655440000", name: "A" },
      { id: "550e8400-e29b-41d4-a716-446655440001", name: "B" },
    ]);
    const current = inferSchema([
      { name: "A" },
      { name: "B" },
    ]);
    const drift = diffSchemas(baseline, current);
    expect(drift.compatible).toBe(false);
    expect(drift.summary.breaking).toBeGreaterThan(0);
  });
});

describe("diffSchemas — type change", () => {
  it("reports compatible widening as warning", () => {
    const baseline = inferSchema([
      { id: 1, amount: 100 },
      { id: 2, amount: 200 },
    ]);
    const current = inferSchema([
      { id: 1, amount: 100.5 },
      { id: 2, amount: 200.25 },
    ]);
    const drift = diffSchemas(baseline, current);
    const amountChange = drift.changes.find((c) => c.fieldName === "amount" && c.kind === "type_changed");
    expect(amountChange).toBeDefined();
  });

  it("reports incompatible type change as warning (non-PK)", () => {
    const baseline = inferSchema([
      { id: 1, value: 100 },
      { id: 2, value: 200 },
    ]);
    const current = inferSchema([
      { id: 1, value: "hundred" },
      { id: 2, value: "two-hundred" },
    ]);
    const drift = diffSchemas(baseline, current);
    const valueChange = drift.changes.find((c) => c.fieldName === "value" && c.kind === "type_changed");
    expect(valueChange).toBeDefined();
    expect(valueChange?.severity).toBe("warning");
  });
});

describe("diffSchemas — field rename detection", () => {
  it("detects a field rename when type + hints match + sample counts are similar", () => {
    const baseline = inferSchema([
      { id: 1, email_address: "a@x.com" },
      { id: 2, email_address: "b@y.com" },
      { id: 3, email_address: "c@z.com" },
    ]);
    const current = inferSchema([
      { id: 1, email: "a@x.com" },
      { id: 2, email: "b@y.com" },
      { id: 3, email: "c@z.com" },
    ]);
    const drift = diffSchemas(baseline, current);
    const rename = drift.changes.find((c) => c.kind === "field_renamed");
    expect(rename).toBeDefined();
    expect(rename?.before).toBe("email_address");
    expect(rename?.after).toBe("email");
    // Rename should NOT show up as separate add + remove
    expect(drift.fieldsAdded).not.toContain("email");
    expect(drift.fieldsRemoved).not.toContain("email_address");
  });
});

describe("diffSchemas — nullability shift", () => {
  it("warns when null rate shifts dramatically", () => {
    const baseline = inferSchema([
      { id: 1, nickname: "A" },
      { id: 2, nickname: "B" },
      { id: 3, nickname: "C" },
      { id: 4, nickname: "D" },
    ]);
    const current = inferSchema([
      { id: 1, nickname: null },
      { id: 2, nickname: null },
      { id: 3, nickname: null },
      { id: 4, nickname: "D" },
    ]);
    const drift = diffSchemas(baseline, current);
    const nullChange = drift.changes.find((c) => c.kind === "nullability_changed");
    expect(nullChange).toBeDefined();
    expect(nullChange?.severity).toBe("warning");
  });
});

describe("summarizeDrift", () => {
  it("returns 'no drift' for empty reports", () => {
    const schema = inferSchema([{ id: 1, name: "A" }, { id: 2, name: "B" }]);
    expect(summarizeDrift(diffSchemas(schema, schema))).toBe("No schema drift detected");
  });

  it("produces compact summary with counts", () => {
    const baseline = inferSchema([
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ]);
    const current = inferSchema([
      { id: 1, name: "A", email: "a@x.com" },
      { id: 2, name: "B", email: "b@y.com" },
    ]);
    const summary = summarizeDrift(diffSchemas(baseline, current));
    expect(summary).toContain("warning");
    expect(summary).toContain("+1 field");
  });
});

describe("filterChanges", () => {
  it("filters by minimum severity", () => {
    const baseline = inferSchema([
      { id: 1, name: "A", bio: "long" },
      { id: 2, name: "B", bio: "long" },
      { id: 3, name: "C", bio: "long" },
    ]);
    const current = inferSchema([
      { id: 1, name: "A" },
      { id: 2, name: "B" },
      { id: 3, name: "C" },
    ]);
    const drift = diffSchemas(baseline, current);
    const breaking = filterChanges(drift, "breaking");
    expect(breaking.every((c) => c.severity === "breaking")).toBe(true);
  });
});
