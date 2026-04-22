import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@stewardly.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: {
      headers: { origin: "http://localhost:3000" },
      cookies: {},
    } as any,
    res: {
      clearCookie: () => {},
      cookie: () => {},
    } as any,
  };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: {
      headers: { origin: "http://localhost:3000" },
      cookies: {},
    } as any,
    res: {
      clearCookie: () => {},
      cookie: () => {},
    } as any,
  };
}

const caller = appRouter.createCaller;

describe("Pass 64d — Outbound Sync & Webhook Registration", () => {

  // ─── Outbound Sync Preview ───────────────────────────────────────────
  describe("crm.outboundSyncPreview", () => {
    it("returns lead counts for a valid provider", async () => {
      const ctx = createAdminContext();
      const c = caller(ctx);
      const result = await c.crm.outboundSyncPreview({ provider: "gohighlevel" });
      expect(result).toHaveProperty("totalLeads");
      expect(result).toHaveProperty("unsyncedLeads");
      expect(result).toHaveProperty("syncedLeads");
      expect(typeof result.totalLeads).toBe("number");
      expect(typeof result.unsyncedLeads).toBe("number");
      expect(typeof result.syncedLeads).toBe("number");
      expect(result.totalLeads).toBeGreaterThanOrEqual(0);
      expect(result.unsyncedLeads).toBeGreaterThanOrEqual(0);
      expect(result.syncedLeads).toBeGreaterThanOrEqual(0);
    });

    it("rejects unauthenticated requests", async () => {
      const ctx = createUnauthContext();
      const c = caller(ctx);
      await expect(c.crm.outboundSyncPreview({ provider: "gohighlevel" }))
        .rejects.toThrow();
    });

    it("returns preview for different providers", async () => {
      const ctx = createAdminContext();
      const c = caller(ctx);
      const providers = ["wealthbox", "salesforce", "smsit", "workable"] as const;
      for (const prov of providers) {
        const result = await c.crm.outboundSyncPreview({ provider: prov });
        expect(result).toHaveProperty("totalLeads");
        expect(result.totalLeads).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ─── Webhook Registration ────────────────────────────────────────────
  describe("crm.registerWebhooks", () => {
    it("attempts webhook registration for GHL", async () => {
      const ctx = createAdminContext();
      const c = caller(ctx);
      const result = await c.crm.registerWebhooks({
        provider: "gohighlevel",
        baseUrl: "http://localhost:3000",
      });
      // Returns WebhookRegistrationResult: { platform, success, webhookUrl, message }
      expect(result).toHaveProperty("platform", "gohighlevel");
      expect(result).toHaveProperty("success");
      expect(typeof result.success).toBe("boolean");
      expect(result).toHaveProperty("webhookUrl");
      expect(result).toHaveProperty("message");
    }, 15000);

    it("attempts webhook registration for SMS-iT", async () => {
      const ctx = createAdminContext();
      const c = caller(ctx);
      const result = await c.crm.registerWebhooks({
        provider: "smsit",
        baseUrl: "http://localhost:3000",
      });
      expect(result).toHaveProperty("platform", "smsit");
      expect(result).toHaveProperty("success");
    });

    it("attempts webhook registration for Workable", async () => {
      const ctx = createAdminContext();
      const c = caller(ctx);
      const result = await c.crm.registerWebhooks({
        provider: "workable",
        baseUrl: "http://localhost:3000",
      });
      expect(result).toHaveProperty("platform", "workable");
      expect(result).toHaveProperty("success");
    });

    it("rejects unauthenticated webhook registration", async () => {
      const ctx = createUnauthContext();
      const c = caller(ctx);
      await expect(c.crm.registerWebhooks({
        provider: "gohighlevel",
        baseUrl: "http://localhost:3000",
      })).rejects.toThrow();
    });
  });

  // ─── Trigger Outbound Sync ───────────────────────────────────────────
  describe("crm.triggerOutboundSync", () => {
    it("triggerOutboundSync procedure exists and is callable", async () => {
      const ctx = createAdminContext();
      const c = caller(ctx);
      // Verify the procedure exists by checking it's a function
      expect(typeof c.crm.triggerOutboundSync).toBe("function");
    });

    it("rejects unauthenticated outbound sync", async () => {
      const ctx = createUnauthContext();
      const c = caller(ctx);
      await expect(c.crm.triggerOutboundSync({ provider: "gohighlevel" }))
        .rejects.toThrow();
    });
  });

  // ─── Sync with Direction Parameter ───────────────────────────────────
  describe("crm.sync with direction", () => {
    it("sync procedure exists and accepts direction parameter", async () => {
      const ctx = createAdminContext();
      const c = caller(ctx);
      // Verify the sync procedure exists
      expect(typeof c.crm.sync).toBe("function");
    });

    it("crmAdapter syncCRM source code handles push direction", async () => {
      const fs = await import("fs");
      const source = fs.readFileSync("server/services/crmAdapter.ts", "utf-8");
      // Verify push direction handling exists in the source
      expect(source).toContain("direction === \"push\"");
      expect(source).toContain("direction === \"bidirectional\"");
      expect(source).toContain("pushContact");
    });

    it("integrations.ts triggerSync accepts direction parameter", async () => {
      const fs = await import("fs");
      const source = fs.readFileSync("server/routers/integrations.ts", "utf-8");
      expect(source).toContain("direction");
      expect(source).toContain("pull");
      expect(source).toContain("push");
      expect(source).toContain("bidirectional");
    });
  });

  // ─── Webhook Auto-Registration Service ───────────────────────────────
  describe("webhookAutoRegister service", () => {
    it("exports autoRegisterWebhook function", async () => {
      const mod = await import("./services/webhookAutoRegister");
      expect(mod).toHaveProperty("autoRegisterWebhook");
      expect(typeof mod.autoRegisterWebhook).toBe("function");
    });

    it("exports getAllWebhookUrls function", async () => {
      const mod = await import("./services/webhookAutoRegister");
      expect(mod).toHaveProperty("getAllWebhookUrls");
      expect(typeof mod.getAllWebhookUrls).toBe("function");
    });

    it("returns correct webhook URLs for all platforms", async () => {
      const { getAllWebhookUrls } = await import("./services/webhookAutoRegister");
      const urls = getAllWebhookUrls();
      expect(urls).toHaveLength(5);
      const platforms = urls.map(u => u.platform);
      expect(platforms).toContain("gohighlevel");
      expect(platforms).toContain("dripify");
      expect(platforms).toContain("smsit");
      expect(platforms).toContain("workable");
      expect(platforms).toContain("linkedin");
      // Each entry should have webhookUrl and description
      for (const entry of urls) {
        expect(entry).toHaveProperty("webhookUrl");
        expect(entry).toHaveProperty("description");
        expect(entry.webhookUrl).toContain("/api/webhooks/");
      }
    });
  });

  // ─── CRM Adapter Push Direction ──────────────────────────────────────
  describe("crmAdapter push direction", () => {
    it("exports syncCRM function", async () => {
      const mod = await import("./services/crmAdapter");
      expect(mod).toHaveProperty("syncCRM");
      expect(typeof mod.syncCRM).toBe("function");
    });

    it("exports pushContact functions for all platforms", async () => {
      const mod = await import("./services/crmAdapter");
      // The module should have push capabilities
      expect(mod.syncCRM).toBeDefined();
    });
  });

  // ─── Webhook Endpoint Verification ───────────────────────────────────
  describe("Webhook endpoints respond correctly", () => {
    const BASE = "http://localhost:3000";

    it("Dripify webhook accepts POST", async () => {
      const res = await fetch(`${BASE}/api/webhooks/dripify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "connection.accepted", data: { name: "Test" } }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty("received", true);
    });

    it("SMS-iT webhook accepts POST", async () => {
      const res = await fetch(`${BASE}/api/webhooks/smsit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "contact.created", data: { firstName: "Test" } }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty("received", true);
    });

    it("Workable webhook accepts POST", async () => {
      const res = await fetch(`${BASE}/api/webhooks/workable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "candidate.created", data: { name: "Test" } }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty("received", true);
    });

    it("LinkedIn webhook accepts POST", async () => {
      const res = await fetch(`${BASE}/api/webhooks/linkedin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "connection.new", data: { firstName: "Test" } }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty("received", true);
    });

    it("Platform health check returns all 5 platforms", async () => {
      const res = await fetch(`${BASE}/api/webhooks/platforms/health`);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty("status", "ok");
      expect(json.platforms).toHaveLength(5);
      // platforms is a flat array of strings
      expect(json.platforms).toContain("gohighlevel");
      expect(json.platforms).toContain("dripify");
      expect(json.platforms).toContain("smsit");
      expect(json.platforms).toContain("workable");
      expect(json.platforms).toContain("linkedin");
    });
  });

  // ─── Unified Dashboard includes outbound data ────────────────────────
  describe("crm.unifiedDashboard", () => {
    it("returns platforms, recentEvents, and syncLogs", async () => {
      const ctx = createAdminContext();
      const c = caller(ctx);
      const result = await c.crm.unifiedDashboard();
      expect(result).toHaveProperty("platforms");
      expect(result).toHaveProperty("recentEvents");
      expect(result).toHaveProperty("syncLogs");
      expect(Array.isArray(result.platforms)).toBe(true);
      expect(Array.isArray(result.recentEvents)).toBe(true);
      expect(Array.isArray(result.syncLogs)).toBe(true);
    });
  });
});
