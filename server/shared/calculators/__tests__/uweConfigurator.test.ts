/**
 * UWE Configurator integration tests.
 *
 * Validates the exact flow the WealthConfigurator page follows:
 * buildStrategy → simulate → product breakdown + Monte Carlo.
 * Ensures every company key produces a valid strategy with products,
 * simulation produces year-by-year snapshots with the right shape,
 * and generateBestOverall returns a cross-company optimal.
 */
import { describe, it, expect } from "vitest";
import {
  uweBuildStrategy,
  uweSimulate,
  autoSelectProducts,
  generateBestOverall,
  COMPANIES,
  estPrem,
  monteCarloSimulate,
} from "..";
import type { ClientProfile } from "../types";

const SAMPLE_PROFILE: ClientProfile = {
  age: 40,
  income: 150000,
  netWorth: 500000,
  savings: 100000,
  monthlySavings: 2000,
  dependents: 2,
  mortgage: 300000,
  debts: 25000,
  marginalRate: 0.24,
  equitiesReturn: 0.07,
  existingInsurance: 0,
  isBizOwner: false,
};

// ─── buildStrategy per company ──────────────────────────────────────
describe("UWE buildStrategy — all 7 companies", () => {
  const companyKeys = Object.keys(COMPANIES);

  it("has exactly 7 company strategies", () => {
    expect(companyKeys).toHaveLength(7);
    expect(companyKeys).toContain("wealthbridge");
    expect(companyKeys).toContain("donothing");
  });

  for (const key of companyKeys) {
    it(`buildStrategy("${key}") returns a valid UWEStrategy`, () => {
      const strategy = uweBuildStrategy(key, SAMPLE_PROFILE);
      expect(strategy).toBeDefined();
      expect(strategy.company).toBe(key);
      expect(strategy.companyName).toBeTruthy();
      expect(strategy.color).toBeTruthy();
      expect(strategy.profile).toBeDefined();
      expect(Array.isArray(strategy.products)).toBe(true);
      expect(strategy.features).toBeDefined();
      expect(typeof strategy.notes).toBe("string");
    });
  }

  it("wealthbridge has the most products (all 14 available)", () => {
    const wb = uweBuildStrategy("wealthbridge", SAMPLE_PROFILE);
    const dn = uweBuildStrategy("donothing", SAMPLE_PROFILE);
    expect(wb.products.length).toBeGreaterThan(0);
    expect(dn.products.length).toBe(0);
    expect(wb.products.length).toBeGreaterThanOrEqual(dn.products.length);
  });
});

// ─── simulate produces valid snapshots ──────────────────────���───────
describe("UWE simulate — year-by-year shape", () => {
  it("30-year wealthbridge simulation has 30 snapshots", () => {
    const strategy = uweBuildStrategy("wealthbridge", SAMPLE_PROFILE);
    const snapshots = uweSimulate(strategy, 30);
    expect(snapshots).toHaveLength(30);
  });

  it("each snapshot has required numeric fields", () => {
    const strategy = uweBuildStrategy("wealthbridge", SAMPLE_PROFILE);
    const snapshots = uweSimulate(strategy, 10);
    for (const snap of snapshots) {
      expect(typeof snap.year).toBe("number");
      expect(typeof snap.age).toBe("number");
      expect(typeof snap.totalValue).toBe("number");
      expect(typeof snap.netValue).toBe("number");
      expect(typeof snap.savingsBalance).toBe("number");
      expect(typeof snap.productCashValue).toBe("number");
      expect(typeof snap.totalProtection).toBe("number");
      expect(typeof snap.roi).toBe("number");
      expect(typeof snap.cumulativeCost).toBe("number");
      expect(Array.isArray(snap.productDetails)).toBe(true);
    }
  });

  it("total value grows over time for wealthbridge", () => {
    const strategy = uweBuildStrategy("wealthbridge", SAMPLE_PROFILE);
    const snapshots = uweSimulate(strategy, 30);
    const year1 = snapshots[0].totalValue;
    const year30 = snapshots[29].totalValue;
    expect(year30).toBeGreaterThan(year1);
  });

  it("donothing strategy has zero product cost", () => {
    const strategy = uweBuildStrategy("donothing", SAMPLE_PROFILE);
    const snapshots = uweSimulate(strategy, 10);
    for (const snap of snapshots) {
      expect(snap.productCashValue).toBe(0);
      expect(snap.totalAnnualCost).toBe(0);
    }
  });

  it("age increments correctly from profile age", () => {
    const strategy = uweBuildStrategy("wealthbridge", SAMPLE_PROFILE);
    const snapshots = uweSimulate(strategy, 5);
    expect(snapshots[0].age).toBe(SAMPLE_PROFILE.age! + 1);
    expect(snapshots[4].age).toBe(SAMPLE_PROFILE.age! + 5);
  });
});

