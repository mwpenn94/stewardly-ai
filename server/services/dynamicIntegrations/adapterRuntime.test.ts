/**
 * Tests for adapterRuntime.ts (Pass 3 — runtime executor for AdapterSpec).
 * Uses a mock fetchImpl so no real network traffic.
 */

import { describe, it, expect } from "vitest";
import { inferSchema } from "./schemaInference";
import { generateAdapter } from "./adapterGenerator";
import type { AdapterSpec } from "./adapterGenerator";
import {
  buildAuthHeaders,
  injectAuthQueryParam,
  unwrapRecords,
  readCursor,
  parseLinkHeader,
  applyReadTransform,
  applyWriteTransform,
  computeBackoffMs,
  listRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  upsertRecord,
  AdapterError,
  type FetchImpl,
} from "./adapterRuntime";

// ─── Helper: build a spec for tests ────────────────────────────────────────

function buildTestSpec(overrides: Partial<AdapterSpec> = {}): AdapterSpec {
  const records = [
    { id: "u1", name: "Alice", email: "a@x.com", created_at: "2024-01-01T00:00:00Z" },
    { id: "u2", name: "Bob", email: "b@y.com", created_at: "2024-01-02T00:00:00Z" },
  ];
  const schema = inferSchema(records);
  const spec = generateAdapter(schema, {
    name: "Test",
    baseUrl: "https://api.example.com",
    authHint: { type: "bearer" },
    listEndpoint: "/users",
  });
  return { ...spec, ...overrides } as AdapterSpec;
}

// ─── Helper: mock fetchImpl ───────────────────────────────────────────────

function mockFetch(
  responses: Array<{
    match?: (url: string, init?: RequestInit) => boolean;
    status: number;
    body?: unknown;
    headers?: Record<string, string>;
  }>
): { impl: FetchImpl; calls: Array<{ url: string; init?: RequestInit }> } {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let index = 0;
  const impl: FetchImpl = async (url, init) => {
    calls.push({ url, init });
    const matcher = responses.find((r) => !r.match || r.match(url, init));
    const response = matcher || responses[index++] || responses[responses.length - 1];
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      headers: response.headers || {},
      json: async () => response.body,
      text: async () => JSON.stringify(response.body),
    };
  };
  return { impl, calls };
}

// ─── Auth header tests ───────────────────────────────────────────────────

describe("buildAuthHeaders", () => {
  it("produces bearer token header", () => {
    const headers = buildAuthHeaders({ type: "bearer", probeConfidence: 1, notes: [] }, { token: "xyz" });
    expect(headers.Authorization).toBe("Bearer xyz");
  });

  it("produces api_key_header", () => {
    const headers = buildAuthHeaders(
      { type: "api_key_header", headerName: "X-Custom", probeConfidence: 1, notes: [] },
      { apiKey: "abc" }
    );
    expect(headers["X-Custom"]).toBe("abc");
  });

  it("defaults api_key_header to X-API-Key", () => {
    const headers = buildAuthHeaders(
      { type: "api_key_header", probeConfidence: 1, notes: [] },
      { apiKey: "abc" }
    );
    expect(headers["X-API-Key"]).toBe("abc");
  });

  it("produces Basic auth with base64 encoding", () => {
    const headers = buildAuthHeaders(
      { type: "basic", probeConfidence: 1, notes: [] },
      { username: "user", password: "pass" }
    );
    expect(headers.Authorization).toBe(`Basic ${Buffer.from("user:pass").toString("base64")}`);
  });

  it("returns empty object for none", () => {
    const headers = buildAuthHeaders({ type: "none", probeConfidence: 1, notes: [] }, {});
    expect(headers).toEqual({});
  });
});

describe("injectAuthQueryParam", () => {
  it("adds query param for api_key_query auth", () => {
    const url = injectAuthQueryParam(
      "https://api.example.com/users",
      { type: "api_key_query", queryParam: "key", probeConfidence: 1, notes: [] },
      { apiKey: "abc" }
    );
    expect(url).toContain("key=abc");
  });

  it("appends with & when url already has query params", () => {
    const url = injectAuthQueryParam(
      "https://api.example.com/users?limit=10",
      { type: "api_key_query", queryParam: "key", probeConfidence: 1, notes: [] },
      { apiKey: "abc" }
    );
    expect(url).toContain("&key=abc");
  });

  it("no-op for non-query auth types", () => {
    const url = injectAuthQueryParam(
      "https://api.example.com/users",
      { type: "bearer", probeConfidence: 1, notes: [] },
      { token: "abc" }
    );
    expect(url).toBe("https://api.example.com/users");
  });
});

