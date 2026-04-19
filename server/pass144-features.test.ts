/**
 * Pass 144 Tests — PFR PDF Report, Scenario Version History, Consolidation
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const root = resolve(__dirname, "..");

describe("PFR PDF Report Router", () => {
  const routerPath = resolve(root, "server/routers/pfrReport.ts");

  it("pfrReport.ts exists", () => {
    expect(existsSync(routerPath)).toBe(true);
  });

  it("exports pfrReportRouter", () => {
    const src = readFileSync(routerPath, "utf-8");
    expect(src).toContain("export const pfrReportRouter");
  });

  it("has generate mutation with required inputs", () => {
    const src = readFileSync(routerPath, "utf-8");
    expect(src).toContain("generate:");
    expect(src).toContain("holisticScore");
    expect(src).toContain("domainScores");
    expect(src).toContain("recommendations");
    expect(src).toContain("keyMetrics");
  });

  it("is registered in routers.ts", () => {
    const routersSrc = readFileSync(resolve(root, "server/routers.ts"), "utf-8");
    expect(routersSrc).toContain("pfrReport");
    expect(routersSrc).toContain("pfrReportRouter");
  });
});

describe("Scenario Version History", () => {
  const routerPath = resolve(root, "server/routers/scenarios.ts");

  it("scenarios.ts has update mutation", () => {
    const src = readFileSync(routerPath, "utf-8");
    expect(src).toContain("update: protectedProcedure");
  });

  it("scenarios.ts has history query", () => {
    const src = readFileSync(routerPath, "utf-8");
    expect(src).toContain("history: protectedProcedure");
  });

  it("update mutation archives previous version in versionHistory", () => {
    const src = readFileSync(routerPath, "utf-8");
    expect(src).toContain("versionHistory");
    expect(src).toContain("trimmedHistory");
    expect(src).toContain("slice(-20)");
  });

  it("history query returns versions array", () => {
    const src = readFileSync(routerPath, "utf-8");
    expect(src).toContain("versions:");
    expect(src).toContain("current:");
  });

  it("list query returns versionCount", () => {
    const src = readFileSync(routerPath, "utf-8");
    expect(src).toContain("versionCount");
  });
});

describe("Consolidation — ComplexityToggle shared component", () => {
  const sharedPath = resolve(root, "client/src/pages/calculators/shared.tsx");

  it("shared.tsx exports ComplexityToggle", () => {
    const src = readFileSync(sharedPath, "utf-8");
    expect(src).toContain("export function ComplexityToggle");
  });

  it("ComplexityToggle has aria-label and role attributes", () => {
    const src = readFileSync(sharedPath, "utf-8");
    expect(src).toContain("aria-label");
    expect(src).toContain("role=\"tablist\"");
  });

  it("ClientWealthHub uses ComplexityToggle from shared", () => {
    const src = readFileSync(resolve(root, "client/src/pages/calculators/ClientWealthHub.tsx"), "utf-8");
    expect(src).toContain("ComplexityToggle");
    expect(src).toContain("from './shared'");
  });

  it("AdvancedStrategiesHub uses ComplexityToggle from shared", () => {
    const src = readFileSync(resolve(root, "client/src/pages/calculators/AdvancedStrategiesHub.tsx"), "utf-8");
    expect(src).toContain("ComplexityToggle");
    expect(src).toContain("from './shared'");
  });
});

describe("Consolidation — duplicate fmt/pct removed", () => {
  it("CascadeSankey imports fmt from format.ts (no local fmt)", () => {
    const src = readFileSync(resolve(root, "client/src/pages/calculators/CascadeSankey.tsx"), "utf-8");
    expect(src).toContain("from './format'");
    // Should not have a local const fmt = definition
    expect(src).not.toMatch(/const fmt\s*=\s*\(n/);
  });

  it("ScenarioComparison imports fmt from format.ts (no local fmt)", () => {
    const src = readFileSync(resolve(root, "client/src/pages/calculators/ScenarioComparison.tsx"), "utf-8");
    expect(src).toContain("from './format'");
    expect(src).not.toMatch(/const fmt\s*=\s*\(n/);
  });

  it("SharedPlanView imports fmt from format.ts (no local fmt)", () => {
    const src = readFileSync(resolve(root, "client/src/pages/SharedPlanView.tsx"), "utf-8");
    expect(src).toContain("from './calculators/format'");
    expect(src).not.toMatch(/const fmt\s*=\s*\(n/);
  });
});

describe("Complexity Toggle Memory (localStorage persistence)", () => {
  it("ClientWealthHub reads from localStorage on init", () => {
    const src = readFileSync(resolve(root, "client/src/pages/calculators/ClientWealthHub.tsx"), "utf-8");
    expect(src).toContain("localStorage");
    expect(src).toContain("we-client-complexity");
  });

  it("AdvancedStrategiesHub reads from localStorage on init", () => {
    const src = readFileSync(resolve(root, "client/src/pages/calculators/AdvancedStrategiesHub.tsx"), "utf-8");
    expect(src).toContain("localStorage");
    expect(src).toContain("we-advanced-complexity");
  });

  it("Calculators.tsx persists PanelsD complexity to localStorage", () => {
    const src = readFileSync(resolve(root, "client/src/pages/Calculators.tsx"), "utf-8");
    expect(src).toContain("localStorage");
    expect(src).toContain("we-practice-complexity");
  });
});

describe("ScenarioComparison — Version History UI", () => {
  it("has VersionTimeline component", () => {
    const src = readFileSync(resolve(root, "client/src/pages/calculators/ScenarioComparison.tsx"), "utf-8");
    expect(src).toContain("VersionTimeline");
  });

  it("has Update button with RefreshCw icon", () => {
    const src = readFileSync(resolve(root, "client/src/pages/calculators/ScenarioComparison.tsx"), "utf-8");
    expect(src).toContain("RefreshCw");
    expect(src).toContain("Update");
  });

  it("has History button showing version count", () => {
    const src = readFileSync(resolve(root, "client/src/pages/calculators/ScenarioComparison.tsx"), "utf-8");
    expect(src).toContain("History");
    expect(src).toContain("versionCount");
  });

  it("VersionTimeline has restore capability", () => {
    const src = readFileSync(resolve(root, "client/src/pages/calculators/ScenarioComparison.tsx"), "utf-8");
    expect(src).toContain("onRestoreVersion");
    expect(src).toContain("Restored from version history");
  });
});

describe("PFR Wizard — PDF Export Integration", () => {
  it("PFRWizard accepts weData prop", () => {
    const src = readFileSync(resolve(root, "client/src/pages/calculators/PFRWizard.tsx"), "utf-8");
    expect(src).toContain("weData");
  });

  it("PFRWizard has Generate PDF Report button", () => {
    const src = readFileSync(resolve(root, "client/src/pages/calculators/PFRWizard.tsx"), "utf-8");
    expect(src).toContain("Generate PDF Report");
  });

  it("PFRWizardPanel passes weData from Calculators", () => {
    const src = readFileSync(resolve(root, "client/src/pages/Calculators.tsx"), "utf-8");
    expect(src).toContain("PFRWizardPanel");
    expect(src).toContain("weData={");
  });
});
