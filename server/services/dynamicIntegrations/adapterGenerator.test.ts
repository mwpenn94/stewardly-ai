/**
 * Tests for adapterGenerator.ts (Pass 2 — CRUD adapter generation).
 */

import { describe, it, expect } from "vitest";
import { inferSchema } from "./schemaInference";
import {
  probeAuth,
  probePagination,
  detectCollectionPath,
  generateFieldMappings,
  generateAdapter,
  buildCurlExamples,
  summarizeAdapter,
} from "./adapterGenerator";

describe("probeAuth", () => {
  it("honors explicit hint", () => {
    const result = probeAuth(undefined, { type: "bearer" });
    expect(result.type).toBe("bearer");
    expect(result.probeConfidence).toBe(1);
  });

  it("detects Bearer from WWW-Authenticate", () => {
    const result = probeAuth({ "WWW-Authenticate": "Bearer realm=api" });
    expect(result.type).toBe("bearer");
    expect(result.probeConfidence).toBeGreaterThan(0.5);
  });

  it("detects Basic from WWW-Authenticate", () => {
    const result = probeAuth({ "WWW-Authenticate": 'Basic realm="api"' });
    expect(result.type).toBe("basic");
  });

  it("returns unknown with suggestions when no clues", () => {
    const result = probeAuth();
    expect(result.type).toBe("unknown");
    expect(result.notes.length).toBeGreaterThan(0);
  });

  it("honors headerName hint for api_key_header", () => {
    const result = probeAuth(undefined, { type: "api_key_header", headerName: "X-Custom-Key" });
    expect(result.type).toBe("api_key_header");
    expect(result.headerName).toBe("X-Custom-Key");
  });
});

describe("probePagination", () => {
  it("detects cursor style from next_cursor key", () => {
    const result = probePagination({ data: [], next_cursor: "abc123" });
    expect(result.style).toBe("cursor");
    expect(result.cursorPath).toBe("next_cursor");
  });

  it("detects cursor from nextPageToken", () => {
    const result = probePagination({ items: [], nextPageToken: "abc" });
    expect(result.style).toBe("cursor");
  });

  it("detects offset style from offset+limit", () => {
    const result = probePagination({ data: [], offset: 0, limit: 50 });
    expect(result.style).toBe("offset");
    expect(result.offsetParam).toBe("offset");
  });

  it("detects page style from page+per_page", () => {
    const result = probePagination({ data: [], page: 1, per_page: 20 });
    expect(result.style).toBe("page");
    expect(result.limitParam).toBe("per_page");
  });

  it("detects link_header style from Link header", () => {
    const result = probePagination({ data: [] }, { Link: '<https://api.example.com/page2>; rel="next"' });
    expect(result.style).toBe("link_header");
  });

  it("falls back to none when no clues found", () => {
    const result = probePagination({ data: [{ id: 1 }] });
    expect(result.style).toBe("none");
  });
});

describe("detectCollectionPath", () => {
  it("returns 'data' for {data: [...]}", () => {
    expect(detectCollectionPath({ data: [{ id: 1 }] })).toBe("data");
  });

  it("returns 'items' for {items: [...]}", () => {
    expect(detectCollectionPath({ items: [{ id: 1 }] })).toBe("items");
  });

  it("returns 'results' for {results: [...]}", () => {
    expect(detectCollectionPath({ results: [{ id: 1 }] })).toBe("results");
  });

  it("returns '' for root arrays", () => {
    expect(detectCollectionPath([{ id: 1 }])).toBe("");
  });

  it("falls back to first array field", () => {
    expect(detectCollectionPath({ meta: {}, things: [{ id: 1 }] })).toBe("things");
  });

  it("returns '' for non-array bodies", () => {
    expect(detectCollectionPath({ id: 1 })).toBe("");
    expect(detectCollectionPath("string")).toBe("");
    expect(detectCollectionPath(null)).toBe("");
  });
});