// ─── Response unwrapping tests ────────────────────────────────────────────

describe("unwrapRecords", () => {
  it("returns body for root arrays", () => {
    expect(unwrapRecords([{ id: 1 }, { id: 2 }], undefined)).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("unwraps data path", () => {
    expect(unwrapRecords({ data: [{ id: 1 }] }, "data")).toEqual([{ id: 1 }]);
  });

  it("unwraps nested dot-path", () => {
    expect(unwrapRecords({ data: { items: [{ id: 1 }] } }, "data.items")).toEqual([{ id: 1 }]);
  });

  it("returns [] for missing path", () => {
    expect(unwrapRecords({ data: [] }, "missing")).toEqual([]);
  });

  it("returns [] for non-array target", () => {
    expect(unwrapRecords({ data: { not: "array" } }, "data")).toEqual([]);
  });
});

describe("readCursor", () => {
  it("reads a simple cursor field", () => {
    expect(readCursor({ next_cursor: "abc" }, "next_cursor")).toBe("abc");
  });

  it("returns null when cursor missing", () => {
    expect(readCursor({ data: [] }, "next_cursor")).toBeNull();
  });

  it("returns null for empty cursor", () => {
    expect(readCursor({ next_cursor: "" }, "next_cursor")).toBeNull();
  });
});

describe("parseLinkHeader", () => {
  it("parses rel=next", () => {
    const link = '<https://api.example.com/page2>; rel="next", <https://api.example.com/last>; rel="last"';
    const result = parseLinkHeader(link);
    expect(result.next).toBe("https://api.example.com/page2");
    expect(result.last).toBe("https://api.example.com/last");
  });

  it("returns empty for undefined input", () => {
    expect(parseLinkHeader(undefined)).toEqual({});
  });
});

// ─── Field transform tests ───────────────────────────────────────────────

describe("applyReadTransform", () => {
  it("parses currency values", () => {
    const schema = inferSchema([{ id: 1, balance: "$1,234.56" }, { id: 2, balance: "$500" }]);
    const spec = generateAdapter(schema, { name: "X", baseUrl: "https://x", authHint: { type: "bearer" }, listEndpoint: "/x" });
    const result = applyReadTransform({ id: 1, balance: "$1,234.56" }, spec.fieldMappings);
    expect(result.balance).toBe(1234.56);
  });

  it("parses percentage values", () => {
    const schema = inferSchema([{ id: 1, rate: "5.5%" }, { id: 2, rate: "10%" }]);
    const spec = generateAdapter(schema, { name: "X", baseUrl: "https://x", authHint: { type: "bearer" }, listEndpoint: "/x" });
    const result = applyReadTransform({ id: 1, rate: "5.5%" }, spec.fieldMappings);
    expect(result.rate).toBeCloseTo(0.055, 4);
  });

  it("parses dates to epoch ms", () => {
    const schema = inferSchema([
      { id: 1, created_at: "2024-01-01T00:00:00Z" },
      { id: 2, created_at: "2024-01-02T00:00:00Z" },
    ]);
    const spec = generateAdapter(schema, { name: "X", baseUrl: "https://x", authHint: { type: "bearer" }, listEndpoint: "/x" });
    const result = applyReadTransform({ id: 1, created_at: "2024-01-01T00:00:00Z" }, spec.fieldMappings);
    expect(result.created_at).toBe(Date.parse("2024-01-01T00:00:00Z"));
  });

  it("skips fields marked as skip", () => {
    const schema = inferSchema([
      { id: 1, weird: 42 },
      { id: 2, weird: "hello" },
      { id: 3, weird: [1] },
    ]);
    const spec = generateAdapter(schema, { name: "X", baseUrl: "https://x", authHint: { type: "bearer" }, listEndpoint: "/x" });
    const result = applyReadTransform({ id: 1, weird: "anything" }, spec.fieldMappings);
    expect(result.weird).toBeUndefined();
  });

  it("outputs null for missing source fields", () => {
    const schema = inferSchema([
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ]);
    const spec = generateAdapter(schema, { name: "X", baseUrl: "https://x", authHint: { type: "bearer" }, listEndpoint: "/x" });
    const result = applyReadTransform({ id: 1 }, spec.fieldMappings);
    expect(result.name).toBeNull();
  });
});

describe("applyWriteTransform", () => {
  it("excludes read-only/derived/skip fields", () => {
    const schema = inferSchema([
      { id: 1, name: "A", created_at: "2024-01-01T00:00:00Z" },
      { id: 2, name: "B", created_at: "2024-01-02T00:00:00Z" },
    ]);
    const spec = generateAdapter(schema, { name: "X", baseUrl: "https://x", authHint: { type: "bearer" }, listEndpoint: "/x" });
    const result = applyWriteTransform({ id: 1, name: "A", created_at: "skip-me" }, spec.fieldMappings);
    expect(result.id).toBeDefined();
    expect(result.name).toBe("A");
    expect(result.created_at).toBeUndefined();
  });
});

// ─── Backoff test ────────────────────────────────────────────────────────

describe("computeBackoffMs", () => {
  it("exponential grows with attempt", () => {
    expect(computeBackoffMs(0, "exponential")).toBe(500);
    expect(computeBackoffMs(1, "exponential")).toBe(1000);
    expect(computeBackoffMs(2, "exponential")).toBe(2000);
    expect(computeBackoffMs(10, "exponential")).toBe(30000); // capped
  });

  it("linear grows linearly", () => {
    expect(computeBackoffMs(0, "linear")).toBe(500);
    expect(computeBackoffMs(1, "linear")).toBe(1000);
  });

  it("fixed stays constant", () => {
    expect(computeBackoffMs(0, "fixed")).toBe(1000);
    expect(computeBackoffMs(5, "fixed")).toBe(1000);
  });
});

// ─── List operation tests ────────────────────────────────────────────────

describe("listRecords", () => {
  it("fetches records from root array response", async () => {
    const spec = buildTestSpec();
    const { impl, calls } = mockFetch([
      { status: 200, body: [{ id: "u1", name: "Alice", email: "a@x.com" }] },
    ]);
    const result = await listRecords(spec, { credentials: { token: "xyz" }, fetchImpl: impl });
    expect(result.records.length).toBe(1);
    expect(calls.length).toBe(1);
    expect(calls[0].url).toContain("/users");
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe("Bearer xyz");
  });

  it("iterates cursor pagination", async () => {
    const spec = {
      ...buildTestSpec(),
      endpoints: {
        list: {
          method: "GET" as const,
          pathTemplate: "/users",
          responseRecordPath: "data",
          pagination: {
            style: "cursor" as const,
            cursorParam: "cursor",
            cursorPath: "next_cursor",
            maxPageSize: 2,
          },
        },
      },
    };
    const { impl, calls } = mockFetch([
      {
        match: (u) => !u.includes("cursor="),
        status: 200,
        body: { data: [{ id: "1" }, { id: "2" }], next_cursor: "abc" },
      },
      {
        match: (u) => u.includes("cursor=abc"),
        status: 200,
        body: { data: [{ id: "3" }], next_cursor: null },
      },
    ]);
    const result = await listRecords(spec as AdapterSpec, { credentials: { token: "xyz" }, fetchImpl: impl });
    expect(result.records.length).toBe(3);
    expect(result.pages).toBe(2);
    expect(calls.length).toBe(2);
  });

  it("retries on 429 and counts retries", async () => {
    const spec = buildTestSpec();
    let attempt = 0;
    const impl: FetchImpl = async () => {
      attempt++;
      if (attempt === 1) {
        return {
          ok: false,
          status: 429,
          headers: { "retry-after": "0" },
          json: async () => ({}),
          text: async () => "",
        };
      }
      return {
        ok: true,
        status: 200,
        headers: {},
        json: async () => [{ id: "u1", name: "A", email: "a@x.com" }],
        text: async () => "",
      };
    };
    const result = await listRecords(spec, { credentials: { token: "xyz" }, fetchImpl: impl });
    expect(result.retries).toBeGreaterThanOrEqual(1);
    expect(result.records.length).toBe(1);
  });

  it("throws AdapterError on 4xx (non-429)", async () => {
    const spec = buildTestSpec();
    const { impl } = mockFetch([{ status: 401, body: { error: "Unauthorized" } }]);
    await expect(
      listRecords(spec, { credentials: { token: "xyz" }, fetchImpl: impl })
    ).rejects.toThrow(AdapterError);
  });
});

// ─── CRUD operations ─────────────────────────────────────────────────────

describe("createRecord", () => {
  it("POSTs canonical record with writable fields only", async () => {
    const spec = buildTestSpec();
    const { impl, calls } = mockFetch([{ status: 201, body: { id: "u99", name: "New" } }]);
    const result = await createRecord(
      spec,
      { credentials: { token: "xyz" }, fetchImpl: impl },
      { name: "New", email: "n@x.com" }
    );
    expect(result.status).toBe(201);
    expect(calls[0].init?.method).toBe("POST");
    const bodyStr = calls[0].init?.body as string;
    const body = JSON.parse(bodyStr);
    expect(body.name).toBe("New");
    // created_at is derived, should not be in payload
    expect(body.created_at).toBeUndefined();
  });
});

describe("getRecord", () => {
  it("fills primary key into path template", async () => {
    const spec = buildTestSpec();
    const { impl, calls } = mockFetch([{ status: 200, body: { id: "u1", name: "Alice" } }]);
    await getRecord(spec, { credentials: { token: "xyz" }, fetchImpl: impl }, "u1");
    expect(calls[0].url).toContain("/users/u1");
  });
});

describe("updateRecord", () => {
  it("sends PATCH with updated fields", async () => {
    const spec = buildTestSpec();
    const { impl, calls } = mockFetch([{ status: 200, body: { id: "u1", name: "Alice Updated" } }]);
    const result = await updateRecord(
      spec,
      { credentials: { token: "xyz" }, fetchImpl: impl },
      "u1",
      { name: "Alice Updated" }
    );
    expect(result.status).toBe(200);
    expect(calls[0].init?.method).toBe("PATCH");
  });
});

describe("deleteRecord", () => {
  it("sends DELETE with primary key in path", async () => {
    const spec = buildTestSpec();
    const { impl, calls } = mockFetch([{ status: 204, body: null }]);
    const result = await deleteRecord(spec, { credentials: { token: "xyz" }, fetchImpl: impl }, "u1");
    expect(result.status).toBe(204);
    expect(calls[0].init?.method).toBe("DELETE");
    expect(calls[0].url).toContain("/users/u1");
  });
});

describe("upsertRecord", () => {
  it("creates when GET returns 404", async () => {
    const spec = buildTestSpec();
    let call = 0;
    const impl: FetchImpl = async (url, init) => {
      call++;
      // 1st call: GET → 404
      if (init?.method === "GET" || (!init?.method && call === 1)) {
        return {
          ok: false,
          status: 404,
          headers: {},
          json: async () => ({ error: "not found" }),
          text: async () => "",
        };
      }
      // 2nd call: POST → 201
      return {
        ok: true,
        status: 201,
        headers: {},
        json: async () => ({ id: "u99", name: "New" }),
        text: async () => "",
      };
    };
    const result = await upsertRecord(
      spec,
      { credentials: { token: "xyz" }, fetchImpl: impl },
      { id: "u99", name: "New" }
    );
    expect(result.result).toBe("created");
  });

  it("updates when GET succeeds", async () => {
    const spec = buildTestSpec();
    let call = 0;
    const impl: FetchImpl = async () => {
      call++;
      if (call === 1) {
        return { ok: true, status: 200, headers: {}, json: async () => ({ id: "u1" }), text: async () => "" };
      }
      return { ok: true, status: 200, headers: {}, json: async () => ({ id: "u1", name: "Updated" }), text: async () => "" };
    };
    const result = await upsertRecord(
      spec,
      { credentials: { token: "xyz" }, fetchImpl: impl },
      { id: "u1", name: "Updated" }
    );
    expect(result.result).toBe("updated");
  });
});
