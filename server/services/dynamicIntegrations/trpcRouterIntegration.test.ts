/**
 * Pass 19 — tRPC router integration tests for the Pass 18 wiring.
 *
 * These tests bypass HTTP and use tRPC's createCaller to hit the
 * integrationsRouter procedures directly. They verify that the procedures:
 *   1. Are authenticated (reject anonymous callers)
 *   2. Are zod-validated (reject malformed input)
 *   3. Route through to the underlying dynamicIntegrations services
 *   4. Return the expected shape for the happy path
 */

import { describe, it, expect } from "vitest";
import { integrationsRouter } from "../../routers/integrations";
import type { TrpcContext } from "../../_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 9999,
    openId: "test-dynint-user",
    email: "dynint@test.com",
    name: "Dynamic Integrations Test User",
    role: "user",
    avatarUrl: null,
    createdAt: new Date(),
    suitabilityCompleted: false,
    ...overrides,
  } as AuthenticatedUser;
}

function createCaller(user: AuthenticatedUser | null = null) {
  return integrationsRouter.createCaller({
    user,
    req: {} as any,
    res: {} as any,
  });
}

// ─── parseOnboardPrompt ──────────────────────────────────────────────────

describe("integrationsRouter.parseOnboardPrompt", () => {
  it("extracts auth + URL + endpoint from a rich prompt", async () => {
    const caller = createCaller(createUser());
    const result = await caller.parseOnboardPrompt({
      prompt: "Onboard Acme from https://api.acme.com/v2 with bearer auth, endpoint /users",
    });
    expect(result.parsed.baseUrl).toBe("https://api.acme.com");
    expect(result.parsed.authHint?.type).toBe("bearer");
    expect(result.parsed.listEndpoint).toBe("/users");
    expect(result.summary).toContain("auth=bearer");
  });

  it("rejects anonymous callers", async () => {
    const caller = createCaller(null);
    await expect(
      caller.parseOnboardPrompt({ prompt: "Any prompt" }),
    ).rejects.toThrow();
  });

  it("rejects empty prompt via zod", async () => {
    const caller = createCaller(createUser());
    await expect(
      caller.parseOnboardPrompt({ prompt: "" }),
    ).rejects.toThrow();
  });
});

// ─── detectDrift ─────────────────────────────────────────────────────────

describe("integrationsRouter.detectDrift", () => {
  it("detects breaking PK removal", async () => {
    const caller = createCaller(createUser());
    const result = await caller.detectDrift({
      baselineRecords: [
        { id: "550e8400-e29b-41d4-a716-446655440000", name: "A" },
        { id: "550e8400-e29b-41d4-a716-446655440001", name: "B" },
      ],
      currentRecords: [{ name: "A" }, { name: "B" }],
    });
    expect(result.report.compatible).toBe(false);
    expect(result.report.summary.breaking).toBeGreaterThan(0);
  });

  it("reports no drift for identical records", async () => {
    const caller = createCaller(createUser());
    const records = [
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ];
    const result = await caller.detectDrift({
      baselineRecords: records,
      currentRecords: records,
    });
    expect(result.report.changes.length).toBe(0);
  });

  it("rejects anonymous callers", async () => {
    const caller = createCaller(null);
    await expect(
      caller.detectDrift({
        baselineRecords: [{ id: 1 }],
        currentRecords: [{ id: 2 }],
      }),
    ).rejects.toThrow();
  });
});

// ─── extractHints ────────────────────────────────────────────────────────

describe("integrationsRouter.extractHints", () => {
  it("extracts retirement hint from sample data", async () => {
    const caller = createCaller(createUser());
    const result = await caller.extractHints({
      records: [
        { id: "u1", roth_ira_balance: "$50,000" },
        { id: "u2", roth_ira_balance: "$100,000" },
      ],
    });
    expect(
      result.result.hints.some((h: { key: string }) => h.key === "retirement_calculator"),
    ).toBe(true);
  });

  it("honors minConfidence filter", async () => {
    const caller = createCaller(createUser());
    const result = await caller.extractHints({
      records: [
        { id: 1, mortgage_balance: 300000 },
        { id: 2, mortgage_balance: 450000 },
      ],
      minConfidence: 0.9, // debt_exposure is 0.7, should be filtered out
    });
    expect(
      result.result.hints.some((h: { key: string }) => h.key === "debt_exposure"),
    ).toBe(false);
  });
});

