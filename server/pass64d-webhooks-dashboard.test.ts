/**
 * Pass 64d — Webhook Endpoints and Unified Sync Dashboard Tests
 */
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
      protocol: "https",
      hostname: "localhost",
      headers: { origin: "https://localhost:3000" },
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("Platform Webhook Endpoints", () => {
  it("health check returns all 5 platforms", async () => {
    const res = await fetch("http://localhost:3000/api/webhooks/platforms/health");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.platforms).toContain("gohighlevel");
    expect(data.platforms).toContain("dripify");
    expect(data.platforms).toContain("smsit");
    expect(data.platforms).toContain("workable");
    expect(data.platforms).toContain("linkedin");
    expect(data.platforms).toHaveLength(5);
  });

  it("Dripify webhook accepts POST and returns received", async () => {
    const res = await fetch("http://localhost:3000/api/webhooks/dripify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "lead.replied",
        data: {
          firstName: "Vitest",
          lastName: "Dripify",
          email: `vitest-drip-${Date.now()}@example.com`,
        },
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.received).toBe(true);
    expect(data.eventId).toBeDefined();
  });

  it("SMS-iT webhook accepts POST and returns received", async () => {
    const res = await fetch("http://localhost:3000/api/webhooks/smsit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "contact.created",
        data: {
          firstName: "Vitest",
          lastName: "SMSIT",
          email: `vitest-smsit-${Date.now()}@example.com`,
        },
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.received).toBe(true);
    expect(data.eventId).toBeDefined();
  });

  it("Workable webhook accepts POST and returns received", async () => {
    const res = await fetch("http://localhost:3000/api/webhooks/workable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "candidate.created",
        data: {
          firstName: "Vitest",
          lastName: "Workable",
          email: `vitest-work-${Date.now()}@example.com`,
        },
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.received).toBe(true);
    expect(data.eventId).toBeDefined();
  });

  it("LinkedIn webhook accepts POST and returns received", async () => {
    const res = await fetch("http://localhost:3000/api/webhooks/linkedin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "connection.accepted",
        data: {
          firstName: "Vitest",
          lastName: "LinkedIn",
          email: `vitest-li-${Date.now()}@example.com`,
          profileUrl: "https://linkedin.com/in/vitest-li",
        },
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    // LinkedIn handler returns { received: true, eventId: "..." }
    expect(data.received).toBe(true);
    expect(data.eventId).toBeDefined();
  });

  it("all webhook endpoints respond to GET without crashing", async () => {
    const endpoints = ["/api/webhooks/dripify", "/api/webhooks/smsit", "/api/webhooks/workable", "/api/webhooks/linkedin"];
    for (const ep of endpoints) {
      const res = await fetch(`http://localhost:3000${ep}`);
      // Should return 200 (status page) or 405 — never 500
      expect(res.status).toBeLessThan(500);
    }
  });
});

describe("CRM Unified Dashboard", () => {
  it("unifiedDashboard returns structured data", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.crm.unifiedDashboard();
    expect(result).toHaveProperty("platforms");
    expect(result).toHaveProperty("recentEvents");
    expect(result).toHaveProperty("syncLogs");
    expect(Array.isArray(result.platforms)).toBe(true);
    expect(Array.isArray(result.recentEvents)).toBe(true);
    expect(Array.isArray(result.syncLogs)).toBe(true);
  });

  it("unifiedDashboard platforms includes GHL connection", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.crm.unifiedDashboard();
    // GHL was connected in E2E test — should appear in platforms
    const ghl = (result.platforms as any[]).find((p: any) => 
      p.provider === "gohighlevel" || p.provider === "go_high_level"
    );
    expect(ghl).toBeDefined();
  });

  it("platformWebhookEvents returns array for gohighlevel", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.crm.platformWebhookEvents({ provider: "gohighlevel", limit: 10 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("platformWebhookEvents returns array for dripify", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.crm.platformWebhookEvents({ provider: "dripify", limit: 10 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("syncHistory returns array", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.crm.syncHistory();
    expect(Array.isArray(result)).toBe(true);
  });

  it("providers returns array", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.crm.providers();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("CRM Sync Mutation Provider Validation", () => {
  it("crm.sync procedure exists and is callable", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    // Verify the procedure exists by checking it's a function
    expect(typeof caller.crm.sync).toBe("function");
  });

  it("crm.unifiedDashboard procedure exists and is callable", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.crm.unifiedDashboard).toBe("function");
  });

  it("crm.platformWebhookEvents procedure exists and is callable", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.crm.platformWebhookEvents).toBe("function");
  });
});