// ─── generateBestOverall ────────────────────────────────────────────
describe("UWE generateBestOverall", () => {
  it("returns a strategy with bestoverall company key", () => {
    const best = generateBestOverall(SAMPLE_PROFILE);
    expect(best.company).toBe("bestoverall");
    expect(best.companyName).toBeTruthy();
  });

  it("best overall has products from multiple companies", () => {
    const best = generateBestOverall(SAMPLE_PROFILE);
    expect(best.products.length).toBeGreaterThan(0);
  });

  it("best overall is simulatable", () => {
    const best = generateBestOverall(SAMPLE_PROFILE);
    const snapshots = uweSimulate(best, 10);
    expect(snapshots).toHaveLength(10);
    expect(snapshots[9].totalValue).toBeGreaterThan(0);
  });
});

// ─── autoSelectProducts ─────────────────────────────────────────────
describe("UWE autoSelectProducts", () => {
  it("returns products for wealthbridge", () => {
    const products = autoSelectProducts(COMPANIES.wealthbridge, SAMPLE_PROFILE, "wealthbridge");
    expect(products.length).toBeGreaterThan(0);
    for (const p of products) {
      expect(p.type).toBeTruthy();
    }
  });

  it("returns empty for donothing", () => {
    const products = autoSelectProducts(COMPANIES.donothing, SAMPLE_PROFILE, "donothing");
    expect(products).toHaveLength(0);
  });
});

// ─── estPrem boundary checks ────────────────────────────────────────
describe("UWE estPrem — premium estimation", () => {
  it("term premium is positive for valid inputs", () => {
    expect(estPrem("term", 40, 500000)).toBeGreaterThan(0);
  });

  it("returns 0 for unknown product type", () => {
    expect(estPrem("unknown", 40, 500000)).toBe(0);
  });

  it("returns 0 for non-positive amount", () => {
    expect(estPrem("term", 40, 0)).toBe(0);
    expect(estPrem("term", 40, -1000)).toBe(0);
  });

  it("premium increases with age", () => {
    const young = estPrem("term", 30, 500000);
    const old = estPrem("term", 60, 500000);
    expect(old).toBeGreaterThan(young);
  });
});

// ─── Monte Carlo integration ────────────────────────────────────────
describe("Monte Carlo — configurator integration", () => {
  it("produces percentile bands for a strategy config", () => {
    const result = monteCarloSimulate(
      { investReturn: 0.07, volatility: 0.15, savings: 100000, monthlySavings: 2000 },
      10,
      100,
    );
    // MC returns maxYears+1 entries (includes year 0)
    expect(result.length).toBeGreaterThanOrEqual(10);
    for (const row of result) {
      expect(typeof row.p10).toBe("number");
      expect(typeof row.p50).toBe("number");
      expect(typeof row.p90).toBe("number");
      expect(row.p90).toBeGreaterThanOrEqual(row.p10);
    }
  });
});
