/**
 * Unit tests for the pure helpers in BusinessIncomeQuickQuote.
 * Shape-mapping functions are pure and easy to pin — they're
 * the contract between the shared financial profile and this
 * page's local state, so changes that break the mapping get
 * caught immediately by this file.
 */

import { describe, it, expect } from "vitest";
import type { FinancialProfile } from "@/stores/financialProfile";
import {
  profileToBizQuickQuote,
  summarizeBizProjection,
  ROLE_OPTIONS,
} from "./businessIncomeQuickQuoteHelpers";

describe("BusinessIncomeQuickQuote / profileToBizQuickQuote", () => {
  it("returns an empty patch for an empty profile", () => {
    expect(profileToBizQuickQuote({})).toEqual({});
  });

  it("maps businessRole, businessRevenue, businessEmployees", () => {
    const p: FinancialProfile = {
      businessRole: "dir",
      businessRevenue: 250000,
      businessEmployees: 5,
    };
    expect(profileToBizQuickQuote(p)).toEqual({
      role: "dir",
      personalGDC: 250000,
      teamSize: 5,
    });
  });

  it("ignores irrelevant fields", () => {
    const p: FinancialProfile = {
      age: 40,
      income: 120000,
      savings: 50000,
      businessRole: "md",
    };
    const patch = profileToBizQuickQuote(p);
    expect(patch.role).toBe("md");
    expect(Object.keys(patch)).toEqual(["role"]);
  });

  it("omits businessEmployees when zero is actually meaningful", () => {
    // zero is a legitimate value for solo practitioners, so the
    // mapping MUST include it (not filter it out)
    const p: FinancialProfile = { businessEmployees: 0, businessRole: "new" };
    expect(profileToBizQuickQuote(p)).toEqual({ role: "new", teamSize: 0 });
  });
});

describe("BusinessIncomeQuickQuote / summarizeBizProjection", () => {
  it("returns zeros for undefined input", () => {
    expect(summarizeBizProjection(undefined)).toEqual({
      totalEarnings: 0,
      peakYear: 0,
      peakIncome: 0,
      avgIncome: 0,
    });
  });

  it("returns zeros for empty array", () => {
    expect(summarizeBizProjection([])).toEqual({
      totalEarnings: 0,
      peakYear: 0,
      peakIncome: 0,
      avgIncome: 0,
    });
  });

  it("sums and averages year incomes", () => {
    const years = [
      { year: 1, totalIncome: 100000 },
      { year: 2, totalIncome: 150000 },
      { year: 3, totalIncome: 200000 },
    ];
    const s = summarizeBizProjection(years);
    expect(s.totalEarnings).toBe(450000);
    expect(s.avgIncome).toBe(150000);
    expect(s.peakIncome).toBe(200000);
    expect(s.peakYear).toBe(3);
  });

  it("treats missing totalIncome as zero", () => {
    const years = [
      { year: 1, totalIncome: 100000 },
      { year: 2 },
      { year: 3, totalIncome: 200000 },
    ];
    const s = summarizeBizProjection(years);
    expect(s.totalEarnings).toBe(300000);
    expect(s.avgIncome).toBe(100000);
    expect(s.peakIncome).toBe(200000);
  });

  it("picks the first year with the max income when there's a tie", () => {
    const years = [
      { year: 1, totalIncome: 200000 },
      { year: 2, totalIncome: 200000 },
    ];
    const s = summarizeBizProjection(years);
    // first strictly-greater wins — tied second year doesn't override
    expect(s.peakYear).toBe(1);
    expect(s.peakIncome).toBe(200000);
  });
});

describe("BusinessIncomeQuickQuote / ROLE_OPTIONS registry", () => {
  it("exposes every BIE role the server accepts", () => {
    const keys = ROLE_OPTIONS.map((r) => r.key);
    expect(keys).toContain("new");
    expect(keys).toContain("exp");
    expect(keys).toContain("dir");
    expect(keys).toContain("md");
    expect(keys).toContain("rvp");
    expect(keys).toContain("partner");
  });

  it("has a non-empty label for every role", () => {
    for (const r of ROLE_OPTIONS) {
      expect(r.label.length).toBeGreaterThan(0);
      expect(r.presetKey.length).toBeGreaterThan(0);
    }
  });

  it("keeps role keys unique", () => {
    const keys = ROLE_OPTIONS.map((r) => r.key);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });
});
