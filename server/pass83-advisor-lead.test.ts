/**
 * Pass 83 — Advisor Network & Lead Lifecycle Depth
 *
 * Tests:
 * 1. AdvisorProfile now fetches practice metrics
 * 2. AdvisorProfile now fetches annual reviews
 * 3. LeadDetail has lifecycle stage transition dropdown
 * 4. LeadDetail uses updateStatus mutation
 * 5. All 11 lifecycle stages are available in LeadDetail
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf-8");
}

describe("Pass 83 — Advisor Network & Lead Lifecycle Depth", () => {
  const advisorProfile = read("client/src/pages/AdvisorProfile.tsx");
  const leadDetail = read("client/src/pages/LeadDetail.tsx");

  describe("AdvisorProfile Enhancements", () => {
    it("fetches practice metrics from professionalPractice.metrics.list", () => {
      expect(advisorProfile).toContain("professionalPractice.metrics.list");
    });

    it("fetches annual reviews from professionalPractice.reviews.list", () => {
      expect(advisorProfile).toContain("professionalPractice.reviews.list");
    });

    it("renders Practice Metrics section", () => {
      expect(advisorProfile).toContain("Practice Metrics");
    });

    it("renders Performance Reviews section", () => {
      expect(advisorProfile).toContain("Performance Reviews");
    });

    it("has at least 3 trpc calls", () => {
      const calls = advisorProfile.match(/trpc\.\w+/g) || [];
      expect(calls.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("LeadDetail Lifecycle Transitions", () => {
    it("has lifecycle stage dropdown using Select component", () => {
      expect(leadDetail).toContain("SelectTrigger");
      expect(leadDetail).toContain("SelectContent");
      expect(leadDetail).toContain("SelectItem");
    });

    it("uses updateStatus mutation", () => {
      expect(leadDetail).toContain("leadPipeline.updateStatus.useMutation");
    });

    it("has all 11 lifecycle stages", () => {
      const stages = ["new", "enriched", "scored", "qualified", "assigned", "contacted", "meeting", "proposal", "converted", "disqualified", "dormant"];
      for (const stage of stages) {
        expect(leadDetail).toContain(`"${stage}"`);
      }
    });

    it("invalidates pipeline on status update success", () => {
      expect(leadDetail).toContain("getPipeline.invalidate");
    });

    it("shows loading indicator during status update", () => {
      expect(leadDetail).toContain("updateStatus.isPending");
    });

    it("has at least 2 trpc calls", () => {
      const calls = leadDetail.match(/trpc\.\w+/g) || [];
      expect(calls.length).toBeGreaterThanOrEqual(2);
    });
  });
});
