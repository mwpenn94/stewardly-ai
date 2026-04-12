/**
 * Unit tests for the pure state tax projector.
 * Pass 10 of the hybrid build loop — PARITY-TAX-0003.
 */
import { describe, it, expect } from "vitest";
import {
  projectStateTax,
  combinedEffectiveRate,
  SUPPORTED_STATES,
} from "./stateTax";
import { projectYear, type YearContext } from "./projector";

const MFJ_2024: YearContext = {
  year: 2024,
  filingStatus: "mfj",
  ordinaryIncomeUSD: 200_000,
  longTermCapGainsUSD: 0,
  qualifiedDividendsUSD: 0,
  traditionalDistributionsUSD: 0,
  itemizedDeductionUSD: 0,
  aboveTheLineUSD: 0,
  primaryAge: 50,
};

const federalResult = projectYear(MFJ_2024);

// ─── Texas — no tax ─────────────────────────────────────────────────────

describe("tax/stateTax — Texas", () => {
  it("returns zero state tax", () => {
    const r = projectStateTax({
      state: "TX",
      federal: federalResult,
      filingStatus: "mfj",
    });
    expect(r.stateTaxUSD).toBe(0);
    expect(r.marginalRate).toBe(0);
    expect(r.effectiveRate).toBe(0);
    expect(r.warnings[0]).toMatch(/no state income tax/i);
  });
});

// ─── Illinois — flat rate ───────────────────────────────────────────────

describe("tax/stateTax — Illinois", () => {
  it("applies 4.95% flat rate", () => {
    const r = projectStateTax({
      state: "IL",
      federal: federalResult,
      filingStatus: "mfj",
    });
    // AGI = 200,000 × 0.0495 = 9,900
    expect(r.stateTaxUSD).toBeCloseTo(9_900, 2);
    expect(r.marginalRate).toBeCloseTo(0.0495, 5);
  });

  it("handles zero income", () => {
    const zeroResult = projectYear({
      ...MFJ_2024,
      ordinaryIncomeUSD: 0,
    });
    const r = projectStateTax({
      state: "IL",
      federal: zeroResult,
      filingStatus: "mfj",
    });
    expect(r.stateTaxUSD).toBe(0);
    expect(r.effectiveRate).toBe(0);
  });
});

// ─── California — progressive ───────────────────────────────────────────

describe("tax/stateTax — California", () => {
  it("computes progressive state tax for a mid-income MFJ", () => {
    const r = projectStateTax({
      state: "CA",
      federal: federalResult,
      filingStatus: "mfj",
    });
    expect(r.stateTaxUSD).toBeGreaterThan(0);
    // Marginal should be in the 6–9.3% range for 200k MFJ
    expect(r.marginalRate).toBeGreaterThanOrEqual(0.06);
    expect(r.marginalRate).toBeLessThanOrEqual(0.093);
  });

  it("MFJ brackets are 2x single — equal-income MFJ owes less than single", () => {
    const high: YearContext = {
      ...MFJ_2024,
      filingStatus: "single",
      ordinaryIncomeUSD: 200_000,
    };
    const singleResult = projectYear(high);
    const mfj = projectStateTax({
      state: "CA",
      federal: federalResult,
      filingStatus: "mfj",
    });
    const single = projectStateTax({
      state: "CA",
      federal: singleResult,
      filingStatus: "single",
    });
    expect(mfj.stateTaxUSD).toBeLessThan(single.stateTaxUSD);
  });

  it("warns about the mental health surcharge above $1M", () => {
    const richResult = projectYear({
      ...MFJ_2024,
      ordinaryIncomeUSD: 2_000_000,
    });
    const r = projectStateTax({
      state: "CA",
      federal: richResult,
      filingStatus: "mfj",
    });
    expect(r.warnings.some((w) => /mental health/i.test(w))).toBe(true);
  });
});

// ─── New York — progressive + NYC surcharge ─────────────────────────────

describe("tax/stateTax — New York", () => {
  it("computes progressive state tax without NYC surcharge", () => {
    const r = projectStateTax({
      state: "NY",
      federal: federalResult,
      filingStatus: "mfj",
    });
    expect(r.stateTaxUSD).toBeGreaterThan(0);
  });

  it("NYC surcharge adds tax and is flagged in warnings", () => {
    const nonNYC = projectStateTax({
      state: "NY",
      federal: federalResult,
      filingStatus: "mfj",
    });
    const nyc = projectStateTax({
      state: "NY",
      federal: federalResult,
      filingStatus: "mfj",
      livesInNYC: true,
    });
    expect(nyc.stateTaxUSD).toBeGreaterThan(nonNYC.stateTaxUSD);
    expect(nyc.warnings.some((w) => /NYC/.test(w))).toBe(true);
  });

  it("NY MFJ brackets differ from single", () => {
    const mfj = projectStateTax({
      state: "NY",
      federal: federalResult,
      filingStatus: "mfj",
    });
    const singleResult = projectYear({
      ...MFJ_2024,
      filingStatus: "single",
      ordinaryIncomeUSD: 200_000,
    });
    const single = projectStateTax({
      state: "NY",
      federal: singleResult,
      filingStatus: "single",
    });
    expect(mfj.stateTaxUSD).not.toBe(single.stateTaxUSD);
  });
});

// ─── combinedEffectiveRate ──────────────────────────────────────────────

describe("tax/stateTax — combinedEffectiveRate", () => {
  it("combines federal and state effective rates", () => {
    const ca = projectStateTax({
      state: "CA",
      federal: federalResult,
      filingStatus: "mfj",
    });
    const combined = combinedEffectiveRate(federalResult, ca);
    expect(combined).toBeGreaterThan(federalResult.effectiveRate);
  });

  it("returns 0 for zero AGI", () => {
    const zero = projectYear({ ...MFJ_2024, ordinaryIncomeUSD: 0 });
    const r = projectStateTax({
      state: "CA",
      federal: zero,
      filingStatus: "mfj",
    });
    expect(combinedEffectiveRate(zero, r)).toBe(0);
  });
});

// ─── SUPPORTED_STATES ───────────────────────────────────────────────────

describe("tax/stateTax — SUPPORTED_STATES", () => {
  it("exposes 4 states", () => {
    expect(SUPPORTED_STATES).toHaveLength(4);
    expect(SUPPORTED_STATES.map((s) => s.code)).toEqual(["CA", "NY", "IL", "TX"]);
  });
  it("each entry has code + name", () => {
    for (const s of SUPPORTED_STATES) {
      expect(s.code).toBeDefined();
      expect(s.name).toBeDefined();
    }
  });
});

// ─── Invariants ─────────────────────────────────────────────────────────

describe("tax/stateTax — invariants", () => {
  it("stateTaxUSD is never negative", () => {
    for (const state of SUPPORTED_STATES) {
      const r = projectStateTax({
        state: state.code,
        federal: federalResult,
        filingStatus: "mfj",
      });
      expect(r.stateTaxUSD).toBeGreaterThanOrEqual(0);
    }
  });

  it("effective rate is always ≤ marginal rate", () => {
    for (const state of SUPPORTED_STATES) {
      const r = projectStateTax({
        state: state.code,
        federal: federalResult,
        filingStatus: "mfj",
      });
      expect(r.effectiveRate).toBeLessThanOrEqual(r.marginalRate + 0.001);
    }
  });
});
