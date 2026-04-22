import { describe, it, expect } from "vitest";

// ─── LinkedIn Enrichment Service Tests ────────────────────────────────
describe("LinkedIn Enrichment Service", () => {
  it("exports enrichLead function", async () => {
    const mod = await import("./services/linkedinEnrichment");
    expect(typeof mod.enrichLead).toBe("function");
  });

  it("exports batchEnrichLeads function", async () => {
    const mod = await import("./services/linkedinEnrichment");
    expect(typeof mod.batchEnrichLeads).toBe("function");
  });

  it("exports searchLinkedInPeople function", async () => {
    const mod = await import("./services/linkedinEnrichment");
    expect(typeof mod.searchLinkedInPeople).toBe("function");
  });

  it("searchLinkedInPeople returns results object for valid query", async () => {
    const { searchLinkedInPeople } = await import("./services/linkedinEnrichment");
    const data = await searchLinkedInPeople({ keywords: "software engineer" });
    // Returns { results: LinkedInSearchResult[], total: number }
    expect(data).toHaveProperty("results");
    expect(data).toHaveProperty("total");
    expect(Array.isArray(data.results)).toBe(true);
    expect(typeof data.total).toBe("number");
  }, 15000);
});

// ─── CRM Auto-Sync Scheduler Tests ───────────────────────────────────
describe("CRM Auto-Sync Scheduler", () => {
  it("exports initCRMAutoSync function", async () => {
    const mod = await import("./services/crmAutoSync");
    expect(typeof mod.initCRMAutoSync).toBe("function");
  });

  it("exports registerSyncJobForConnection function", async () => {
    const mod = await import("./services/crmAutoSync");
    expect(typeof mod.registerSyncJobForConnection).toBe("function");
  });

  it("exports unregisterSyncJobForConnection function", async () => {
    const mod = await import("./services/crmAutoSync");
    expect(typeof mod.unregisterSyncJobForConnection).toBe("function");
  });

  it("exports getAutoSyncStatus function", async () => {
    const mod = await import("./services/crmAutoSync");
    expect(typeof mod.getAutoSyncStatus).toBe("function");
  });

  it("getAutoSyncStatus returns valid structure", async () => {
    const { getAutoSyncStatus } = await import("./services/crmAutoSync");
    const status = getAutoSyncStatus();
    expect(status).toHaveProperty("registeredJobs");
    expect(status).toHaveProperty("activeJobs");
    expect(Array.isArray(status.activeJobs)).toBe(true);
    expect(typeof status.registeredJobs).toBe("number");
  });

  it("unregisterSyncJobForConnection returns false for non-existent connection", async () => {
    const { unregisterSyncJobForConnection } = await import("./services/crmAutoSync");
    const result = unregisterSyncJobForConnection("non-existent-connection-id");
    expect(result).toBe(false);
  });
});

// ─── Cron Manager Integration Tests ──────────────────────────────────
describe("Cron Manager", () => {
  it("exports registerJob, unregisterJob, getJobStatus, toggleJob", async () => {
    const mod = await import("./services/cronManager");
    expect(typeof mod.registerJob).toBe("function");
    expect(typeof mod.unregisterJob).toBe("function");
    expect(typeof mod.getJobStatus).toBe("function");
    expect(typeof mod.toggleJob).toBe("function");
  });

  it("registerJob creates a job and getJobStatus includes it", async () => {
    const { registerJob, getJobStatus, unregisterJob } = await import("./services/cronManager");
    const jobId = registerJob({
      id: "test-crm-sync-job",
      name: "Test CRM Sync",
      intervalMs: 300000,
      handler: async () => ({ success: true, recordsProcessed: 0, errors: [], duration: 0 }),
      enabled: true,
      tier: "client",
    });
    expect(typeof jobId).toBe("string");
    
    const jobs = getJobStatus();
    const testJob = jobs.find(j => j.id === "test-crm-sync-job");
    expect(testJob).toBeDefined();
    expect(testJob!.name).toBe("Test CRM Sync");
    expect(testJob!.enabled).toBe(true);
    expect(testJob!.intervalMinutes).toBe(5);
    
    // Cleanup
    unregisterJob("test-crm-sync-job");
  });

  it("toggleJob enables/disables a job", async () => {
    const { registerJob, toggleJob, getJobStatus, unregisterJob } = await import("./services/cronManager");
    registerJob({
      id: "test-toggle-job",
      name: "Test Toggle",
      intervalMs: 600000,
      handler: async () => ({ success: true, recordsProcessed: 0, errors: [], duration: 0 }),
      enabled: true,
      tier: "client",
    });
    
    const toggled = toggleJob("test-toggle-job", false);
    expect(toggled).toBe(true);
    
    const jobs = getJobStatus();
    const job = jobs.find(j => j.id === "test-toggle-job");
    expect(job!.enabled).toBe(false);
    
    // Cleanup
    unregisterJob("test-toggle-job");
  });
});

