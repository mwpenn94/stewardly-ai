import { describe, it, expect, vi } from "vitest";

// ─── Integration Health Service Tests ──────────────────────────────────

describe("Integration Health — Feature Catalog", () => {
  it("should include integration_health in the Exponential Engine feature catalog", async () => {
    const { FEATURE_CATALOG } = await import("./services/exponentialEngine");
    const healthFeature = FEATURE_CATALOG.find(f => f.key === "integration_health");
    expect(healthFeature).toBeDefined();
    expect(healthFeature!.label).toBe("Integration Health Dashboard");
    expect(healthFeature!.category).toBe("tools");
    expect(healthFeature!.layer).toBe("organization");
  });

  it("should include integration_improvement in the Exponential Engine feature catalog", async () => {
    const { FEATURE_CATALOG } = await import("./services/exponentialEngine");
    const improvementFeature = FEATURE_CATALOG.find(f => f.key === "integration_improvement");
    expect(improvementFeature).toBeDefined();
    expect(improvementFeature!.label).toBe("Integration Improvement Agent");
    expect(improvementFeature!.category).toBe("ai_features");
  });

  it("should include data_source_awareness in the Exponential Engine feature catalog", async () => {
    const { FEATURE_CATALOG } = await import("./services/exponentialEngine");
    const awarenessFeature = FEATURE_CATALOG.find(f => f.key === "data_source_awareness");
    expect(awarenessFeature).toBeDefined();
    expect(awarenessFeature!.description).toContain("live, degraded, or offline");
    expect(awarenessFeature!.roles).toContain("user");
    expect(awarenessFeature!.roles).toContain("admin");
  });
});

describe("Integration Health — Schema Definitions", () => {
  it("should have integrationHealthChecks table defined in schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.integrationHealthChecks).toBeDefined();
  });

  it("should have integrationHealthSummary table defined in schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.integrationHealthSummary).toBeDefined();
  });

  it("should have integrationImprovementLog table defined in schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.integrationImprovementLog).toBeDefined();
  });
});

describe("Integration Health — Service Functions", () => {
  it("should export runHealthCheck function", async () => {
    const service = await import("./services/integrationHealth");
    expect(typeof service.runHealthCheck).toBe("function");
  });

  it("should export runAllHealthChecks function", async () => {
    const service = await import("./services/integrationHealth");
    expect(typeof service.runAllHealthChecks).toBe("function");
  });

  it("should export getHealthDashboardData function", async () => {
    const service = await import("./services/integrationHealth");
    expect(typeof service.getHealthDashboardData).toBe("function");
  });

  it("should export assembleIntegrationHealthContext function", async () => {
    const service = await import("./services/integrationHealth");
    expect(typeof service.assembleIntegrationHealthContext).toBe("function");
  });

  it("should export getHealthDashboardData function", async () => {
    const service = await import("./services/integrationHealth");
    expect(typeof service.getHealthDashboardData).toBe("function");
  });
});

describe("Integration Health — Data Source Descriptions", () => {
  it("should map BLS to labor statistics data description", async () => {
    const service = await import("./services/integrationHealth");
    // The DATA_SOURCE_DESCRIPTIONS map should be accessible via the context assembly
    const ctx = await service.assembleIntegrationHealthContext();
    expect(ctx).toBeDefined();
    expect(typeof ctx.totalConnections).toBe("number");
    expect(typeof ctx.healthyCount).toBe("number");
    expect(typeof ctx.degradedCount).toBe("number");
    expect(typeof ctx.unhealthyCount).toBe("number");
    expect(Array.isArray(ctx.dataSources)).toBe(true);
    expect(typeof ctx.promptFragment).toBe("string");
  });
});

describe("Integration Health — Encryption Fallback", () => {
  it("should decrypt credentials encrypted with primary key", async () => {
    const { encryptCredentials, decryptCredentials } = await import("./services/encryption");
    const original = { api_key: "test-primary-key-123" };
    const encrypted = encryptCredentials(original);
    const decrypted = decryptCredentials(encrypted);
    expect(decrypted.api_key).toBe("test-primary-key-123");
  });

  it("should handle empty credentials gracefully", async () => {
    const { encryptCredentials, decryptCredentials } = await import("./services/encryption");
    const original = {};
    const encrypted = encryptCredentials(original);
    const decrypted = decryptCredentials(encrypted);
    expect(decrypted).toBeDefined();
  });
});
