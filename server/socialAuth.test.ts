import { describe, it, expect } from "vitest";

describe("Social Auth & Integration Secrets", () => {
  it("GOOGLE_CLIENT_ID is set and looks like a Google client ID", () => {
    const val = process.env.GOOGLE_CLIENT_ID;
    expect(val).toBeDefined();
    expect(val!.length).toBeGreaterThan(10);
    expect(val).toContain(".apps.googleusercontent.com");
  });

  it("GOOGLE_CLIENT_SECRET is set and starts with GOCSPX", () => {
    const val = process.env.GOOGLE_CLIENT_SECRET;
    expect(val).toBeDefined();
    expect(val!.length).toBeGreaterThan(5);
    expect(val).toMatch(/^GOCSPX-/);
  });

  it("LINKEDIN_CLIENT_ID is set", () => {
    const val = process.env.LINKEDIN_CLIENT_ID;
    expect(val).toBeDefined();
    expect(val!.length).toBeGreaterThan(5);
  });

  it("LINKEDIN_CLIENT_SECRET is set and starts with WPL_AP1", () => {
    const val = process.env.LINKEDIN_CLIENT_SECRET;
    expect(val).toBeDefined();
    expect(val!.length).toBeGreaterThan(5);
    expect(val).toMatch(/^WPL_AP1\./);
  });

  it("SNAPTRADE_CLIENT_ID is set and starts with PERS-", () => {
    const val = process.env.SNAPTRADE_CLIENT_ID;
    expect(val).toBeDefined();
    expect(val).toMatch(/^PERS-/);
  });

  it("SNAPTRADE_CONSUMER_KEY is set and has expected length", () => {
    const val = process.env.SNAPTRADE_CONSUMER_KEY;
    expect(val).toBeDefined();
    expect(val!.length).toBeGreaterThan(20);
  });

  it("Google OAuth discovery endpoint is reachable", async () => {
    const res = await fetch(
      "https://accounts.google.com/.well-known/openid-configuration"
    );
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.authorization_endpoint).toContain("accounts.google.com");
    expect(data.token_endpoint).toBeDefined();
  });

  it("Google client ID format is valid", () => {
    const clientId = process.env.GOOGLE_CLIENT_ID!;
    expect(clientId).toMatch(/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/);
  });

  it("SnapTrade API is reachable with client ID", async () => {
    const clientId = process.env.SNAPTRADE_CLIENT_ID!;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch("https://api.snaptrade.com/api/v1/snapTrade/listUsers", {
      signal: controller.signal,
      headers: {
        "clientId": clientId,
        "Content-Type": "application/json",
      },
    });
    clearTimeout(timer);
    // We expect 400 or 401 (missing signature), NOT a network error
    // This confirms the API is reachable and the clientId format is accepted
    expect([400, 401, 403, 200]).toContain(res.status);
  }, 15000);
});
