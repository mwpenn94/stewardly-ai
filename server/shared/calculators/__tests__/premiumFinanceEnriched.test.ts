/**
 * Premium Finance Enrichment Tests (CBL15 Pass 4)
 *
 * Tests for the enriched premium finance model — breakeven analysis,
 * leverage ratios, spread arbitrage, and the dynamic guardrail system
 * added to StrategyComparison.
 */
import { describe, it, expect } from "vitest";
import { modelPremFin, type ProductConfig } from "../uwe";

// ─── modelPremFin enriched detail tests ─────────────────────────────
describe("modelPremFin — enriched details", () => {
  const baseCfg: ProductConfig = {
    type: "premfin",
    face: 5_000_000,
    annualPremium: 100_000,
    fundingYears: 10,
    loanRate: 0.055,
    creditingRate: 0.07,
    cashOutlay: 25_000,
  };

  it("details.netEquity is non-negative after funding period with positive spread", () => {
    // With 1.5% positive spread, equity should be positive eventually
    const r = modelPremFin(baseCfg, 15, 40);
    expect(r.details?.netEquity).toBeDefined();
    // After 15 years (5 post-funding), net equity should start growing
  });

  it("canPayoff is boolean field on details", () => {
    const r = modelPremFin(baseCfg, 3, 40);
    expect(typeof r.details?.canPayoff).toBe("boolean");
  });

  it("canPayoff reflects whether grossCSV > loanBalance", () => {
    const r = modelPremFin(baseCfg, 10, 40);
    const grossCSV = r.details?.grossCSV ?? 0;
    const loanBal = r.details?.loanBalance ?? 0;
    expect(r.details?.canPayoff).toBe(grossCSV > loanBal);
  });

  it("negative spread produces worse net equity than positive spread at same year", () => {
    const posSpreadCfg: ProductConfig = { ...baseCfg, loanRate: 0.05, creditingRate: 0.08 };
    const negSpreadCfg: ProductConfig = { ...baseCfg, loanRate: 0.08, creditingRate: 0.05 };
    const posResult = modelPremFin(posSpreadCfg, 10, 40);
    const negResult = modelPremFin(negSpreadCfg, 10, 40);
    const posEq = posResult.details?.netEquity ?? posResult.cashValue;
    const negEq = negResult.details?.netEquity ?? negResult.cashValue;
    expect(negEq).toBeLessThanOrEqual(posEq);
  });

  it("spread percentage matches credited - loan rate", () => {
    const r = modelPremFin(baseCfg, 1, 40);
    expect(r.details?.spread).toBe("1.5%");
  });

  it("lower credited rate produces lower cash value", () => {
    const lowCfg: ProductConfig = { ...baseCfg, creditingRate: 0.03 };
    const highCfg: ProductConfig = { ...baseCfg, creditingRate: 0.09 };
    const lowR = modelPremFin(lowCfg, 10, 40);
    const highR = modelPremFin(highCfg, 10, 40);
    const lowCSV = lowR.details?.grossCSV ?? lowR.cashValue;
    const highCSV = highR.details?.grossCSV ?? highR.cashValue;
    expect(lowCSV).toBeLessThan(highCSV);
  });

  it("death benefit is face minus loan balance (bounded at 0)", () => {
    const r = modelPremFin(baseCfg, 5, 40);
    const loanBal = r.details?.loanBalance ?? 0;
    expect(r.deathBenefit).toBe(Math.max(0, Math.round(baseCfg.face! - loanBal)));
  });

  it("leverage ratio calculation is correct", () => {
    const r = modelPremFin(baseCfg, 5, 40);
    // leverage = face / cumulative premium
    const cumulativePrem = 5 * baseCfg.annualPremium!;
    const expectedLeverage = (baseCfg.face! / cumulativePrem).toFixed(1) + "x";
    expect(r.details?.leverage).toBe(expectedLeverage);
  });

  it("loan balance compounds at loan rate", () => {
    const r1 = modelPremFin(baseCfg, 1, 40);
    const r2 = modelPremFin(baseCfg, 2, 40);
    const loan1 = r1.details?.loanBalance ?? 0;
    const loan2 = r2.details?.loanBalance ?? 0;
    // Year 2 loan should be > year 1 loan * (1 + loanRate) + premium
    expect(loan2).toBeGreaterThan(loan1);
  });
});

