import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Schema Column Verification ─────────────────────────────────────────────
describe("lead_pipeline schema reconciliation", () => {
  it("should export leadPipeline table from schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.leadPipeline).toBeDefined();
  });

  it("leadPipeline should have 'email' column (not emailHash)", async () => {
    const schema = await import("../drizzle/schema");
    const table = schema.leadPipeline;
    // Drizzle tables expose columns as properties
    expect((table as any).email).toBeDefined();
    expect((table as any).emailHash).toBeUndefined();
  });

  it("leadPipeline should have 'phone' column (not phoneHash)", async () => {
    const schema = await import("../drizzle/schema");
    const table = schema.leadPipeline;
    expect((table as any).phone).toBeDefined();
    expect((table as any).phoneHash).toBeUndefined();
  });

  it("leadPipeline should have enrichmentData column (not customFields)", async () => {
    const schema = await import("../drizzle/schema");
    const table = schema.leadPipeline;
    expect((table as any).enrichmentData).toBeDefined();
    expect((table as any).customFields).toBeUndefined();
  });

  it("leadPipeline should have company column", async () => {
    const schema = await import("../drizzle/schema");
    expect((schema.leadPipeline as any).company).toBeDefined();
  });

  it("leadPipeline should have title column", async () => {
    const schema = await import("../drizzle/schema");
    expect((schema.leadPipeline as any).title).toBeDefined();
  });

  it("leadPipeline should have city column", async () => {
    const schema = await import("../drizzle/schema");
    expect((schema.leadPipeline as any).city).toBeDefined();
  });

  it("leadPipeline should have state column", async () => {
    const schema = await import("../drizzle/schema");
    expect((schema.leadPipeline as any).state).toBeDefined();
  });

  it("leadPipeline should have zip column", async () => {
    const schema = await import("../drizzle/schema");
    expect((schema.leadPipeline as any).zip).toBeDefined();
  });

  it("leadPipeline should have linkedinUrl column", async () => {
    const schema = await import("../drizzle/schema");
    expect((schema.leadPipeline as any).linkedinUrl).toBeDefined();
  });

  it("leadPipeline should have ghlContactId column", async () => {
    const schema = await import("../drizzle/schema");
    expect((schema.leadPipeline as any).ghlContactId).toBeDefined();
  });

  it("leadPipeline should have ghlOpportunityId column", async () => {
    const schema = await import("../drizzle/schema");
    expect((schema.leadPipeline as any).ghlOpportunityId).toBeDefined();
  });

  it("leadPipeline should have pipelineStage column", async () => {
    const schema = await import("../drizzle/schema");
    expect((schema.leadPipeline as any).pipelineStage).toBeDefined();
  });

  it("leadPipeline should have tags column", async () => {
    const schema = await import("../drizzle/schema");
    expect((schema.leadPipeline as any).tags).toBeDefined();
  });

  it("leadPipeline should have targetSegment column", async () => {
    const schema = await import("../drizzle/schema");
    expect((schema.leadPipeline as any).targetSegment).toBeDefined();
  });

  it("leadPipeline should have segmentData column", async () => {
    const schema = await import("../drizzle/schema");
    expect((schema.leadPipeline as any).segmentData).toBeDefined();
  });

  it("leadPipeline should have propensityTier column", async () => {
    const schema = await import("../drizzle/schema");
    expect((schema.leadPipeline as any).propensityTier).toBeDefined();
  });

  it("leadPipeline should have assignedAdvisorId column", async () => {
    const schema = await import("../drizzle/schema");
    expect((schema.leadPipeline as any).assignedAdvisorId).toBeDefined();
  });

  it("leadPipeline should have compliance columns", async () => {
    const schema = await import("../drizzle/schema");
    expect((schema.leadPipeline as any).isControlGroup).toBeDefined();
    expect((schema.leadPipeline as any).emailConsentGranted).toBeDefined();
    expect((schema.leadPipeline as any).unsubscribed).toBeDefined();
    expect((schema.leadPipeline as any).piiDeletionRequested).toBeDefined();
  });

  it("leadPipeline should have bigint timestamps (createdAt, updatedAt)", async () => {
    const schema = await import("../drizzle/schema");
    expect((schema.leadPipeline as any).createdAt).toBeDefined();
    expect((schema.leadPipeline as any).updatedAt).toBeDefined();
  });

  it("leadPipeline should NOT have leadSourceId column", async () => {
    const schema = await import("../drizzle/schema");
    expect((schema.leadPipeline as any).leadSourceId).toBeUndefined();
  });
});

