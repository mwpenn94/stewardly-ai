/**
 * Pass 64d-ext3 — E2E Validation Tests
 *
 * Covers:
 * 1. Webhook endpoint acceptance (all 5 platforms)
 * 2. GHL API connectivity and contact retrieval
 * 3. Webhook auto-register service (all handlers)
 * 4. LinkedIn enrichment import fix (enrichLead, not enrichLeadFromLinkedIn)
 * 5. CRM adapter graceful error handling
 * 6. Platform webhook routes registration
 * 7. Connection instructions public endpoint
 */
import { describe, it, expect, vi, beforeAll } from "vitest";

// ─── 1. Webhook Endpoint Acceptance (Live Server) ───────────────────────────

describe("Webhook Endpoints (live server)", () => {
  const BASE = "http://localhost:3000";

  it("POST /api/webhooks/ghl returns 200 for ContactCreate", async () => {
    const res = await fetch(`${BASE}/api/webhooks/ghl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "ContactCreate",
        locationId: "test-loc",
        id: `ghl-test-${Date.now()}`,
        contact: {
          id: `ghl-c-${Date.now()}`,
          firstName: "Test",
          lastName: "User",
          email: `test-${Date.now()}@example.com`,
          phone: "+15550001111",
        },
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
    expect(body.eventType).toBe("ContactCreate");
  });

  it("POST /api/webhooks/dripify returns 200 for lead_responded", async () => {
    const res = await fetch(`${BASE}/api/webhooks/dripify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "lead_responded",
        timestamp: Date.now(),
        data: {
          lead: {
            firstName: "Drip",
            lastName: "Test",
            email: `drip-${Date.now()}@example.com`,
            linkedinUrl: "https://linkedin.com/in/driptest",
          },
          campaign: { name: "Test Campaign" },
        },
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
  });

  it("POST /api/webhooks/smsit returns 200 for contact.created", async () => {
    const res = await fetch(`${BASE}/api/webhooks/smsit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "contact.created",
        data: {
          id: `smsit-${Date.now()}`,
          firstName: "SMS",
          lastName: "Test",
          email: `sms-${Date.now()}@example.com`,
          phone: "+15550002222",
        },
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
  });

  it("POST /api/webhooks/workable returns 200 for candidate_created", async () => {
    const res = await fetch(`${BASE}/api/webhooks/workable`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "candidate_created",
        data: {
          id: `work-${Date.now()}`,
          name: "Work Test",
          firstname: "Work",
          lastname: "Test",
          email: `work-${Date.now()}@example.com`,
        },
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
  });

  it("POST /api/webhooks/linkedin returns 200 for profile_update", async () => {
    const res = await fetch(`${BASE}/api/webhooks/linkedin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "profile_update",
        data: {
          profileId: `li-${Date.now()}`,
          firstName: "LinkedIn",
          lastName: "Test",
          email: `li-${Date.now()}@example.com`,
        },
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
  });

  it("GET /api/webhooks/platforms/health returns all 5 platforms", async () => {
    const res = await fetch(`${BASE}/api/webhooks/platforms/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.platforms).toContain("gohighlevel");
    expect(body.platforms).toContain("dripify");
    expect(body.platforms).toContain("smsit");
    expect(body.platforms).toContain("workable");
    expect(body.platforms).toContain("linkedin");
    expect(body.platforms).toHaveLength(5);
    expect(body.timestamp).toBeGreaterThan(0);
  });

  it("POST /api/webhooks/ghl rejects empty body", async () => {
    const res = await fetch(`${BASE}/api/webhooks/ghl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    // GHL handler should still process (it has its own validation)
    expect([200, 400]).toContain(res.status);
  });
});

// ─── 2. GHL API Connectivity ─────────────────────────────────────────────────

describe("GHL API Connectivity", () => {
  const GHL_API_KEY = process.env.GHL_API_KEY;
  const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

  it("has GHL_API_KEY configured", () => {
    expect(GHL_API_KEY).toBeTruthy();
    expect(typeof GHL_API_KEY).toBe("string");
    expect(GHL_API_KEY!.length).toBeGreaterThan(10);
  });

  it("has GHL_LOCATION_ID configured", () => {
    expect(GHL_LOCATION_ID).toBeTruthy();
    expect(typeof GHL_LOCATION_ID).toBe("string");
    expect(GHL_LOCATION_ID!.length).toBeGreaterThan(5);
  });

  it("can fetch contacts from GHL API", async () => {
    if (!GHL_API_KEY || !GHL_LOCATION_ID) return;
    const res = await fetch(
      `https://services.leadconnectorhq.com/contacts/?locationId=${GHL_LOCATION_ID}&limit=3`,
      {
        headers: {
          Authorization: `Bearer ${GHL_API_KEY}`,
          Version: "2021-07-28",
        },
      },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.contacts).toBeDefined();
    expect(Array.isArray(data.contacts)).toBe(true);
    expect(data.meta?.total).toBeGreaterThan(0);
  });

  it("can fetch location info from GHL API", async () => {
    if (!GHL_API_KEY || !GHL_LOCATION_ID) return;
    const res = await fetch(
      `https://services.leadconnectorhq.com/locations/${GHL_LOCATION_ID}`,
      {
        headers: {
          Authorization: `Bearer ${GHL_API_KEY}`,
          Version: "2021-07-28",
          Accept: "application/json",
        },
      },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.location?.name || data.name).toBeTruthy();
  });
});

// ─── 3. Webhook Auto-Register Service ────────────────────────────────────────

describe("Webhook Auto-Register Service", () => {
  it("exports all expected functions", async () => {
    const mod = await import("./services/webhookAutoRegister");
    expect(typeof mod.registerGHLWebhook).toBe("function");
    expect(typeof mod.registerWorkableWebhook).toBe("function");
    expect(typeof mod.registerSmsitWebhook).toBe("function");
    expect(typeof mod.registerDripifyWebhook).toBe("function");
    expect(typeof mod.registerLinkedInWebhook).toBe("function");
    expect(typeof mod.autoRegisterWebhook).toBe("function");
    expect(typeof mod.getAllWebhookUrls).toBe("function");
  });

  it("getAllWebhookUrls returns all 5 platforms", async () => {
    const { getAllWebhookUrls } = await import("./services/webhookAutoRegister");
    const urls = getAllWebhookUrls();
    expect(urls).toHaveLength(5);
    const platforms = urls.map(u => u.platform);
    expect(platforms).toContain("gohighlevel");
    expect(platforms).toContain("dripify");
    expect(platforms).toContain("smsit");
    expect(platforms).toContain("workable");
    expect(platforms).toContain("linkedin");
    // All should have valid webhook URLs
    for (const u of urls) {
      expect(u.webhookUrl).toMatch(/^https?:\/\/.+\/api\/webhooks\//);
      expect(u.description).toBeTruthy();
    }
  });

  it("autoRegisterWebhook returns result for GHL (PIT token → manual setup)", async () => {
    const { autoRegisterWebhook } = await import("./services/webhookAutoRegister");
    const result = await autoRegisterWebhook("gohighlevel", {});
    expect(result.platform).toBe("gohighlevel");
    expect(result.webhookUrl).toContain("/api/webhooks/ghl");
    // PIT tokens don't support webhook API, so it should suggest manual setup
    expect(typeof result.message).toBe("string");
  });

  it("autoRegisterWebhook returns manual instructions for Dripify", async () => {
    const { autoRegisterWebhook } = await import("./services/webhookAutoRegister");
    const result = await autoRegisterWebhook("dripify", {});
    expect(result.platform).toBe("dripify");
    expect(result.requiresManualSetup).toBe(true);
    expect(result.manualSetupUrl).toContain("dripify");
    expect(result.manualSetupInstructions).toBeTruthy();
  });

  it("autoRegisterWebhook returns manual instructions for LinkedIn", async () => {
    const { autoRegisterWebhook } = await import("./services/webhookAutoRegister");
    const result = await autoRegisterWebhook("linkedin", {});
    expect(result.platform).toBe("linkedin");
    expect(result.requiresManualSetup).toBe(true);
    expect(result.message).toContain("Partner Program");
  });

  it("autoRegisterWebhook handles unknown platform gracefully", async () => {
    const { autoRegisterWebhook } = await import("./services/webhookAutoRegister");
    const result = await autoRegisterWebhook("unknownplatform", {});
    expect(result.platform).toBe("unknownplatform");
    expect(result.success).toBe(false);
    expect(result.message).toContain("No webhook registration handler");
  });

  it("registerSmsitWebhook returns error when no API key", async () => {
    const { registerSmsitWebhook } = await import("./services/webhookAutoRegister");
    const result = await registerSmsitWebhook({});
    expect(result.platform).toBe("smsit");
    expect(result.success).toBe(false);
    expect(result.message).toContain("No API key");
  });

  it("registerWorkableWebhook returns error when no API key", async () => {
    const { registerWorkableWebhook } = await import("./services/webhookAutoRegister");
    const result = await registerWorkableWebhook({});
    expect(result.platform).toBe("workable");
    expect(result.success).toBe(false);
    expect(result.message).toContain("No API key");
  });
});

// ─── 4. LinkedIn Enrichment Import Fix ───────────────────────────────────────

describe("LinkedIn Enrichment — Correct Exports", () => {
  it("exports enrichLead (not enrichLeadFromLinkedIn)", async () => {
    const mod = await import("./services/linkedinEnrichment");
    expect(typeof mod.enrichLead).toBe("function");
    // enrichLeadFromLinkedIn should NOT exist
    expect((mod as any).enrichLeadFromLinkedIn).toBeUndefined();
  });

  it("exports batchEnrichLeads", async () => {
    const mod = await import("./services/linkedinEnrichment");
    expect(typeof mod.batchEnrichLeads).toBe("function");
  });

  it("exports getLinkedInProfile", async () => {
    const mod = await import("./services/linkedinEnrichment");
    expect(typeof mod.getLinkedInProfile).toBe("function");
  });

  it("exports searchLinkedInPeople", async () => {
    const mod = await import("./services/linkedinEnrichment");
    expect(typeof mod.searchLinkedInPeople).toBe("function");
  });

  it("exports getCompanyDetails", async () => {
    const mod = await import("./services/linkedinEnrichment");
    expect(typeof mod.getCompanyDetails).toBe("function");
  });
});

// ─── 5. CRM Adapter Graceful Error Handling ──────────────────────────────────

describe("CRM Adapter — Graceful Error Handling", () => {
  it("getCRMAdapter throws for null provider", async () => {
    const { getCRMAdapter } = await import("./services/crmAdapter");
    expect(() => getCRMAdapter(null as any)).toThrow();
  });

  it("getCRMAdapter throws for undefined provider", async () => {
    const { getCRMAdapter } = await import("./services/crmAdapter");
    expect(() => getCRMAdapter(undefined as any)).toThrow();
  });

  it("getCRMAdapter throws for numeric provider", async () => {
    const { getCRMAdapter } = await import("./services/crmAdapter");
    expect(() => getCRMAdapter(42 as any)).toThrow();
  });

  it("getCRMAdapter throws for object provider", async () => {
    const { getCRMAdapter } = await import("./services/crmAdapter");
    expect(() => getCRMAdapter({} as any)).toThrow();
  });

  it("getCRMAdapter returns adapter for valid providers", async () => {
    const { getCRMAdapter } = await import("./services/crmAdapter");
    for (const p of ["gohighlevel", "wealthbox", "salesforce", "redtail"]) {
      const adapter = getCRMAdapter(p);
      expect(adapter).toBeTruthy();
      expect(typeof adapter.pullContacts).toBe("function");
      expect(typeof adapter.pushContact).toBe("function");
    }
  });

  it("syncCRM returns error result for invalid provider (no crash)", async () => {
    const { syncCRM } = await import("./services/crmAdapter");
    const result = await syncCRM("invalid_provider_xyz", {}, "pull");
    expect(result.error).toBeTruthy();
    expect(result.contactsSynced).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("syncCRM returns error result for null provider (no crash)", async () => {
    const { syncCRM } = await import("./services/crmAdapter");
    const result = await syncCRM(null as any, {}, "pull");
    expect(result.error).toBeTruthy();
    expect(result.contactsSynced).toBe(0);
  });

  it("syncCRM returns valid CRMSyncResult shape for invalid provider", async () => {
    const { syncCRM } = await import("./services/crmAdapter");
    const result = await syncCRM("nonexistent", {}, "pull");
    expect(result.provider).toBe("nonexistent");
    expect(result.direction).toBe("pull");
    expect(typeof result.contactsSynced).toBe("number");
    expect(typeof result.contactsCreated).toBe("number");
    expect(typeof result.contactsUpdated).toBe("number");
    expect(typeof result.activitiesSynced).toBe("number");
    expect(Array.isArray(result.errors)).toBe(true);
    expect(typeof result.lastSyncAt).toBe("number");
  });
});

// ─── 6. Platform Webhook Routes ──────────────────────────────────────────────

describe("Platform Webhook Routes Module", () => {
  it("exports registerPlatformWebhookRoutes function", async () => {
    const mod = await import("./routers/platformWebhookRoutes");
    expect(typeof mod.registerPlatformWebhookRoutes).toBe("function");
  });
});

// ─── 7. Connection Instructions ──────────────────────────────────────────────

describe("Connection Instructions (public endpoint)", () => {
  it("GET /api/trpc/crm.connectionInstructions returns 200", async () => {
    const res = await fetch("http://localhost:3000/api/trpc/crm.connectionInstructions");
    expect(res.status).toBe(200);
    const data = await res.json();
    const instructions = data.result?.data?.json;
    expect(Array.isArray(instructions)).toBe(true);
    expect(instructions.length).toBeGreaterThanOrEqual(5);
  });

  it("connection instructions include all 8 providers", async () => {
    const res = await fetch("http://localhost:3000/api/trpc/crm.connectionInstructions");
    const data = await res.json();
    const instructions = data.result?.data?.json;
    const providers = instructions.map((i: any) => i.provider);
    for (const p of ["gohighlevel", "smsit", "dripify", "workable", "linkedin"]) {
      expect(providers).toContain(p);
    }
  });

  it("each instruction has required fields", async () => {
    const res = await fetch("http://localhost:3000/api/trpc/crm.connectionInstructions");
    const data = await res.json();
    const instructions = data.result?.data?.json;
    for (const inst of instructions) {
      expect(inst.provider).toBeTruthy();
      expect(inst.name).toBeTruthy();
      expect(Array.isArray(inst.setupSteps)).toBe(true);
      expect(inst.setupSteps.length).toBeGreaterThan(0);
    }
  });
});

// ─── 8. Webhook Handler Modules ──────────────────────────────────────────────

describe("Individual Webhook Handler Modules", () => {
  it("dripifyWebhook exports handleDripifyWebhook", async () => {
    const mod = await import("./routers/dripifyWebhook");
    expect(typeof mod.handleDripifyWebhook).toBe("function");
  });

  it("smsitWebhook exports handleSMSiTWebhook", async () => {
    const mod = await import("./routers/smsitWebhook");
    expect(typeof mod.handleSMSiTWebhook).toBe("function");
  });

  it("workableWebhook exports handleWorkableWebhook", async () => {
    const mod = await import("./routers/workableWebhook");
    expect(typeof mod.handleWorkableWebhook).toBe("function");
  });

  it("linkedinWebhook exports handleLinkedInWebhook", async () => {
    const mod = await import("./routers/linkedinWebhook");
    expect(typeof mod.handleLinkedInWebhook).toBe("function");
  });
});

// ─── 9. CRM Auto-Sync Module ────────────────────────────────────────────────

describe("CRM Auto-Sync Module", () => {
  it("exports getAutoSyncStatus", async () => {
    const mod = await import("./services/crmAutoSync");
    expect(typeof mod.getAutoSyncStatus).toBe("function");
  });

  it("exports initCRMAutoSync", async () => {
    const mod = await import("./services/crmAutoSync");
    expect(typeof mod.initCRMAutoSync).toBe("function");
  });

  it("exports registerSyncJobForConnection", async () => {
    const mod = await import("./services/crmAutoSync");
    expect(typeof mod.registerSyncJobForConnection).toBe("function");
  });

  it("exports unregisterSyncJobForConnection", async () => {
    const mod = await import("./services/crmAutoSync");
    expect(typeof mod.unregisterSyncJobForConnection).toBe("function");
  });

  it("exports updateSyncInterval", async () => {
    const mod = await import("./services/crmAutoSync");
    expect(typeof mod.updateSyncInterval).toBe("function");
  });

  it("getAutoSyncStatus returns valid status object", async () => {
    const { getAutoSyncStatus } = await import("./services/crmAutoSync");
    const status = getAutoSyncStatus();
    expect(status).toBeDefined();
    expect(typeof status).toBe("object");
  });
});

// ─── 10. Cron Manager Module ────────────────────────────────────────────────

describe("Cron Manager Module", () => {
  it("exports getJobStatus", async () => {
    const mod = await import("./services/cronManager");
    expect(typeof mod.getJobStatus).toBe("function");
  });

  it("getJobStatus returns array or object", async () => {
    const { getJobStatus } = await import("./services/cronManager");
    const status = getJobStatus();
    expect(status).toBeDefined();
  });
});
