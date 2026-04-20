/**
 * Pass 133 — Depth Pass: Cascade Flow, Inline Benchmarks, Cross-Hub UX
 *
 * Tests validate:
 * 1. InlineBenchmark and BenchmarkGrid component exports exist
 * 2. CascadeFlowIndicator component exports exist
 * 3. WealthEngineContext exports are correct
 * 4. Industry benchmark data is valid and has sources
 * 5. WealthEngineHub is properly routed (not commented out)
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname, join } from "path";

const ROOT = resolve(__dirname, "..");

describe("Pass 133 — Depth Pass Components", () => {
  describe("InlineBenchmark component", () => {
    const filePath = resolve(ROOT, "client/src/components/InlineBenchmark.tsx");

    it("exists", () => {
      expect(existsSync(filePath)).toBe(true);
    });

    it("exports InlineBenchmark, BenchmarkBar, and BenchmarkGrid", () => {
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("export function InlineBenchmark");
      expect(content).toContain("export function BenchmarkBar");
      expect(content).toContain("export function BenchmarkGrid");
    });

    it("BenchmarkGrid renders items with source citations", () => {
      const content = readFileSync(filePath, "utf-8");
      // BenchmarkGrid should render source text for each item
      expect(content).toContain("item.source");
      // Should support expandable items ("+N more" pattern)
      expect(content).toContain("expanded");
    });
  });

  describe("CascadeFlowIndicator component", () => {
    const filePath = resolve(ROOT, "client/src/components/CascadeFlowIndicator.tsx");

    it("exists", () => {
      expect(existsSync(filePath)).toBe(true);
    });

    it("exports CascadeFlowIndicator and CascadeStage type", () => {
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("export function CascadeFlowIndicator");
      expect(content).toContain("export interface CascadeStage");
    });

    it("supports complete/active/pending/warning statuses", () => {
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain('"complete"');
      expect(content).toContain('"active"');
      expect(content).toContain('"pending"');
      expect(content).toContain('"warning"');
    });

    it("renders flow arrows between stages", () => {
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("ArrowRight");
      expect(content).toContain("flowLabel");
    });
  });

  describe("WealthEngineContext", () => {
    const filePath = resolve(ROOT, "client/src/contexts/WealthEngineContext.tsx");

    it("exists", () => {
      expect(existsSync(filePath)).toBe(true);
    });

    it("exports WealthEngineProvider and useWealthEngine", () => {
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("export function WealthEngineProvider");
      expect(content).toContain("export function useWealthEngine");
    });

    it("exports DEFAULT_DATA with all required fields", () => {
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("DEFAULT_DATA");
      // Verify all cascade data fields exist
      expect(content).toContain("scorecard:");
      expect(content).toContain("cfResult:");
      expect(content).toContain("prResult:");
      expect(content).toContain("grResult:");
      expect(content).toContain("rtResult:");
      expect(content).toContain("txResult:");
      expect(content).toContain("esResult:");
      expect(content).toContain("edResult:");
      expect(content).toContain("practiceIncome:");
    });
  });

  describe("WealthEngineHub integration", () => {
    const hubPath = resolve(ROOT, "client/src/pages/wealth-engine/WealthEngineHub.tsx");

    it("exists", () => {
      expect(existsSync(hubPath)).toBe(true);
    });

    it("imports WealthEngineProvider", () => {
      const content = readFileSync(hubPath, "utf-8");
      expect(content).toContain("WealthEngineProvider");
    });

    it("imports CascadeFlowIndicator", () => {
      const content = readFileSync(hubPath, "utf-8");
      expect(content).toContain("CascadeFlowIndicator");
    });

    it("imports BenchmarkGrid", () => {
      const content = readFileSync(hubPath, "utf-8");
      expect(content).toContain("BenchmarkGrid");
    });

    it("imports industry benchmark data", () => {
      const content = readFileSync(hubPath, "utf-8");
      expect(content).toContain("PROTECTION_BENCHMARKS");
      expect(content).toContain("RETIREMENT_BENCHMARKS");
      expect(content).toContain("PRACTICE_BENCHMARKS");
    });

    it("Calculators (Unified Wealth Engine) is routed at /wealth-engine in App.tsx", () => {
      const appContent = readFileSync(resolve(ROOT, "client/src/App.tsx"), "utf-8");
      // Calculators should be imported (not WealthEngineHub)
      expect(appContent).toMatch(/const Calculators = lazy/);
      // Should have an active route at /wealth-engine rendering Calculators
      expect(appContent).toContain('<Calculators />');
      // WealthEngineHub should be commented out (it's a shallow shell)
      expect(appContent).toMatch(/\/\/\s*const WealthEngineHub/);
    });
  });

  describe("ClientWealthHub — Unified Client Wealth Planning Hub", () => {
    const filePath = resolve(ROOT, "client/src/pages/calculators/ClientWealthHub.tsx");

    it("exists", () => {
      expect(existsSync(filePath)).toBe(true);
    });

    it("exports ClientWealthHub with PanelProps signature", () => {
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("export function ClientWealthHub");
      expect(content).toContain("PanelProps");
    });

    it("has target-driven retirement goal with forward cascade", () => {
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("retirementGoal");
      expect(content).toContain("setRetirementGoal");
    });

    it("has domain allocation sliders with drag-to-rebalance", () => {
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("domainAllocation");
      expect(content).toContain("setDomainAllocation");
      expect(content).toContain("DomainSlider");
      // cursor-grab is now in shared-ui.tsx AllocationSlider (Pass 145 consolidation)
      const sharedUi = readFileSync(join(dirname(filePath), "shared-ui.tsx"), "utf-8");
      expect(sharedUi).toContain("cursor-grab");
    });

    it("has back-solve section", () => {
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("Back-Solve");
      expect(content).toContain("requiredSaveRate");
      expect(content).toContain("requiredMonthly");
    });

    it("has sensitivity analysis with Recharts bar chart", () => {
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("Sensitivity Analysis");
      expect(content).toContain("BarChart");
      expect(content).toContain("impactOnWealth");
    });

    it("has time-phased projections with Recharts area chart", () => {
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("Wealth Timeline");
      expect(content).toContain("AreaChart");
      expect(content).toContain("totalWealth");
    });

    it("has cross-domain cascade summary", () => {
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("Cross-Domain Cascade");
      expect(content).toContain("ArrowRight");
    });

    it("has allocation pie chart", () => {
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("PieChart");
      expect(content).toContain("Allocation Breakdown");
    });

    it("uses engine functions for calculations", () => {
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("calcUnifiedClientPlan");
      expect(content).toContain("calcClientSensitivity");
      expect(content).toContain("calcClientTimePhasedProjections");
    });

    it("is wired into Calculators.tsx nav and panel switch", () => {
      const calcContent = readFileSync(resolve(ROOT, "client/src/pages/Calculators.tsx"), "utf-8");
      expect(calcContent).toContain("client-wealth-hub");
      expect(calcContent).toContain("ClientWealthHub");
      // Should appear in the nav section under Foundation group
      expect(calcContent).toContain("Client Wealth Hub");
      // Should be rendered in the panel switch
      expect(calcContent).toContain("activePanel === 'client-wealth-hub'");
    });
  });

  describe("Engine functions for ClientWealthHub", () => {
    const filePath = resolve(ROOT, "client/src/pages/calculators/engine.ts");

    it("exports calcUnifiedClientPlan", () => {
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("export function calcUnifiedClientPlan");
    });

    it("exports calcClientSensitivity", () => {
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("export function calcClientSensitivity");
    });

    it("exports calcClientTimePhasedProjections", () => {
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("export function calcClientTimePhasedProjections");
    });

    it("exports UnifiedClientPlan interface", () => {
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("export interface UnifiedClientPlan");
    });

    it("exports ClientSensitivityResult interface", () => {
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("export interface ClientSensitivityResult");
    });

    it("exports ClientTimeProjection interface", () => {
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("export interface ClientTimeProjection");
    });
  });

  describe("Industry benchmarks data", () => {
    const filePath = resolve(ROOT, "client/src/pages/calculators/industryBenchmarks.ts");

    it("exists", () => {
      expect(existsSync(filePath)).toBe(true);
    });

    it("exports required benchmark categories", () => {
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("PROTECTION_BENCHMARKS");
      expect(content).toContain("RETIREMENT_BENCHMARKS");
      expect(content).toContain("PRACTICE_BENCHMARKS");
      expect(content).toContain("PLANNING_BENCHMARKS");
      expect(content).toContain("TAX_BENCHMARKS");
      expect(content).toContain("ESTATE_BENCHMARKS");
    });
  });

  describe("Learning hub benchmarks", () => {
    const filePath = resolve(ROOT, "client/src/pages/learning/LearningHome.tsx");

    it("imports BenchmarkGrid", () => {
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("BenchmarkGrid");
    });

    it("includes exam pass rate benchmarks", () => {
      const content = readFileSync(filePath, "utf-8");
      // Should reference FINRA exam data
      expect(content).toContain("SIE");
      expect(content).toContain("Series 7");
    });
  });

  describe("Command Center hub benchmarks", () => {
    const filePath = resolve(ROOT, "client/src/pages/PeopleHub.tsx");

    it("imports BenchmarkGrid", () => {
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("BenchmarkGrid");
    });

    it("includes advisory practice benchmarks", () => {
      const content = readFileSync(filePath, "utf-8");
      // Should reference CAC, LTV, conversion data
      expect(content).toContain("CAC");
      expect(content).toContain("LTV");
    });

    it("has breadcrumb navigation", () => {
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("Home");
      expect(content).toContain("ChevronRight");
    });
  });
});
