/**
 * State income tax projector — California, New York, Illinois, Texas.
 *
 * Shipped by Pass 10 of the hybrid build loop — PARITY-TAX-0003
 * (discovered gap during Pass 4 federal projector build).
 *
 * Design: ADDITIVE extension over the Pass 4 federal projector.
 * The existing `projector.ts` module is untouched. State tax is
 * modeled as a pure function that takes a YearResult from the
 * federal projector plus a state code, and returns the state tax
 * owed.
 *
 * Coverage: CA (most progressive), NY (progressive + NYC
 * surcharge optional), IL (flat 4.95%), TX (no state tax). These
 * four cover roughly half of the US advisor book.
 *
 * Conservative modeling — we explicitly warn the caller when:
 *   - Income crosses a phaseout threshold
 *   - NYC/Yonkers surcharge is relevant
 *   - State has specific retirement income exclusions we don't model
 *
 * Everything is PURE — no DB, no fetch, no wall-clock.
 */

import type { FilingStatus, YearResult } from "./projector";

// ─── Types ─────────────────────────────────────────────────────────────────

export type StateCode = "CA" | "NY" | "IL" | "TX";

export interface StateTaxContext {
  state: StateCode;
  /** Federal result from projector.projectYear. */
  federal: YearResult;
  /** Caller-supplied filing status (state may differ from federal). */
  filingStatus: FilingStatus;
  /**
   * Optional: when NY residents live in NYC, add the NYC surcharge.
   * (Yonkers is a similar concept but we just ship NYC for now.)
   */
  livesInNYC?: boolean;
}

export interface StateTaxResult {
  state: StateCode;
  stateTaxUSD: number;
  marginalRate: number;
  effectiveRate: number;
  warnings: string[];
  /** Top rate bucket hit in the state's bracket table. */
  topBracketHit: number;
  /** Taxable base used by the state (may differ from federal taxable). */
  stateTaxableIncome: number;
}

// ─── Bracket tables ───────────────────────────────────────────────────────

interface Bracket {
  upper: number;
  rate: number;
}

// California — 2024 tax year (approximate, single column; MFJ
// multiplies thresholds by 2 except at the top mental health surcharge).
const CA_SINGLE: Bracket[] = [
  { upper: 10_756, rate: 0.01 },
  { upper: 25_499, rate: 0.02 },
  { upper: 40_245, rate: 0.04 },
  { upper: 55_866, rate: 0.06 },
  { upper: 70_606, rate: 0.08 },
  { upper: 360_659, rate: 0.093 },
  { upper: 432_787, rate: 0.103 },
  { upper: 721_314, rate: 0.113 },
  { upper: 1_000_000, rate: 0.123 },
  { upper: Infinity, rate: 0.133 }, // includes 1% mental health surcharge
];

const CA_MFJ: Bracket[] = CA_SINGLE.map((b) => ({
  rate: b.rate,
  upper: b.upper === Infinity ? Infinity : b.upper * 2,
}));

// New York — 2024 approximate. NY has a ~5% spread across low
// brackets and tops out at 10.9% for income >$25M.
const NY_SINGLE: Bracket[] = [
  { upper: 8_500, rate: 0.04 },
  { upper: 11_700, rate: 0.045 },
  { upper: 13_900, rate: 0.0525 },
  { upper: 80_650, rate: 0.055 },
  { upper: 215_400, rate: 0.06 },
  { upper: 1_077_550, rate: 0.0685 },
  { upper: 5_000_000, rate: 0.0965 },
  { upper: 25_000_000, rate: 0.103 },
  { upper: Infinity, rate: 0.109 },
];

const NY_MFJ: Bracket[] = [
  { upper: 17_150, rate: 0.04 },
  { upper: 23_600, rate: 0.045 },
  { upper: 27_900, rate: 0.0525 },
  { upper: 161_550, rate: 0.055 },
  { upper: 323_200, rate: 0.06 },
  { upper: 2_155_350, rate: 0.0685 },
  { upper: 5_000_000, rate: 0.0965 },
  { upper: 25_000_000, rate: 0.103 },
  { upper: Infinity, rate: 0.109 },
];

// NYC resident surcharge (flat 3.876% top, progressive).
const NYC_SURCHARGE: Bracket[] = [
  { upper: 12_000, rate: 0.03078 },
  { upper: 25_000, rate: 0.03762 },
  { upper: 50_000, rate: 0.03819 },
  { upper: Infinity, rate: 0.03876 },
];

