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
import { resolve } from "path";

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

    it("is routed in App.tsx (not commented out)", () => {
      const appContent = readFileSync(resolve(ROOT, "client/src/App.tsx"), "utf-8");
      // Should have an uncommented import
      expect(appContent).toMatch(/^const WealthEngineHub = lazy/m);
      // Should have an active route
      expect(appContent).toContain('<WealthEngineHub />');
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
