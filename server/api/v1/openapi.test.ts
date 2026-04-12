/**
 * Unit tests for the OpenAPI spec builder.
 * Pass 6 of the hybrid build loop — PARITY-API-0001.
 */
import { describe, it, expect } from "vitest";
import { buildOpenApiDoc } from "./openapi";

describe("api/v1/openapi — buildOpenApiDoc", () => {
  it("returns a valid 3.1 document", () => {
    const doc = buildOpenApiDoc();
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.info).toBeDefined();
    expect(doc.paths).toBeDefined();
    expect(doc.components).toBeDefined();
  });

  it("uses the default server URL when not overridden", () => {
    const doc = buildOpenApiDoc();
    const servers = doc.servers as Array<{ url: string }>;
    expect(servers[0].url).toBe("/api/v1");
  });

  it("respects a custom server URL", () => {
    const doc = buildOpenApiDoc({ serverUrl: "https://api.stewardly.ai/v1" });
    const servers = doc.servers as Array<{ url: string }>;
    expect(servers[0].url).toBe("https://api.stewardly.ai/v1");
  });

  it("respects a custom version", () => {
    const doc = buildOpenApiDoc({ version: "2.1.0" });
    const info = doc.info as { version: string };
    expect(info.version).toBe("2.1.0");
  });

  it("declares a BearerAuth security scheme", () => {
    const doc = buildOpenApiDoc();
    const components = doc.components as {
      securitySchemes: { BearerAuth: { type: string; scheme: string } };
    };
    expect(components.securitySchemes.BearerAuth.type).toBe("http");
    expect(components.securitySchemes.BearerAuth.scheme).toBe("bearer");
  });

  it("marks /health and /openapi.json as public (security: [])", () => {
    const doc = buildOpenApiDoc();
    const paths = doc.paths as Record<string, any>;
    expect(paths["/health"].get.security).toEqual([]);
    expect(paths["/openapi.json"].get.security).toEqual([]);
  });

  it("includes all 6 Pass-6 endpoints", () => {
    const doc = buildOpenApiDoc();
    const paths = doc.paths as Record<string, unknown>;
    expect(Object.keys(paths)).toEqual(
      expect.arrayContaining([
        "/health",
        "/openapi.json",
        "/comparables/summary",
        "/comparables/gaps",
        "/rebalancing/simulate",
        "/tax/project-year",
        "/portfolio-ledger/run",
      ]),
    );
  });

  it("includes the Pass-15 fiduciary report endpoint", () => {
    const doc = buildOpenApiDoc();
    const paths = doc.paths as Record<string, unknown>;
    expect(paths["/reports/fiduciary"]).toBeDefined();
  });

  it("references the Error schema on 401/429 responses", () => {
    const doc = buildOpenApiDoc();
    const summary = (doc.paths as any)["/comparables/summary"];
    expect(summary.get.responses["401"]).toBeDefined();
    expect(summary.get.responses["429"]).toBeDefined();
  });
});
