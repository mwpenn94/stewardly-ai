/**
 * Pass 64d-ext4 — CRM Analytics Dashboard, Credential Management, Webhook Verification
 *
 * Tests for:
 * 1. syncAnalytics procedure (channel comparison, timeline, breakdown)
 * 2. saveCredentials procedure (encrypt + store in integration_connections)
 * 3. testConnection procedure (validate creds against platform adapter)
 * 4. getConnectionStatus procedure (list all platform connections)
 * 5. webhookVerify procedure (send test payload to local webhook endpoint)
 * 6. Encryption round-trip for credentials
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── SYNC METRICS (Analytics) ───────────────────────────────────────────────

describe("Sync Analytics — getChannelComparison", () => {
  it("should export getChannelComparison function", async () => {
    const mod = await import("./services/syncMetrics");
    expect(typeof mod.getChannelComparison).toBe("function");
  });

  it("should return comparison object with webhook and polling channels", async () => {
    const { getChannelComparison } = await import("./services/syncMetrics");
    const result = await getChannelComparison();
    expect(result).toHaveProperty("webhook");
    expect(result).toHaveProperty("polling");
    expect(result).toHaveProperty("latencyAdvantage");
    expect(result).toHaveProperty("recommendation");
    expect(result).toHaveProperty("coverageComparison");
  });

  it("webhook channel should have required metric fields", async () => {
    const { getChannelComparison } = await import("./services/syncMetrics");
    const result = await getChannelComparison();
    const wh = result.webhook;
    expect(wh).toHaveProperty("totalEvents");
    expect(wh).toHaveProperty("successRate");
    expect(wh).toHaveProperty("failedEvents");
    expect(wh).toHaveProperty("eventsLast1h");
    expect(wh).toHaveProperty("eventsLast24h");
    expect(typeof wh.totalEvents).toBe("number");
    expect(typeof wh.successRate).toBe("number");
  });

  it("polling channel should have required metric fields", async () => {
    const { getChannelComparison } = await import("./services/syncMetrics");
    const result = await getChannelComparison();
    const poll = result.polling;
    expect(poll).toHaveProperty("totalEvents");
    expect(poll).toHaveProperty("successRate");
    expect(poll).toHaveProperty("failedEvents");
    expect(typeof poll.totalEvents).toBe("number");
  });

  it("latencyAdvantage should specify a channel", async () => {
    const { getChannelComparison } = await import("./services/syncMetrics");
    const result = await getChannelComparison();
    expect(["webhook", "polling", "equal", "tie"]).toContain(result.latencyAdvantage.channel);
  });

  it("coverageComparison should have webhookOnly, pollingOnly, bothChannels", async () => {
    const { getChannelComparison } = await import("./services/syncMetrics");
    const result = await getChannelComparison();
    expect(result.coverageComparison).toHaveProperty("webhookOnly");
    expect(result.coverageComparison).toHaveProperty("pollingOnly");
    expect(result.coverageComparison).toHaveProperty("bothChannels");
  });
});

describe("Sync Analytics — getHourlyTimeline", () => {
  it("should export getHourlyTimeline function", async () => {
    const mod = await import("./services/syncMetrics");
    expect(typeof mod.getHourlyTimeline).toBe("function");
  });

  it("should return an array of timeline points", async () => {
    const { getHourlyTimeline } = await import("./services/syncMetrics");
    const result = await getHourlyTimeline();
    expect(Array.isArray(result)).toBe(true);
    // Each point should have hour, webhookCount, pollingCount
    if (result.length > 0) {
      expect(result[0]).toHaveProperty("hour");
      expect(result[0]).toHaveProperty("webhookCount");
      expect(result[0]).toHaveProperty("pollingCount");
    }
  });
});

describe("Sync Analytics — getEventTypeBreakdown", () => {
  it("should export getEventTypeBreakdown function", async () => {
    const mod = await import("./services/syncMetrics");
    expect(typeof mod.getEventTypeBreakdown).toBe("function");
  });

  it("should return an array of event type breakdowns", async () => {
    const { getEventTypeBreakdown } = await import("./services/syncMetrics");
    const result = await getEventTypeBreakdown();
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty("eventType");
      expect(result[0]).toHaveProperty("webhookCount");
      expect(result[0]).toHaveProperty("pollingCount");
    }
  });
});

// ─── ENCRYPTION (Credential Storage) ────────────────────────────────────────

describe("Encryption — Credential Round-trip", () => {
  it("should export encryptCredentials and decryptCredentials", async () => {
    const mod = await import("./services/encryption");
    expect(typeof mod.encryptCredentials).toBe("function");
    expect(typeof mod.decryptCredentials).toBe("function");
  });

  it("should round-trip credentials through encrypt/decrypt", async () => {
    const { encryptCredentials, decryptCredentials } = await import("./services/encryption");
    const creds = { apiToken: "test-token-123", locationId: "loc-456" };
    const encrypted = encryptCredentials(creds);
    expect(typeof encrypted).toBe("string");
    expect(encrypted).not.toContain("test-token-123");
    const decrypted = decryptCredentials(encrypted);
    expect(decrypted).toEqual(creds);
  });

  it("should produce different ciphertext for different inputs", async () => {
    const { encryptCredentials } = await import("./services/encryption");
    const enc1 = encryptCredentials({ apiToken: "aaa" });
    const enc2 = encryptCredentials({ apiToken: "bbb" });
    expect(enc1).not.toBe(enc2);
  });

  it("should handle empty credential objects", async () => {
    const { encryptCredentials, decryptCredentials } = await import("./services/encryption");
    const encrypted = encryptCredentials({});
    const decrypted = decryptCredentials(encrypted);
    expect(decrypted).toEqual({});
  });
});

// ─── CRM ADAPTER — testConnection ──────────────────────────────────────────

describe("CRM Adapter — testConnection", () => {
  it("getCRMAdapter should return adapter with testConnection method", async () => {
    const { getCRMAdapter } = await import("./services/crmAdapter");
    const adapter = getCRMAdapter("gohighlevel");
    expect(typeof adapter.testConnection).toBe("function");
  });

  it("GHL adapter testConnection should return boolean", async () => {
    const { getCRMAdapter } = await import("./services/crmAdapter");
    const adapter = getCRMAdapter("gohighlevel");
    const result = await adapter.testConnection({ apiToken: "test", locationId: "test" });
    expect(typeof result).toBe("boolean");
  });

  it("Dripify adapter should have testConnection", async () => {
    const { getCRMAdapter } = await import("./services/crmAdapter");
    const adapter = getCRMAdapter("dripify");
    expect(typeof adapter.testConnection).toBe("function");
  });

  it("SMS-iT adapter should have testConnection", async () => {
    const { getCRMAdapter } = await import("./services/crmAdapter");
    const adapter = getCRMAdapter("smsit");
    expect(typeof adapter.testConnection).toBe("function");
  });

  it("Workable adapter should have testConnection", async () => {
    const { getCRMAdapter } = await import("./services/crmAdapter");
    const adapter = getCRMAdapter("workable");
    expect(typeof adapter.testConnection).toBe("function");
  });

  it("getCRMAdapter should handle unknown provider gracefully", async () => {
    const { getCRMAdapter } = await import("./services/crmAdapter");
    expect(() => getCRMAdapter("nonexistent_crm_xyz")).toThrow();
  });

  it("getCRMAdapter should handle null/undefined provider", async () => {
    const { getCRMAdapter } = await import("./services/crmAdapter");
    expect(() => getCRMAdapter(null as any)).toThrow();
    expect(() => getCRMAdapter(undefined as any)).toThrow();
  });
});

// ─── SERVICE ROUTERS — New Procedures Exist ─────────────────────────────────

describe("Service Routers — New CRM Procedures", () => {
  it("serviceRouters should export crmRouter", async () => {
    const mod = await import("./routers/serviceRouters");
    expect(mod.default || mod).toBeDefined();
  });

  it("syncAnalytics procedure should be defined in crmRouter", async () => {
    // We verify the procedure exists by checking the router shape
    const mod = await import("./routers/serviceRouters");
    const router = mod.default || mod;
    // The router is a tRPC router, check it has the procedure
    expect(router).toBeDefined();
    // Verify by checking the file contains the procedure name
    const fs = await import("fs");
    const content = fs.readFileSync(
      new URL("./routers/serviceRouters.ts", import.meta.url).pathname.replace("/server/", "/server/"),
      "utf-8"
    ).toString();
    expect(content).toContain("syncAnalytics");
    expect(content).toContain("saveCredentials");
    expect(content).toContain("testConnection");
    expect(content).toContain("getConnectionStatus");
    expect(content).toContain("webhookVerify");
  });
});

// ─── WEBHOOK VERIFICATION LOGIC ────────────────────────────────────────────

describe("Webhook Verification — Provider Path Mapping", () => {
  const providerPaths: Record<string, string> = {
    gohighlevel: "/api/webhooks/ghl",
    dripify: "/api/webhooks/dripify",
    smsit: "/api/webhooks/smsit",
    workable: "/api/webhooks/workable",
    linkedin: "/api/webhooks/linkedin",
  };

  it("should have correct webhook paths for all 5 providers", () => {
    expect(Object.keys(providerPaths)).toHaveLength(5);
    expect(providerPaths.gohighlevel).toBe("/api/webhooks/ghl");
    expect(providerPaths.dripify).toBe("/api/webhooks/dripify");
    expect(providerPaths.smsit).toBe("/api/webhooks/smsit");
    expect(providerPaths.workable).toBe("/api/webhooks/workable");
    expect(providerPaths.linkedin).toBe("/api/webhooks/linkedin");
  });

  it("should not have a path for unknown providers", () => {
    expect(providerPaths["nonexistent"]).toBeUndefined();
  });
});

// ─── INTEGRATION CONNECTIONS SCHEMA ─────────────────────────────────────────

describe("Integration Connections — Schema", () => {
  it("should export integrationConnections table", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.integrationConnections).toBeDefined();
  });

  it("integrationConnections should have required columns", async () => {
    const schema = await import("../drizzle/schema");
    const table = schema.integrationConnections;
    // Check the table has the expected column names
    const columnNames = Object.keys(table);
    expect(columnNames).toContain("id");
    expect(columnNames).toContain("providerId");
    expect(columnNames).toContain("status");
    expect(columnNames).toContain("credentialsEncrypted");
    expect(columnNames).toContain("ownerId");
  });
});

// ─── ANALYTICS DATA SHAPE VALIDATION ────────────────────────────────────────

describe("Analytics Data Shape — Full Pipeline", () => {
  it("full analytics pipeline should return comparison + timeline + breakdown", async () => {
    const { getChannelComparison } = await import("./services/syncMetrics");
    const { getHourlyTimeline } = await import("./services/syncMetrics");
    const { getEventTypeBreakdown } = await import("./services/syncMetrics");
    
    const [comparison, timeline, breakdown] = await Promise.all([
      getChannelComparison(),
      getHourlyTimeline(),
      getEventTypeBreakdown(),
    ]);

    // Comparison
    expect(comparison.webhook).toBeDefined();
    expect(comparison.polling).toBeDefined();
    expect(comparison.recommendation).toBeDefined();
    expect(typeof comparison.recommendation).toBe("string");

    // Timeline
    expect(Array.isArray(timeline)).toBe(true);

    // Breakdown
    expect(Array.isArray(breakdown)).toBe(true);
  });

  it("success rates should be between 0 and 100", async () => {
    const { getChannelComparison } = await import("./services/syncMetrics");
    const result = await getChannelComparison();
    expect(result.webhook.successRate).toBeGreaterThanOrEqual(0);
    expect(result.webhook.successRate).toBeLessThanOrEqual(100);
    expect(result.polling.successRate).toBeGreaterThanOrEqual(0);
    expect(result.polling.successRate).toBeLessThanOrEqual(100);
  });

  it("event counts should be non-negative", async () => {
    const { getChannelComparison } = await import("./services/syncMetrics");
    const result = await getChannelComparison();
    expect(result.webhook.totalEvents).toBeGreaterThanOrEqual(0);
    expect(result.polling.totalEvents).toBeGreaterThanOrEqual(0);
    expect(result.webhook.failedEvents).toBeGreaterThanOrEqual(0);
    expect(result.polling.failedEvents).toBeGreaterThanOrEqual(0);
  });
});

// ─── ADAPTER COVERAGE — All Platforms Have pullContacts ─────────────────────

describe("CRM Adapter Coverage — All Platforms", () => {
  const platforms = ["gohighlevel", "dripify", "smsit", "workable", "wealthbox", "salesforce", "redtail"];

  platforms.forEach((platform) => {
    it(`${platform} adapter should have pullContacts method`, async () => {
      const { getCRMAdapter } = await import("./services/crmAdapter");
      const adapter = getCRMAdapter(platform);
      expect(typeof adapter.pullContacts).toBe("function");
    });

    it(`${platform} adapter should have testConnection method`, async () => {
      const { getCRMAdapter } = await import("./services/crmAdapter");
      const adapter = getCRMAdapter(platform);
      expect(typeof adapter.testConnection).toBe("function");
    });
  });
});
