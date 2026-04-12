/**
 * Tests for naturalLanguageParser.ts (Pass 17 — NL prompt → OnboardingInput).
 */

import { describe, it, expect } from "vitest";
import {
  parsePrompt,
  parsedToOnboardingInput,
  summarizeParsedPrompt,
} from "./naturalLanguageParser";

describe("parsePrompt — URL extraction", () => {
  it("extracts base URL", () => {
    const r = parsePrompt("Use https://api.example.com");
    expect(r.baseUrl).toBe("https://api.example.com");
  });

  it("separates base URL from trailing path", () => {
    const r = parsePrompt("Use https://api.acme.com/v2/contacts");
    expect(r.baseUrl).toBe("https://api.acme.com");
    expect(r.listEndpoint).toBe("/v2/contacts");
  });

  it("strips trailing punctuation from URL", () => {
    const r = parsePrompt("Check out https://api.acme.com.");
    expect(r.baseUrl).toBe("https://api.acme.com");
  });

  it("detects http (not just https)", () => {
    const r = parsePrompt("The dev server is at http://localhost:8080");
    expect(r.baseUrl).toBe("http://localhost:8080");
  });
});

describe("parsePrompt — auth detection", () => {
  it("detects bearer auth", () => {
    const r = parsePrompt("https://api.x.com with bearer token auth");
    expect(r.authHint?.type).toBe("bearer");
  });

  it("detects JWT as bearer", () => {
    const r = parsePrompt("Uses JWT at https://api.x.com");
    expect(r.authHint?.type).toBe("bearer");
  });

  it("detects api_key_header", () => {
    const r = parsePrompt("https://api.x.com with api key header X-API-Key");
    expect(r.authHint?.type).toBe("api_key_header");
  });

  it("extracts custom header name", () => {
    const r = parsePrompt("api key in X-Custom-Token header for https://api.x.com");
    expect(r.authHint?.type).toBe("api_key_header");
    expect(r.authHint?.headerName).toBe("X-Custom-Token");
  });

  it("detects api_key_query", () => {
    const r = parsePrompt("https://api.x.com?api_key=XXX uses query param api key");
    expect(r.authHint?.type).toBe("api_key_query");
  });

  it("detects basic auth", () => {
    const r = parsePrompt("Use HTTP Basic auth with username and password");
    expect(r.authHint?.type).toBe("basic");
  });

  it("detects oauth2", () => {
    const r = parsePrompt("OAuth2 client credentials flow at https://oauth.x.com");
    expect(r.authHint?.type).toBe("oauth2");
  });

  it("detects no-auth public APIs", () => {
    const r = parsePrompt("Public API no auth required at https://api.x.com");
    expect(r.authHint?.type).toBe("none");
  });

  it("picks most specific when multiple auth styles mentioned", () => {
    // Mentions both bearer and api_key_header — api_key_header should win
    const r = parsePrompt("Uses bearer token OR api key header X-API-Key at https://api.x.com");
    expect(r.authHint?.type).toBe("api_key_header");
  });
});

describe("parsePrompt — listEndpoint detection", () => {
  it("extracts from 'endpoint /foo'", () => {
    const r = parsePrompt("Pull data from endpoint /contacts at https://api.x.com");
    expect(r.listEndpoint).toBe("/contacts");
  });

  it("extracts from verb + path", () => {
    const r = parsePrompt("Fetch /users from https://api.x.com");
    expect(r.listEndpoint).toBe("/users");
  });

  it("pulls path off the URL if no explicit endpoint", () => {
    const r = parsePrompt("Scrape https://api.x.com/v1/users");
    expect(r.listEndpoint).toBe("/v1/users");
  });
});

describe("parsePrompt — name detection", () => {
  it("extracts from 'onboard <Name>'", () => {
    const r = parsePrompt("Onboard Acme from https://api.acme.com");
    expect(r.name).toBe("Acme");
  });

  it("extracts from 'integrate <Name>'", () => {
    const r = parsePrompt("Integrate Salesforce CRM");
    expect(r.name).toBe("Salesforce");
  });

  it("falls back to domain name", () => {
    const r = parsePrompt("Use https://api.acme.com/v2");
    expect(r.name).toBe("Acme");
  });

  it("skips www/api labels when deriving from domain", () => {
    const r = parsePrompt("Use https://www.acme.com/things");
    expect(r.name).toBe("Acme");
  });
});

describe("parsePrompt — rate limit detection", () => {
  it("detects '5/s' shorthand", () => {
    const r = parsePrompt("Rate limit 5/s for https://api.x.com");
    expect(r.rateLimitHint?.requestsPerSecond).toBe(5);
  });

  it("detects 'N per second'", () => {
    const r = parsePrompt("Allowed 10 per second on https://api.x.com");
    expect(r.rateLimitHint?.requestsPerSecond).toBe(10);
  });

  it("detects 'N rps'", () => {
    const r = parsePrompt("Throttle to 3 rps");
    expect(r.rateLimitHint?.requestsPerSecond).toBe(3);
  });
});

describe("parsePrompt — warnings", () => {
  it("warns when no URL present", () => {
    const r = parsePrompt("Just some random text");
    expect(r.warnings.some((w) => w.includes("base URL"))).toBe(true);
  });

  it("warns when no auth detected", () => {
    const r = parsePrompt("https://api.x.com");
    expect(r.warnings.some((w) => w.includes("auth"))).toBe(true);
  });
});

describe("parsePrompt — confidence", () => {
  it("is higher for rich prompts", () => {
    const rich = parsePrompt(
      "Onboard Acme from https://api.acme.com/v2 with bearer auth, endpoint /users, rate limit 5/s",
    );
    const sparse = parsePrompt("some text");
    expect(rich.confidence).toBeGreaterThan(sparse.confidence);
    expect(rich.confidence).toBeGreaterThan(0.5);
  });
});

describe("parsedToOnboardingInput", () => {
  it("merges parsed prompt with explicit sampleRecords", () => {
    const parsed = parsePrompt(
      "Onboard Acme from https://api.acme.com/v2 with bearer auth, endpoint /users",
    );
    const input = parsedToOnboardingInput(parsed, {
      sampleRecords: [{ id: "u1", email: "a@x.com" }, { id: "u2", email: "b@y.com" }],
    });
    expect(input.name).toBe("Acme");
    expect(input.baseUrl).toBe("https://api.acme.com");
    // Explicit "endpoint /users" wins over /v2 trailing path from URL
    expect(input.listEndpoint).toBe("/users");
    expect(input.authHint?.type).toBe("bearer");
    expect(input.sampleRecords.length).toBe(2);
  });

  it("explicit overrides win over parsed", () => {
    const parsed = parsePrompt("Onboard Acme from https://api.acme.com");
    const input = parsedToOnboardingInput(parsed, {
      sampleRecords: [{ id: "u1" }, { id: "u2" }],
      name: "ExplicitName",
      baseUrl: "https://override.com",
    });
    expect(input.name).toBe("ExplicitName");
    expect(input.baseUrl).toBe("https://override.com");
  });
});

describe("summarizeParsedPrompt", () => {
  it("produces compact summary with all fields", () => {
    const parsed = parsePrompt(
      "Onboard Acme from https://api.acme.com with bearer auth, endpoint /users, 5/s",
    );
    const summary = summarizeParsedPrompt(parsed);
    expect(summary).toContain("name=Acme");
    expect(summary).toContain("auth=bearer");
    expect(summary).toContain("conf=");
  });
});
