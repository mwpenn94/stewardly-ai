import { describe, it, expect } from "vitest";
import {
  annualize, createStream, profileToStreams, rollUpStreams,
  getStreamContributions, projectStreams, SOURCE_PRESETS,
  type IncomeStream,
} from "./incomeStreams";

const salary: IncomeStream = {
  id: "w2_1", label: "W-2 Salary", source: "W-2 Employment",
  amount: 200000, frequency: "annual", taxTreatment: "ordinary",
  growthRate: 0.03, pillarAffinity: "plan", isActive: true,
};

const rental: IncomeStream = {
  id: "rental_1", label: "Rental Income", source: "Rental Property",
  amount: 3000, frequency: "monthly", taxTreatment: "passive",
  growthRate: 0.025, pillarAffinity: "grow", isActive: true,
};

const dividends: IncomeStream = {
  id: "div_1", label: "Dividends", source: "Dividends",
  amount: 5000, frequency: "quarterly", taxTreatment: "capital_gains",
  growthRate: 0.02, pillarAffinity: "grow", isActive: true,
};

const inactive: IncomeStream = {
  ...salary, id: "inactive_1", isActive: false,
};

describe("incomeStreams", () => {
  describe("annualize", () => {
    it("returns annual amount for annual frequency", () => {
      expect(annualize(salary)).toBe(200000);
    });
    it("multiplies monthly by 12", () => {
      expect(annualize(rental)).toBe(36000);
    });
    it("multiplies quarterly by 4", () => {
      expect(annualize(dividends)).toBe(20000);
    });
  });

  describe("createStream", () => {
    it("creates a stream from a preset", () => {
      const s = createStream(SOURCE_PRESETS[0], 150000);
      expect(s.label).toBe("W-2 Salary");
      expect(s.amount).toBe(150000);
      expect(s.frequency).toBe("annual");
      expect(s.taxTreatment).toBe("ordinary");
      expect(s.pillarAffinity).toBe("plan");
      expect(s.isActive).toBe(true);
    });
  });

  describe("profileToStreams", () => {
    it("converts profile income fields to streams", () => {
      const streams = profileToStreams({
        annualIncome: 200000,
        spouseIncome: 80000,
        rentalIncome: 36000,
        dividendIncome: 20000,
      });
      expect(streams.length).toBe(4);
      expect(streams[0].label).toBe("W-2 Salary");
      expect(streams[0].amount).toBe(200000);
      expect(streams[1].label).toBe("Spouse W-2");
      expect(streams[2].label).toBe("Rental Income");
      expect(streams[3].label).toBe("Dividend Income");
    });

    it("skips zero and missing fields", () => {
      const streams = profileToStreams({ annualIncome: 100000, spouseIncome: 0 });
      expect(streams.length).toBe(1);
    });

    it("uses income alias if annualIncome missing", () => {
      const streams = profileToStreams({ income: 75000 });
      expect(streams.length).toBe(1);
      expect(streams[0].amount).toBe(75000);
    });
  });

  describe("rollUpStreams", () => {
    it("computes total annual and monthly income", () => {
      const r = rollUpStreams([salary, rental, dividends]);
      expect(r.totalAnnualIncome).toBe(256000);
      expect(r.totalMonthlyIncome).toBe(Math.round(256000 / 12));
    });

    it("excludes inactive streams", () => {
      const r = rollUpStreams([salary, inactive]);
      expect(r.totalAnnualIncome).toBe(200000);
    });

    it("distributes pillar amounts correctly", () => {
      const r = rollUpStreams([salary, rental, dividends]);
      expect(r.byPillar.plan).toBe(200000);
      expect(r.byPillar.grow).toBe(56000); // 36000 + 20000
      expect(r.byPillar.protect).toBe(0);
    });

    it("splits mixed pillar affinity equally", () => {
      const mixed: IncomeStream = {
        ...salary, id: "mixed_1", amount: 30000, pillarAffinity: "mixed",
      };
      const r = rollUpStreams([mixed]);
      expect(r.byPillar.plan).toBe(10000);
      expect(r.byPillar.protect).toBe(10000);
      expect(r.byPillar.grow).toBe(10000);
    });

    it("computes diversification score", () => {
      // 3 distinct sources, 2 pillars = should be ~2
      const r = rollUpStreams([salary, rental, dividends]);
      expect(r.diversificationScore).toBeGreaterThanOrEqual(1);
      expect(r.diversificationScore).toBeLessThanOrEqual(3);
    });

    it("computes blended effective tax rate", () => {
      const r = rollUpStreams([salary, rental, dividends]);
      expect(r.effectiveTaxRate).toBeGreaterThan(0);
      expect(r.effectiveTaxRate).toBeLessThan(0.5);
    });

    it("projects 5-year growth", () => {
      const r = rollUpStreams([salary]);
      expect(r.projectedGrowth5yr).toBeGreaterThan(200000);
    });

    it("handles empty streams", () => {
      const r = rollUpStreams([]);
      expect(r.totalAnnualIncome).toBe(0);
      expect(r.diversificationScore).toBe(0);
    });
  });

  describe("getStreamContributions", () => {
    it("returns sorted contributions with percentages", () => {
      const contribs = getStreamContributions([salary, rental, dividends]);
      expect(contribs.length).toBe(3);
      expect(contribs[0].label).toBe("W-2 Salary");
      expect(contribs[0].pctOfTotal).toBeGreaterThan(70);
      expect(contribs.reduce((s, c) => s + c.pctOfTotal, 0)).toBeGreaterThanOrEqual(99);
    });

    it("assigns tax efficiency labels", () => {
      const contribs = getStreamContributions([salary, dividends]);
      const salaryC = contribs.find(c => c.label === "W-2 Salary");
      const divC = contribs.find(c => c.label === "Dividends");
      expect(salaryC?.taxEfficiency).toBe("medium");
      expect(divC?.taxEfficiency).toBe("high");
    });
  });

  describe("projectStreams", () => {
    it("projects forward with growth rates", () => {
      const proj = projectStreams([salary], 5);
      expect(proj.length).toBe(6); // year 0 through 5
      expect(proj[0].total).toBe(200000);
      expect(proj[5].total).toBeGreaterThan(200000);
    });

    it("breaks down by pillar per year", () => {
      const proj = projectStreams([salary, rental], 3);
      expect(proj[0].byPillar.plan).toBe(200000);
      expect(proj[0].byPillar.grow).toBe(36000);
    });

    it("handles empty streams", () => {
      const proj = projectStreams([], 5);
      expect(proj.length).toBe(6);
      expect(proj[0].total).toBe(0);
    });
  });
});
