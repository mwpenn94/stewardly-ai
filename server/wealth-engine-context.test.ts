/**
 * Pass 122 — WealthEngineContext Structure Test
 * Verifies the context shape and cascade data propagation interface.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("WealthEngineContext", () => {
  const contextPath = path.resolve(__dirname, "../client/src/contexts/WealthEngineContext.tsx");

  it("WealthEngineContext file exists", () => {
    expect(fs.existsSync(contextPath)).toBe(true);
  });

  it("exports useWealthEngine hook", () => {
    const content = fs.readFileSync(contextPath, "utf-8");
    expect(content).toContain("export function useWealthEngine");
  });

  it("exports WealthEngineProvider component", () => {
    const content = fs.readFileSync(contextPath, "utf-8");
    expect(content).toContain("export function WealthEngineProvider");
  });

  it("defines WealthEngineData interface with required fields", () => {
    const content = fs.readFileSync(contextPath, "utf-8");
    // Check for key cascade data fields
    expect(content).toContain("scorecard");
    expect(content).toContain("recommendations");
    expect(content).toContain("client: ClientProfile");
    expect(content).toContain("practiceIncome");
  });

  it("creates context with createContext", () => {
    const content = fs.readFileSync(contextPath, "utf-8");
    expect(content).toContain("createContext");
  });
});

describe("Unified Wealth Engine Panel Structure", () => {
  const calculatorsPath = path.resolve(__dirname, "../client/src/pages/Calculators.tsx");

  it("Calculators.tsx exists", () => {
    expect(fs.existsSync(calculatorsPath)).toBe(true);
  });

  it("contains all navigation groups (Pass 153: PM split into 3 sub-groups, Data merged into References)", () => {
    const content = fs.readFileSync(calculatorsPath, "utf-8");
    expect(content).toContain("PM \u00b7 Business Operations");
    expect(content).toContain("PM \u00b7 Revenue & Growth");
    expect(content).toContain("PM \u00b7 Products & Goals");
    expect(content).toContain("\u2460 Foundation");
    expect(content).toContain("\u2461 Plan");
    expect(content).toContain("\u2462 Protect & Advance");
    expect(content).toContain("\u2463 Grow");
    expect(content).toContain("\u2464 Analyze & Act");
    expect(content).toContain("Tools & Reports");
    expect(content).toContain("Data & References");
  });

  it("contains all 7 new panel IDs in PanelId type (unified-client-plan merged into planning-hierarchy in Pass 151)", () => {
    const content = fs.readFileSync(calculatorsPath, "utf-8");
    const newPanels = [
      "planning-hierarchy",
      "strategy-archetypes",
      "unified-client-plan", // still in PanelId type for legacy redirect
      "firm-comparison",
      "cascade-alerts",
      "advanced-workflows",
      "financial-data-hub",
    ];
    for (const panel of newPanels) {
      expect(content).toContain(`'${panel}'`);
    }
  });

  it("has lazy imports for all 7 new panels", () => {
    const content = fs.readFileSync(calculatorsPath, "utf-8");
    expect(content).toContain("WePlanningHierarchy");
    expect(content).toContain("WeStrategyArchetypes");
    expect(content).toContain("WeUnifiedClientPlan");
    expect(content).toContain("WeFirmComparison");
    expect(content).toContain("WeCascadeAlerts");
    expect(content).toContain("WeAdvancedWorkflows");
    expect(content).toContain("WeFinancialDataHub");
  });

  it("renders all 7 new panels conditionally (unified-client-plan merged into UnifiedPlanMergedPanel in Pass 151)", () => {
    const content = fs.readFileSync(calculatorsPath, "utf-8");
    expect(content).toContain("activePanel === 'planning-hierarchy'");
    expect(content).toContain("activePanel === 'strategy-archetypes'");
    // unified-client-plan is now rendered inside UnifiedPlanMergedPanel (tab toggle)
    expect(content).toContain("UnifiedPlanMergedPanel");
    expect(content).toContain("WeUnifiedClientPlan");
    expect(content).toContain("activePanel === 'firm-comparison'");
    expect(content).toContain("activePanel === 'cascade-alerts'");
    expect(content).toContain("activePanel === 'advanced-workflows'");
    expect(content).toContain("activePanel === 'financial-data-hub'");
  });

  it("imports WealthEngineProvider", () => {
    const content = fs.readFileSync(calculatorsPath, "utf-8");
    expect(content).toContain("WealthEngineProvider");
  });
});

describe("Industry Benchmarks Module", () => {
  const benchmarksPath = path.resolve(__dirname, "../client/src/pages/calculators/industryBenchmarks.ts");

  it("industryBenchmarks.ts exists", () => {
    expect(fs.existsSync(benchmarksPath)).toBe(true);
  });

  it("exports benchmark data", () => {
    const content = fs.readFileSync(benchmarksPath, "utf-8");
    expect(content).toContain("export");
  });
});
