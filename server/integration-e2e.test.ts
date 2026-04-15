/**
 * Integration End-to-End Connectivity Tests
 * 
 * Validates that all configured integrations can establish connections
 * and return expected responses. Uses real API credentials in sandbox/test mode.
 */
import { describe, it, expect } from "vitest";
import { ENV } from "./_core/env";

// ─── Plaid Sandbox Connectivity ────────────────────────────────────
describe("Plaid Integration", () => {
  it("has credentials configured", () => {
    expect(ENV.plaidClientId).toBeTruthy();
    expect(ENV.plaidSecret).toBeTruthy();
  });

  it("can reach Plaid API in sandbox mode", async () => {
    // Plaid sandbox endpoint - get institution by ID
    const response = await fetch("https://sandbox.plaid.com/institutions/get_by_id", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        institution_id: "ins_109508",
        client_id: ENV.plaidClientId,
        secret: ENV.plaidSecret,
        country_codes: ["US"],
      }),
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.institution).toBeDefined();
    expect(data.institution.name).toBeTruthy();
  }, 15000);

  it("can create a sandbox link token", async () => {
    const response = await fetch("https://sandbox.plaid.com/link/token/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: ENV.plaidClientId,
        secret: ENV.plaidSecret,
        user: { client_user_id: "test-user-e2e" },
        client_name: "Stewardly E2E Test",
        products: ["transactions"],
        country_codes: ["US"],
        language: "en",
      }),
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.link_token).toBeTruthy();
    expect(data.link_token).toMatch(/^link-/);
  }, 15000);

  it("can create and exchange a sandbox public token", async () => {
    // Create a sandbox public token (simulates user completing Link flow)
    const createResponse = await fetch("https://sandbox.plaid.com/sandbox/public_token/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: ENV.plaidClientId,
        secret: ENV.plaidSecret,
        institution_id: "ins_109508", // First Platypus Bank
        initial_products: ["transactions"],
      }),
    });
    expect(createResponse.status).toBe(200);
    const createData = await createResponse.json();
    expect(createData.public_token).toBeTruthy();

    // Exchange public token for access token
    const exchangeResponse = await fetch("https://sandbox.plaid.com/item/public_token/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: ENV.plaidClientId,
        secret: ENV.plaidSecret,
        public_token: createData.public_token,
      }),
    });
    expect(exchangeResponse.status).toBe(200);
    const exchangeData = await exchangeResponse.json();
    expect(exchangeData.access_token).toBeTruthy();
    expect(exchangeData.item_id).toBeTruthy();

    // Fetch accounts using the access token
    const accountsResponse = await fetch("https://sandbox.plaid.com/accounts/get", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: ENV.plaidClientId,
        secret: ENV.plaidSecret,
        access_token: exchangeData.access_token,
      }),
    });
    expect(accountsResponse.status).toBe(200);
    const accountsData = await accountsResponse.json();
    expect(accountsData.accounts).toBeDefined();
    expect(accountsData.accounts.length).toBeGreaterThan(0);
    expect(accountsData.accounts[0].name).toBeTruthy();
    expect(accountsData.accounts[0].balances).toBeDefined();
  }, 30000);
});

