/**
 * Owner Compensation Engine — unit tests.
 *
 * Locks the pure-function contract for:
 *   • calcFederalIncomeTax  (progressive bracket math)
 *   • calcSelfEmploymentTax (SECA base + deductible half)
 *   • calcQbiDeduction      (below-phaseout / corridor / above-ceiling / SSTB)
 *   • recommendRetirementPlan (solo 401k / SEP / DB branching)
 *   • buildOwnerCompSnapshot  (entity-specific snapshot)
 *   • compareEntities         (ranked recommendation)
 *   • valueBusiness           (SDE multiple + exit projection)
 */

import { describe, it, expect } from "vitest";
import {
  OWNER_COMP_CONSTANTS,
  calcFederalIncomeTax,
  calcEmployeePayrollTax,
  calcSelfEmploymentTax,
  calcQbiDeduction,
  recommendRetirementPlan,
  buildOwnerCompSnapshot,
  compareEntities,
  valueBusiness,
  pickDefaultMultiple,
} from "../ownerComp";

describe("Owner Compensation Engine", () => {
  describe("calcFederalIncomeTax", () => {
    it("returns zero for non-positive income", () => {
      expect(calcFederalIncomeTax(0, "single")).toBe(0);
      expect(calcFederalIncomeTax(-1000, "mfj")).toBe(0);
    });

    it("single filer — $50k taxable ≈ $4,875 federal", () => {
      // 10% of 11925 + 12% of (48475-11925) + 22% of (50000-48475)
      // = 1192.5 + 4386 + 335.5 = 5914 ≈ within $20
      const tax = calcFederalIncomeTax(50_000, "single");
      expect(tax).toBeGreaterThan(5_000);
      expect(tax).toBeLessThan(7_000);
    });

    it("mfj $100k taxable is lower than single $100k", () => {
      const singleTax = calcFederalIncomeTax(100_000, "single");
      const mfjTax = calcFederalIncomeTax(100_000, "mfj");
      expect(mfjTax).toBeLessThan(singleTax);
    });

    it("top bracket activates above $626,350 (single)", () => {
      const lowMarginal = calcFederalIncomeTax(626_349, "single") - calcFederalIncomeTax(625_349, "single");
      const topMarginal = calcFederalIncomeTax(700_000, "single") - calcFederalIncomeTax(699_000, "single");
      expect(topMarginal).toBeGreaterThan(lowMarginal);
    });
  });

  describe("calcEmployeePayrollTax", () => {
    it("wages below SS base pay full 6.2% + 1.45%", () => {
      const r = calcEmployeePayrollTax(100_000);
      expect(r.ssTax).toBeCloseTo(6_200, 1);
      expect(r.medicareTax).toBeCloseTo(1_450, 1);
      expect(r.addlMedicareTax).toBe(0);
    });

    it("wages above SS base cap SS tax at the base", () => {
      const r = calcEmployeePayrollTax(250_000);
      expect(r.ssTax).toBeCloseTo(
        OWNER_COMP_CONSTANTS.SS_WAGE_BASE * OWNER_COMP_CONSTANTS.SS_RATE,
        1,
      );
      // Additional Medicare kicks in at $200k
      expect(r.addlMedicareTax).toBeCloseTo(
        (250_000 - 200_000) * OWNER_COMP_CONSTANTS.ADDL_MEDICARE_RATE,
        1,
      );
    });
  });

  describe("calcSelfEmploymentTax", () => {
    it("returns zero for non-positive SE income", () => {
      expect(calcSelfEmploymentTax(0).total).toBe(0);
      expect(calcSelfEmploymentTax(-1000).total).toBe(0);
    });

    it("$50k SE income ≈ $7k total, deductible half ≈ $3.5k", () => {
      const r = calcSelfEmploymentTax(50_000);
      // 50000 * 0.9235 * (0.124 + 0.029) ≈ 7067
      expect(r.total).toBeGreaterThan(6_500);
      expect(r.total).toBeLessThan(7_500);
      expect(r.deductibleHalf).toBeCloseTo(r.total / 2, 1);
    });

    it("SE base clamps SS at wage base", () => {
      const r = calcSelfEmploymentTax(500_000);
      const seBase = 500_000 * OWNER_COMP_CONSTANTS.SE_DEDUCTIBLE_PORTION;
      const expectedSs = OWNER_COMP_CONSTANTS.SS_WAGE_BASE * OWNER_COMP_CONSTANTS.SS_SE_RATE;
      expect(r.ssTax).toBeCloseTo(expectedSs, 0);
      // Medicare applies to full base
      expect(r.medicareTax).toBeCloseTo(seBase * OWNER_COMP_CONSTANTS.MEDICARE_SE_RATE, 0);
    });
  });

  describe("calcQbiDeduction", () => {
    it("returns zero when QBI is zero", () => {
      const r = calcQbiDeduction({
        qualifiedBusinessIncome: 0,
        taxableIncomeBeforeQbi: 100_000,
        filingStatus: "single",
      });
      expect(r.deduction).toBe(0);
    });

    it("below phase-out: 20% of QBI, capped by taxable income", () => {
      const r = calcQbiDeduction({
        qualifiedBusinessIncome: 100_000,
        taxableIncomeBeforeQbi: 150_000,
        filingStatus: "single",
      });
      expect(r.deduction).toBeCloseTo(20_000, 1);
      expect(r.phaseoutApplied).toBe(false);
    });

    it("SSTB above ceiling gets zero deduction", () => {
      const r = calcQbiDeduction({
        qualifiedBusinessIncome: 200_000,
        taxableIncomeBeforeQbi: 400_000,
        filingStatus: "single",
        isSstb: true,
      });
      expect(r.deduction).toBe(0);
      expect(r.reason).toBe("sstb-above-ceiling");
    });

    it("non-SSTB above ceiling applies W-2 wage limit", () => {
      const r = calcQbiDeduction({
        qualifiedBusinessIncome: 200_000,
        taxableIncomeBeforeQbi: 400_000,
        filingStatus: "single",
        isSstb: false,
        w2Wages: 80_000,
      });
      // 50% of $80k = $40k limit; 20% of $200k = $40k QBI — tied
      expect(r.deduction).toBeLessThanOrEqual(40_000);
      expect(r.phaseoutApplied).toBe(true);
    });

    it("SSTB within corridor gets partial deduction", () => {
      const startsAt = OWNER_COMP_CONSTANTS.QBI_PHASEOUT_SINGLE_START;
      const mid = startsAt + 25_000; // halfway through corridor
      const r = calcQbiDeduction({
        qualifiedBusinessIncome: 100_000,
        taxableIncomeBeforeQbi: mid,
        filingStatus: "single",
        isSstb: true,
      });
      expect(r.deduction).toBeGreaterThan(0);
      expect(r.deduction).toBeLessThan(20_000);
      expect(r.reason).toBe("sstb-phaseout");
    });
  });

  describe("recommendRetirementPlan", () => {
    it("owner with employees → SEP-IRA", () => {
      const r = recommendRetirementPlan({
        age: 40,
        netSeOrW2Income: 200_000,
        marginalRate: 0.32,
        hasEmployees: true,
      });
      expect(r.plan).toBe("sep_ira");
      expect(r.total).toBeLessThanOrEqual(OWNER_COMP_CONSTANTS.SEP_IRA_LIMIT);
    });

    it("solo owner under $300k → Solo 401k", () => {
      const r = recommendRetirementPlan({
        age: 35,
        netSeOrW2Income: 150_000,
        marginalRate: 0.24,
      });
      expect(r.plan).toBe("solo_401k");
      expect(r.employeeContribution).toBe(OWNER_COMP_CONSTANTS.SOLO_401K_EMPLOYEE);
    });

    it("age 50+ catches up on Solo 401k", () => {
      const r = recommendRetirementPlan({
        age: 55,
        netSeOrW2Income: 200_000,
        marginalRate: 0.32,
      });
      expect(r.employeeContribution).toBe(
        OWNER_COMP_CONSTANTS.SOLO_401K_EMPLOYEE + OWNER_COMP_CONSTANTS.SOLO_401K_CATCHUP_50,
      );
    });

    it("high-income compressed-horizon owner → Defined Benefit stack", () => {
      const r = recommendRetirementPlan({
        age: 55,
        netSeOrW2Income: 500_000,
        marginalRate: 0.37,
        targetYearsToRetire: 10,
      });
      expect(r.plan).toBe("defined_benefit");
      expect(r.total).toBeGreaterThan(
        OWNER_COMP_CONSTANTS.SOLO_401K_COMBINED + OWNER_COMP_CONSTANTS.SOLO_401K_CATCHUP_50,
      );
    });

    it("low income solo owner returns consistent shape", () => {
      const r = recommendRetirementPlan({
        age: 25,
        netSeOrW2Income: 40_000,
        marginalRate: 0.12,
      });
      expect(r.plan).toBe("solo_401k");
      expect(r.employeeContribution).toBeLessThanOrEqual(40_000);
    });
  });

  describe("buildOwnerCompSnapshot — entity behavior", () => {
    const base = {
      netBusinessProfit: 200_000,
      filingStatus: "single" as const,
      age: 40,
      stateRate: 0.05,
    };

    it("sole_prop applies full self-employment tax", () => {
      const snap = buildOwnerCompSnapshot({ ...base, entity: "sole_prop" });
      expect(snap.selfEmploymentTax).toBeGreaterThan(0);
      expect(snap.employeePayrollTax).toBe(0);
      expect(snap.ownerSalary).toBe(0);
    });

    it("s_corp splits profit into salary + distributions", () => {
      const snap = buildOwnerCompSnapshot({ ...base, entity: "s_corp" });
      expect(snap.ownerSalary).toBeGreaterThan(0);
      expect(snap.ownerSalary).toBeLessThan(base.netBusinessProfit);
      expect(snap.selfEmploymentTax).toBe(0); // S-Corp doesn't trigger SE tax on K-1
      expect(snap.employerPayrollTax).toBeGreaterThan(0);
    });

    it("c_corp excludes QBI deduction", () => {
      const snap = buildOwnerCompSnapshot({ ...base, entity: "c_corp" });
      expect(snap.qbi.deduction).toBe(0);
    });

    it("explicit ownerSalary is respected for s_corp", () => {
      const snap = buildOwnerCompSnapshot({
        ...base,
        entity: "s_corp",
        ownerSalary: 60_000,
      });
      expect(snap.ownerSalary).toBe(60_000);
    });

    it("low salary triggers reasonable-comp warning", () => {
      const snap = buildOwnerCompSnapshot({
        ...base,
        entity: "s_corp",
        ownerSalary: 20_000, // way below 30% floor
      });
      expect(snap.notes.some((n) => n.toLowerCase().includes("warning"))).toBe(true);
    });

    it("effectiveRate is between 0 and 1", () => {
      const snap = buildOwnerCompSnapshot({ ...base, entity: "s_corp" });
      expect(snap.effectiveRate).toBeGreaterThanOrEqual(0);
      expect(snap.effectiveRate).toBeLessThan(1);
    });
  });

  describe("compareEntities", () => {
    it("returns one result per entity and picks the best", () => {
      const r = compareEntities({
        netBusinessProfit: 250_000,
        filingStatus: "single",
        age: 40,
        stateRate: 0.05,
      });
      expect(r.results.length).toBe(4);
      expect(["sole_prop", "llc", "s_corp", "c_corp"]).toContain(r.recommended);
      expect(r.savings).toBeGreaterThanOrEqual(0);
    });

    it("s_corp typically dominates sole_prop at mid-income", () => {
      const r = compareEntities({
        netBusinessProfit: 150_000,
        filingStatus: "single",
        age: 40,
      });
      const sp = r.results.find((x) => x.entity === "sole_prop")!;
      const sc = r.results.find((x) => x.entity === "s_corp")!;
      // S-Corp should save SE tax on the distribution portion
      expect(sc.selfEmploymentTax).toBe(0);
      expect(sp.selfEmploymentTax).toBeGreaterThan(0);
    });
  });

  describe("pickDefaultMultiple + valueBusiness", () => {
    it("picks lower multiples for small-SDE businesses", () => {
      expect(pickDefaultMultiple(300_000)).toBeLessThan(pickDefaultMultiple(5_000_000));
      expect(pickDefaultMultiple(20_000_000)).toBeGreaterThan(pickDefaultMultiple(2_000_000));
    });

    it("valueBusiness applies multiple and projects forward", () => {
      const r = valueBusiness({
        annualRevenue: 2_000_000,
        annualEbitda: 400_000,
        ownerAddBack: 100_000,
        exitYears: 5,
        growthRate: 0.1,
      });
      expect(r.sde).toBe(500_000);
      expect(r.currentValue).toBeGreaterThan(0);
      expect(r.projectedExitValue).toBeGreaterThan(r.currentValue);
    });

    it("override industry multiple is honored", () => {
      const r = valueBusiness({
        annualRevenue: 1_000_000,
        annualEbitda: 200_000,
        industryMultiple: 10,
      });
      expect(r.multipleApplied).toBe(10);
      expect(r.currentValue).toBe(2_000_000);
    });

    it("handles zero EBITDA gracefully", () => {
      const r = valueBusiness({
        annualRevenue: 500_000,
        annualEbitda: 0,
      });
      expect(r.currentValue).toBe(0);
      expect(r.sde).toBe(0);
    });
  });
});
