/**
 * Tests for pipelineOrchestrator.ts (Pass 11 — drift-aware pipeline runner).
 * Uses a mock fetchImpl so no real network.
 */

import { describe, it, expect } from "vitest";
import { inferSchema } from "./schemaInference";
import { generateAdapter } from "./adapterGenerator";
import type { AdapterSpec } from "./adapterGenerator";
import { runPipeline, summarizePipelineResult } from "./pipelineOrchestrator";
import type { FetchImpl } from "./adapterRuntime";

// ─── Helpers ──────────────────────────────────────────────────────────────

function buildSpec(): AdapterSpec {
  const records = [
    { id: "u1", name: "Alice", email: "a@x.com" },
    { id: "u2", name: "Bob", email: "b@y.com" },
  ];
  return generateAdapter(inferSchema(records), {
    name: "PipelineTest",
    baseUrl: "https://api.example.com",
    authHint: { type: "bearer" },
    listEndpoint: "/users",
  });
}

interface MockFetchPlan {
  match?: (url: string, init?: RequestInit) => boolean;
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

function mockFetch(plans: MockFetchPlan[]): FetchImpl {
  let idx = 0;
  return async (url, init) => {
    const matched = plans.find((p) => !p.match || p.match(url, init));
    const plan = matched || plans[idx++] || plans[plans.length - 1];
    return {
      ok: plan.status >= 200 && plan.status < 300,
      status: plan.status,
      headers: plan.headers || {},
      json: async () => plan.body,
      text: async () => JSON.stringify(plan.body),
    };
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe("runPipeline — fetch-only path", () => {
  it("completes with no upsert attempts when runUpsert=false", async () => {
    const spec = buildSpec();
    const result = await runPipeline(spec, {
      credentials: { token: "xyz" },
      fetchImpl: mockFetch([
        { status: 200, body: [{ id: "u1", name: "A", email: "a@x.com" }, { id: "u2", name: "B", email: "b@y.com" }] },
      ]),
      runUpsert: false,
    });
    expect(result.stopReason).toBe("completed");
    expect(result.recordsFetched).toBe(2);
    expect(result.recordsUpserted).toBe(0);
    expect(result.schema).toBeTruthy();
  });

  it("returns fetch_error when the list call fails", async () => {
    const spec = buildSpec();
    const result = await runPipeline(spec, {
      credentials: { token: "xyz" },
      fetchImpl: mockFetch([{ status: 500, body: { error: "boom" } }]),
      runUpsert: false,
    });
    expect(result.stopReason).toBe("fetch_error");
    expect(result.stoppedAt).toBe("fetch");
  });
});

describe("runPipeline — drift detection", () => {
  it("aborts on breaking drift when abortOnBreakingDrift=true", async () => {
    const spec = buildSpec();
    const baseline = inferSchema([
      { id: "550e8400-e29b-41d4-a716-446655440000", name: "A" },
      { id: "550e8400-e29b-41d4-a716-446655440001", name: "B" },
    ]);
    const result = await runPipeline(spec, {
      credentials: { token: "xyz" },
      baselineSchema: baseline,
      fetchImpl: mockFetch([{ status: 200, body: [{ name: "A" }, { name: "B" }] }]), // PK removed
      runUpsert: false,
    });
    expect(result.stopReason).toBe("breaking_drift");
    expect(result.stoppedAt).toBe("drift");
    expect(result.drift).toBeTruthy();
  });

  it("continues past non-breaking drift", async () => {
    const spec = buildSpec();
    const baseline = inferSchema([
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    const result = await runPipeline(spec, {
      credentials: { token: "xyz" },
      baselineSchema: baseline,
      fetchImpl: mockFetch([
        { status: 200, body: [{ id: "u1", name: "A", bonus: "new" }, { id: "u2", name: "B", bonus: "new" }] },
      ]),
      runUpsert: false,
    });
    expect(result.stopReason).toBe("completed");
    expect(result.drift).toBeTruthy();
    expect(result.drift?.compatible).toBe(true);
  });
});

describe("runPipeline — upsert loop", () => {
  it("upserts records and counts created vs updated", async () => {
    const spec = buildSpec();
    // GET returns 404 for both → creates both
    const impl: FetchImpl = async (url, init) => {
      const method = init?.method || "GET";
      // First call is the list
      if (!method || method === "GET") {
        if (url.includes("/users") && !url.match(/\/users\/\w+/)) {
          return {
            ok: true,
            status: 200,
            headers: {},
            json: async () => [
              { id: "u1", name: "A", email: "a@x.com" },
              { id: "u2", name: "B", email: "b@y.com" },
            ],
            text: async () => "",
          };
        }
        // Individual GETs for upsert → 404
        return { ok: false, status: 404, headers: {}, json: async () => ({}), text: async () => "" };
      }
      // POST for create
      return { ok: true, status: 201, headers: {}, json: async () => ({ id: "ok" }), text: async () => "" };
    };
    const result = await runPipeline(spec, {
      credentials: { token: "xyz" },
      fetchImpl: impl,
    });
    expect(result.stopReason).toBe("completed");
    expect(result.recordsFetched).toBe(2);
    expect(result.recordsUpserted).toBe(2);
    expect(result.recordsCreated).toBe(2);
    expect(result.recordsUpdated).toBe(0);
  });

  it("stops on upsert error threshold", async () => {
    const spec = buildSpec();
    // List returns records, but every GET (upsert attempt) throws 500
    const impl: FetchImpl = async (url, init) => {
      const method = init?.method || "GET";
      if (url.match(/\/users$/) && method === "GET") {
        return {
          ok: true,
          status: 200,
          headers: {},
          json: async () => [
            { id: "u1", name: "A" },
            { id: "u2", name: "B" },
            { id: "u3", name: "C" },
          ],
          text: async () => "",
        };
      }
      return {
        ok: false,
        status: 403,
        headers: {},
        json: async () => ({ error: "forbidden" }),
        text: async () => "",
      };
    };
    const result = await runPipeline(spec, {
      credentials: { token: "xyz" },
      fetchImpl: impl,
      maxUpsertErrors: 2,
    });
    expect(result.stopReason).toBe("upsert_error_threshold");
    expect(result.upsertErrors).toBeGreaterThanOrEqual(2);
  });
});

describe("runPipeline — personalization hints", () => {
  it("extracts hints from the ingested schema", async () => {
    const spec = buildSpec();
    const result = await runPipeline(spec, {
      credentials: { token: "xyz" },
      fetchImpl: mockFetch([
        {
          status: 200,
          body: [
            { id: "u1", name: "A", roth_ira_balance: "$50,000" },
            { id: "u2", name: "B", roth_ira_balance: "$100,000" },
          ],
        },
      ]),
      runUpsert: false,
    });
    expect(result.personalizationHints).toBeTruthy();
    const hints = result.personalizationHints!;
    expect(hints.hints.some((h) => h.key === "retirement_calculator")).toBe(true);
  });
});

describe("runPipeline — abort signal", () => {
  it("stops when the signal is aborted", async () => {
    const spec = buildSpec();
    const ac = new AbortController();
    ac.abort();
    const result = await runPipeline(spec, {
      credentials: { token: "xyz" },
      fetchImpl: mockFetch([{ status: 200, body: [] }]),
      signal: ac.signal,
      runUpsert: false,
    });
    expect(result.stopReason).toBe("aborted");
  });
});

describe("runPipeline — progress callback", () => {
  it("fires per-phase progress", async () => {
    const spec = buildSpec();
    const phases: string[] = [];
    await runPipeline(spec, {
      credentials: { token: "xyz" },
      fetchImpl: mockFetch([{ status: 200, body: [{ id: "u1", name: "A" }, { id: "u2", name: "B" }] }]),
      runUpsert: false,
      onProgress: (p) => phases.push(p.phase),
    });
    expect(phases).toContain("fetch");
    expect(phases).toContain("infer");
    expect(phases).toContain("complete");
  });
});

describe("summarizePipelineResult", () => {
  it("produces a one-line summary", async () => {
    const spec = buildSpec();
    const result = await runPipeline(spec, {
      credentials: { token: "xyz" },
      fetchImpl: mockFetch([{ status: 200, body: [{ id: "u1", name: "A" }, { id: "u2", name: "B" }] }]),
      runUpsert: false,
    });
    const summary = summarizePipelineResult(result);
    expect(summary).toContain("completed");
    expect(summary).toContain("2 fetched");
  });
});