describe("generateFieldMappings", () => {
  it("maps primary key as identifier", () => {
    const schema = inferSchema([
      { id: "550e8400-e29b-41d4-a716-446655440000", name: "A" },
      { id: "550e8400-e29b-41d4-a716-446655440001", name: "B" },
    ]);
    const mappings = generateFieldMappings(schema);
    const idMapping = mappings.find((m) => m.canonicalName === "id")!;
    expect(idMapping.direction).toBe("identifier");
  });

  it("maps timestamp fields as derived", () => {
    const schema = inferSchema([
      { id: 1, name: "A", created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-05T00:00:00Z" },
      { id: 2, name: "B", created_at: "2024-02-01T00:00:00Z", updated_at: "2024-02-05T00:00:00Z" },
    ]);
    const mappings = generateFieldMappings(schema);
    const updatedAt = mappings.find((m) => m.canonicalName === "updated_at")!;
    expect(updatedAt.direction).toBe("derived");
    expect(updatedAt.transform).toBe("parse_date");
  });

  it("maps currency fields with parse_currency", () => {
    const schema = inferSchema([
      { id: 1, balance: "$1,000" },
      { id: 2, balance: "$2,500" },
    ]);
    const mappings = generateFieldMappings(schema);
    const balance = mappings.find((m) => m.canonicalName === "balance")!;
    expect(balance.transform).toBe("parse_currency");
  });

  it("maps mixed fields to skip", () => {
    const schema = inferSchema([
      { id: 1, weird: 42 },
      { id: 2, weird: "hello" },
      { id: 3, weird: [1, 2] },
    ]);
    const mappings = generateFieldMappings(schema);
    const weird = mappings.find((m) => m.canonicalName === "weird")!;
    expect(weird.direction).toBe("skip");
  });
});

describe("generateAdapter — full flow", () => {
  const records = [
    { id: "u1", email: "a@x.com", name: "A", status: "active", created_at: "2024-01-01T00:00:00Z" },
    { id: "u2", email: "b@y.com", name: "B", status: "inactive", created_at: "2024-01-02T00:00:00Z" },
    { id: "u3", email: "c@z.com", name: "C", status: "active", created_at: "2024-01-03T00:00:00Z" },
  ];

  it("produces all 5 CRUD endpoints when PK is detected", () => {
    const schema = inferSchema(records);
    const spec = generateAdapter(schema, {
      name: "TestSource",
      baseUrl: "https://api.example.com",
      authHint: { type: "bearer" },
      listEndpoint: "/users",
    });
    expect(spec.endpoints.list).toBeDefined();
    expect(spec.endpoints.get).toBeDefined();
    expect(spec.endpoints.create).toBeDefined();
    expect(spec.endpoints.update).toBeDefined();
    expect(spec.endpoints.delete).toBeDefined();
    expect(spec.endpoints.get!.pathTemplate).toContain("{id}");
  });

  it("omits get/update/delete when no PK detected", () => {
    const schema = inferSchema([
      { email: "a@x.com", name: "A" },
      { email: "b@y.com", name: "B" },
    ]);
    const spec = generateAdapter(schema, {
      name: "Anon",
      baseUrl: "https://api.example.com",
      listEndpoint: "/users",
      authHint: { type: "bearer" },
    });
    expect(spec.endpoints.list).toBeDefined();
    expect(spec.endpoints.create).toBeDefined();
    expect(spec.endpoints.get).toBeUndefined();
    expect(spec.endpoints.update).toBeUndefined();
    expect(spec.endpoints.delete).toBeUndefined();
    expect(spec.readinessReport.warnings.some((w) => w.includes("primary key"))).toBe(true);
  });

  it("marks readiness as NOT ready when baseUrl is missing", () => {
    const schema = inferSchema(records);
    const spec = generateAdapter(schema, { name: "NoBase", authHint: { type: "bearer" } });
    expect(spec.readinessReport.ready).toBe(false);
    expect(spec.readinessReport.missingRequired).toContain("baseUrl");
  });

  it("marks readiness as NOT ready when auth is unknown", () => {
    const schema = inferSchema(records);
    const spec = generateAdapter(schema, { name: "NoAuth", baseUrl: "https://api.example.com" });
    expect(spec.readinessReport.ready).toBe(false);
    expect(spec.readinessReport.missingRequired).toContain("auth.type");
  });

  it("is ready when baseUrl + auth + listEndpoint provided", () => {
    const schema = inferSchema(records);
    const spec = generateAdapter(schema, {
      name: "Ready",
      baseUrl: "https://api.example.com",
      authHint: { type: "bearer" },
      listEndpoint: "/users",
    });
    expect(spec.readinessReport.ready).toBe(true);
  });

  it("probes pagination from sample response", () => {
    const schema = inferSchema(records);
    const spec = generateAdapter(schema, {
      name: "WithSample",
      baseUrl: "https://api.example.com",
      authHint: { type: "bearer" },
      listEndpoint: "/users",
      sampleListResponse: { data: records, next_cursor: "abc" },
    });
    expect(spec.endpoints.list!.pagination?.style).toBe("cursor");
    expect(spec.endpoints.list!.responseRecordPath).toBe("data");
  });

  it("includes version fingerprint derived from schema", () => {
    const schema = inferSchema(records);
    const spec = generateAdapter(schema, {
      name: "Versioned",
      baseUrl: "https://api.example.com",
      authHint: { type: "bearer" },
      listEndpoint: "/users",
    });
    expect(spec.version).toMatch(/^0\.1\.0-[a-f0-9]+$/);
  });

  it("different schemas produce different version fingerprints", () => {
    const specA = generateAdapter(inferSchema([{ id: 1, a: "x" }]), {
      name: "A",
      baseUrl: "https://api.example.com",
      authHint: { type: "bearer" },
      listEndpoint: "/users",
    });
    const specB = generateAdapter(inferSchema([{ id: 1, b: "y" }]), {
      name: "B",
      baseUrl: "https://api.example.com",
      authHint: { type: "bearer" },
      listEndpoint: "/users",
    });
    expect(specA.version).not.toBe(specB.version);
  });
});

describe("buildCurlExamples", () => {
  it("generates curl for every endpoint", () => {
    const schema = inferSchema([
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    const spec = generateAdapter(schema, {
      name: "Test",
      baseUrl: "https://api.example.com",
      authHint: { type: "bearer" },
      listEndpoint: "/users",
    });
    const curls = buildCurlExamples(spec);
    expect(curls.list).toContain("GET");
    expect(curls.list).toContain("https://api.example.com/users");
    expect(curls.create).toContain("POST");
    expect(curls.list).toContain("Bearer");
  });

  it("uses api_key_header when configured", () => {
    const schema = inferSchema([{ id: "u1", name: "A" }, { id: "u2", name: "B" }]);
    const spec = generateAdapter(schema, {
      name: "Test",
      baseUrl: "https://api.example.com",
      authHint: { type: "api_key_header", headerName: "X-API-Key" },
      listEndpoint: "/users",
    });
    const curls = buildCurlExamples(spec);
    expect(curls.list).toContain("X-API-Key");
  });
});

describe("summarizeAdapter", () => {
  it("produces a compact one-line summary", () => {
    const schema = inferSchema([
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    const spec = generateAdapter(schema, {
      name: "MyApi",
      baseUrl: "https://api.example.com",
      authHint: { type: "bearer" },
      listEndpoint: "/users",
    });
    const summary = summarizeAdapter(spec);
    expect(summary).toContain("MyApi");
    expect(summary).toContain("auth=bearer");
    expect(summary).toContain("pk=id");
  });
});