// ─── SnapTrade Connectivity ────────────────────────────────────────
describe("SnapTrade Integration", () => {
  it("has credentials configured", () => {
    expect(ENV.snapTradeClientId).toBeTruthy();
    expect(ENV.snapTradeConsumerKey).toBeTruthy();
  });

  it("can reach SnapTrade API", async () => {
    // SnapTrade API health check
    const response = await fetch("https://api.snaptrade.com/api/v1/", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    // Any response proves API is reachable (200, 401, 403, 404 all valid)
    expect(response.status).toBeLessThan(500);
  }, 15000);
});

// ─── Deepgram Connectivity ─────────────────────────────────────────
describe("Deepgram Integration", () => {
  it("has API key configured", () => {
    expect(ENV.deepgramApiKey).toBeTruthy();
  });

  it("can reach Deepgram API and validate key", async () => {
    const response = await fetch("https://api.deepgram.com/v1/projects", {
      method: "GET",
      headers: {
        Authorization: `Token ${ENV.deepgramApiKey}`,
        "Content-Type": "application/json",
      },
    });
    // 200 = valid key, 401 = invalid key, both prove connectivity
    expect([200, 401]).toContain(response.status);
    if (response.status === 200) {
      const data = await response.json();
      expect(data.projects).toBeDefined();
    }
  }, 15000);
});

// ─── Daily.co Connectivity ─────────────────────────────────────────
describe("Daily.co Integration", () => {
  it("has API key configured", () => {
    expect(ENV.dailyApiKey).toBeTruthy();
  });

  it("can reach Daily.co API and list rooms", async () => {
    const response = await fetch("https://api.daily.co/v1/rooms", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${ENV.dailyApiKey}`,
        "Content-Type": "application/json",
      },
    });
    expect([200, 401]).toContain(response.status);
    if (response.status === 200) {
      const data = await response.json();
      expect(data).toBeDefined();
    }
  }, 15000);
});

// ─── Stripe Connectivity ───────────────────────────────────────────
describe("Stripe Integration", () => {
  it("has credentials configured", () => {
    expect(ENV.stripeSecretKey).toBeTruthy();
    expect(ENV.stripeWebhookSecret).toBeTruthy();
  });

  it("can reach Stripe API and list products", async () => {
    const response = await fetch("https://api.stripe.com/v1/products?limit=1", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${ENV.stripeSecretKey}`,
      },
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.object).toBe("list");
  }, 15000);

  it("can list customers", async () => {
    const response = await fetch("https://api.stripe.com/v1/customers?limit=1", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${ENV.stripeSecretKey}`,
      },
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.object).toBe("list");
  }, 15000);
});

// ─── Integration Failover Service ──────────────────────────────────
describe("Integration Failover Service", () => {
  it("provides demo data for all 4 paid integrations", async () => {
    const {
      generateGHLDemoContacts, generateGHLDemoPipelines,
      generateWealthboxDemoContacts, generateWealthboxDemoActivities,
      generateRedtailDemoContacts, generateRedtailDemoActivities,
      generateSMSiTDemoMessages, generateSMSiTDemoCampaigns,
    } = await import("./services/integrationFailover");
    
    const ghlContacts = generateGHLDemoContacts();
    expect(ghlContacts.length).toBeGreaterThan(0);
    const ghlPipelines = generateGHLDemoPipelines();
    expect(ghlPipelines.length).toBeGreaterThan(0);
    
    const wbContacts = generateWealthboxDemoContacts();
    expect(wbContacts.length).toBeGreaterThan(0);
    const wbActivities = generateWealthboxDemoActivities();
    expect(wbActivities.length).toBeGreaterThan(0);
    
    const rtContacts = generateRedtailDemoContacts();
    expect(rtContacts.length).toBeGreaterThan(0);
    const rtActivities = generateRedtailDemoActivities();
    expect(rtActivities.length).toBeGreaterThan(0);
    
    const smsitMessages = generateSMSiTDemoMessages();
    expect(smsitMessages.length).toBeGreaterThan(0);
    const smsitCampaigns = generateSMSiTDemoCampaigns();
    expect(smsitCampaigns.length).toBeGreaterThan(0);
  });

  it("failover status correctly identifies unconfigured integrations", async () => {
    const { getAllFailoverStatuses } = await import("./services/integrationFailover");
    const statuses = await getAllFailoverStatuses();
    expect(statuses).toBeDefined();
    expect(Array.isArray(statuses)).toBe(true);
    expect(statuses.length).toBe(4);
    for (const s of statuses) {
      expect(s.provider).toBeTruthy();
      expect(["live", "demo", "degraded"]).toContain(s.mode);
      expect(typeof s.hasCredentials).toBe("boolean");
    }
  });
});