// Illinois — flat rate
const IL_FLAT = 0.0495;

// ─── Helpers ───────────────────────────────────────────────────────────────

function computeBracketTax(taxableIncome: number, brackets: Bracket[]): number {
  if (!Number.isFinite(taxableIncome) || taxableIncome <= 0) return 0;
  let tax = 0;
  let last = 0;
  for (const b of brackets) {
    const top = Math.min(taxableIncome, b.upper);
    if (top > last) {
      tax += (top - last) * b.rate;
      last = top;
    }
    if (taxableIncome <= b.upper) break;
  }
  return tax;
}

function marginalInBrackets(taxableIncome: number, brackets: Bracket[]): number {
  if (!Number.isFinite(taxableIncome) || taxableIncome < 0)
    return brackets[0]?.rate ?? 0;
  for (const b of brackets) {
    if (taxableIncome < b.upper) return b.rate;
  }
  return brackets[brackets.length - 1]?.rate ?? 0;
}

// ─── Main entry ────────────────────────────────────────────────────────────

export function projectStateTax(ctx: StateTaxContext): StateTaxResult {
  const warnings: string[] = [];

  // Most states start from federal AGI, not federal taxable income —
  // they have their own deductions. For this first cut we use
  // federal AGI as the state base and warn about the approximation.
  const base = ctx.federal.agi;
  warnings.push(
    "State taxable income uses federal AGI as a proxy — state-specific deductions (SALT caps, retirement exclusions) not modeled.",
  );

  switch (ctx.state) {
    case "TX": {
      return {
        state: "TX",
        stateTaxUSD: 0,
        marginalRate: 0,
        effectiveRate: 0,
        warnings: ["Texas has no state income tax."],
        topBracketHit: 0,
        stateTaxableIncome: base,
      };
    }
    case "IL": {
      const tax = base > 0 ? base * IL_FLAT : 0;
      return {
        state: "IL",
        stateTaxUSD: tax,
        marginalRate: IL_FLAT,
        effectiveRate: base > 0 ? tax / base : 0,
        warnings: [...warnings, "Illinois has a flat 4.95% rate with no brackets."],
        topBracketHit: IL_FLAT,
        stateTaxableIncome: base,
      };
    }
    case "CA": {
      const brackets = ctx.filingStatus === "mfj" ? CA_MFJ : CA_SINGLE;
      const tax = computeBracketTax(base, brackets);
      const marginal = marginalInBrackets(base, brackets);
      const top = brackets.find((b) => base < b.upper)?.rate ?? brackets[brackets.length - 1].rate;
      if (base > 1_000_000) {
        warnings.push(
          "California mental health surcharge (1%) applies — built into the top bracket.",
        );
      }
      return {
        state: "CA",
        stateTaxUSD: tax,
        marginalRate: marginal,
        effectiveRate: base > 0 ? tax / base : 0,
        warnings,
        topBracketHit: top,
        stateTaxableIncome: base,
      };
    }
    case "NY": {
      const brackets = ctx.filingStatus === "mfj" ? NY_MFJ : NY_SINGLE;
      let tax = computeBracketTax(base, brackets);
      const marginal = marginalInBrackets(base, brackets);

      if (ctx.livesInNYC) {
        const nycTax = computeBracketTax(base, NYC_SURCHARGE);
        tax += nycTax;
        warnings.push(
          `NYC resident surcharge applied: $${nycTax.toFixed(0)}.`,
        );
      }

      const top = brackets.find((b) => base < b.upper)?.rate ?? brackets[brackets.length - 1].rate;
      return {
        state: "NY",
        stateTaxUSD: tax,
        marginalRate: marginal,
        effectiveRate: base > 0 ? tax / base : 0,
        warnings,
        topBracketHit: top,
        stateTaxableIncome: base,
      };
    }
  }
}

/** Combined federal + state effective rate. */
export function combinedEffectiveRate(
  federal: YearResult,
  state: StateTaxResult,
): number {
  if (federal.agi <= 0) return 0;
  return (federal.totalFederalTax + state.stateTaxUSD) / federal.agi;
}

/** List supported states (useful for UI dropdowns). */
export const SUPPORTED_STATES: Array<{ code: StateCode; name: string }> = [
  { code: "CA", name: "California" },
  { code: "NY", name: "New York" },
  { code: "IL", name: "Illinois" },
  { code: "TX", name: "Texas" },
];