// ─── Webhook Auto-Registration Tests ─────────────────────────────────
describe("Webhook Auto-Registration", () => {
  it("exports autoRegisterWebhook function", async () => {
    const mod = await import("./services/webhookAutoRegister");
    expect(typeof mod.autoRegisterWebhook).toBe("function");
  });

  it("exports getAllWebhookUrls function", async () => {
    const mod = await import("./services/webhookAutoRegister");
    expect(typeof mod.getAllWebhookUrls).toBe("function");
  });

  it("getAllWebhookUrls returns URLs for all platforms", async () => {
    const { getAllWebhookUrls } = await import("./services/webhookAutoRegister");
    const urls = getAllWebhookUrls();
    // Returns array of { platform, webhookUrl, description }
    expect(Array.isArray(urls)).toBe(true);
    expect(urls.length).toBeGreaterThanOrEqual(5);
    const platforms = urls.map((u: any) => u.platform);
    expect(platforms).toContain("gohighlevel");
    expect(platforms).toContain("dripify");
    expect(platforms).toContain("smsit");
    expect(platforms).toContain("workable");
    expect(platforms).toContain("linkedin");
  });
});

// ─── CRM Adapter Outbound Sync Tests ─────────────────────────────────
describe("CRM Adapter Outbound Sync", () => {
  it("exports syncCRM function", async () => {
    const mod = await import("./services/crmAdapter");
    expect(typeof mod.syncCRM).toBe("function");
  });

  it("syncCRM accepts direction parameter", async () => {
    const { syncCRM } = await import("./services/crmAdapter");
    // Test with unknown provider string - should fail gracefully
    // syncCRM uses positional args: (provider, credentials, direction, lastSyncAt?)
    const result = await syncCRM("unknown_provider_xyz", {}, "push");
    expect(result).toHaveProperty("error");
    expect(result.contactsSynced).toBe(0);
  });

  it("syncCRM handles bidirectional direction", async () => {
    const { syncCRM } = await import("./services/crmAdapter");
    const result = await syncCRM("unknown_provider_xyz", {}, "bidirectional");
    expect(result).toHaveProperty("error");
  });
});

// ─── Platform Webhook Routes Tests ───────────────────────────────────
describe("Platform Webhook Routes", () => {
  it("health endpoint returns all 5 platforms", async () => {
    const res = await fetch("http://localhost:3000/api/webhooks/platforms/health");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("status", "ok");
    expect(data.platforms).toContain("dripify");
    expect(data.platforms).toContain("smsit");
    expect(data.platforms).toContain("workable");
    expect(data.platforms).toContain("linkedin");
  });

  it("Dripify webhook accepts POST", async () => {
    const res = await fetch("http://localhost:3000/api/webhooks/dripify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "connection_accepted", data: { firstName: "Test", email: "test@dripify.com" } }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.received).toBe(true);
  });

  it("SMS-iT webhook accepts POST", async () => {
    const res = await fetch("http://localhost:3000/api/webhooks/smsit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "contact.created", data: { firstName: "Test", phone: "+1234567890" } }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.received).toBe(true);
  });

  it("Workable webhook accepts POST", async () => {
    const res = await fetch("http://localhost:3000/api/webhooks/workable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: "candidate_created", data: { candidate: { firstname: "Work", lastname: "Able", email: "test@work.com" } } }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.received).toBe(true);
  });

  it("LinkedIn webhook accepts POST", async () => {
    const res = await fetch("http://localhost:3000/api/webhooks/linkedin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "profile_view", data: { firstName: "Link", lastName: "In" } }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.received).toBe(true);
  });
});

// ─── CRM Sync tRPC Procedures (structural) ──────────────────────────
describe("CRM Sync tRPC Procedures", () => {
  it("crm.autoSyncStatus requires auth", async () => {
    const res = await fetch("http://localhost:3000/api/trpc/crm.autoSyncStatus", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(401);
  });

  it("crm.connectionInstructions is accessible (public procedure)", async () => {
    const res = await fetch("http://localhost:3000/api/trpc/crm.connectionInstructions", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    // This is a public procedure so it returns 200
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.result?.data?.json).toBeDefined();
  });

  it("crm.triggerOutboundSync requires auth", async () => {
    const res = await fetch("http://localhost:3000/api/trpc/crm.triggerOutboundSync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "gohighlevel" }),
    });
    expect(res.status).toBe(401);
  });

  it("crm.linkedinEnrich requires auth", async () => {
    const res = await fetch("http://localhost:3000/api/trpc/crm.linkedinEnrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: "test" }),
    });
    expect(res.status).toBe(401);
  });
});
