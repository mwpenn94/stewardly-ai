/**
 * SCUI — Stress Testing, Compliance, Historical Data unit tests.
 *
 * All functions under test are PURE — no DB, no network, no side effects.
 * These tests lock in the backtest, stress test, guardrail, and reference
 * data contracts so no future refactor can silently change them.
 */

import { describe, it, expect } from "vitest";
import {
  SP500_HISTORY,
  STRESS_SCENARIOS,
  PRODUCT_REFERENCES,
  METHODOLOGY_DISCLOSURE,
  historicalBacktest,
  stressTest,
  checkGuardrails,
  SCUI,
} from "./scui";
import { INDUSTRY_BENCHMARKS } from "./benchmarks";

// ═══════════════════════════════════════════════════════════════════════════
// SP500_HISTORY
// ═══════════════════════════════════════════════════════════════════════════

describe("SP500_HISTORY", () => {
  it("covers 1928-2025 (98 years)", () => {
    const years = Object.keys(SP500_HISTORY).map(Number);
    expect(years.length).toBe(98);
    expect(Math.min(...years)).toBe(1928);
    expect(Math.max(...years)).toBe(2025);
  });

  it("returns are within reasonable bounds (-50% to +60%)", () => {
    for (const [year, ret] of Object.entries(SP500_HISTORY)) {
      expect(ret).toBeGreaterThanOrEqual(-0.50);
      expect(ret).toBeLessThanOrEqual(0.60);
    }
  });

  it("includes known crisis years", () => {
    expect(SP500_HISTORY[1931]).toBeLessThan(-0.40); // Great Depression
    expect(SP500_HISTORY[2008]).toBeLessThan(-0.35); // GFC
    expect(SP500_HISTORY[2000]).toBeLessThan(0);     // Dot-com
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// STRESS_SCENARIOS
// ═══════════════════════════════════════════════════════════════════════════

describe("STRESS_SCENARIOS", () => {
  it("has 5 scenarios: dotcom, gfc, covid, stagflation, rising_rates", () => {
    expect(Object.keys(STRESS_SCENARIOS)).toEqual(["dotcom", "gfc", "covid", "stagflation", "rising_rates"]);
  });

  it("each scenario has name, years, returns, description", () => {
    for (const [key, scenario] of Object.entries(STRESS_SCENARIOS)) {
      expect(scenario.name).toBeTruthy();
      expect(scenario.years.length).toBeGreaterThan(0);
      expect(scenario.returns.length).toBe(scenario.years.length);
      expect(scenario.description).toBeTruthy();
    }
  });

  it("GFC scenario includes 2008 crash year", () => {
    expect(STRESS_SCENARIOS.gfc.years).toContain(2008);
    const idx = STRESS_SCENARIOS.gfc.years.indexOf(2008);
    expect(STRESS_SCENARIOS.gfc.returns[idx]).toBeLessThan(-0.30);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// historicalBacktest
// ═══════════════════════════════════════════════════════════════════════════

describe("historicalBacktest", () => {
  it("returns a valid summary structure", () => {
    const result = historicalBacktest(100000, 5000, 0, 10);
    expect(result).toHaveProperty("survivalRate");
    expect(result).toHaveProperty("survived");
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("worst");
    expect(result).toHaveProperty("best");
    expect(result).toHaveProperty("medianFinal");
    expect(result).toHaveProperty("allPaths");
  });

  it("survivalRate is between 0 and 1", () => {
    const result = historicalBacktest(100000, 5000, 0, 10);
    expect(result.survivalRate).toBeGreaterThanOrEqual(0);
    expect(result.survivalRate).toBeLessThanOrEqual(1);
  });

  it("total = survived + failed", () => {
    const result = historicalBacktest(100000, 0, 0, 20);
    const failed = result.total - result.survived;
    expect(failed).toBeGreaterThanOrEqual(0);
  });

  it("all paths have correct length (horizon + 1 including start)", () => {
    const horizon = 15;
    const result = historicalBacktest(100000, 0, 0, horizon);
    for (const p of result.allPaths) {
      expect(p.path.length).toBe(horizon + 1);
      expect(p.path[0]).toBe(100000);
    }
  });

  it("worst.final <= medianFinal <= best.final", () => {
    const result = historicalBacktest(100000, 5000, 0, 20);
    expect(result.worst.final).toBeLessThanOrEqual(result.medianFinal);
    expect(result.medianFinal).toBeLessThanOrEqual(result.best.final);
  });

  it("high cost drains balances (lower survival rate)", () => {
    const low = historicalBacktest(100000, 0, 50000, 20);
    const high = historicalBacktest(100000, 0, 0, 20);
    expect(low.survivalRate).toBeLessThanOrEqual(high.survivalRate);
  });

  it("handles short horizon (1 year)", () => {
    const result = historicalBacktest(100000, 0, 0, 1);
    expect(result.total).toBeGreaterThan(0);
    expect(result.allPaths[0].path.length).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// stressTest
// ═══════════════════════════════════════════════════════════════════════════

describe("stressTest", () => {
  it("returns null for unknown scenario", () => {
    expect(stressTest("nonexistent", 100000)).toBeNull();
  });

  it("returns valid result for GFC", () => {
    const result = stressTest("gfc", 1000000);
    expect(result).not.toBeNull();
    expect(result!.scenario.name).toContain("Financial Crisis");
    expect(result!.path.length).toBe(6); // start + 5 years
    expect(result!.path[0]).toBe(1000000);
    expect(result!.maxDrawdown).toBeGreaterThan(0);
    expect(result!.recoveryYears).toBeGreaterThanOrEqual(0);
  });

  it("GFC causes significant drawdown", () => {
    const result = stressTest("gfc", 1000000);
    expect(result!.maxDrawdown).toBeGreaterThan(0.25); // At least 25% drawdown
  });

  it("contributions reduce impact", () => {
    const noContrib = stressTest("gfc", 500000, 0, 0);
    const withContrib = stressTest("gfc", 500000, 50000, 0);
    expect(withContrib!.finalBalance).toBeGreaterThan(noContrib!.finalBalance);
  });

  it("costs increase impact", () => {
    const noCost = stressTest("gfc", 500000, 0, 0);
    const withCost = stressTest("gfc", 500000, 0, 50000);
    expect(withCost!.finalBalance).toBeLessThan(noCost!.finalBalance);
  });

  it("dotcom and covid scenarios also work", () => {
    const dotcom = stressTest("dotcom", 100000);
    const covid = stressTest("covid", 100000);
    expect(dotcom).not.toBeNull();
    expect(covid).not.toBeNull();
    expect(dotcom!.path.length).toBe(6); // 5 years + start
    expect(covid!.path.length).toBe(6);
  });

  it("balance never goes below 0", () => {
    const result = stressTest("gfc", 1000, 0, 50000);
    for (const val of result!.path) {
      expect(val).toBeGreaterThanOrEqual(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// checkGuardrails
// ═══════════════════════════════════════════════════════════════════════════

describe("checkGuardrails", () => {
  it("returns empty array for reasonable params", () => {
    const warnings = checkGuardrails({
      returnRate: 0.07,
      savingsRate: 0.15,
      growthRate: 0.10,
      inflationRate: 0.03,
      taxRate: 0.25,
    });
    expect(warnings).toEqual([]);
  });

  it("warns on high return rate", () => {
    const warnings = checkGuardrails({ returnRate: 0.15 });
    expect(warnings.length).toBe(1);
    expect(warnings[0].field).toBe("returnRate");
    expect(warnings[0].severity).toBe("warning");
    expect(warnings[0].threshold).toBe(0.12);
  });

  it("warns on high savings rate", () => {
    const warnings = checkGuardrails({ savingsRate: 0.60 });
    expect(warnings.length).toBe(1);
    expect(warnings[0].field).toBe("savingsRate");
    expect(warnings[0].severity).toBe("info");
  });

  it("detects multiple violations", () => {
    const warnings = checkGuardrails({
      returnRate: 0.20,
      savingsRate: 0.60,
      taxRate: 0.55,
    });
    expect(warnings.length).toBe(3);
    const fields = warnings.map(w => w.field);
    expect(fields).toContain("returnRate");
    expect(fields).toContain("savingsRate");
    expect(fields).toContain("taxRate");
  });

  it("includes value and threshold in each warning", () => {
    const warnings = checkGuardrails({ returnRate: 0.18 });
    expect(warnings[0].value).toBe(0.18);
    expect(warnings[0].threshold).toBe(0.12);
    expect(warnings[0].message).toBeTruthy();
  });

  it("ignores undefined/missing params", () => {
    const warnings = checkGuardrails({});
    expect(warnings).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// REFERENCE DATA
// ═══════════════════════════════════════════════════════════════════════════

describe("reference data", () => {
  it("PRODUCT_REFERENCES has all 14 product types", () => {
    const keys = Object.keys(PRODUCT_REFERENCES);
    expect(keys.length).toBe(14);
    expect(keys).toContain("term");
    expect(keys).toContain("iul");
    expect(keys).toContain("wl");
    expect(keys).toContain("premfin");
    expect(keys).toContain("estate");
  });

  it("each product reference has src, url, benchmark", () => {
    for (const [key, ref] of Object.entries(PRODUCT_REFERENCES)) {
      expect(ref.src).toBeTruthy();
      expect(ref.url).toMatch(/^https?:\/\//);
      expect(ref.benchmark).toBeTruthy();
    }
  });

  it("INDUSTRY_BENCHMARKS has key metrics", () => {
    expect(INDUSTRY_BENCHMARKS).toHaveProperty("savingsRate");
    expect(INDUSTRY_BENCHMARKS).toHaveProperty("advisorAlpha");
    expect(INDUSTRY_BENCHMARKS).toHaveProperty("avgAdvisoryFee");
    expect(INDUSTRY_BENCHMARKS.savingsRate.national).toBe(0.062);
  });

  it("METHODOLOGY_DISCLOSURE has all engine keys", () => {
    expect(METHODOLOGY_DISCLOSURE).toHaveProperty("uwe");
    expect(METHODOLOGY_DISCLOSURE).toHaveProperty("bie");
    expect(METHODOLOGY_DISCLOSURE).toHaveProperty("he");
    expect(METHODOLOGY_DISCLOSURE).toHaveProperty("mc");
    expect(METHODOLOGY_DISCLOSURE).toHaveProperty("pf");
    expect(METHODOLOGY_DISCLOSURE).toHaveProperty("disclaimer");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SCUI PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

describe("SCUI public API", () => {
  it("getStressScenarioKeys returns 5 keys", () => {
    expect(SCUI.getStressScenarioKeys()).toEqual(["dotcom", "gfc", "covid", "stagflation", "rising_rates"]);
  });

  it("getProductReferenceKeys returns 14 keys", () => {
    expect(SCUI.getProductReferenceKeys().length).toBe(14);
  });

  it("getBenchmarkKeys returns benchmark keys", () => {
    const keys = SCUI.getBenchmarkKeys();
    expect(keys.length).toBeGreaterThan(0);
    expect(keys).toContain("savingsRate");
  });
});
