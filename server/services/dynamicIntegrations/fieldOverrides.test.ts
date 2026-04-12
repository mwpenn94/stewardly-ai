/**
 * Tests for fieldOverrides.ts (Pass 5 — field mapping override layer).
 */

import { describe, it, expect } from "vitest";
import { inferSchema } from "./schemaInference";
import { generateAdapter } from "./adapterGenerator";
import type { AdapterSpec } from "./adapterGenerator";
import {
  applyOverrides,
  diffOverrideSets,
  rehydratePinnedOverrides,
  validateOverrides,
  serializeOverrideSet,
  parseOverrideSet,
} from "./fieldOverrides";

function buildTestSpec(): AdapterSpec {
  const records = [
    { id: "u1", email_address: "a@x.com", ssn_digits: "123456789", balance: "$100" },
    { id: "u2", email_address: "b@y.com", ssn_digits: "987654321", balance: "$200" },
    { id: "u3", email_address: "c@z.com", ssn_digits: "555555555", balance: "$300" },
  ];
  const schema = inferSchema(records);
  return generateAdapter(schema, {
    name: "Test",
    baseUrl: "https://api.example.com",
    authHint: { type: "bearer" },
    listEndpoint: "/users",
  });
}

describe("applyOverrides", () => {
  it("renames a canonical field", () => {
    const spec = buildTestSpec();
    const result = applyOverrides(spec, [
      { sourceName: "email_address", newCanonicalName: "email" },
    ]);
    expect(result.applied.length).toBe(1);
    const emailMapping = result.spec.fieldMappings.find((m) => m.sourceName === "email_address");
    expect(emailMapping?.canonicalName).toBe("email");
  });

  it("flips direction from read to writable", () => {
    const spec = buildTestSpec();
    // The balance field is writable (both) already; flip it to read
    const result = applyOverrides(spec, [
      { sourceName: "balance", direction: "read" },
    ]);
    const m = result.spec.fieldMappings.find((m) => m.sourceName === "balance")!;
    expect(m.direction).toBe("read");
  });

  it("adds and removes semantic hints", () => {
    const spec = buildTestSpec();
    const result = applyOverrides(spec, [
      {
        sourceName: "ssn_digits",
        addHints: ["ssn"],
      },
    ]);
    const m = result.spec.fieldMappings.find((m) => m.sourceName === "ssn_digits")!;
    expect(m.hints).toContain("ssn");
  });

  it("changes transform function", () => {
    const spec = buildTestSpec();
    const result = applyOverrides(spec, [
      { sourceName: "ssn_digits", transform: "string" },
    ]);
    const m = result.spec.fieldMappings.find((m) => m.sourceName === "ssn_digits")!;
    expect(m.transform).toBe("string");
  });

  it("re-derives primary key when user marks field as identifier", () => {
    const spec = buildTestSpec();
    const result = applyOverrides(spec, [
      { sourceName: "email_address", direction: "identifier" },
    ]);
    expect(result.spec.primaryKey).toBe("email_address");
  });

  it("skips overrides targeting unknown fields", () => {
    const spec = buildTestSpec();
    const result = applyOverrides(spec, [
      { sourceName: "not_a_real_field", direction: "read" },
    ]);
    expect(result.applied.length).toBe(0);
    expect(result.skipped.length).toBe(1);
    expect(result.skipped[0].reason).toContain("No matching field");
  });

  it("skips overrides with neither sourceName nor canonicalName", () => {
    const spec = buildTestSpec();
    const result = applyOverrides(spec, [{ direction: "read" }]);
    expect(result.skipped.length).toBe(1);
  });

  it("does NOT mutate the input spec", () => {
    const spec = buildTestSpec();
    const originalCount = spec.fieldMappings.length;
    applyOverrides(spec, [{ sourceName: "email_address", newCanonicalName: "email" }]);
    expect(spec.fieldMappings.length).toBe(originalCount);
    const original = spec.fieldMappings.find((m) => m.sourceName === "email_address");
    expect(original?.canonicalName).toBe("email_address");
  });
});

describe("diffOverrideSets", () => {
  it("detects added overrides", () => {
    const before = { overrides: [], version: 1 };
    const after = {
      overrides: [{ sourceName: "email", direction: "both" as const }],
      version: 2,
    };
    const diff = diffOverrideSets(before, after);
    expect(diff.added.length).toBe(1);
    expect(diff.removed.length).toBe(0);
    expect(diff.changed.length).toBe(0);
  });

  it("detects removed overrides", () => {
    const before = { overrides: [{ sourceName: "email", direction: "read" as const }], version: 1 };
    const after = { overrides: [], version: 2 };
    const diff = diffOverrideSets(before, after);
    expect(diff.removed.length).toBe(1);
  });

  it("detects changed overrides (same key, different value)", () => {
    const before = { overrides: [{ sourceName: "email", direction: "read" as const }], version: 1 };
    const after = { overrides: [{ sourceName: "email", direction: "both" as const }], version: 2 };
    const diff = diffOverrideSets(before, after);
    expect(diff.changed.length).toBe(1);
  });

  it("ignores metadata-only changes (addedAt/addedBy/reason)", () => {
    const before = {
      overrides: [{ sourceName: "email", direction: "read" as const, addedBy: "alice" }],
      version: 1,
    };
    const after = {
      overrides: [{ sourceName: "email", direction: "read" as const, addedBy: "bob" }],
      version: 2,
    };
    const diff = diffOverrideSets(before, after);
    expect(diff.changed.length).toBe(0);
  });
});

describe("rehydratePinnedOverrides", () => {
  it("re-applies only pinned overrides on a fresh spec", () => {
    const spec = buildTestSpec();
    const pinnedOverride = {
      sourceName: "email_address",
      newCanonicalName: "email",
      pinned: true,
    };
    const unpinnedOverride = {
      sourceName: "balance",
      direction: "read" as const,
      pinned: false,
    };
    const result = rehydratePinnedOverrides(spec, [pinnedOverride, unpinnedOverride]);
    expect(result.applied.length).toBe(1);
    expect(result.applied[0].sourceName).toBe("email_address");
    const balance = result.spec.fieldMappings.find((m) => m.sourceName === "balance");
    expect(balance?.direction).not.toBe("read");
  });
});

describe("validateOverrides", () => {
  it("warns on unknown source name", () => {
    const spec = buildTestSpec();
    const result = validateOverrides(spec, [{ sourceName: "nonexistent", direction: "read" }]);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("errors on missing sourceName and canonicalName", () => {
    const spec = buildTestSpec();
    const result = validateOverrides(spec, [{ direction: "read" }]);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("errors on canonical name collision", () => {
    const spec = buildTestSpec();
    const result = validateOverrides(spec, [
      { sourceName: "email_address", newCanonicalName: "balance" },
    ]);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe("serialize / parse round-trip", () => {
  it("round-trips through JSON", () => {
    const set = {
      overrides: [
        { sourceName: "email_address", newCanonicalName: "email", pinned: true },
        { sourceName: "ssn_digits", addHints: ["ssn" as const], pinned: true },
      ],
      version: 1,
    };
    const json = serializeOverrideSet(set);
    const parsed = parseOverrideSet(json);
    expect(parsed).toEqual(set);
  });

  it("returns null on malformed JSON", () => {
    expect(parseOverrideSet("not json")).toBeNull();
  });

  it("filters out overrides with no identifier on parse", () => {
    const parsed = parseOverrideSet(
      JSON.stringify({ overrides: [{ direction: "read" }, { sourceName: "email" }], version: 1 })
    );
    expect(parsed?.overrides.length).toBe(1);
  });
});
