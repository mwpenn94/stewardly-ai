/**
 * Pass 84 — Compliance Workflow & Provider Health Depth
 *
 * Tests:
 * 1. ComplianceAudit now has reviewContent submission form
 * 2. ComplianceAudit now has generateRegBIDoc button
 * 3. AdminSystemHealth now shows provider health checks
 * 4. Comprehensive trpc call counts across key pages
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf-8");
}

describe("Pass 84 — Compliance Workflow & Provider Health Depth", () => {
  const complianceAudit = read("client/src/pages/ComplianceAudit.tsx");
  const adminSystemHealth = read("client/src/pages/AdminSystemHealth.tsx");

  describe("ComplianceAudit Review Workflow", () => {
    it("has reviewContent mutation", () => {
      expect(complianceAudit).toContain("compliance.reviewContent.useMutation");
    });

    it("has generateRegBIDoc mutation", () => {
      expect(complianceAudit).toContain("compliance.generateRegBIDoc.useMutation");
    });

    it("has content type selector with 5 types", () => {
      expect(complianceAudit).toContain("chat_response");
      expect(complianceAudit).toContain("email");
      expect(complianceAudit).toContain("report");
      expect(complianceAudit).toContain("marketing");
      expect(complianceAudit).toContain("recommendation");
    });

    it("has review submission textarea", () => {
      expect(complianceAudit).toContain("Paste content to review for compliance");
    });

    it("invalidates queries on successful review", () => {
      expect(complianceAudit).toContain("getReviews.invalidate");
      expect(complianceAudit).toContain("getDashboardStats.invalidate");
    });

    it("has at least 4 trpc calls", () => {
      const calls = complianceAudit.match(/trpc\.\w+/g) || [];
      expect(calls.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("AdminSystemHealth Provider Health", () => {
    it("fetches provider health checks", () => {
      expect(adminSystemHealth).toContain("healthChecks.list.useQuery");
    });

    it("renders Provider Health section", () => {
      expect(adminSystemHealth).toContain("Provider Health");
    });

    it("shows provider status indicators (healthy/degraded/down)", () => {
      expect(adminSystemHealth).toContain("healthy");
      expect(adminSystemHealth).toContain("degraded");
    });

    it("shows response time and failure count", () => {
      expect(adminSystemHealth).toContain("responseTimeMs");
      expect(adminSystemHealth).toContain("consecutiveFailures");
    });

    it("has at least 3 trpc calls", () => {
      const calls = adminSystemHealth.match(/trpc\.\w+/g) || [];
      expect(calls.length).toBeGreaterThanOrEqual(3);
    });
  });
});
