/**
 * Tests for crmCanonicalMap.ts (Pass 6 — CRM canonical field auto-mapping).
 */

import { describe, it, expect } from "vitest";
import { inferSchema } from "./schemaInference";
import { mapToCanonicalContact, summarizeMapping } from "./crmCanonicalMap";

describe("mapToCanonicalContact — exact synonym matches", () => {
  it("maps email_address → email with high confidence", () => {
    const schema = inferSchema([
      { id: "u1", email_address: "a@x.com", first_name: "Alice", last_name: "Smith" },
      { id: "u2", email_address: "b@y.com", first_name: "Bob", last_name: "Jones" },
    ]);
    const result = mapToCanonicalContact(schema);
    const emailMatch = result.matches.find((m) => m.canonicalField === "email");
    expect(emailMatch).toBeDefined();
    expect(emailMatch?.sourceField).toBe("email_address");
    expect(emailMatch?.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it("maps first_name/last_name to firstName/lastName", () => {
    const schema = inferSchema([
      { id: "u1", first_name: "Alice", last_name: "Smith" },
      { id: "u2", first_name: "Bob", last_name: "Jones" },
    ]);
    const result = mapToCanonicalContact(schema);
    expect(result.matches.find((m) => m.canonicalField === "firstName")?.sourceField).toBe("first_name");
    expect(result.matches.find((m) => m.canonicalField === "lastName")?.sourceField).toBe("last_name");
  });

  it("maps phone_number → phone", () => {
    const schema = inferSchema([
      { id: "u1", phone_number: "+1 415-555-1234" },
      { id: "u2", phone_number: "+1 212-555-5678" },
    ]);
    const result = mapToCanonicalContact(schema);
    expect(result.matches.find((m) => m.canonicalField === "phone")?.sourceField).toBe("phone_number");
  });

  it("maps company_name → company", () => {
    const schema = inferSchema([
      { id: "u1", company_name: "Acme Inc" },
      { id: "u2", company_name: "Globex" },
    ]);
    const result = mapToCanonicalContact(schema);
    expect(result.matches.find((m) => m.canonicalField === "company")?.sourceField).toBe("company_name");
  });
});

describe("mapToCanonicalContact — value pattern matching", () => {
  it("detects LinkedIn URL by pattern", () => {
    const schema = inferSchema([
      { id: "u1", profile: "https://www.linkedin.com/in/alice" },
      { id: "u2", profile: "https://www.linkedin.com/in/bob" },
    ]);
    const result = mapToCanonicalContact(schema);
    const match = result.matches.find((m) => m.canonicalField === "linkedinUrl");
    expect(match).toBeDefined();
    expect(match?.sourceField).toBe("profile");
  });
});

describe("mapToCanonicalContact — semantic hint matching", () => {
  it("matches via semantic hint when name is weird", () => {
    const schema = inferSchema([
      { id: "u1", xyz_contact: "alice@example.com" },
      { id: "u2", xyz_contact: "bob@example.com" },
    ]);
    const result = mapToCanonicalContact(schema);
    // The field has email semantic hint even though the name doesn't match email synonyms
    const match = result.matches.find((m) => m.canonicalField === "email");
    expect(match?.sourceField).toBe("xyz_contact");
  });
});

describe("mapToCanonicalContact — greedy non-collision", () => {
  it("doesn't assign the same source field to two canonical fields", () => {
    const schema = inferSchema([
      { id: "u1", name: "Alice Smith" },
      { id: "u2", name: "Bob Jones" },
    ]);
    const result = mapToCanonicalContact(schema);
    // "name" could match firstName/lastName/fullName — only one should win
    const nameMatches = result.matches.filter((m) => m.sourceField === "name");
    expect(nameMatches.length).toBe(1);
  });
});

describe("mapToCanonicalContact — missing required", () => {
  it("reports missing email (the only required field)", () => {
    const schema = inferSchema([
      { id: 1, first_name: "Alice" },
      { id: 2, first_name: "Bob" },
    ]);
    const result = mapToCanonicalContact(schema);
    expect(result.missingRequired).toContain("email");
  });

  it("does NOT report missing when email is present", () => {
    const schema = inferSchema([
      { id: 1, email: "a@x.com" },
      { id: 2, email: "b@y.com" },
    ]);
    const result = mapToCanonicalContact(schema);
    expect(result.missingRequired).not.toContain("email");
  });
});

describe("mapToCanonicalContact — unmapped source fields", () => {
  it("lists fields that didn't match any canonical", () => {
    const schema = inferSchema([
      { id: 1, email: "a@x.com", custom_score: 42, weird_field: "whatever" },
      { id: 2, email: "b@y.com", custom_score: 99, weird_field: "thing" },
    ]);
    const result = mapToCanonicalContact(schema);
    expect(result.unmappedSourceFields).toContain("custom_score");
    expect(result.unmappedSourceFields).toContain("weird_field");
  });
});

describe("mapToCanonicalContact — timestamps", () => {
  it("maps created_at and updated_at via semantic hints", () => {
    const schema = inferSchema([
      { id: 1, email: "a@x.com", created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-05T00:00:00Z" },
      { id: 2, email: "b@y.com", created_at: "2024-02-01T00:00:00Z", updated_at: "2024-02-05T00:00:00Z" },
    ]);
    const result = mapToCanonicalContact(schema);
    expect(result.matches.find((m) => m.canonicalField === "createdAt")?.sourceField).toBe("created_at");
    expect(result.matches.find((m) => m.canonicalField === "updatedAt")?.sourceField).toBe("updated_at");
  });
});

describe("mapToCanonicalContact — confidence", () => {
  it("returns high confidence for well-matched schema", () => {
    const schema = inferSchema([
      { id: "u1", email: "a@x.com", first_name: "Alice", last_name: "Smith", phone: "+1 415-555-1234" },
      { id: "u2", email: "b@y.com", first_name: "Bob", last_name: "Jones", phone: "+1 212-555-5678" },
    ]);
    const result = mapToCanonicalContact(schema);
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it("returns lower confidence when required fields are missing", () => {
    const schema = inferSchema([
      { id: 1, some_field: "x" },
      { id: 2, some_field: "y" },
    ]);
    const result = mapToCanonicalContact(schema);
    // email is required and missing → penalized via requiredCoverage = 0
    // even if `id` matches externalId (non-required) with confidence 1.0,
    // the overall confidence should be ≤ 0.6 (0.6 * 1.0 + 0.4 * 0 = 0.6)
    expect(result.confidence).toBeLessThanOrEqual(0.6);
    expect(result.missingRequired).toContain("email");
  });
});

describe("summarizeMapping", () => {
  it("produces compact one-liner", () => {
    const schema = inferSchema([
      { id: "u1", email: "a@x.com", first_name: "Alice" },
      { id: "u2", email: "b@y.com", first_name: "Bob" },
    ]);
    const result = mapToCanonicalContact(schema);
    const summary = summarizeMapping(result);
    expect(summary).toContain("contact");
    expect(summary).toContain("mapped");
    expect(summary).toContain("conf=");
  });
});
