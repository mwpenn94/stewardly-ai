/**
 * Sensitivity sweep + guardrails test suite.
 *
 * Tests the parameter application logic, grid generation, and guardrail
 * validation that power the What-If Sensitivity page and the Reference Hub
 * guardrails tab.
 */

import { describe, it, expect } from "vitest";

import {
  createHolisticStrategy,
  heSimulate,
  checkGuardrail,
  GUARDRAILS,
  INDUSTRY_BENCHMARKS,
  METHODOLOGY_DISCLOSURE,
  PRODUCT_REFERENCES,
} from "..";

import {
  historicalBacktest,
  stressTest,
  SP500_HISTORY,
  STRESS_SCENARIOS,
} from "../scui";

// ═══════════════════════════════════════════════════════════════════════════
// Group A — Guardrail validation
// ═══════════════════════════════════════════════════════════════════════════

describe("Guardrail validation", () => {
  it("returns null for valid values within range", () => {
    expect(checkGuardrail("returnRate", 0.07)).toBeNull();
    expect(checkGuardrail("savingsRate", 0.15)).toBeNull();
    expect(checkGuardrail("inflationRate", 0.03)).toBeNull();
  });

  it("returns error for values below minimum", () => {
    const check = checkGuardrail("returnRate", -0.1);
    expect(check).not.toBeNull();
    expect(check!.type).toBe("error");
  });

  it("returns error for values above maximum", () => {
    const check = checkGuardrail("returnRate", 0.20);
    expect(check).not.toBeNull();
    expect(check!.type).toBe("error");
  });

  it("returns warn for values near the max threshold", () => {
    // 80% of 0.15 max = 0.12
    const check = checkGuardrail("returnRate", 0.13);
    expect(check).not.toBeNull();
    expect(check!.type).toBe("warn");
  });

  it("returns null for unknown guardrail keys", () => {
    expect(checkGuardrail("nonexistent", 0.5)).toBeNull();
  });

  it("covers all 6 guardrail keys", () => {
    const keys = Object.keys(GUARDRAILS);
    expect(keys.length).toBe(6);
    expect(keys).toContain("returnRate");
    expect(keys).toContain("savingsRate");
    expect(keys).toContain("inflationRate");
    expect(keys).toContain("aumFee");
    expect(keys).toContain("loanRate");
    expect(keys).toContain("creditingRate");
  });

  it("every guardrail has label, min, max, default, warn", () => {
    for (const [key, rule] of Object.entries(GUARDRAILS)) {
      expect(rule).toHaveProperty("label");
      expect(rule).toHaveProperty("min");
      expect(rule).toHaveProperty("max");
      expect(rule).toHaveProperty("default");
      expect(rule).toHaveProperty("warn");
      expect(rule.min).toBeLessThan(rule.max);
      expect(rule.default).toBeGreaterThanOrEqual(rule.min);
      expect(rule.default).toBeLessThanOrEqual(rule.max);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Group B — Sensitivity sweep grid generation
// ═══════════════════════════════════════════════════════════════════════════

describe("Sensitivity sweep grid logic", () => {
  it("generates correct step values for a linear range", () => {
    const steps = 5;
    const range: [number, number] = [0, 1];
    const values = Array.from({ length: steps }, (_, i) =>
      range[0] + (i * (range[1] - range[0])) / (steps - 1),
    );
    expect(values).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });

  it("generates correct step values for a non-zero range", () => {
    const steps = 3;
    const range: [number, number] = [0.05, 0.40];
    const values = Array.from({ length: steps }, (_, i) =>
      range[0] + (i * (range[1] - range[0])) / (steps - 1),
    );
    expect(values[0]).toBeCloseTo(0.05);
    expect(values[1]).toBeCloseTo(0.225);
    expect(values[2]).toBeCloseTo(0.40);
  });

  it("produces a 3x3 grid via the HE engine", () => {
    const profile = { age: 40, income: 150000, savings: 50000 };
    const grid: number[][] = [];
    const savingsRates = [0.05, 0.15, 0.30];
    const returnRates = [0.03, 0.07, 0.12];

    for (const sr of savingsRates) {
      const row: number[] = [];
      for (const rr of returnRates) {
        const strategy = createHolisticStrategy("sweep", {
          profile,
          companyKey: "wealthbridge",
          savingsRate: sr,
          investmentReturn: rr,
          hasBizIncome: false,
        });
        const snapshots = heSimulate(strategy, 10);
        const final = snapshots[snapshots.length - 1];
        row.push(Math.round(final.totalValue));
      }
      grid.push(row);
    }

    // Grid should be 3x3
    expect(grid.length).toBe(3);
    expect(grid[0].length).toBe(3);

    // Higher savings rate → higher or equal total value (same column)
    expect(grid[2][1]).toBeGreaterThanOrEqual(grid[0][1]);

    // Higher return → higher or equal total value (same row)
    expect(grid[1][2]).toBeGreaterThanOrEqual(grid[1][0]);

    // All values should be positive
    for (const row of grid) {
      for (const val of row) {
        expect(val).toBeGreaterThan(0);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Group C — Reference data integrity
// ═══════════════════════════════════════════════════════════════════════════

describe("Reference data integrity", () => {
  it("PRODUCT_REFERENCES covers all 14 product types", () => {
    const types = Object.keys(PRODUCT_REFERENCES);
    expect(types.length).toBe(14);
    expect(types).toContain("term");
    expect(types).toContain("iul");
    expect(types).toContain("premfin");
    expect(types).toContain("deferredcomp");
  });

  it("every product reference has src and benchmark", () => {
    for (const [type, ref] of Object.entries(PRODUCT_REFERENCES)) {
      expect(ref.src).toBeTruthy();
      expect(ref.benchmark).toBeTruthy();
    }
  });

  it("INDUSTRY_BENCHMARKS has expected keys", () => {
    expect(INDUSTRY_BENCHMARKS).toHaveProperty("savingsRate");
    expect(INDUSTRY_BENCHMARKS).toHaveProperty("advisorAlpha");
    expect(INDUSTRY_BENCHMARKS).toHaveProperty("avgAdvisoryFee");
  });

  it("METHODOLOGY_DISCLOSURE covers all engines", () => {
    expect(METHODOLOGY_DISCLOSURE).toHaveProperty("uwe");
    expect(METHODOLOGY_DISCLOSURE).toHaveProperty("bie");
    expect(METHODOLOGY_DISCLOSURE).toHaveProperty("he");
    expect(METHODOLOGY_DISCLOSURE).toHaveProperty("mc");
    expect(METHODOLOGY_DISCLOSURE).toHaveProperty("pf");
    expect(METHODOLOGY_DISCLOSURE).toHaveProperty("disclaimer");
  });

  it("SP500_HISTORY spans 1928 to 2025", () => {
    const years = Object.keys(SP500_HISTORY).map(Number);
    expect(Math.min(...years)).toBe(1928);
    expect(Math.max(...years)).toBe(2025);
    expect(years.length).toBeGreaterThanOrEqual(90);
  });

  it("STRESS_SCENARIOS has 5 scenarios with correct structure", () => {
    expect(Object.keys(STRESS_SCENARIOS)).toEqual(["dotcom", "gfc", "covid", "stagflation", "rising_rates"]);
    for (const [, s] of Object.entries(STRESS_SCENARIOS)) {
      expect(s.name).toBeTruthy();
      expect(s.description).toBeTruthy();
      expect(s.years.length).toBe(s.returns.length);
      expect(s.years.length).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Group D — SCUI backtesting + stress
// ═══════════════════════════════════════════════════════════════════════════

describe("SCUI backtesting and stress testing", () => {
  it("historicalBacktest produces a valid summary", () => {
    const result = historicalBacktest(100000, 5000, 4000, 10);
    expect(result.total).toBeGreaterThan(0);
    expect(result.survived).toBeGreaterThanOrEqual(0);
    expect(result.survived).toBeLessThanOrEqual(result.total);
    expect(result.survivalRate).toBeGreaterThanOrEqual(0);
    expect(result.survivalRate).toBeLessThanOrEqual(1);
  });

  it("stressTest returns valid result for known scenario", () => {
    const result = stressTest("gfc", 1000000, 50000, 40000);
    expect(result).not.toBeNull();
    expect(result!.scenario.name).toContain("Financial Crisis");
    expect(result!.path.length).toBeGreaterThan(0);
    expect(result!.finalBalance).toBeGreaterThan(0);
    expect(result!.maxDrawdown).toBeGreaterThan(0);
    expect(result!.maxDrawdown).toBeLessThanOrEqual(1);
  });

  it("stressTest returns null for unknown scenario", () => {
    const result = stressTest("nonexistent", 100000);
    expect(result).toBeNull();
  });
});
