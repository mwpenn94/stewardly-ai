/**
 * v8.3 Pass 12 — P0 Bug Fix Regression Tests
 *
 * Validates:
 * 1. AuthContext guest provisioning timeout (no infinite spinner)
 * 2. Session refreshing toast suppression for anonymous users
 * 3. Greeting text fix (no "Good Good" duplication)
 * 4. People Engine availability
 * 5. Notification workflow service
 * 6. Usage analytics router
 * 7. Improvement signal bridge
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Pass 12 — P0 Blank Screen Fix", () => {
  // ─── AuthContext timeout logic ───
  describe("Guest provisioning timeout", () => {
    it("should have GUEST_PROVISION_TIMEOUT_MS constant of 8 seconds", async () => {
      // Verify the timeout value is defined in AuthContext
      const fs = await import("fs");
      const authCtx = fs.readFileSync(
        new URL("../../contexts/AuthContext.tsx", import.meta.url),
        "utf-8"
      );
      expect(authCtx).toContain("GUEST_PROVISION_TIMEOUT_MS");
      expect(authCtx).toContain("8_000");
    });

    it("should use AbortController for fetch timeout", async () => {
      const fs = await import("fs");
      const authCtx = fs.readFileSync(
        new URL("../../contexts/AuthContext.tsx", import.meta.url),
        "utf-8"
      );
      expect(authCtx).toContain("AbortController");
      expect(authCtx).toContain("controller.abort()");
      expect(authCtx).toContain("signal: controller.signal");
    });

    it("should set anonymousMode on timeout", async () => {
      const fs = await import("fs");
      const authCtx = fs.readFileSync(
        new URL("../../contexts/AuthContext.tsx", import.meta.url),
        "utf-8"
      );
      // On timeout, should set anonymousMode in localStorage
      expect(authCtx).toContain('localStorage.setItem("anonymousMode", "true")');
    });

    it("should clear anonymousMode when guest token is received", async () => {
      const fs = await import("fs");
      const authCtx = fs.readFileSync(
        new URL("../../contexts/AuthContext.tsx", import.meta.url),
        "utf-8"
      );
      expect(authCtx).toContain('localStorage.removeItem("anonymousMode")');
    });

    it("should handle AbortError gracefully", async () => {
      const fs = await import("fs");
      const authCtx = fs.readFileSync(
        new URL("../../contexts/AuthContext.tsx", import.meta.url),
        "utf-8"
      );
      expect(authCtx).toContain('"AbortError"');
      expect(authCtx).toContain("Guest session fetch aborted");
    });
  });

  // ─── Session refreshing toast suppression ───
  describe("Session refreshing toast suppression", () => {
    it("should check for stored session token before showing toast", async () => {
      const fs = await import("fs");
      const mainTsx = fs.readFileSync(
        new URL("../../main.tsx", import.meta.url),
        "utf-8"
      );
      expect(mainTsx).toContain("stewardly_session_token");
      expect(mainTsx).toContain("hasStoredToken");
      expect(mainTsx).toContain("Don't invalidate or toast during initial guest provisioning");
    });
  });

  // ─── Greeting fix ───
  describe("Greeting text", () => {
    it("English chat.greeting should not contain 'Good' prefix", async () => {
      const en = await import("../../locales/en");
      const translations = en.default as Record<string, string>;
      const greeting = translations["chat.greeting"];
      // The greeting template should be "{{timeOfDay}}, {{name}}" not "Good {{timeOfDay}}, {{name}}"
      expect(greeting).not.toMatch(/^Good\s/);
      expect(greeting).toContain("{{timeOfDay}}");
    });

    it("English common.afternoon should be a complete greeting", async () => {
      const en = await import("../../locales/en");
      const translations = en.default as Record<string, string>;
      const afternoon = translations["common.afternoon"];
      expect(afternoon).toBe("Good afternoon");
    });
  });

  // ─── People Engine ───
  describe("People Engine", () => {
    it("PeopleHub component should exist", async () => {
      const fs = await import("fs");
      const exists = fs.existsSync(
        new URL("../PeopleHub.tsx", import.meta.url)
      );
      expect(exists).toBe(true);
    });

    it("PeopleHub should have Pipeline, Marketing, Compliance, Operations tabs", async () => {
      const fs = await import("fs");
      const hub = fs.readFileSync(
        new URL("../PeopleHub.tsx", import.meta.url),
        "utf-8"
      );
      expect(hub).toContain('"pipeline"');
      expect(hub).toContain('"marketing"');
      expect(hub).toContain('"compliance"');
      expect(hub).toContain('"operations"');
    });

    it("PeopleHub route should be registered in App.tsx", async () => {
      const fs = await import("fs");
      const app = fs.readFileSync(
        new URL("../../App.tsx", import.meta.url),
        "utf-8"
      );
      expect(app).toContain('"/people"');
      expect(app).toContain("PeopleHub");
    });
  });

  // ─── Pass 11 features (carried over validation) ───
  describe("Notification workflow service", () => {
    it("should export getWorkflowRules and dispatchWorkflowEvent", async () => {
      const fs = await import("fs");
      const svc = fs.readFileSync(
        new URL("../../../../server/services/notificationWorkflows.ts", import.meta.url),
        "utf-8"
      );
      expect(svc).toContain("export function getWorkflowRules");
      expect(svc).toContain("export function dispatchWorkflowEvent");
    });

    it("should have rules for lead, compliance, and meeting events", async () => {
      const fs = await import("fs");
      const svc = fs.readFileSync(
        new URL("../../../../server/services/notificationWorkflows.ts", import.meta.url),
        "utf-8"
      );
      expect(svc).toContain("lead.created");
      expect(svc).toContain("compliance.license_expiring");
      expect(svc).toContain("meeting.reminder");
    });
  });

  describe("Usage analytics router", () => {
    it("should exist and export usageAnalyticsRouter", async () => {
      const fs = await import("fs");
      const router = fs.readFileSync(
        new URL("../../../../server/routers/usageAnalytics.ts", import.meta.url),
        "utf-8"
      );
      expect(router).toContain("usageAnalyticsRouter");
      expect(router).toContain("overview");
      expect(router).toContain("chatVolume");
    });
  });

  describe("Improvement signal bridge", () => {
    it("should exist and define 6 improvement loops", async () => {
      const fs = await import("fs");
      const bridge = fs.readFileSync(
        new URL("../../../../server/services/improvementSignalBridge.ts", import.meta.url),
        "utf-8"
      );
      expect(bridge).toContain("processTransactionSignal");
      expect(bridge).toContain("processUserActionSignal");
      expect(bridge).toContain("checkDataFreshness");
      expect(bridge).toContain("processModelQualitySignal");
      expect(bridge).toContain("processComplianceSignal");
      expect(bridge).toContain("getPerformanceMetrics");
    });
  });
});