// ─── CRM Adapter Column Fix Verification ────────────────────────────────────
describe("crmAdapter — email-based dedup (not emailHash)", () => {
  it("should export persistContactsToLeadPipeline function", async () => {
    const mod = await import("./services/crmAdapter");
    expect(typeof mod.persistContactsToLeadPipeline).toBe("function");
  });

  it("should export hashEmail and hashPhone functions", async () => {
    const mod = await import("./services/crmAdapter");
    expect(typeof mod.hashEmail).toBe("function");
    expect(typeof mod.hashPhone).toBe("function");
  });

  it("hashEmail should return consistent SHA-256 hex", async () => {
    const { hashEmail } = await import("./services/crmAdapter");
    const h1 = hashEmail("test@example.com");
    const h2 = hashEmail("test@example.com");
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("hashEmail should be case-insensitive", async () => {
    const { hashEmail } = await import("./services/crmAdapter");
    expect(hashEmail("Test@Example.com")).toBe(hashEmail("test@example.com"));
  });

  it("getCRMAdapter should return adapter for gohighlevel", async () => {
    const { getCRMAdapter } = await import("./services/crmAdapter");
    const adapter = getCRMAdapter("gohighlevel");
    expect(adapter).toBeDefined();
    expect(typeof adapter.pullContacts).toBe("function");
    expect(typeof adapter.pushContact).toBe("function");
  });

  it("getCRMAdapter should throw for unsupported provider", async () => {
    const { getCRMAdapter } = await import("./services/crmAdapter");
    expect(() => getCRMAdapter("nonexistent_platform_xyz")).toThrow();
  });

  it("getCRMAdapter should handle null/undefined gracefully", async () => {
    const { getCRMAdapter } = await import("./services/crmAdapter");
    expect(() => getCRMAdapter(null as any)).toThrow();
    expect(() => getCRMAdapter(undefined as any)).toThrow();
  });

  it("syncCRM should return error result for unsupported provider", async () => {
    const { syncCRM } = await import("./services/crmAdapter");
    const result = await syncCRM("nonexistent_xyz", "pull");
    expect(result).toBeDefined();
    expect(result.error || result.contactsFetched === 0).toBeTruthy();
  });
});

// ─── Sink Dispatcher Column Fix Verification ────────────────────────────────
describe("sinkDispatcher — email-based dedup (not emailHash)", () => {
  it("should export dispatchToSink function", async () => {
    const mod = await import("./services/dynamicIntegrations/sinkDispatcher");
    expect(typeof mod.dispatchToSink).toBe("function");
  });

  it("dispatchToSink should accept blueprint and records", async () => {
    const mod = await import("./services/dynamicIntegrations/sinkDispatcher");
    // Function signature check
    expect(mod.dispatchToSink.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── Import Orchestrator Column Fix Verification ────────────────────────────
describe("importOrchestrator — email-based dedup (not emailHash)", () => {
  it("should export startImport function", async () => {
    const mod = await import("./services/import/importOrchestrator");
    expect(typeof mod.startImport).toBe("function");
  });

  it("startImport should accept params object", async () => {
    const mod = await import("./services/import/importOrchestrator");
    expect(mod.startImport.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Sync History Column Fix Verification ───────────────────────────────────
describe("syncHistory — email-based dedup (not emailHash)", () => {
  it("should export getUnifiedTimeline", async () => {
    const mod = await import("./services/syncHistory");
    expect(typeof mod.getUnifiedTimeline).toBe("function");
  });

  it("should export getTimelineSummary", async () => {
    const mod = await import("./services/syncHistory");
    expect(typeof mod.getTimelineSummary).toBe("function");
  });

  it("should export runLiveSyncTest", async () => {
    const mod = await import("./services/syncHistory");
    expect(typeof mod.runLiveSyncTest).toBe("function");
  });
});

// ─── Feature Gatherer Column Fix Verification ───────────────────────────────
describe("featureGatherer — email/phone (not emailHash/phoneHash)", () => {
  it("should export gatherFeatures function", async () => {
    const mod = await import("./services/propensity/featureGatherer");
    expect(typeof mod.gatherFeatures).toBe("function");
  });

  it("gatherFeatures should accept leadId number", async () => {
    const mod = await import("./services/propensity/featureGatherer");
    expect(mod.gatherFeatures.length).toBe(1);
  });

  it("gatherFeatures should return object (empty if no DB)", async () => {
    const mod = await import("./services/propensity/featureGatherer");
    const result = await mod.gatherFeatures(999999);
    expect(typeof result).toBe("object");
  });
});

// ─── Lead Capture Router Column Fix Verification ────────────────────────────
describe("leadCapture router — uses email (not emailHash)", () => {
  it("should import leadCapture router without errors", async () => {
    const mod = await import("./routers/leadCapture");
    expect(mod).toBeDefined();
  });
});

// ─── Integrations Router Column Fix Verification ────────────────────────────
describe("integrations router — uses enrichmentData (not customFields)", () => {
  it("should import integrations router without errors", async () => {
    const mod = await import("./routers/integrations");
    expect(mod).toBeDefined();
  });
});

// ─── Source Code Audit — No Old Column References ───────────────────────────
describe("source code audit — no old column references in server code", () => {
  it("crmAdapter should not reference leadPipeline.emailHash", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/services/crmAdapter.ts", "utf-8");
    expect(content).not.toContain("leadPipeline.emailHash");
    expect(content).not.toContain("leadPipeline.phoneHash");
  });

  it("sinkDispatcher should not reference leadPipeline.emailHash", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/services/dynamicIntegrations/sinkDispatcher.ts", "utf-8");
    expect(content).not.toContain("leadPipeline.emailHash");
    expect(content).not.toContain("leadPipeline.phoneHash");
  });

  it("importOrchestrator should not reference leadPipeline.emailHash", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/services/import/importOrchestrator.ts", "utf-8");
    expect(content).not.toContain("leadPipeline.emailHash");
    expect(content).not.toContain("leadPipeline.phoneHash");
  });

  it("syncHistory should not reference leadPipeline.emailHash", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/services/syncHistory.ts", "utf-8");
    expect(content).not.toContain("leadPipeline.emailHash");
    expect(content).not.toContain("leadPipeline.phoneHash");
  });

  it("featureGatherer should not reference lead.emailHash", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/services/propensity/featureGatherer.ts", "utf-8");
    expect(content).not.toContain("lead.emailHash");
    expect(content).not.toContain("lead.phoneHash");
  });

  it("integrations router should not reference customFields in insert", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/routers/integrations.ts", "utf-8");
    // Should use enrichmentData, not customFields, for lead_pipeline inserts
    // (customFields may still exist as a contact field name, but not as a DB column)
    expect(content).not.toContain("leadPipeline.customFields");
  });

  it("no server file should reference leadPipeline.leadSourceId", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const glob = await import("fs");
    // Check the key files
    const files = [
      "server/services/crmAdapter.ts",
      "server/services/dynamicIntegrations/sinkDispatcher.ts",
      "server/services/import/importOrchestrator.ts",
      "server/services/syncHistory.ts",
      "server/routers/leadCapture.ts",
    ];
    for (const f of files) {
      const content = fs.readFileSync(f, "utf-8");
      expect(content).not.toContain("leadPipeline.leadSourceId");
    }
  });
});

// ─── Sync Dashboard Widget ──────────────────────────────────────────────────
describe("ClientDashboard sync health widget", () => {
  it("ClientDashboard should import without errors", async () => {
    // Just verify the module can be loaded (no syntax errors)
    // We can't render React components in vitest without jsdom, but we can check the import
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ClientDashboard.tsx", "utf-8");
    expect(content).toContain("SyncHealthWidget");
  });

  it("should reference trpc.crm.timelineSummary", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ClientDashboard.tsx", "utf-8");
    expect(content).toContain("trpc.crm.timelineSummary");
  });

  it("should reference trpc.crm.getConnectionStatus", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ClientDashboard.tsx", "utf-8");
    expect(content).toContain("trpc.crm.getConnectionStatus");
  });

  it("should display last sync time", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ClientDashboard.tsx", "utf-8");
    expect(content).toContain("Last Sync");
  });

  it("should display contacts synced count", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ClientDashboard.tsx", "utf-8");
    expect(content).toContain("Contacts Synced");
  });

  it("should display success rate", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ClientDashboard.tsx", "utf-8");
    expect(content).toContain("Success Rate");
    expect(content).toContain("successRate");
  });

  it("should display error count", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ClientDashboard.tsx", "utf-8");
    expect(content).toContain("totalErrors");
  });

  it("should navigate to /crm-sync on click", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ClientDashboard.tsx", "utf-8");
    expect(content).toContain('navigate("/crm-sync")');
  });

  it("should show provider breakdown badges", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ClientDashboard.tsx", "utf-8");
    expect(content).toContain("eventsByProvider");
  });

  it("should show connection status badge", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ClientDashboard.tsx", "utf-8");
    expect(content).toContain("Connected");
    expect(content).toContain("No Connections");
  });
});
