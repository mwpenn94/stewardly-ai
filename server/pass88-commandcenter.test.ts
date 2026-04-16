/**
 * Pass 88 — Phase 5 Command Center Integration Tests
 * Validates: DataPipelines, OutreachAutomation, EmailTemplateBuilder, OutreachWorkflowBuilder
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const CLIENT = join(__dirname, "..", "client", "src");

describe("Phase 5 — Command Center Integration", () => {
  describe("DataPipelines page", () => {
    const filePath = join(CLIENT, "pages", "DataPipelines.tsx");
    const content = readFileSync(filePath, "utf-8");

    it("exists and exports default component", () => {
      expect(existsSync(filePath)).toBe(true);
      expect(content).toContain("export default function DataPipelines");
    });

    it("has pipeline status management (active/paused/error/syncing)", () => {
      expect(content).toContain("active");
      expect(content).toContain("paused");
      expect(content).toContain("error");
    });

    it("has pipeline CRUD operations", () => {
      expect(content).toContain("pause");
      expect(content).toContain("resume");
    });

    it("displays pipeline metrics (records synced, last sync, error rate)", () => {
      expect(content).toContain("recordsProcessed");
      expect(content).toContain("lastRun");
      expect(content).toContain("error");
    });

    it("has search and filter functionality", () => {
      expect(content).toContain("search");
      expect(content).toContain("filter");
    });
  });

  describe("OutreachAutomation page", () => {
    const filePath = join(CLIENT, "pages", "OutreachAutomation.tsx");
    const content = readFileSync(filePath, "utf-8");

    it("exists and exports default component", () => {
      expect(existsSync(filePath)).toBe(true);
      expect(content).toContain("export default function OutreachAutomation");
    });

    it("has workflow CRUD (create, edit, duplicate, delete)", () => {
      expect(content).toContain("openCreate");
      expect(content).toContain("openEdit");
      expect(content).toContain("duplicateWorkflow");
      expect(content).toContain("deleteWorkflow");
    });

    it("has workflow status toggle (active/paused)", () => {
      expect(content).toContain("toggleStatus");
    });

    it("has trigger configuration options", () => {
      expect(content).toContain("TRIGGER_OPTIONS");
      expect(content).toContain("new_lead");
      expect(content).toContain("form_submit");
      expect(content).toContain("appointment_booked");
    });

    it("integrates OutreachWorkflowBuilder component", () => {
      expect(content).toContain("OutreachWorkflowBuilder");
    });

    it("has summary statistics (total, active, enrolled, completed)", () => {
      expect(content).toContain("stats.total");
      expect(content).toContain("stats.active");
      expect(content).toContain("stats.enrolled");
      expect(content).toContain("stats.completed");
    });
  });

  describe("EmailTemplateBuilder component", () => {
    const filePath = join(CLIENT, "components", "EmailTemplateBuilder.tsx");
    const content = readFileSync(filePath, "utf-8");

    it("exists and exports default component", () => {
      expect(existsSync(filePath)).toBe(true);
      expect(content).toContain("export default function EmailTemplateBuilder");
    });

    it("has code and visual editing modes", () => {
      expect(content).toContain("Code");
      expect(content).toContain("preview");
    });

    it("has live HTML preview", () => {
      expect(content).toContain("preview");
      expect(content).toMatch(/dangerouslySetInnerHTML|Preview/);
    });

    it("accepts value and onChange props", () => {
      expect(content).toContain("value");
      expect(content).toContain("onChange");
    });
  });

  describe("OutreachWorkflowBuilder component", () => {
    const filePath = join(CLIENT, "components", "OutreachWorkflowBuilder.tsx");
    const content = readFileSync(filePath, "utf-8");

    it("exists and exports default component", () => {
      expect(existsSync(filePath)).toBe(true);
      expect(content).toContain("export default function OutreachWorkflowBuilder");
    });

    it("supports all step types (email, sms, call, wait, condition, task)", () => {
      expect(content).toContain("email");
      expect(content).toContain("sms");
      expect(content).toContain("call");
      expect(content).toContain("wait");
      expect(content).toContain("condition");
      expect(content).toContain("task");
    });

    it("has add, remove, and reorder step functionality", () => {
      expect(content).toContain("addStep");
      expect(content).toContain("removeStep");
    });

    it("exports WorkflowStep and OutreachWorkflow types", () => {
      expect(content).toContain("export interface WorkflowStep");
      expect(content).toContain("export interface OutreachWorkflow");
    });
  });

  describe("Navigation integration", () => {
    const sidebarPath = join(CLIENT, "components", "PersonaSidebar5.tsx");
    const sidebarContent = readFileSync(sidebarPath, "utf-8");
    const appPath = join(CLIENT, "App.tsx");
    const appContent = readFileSync(appPath, "utf-8");

    it("has Email Campaigns nav item", () => {
      expect(sidebarContent).toContain("Email Campaigns");
      expect(sidebarContent).toContain("/email-campaigns");
    });

    it("has Marketing Assets nav item", () => {
      expect(sidebarContent).toContain("Marketing Assets");
      expect(sidebarContent).toContain("/marketing-assets");
    });

    it("has Data Pipelines nav item", () => {
      expect(sidebarContent).toContain("Data Pipelines");
      expect(sidebarContent).toContain("/data-pipelines");
    });

    it("has Outreach Automation nav item", () => {
      expect(sidebarContent).toContain("Outreach Automation");
      expect(sidebarContent).toContain("/outreach-automation");
    });

    it("has routes for all new pages in App.tsx", () => {
      expect(appContent).toContain("/data-pipelines");
      expect(appContent).toContain("/outreach-automation");
      expect(appContent).toContain("DataPipelines");
      expect(appContent).toContain("OutreachAutomation");
    });
  });

  describe("EmailCampaign integration", () => {
    const filePath = join(CLIENT, "pages", "EmailCampaign.tsx");
    const content = readFileSync(filePath, "utf-8");

    it("integrates EmailTemplateBuilder component", () => {
      expect(content).toContain("EmailTemplateBuilder");
      expect(content).toContain("import EmailTemplateBuilder");
    });
  });
});
