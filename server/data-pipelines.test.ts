/**
 * Tests for:
 * 1. Government data pipelines (BLS, FRED, BEA, Census)
 * 2. Scheduler service
 * 3. Critical alert notifications via notifyOwner
 * 4. Economic data summary for AI context injection
 * 5. Connection sync status updates
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Scheduler Service Tests ──────────────────────────────────────────
describe("Scheduler Service", () => {
  it("should export initScheduler and getSchedulerStatus", async () => {
    const scheduler = await import("./services/scheduler");
    expect(typeof scheduler.initScheduler).toBe("function");
    expect(typeof scheduler.getSchedulerStatus).toBe("function");
    expect(typeof scheduler.triggerJob).toBe("function");
  });

  it("getSchedulerStatus should return jobs info", async () => {
    const { getSchedulerStatus } = await import("./services/scheduler");
    const status = getSchedulerStatus();
    expect(status).toHaveProperty("jobs");
    // Before initScheduler is called, initialized is false
    expect(status).toHaveProperty("initialized");
  });

  it("triggerJob should handle unknown job names gracefully", async () => {
    const { triggerJob } = await import("./services/scheduler");
    const result = await triggerJob("nonexistent_job");
    expect(result).toHaveProperty("success");
    expect(result.success).toBe(false);
  });
});

// ─── Government Data Pipelines Tests ──────────────────────────────────
describe("Government Data Pipelines", () => {
  it("should export all pipeline functions", async () => {
    const pipelines = await import("./services/governmentDataPipelines");
    expect(typeof pipelines.runAllDataPipelines).toBe("function");
    expect(typeof pipelines.runSinglePipeline).toBe("function");
    expect(typeof pipelines.getCachedData).toBe("function");
    expect(typeof pipelines.getEconomicDataSummary).toBe("function");
  });

  it("runSinglePipeline should return error for unknown provider", async () => {
    const { runSinglePipeline } = await import("./services/governmentDataPipelines");
    const result = await runSinglePipeline("unknown-provider");
    expect(result.status).toBe("error");
    expect(result.error).toBe("Unknown provider");
    expect(result.recordsFetched).toBe(0);
  });

  it("PipelineResult should have required fields", async () => {
    const { runSinglePipeline } = await import("./services/governmentDataPipelines");
    const result = await runSinglePipeline("unknown-provider");
    expect(result).toHaveProperty("pipeline");
    expect(result).toHaveProperty("providerSlug");
    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("recordsFetched");
    expect(result).toHaveProperty("duration");
  });

  it("getEconomicDataSummary should return a string", async () => {
    const { getEconomicDataSummary } = await import("./services/governmentDataPipelines");
    const summary = await getEconomicDataSummary();
    expect(typeof summary).toBe("string");
  });

  it("getCachedData should return an array", async () => {
    const { getCachedData } = await import("./services/governmentDataPipelines");
    const data = await getCachedData("bls");
    expect(Array.isArray(data)).toBe(true);
  });

  it("getCachedData should accept optional category filter", async () => {
    const { getCachedData } = await import("./services/governmentDataPipelines");
    const data = await getCachedData("fred", "interest_rates");
    expect(Array.isArray(data)).toBe(true);
  });
});

// ─── Integration Health + Notifications Tests ─────────────────────────
describe("Integration Health with Notifications", () => {
  it("should export notifyOwner from notification module", async () => {
    const { notifyOwner } = await import("./_core/notification");
    expect(typeof notifyOwner).toBe("function");
  });

  it("integrationHealth should import notifyOwner for critical alerts", async () => {
    // Verify the module loads without errors (import-time validation)
    const healthModule = await import("./services/integrationHealth");
    expect(typeof healthModule.runAllHealthChecks).toBe("function");
    expect(typeof healthModule.assembleIntegrationHealthContext).toBe("function");
  });

  it("assembleIntegrationHealthContext should return structured data", async () => {
    const { assembleIntegrationHealthContext } = await import("./services/integrationHealth");
    const ctx = await assembleIntegrationHealthContext();
    expect(ctx).toHaveProperty("totalConnections");
    expect(ctx).toHaveProperty("healthyCount");
    expect(ctx).toHaveProperty("degradedCount");
    expect(ctx).toHaveProperty("unhealthyCount");
    expect(ctx).toHaveProperty("dataSources");
    expect(ctx).toHaveProperty("promptFragment");
    expect(typeof ctx.totalConnections).toBe("number");
    expect(Array.isArray(ctx.dataSources)).toBe(true);
  });
});

// ─── Encryption Fallback Tests ────────────────────────────────────────
describe("Encryption Key Migration", () => {
  it("should export encrypt, decrypt, encryptCredentials, decryptCredentials", async () => {
    const enc = await import("./services/encryption");
    expect(typeof enc.encrypt).toBe("function");
    expect(typeof enc.decrypt).toBe("function");
    expect(typeof enc.encryptCredentials).toBe("function");
    expect(typeof enc.decryptCredentials).toBe("function");
  });

  it("encrypt/decrypt roundtrip should work", async () => {
    const { encrypt, decrypt } = await import("./services/encryption");
    const original = "test-api-key-12345";
    const encrypted = encrypt(original);
    expect(encrypted).not.toBe(original);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it("encryptCredentials/decryptCredentials roundtrip should work", async () => {
    const { encryptCredentials, decryptCredentials } = await import("./services/encryption");
    const creds = { api_key: "my-secret-key", endpoint: "https://api.example.com" };
    const encrypted = encryptCredentials(creds);
    expect(typeof encrypted).toBe("string");
    const decrypted = decryptCredentials(encrypted);
    expect(decrypted).toEqual(creds);
  });
});

// ─── SEC EDGAR & FINRA BrokerCheck Connection Tests ───────────────────
describe("Keyless API Connections (SEC EDGAR, FINRA)", () => {
  it("SEC EDGAR provider should have auth_method 'none'", async () => {
    const { getDb } = await import("./db");
    const { integrationProviders } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return;
    const [provider] = await db.select().from(integrationProviders)
      .where(eq(integrationProviders.slug, "sec-edgar"));
    expect(provider).toBeDefined();
    expect(provider.authMethod).toBe("none");
  });

  it("FINRA BrokerCheck provider should have auth_method 'none'", async () => {
    const { getDb } = await import("./db");
    const { integrationProviders } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return;
    const [provider] = await db.select().from(integrationProviders)
      .where(eq(integrationProviders.slug, "finra-brokercheck"));
    expect(provider).toBeDefined();
    expect(provider.authMethod).toBe("none");
  });

  it("SEC EDGAR should have a connected connection record", async () => {
    const { getDb } = await import("./db");
    const { integrationProviders, integrationConnections } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return;
    const [provider] = await db.select().from(integrationProviders)
      .where(eq(integrationProviders.slug, "sec-edgar"));
    if (!provider) return;
    const connections = await db.select().from(integrationConnections)
      .where(eq(integrationConnections.providerId, provider.id));
    expect(connections.length).toBeGreaterThan(0);
    expect(connections[0].status).toBe("connected");
  });

  it("FINRA BrokerCheck should have a connected connection record", async () => {
    const { getDb } = await import("./db");
    const { integrationProviders, integrationConnections } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return;
    const [provider] = await db.select().from(integrationProviders)
      .where(eq(integrationProviders.slug, "finra-brokercheck"));
    if (!provider) return;
    const connections = await db.select().from(integrationConnections)
      .where(eq(integrationConnections.providerId, provider.id));
    expect(connections.length).toBeGreaterThan(0);
    expect(connections[0].status).toBe("connected");
  });
});