// ─── probeAuth ───────────────────────────────────────────────────────────

describe("integrationsRouter.probeAuth", () => {
  it("detects bearer from WWW-Authenticate header", async () => {
    const caller = createCaller(createUser());
    const result = await caller.probeAuth({
      samples: [
        { status: 401, headers: { "WWW-Authenticate": "Bearer realm=api" } },
      ],
    });
    expect(result.result.type).toBe("bearer");
    expect(result.result.probeConfidence).toBeGreaterThan(0.5);
  });

  it("detects api_key_header from error body", async () => {
    const caller = createCaller(createUser());
    const result = await caller.probeAuth({
      samples: [
        {
          status: 401,
          headers: {},
          body: { error: "Invalid API key" },
        },
      ],
    });
    expect(result.result.type).toBe("api_key_header");
  });
});

// ─── onboardSource ───────────────────────────────────────────────────────

describe("integrationsRouter.onboardSource", () => {
  it("returns a ready=true result with baseUrl + bearer auth", async () => {
    const caller = createCaller(createUser());
    const result = await caller.onboardSource({
      sampleRecords: [
        { id: "u1", email_address: "a@x.com", first_name: "Alice" },
        { id: "u2", email_address: "b@y.com", first_name: "Bob" },
      ],
      name: "TRPCWiredTest",
      baseUrl: "https://api.test.com",
      listEndpoint: "/users",
      authHint: { type: "bearer" },
    });
    expect(result.ready).toBe(true);
    expect(result.name).toBe("TRPCWiredTest");
    expect(result.schema.primaryKey).toBe("id");
    expect(result.spec.name).toBe("TRPCWiredTest");
  });

  it("reports next_steps when baseUrl missing", async () => {
    const caller = createCaller(createUser());
    const result = await caller.onboardSource({
      sampleRecords: [
        { id: "u1", email: "a@x.com" },
        { id: "u2", email: "b@y.com" },
      ],
      name: "MissingBase",
      authHint: { type: "bearer" },
    });
    expect(result.ready).toBe(false);
    expect(
      result.nextSteps.some((s: { action: string }) => s.action === "provide_base_url"),
    ).toBe(true);
  });

  it("runs redaction on sensitive fields", async () => {
    const caller = createCaller(createUser());
    const result = await caller.onboardSource({
      sampleRecords: [
        { id: "u1", email: "a@x.com", ssn: "123-45-6789" },
        { id: "u2", email: "b@y.com", ssn: "987-65-4321" },
      ],
      name: "WithSecrets",
      baseUrl: "https://api.test.com",
      listEndpoint: "/users",
      authHint: { type: "bearer" },
    });
    expect(result.redactionReport).toBeTruthy();
    expect(result.redactionReport!.byCategory.ssn).toBe(2);
  });

  it("rejects anonymous callers", async () => {
    const caller = createCaller(null);
    await expect(
      caller.onboardSource({
        sampleRecords: [{ id: "u1" }, { id: "u2" }],
        name: "X",
      }),
    ).rejects.toThrow();
  });
});

// ─── inferSchema (Pass 1 procedure — regression check) ─────────────────

describe("integrationsRouter.inferSchema (regression check)", () => {
  it("still works after Pass 18 wiring", async () => {
    const caller = createCaller(createUser());
    const result = await caller.inferSchema({
      records: [
        { id: "u1", email: "a@x.com" },
        { id: "u2", email: "b@y.com" },
      ],
    });
    expect(result.schema.primaryKey).toBe("id");
    expect(result.schema.fields.length).toBe(2);
    expect(result.summary).toContain("Primary key: id");
  });
});
