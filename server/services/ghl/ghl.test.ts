/**
 * GHL Phase 3 integration tests — exercise the pure parts of the
 * client / webhook / trigger / monitoring modules without hitting the
 * network or the database.
 *
 * The GHL modules are deliberately built with pure decision functions
 * (validateContactPayload, verifyWebhookSignature, buildCompletionPayload,
 * evaluateStrategyComparer, evaluateHighValue, filterReengagementCandidates,
 * computeNextRetry, classifyDrift, derivePlanType) so we can cover the
 * business logic at full speed without stubbing out fetch or Drizzle.
 */

import { describe, it, expect } from "vitest";
import crypto from "crypto";

import {
  verifyWebhookSignature,
  validateContactPayload,
  buildHeaders,
  type GHLConfigV1,
  type GHLConfigV2,
  type GHLContactPayload,
} from "./ghlClient";
import { REQUIRED_FIELDS } from "./fieldProvisioning";
import {
  derivePlanType,
  buildCompletionPayload,
  type CalculatorCompletionInput,
} from "./calculatorCompletionWebhook";
import {
  evaluateStrategyComparer,
  evaluateHighValue,
  HIGH_VALUE_THRESHOLD,
  filterReengagementCandidates,
  daysSince,
  addHours,
} from "./automationTriggers";
import {
  computeNextRetry,
  MAX_DLQ_RETRIES,
} from "./inboundWebhook";
import { classifyDrift, FAILURE_RATE_ALERT_THRESHOLD } from "./monitoring";

// ═══════════════════════════════════════════════════════════════════════════
// Phase 3A — ghlClient
// ═══════════════════════════════════════════════════════════════════════════

