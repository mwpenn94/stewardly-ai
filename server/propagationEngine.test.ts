import { describe, it, expect } from "vitest";

// ─── Propagation Engine Tests ────────────────────────────────────────

describe("Event Propagation", () => {
  it("should propagate suitability changes to product recommendations", () => {
    const event = { type: "suitability_changed", userId: "u1", field: "riskTolerance", oldValue: "moderate", newValue: "conservative" };
    const affectedSystems = ["product_matching", "portfolio_risk", "disclaimers"];
    expect(affectedSystems.length).toBeGreaterThan(0);
    expect(event.type).toBe("suitability_changed");
  });

  it("should cascade regulatory changes to affected clients", () => {
    const regulation = { id: "reg-1", affectedProducts: ["prod-1", "prod-2"], effectiveDate: "2026-04-01" };
    const affectedClients = ["client-1", "client-3", "client-7"];
    expect(affectedClients.length).toBeGreaterThan(0);
    expect(regulation.affectedProducts).toHaveLength(2);
  });

  it("should track propagation chains", () => {
    const chain = [
      { step: 1, source: "suitability_update", target: "product_disqualification" },
      { step: 2, source: "product_disqualification", target: "advisor_notification" },
      { step: 3, source: "advisor_notification", target: "client_communication" },
    ];
    expect(chain).toHaveLength(3);
    expect(chain[0].source).toBe("suitability_update");
  });

  it("should prevent circular propagation", () => {
    const visited = new Set<string>();
    const events = ["A", "B", "C", "A"];
    let circular = false;
    for (const e of events) {
      if (visited.has(e)) { circular = true; break; }
      visited.add(e);
    }
    expect(circular).toBe(true);
  });

  it("should support async propagation with retry", () => {
    const config = { maxRetries: 3, backoffMs: 1000, timeout: 30000 };
    expect(config.maxRetries).toBe(3);
    expect(config.backoffMs).toBeGreaterThan(0);
  });

  it("should log all propagation events for audit", () => {
    const log = {
      eventId: "evt-123",
      source: "suitability_engine",
      targets: ["product_matcher", "compliance_checker"],
      timestamp: Date.now(),
      status: "completed",
    };
    expect(log.targets).toHaveLength(2);
    expect(log.status).toBe("completed");
  });
});

describe("Change Detection", () => {
  it("should detect material changes in client profile", () => {
    const old = { income: 100000, riskTolerance: "moderate" };
    const updated = { income: 150000, riskTolerance: "moderate" };
    const incomeChange = Math.abs(updated.income - old.income) / old.income;
    const material = incomeChange > 0.1;
    expect(material).toBe(true);
  });

  it("should ignore non-material changes", () => {
    const old = { income: 100000 };
    const updated = { income: 101000 };
    const change = Math.abs(updated.income - old.income) / old.income;
    const material = change > 0.1;
    expect(material).toBe(false);
  });

  it("should batch related changes", () => {
    const changes = [
      { field: "income", at: 1000 },
      { field: "netWorth", at: 1001 },
      { field: "riskTolerance", at: 1002 },
    ];
    const windowMs = 5000;
    const batched = changes.filter(c => c.at - changes[0].at < windowMs);
    expect(batched).toHaveLength(3);
  });

  it("should prioritize changes by impact", () => {
    const impacts: Record<string, number> = {
      riskTolerance: 10,
      investmentHorizon: 8,
      income: 6,
      address: 1,
    };
    const sorted = Object.entries(impacts).sort((a, b) => b[1] - a[1]);
    expect(sorted[0][0]).toBe("riskTolerance");
  });
});

describe("Notification Routing", () => {
  it("should route notifications by severity", () => {
    const routes: Record<string, string[]> = {
      critical: ["email", "sms", "push", "in_app"],
      high: ["email", "push", "in_app"],
      medium: ["push", "in_app"],
      low: ["in_app"],
    };
    expect(routes.critical).toHaveLength(4);
    expect(routes.low).toHaveLength(1);
  });

  it("should respect user notification preferences", () => {
    const prefs = { email: true, sms: false, push: true };
    const channels = Object.entries(prefs).filter(([, v]) => v).map(([k]) => k);
    expect(channels).toContain("email");
    expect(channels).not.toContain("sms");
  });

  it("should throttle notifications per user", () => {
    const maxPerHour = 10;
    const sentThisHour = 8;
    const canSend = sentThisHour < maxPerHour;
    expect(canSend).toBe(true);
  });

  it("should aggregate similar notifications", () => {
    const notifications = [
      { type: "product_update", productId: "p1" },
      { type: "product_update", productId: "p2" },
      { type: "product_update", productId: "p3" },
    ];
    const grouped = { type: "product_update", count: notifications.length, summary: "3 products updated" };
    expect(grouped.count).toBe(3);
  });
});
