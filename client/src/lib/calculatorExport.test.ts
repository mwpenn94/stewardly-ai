import { describe, it, expect } from "vitest";
import {
  formatCalcForExport,
  formatScorecardForExport,
  getSupportedExportTypes,
} from "./calculatorExport";

describe("calculatorExport", () => {
  describe("getSupportedExportTypes", () => {
    it("returns all 12 calculator types", () => {
      const types = getSupportedExportTypes();
      expect(types).toHaveLength(12);
      expect(types).toContain("iul");
      expect(types).toContain("pf");
      expect(types).toContain("ret");
      expect(types).toContain("tax");
      expect(types).toContain("ss");
      expect(types).toContain("medicare");
      expect(types).toContain("hsa");
      expect(types).toContain("charitable");
      expect(types).toContain("divorce");
      expect(types).toContain("education");
      expect(types).toContain("stress");
      expect(types).toContain("montecarlo");
    });
  });

  describe("formatCalcForExport", () => {
    it("returns null for unknown calculator type", () => {
      expect(formatCalcForExport("unknown", {})).toBeNull();
    });

    it("returns null for null data", () => {
      expect(formatCalcForExport("iul", null)).toBeNull();
    });

    it("returns null for undefined data", () => {
      expect(formatCalcForExport("iul", undefined)).toBeNull();
    });

    it("formats IUL data correctly", () => {
      const data = {
        annualPremium: 10000,
        projections: [
          { cashValue: 5000, surrenderValue: 3000, deathBenefit: 500000, premiumPaid: 10000 },
          { cashValue: 12000, surrenderValue: 9000, deathBenefit: 500000, premiumPaid: 10000 },
        ],
      };
      const result = formatCalcForExport("iul", data);
      expect(result).not.toBeNull();
      expect(result!.title).toContain("IUL");
      expect(result!.columns).toHaveLength(5);
      expect(result!.rows).toHaveLength(2);
      expect(result!.rows[0].year).toBe(1);
      expect(result!.rows[0].cashValue).toBe(5000);
    });

    it("formats PF data correctly", () => {
      const data = {
        roi: 12.5,
        breakevenYear: 8,
        projections: [
          { year: 1, cashValue: 100000, loanBalance: 90000, netEquity: 10000, deathBenefit: 5000000 },
        ],
      };
      const result = formatCalcForExport("pf", data);
      expect(result).not.toBeNull();
      expect(result!.title).toContain("Premium Finance");
      expect(result!.rows[0].netEquity).toBe(10000);
    });

    it("formats Retirement data correctly", () => {
      const data = {
        projections: [
          { year: 1, balance: 500000, contributions: 20000, withdrawals: 0, growth: 40000 },
        ],
      };
      const result = formatCalcForExport("ret", data);
      expect(result).not.toBeNull();
      expect(result!.title).toContain("Retirement");
    });

    it("formats Tax data correctly", () => {
      const data = {
        totalTax: 35000,
        effectiveRate: 22,
        bracketBreakdown: [
          { bracket: "10%", income: 10000, tax: 1000 },
        ],
      };
      const result = formatCalcForExport("tax", data);
      expect(result).not.toBeNull();
      expect(result!.title).toContain("Tax");
    });

    it("formats SS data correctly", () => {
      const data = {
        scenarios: [
          { claimAge: 62, monthlyBenefit: 1800, lifetimeTotal: 432000, breakeven: 78 },
        ],
      };
      const result = formatCalcForExport("ss", data);
      expect(result).not.toBeNull();
      expect(result!.title).toContain("Social Security");
    });

    it("formats Medicare data correctly", () => {
      const data = {
        pathways: [
          { name: "Original Medicare", monthlyCost: 300, annualCost: 3600, coverage: "Standard" },
        ],
      };
      const result = formatCalcForExport("medicare", data);
      expect(result).not.toBeNull();
      expect(result!.title).toContain("Medicare");
    });

    it("formats HSA data correctly", () => {
      const data = {
        strategies: [
          { name: "Max Contribution", annualContribution: 3850, taxSavings: 962, projectedBalance: 50000 },
        ],
      };
      const result = formatCalcForExport("hsa", data);
      expect(result).not.toBeNull();
      expect(result!.title).toContain("HSA");
    });

    it("formats Charitable data correctly", () => {
      const data = {
        vehicles: [
          { name: "DAF", deduction: 50000, taxSavings: 18500, netCost: 31500 },
        ],
      };
      const result = formatCalcForExport("charitable", data);
      expect(result).not.toBeNull();
      expect(result!.title).toContain("Charitable");
    });

    it("formats Divorce data correctly", () => {
      const data = {
        assets: [
          { name: "House", value: 500000, splitA: 250000, splitB: 250000 },
        ],
      };
      const result = formatCalcForExport("divorce", data);
      expect(result).not.toBeNull();
      expect(result!.title).toContain("Divorce");
    });

    it("formats Education data correctly", () => {
      const data = {
        plans: [
          { name: "529 Plan", monthlyContribution: 500, projectedValue: 120000, coveragePercent: 85 },
        ],
      };
      const result = formatCalcForExport("education", data);
      expect(result).not.toBeNull();
      expect(result!.title).toContain("Education");
    });

    it("formats Stress data correctly", () => {
      const data = {
        scenarios: [
          { name: "2008 Crisis", drawdown: -38, recoveryYears: 4, endingValue: 850000 },
        ],
      };
      const result = formatCalcForExport("stress", data);
      expect(result).not.toBeNull();
      expect(result!.title).toContain("Stress");
    });

    it("formats MonteCarlo data correctly", () => {
      const data = [
        { year: 1, p10: 90000, p25: 95000, p50: 105000, p75: 115000, p90: 125000 },
        { year: 2, p10: 85000, p25: 95000, p50: 110000, p75: 130000, p90: 145000 },
      ];
      const result = formatCalcForExport("montecarlo", data);
      expect(result).not.toBeNull();
      expect(result!.title).toContain("Monte Carlo");
      expect(result!.rows).toHaveLength(2);
    });

    it("handles empty projections gracefully", () => {
      const data = { annualPremium: 10000, projections: [] };
      const result = formatCalcForExport("iul", data);
      expect(result).not.toBeNull();
      expect(result!.rows).toHaveLength(0);
    });
  });

  describe("formatScorecardForExport", () => {
    it("formats holistic scorecard correctly", () => {
      const holisticResult = {
        compositeScore: 72,
        stageLabel: "Growth Phase",
        domains: [
          { name: "Cash Flow", score: 80, weight: 0.15, label: "Good" },
          { name: "Retirement", score: 65, weight: 0.2, label: "Fair" },
        ],
        costBenefit: { annualPlanningCost: 5000, totalBenefitValue: 25000, roiRatio: 5 },
        actions: [
          { label: "Increase 401k contributions", priority: "high", domain: "Retirement" },
        ],
        products: [],
      };
      const profile = { annualIncome: 150000, age: 45 };
      const result = formatScorecardForExport(holisticResult, profile);
      expect(result).not.toBeNull();
      expect(result.title).toContain("Holistic");
      expect(result.rows.length).toBeGreaterThan(0);
    });
  });
});
