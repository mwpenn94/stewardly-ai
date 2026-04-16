/**
 * Pass 81 — Batch Operations & Error Recovery
 *
 * Tests:
 * 1. bulkUpdateStatus mutation exists in leadPipeline router
 * 2. LeadPipeline has batch selection UI (selectedIds, toggleSelect, selectAll)
 * 3. LeadPipeline has batch action bar with bulk status change
 * 4. QueryErrorBanner added to EmailCampaign
 * 5. QueryErrorBanner added to WebhookManager
 * 6. bulkUpdateStatus accepts array of leadIds and status string
 * 7. Batch selection checkboxes have aria-labels
 * 8. Batch action bar shows count of selected items
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf-8");
}

describe("Pass 81 — Batch Operations & Error Recovery", () => {
  const leadPipelineRouter = read("server/routers/leadPipeline.ts");
  const leadPipelinePage = read("client/src/pages/LeadPipeline.tsx");
  const emailCampaignPage = read("client/src/pages/EmailCampaign.tsx");
  const webhookManagerPage = read("client/src/pages/WebhookManager.tsx");

  describe("Bulk Operations Backend", () => {
    it("leadPipeline router has bulkUpdateStatus mutation", () => {
      expect(leadPipelineRouter).toContain("bulkUpdateStatus");
    });

    it("bulkUpdateStatus accepts array of leadIds", () => {
      expect(leadPipelineRouter).toMatch(/z\.array\(z\.number\(\)\)/);
    });

    it("bulkUpdateStatus uses inArray for batch update", () => {
      expect(leadPipelineRouter).toContain("inArray");
    });

    it("bulkUpdateStatus returns count of updated leads", () => {
      expect(leadPipelineRouter).toMatch(/count:\s*input\.leadIds\.length/);
    });
  });

  describe("Batch Selection UI", () => {
    it("LeadPipeline has selectedIds state", () => {
      expect(leadPipelinePage).toContain("selectedIds");
    });

    it("LeadPipeline has toggleSelect callback", () => {
      expect(leadPipelinePage).toContain("toggleSelect");
    });

    it("LeadPipeline has selectAll callback", () => {
      expect(leadPipelinePage).toContain("selectAll");
    });

    it("LeadPipeline has clearSelection callback", () => {
      expect(leadPipelinePage).toContain("clearSelection");
    });

    it("batch action bar shows selected count", () => {
      expect(leadPipelinePage).toMatch(/selectedIds\.size.*selected/);
    });

    it("batch action bar has bulk status change dropdown", () => {
      expect(leadPipelinePage).toContain("Bulk change status");
    });

    it("selection checkboxes have aria-labels", () => {
      expect(leadPipelinePage).toContain("aria-label=");
    });

    it("uses bulkUpdateStatus mutation in batch action bar", () => {
      expect(leadPipelinePage).toContain("bulkUpdateMut");
    });
  });

  describe("Error Recovery", () => {
    it("EmailCampaign has QueryErrorBanner import", () => {
      expect(emailCampaignPage).toContain("QueryErrorBanner");
    });

    it("EmailCampaign uses QueryErrorBanner for campaign list errors", () => {
      expect(emailCampaignPage).toMatch(/campaignsQ\.isError/);
    });

    it("WebhookManager has QueryErrorBanner", () => {
      expect(webhookManagerPage).toContain("QueryErrorBanner");
    });
  });
});
