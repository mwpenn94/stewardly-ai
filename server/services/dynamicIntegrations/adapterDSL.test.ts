/**
 * Tests for adapterDSL.ts (Pass 12 — portable adapter spec serialization).
 */

import { describe, it, expect } from "vitest";
import { inferSchema } from "./schemaInference";
import { generateAdapter } from "./adapterGenerator";
import {
  canonicalJson,
  fingerprintSpec,
  shortFingerprint,
  serializeSpec,
  parseSpec,
  parseSerialized,
  bumpVersion,
} from "./adapterDSL";

function buildSpec() {
  const schema = inferSchema([
    { id: "u1", email: "a@x.com", name: "Alice" },
    { id: "u2", email: "b@y.com", name: "Bob" },
  ]);
  return generateAdapter(schema, {
    name: "DSLTest",
    baseUrl: "https://api.example.com",
    authHint: { type: "bearer" },
    listEndpoint: "/users",
  });
}

describe("canonicalJson", () => {
  it("sorts object keys alphabetically", () => {
    const a = { b: 1, a: 2, c: 3 };
    const b = { c: 3, a: 2, b: 1 };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });

  it("preserves array order (order is semantic)", () => {
    expect(canonicalJson([3, 1, 2])).not.toBe(canonicalJson([1, 2, 3]));
  });

  it("handles nested structures", () => {
    const canonical = canonicalJson({
      z: { beta: 1, alpha: 2 },
      a: [{ y: 2, x: 1 }],
    });
    expect(canonical).toBe('{"a":[{"x":1,"y":2}],"z":{"alpha":2,"beta":1}}');
  });

  it("handles null and undefined", () => {
    expect(canonicalJson(null)).toBe("null");
    expect(canonicalJson(undefined)).toBe("null");
  });
});

describe("fingerprintSpec", () => {
  it("is stable across identical specs", () => {
    const a = buildSpec();
    const b = buildSpec();
    expect(fingerprintSpec(a)).toBe(fingerprintSpec(b));
  });

  it("differs for different specs", () => {
    const schemaA = inferSchema([{ id: "1", foo: "a" }, { id: "2", foo: "b" }]);
    const schemaB = inferSchema([{ id: "1", bar: "a" }, { id: "2", bar: "b" }]);
    const specA = generateAdapter(schemaA, {
      name: "A",
      baseUrl: "https://a.example.com",
      authHint: { type: "bearer" },
      listEndpoint: "/x",
    });
    const specB = generateAdapter(schemaB, {
      name: "B",
      baseUrl: "https://b.example.com",
      authHint: { type: "bearer" },
      listEndpoint: "/y",
    });
    expect(fingerprintSpec(specA)).not.toBe(fingerprintSpec(specB));
  });

  it("shortFingerprint returns 12 hex chars", () => {
    const spec = buildSpec();
    const sf = shortFingerprint(spec);
    expect(sf).toHaveLength(12);
    expect(sf).toMatch(/^[a-f0-9]{12}$/);
  });
});

describe("serializeSpec → parseSerialized round-trip", () => {
  it("round-trips a spec through serialization", () => {
    const spec = buildSpec();
    const serialized = serializeSpec(spec);
    expect(serialized.dslVersion).toBe(1);
    expect(serialized.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    const result = parseSerialized(JSON.stringify(serialized));
    expect(result.errors).toHaveLength(0);
    expect(result.spec).toBeTruthy();
    expect(result.spec?.name).toBe("DSLTest");
  });

  it("detects fingerprint tampering", () => {
    const spec = buildSpec();
    const serialized = serializeSpec(spec);
    const tampered = { ...serialized, fingerprint: "0".repeat(64) };
    const result = parseSerialized(JSON.stringify(tampered));
    expect(result.warnings.some((w) => w.includes("Fingerprint mismatch"))).toBe(true);
  });

  it("rejects unsupported DSL versions", () => {
    const spec = buildSpec();
    const serialized = serializeSpec(spec);
    const futureSpec = { ...serialized, dslVersion: 999 };
    const result = parseSerialized(JSON.stringify(futureSpec));
    expect(result.errors.some((e) => e.includes("Unsupported DSL version"))).toBe(true);
  });
});

describe("parseSpec — validation", () => {
  it("accepts a well-formed spec", () => {
    const spec = buildSpec();
    const result = parseSpec(spec);
    expect(result.errors).toHaveLength(0);
    expect(result.spec).toBeTruthy();
  });

  it("rejects non-object input", () => {
    expect(parseSpec("not json").errors.length).toBeGreaterThan(0);
    expect(parseSpec([]).errors.length).toBeGreaterThan(0);
    expect(parseSpec(42).errors.length).toBeGreaterThan(0);
  });

  it("reports missing required keys", () => {
    const result = parseSpec({ name: "X" });
    const missing = result.errors.filter((e) => e.includes("Missing required"));
    expect(missing.length).toBeGreaterThan(0);
  });

  it("rejects invalid auth type", () => {
    const spec = buildSpec();
    const bad = { ...spec, auth: { ...spec.auth, type: "made-up" } };
    const result = parseSpec(bad);
    expect(result.errors.some((e) => e.includes("auth.type"))).toBe(true);
  });

  it("rejects invalid HTTP method in endpoint", () => {
    const spec = buildSpec();
    const bad = {
      ...spec,
      endpoints: {
        ...spec.endpoints,
        list: { ...spec.endpoints.list!, method: "FETCH" as unknown as "GET" },
      },
    };
    const result = parseSpec(bad);
    expect(result.errors.some((e) => e.includes("endpoints.list.method"))).toBe(true);
  });

  it("rejects invalid fieldMapping direction", () => {
    const spec = buildSpec();
    const bad = {
      ...spec,
      fieldMappings: [
        { ...spec.fieldMappings[0], direction: "invalid" as unknown as "read" },
      ],
    };
    const result = parseSpec(bad);
    expect(result.errors.some((e) => e.includes("direction"))).toBe(true);
  });

  it("warns on non-https baseUrl", () => {
    const spec = buildSpec();
    const bad = { ...spec, baseUrl: "ftp://example.com" };
    const result = parseSpec(bad);
    expect(result.warnings.some((w) => w.includes("baseUrl"))).toBe(true);
  });

  it("accepts JSON string input", () => {
    const spec = buildSpec();
    const result = parseSpec(JSON.stringify(spec));
    expect(result.errors).toHaveLength(0);
  });

  it("rejects malformed JSON", () => {
    const result = parseSpec("{not valid}");
    expect(result.errors.some((e) => e.includes("Invalid JSON"))).toBe(true);
  });
});

describe("bumpVersion", () => {
  it("bumps major for breaking changes", () => {
    expect(bumpVersion("1.2.3", "breaking")).toBe("2.0.0");
  });

  it("bumps minor for additive changes", () => {
    expect(bumpVersion("1.2.3", "additive")).toBe("1.3.0");
  });

  it("bumps patch for fixes", () => {
    expect(bumpVersion("1.2.3", "fix")).toBe("1.2.4");
  });

  it("preserves trailing fingerprint suffix", () => {
    expect(bumpVersion("0.1.0-abc123", "additive")).toBe("0.2.0-abc123");
  });

  it("handles malformed version with a default", () => {
    expect(bumpVersion("not-a-version", "breaking")).toBe("1.0.0");
  });
});
