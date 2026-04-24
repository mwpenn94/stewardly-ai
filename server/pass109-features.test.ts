/**
 * Pass 109 — Feature tests for WorkflowAutomation, EnrichmentAdmin,
 * PortalAnalytics, SovereignStudy pages + navigation wiring.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const CLIENT = path.resolve(__dirname, "../client/src");
const PAGES = path.join(CLIENT, "pages");

describe("Pass 109 — New page files exist", () => {
  const pages = [
    "WorkflowAutomation.tsx",
    "EnrichmentAdmin.tsx",
    "PortalAnalytics.tsx",
    "SovereignStudy.tsx",
  ];
  pages.forEach((p) => {
    it(`${p} exists`, () => {
      expect(fs.existsSync(path.join(PAGES, p))).toBe(true);
    });
  });
});

describe("Pass 109 — WorkflowAutomation page wiring", () => {
  const src = fs.readFileSync(path.join(PAGES, "WorkflowAutomation.tsx"), "utf8");
  it("imports trpc", () => expect(src).toContain("from \"@/lib/trpc\""));
  it("uses trpc.workflowAutomation.chains.list", () => expect(src).toContain("workflowAutomation.chains.list"));
  it("uses trpc.workflowAutomation.executions.list", () => expect(src).toContain("workflowAutomation.executions.list"));
  it("uses trpc.workflowAutomation.checkpoints.list", () => expect(src).toContain("workflowAutomation.checkpoints.list"));
  it("uses trpc.workflowAutomation.chains.create mutation", () => expect(src).toContain("workflowAutomation.chains.create.useMutation"));
  it("uses trpc.workflowAutomation.chains.toggle mutation", () => expect(src).toContain("workflowAutomation.chains.toggle.useMutation"));
  it("uses trpc.workflowAutomation.chains.remove mutation", () => expect(src).toContain("workflowAutomation.chains.remove.useMutation"));
  it("uses trpc.workflowAutomation.checkpoints.restore mutation", () => expect(src).toContain("workflowAutomation.checkpoints.restore.useMutation"));
  it("has Chains tab", () => expect(src).toContain("Chains"));
  it("has Executions tab", () => expect(src).toContain("Executions"));
  it("has Checkpoints tab", () => expect(src).toContain("Checkpoints"));
  it("has create chain dialog", () => expect(src).toContain("Create Event Chain"));
});

describe("Pass 109 — EnrichmentAdmin page wiring", () => {
  const src = fs.readFileSync(path.join(PAGES, "EnrichmentAdmin.tsx"), "utf8");
  it("imports trpc", () => expect(src).toContain("from \"@/lib/trpc\""));
  it("uses trpc.enrichmentEngine.datasets.list", () => expect(src).toContain("enrichmentEngine.datasets.list"));
  it("uses trpc.enrichmentEngine.cohorts.list", () => expect(src).toContain("enrichmentEngine.cohorts.list"));
  it("uses trpc.enrichmentEngine.matches.list", () => expect(src).toContain("enrichmentEngine.matches.list"));
  it("uses trpc.enrichmentEngine.datasets.create mutation", () => expect(src).toContain("enrichmentEngine.datasets.create.useMutation"));
  it("uses trpc.enrichmentEngine.datasets.remove mutation", () => expect(src).toContain("enrichmentEngine.datasets.remove.useMutation"));
  it("uses trpc.enrichmentEngine.cohorts.create mutation", () => expect(src).toContain("enrichmentEngine.cohorts.create.useMutation"));
  it("has Datasets tab", () => expect(src).toContain("Datasets"));
  it("has Cohorts tab", () => expect(src).toContain("Cohorts"));
  it("has My Matches tab", () => expect(src).toContain("My Matches"));
});

describe("Pass 109 — PortalAnalytics page wiring", () => {
  const src = fs.readFileSync(path.join(PAGES, "PortalAnalytics.tsx"), "utf8");
  it("imports trpc", () => expect(src).toContain("from \"@/lib/trpc\""));
  it("uses trpc.portalOptimizer.engagement", () => expect(src).toContain("portalOptimizer.engagement"));
  it("uses trpc.portalOptimizer.healthMetrics", () => expect(src).toContain("portalOptimizer.healthMetrics"));
  it("uses trpc.portalOptimizer.trackEvent mutation", () => expect(src).toContain("portalOptimizer.trackEvent.useMutation"));
  it("has Overview tab", () => expect(src).toContain("Overview"));
  it("has Event Log tab", () => expect(src).toContain("Event Log"));
  it("has Top Features tab", () => expect(src).toContain("Top Features"));
  it("shows event type distribution", () => expect(src).toContain("Event Type Distribution"));
  it("shows platform health", () => expect(src).toContain("Platform Health"));
});

describe("Pass 109 — SovereignStudy page", () => {
  const src = fs.readFileSync(path.join(PAGES, "SovereignStudy.tsx"), "utf8");
  it("imports trpc", () => expect(src).toContain("from \"@/lib/trpc\""));
  it("has Study Home tab", () => expect(src).toContain("Study Home"));
  it("has Calculator Lab tab", () => expect(src).toContain("Calculator Lab"));
  it("has Concept Explorer tab", () => expect(src).toContain("Concept Explorer"));
  it("has 9 financial domains", () => expect(src).toContain("Cash Flow"));
  it("includes DIME method", () => expect(src).toContain("DIME"));
  it("includes future value calculation", () => expect(src).toContain("Future value"));
  it("has interactive sliders", () => expect(src).toContain("Slider"));
  it("links to full calculators", () => expect(src).toContain("/calculators"));
  it("links to learning hub", () => expect(src).toContain("/learning"));
  it("has reference library section", () => expect(src).toContain("Reference Library"));
  it("has domain mastery progress", () => expect(src).toContain("Domain Mastery"));
  it("uses trpc.learning.mastery.summary", () => expect(src).toContain("learning.mastery.summary"));
});

describe("Pass 109 — App.tsx routing", () => {
  const src = fs.readFileSync(path.join(CLIENT, "App.tsx"), "utf8");
  it("lazy imports WorkflowAutomation", () => expect(src).toContain("import(\"./pages/WorkflowAutomation\")"));
  it("lazy imports EnrichmentAdmin", () => expect(src).toContain("import(\"./pages/EnrichmentAdmin\")"));
  it("lazy imports PortalAnalytics", () => expect(src).toContain("import(\"./pages/PortalAnalytics\")"));
  it("lazy imports SovereignStudy", () => expect(src).toContain("import(\"./pages/SovereignStudy\")"));
  it("has /workflow-automation route", () => expect(src).toContain("/workflow-automation"));
  it("has /enrichment-admin route", () => expect(src).toContain("/enrichment-admin"));
  it("has /portal-analytics route", () => expect(src).toContain("/portal-analytics"));
  it("has /sovereign-study route", () => expect(src).toContain("/sovereign-study"));
});

describe("Pass 109 — Navigation entries", () => {
  const nav = fs.readFileSync(path.join(CLIENT, "lib/navigation.ts"), "utf8");
  it("has Workflow Automation in ADMIN_NAV", () => expect(nav).toContain("/workflow-automation"));
  it("has Enrichment Engine in ADMIN_NAV", () => expect(nav).toContain("/enrichment-admin"));
  it("has Portal Analytics in ADMIN_NAV", () => expect(nav).toContain("/portal-analytics"));
  it("has Sovereign Study in TOOLS_NAV learning section", () => expect(nav).toContain("/sovereign-study"));
});

describe("Pass 109 — CommandPalette ICON_MAP", () => {
  const src = fs.readFileSync(path.join(CLIENT, "components/CommandPalette.tsx"), "utf8");
  it("has Workflow icon", () => expect(src).toContain("Workflow:"));
  it("has Layers icon", () => expect(src).toContain("Layers:"));
  it("has Gauge icon", () => expect(src).toContain("Gauge:"));
});
