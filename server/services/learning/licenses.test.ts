/**
 * Unit tests for the licensure alert derivation logic (pure helpers).
 */
import { describe, it, expect } from "vitest";
import { daysUntil, deriveLicenseAlerts } from "./licenses";

describe("learning/licenses — pure helpers", () => {
  const now = new Date("2026-04-08T12:00:00Z");

  describe("daysUntil", () => {
    it("returns null for null/undefined", () => {
      expect(daysUntil(null, now)).toBe(null);
      expect(daysUntil(undefined, now)).toBe(null);
    });
    it("computes positive days for future dates", () => {
      expect(daysUntil(new Date("2026-05-08T12:00:00Z"), now)).toBe(30);
    });
    it("computes negative days for past dates", () => {
      expect(daysUntil(new Date("2026-04-01T12:00:00Z"), now)).toBeLessThan(0);
    });
  });

  describe("deriveLicenseAlerts", () => {
    it("emits expired alert for expired license", () => {
      const alerts = deriveLicenseAlerts(
        [{ id: 1, licenseType: "series7", status: "expired", expirationDate: null, ceDeadline: null, ceCreditsRequired: 0, ceCreditsCompleted: 0 } as any],
        now,
      );
      expect(alerts).toHaveLength(1);
      expect(alerts[0].alertType).toBe("expired");
    });

    it("emits expiration_warning within 180 days", () => {
      const alerts = deriveLicenseAlerts(
        [
          {
            id: 2,
            licenseType: "life_health",
            status: "active",
            expirationDate: "2026-06-08", // 61 days out
            ceDeadline: null,
            ceCreditsRequired: 0,
            ceCreditsCompleted: 0,
          } as any,
        ],
        now,
      );
      expect(alerts).toHaveLength(1);
      expect(alerts[0].alertType).toBe("expiration_warning");
      expect(alerts[0].daysOut).toBeGreaterThan(55);
      expect(alerts[0].daysOut).toBeLessThan(70);
    });

    it("emits ce_credits_needed when under credits and deadline <90d", () => {
      const alerts = deriveLicenseAlerts(
        [
          {
            id: 3,
            licenseType: "series66",
            status: "active",
            expirationDate: "2030-01-01",
            ceDeadline: "2026-05-08", // 30 days out
            ceCreditsRequired: 10,
            ceCreditsCompleted: 2,
          } as any,
        ],
        now,
      );
      expect(alerts.some((a) => a.alertType === "ce_credits_needed")).toBe(true);
      const ce = alerts.find((a) => a.alertType === "ce_credits_needed")!;
      expect(ce.message).toContain("8 CE credits");
    });

    it("emits no alerts when everything is healthy", () => {
      const alerts = deriveLicenseAlerts(
        [
          {
            id: 4,
            licenseType: "cfp",
            status: "active",
            expirationDate: "2029-01-01",
            ceDeadline: "2029-01-01",
            ceCreditsRequired: 10,
            ceCreditsCompleted: 10,
          } as any,
        ],
        now,
      );
      expect(alerts).toHaveLength(0);
    });

    it("emits BOTH expiration and ce alerts when both trigger", () => {
      const alerts = deriveLicenseAlerts(
        [
          {
            id: 5,
            licenseType: "life_health",
            status: "active",
            expirationDate: "2026-05-08", // 30d
            ceDeadline: "2026-05-08", // 30d
            ceCreditsRequired: 10,
            ceCreditsCompleted: 0,
          } as any,
        ],
        now,
      );
      expect(alerts.length).toBe(2);
      expect(alerts.map((a) => a.alertType).sort()).toEqual(["ce_credits_needed", "expiration_warning"]);
    });

    it("emits suspended alert for suspended license", () => {
      const alerts = deriveLicenseAlerts(
        [
          {
            id: 6,
            licenseType: "series7",
            status: "suspended",
            expirationDate: null,
            ceDeadline: null,
            ceCreditsRequired: 0,
            ceCreditsCompleted: 0,
          } as any,
        ],
        now,
      );
      expect(alerts).toHaveLength(1);
      expect(alerts[0].alertType).toBe("suspended");
      expect(alerts[0].message).toContain("suspended");
    });
  });
});
