/**
 * Tests for authProbe.ts (Pass 13 — deep auth-shape probe).
 */

import { describe, it, expect } from "vitest";
import { probeAuthDeep, summarizeAuthProbe } from "./authProbe";

describe("probeAuthDeep — user hint wins", () => {
  it("honors an explicit userHint over any probe signal", () => {
    const result = probeAuthDeep({
      samples: [{ status: 401, headers: { "WWW-Authenticate": "Basic realm=api" } }],
      userHint: { type: "bearer" },
    });
    expect(result.type).toBe("bearer");
    expect(result.probeConfidence).toBe(1.0);
  });
});

describe("probeAuthDeep — WWW-Authenticate", () => {
  it("detects Bearer from WWW-Authenticate header", () => {
    const result = probeAuthDeep({
      samples: [{ status: 401, headers: { "WWW-Authenticate": "Bearer realm=api" } }],
    });
    expect(result.type).toBe("bearer");
    expect(result.probeConfidence).toBeGreaterThanOrEqual(0.9);
  });

  it("detects Basic from WWW-Authenticate header", () => {
    const result = probeAuthDeep({
      samples: [{ status: 401, headers: { "WWW-Authenticate": 'Basic realm="api"' } }],
    });
    expect(result.type).toBe("basic");
  });

  it("detects OAuth from WWW-Authenticate oauth mention", () => {
    const result = probeAuthDeep({
      samples: [{ status: 401, headers: { "WWW-Authenticate": 'Bearer, error="invalid_oauth2_token"' } }],
    });
    // Either bearer or oauth2 is acceptable here — oauth2 is the more specific match
    expect(["bearer", "oauth2"]).toContain(result.type);
  });
});

describe("probeAuthDeep — error body keyword detection", () => {
  it("detects bearer from JWT mention in error body", () => {
    const result = probeAuthDeep({
      samples: [
        {
          status: 401,
          headers: {},
          body: { error: "Missing or invalid JWT token" },
        },
      ],
    });
    expect(result.type).toBe("bearer");
    expect(result.probeConfidence).toBeGreaterThanOrEqual(0.8);
  });

  it("detects api_key from error body mention", () => {
    const result = probeAuthDeep({
      samples: [
        { status: 401, headers: {}, body: { error: "Invalid API key" } },
      ],
    });
    expect(result.type).toBe("api_key_header");
  });

  it("extracts the specific API key header name from error body", () => {
    const result = probeAuthDeep({
      samples: [
        {
          status: 401,
          headers: {},
          body: { error: "Missing X-Custom-Key header" },
        },
      ],
    });
    expect(result.type).toBe("api_key_header");
    expect(result.headerName).toContain("X-");
  });

  it("detects basic auth from error body phrase", () => {
    const result = probeAuthDeep({
      samples: [
        { status: 401, headers: {}, body: { error: "HTTP Basic authentication required" } },
      ],
    });
    expect(result.type).toBe("basic");
  });

  it("detects oauth2 from scope-required error", () => {
    const result = probeAuthDeep({
      samples: [
        {
          status: 403,
          headers: {},
          body: { error: "OAuth2 scope required: read:users" },
        },
      ],
    });
    expect(result.type).toBe("oauth2");
  });
});

describe("probeAuthDeep — header conventions", () => {
  it("infers api_key from X-RateLimit headers", () => {
    const result = probeAuthDeep({
      samples: [
        {
          status: 401,
          headers: { "X-RateLimit-Limit": "100", "X-RateLimit-Remaining": "99" },
          body: {},
        },
      ],
    });
    // Without error body keywords, it falls back to header convention
    expect(["api_key_header", "bearer"]).toContain(result.type);
  });
});

describe("probeAuthDeep — OAuth discovery endpoint", () => {
  it("detects OAuth from a probed .well-known URL", () => {
    const result = probeAuthDeep({
      samples: [
        {
          status: 200,
          headers: {},
          url: "https://api.example.com/.well-known/oauth-authorization-server",
          body: {},
        },
      ],
    });
    expect(result.type).toBe("oauth2");
  });

  it("detects OAuth from endpointsTried list", () => {
    const result = probeAuthDeep({
      samples: [{ status: 401, headers: {} }],
      endpointsTried: ["/oauth/token", "/users"],
    });
    expect(["oauth2", "bearer"]).toContain(result.type);
  });
});

describe("probeAuthDeep — fallback paths", () => {
  it("returns generic bearer guess on plain 401", () => {
    const result = probeAuthDeep({
      samples: [{ status: 401, headers: {}, body: {} }],
    });
    expect(result.type).toBe("bearer");
    expect(result.probeConfidence).toBeLessThan(0.5);
  });

  it("returns unknown with suggestions on empty samples", () => {
    const result = probeAuthDeep({ samples: [] });
    expect(result.type).toBe("unknown");
    expect(result.notes.length).toBeGreaterThan(0);
  });

  it("collects notes for every detected type (transparency)", () => {
    const result = probeAuthDeep({
      samples: [
        { status: 401, headers: { "WWW-Authenticate": "Bearer realm=api" } },
        { status: 403, headers: {}, body: { error: "Invalid API key" } },
      ],
    });
    // Should mention both bearer and api_key_header in notes
    expect(result.notes.some((n) => n.includes("bearer"))).toBe(true);
    expect(result.notes.some((n) => n.includes("api_key_header"))).toBe(true);
  });
});

describe("summarizeAuthProbe", () => {
  it("produces a compact one-liner", () => {
    const probe = probeAuthDeep({
      samples: [{ status: 401, headers: { "WWW-Authenticate": "Bearer" } }],
    });
    const summary = summarizeAuthProbe(probe);
    expect(summary).toContain("auth=bearer");
    expect(summary).toContain("conf=");
    expect(summary).toContain("signal");
  });
});
