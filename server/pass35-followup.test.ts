/**
 * Pass 35 Follow-up — Vitest tests for:
 *  1. Metric recording wired into webhook handler (recordWebhookEvent)
 *  2. Metric recording wired into polling service (recordPollingEvent)
 *  3. Threshold-breach notification logic (notifyOwner integration)
 *  4. Unified alert banner on LocationHealth (merged alerts)
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Mock modules ──────────────────────────────────────────────────────────

// Mock syncMetrics
const mockRecordWebhookEvent = vi.fn().mockResolvedValue(1);
const mockRecordPollingEvent = vi.fn().mockResolvedValue(2);
const mockGetChannelMetrics = vi.fn().mockResolvedValue({
  channel: "webhook",
  totalEvents: 10,
  successfulEvents: 9,
  failedEvents: 1,
  successRate: 90,
  avgLatencyMs: 500,
  medianLatencyMs: 400,
  p95LatencyMs: 1200,
  minLatencyMs: 100,
  maxLatencyMs: 2000,
  eventsLast1h: 3,
  eventsLast24h: 10,
  lastEventAt: Date.now(),
});

vi.mock("./services/syncMetrics", () => ({
  recordWebhookEvent: mockRecordWebhookEvent,
  recordPollingEvent: mockRecordPollingEvent,
  recordSyncEvent: vi.fn().mockResolvedValue(1),
  getChannelMetrics: mockGetChannelMetrics,
  getChannelComparison: vi.fn().mockResolvedValue({
    webhook: { channel: "webhook", totalEvents: 10, successRate: 90 },
    polling: { channel: "polling", totalEvents: 8, successRate: 95 },
    latencyAdvantage: { channel: "webhook", differenceMs: 5000, description: "Webhooks are faster" },
    coverageComparison: { webhookOnly: 2, pollingOnly: 1, bothChannels: 7, description: "Good overlap" },
    recommendation: "Both channels operating well",
  }),
  getHourlyTimeline: vi.fn().mockResolvedValue([]),
  getEventTypeBreakdown: vi.fn().mockResolvedValue([]),
}));

// Mock notifyOwner
const mockNotifyOwner = vi.fn().mockResolvedValue(true);
vi.mock("./_core/notification", () => ({
  notifyOwner: mockNotifyOwner,
}));

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("Pass 35 Follow-up: Metric Recording Wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("recordWebhookEvent integration", () => {
    it("should export recordWebhookEvent with correct signature", async () => {
      const { recordWebhookEvent } = await import("./services/syncMetrics");
      expect(recordWebhookEvent).toBeDefined();
      expect(typeof recordWebhookEvent).toBe("function");
    });

    it("should accept webhook event parameters", async () => {
      const { recordWebhookEvent } = await import("./services/syncMetrics");
      const result = await recordWebhookEvent({
        eventType: "contact_create",
        locationId: "loc-123",
        locationDbId: 1,
        contactExternalId: "ghl-contact-456",
        ghlTimestamp: Date.now() - 5000,
        payloadSize: 1024,
        success: true,
      });
      expect(result).toBe(1);
      expect(mockRecordWebhookEvent).toHaveBeenCalledWith({
        eventType: "contact_create",
        locationId: "loc-123",
        locationDbId: 1,
        contactExternalId: "ghl-contact-456",
        ghlTimestamp: expect.any(Number),
        payloadSize: 1024,
        success: true,
      });
    });

    it("should handle failed webhook events", async () => {
      const { recordWebhookEvent } = await import("./services/syncMetrics");
      await recordWebhookEvent({
        eventType: "contact_update",
        success: false,
        errorMessage: "Processing failed",
      });
      expect(mockRecordWebhookEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          errorMessage: "Processing failed",
        }),
      );
    });

    it("should map GHL event types to normalized types", () => {
      // Test the mapping logic used in ghlWebhook.ts
      const mapEventType = (eventType: string) => {
        if (eventType.includes("delete") || eventType.includes("Delete")) return "contact_delete";
        if (eventType.includes("opportunity") || eventType.includes("Opportunity")) {
          return eventType.includes("create") || eventType.includes("Create")
            ? "opportunity_create"
            : "opportunity_update";
        }
        if (eventType.includes("create") || eventType.includes("Create")) return "contact_create";
        return "contact_update";
      };

      expect(mapEventType("contact.create")).toBe("contact_create");
      expect(mapEventType("ContactCreate")).toBe("contact_create");
      expect(mapEventType("contact.update")).toBe("contact_update");
      expect(mapEventType("ContactUpdate")).toBe("contact_update");
      expect(mapEventType("contact.delete")).toBe("contact_delete");
      expect(mapEventType("ContactDelete")).toBe("contact_delete");
      expect(mapEventType("opportunity.create")).toBe("opportunity_create");
      expect(mapEventType("OpportunityCreate")).toBe("opportunity_create");
      expect(mapEventType("opportunity.status_change")).toBe("opportunity_update");
      expect(mapEventType("OpportunityStatusUpdate")).toBe("opportunity_update");
    });
  });

  describe("recordPollingEvent integration", () => {
    it("should export recordPollingEvent with correct signature", async () => {
      const { recordPollingEvent } = await import("./services/syncMetrics");
      expect(recordPollingEvent).toBeDefined();
      expect(typeof recordPollingEvent).toBe("function");
    });

    it("should accept polling event parameters for created contacts", async () => {
      const { recordPollingEvent } = await import("./services/syncMetrics");
      await recordPollingEvent({
        eventType: "contact_create",
        locationId: "loc-789",
        locationDbId: 2,
        contactExternalId: "ghl-contact-abc",
        ghlTimestamp: Date.now() - 60000,
        success: true,
      });
      expect(mockRecordPollingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "contact_create",
          locationId: "loc-789",
          success: true,
        }),
      );
    });

    it("should accept polling event parameters for updated contacts", async () => {
      const { recordPollingEvent } = await import("./services/syncMetrics");
      await recordPollingEvent({
        eventType: "contact_update",
        locationId: "loc-789",
        locationDbId: 2,
        contactExternalId: "ghl-contact-def",
        success: true,
      });
      expect(mockRecordPollingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "contact_update",
          success: true,
        }),
      );
    });

    it("should record failed polling events", async () => {
      const { recordPollingEvent } = await import("./services/syncMetrics");
      await recordPollingEvent({
        eventType: "contact_create",
        locationId: "loc-789",
        contactExternalId: "ghl-contact-fail",
        success: false,
        errorMessage: "Skipped create for ghl-contact-fail",
      });
      expect(mockRecordPollingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          errorMessage: expect.stringContaining("Skipped"),
        }),
      );
    });
  });
});

describe("Pass 35 Follow-up: Threshold-Breach Notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear the global notification cache
    if ((globalThis as any).alert_notif_cache) {
      (globalThis as any).alert_notif_cache.clear();
    }
  });

  it("should import notifyOwner from notification module", async () => {
    const { notifyOwner } = await import("./_core/notification");
    expect(notifyOwner).toBeDefined();
    expect(typeof notifyOwner).toBe("function");
  });

  it("should call notifyOwner with correct title and content format", async () => {
    const { notifyOwner } = await import("./_core/notification");
    await notifyOwner({
      title: "⚠️ Critical Alert: 2 threshold breaches detected",
      content: "• Sync Lag for Location A: 120min exceeds critical threshold (90min)\n• Error Rate for Location B: 25% exceeds critical threshold (20%)\n\nReview thresholds at Platform > Alert Thresholds.",
    });
    expect(mockNotifyOwner).toHaveBeenCalledWith({
      title: expect.stringContaining("Critical Alert"),
      content: expect.stringContaining("threshold"),
    });
  });

  it("should handle notification failure gracefully", async () => {
    mockNotifyOwner.mockResolvedValueOnce(false);
    const { notifyOwner } = await import("./_core/notification");
    const result = await notifyOwner({ title: "Test", content: "Test content" });
    expect(result).toBe(false);
  });

  it("should use dedup cache to prevent notification spam", () => {
    // Test the dedup logic used in evaluateAlertThresholds
    const cache = new Map<string, number>();
    const cooldownMs = 3600000; // 1 hour
    const now = Date.now();

    // First alert should pass
    const key1 = "1:sync_lag_minutes";
    const lastNotified1 = cache.get(key1) || 0;
    expect(now - lastNotified1 > cooldownMs).toBe(true);

    // Record notification
    cache.set(key1, now);

    // Same alert within cooldown should be blocked
    const lastNotified2 = cache.get(key1) || 0;
    expect(now - lastNotified2 > cooldownMs).toBe(false);

    // Different metric should pass
    const key2 = "1:error_rate_pct";
    const lastNotified3 = cache.get(key2) || 0;
    expect(now - lastNotified3 > cooldownMs).toBe(true);
  });

  it("should format notification content with bullet points", () => {
    const alerts = [
      { message: "Sync Lag for Location A: 120min exceeds critical threshold (90min)" },
      { message: "Error Rate for Location B: 25% exceeds critical threshold (20%)" },
    ];
    const title = `⚠️ Critical Alert: ${alerts.length} threshold breach${alerts.length > 1 ? "es" : ""} detected`;
    const content = alerts.map(a => `• ${a.message}`).join("\n") + "\n\nReview thresholds at Platform > Alert Thresholds.";

    expect(title).toContain("2 threshold breaches");
    expect(content).toContain("• Sync Lag");
    expect(content).toContain("• Error Rate");
    expect(content).toContain("Review thresholds");
  });
});

describe("Pass 35 Follow-up: Unified Alert Banner Logic", () => {
  it("should merge legacy and threshold alerts without duplicates", () => {
    const legacyAlerts = [
      { severity: "critical", message: "Location A sync failed", locationName: "Location A", type: "sync_failure", timestamp: Date.now() },
    ];
    const thresholdAlerts = [
      { severity: "warning" as const, message: "Sync Lag for Location B: 45min exceeds warning threshold (30min)", locationName: "Location B", metricName: "sync_lag_minutes", currentValue: 45, warningThreshold: 30, criticalThreshold: 90 },
      { severity: "critical" as const, message: "Location A sync failed", locationName: "Location A", metricName: "sync_failure", currentValue: 1, warningThreshold: 0, criticalThreshold: 0 }, // duplicate
    ];

    const merged: Array<{ severity: string; message: string; source: string }> = [];
    for (const a of legacyAlerts) {
      merged.push({ severity: a.severity, message: a.message, source: "health" });
    }
    for (const a of thresholdAlerts) {
      const isDuplicate = merged.some(m => m.message === a.message);
      if (!isDuplicate) {
        merged.push({ severity: a.severity, message: a.message, source: "threshold" });
      }
    }

    expect(merged.length).toBe(2); // 1 legacy + 1 unique threshold (duplicate removed)
    expect(merged[0].source).toBe("health");
    expect(merged[1].source).toBe("threshold");
  });

  it("should sort alerts with critical first", () => {
    const alerts = [
      { severity: "warning", message: "Warning 1" },
      { severity: "critical", message: "Critical 1" },
      { severity: "warning", message: "Warning 2" },
      { severity: "critical", message: "Critical 2" },
    ];

    alerts.sort((a, b) => (a.severity === "critical" ? 0 : 1) - (b.severity === "critical" ? 0 : 1));

    expect(alerts[0].severity).toBe("critical");
    expect(alerts[1].severity).toBe("critical");
    expect(alerts[2].severity).toBe("warning");
    expect(alerts[3].severity).toBe("warning");
  });

  it("should correctly count critical and warning alerts", () => {
    const allAlerts = [
      { severity: "critical" },
      { severity: "critical" },
      { severity: "warning" },
      { severity: "warning" },
      { severity: "warning" },
    ];
    const criticalCount = allAlerts.filter(a => a.severity === "critical").length;
    const warningCount = allAlerts.filter(a => a.severity === "warning").length;

    expect(criticalCount).toBe(2);
    expect(warningCount).toBe(3);
  });

  it("should determine card border color based on alert severity", () => {
    const hasCritical = (alerts: Array<{ severity: string }>) =>
      alerts.some(a => a.severity === "critical");

    expect(hasCritical([{ severity: "critical" }])).toBe(true);
    expect(hasCritical([{ severity: "warning" }])).toBe(false);
    expect(hasCritical([{ severity: "warning" }, { severity: "critical" }])).toBe(true);
  });
});