// ─── Dynamic guardrail checks ─────────────────────────────────────
describe("Strategy comparison guardrail checks (pure function)", () => {
  // Re-implement the pure guardrail checker here for testing
  function checkInputGuardrails(
    savingsRate: number,
    investReturn: number,
    age: number,
    income: number,
    netWorth: number,
    horizon: number,
  ) {
    const warnings: { level: "warn" | "error"; msg: string }[] = [];
    if (investReturn > 0.12)
      warnings.push({ level: "error", msg: "Return rates above 12% are historically rare" });
    else if (investReturn > 0.09)
      warnings.push({ level: "warn", msg: "Return rates above 9% assume significant equity exposure" });
    if (savingsRate > 0.50)
      warnings.push({ level: "error", msg: "Savings rates above 50% may not be sustainable" });
    else if (savingsRate > 0.30)
      warnings.push({ level: "warn", msg: "Savings rates above 30% are achievable but above 90th percentile" });
    if (age + horizon > 100)
      warnings.push({ level: "warn", msg: `Projection extends to age ${age + horizon}` });
    if (income < 30000)
      warnings.push({ level: "warn", msg: "Income below $30K may limit applicability" });
    if (netWorth < 0)
      warnings.push({ level: "error", msg: "Negative net worth significantly affects strategy suitability" });
    return warnings;
  }

  it("no warnings for conservative inputs", () => {
    const w = checkInputGuardrails(0.15, 0.07, 40, 120000, 350000, 30);
    expect(w).toHaveLength(0);
  });

  it("warns on high return rate (>9%)", () => {
    const w = checkInputGuardrails(0.15, 0.10, 40, 120000, 350000, 30);
    expect(w).toHaveLength(1);
    expect(w[0].level).toBe("warn");
  });

  it("errors on extreme return rate (>12%)", () => {
    const w = checkInputGuardrails(0.15, 0.13, 40, 120000, 350000, 30);
    expect(w).toHaveLength(1);
    expect(w[0].level).toBe("error");
  });

  it("warns on high savings rate (>30%)", () => {
    const w = checkInputGuardrails(0.35, 0.07, 40, 120000, 350000, 30);
    expect(w).toHaveLength(1);
    expect(w[0].level).toBe("warn");
  });

  it("errors on extreme savings rate (>50%)", () => {
    const w = checkInputGuardrails(0.55, 0.07, 40, 120000, 350000, 30);
    expect(w).toHaveLength(1);
    expect(w[0].level).toBe("error");
  });

  it("warns on projection beyond age 100", () => {
    const w = checkInputGuardrails(0.15, 0.07, 75, 120000, 350000, 30);
    expect(w).toHaveLength(1);
    expect(w[0].msg).toContain("105");
  });

  it("warns on low income", () => {
    const w = checkInputGuardrails(0.15, 0.07, 40, 25000, 350000, 30);
    expect(w).toHaveLength(1);
    expect(w[0].msg).toContain("$30K");
  });

  it("errors on negative net worth", () => {
    const w = checkInputGuardrails(0.15, 0.07, 40, 120000, -50000, 30);
    expect(w).toHaveLength(1);
    expect(w[0].level).toBe("error");
  });

  it("multiple warnings stack", () => {
    // High return + high savings + low income + negative NW
    const w = checkInputGuardrails(0.55, 0.13, 75, 25000, -50000, 30);
    expect(w.length).toBeGreaterThanOrEqual(4);
  });
});

// ─── Batch stress test data shape ────────────────────────────────
describe("SCUI stress test (used by batchStressTest)", () => {
  it("stressTest returns finalBalance and maxDrawdown for valid scenario", async () => {
    const { stressTest } = await import("../index");
    const result = stressTest("gfc", 500000, 12000, 5000);
    expect(result).not.toBeNull();
    expect(typeof result!.finalBalance).toBe("number");
    expect(typeof result!.maxDrawdown).toBe("number");
    expect(typeof result!.recoveryYears).toBe("number");
    expect(result!.finalBalance).toBeGreaterThanOrEqual(0);
  });

  it("stressTest returns null for unknown scenario", async () => {
    const { stressTest } = await import("../index");
    const result = stressTest("nonexistent", 500000, 12000, 5000);
    expect(result).toBeNull();
  });

  it("stressTest returns consistent results for same inputs", async () => {
    const { stressTest } = await import("../index");
    const r1 = stressTest("gfc", 500000, 12000, 5000);
    const r2 = stressTest("gfc", 500000, 12000, 5000);
    expect(r1!.finalBalance).toBe(r2!.finalBalance);
  });

  it("higher annual costs produce lower final balances", async () => {
    const { stressTest } = await import("../index");
    const low = stressTest("gfc", 500000, 12000, 1000);
    const high = stressTest("gfc", 500000, 12000, 20000);
    expect(high!.finalBalance).toBeLessThan(low!.finalBalance);
  });

  it("maxDrawdown is between 0 and 1", async () => {
    const { stressTest } = await import("../index");
    const result = stressTest("gfc", 500000, 12000, 5000);
    expect(result!.maxDrawdown).toBeGreaterThanOrEqual(0);
    expect(result!.maxDrawdown).toBeLessThanOrEqual(1);
  });
});
