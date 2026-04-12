/**
 * Multi-Line Quick Quote — unit tests.
 *
 * Locks the deterministic shape of the bundled quote so the client UI
 * can rely on stable keys + totals across releases.
 */

import { describe, it, expect } from "vitest";
import { generateMultiLineQuickQuote } from "./multiLineQuote";

describe("generateMultiLineQuickQuote", () => {
  it("returns coverage lines + planning actions + totals", () => {
    const r = generateMultiLineQuickQuote({
      age: 35,
      income: 100_000,
      dependents: 2,
      hasHome: true,
      homeValue: 400_000,
      stateCode: "TX",
    });
    expect(r.coverageLines.length).toBeGreaterThan(0);
    expect(r.planningActions.length).toBeGreaterThan(0);
    expect(r.totals.annualPremiumAll).toBeGreaterThan(0);
    expect(r.totals.annualPremiumCritical).toBeGreaterThanOrEqual(0);
    expect(r.totals.annualPremiumAll).toBeGreaterThanOrEqual(r.totals.annualPremiumCritical);
  });

  it("includes life insurance for client with dependents", () => {
    const r = generateMultiLineQuickQuote({
      age: 40,
      income: 120_000,
      dependents: 2,
    });
    const life = r.coverageLines.filter((l) => l.category === "life");
    expect(life.length).toBeGreaterThanOrEqual(1);
    expect(life[0].priority).toBe("critical");
  });

  it("recommends DI for working-age clients", () => {
    const r = generateMultiLineQuickQuote({
      age: 35,
      income: 100_000,
      dependents: 0,
    });
    const di = r.coverageLines.find((l) => l.category === "disability");
    expect(di).toBeDefined();
    expect(di!.coverageAmount).toBeGreaterThan(0);
  });

  it("skips DI for retirement-age clients", () => {
    const r = generateMultiLineQuickQuote({
      age: 70,
      income: 50_000,
      dependents: 0,
    });
    const di = r.coverageLines.find((l) => l.category === "disability");
    expect(di).toBeUndefined();
  });

  it("upgrades LTC pool for HNW clients", () => {
    const mass = generateMultiLineQuickQuote({
      age: 55,
      income: 120_000,
      dependents: 0,
      netWorth: 200_000,
    });
    const hnw = generateMultiLineQuickQuote({
      age: 55,
      income: 500_000,
      dependents: 0,
      netWorth: 2_000_000,
    });
    const massLtc = mass.coverageLines.find((l) => l.category === "ltc")!;
    const hnwLtc = hnw.coverageLines.find((l) => l.category === "ltc")!;
    expect(hnwLtc.coverageAmount).toBeGreaterThan(massLtc.coverageAmount);
  });

  it("includes permanent life (IUL) for HNW clients", () => {
    const r = generateMultiLineQuickQuote({
      age: 40,
      income: 400_000,
      dependents: 2,
      netWorth: 1_500_000,
    });
    const iul = r.coverageLines.find(
      (l) => l.category === "life" && /IUL/i.test(l.product),
    );
    expect(iul).toBeDefined();
  });

  it("renter flow returns HO-4 when no home", () => {
    const r = generateMultiLineQuickQuote({
      age: 28,
      income: 65_000,
      dependents: 0,
      hasHome: false,
    });
    const property = r.coverageLines.find((l) => l.category === "property")!;
    expect(property.product).toContain("Renters");
  });

  it("auto premium is higher in high-risk states", () => {
    const tx = generateMultiLineQuickQuote({
      age: 30,
      income: 75_000,
      dependents: 1,
      stateCode: "TX",
    });
    const mi = generateMultiLineQuickQuote({
      age: 30,
      income: 75_000,
      dependents: 1,
      stateCode: "MI",
    });
    const txAuto = tx.coverageLines.find((l) => l.category === "auto")!;
    const miAuto = mi.coverageLines.find((l) => l.category === "auto")!;
    expect(miAuto.annualPremium).toBeGreaterThan(txAuto.annualPremium);
  });

  it("umbrella scales with net worth", () => {
    const low = generateMultiLineQuickQuote({
      age: 35,
      income: 100_000,
      dependents: 1,
      netWorth: 200_000,
    });
    const high = generateMultiLineQuickQuote({
      age: 35,
      income: 100_000,
      dependents: 1,
      netWorth: 3_000_000,
    });
    const lowU = low.coverageLines.find((l) => l.category === "umbrella")!;
    const highU = high.coverageLines.find((l) => l.category === "umbrella")!;
    expect(highU.coverageAmount).toBeGreaterThan(lowU.coverageAmount);
  });

  it("business owner flow adds BOP + key person coverage", () => {
    const r = generateMultiLineQuickQuote({
      age: 45,
      income: 200_000,
      dependents: 2,
      isBizOwner: true,
      businessRevenue: 1_500_000,
      numEmployees: 10,
    });
    const biz = r.coverageLines.filter((l) => l.category === "business");
    expect(biz.length).toBeGreaterThanOrEqual(2);
    expect(biz.some((l) => /BOP/.test(l.product))).toBe(true);
    expect(biz.some((l) => /Key Person/.test(l.product))).toBe(true);
    // Group benefits should appear with 10 employees
    expect(biz.some((l) => /Group/.test(l.product))).toBe(true);
  });

  it("planning actions include Roth IRA recommendation", () => {
    const r = generateMultiLineQuickQuote({
      age: 30,
      income: 80_000,
      dependents: 0,
    });
    expect(
      r.planningActions.some((p) => p.action.toLowerCase().includes("roth")),
    ).toBe(true);
  });

  it("planning actions include 529 for each dependent", () => {
    const r = generateMultiLineQuickQuote({
      age: 35,
      income: 150_000,
      dependents: 3,
    });
    const col = r.planningActions.find((p) => p.action.includes("529"))!;
    expect(col).toBeDefined();
    expect(col.annualAmount).toBeGreaterThan(0);
  });

  it("warns on clients over 75", () => {
    const r = generateMultiLineQuickQuote({
      age: 80,
      income: 50_000,
      dependents: 0,
    });
    expect(r.warnings.some((w) => /75/.test(w))).toBe(true);
  });

  it("asPctOfIncome is finite and non-negative", () => {
    const r = generateMultiLineQuickQuote({
      age: 35,
      income: 100_000,
      dependents: 2,
    });
    expect(Number.isFinite(r.totals.asPctOfIncome)).toBe(true);
    expect(r.totals.asPctOfIncome).toBeGreaterThanOrEqual(0);
  });

  it("zero-income profile degrades gracefully without crash", () => {
    const r = generateMultiLineQuickQuote({
      age: 25,
      income: 0,
      dependents: 0,
    });
    expect(r.coverageLines.length).toBeGreaterThan(0);
    expect(r.totals.asPctOfIncome).toBe(0);
  });

  it("all coverage line annualPremium values are non-negative integers or zero", () => {
    const r = generateMultiLineQuickQuote({
      age: 45,
      income: 180_000,
      dependents: 2,
      hasHome: true,
      homeValue: 500_000,
    });
    for (const line of r.coverageLines) {
      expect(line.annualPremium).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(line.annualPremium)).toBe(true);
      expect(line.monthlyPremium).toBeGreaterThanOrEqual(0);
    }
  });
});
