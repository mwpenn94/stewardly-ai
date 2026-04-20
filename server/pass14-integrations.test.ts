/**
 * Pass 14 — Integration Wiring Regression Tests
 * Validates that GoHighLevel, Dripify, LinkedIn, Workable, and Salesforce
 * are properly wired in the CRM adapter factory, seed data, and routers.
 */
import { describe, expect, it } from "vitest";

// ─── CRM Adapter Factory ────────────────────────────────────────────────
describe("CRM Adapter Factory", () => {
  it("exports getCRMAdapter function", async () => {
    const mod = await import("./services/crmAdapter");
    expect(typeof mod.getCRMAdapter).toBe("function");
  });

  it("returns adapter for wealthbox", async () => {
    const { getCRMAdapter } = await import("./services/crmAdapter");
    const adapter = getCRMAdapter("wealthbox");
    expect(adapter).toBeDefined();
    expect(typeof adapter.pullContacts).toBe("function");
  });

  it("returns adapter for redtail", async () => {
    const { getCRMAdapter } = await import("./services/crmAdapter");
    const adapter = getCRMAdapter("redtail");
    expect(adapter).toBeDefined();
    expect(typeof adapter.pullContacts).toBe("function");
  });

  it("returns adapter for salesforce", async () => {
    const { getCRMAdapter } = await import("./services/crmAdapter");
    const adapter = getCRMAdapter("salesforce");
    expect(adapter).toBeDefined();
    expect(typeof adapter.pullContacts).toBe("function");
  });

  it("returns adapter for gohighlevel", async () => {
    const { getCRMAdapter } = await import("./services/crmAdapter");
    const adapter = getCRMAdapter("gohighlevel");
    expect(adapter).toBeDefined();
    expect(typeof adapter.pullContacts).toBe("function");
  });

  it("throws for unsupported provider", async () => {
    const { getCRMAdapter } = await import("./services/crmAdapter");
    expect(() => getCRMAdapter("unknown_crm")).toThrow("Unsupported CRM provider");
  });
});

// ─── Seed Integration Providers ──────────────────────────────────────────
describe("Seed Integration Providers", () => {
  it("exports PROVIDERS array", async () => {
    const mod = await import("./services/seedIntegrations");
    expect(Array.isArray(mod.PROVIDERS)).toBe(true);
    expect(mod.PROVIDERS.length).toBeGreaterThan(10);
  });

  it("includes GoHighLevel provider", async () => {
    const { PROVIDERS } = await import("./services/seedIntegrations");
    const ghl = PROVIDERS.find((p: any) => p.slug === "gohighlevel");
    expect(ghl).toBeDefined();
    expect(ghl!.name).toBe("GoHighLevel");
    expect(ghl!.category).toBe("crm");
  });

  it("includes Salesforce provider", async () => {
    const { PROVIDERS } = await import("./services/seedIntegrations");
    const sf = PROVIDERS.find((p: any) => p.slug === "salesforce");
    expect(sf).toBeDefined();
    expect(sf!.category).toBe("crm");
  });

  it("includes Dripify provider", async () => {
    const { PROVIDERS } = await import("./services/seedIntegrations");
    const drip = PROVIDERS.find((p: any) => p.slug === "dripify");
    expect(drip).toBeDefined();
    expect(drip!.category).toBe("marketing");
  });

  it("includes LinkedIn / Sales Navigator provider", async () => {
    const { PROVIDERS } = await import("./services/seedIntegrations");
    const li = PROVIDERS.find((p: any) => p.slug === "linkedin");
    expect(li).toBeDefined();
    expect(li!.category).toBe("marketing");
  });

  it("includes Workable provider", async () => {
    const { PROVIDERS } = await import("./services/seedIntegrations");
    const wb = PROVIDERS.find((p: any) => p.slug === "workable");
    expect(wb).toBeDefined();
    expect(wb!.category).toBe("recruiting");
  });

  it("includes Wealthbox CRM provider", async () => {
    const { PROVIDERS } = await import("./services/seedIntegrations");
    const wb = PROVIDERS.find((p: any) => p.slug === "wealthbox");
    expect(wb).toBeDefined();
    expect(wb!.category).toBe("crm");
  });

  it("includes Redtail CRM provider", async () => {
    const { PROVIDERS } = await import("./services/seedIntegrations");
    const rt = PROVIDERS.find((p: any) => p.slug === "redtail");
    expect(rt).toBeDefined();
    expect(rt!.category).toBe("crm");
  });

  it("all providers have required fields", async () => {
    const { PROVIDERS } = await import("./services/seedIntegrations");
    for (const p of PROVIDERS) {
      expect(p.id).toBeTruthy();
      expect(p.slug).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.category).toBeTruthy();
    }
  });
});

// ─── Router Wiring ──────────────────────────────────────────────────────
describe("Router Wiring", () => {
  it("appRouter has crm namespace", async () => {
    const { appRouter } = await import("./routers");
    expect(appRouter._def.procedures).toBeDefined();
    const procKeys = Object.keys(appRouter._def.procedures);
    expect(procKeys.some(k => k.startsWith("crm."))).toBe(true);
  }, 15000);

  it("appRouter has leadPipeline namespace", async () => {
    const { appRouter } = await import("./routers");
    const procKeys = Object.keys(appRouter._def.procedures);
    expect(procKeys.some(k => k.startsWith("leadPipeline."))).toBe(true);
  }, 15000);

  it("appRouter has ghlWebhook namespace", async () => {
    const { appRouter } = await import("./routers");
    const procKeys = Object.keys(appRouter._def.procedures);
    expect(procKeys.some(k => k.startsWith("ghlWebhook."))).toBe(true);
  }, 15000);

  it("appRouter has dripifyWebhook namespace", async () => {
    const { appRouter } = await import("./routers");
    const procKeys = Object.keys(appRouter._def.procedures);
    expect(procKeys.some(k => k.startsWith("dripifyWebhook."))).toBe(true);
  }, 15000);

  it("appRouter has emailCampaign namespace", async () => {
    const { appRouter } = await import("./routers");
    const procKeys = Object.keys(appRouter._def.procedures);
    expect(procKeys.some(k => k.startsWith("emailCampaign."))).toBe(true);
  }, 15000);

  it("appRouter has clientSegmentation namespace", async () => {
    const { appRouter } = await import("./routers");
    const procKeys = Object.keys(appRouter._def.procedures);
    expect(procKeys.some(k => k.startsWith("clientSegmentation."))).toBe(true);
  }, 15000);

  it("appRouter has integrations namespace", async () => {
    const { appRouter } = await import("./routers");
    const procKeys = Object.keys(appRouter._def.procedures);
    expect(procKeys.some(k => k.startsWith("integrations."))).toBe(true);
  }, 15000);
});

// ─── CRM Sync Orchestrator ──────────────────────────────────────────────
describe("CRM Sync Orchestrator", () => {
  it("exports syncCRM function", async () => {
    const mod = await import("./services/crmAdapter");
    expect(typeof mod.syncCRM).toBe("function");
  });
});

// ─── GHL Webhook Router ─────────────────────────────────────────────────
describe("GHL Webhook Router", () => {
  it("exports ghlWebhookRouter", async () => {
    const mod = await import("./routers/ghlWebhook");
    expect(mod.ghlWebhookRouter).toBeDefined();
  });
});

// ─── Dripify Webhook Router ─────────────────────────────────────────────
describe("Dripify Webhook Router", () => {
  it("exports dripifyWebhookRouter", async () => {
    const mod = await import("./routers/dripifyWebhook");
    expect(mod.dripifyWebhookRouter).toBeDefined();
  });
});