describe("Phase 3A — GHL client", () => {
  describe("verifyWebhookSignature", () => {
    const secret = "shared-secret-abc";
    const payload = JSON.stringify({ type: "contact.update", contactId: "c1" });
    const validSig = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    it("accepts a valid signature", () => {
      expect(verifyWebhookSignature(payload, validSig, secret).valid).toBe(true);
    });

    it("accepts an sha256= prefixed signature", () => {
      expect(
        verifyWebhookSignature(payload, `sha256=${validSig}`, secret).valid,
      ).toBe(true);
    });

    it("rejects a missing signature", () => {
      const r = verifyWebhookSignature(payload, undefined, secret);
      expect(r.valid).toBe(false);
      expect(r.reason).toBe("missing_signature");
    });

    it("rejects a mismatched signature", () => {
      const r = verifyWebhookSignature(payload, "wrong", secret);
      expect(r.valid).toBe(false);
    });

    it("rejects a stale timestamp (>5 min skew)", () => {
      const sixMinAgo = String(Math.floor(Date.now() / 1000) - 400);
      const r = verifyWebhookSignature(payload, validSig, secret, sixMinAgo);
      expect(r.valid).toBe(false);
      expect(r.reason).toBe("timestamp_skew");
    });

    it("accepts a fresh timestamp", () => {
      const now = String(Math.floor(Date.now() / 1000));
      expect(verifyWebhookSignature(payload, validSig, secret, now).valid).toBe(
        true,
      );
    });
  });

  describe("validateContactPayload", () => {
    it("requires locationId", () => {
      const r = validateContactPayload({
        locationId: "",
        email: "a@b.co",
      } as GHLContactPayload);
      expect(r.ok).toBe(false);
      expect(r.errors).toContain("locationId required");
    });

    it("requires email or phone", () => {
      const r = validateContactPayload({ locationId: "loc1" } as GHLContactPayload);
      expect(r.ok).toBe(false);
    });

    it("requires valid email format", () => {
      const r = validateContactPayload({
        locationId: "loc1",
        email: "not-an-email",
      } as GHLContactPayload);
      expect(r.ok).toBe(false);
      expect(r.errors).toContain("invalid email");
    });

    it("requires E.164 phone format", () => {
      const r = validateContactPayload({
        locationId: "loc1",
        phone: "555-1234",
      } as GHLContactPayload);
      expect(r.ok).toBe(false);
    });

    it("accepts minimal valid payload", () => {
      const r = validateContactPayload({
        locationId: "loc1",
        email: "user@example.com",
      } as GHLContactPayload);
      expect(r.ok).toBe(true);
    });
  });

  describe("buildHeaders", () => {
    const v2: GHLConfigV2 = {
      apiVersion: "v2",
      accessToken: "abc",
      refreshToken: "ref",
      tokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
      clientId: "cli",
      clientSecret: "sec",
      locationId: "loc",
    };
    const v1: GHLConfigV1 = {
      apiVersion: "v1",
      apiKey: "legacy-key",
      locationId: "loc",
    };

    it("v2 includes Version: 2021-07-28", () => {
      const h = buildHeaders(v2, "idem-1");
      expect(h.Version).toBe("2021-07-28");
      expect(h.Authorization).toBe("Bearer abc");
    });

    it("v1 omits Version header", () => {
      const h = buildHeaders(v1, "idem-1");
      expect(h.Version).toBeUndefined();
      expect(h.Authorization).toBe("Bearer legacy-key");
    });

    it("always includes X-Stewardly-Source + X-Idempotency-Key", () => {
      const h = buildHeaders(v2, "idem-42");
      expect(h["X-Stewardly-Source"]).toBe("wealthbridge-calculator-v1");
      expect(h["X-Idempotency-Key"]).toBe("idem-42");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Phase 3B — field provisioning
// ═══════════════════════════════════════════════════════════════════════════

describe("Phase 3B — GHL field provisioning", () => {
  it("REQUIRED_FIELDS has all 13 fields from spec", () => {
    expect(REQUIRED_FIELDS.length).toBe(13);
  });

  it("includes all required dropdown options for strategyRecommended", () => {
    const f = REQUIRED_FIELDS.find((r) => r.slug === "strategyRecommended");
    expect(f?.options?.length).toBe(5);
  });

  it("planType has exactly 4 options", () => {
    const f = REQUIRED_FIELDS.find((r) => r.slug === "planType");
    expect(f?.options).toEqual(["basic", "growth", "premium", "custom"]);
  });

  it("every field has slug, label, type", () => {
    REQUIRED_FIELDS.forEach((f) => {
      expect(f.slug).toBeTruthy();
      expect(f.label).toBeTruthy();
      expect(["DATE", "TEXT", "NUMERICAL", "DROPDOWN"]).toContain(f.type);
    });
  });

  it("4 fields are optional (affA, affB, bizIncome, planShareUrl)", () => {
    const optional = REQUIRED_FIELDS.filter((f) => !f.required);
    expect(optional.length).toBe(4);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Phase 3C — calculator completion webhook
// ═══════════════════════════════════════════════════════════════════════════

describe("Phase 3C — calculator completion webhook", () => {
  describe("derivePlanType", () => {
    it("returns premium for $5M+", () => {
      expect(derivePlanType({ totalValueAt30: 6_000_000 })).toBe("premium");
    });
    it("returns growth for $1M-$5M", () => {
      expect(derivePlanType({ totalValueAt30: 2_000_000 })).toBe("growth");
    });
    it("returns basic for $0 < x < $1M", () => {
      expect(derivePlanType({ totalValueAt30: 500_000 })).toBe("basic");
    });
    it("returns custom for 0", () => {
      expect(derivePlanType({ totalValueAt30: 0 })).toBe("custom");
    });
    it("honors explicit planType if provided", () => {
      expect(
        derivePlanType({ planType: "growth", totalValueAt30: 100 }),
      ).toBe("growth");
    });
  });

  describe("buildCompletionPayload", () => {
    const baseInput: CalculatorCompletionInput = {
      connectionId: "conn-1",
      locationId: "loc-1",
      contact: {
        email: "jane@example.com",
        firstName: "Jane",
        lastName: "Doe",
        phone: "+15551234567",
      },
      computation: {
        id: "run-123",
        tool: "he.simulate",
        timestamp: "2026-04-08T12:00:00.000Z",
        hasBizIncome: false,
        input: {},
        result: {
          totalValueAt30: 2_500_000,
          roiAt30: 12.4,
          recommendedStrategy: "balanced-growth",
          savingsRate: 0.15,
          returnRate: 0.07,
        },
      },
      runCount: 3,
    };

    const fieldIds = {
      calculatorCompletedDate: "ghl-f1",
      calculatorLastRunDate: "ghl-f2",
      planType: "ghl-f3",
      totalValue30yr: "ghl-f4",
      roi30yr: "ghl-f5",
      strategyRecommended: "ghl-f6",
      savingsRate: "ghl-f7",
      returnRate: "ghl-f8",
      calculatorRunCount: "ghl-f9",
    };

    it("populates core GHL fields", () => {
      const p = buildCompletionPayload(baseInput, fieldIds);
      expect(p.email).toBe("jane@example.com");
      expect(p.locationId).toBe("loc-1");
      expect(p.customField?.["ghl-f4"]).toBe(2_500_000);
      expect(p.customField?.["ghl-f5"]).toBe("12.4:1");
      expect(p.customField?.["ghl-f9"]).toBe(3);
    });

    it("derives planType for the growth tier", () => {
      const p = buildCompletionPayload(baseInput, fieldIds);
      expect(p.customField?.["ghl-f3"]).toBe("growth");
    });

    it("adds strategy + business-owner tags", () => {
      const p = buildCompletionPayload(
        { ...baseInput, computation: { ...baseInput.computation, hasBizIncome: true } },
        fieldIds,
      );
      expect(p.tags).toContain("calculator-completed");
      expect(p.tags).toContain("strategy-balanced-growth");
      expect(p.tags).toContain("business-owner");
    });

    it("tags client-only when no business income", () => {
      const p = buildCompletionPayload(baseInput, fieldIds);
      expect(p.tags).toContain("client-only");
    });

    it("skips fields whose GHL id is not mapped", () => {
      const sparse = { totalValue30yr: "ghl-f4" };
      const p = buildCompletionPayload(baseInput, sparse);
      expect(Object.keys(p.customField ?? {}).length).toBe(1);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Phase 3D — automation triggers
// ═══════════════════════════════════════════════════════════════════════════

describe("Phase 3D — automation triggers", () => {
  describe("evaluateStrategyComparer", () => {
    it("fires when runCount >= 2 within 7 days", () => {
      const r = evaluateStrategyComparer({
        contactId: "c1",
        runCount: 3,
        lastRunDate: new Date(),
      });
      expect(r.shouldAlert).toBe(true);
      expect(r.task?.priority).toBe("high");
    });

    it("does not fire when runCount < 2", () => {
      const r = evaluateStrategyComparer({
        contactId: "c1",
        runCount: 1,
        lastRunDate: new Date(),
      });
      expect(r.shouldAlert).toBe(false);
    });

    it("does not fire when lastRun > 7 days old", () => {
      const r = evaluateStrategyComparer({
        contactId: "c1",
        runCount: 5,
        lastRunDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      });
      expect(r.shouldAlert).toBe(false);
    });

    it("sets a 4-hour due date", () => {
      const r = evaluateStrategyComparer({
        contactId: "c1",
        runCount: 2,
        lastRunDate: new Date(),
      });
      const due = Date.parse(r.task!.dueDate);
      const delta = due - Date.now();
      expect(delta).toBeGreaterThan(3 * 60 * 60 * 1000);
      expect(delta).toBeLessThan(5 * 60 * 60 * 1000);
    });
  });

  describe("evaluateHighValue", () => {
    it("fires > $1M threshold", () => {
      const r = evaluateHighValue(1_500_000);
      expect(r.shouldAlert).toBe(true);
      expect(r.task?.priority).toBe("urgent");
    });

    it("does not fire at exactly $1M", () => {
      expect(evaluateHighValue(HIGH_VALUE_THRESHOLD).shouldAlert).toBe(false);
    });

    it("does not fire below threshold", () => {
      expect(evaluateHighValue(500_000).shouldAlert).toBe(false);
    });
  });

  describe("filterReengagementCandidates", () => {
    const day = (n: number) =>
      new Date(Date.now() - n * 24 * 60 * 60 * 1000);
    const candidates = [
      { contactId: "stale-15", email: "a@x.co", lastActivityDate: day(15) },
      { contactId: "stale-20", email: "b@x.co", lastActivityDate: day(20) },
      { contactId: "fresh-5", email: "c@x.co", lastActivityDate: day(5) },
      { contactId: "in-workflow", email: "d@x.co", lastActivityDate: day(30) },
    ];

    it("keeps stale candidates >14 days", () => {
      const result = filterReengagementCandidates(candidates, new Set());
      const ids = result.map((c) => c.contactId);
      expect(ids).toContain("stale-15");
      expect(ids).toContain("stale-20");
      expect(ids).not.toContain("fresh-5");
    });

    it("excludes contacts already in the workflow", () => {
      const result = filterReengagementCandidates(
        candidates,
        new Set(["in-workflow"]),
      );
      expect(result.map((c) => c.contactId)).not.toContain("in-workflow");
    });
  });

  describe("daysSince + addHours", () => {
    it("daysSince returns a non-negative integer", () => {
      expect(daysSince(new Date())).toBeGreaterThanOrEqual(0);
    });
    it("addHours advances by exactly the right milliseconds", () => {
      const base = new Date("2026-04-08T00:00:00Z");
      const advanced = addHours(base, 5);
      expect(advanced.getTime() - base.getTime()).toBe(5 * 60 * 60 * 1000);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Phase 3E — inbound webhook + DLQ + reconciliation
// ═══════════════════════════════════════════════════════════════════════════

describe("Phase 3E — inbound + DLQ + monitoring", () => {
  describe("computeNextRetry", () => {
    it("grows exponentially from 1s", () => {
      expect(computeNextRetry(0)).toBe(1000);
      expect(computeNextRetry(1)).toBe(2000);
      expect(computeNextRetry(2)).toBe(4000);
      expect(computeNextRetry(3)).toBe(8000);
    });

    it("caps at 16s", () => {
      expect(computeNextRetry(10)).toBe(16_000);
    });

    it("MAX_DLQ_RETRIES is 5 per spec", () => {
      expect(MAX_DLQ_RETRIES).toBe(5);
    });
  });

  describe("classifyDrift", () => {
    it("aligned when <1% difference", () => {
      expect(classifyDrift(1000, 1005)).toBe("aligned");
    });

    it("drift_minor when 1-5% difference", () => {
      expect(classifyDrift(1000, 1020)).toBe("drift_minor");
    });

    it("drift_major when >5% difference", () => {
      expect(classifyDrift(1000, 1200)).toBe("drift_major");
    });

    it("handles zero counts gracefully", () => {
      expect(classifyDrift(0, 0)).toBe("aligned");
    });
  });

  describe("FAILURE_RATE_ALERT_THRESHOLD", () => {
    it("is 5% per spec", () => {
      expect(FAILURE_RATE_ALERT_THRESHOLD).toBe(0.05);
    });
  });
});
