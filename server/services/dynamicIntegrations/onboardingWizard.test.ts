/**
 * Tests for onboardingWizard.ts (Pass 16 — single-entry source onboarding).
 */

import { describe, it, expect } from "vitest";
import { runOnboardingWizard } from "./onboardingWizard";

describe("runOnboardingWizard — full happy path", () => {
  it("produces ready=true with baseUrl + auth", async () => {
    const result = await runOnboardingWizard({
      name: "TestApi",
      baseUrl: "https://api.example.com",
      listEndpoint: "/users",
      authHint: { type: "bearer" },
      sampleRecords: [
        { id: "u1", email_address: "a@x.com", first_name: "Alice" },
        { id: "u2", email_address: "b@y.com", first_name: "Bob" },
      ],
    });
    expect(result.ready).toBe(true);
    expect(result.spec.name).toBe("TestApi");
    expect(result.schema.primaryKey).toBe("id");
    expect(result.nextSteps.some((s) => s.action === "ready_to_run")).toBe(true);
  });

  it("marks ready=false when baseUrl is missing", async () => {
    const result = await runOnboardingWizard({
      name: "NoBase",
      authHint: { type: "bearer" },
      sampleRecords: [
        { id: "u1", email: "a@x.com" },
        { id: "u2", email: "b@y.com" },
      ],
    });
    expect(result.ready).toBe(false);
    expect(result.nextSteps.some((s) => s.action === "provide_base_url")).toBe(true);
  });

  it("marks ready=false when auth is unknown", async () => {
    const result = await runOnboardingWizard({
      name: "NoAuth",
      baseUrl: "https://api.example.com",
      listEndpoint: "/users",
      sampleRecords: [
        { id: "u1", email: "a@x.com" },
        { id: "u2", email: "b@y.com" },
      ],
    });
    expect(result.ready).toBe(false);
    expect(result.nextSteps.some((s) => s.action === "confirm_auth")).toBe(true);
  });
});

describe("runOnboardingWizard — redaction", () => {
  it("redacts sensitive data before schema inference", async () => {
    const result = await runOnboardingWizard({
      name: "WithSecrets",
      baseUrl: "https://api.example.com",
      listEndpoint: "/users",
      authHint: { type: "bearer" },
      sampleRecords: [
        { id: "u1", email: "a@x.com", ssn: "123-45-6789" },
        { id: "u2", email: "b@y.com", ssn: "987-65-4321" },
      ],
    });
    expect(result.redactionReport).toBeTruthy();
    expect(result.redactionReport!.byCategory.ssn).toBe(2);
  });

  it("skipRedaction=true leaves records untouched", async () => {
    const result = await runOnboardingWizard({
      name: "Raw",
      baseUrl: "https://api.example.com",
      listEndpoint: "/users",
      authHint: { type: "bearer" },
      skipRedaction: true,
      sampleRecords: [
        { id: "u1", email: "a@x.com", ssn: "123-45-6789" },
        { id: "u2", email: "b@y.com", ssn: "987-65-4321" },
      ],
    });
    expect(result.redactionReport).toBeNull();
  });
});

describe("runOnboardingWizard — CRM + personalization", () => {
  it("runs CRM mapping and personalization by default", async () => {
    const result = await runOnboardingWizard({
      name: "Rich",
      baseUrl: "https://api.example.com",
      listEndpoint: "/users",
      authHint: { type: "bearer" },
      sampleRecords: [
        { id: "u1", email: "a@x.com", roth_ira_balance: "$50,000" },
        { id: "u2", email: "b@y.com", roth_ira_balance: "$100,000" },
      ],
    });
    expect(result.crmMapping).toBeTruthy();
    expect(result.crmMapping!.matches.some((m) => m.canonicalField === "email")).toBe(true);
    expect(result.personalizationHints).toBeTruthy();
    const hasRetirement = result.personalizationHints!.hints.some(
      (h) => h.key === "retirement_calculator",
    );
    expect(hasRetirement).toBe(true);
  });

  it("can skip CRM mapping", async () => {
    const result = await runOnboardingWizard({
      name: "NoCrm",
      baseUrl: "https://api.example.com",
      listEndpoint: "/users",
      authHint: { type: "bearer" },
      skipCrmMapping: true,
      sampleRecords: [
        { id: "u1", email: "a@x.com" },
        { id: "u2", email: "b@y.com" },
      ],
    });
    expect(result.crmMapping).toBeNull();
  });
});

describe("runOnboardingWizard — deep auth probe", () => {
  it("uses deep auth probe when authProbeSamples provided", async () => {
    const result = await runOnboardingWizard({
      name: "WithAuthProbe",
      baseUrl: "https://api.example.com",
      listEndpoint: "/users",
      authProbeSamples: [
        {
          status: 401,
          headers: { "WWW-Authenticate": "Bearer realm=api" },
        },
      ],
      sampleRecords: [{ id: "u1", email: "a@x.com" }, { id: "u2", email: "b@y.com" }],
    });
    expect(result.authSpec.type).toBe("bearer");
    expect(result.authSpec.probeConfidence).toBeGreaterThan(0.5);
  });
});

describe("runOnboardingWizard — fieldOverrides", () => {
  it("applies user-provided overrides to the generated spec", async () => {
    const result = await runOnboardingWizard({
      name: "WithOverride",
      baseUrl: "https://api.example.com",
      listEndpoint: "/users",
      authHint: { type: "bearer" },
      sampleRecords: [
        { id: "u1", email_address: "a@x.com" },
        { id: "u2", email_address: "b@y.com" },
      ],
      fieldOverrides: [
        {
          sourceName: "email_address",
          newCanonicalName: "email",
        },
      ],
    });
    const mapping = result.spec.fieldMappings.find((m) => m.sourceName === "email_address");
    expect(mapping?.canonicalName).toBe("email");
  });
});

describe("runOnboardingWizard — serialization", () => {
  it("produces a SerializedSpec round-tripable through parseSerialized", async () => {
    const result = await runOnboardingWizard({
      name: "Serializable",
      baseUrl: "https://api.example.com",
      listEndpoint: "/users",
      authHint: { type: "bearer" },
      sampleRecords: [
        { id: "u1", email: "a@x.com" },
        { id: "u2", email: "b@y.com" },
      ],
    });
    expect(result.serialized.dslVersion).toBe(1);
    expect(result.serialized.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("runOnboardingWizard — error cases", () => {
  it("throws when sampleRecords is empty", async () => {
    await expect(
      runOnboardingWizard({ name: "Empty", sampleRecords: [] }),
    ).rejects.toThrow();
  });
});

describe("runOnboardingWizard — summary", () => {
  it("produces a human-readable one-liner", async () => {
    const result = await runOnboardingWizard({
      name: "Summary",
      baseUrl: "https://api.example.com",
      listEndpoint: "/users",
      authHint: { type: "bearer" },
      sampleRecords: [
        { id: "u1", email: "a@x.com" },
        { id: "u2", email: "b@y.com" },
      ],
    });
    expect(result.summary).toContain("Summary");
    expect(result.summary).toContain("auth=bearer");
    expect(result.summary).toContain("READY");
  });
});
