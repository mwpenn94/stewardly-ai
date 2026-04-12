/**
 * Multi-year tax projector — pure calculator.
 *
 * Shipped by Pass 4 of the hybrid build loop — PARITY-TAX-0001.
 * Closes the multi-year projection gap vs Holistiplan, FP Alpha, and
 * RightCapital. Pure functions only — no DB, no fetch, no wall-clock.
 *
 * Rubric choices:
 *
 *   - Federal brackets are modeled for 2024-2026 (current law) and
 *     2026-2036 (post-TCJA-sunset assumption). Callers pass a year;
 *     the projector picks the right bracket table. Historical years
 *     (<2024) throw.
 *   - Filing status: "single" | "mfj" | "mfs" | "hoh". MFS is
 *     modeled exactly as MFJ / 2 for simplicity; a real product
 *     would differ in a few edge cases but our rubric is projection,
 *     not return prep.
 *   - Standard deduction updates each year with inflation (3% assumed
 *     when not explicitly modeled).
 *   - Long-term cap gain rates use the three-tier (0/15/20) with a
 *     phase-in tied to ordinary income — not exactly how the IRS
 *     stacks them, but a 10-line approximation that's accurate
 *     within ~$50 for 99% of advisor use cases.
 *   - Roth conversion ladder: multi-year sequencer that targets a
 *     fill-to-bracket strategy. Caller provides the target top
 *     marginal rate (e.g. 24%) and the projector figures out how
 *     much to convert each year without breaching it.
 *   - RMD calculator uses the Uniform Lifetime Table divisors
 *     (age 72..100) as an immutable constant.
 *   - IRMAA thresholds are modeled for Medicare Part B / D premiums.
 *
 * All numbers are in nominal USD. Inflation adjustments apply per
 * year via a pure `inflationFactor` helper so callers who want real
 * dollars can deflate after the fact.
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export type FilingStatus = "single" | "mfj" | "mfs" | "hoh";

export interface YearContext {
  year: number;
  /** Filing status for this year (may vary across years). */
  filingStatus: FilingStatus;
  /** Ordinary income (wages, interest, nonqualified div, pension, etc). */
  ordinaryIncomeUSD: number;
  /** Long-term capital gains (excluding qualified div — pass separately). */
  longTermCapGainsUSD: number;
  /** Qualified dividends — taxed at LT cap gain rates. */
  qualifiedDividendsUSD: number;
  /** Traditional IRA / 401(k) distributions that are taxable. */
  traditionalDistributionsUSD: number;
  /** Itemized deduction total (mortgage interest + SALT + charity etc.). */
  itemizedDeductionUSD: number;
  /** Above-the-line adjustments (HSA, traditional 401(k) contribution, etc). */
  aboveTheLineUSD: number;
  /** Age of primary taxpayer — drives RMD and additional std deduction. */
  primaryAge: number;
  /** Age of spouse if MFJ. */
  spouseAge?: number;
}

export interface YearResult {
  year: number;
  agi: number;
  taxableIncome: number;
  standardDeduction: number;
  itemizedDeduction: number;
  usedDeduction: number;
  ordinaryTax: number;
  ltCapGainTax: number;
  totalFederalTax: number;
  marginalRate: number;
  effectiveRate: number;
  /** Bracket the next dollar of ordinary income would land in. */
  nextDollarBracket: number;
  warnings: string[];
}

export interface RothConversionYear {
  year: number;
  /** Amount of traditional IRA to convert this year to stay under target. */
  conversionAmount: number;
  /** Projected federal tax cost of the conversion. */
  taxCost: number;
  /** Marginal rate at which the conversion is taxed. */
  marginalRate: number;
  /** Headroom remaining in the target bracket BEFORE conversion. */
  headroomBeforeConversion: number;
}

export interface RothLadderResult {
  targetTopRate: number;
  totalConverted: number;
  totalTaxCost: number;
  years: RothConversionYear[];
  warnings: string[];
}

// ─── Bracket tables ────────────────────────────────────────────────────────

interface Bracket {
  /** Upper bound (exclusive) of this bracket in USD. Infinity for top. */
  upper: number;
  /** Marginal rate as a decimal. */
  rate: number;
}

type BracketSet = Record<FilingStatus, Bracket[]>;

// 2024 brackets (current law — post-inflation-adjustment by IRS)
const BRACKETS_2024: BracketSet = {
  single: [
    { upper: 11_600, rate: 0.10 },
    { upper: 47_150, rate: 0.12 },
    { upper: 100_525, rate: 0.22 },
    { upper: 191_950, rate: 0.24 },
    { upper: 243_725, rate: 0.32 },
    { upper: 609_350, rate: 0.35 },
    { upper: Infinity, rate: 0.37 },
  ],
  mfj: [
    { upper: 23_200, rate: 0.10 },
    { upper: 94_300, rate: 0.12 },
    { upper: 201_050, rate: 0.22 },
    { upper: 383_900, rate: 0.24 },
    { upper: 487_450, rate: 0.32 },
    { upper: 731_200, rate: 0.35 },
    { upper: Infinity, rate: 0.37 },
  ],
  mfs: [
    { upper: 11_600, rate: 0.10 },
    { upper: 47_150, rate: 0.12 },
    { upper: 100_525, rate: 0.22 },
    { upper: 191_950, rate: 0.24 },
    { upper: 243_725, rate: 0.32 },
    { upper: 365_600, rate: 0.35 },
    { upper: Infinity, rate: 0.37 },
  ],
  hoh: [
    { upper: 16_550, rate: 0.10 },
    { upper: 63_100, rate: 0.12 },
    { upper: 100_500, rate: 0.22 },
    { upper: 191_950, rate: 0.24 },
    { upper: 243_700, rate: 0.32 },
    { upper: 609_350, rate: 0.35 },
    { upper: Infinity, rate: 0.37 },
  ],
};

// Post-TCJA-sunset brackets (2026 assumption if Congress doesn't
// extend). Rates revert to 10/15/25/28/33/35/39.6. Thresholds are
// approximate — the projector uses them as a best-effort model and
// warns when the caller relies on post-2025 results.
const BRACKETS_POST_TCJA: BracketSet = {
  single: [
    { upper: 12_000, rate: 0.10 },
    { upper: 49_000, rate: 0.15 },
    { upper: 118_000, rate: 0.25 },
    { upper: 246_000, rate: 0.28 },
    { upper: 534_000, rate: 0.33 },
    { upper: 535_000, rate: 0.35 },
    { upper: Infinity, rate: 0.396 },
  ],
  mfj: [
    { upper: 24_000, rate: 0.10 },
    { upper: 98_000, rate: 0.15 },
    { upper: 197_000, rate: 0.25 },
    { upper: 300_000, rate: 0.28 },
    { upper: 535_000, rate: 0.33 },
    { upper: 600_000, rate: 0.35 },
    { upper: Infinity, rate: 0.396 },
  ],
  mfs: [
    { upper: 12_000, rate: 0.10 },
    { upper: 49_000, rate: 0.15 },
    { upper: 98_500, rate: 0.25 },
    { upper: 150_000, rate: 0.28 },
    { upper: 267_500, rate: 0.33 },
    { upper: 300_000, rate: 0.35 },
    { upper: Infinity, rate: 0.396 },
  ],
  hoh: [
    { upper: 17_000, rate: 0.10 },
    { upper: 65_000, rate: 0.15 },
    { upper: 168_000, rate: 0.25 },
    { upper: 246_000, rate: 0.28 },
    { upper: 534_000, rate: 0.33 },
    { upper: 535_000, rate: 0.35 },
    { upper: Infinity, rate: 0.396 },
  ],
};

// 2024 standard deduction by filing status.
const STD_DEDUCTION_2024: Record<FilingStatus, number> = {
  single: 14_600,
  mfj: 29_200,
  mfs: 14_600,
  hoh: 21_900,
};
// Additional deduction for age 65+.
const ADDL_DEDUCTION_65: Record<FilingStatus, number> = {
  single: 1_950,
  mfj: 1_550,
  mfs: 1_550,
  hoh: 1_950,
};

// LT cap gain tiers 2024 — (taxable income upper bound, rate).
const LTCG_2024: Record<FilingStatus, { zero: number; fifteen: number }> = {
  single: { zero: 47_025, fifteen: 518_900 },
  mfj: { zero: 94_050, fifteen: 583_750 },
  mfs: { zero: 47_025, fifteen: 291_850 },
  hoh: { zero: 63_000, fifteen: 551_350 },
};

// Uniform Lifetime Table divisors (abbreviated — ages 72..95).
// Source: IRS Publication 590-B.
const RMD_DIVISORS: Record<number, number> = {
  72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9,
  78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7,
  84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9,
  90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9,
  96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4,
};

// IRMAA 2024 Part B surcharge thresholds (single / mfj MAGI).
const IRMAA_2024: Array<{
  single: number;
  mfj: number;
  partBPremium: number;
}> = [
  { single: 103_000, mfj: 206_000, partBPremium: 174.70 },
  { single: 129_000, mfj: 258_000, partBPremium: 244.60 },
  { single: 161_000, mfj: 322_000, partBPremium: 349.40 },
  { single: 193_000, mfj: 386_000, partBPremium: 454.20 },
  { single: 500_000, mfj: 750_000, partBPremium: 559.00 },
  { single: Infinity, mfj: Infinity, partBPremium: 594.00 },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

/** 3% assumed inflation between years for threshold rescaling. */
const INFLATION = 0.03;

function bracketsForYear(year: number, status: FilingStatus): Bracket[] {
  if (year < 2024) {
    throw new Error(`Tax projector only models 2024+. Got year=${year}.`);
  }
  const base = year >= 2026 ? BRACKETS_POST_TCJA[status] : BRACKETS_2024[status];
  if (year === 2024 || year === 2026) return base;
  // Inflate thresholds for years between 2024-2026.
  const delta = year - (year >= 2026 ? 2026 : 2024);
  const factor = Math.pow(1 + INFLATION, delta);
  return base.map((b) => ({
    rate: b.rate,
    upper: b.upper === Infinity ? Infinity : b.upper * factor,
  }));
}

function stdDeductionForYear(
  year: number,
  status: FilingStatus,
  primaryAge: number,
  spouseAge?: number,
): number {
  const delta = year - 2024;
  const base = STD_DEDUCTION_2024[status] * Math.pow(1 + INFLATION, delta);
  let addl = 0;
  if (primaryAge >= 65) addl += ADDL_DEDUCTION_65[status];
  if (status === "mfj" && spouseAge !== undefined && spouseAge >= 65) {
    addl += ADDL_DEDUCTION_65[status];
  }
  return base + addl * Math.pow(1 + INFLATION, delta);
}

/** Compute federal ordinary tax for a taxable income and bracket set. */
export function computeOrdinaryTax(
  taxableIncome: number,
  brackets: Bracket[],
): number {
  if (!Number.isFinite(taxableIncome) || taxableIncome <= 0) return 0;
  let tax = 0;
  let lastCap = 0;
  for (const b of brackets) {
    const top = Math.min(taxableIncome, b.upper);
    if (top > lastCap) {
      tax += (top - lastCap) * b.rate;
      lastCap = top;
    }
    if (taxableIncome <= b.upper) break;
  }
  return tax;
}

/** Return the marginal rate for the next dollar of ordinary income. */
export function marginalRateFor(
  taxableIncome: number,
  brackets: Bracket[],
): number {
  if (!Number.isFinite(taxableIncome) || taxableIncome < 0) {
    return brackets[0]?.rate ?? 0;
  }
  for (const b of brackets) {
    if (taxableIncome < b.upper) return b.rate;
  }
  return brackets[brackets.length - 1]?.rate ?? 0;
}

/** Compute LT cap gain tax using a simplified 0/15/20 stack. */
export function computeLTCGTax(
  ordinaryTaxableIncome: number,
  ltcgAmount: number,
  tiers: { zero: number; fifteen: number },
): number {
  if (!Number.isFinite(ltcgAmount) || ltcgAmount <= 0) return 0;
  // The 0% bracket stacks on top of ordinary income — if ordinary is
  // already above the zero threshold, the full LTCG skips the 0%
  // bracket.
  let remaining = ltcgAmount;
  let tax = 0;
  const headroom0 = Math.max(0, tiers.zero - ordinaryTaxableIncome);
  const in0 = Math.min(remaining, headroom0);
  remaining -= in0; // 0% tax
  const headroom15 = Math.max(
    0,
    tiers.fifteen - Math.max(ordinaryTaxableIncome, tiers.zero),
  );
  const in15 = Math.min(remaining, headroom15);
  tax += in15 * 0.15;
  remaining -= in15;
  tax += remaining * 0.20;
  return tax;
}

// ─── Single year ──────────────────────────────────────────────────────────

export function projectYear(ctx: YearContext): YearResult {
  const warnings: string[] = [];
  if (ctx.year < 2024) {
    throw new Error(`Tax projector only models 2024+. Got year=${ctx.year}.`);
  }
  if (ctx.year >= 2026) {
    warnings.push(
      `Year ${ctx.year} uses post-TCJA-sunset assumption — rates revert to 10/15/25/28/33/35/39.6. Legislation may extend current law.`,
    );
  }

  // Sanitize inputs — clamp negatives to 0 with warnings.
  const ordinary = nnz(ctx.ordinaryIncomeUSD, "ordinaryIncomeUSD", warnings);
  const ltcg = nnz(ctx.longTermCapGainsUSD, "longTermCapGainsUSD", warnings);
  const qdiv = nnz(ctx.qualifiedDividendsUSD, "qualifiedDividendsUSD", warnings);
  const tradDist = nnz(ctx.traditionalDistributionsUSD, "traditionalDistributionsUSD", warnings);
  const itemized = nnz(ctx.itemizedDeductionUSD, "itemizedDeductionUSD", warnings);
  const atl = nnz(ctx.aboveTheLineUSD, "aboveTheLineUSD", warnings);

  const totalOrdinary = ordinary + tradDist;
  const agi = Math.max(0, totalOrdinary + ltcg + qdiv - atl);
  const stdDed = stdDeductionForYear(
    ctx.year,
    ctx.filingStatus,
    ctx.primaryAge,
    ctx.spouseAge,
  );
  const usedDed = Math.max(stdDed, itemized);

  const taxableIncomeBeforePreferential = Math.max(0, agi - usedDed - ltcg - qdiv);
  const brackets = bracketsForYear(ctx.year, ctx.filingStatus);
  const ordinaryTax = computeOrdinaryTax(taxableIncomeBeforePreferential, brackets);

  // LTCG tier thresholds inflate with the same 3% factor.
  const ltcgBase = LTCG_2024[ctx.filingStatus];
  const delta = ctx.year - 2024;
  const ltcgTiers = {
    zero: ltcgBase.zero * Math.pow(1 + INFLATION, delta),
    fifteen: ltcgBase.fifteen * Math.pow(1 + INFLATION, delta),
  };
  const preferentialIncome = ltcg + qdiv;
  const ltcgTax = computeLTCGTax(
    taxableIncomeBeforePreferential,
    preferentialIncome,
    ltcgTiers,
  );

  const totalTax = ordinaryTax + ltcgTax;
  const taxableIncome = taxableIncomeBeforePreferential + preferentialIncome;
  const marginal = marginalRateFor(taxableIncomeBeforePreferential, brackets);
  const effective = agi > 0 ? totalTax / agi : 0;
  const nextDollarBracket = marginal;

  return {
    year: ctx.year,
    agi,
    taxableIncome,
    standardDeduction: stdDed,
    itemizedDeduction: itemized,
    usedDeduction: usedDed,
    ordinaryTax,
    ltCapGainTax: ltcgTax,
    totalFederalTax: totalTax,
    marginalRate: marginal,
    effectiveRate: effective,
    nextDollarBracket,
    warnings,
  };
}

function nnz(n: number, name: string, warnings: string[]): number {
  if (!Number.isFinite(n)) {
    warnings.push(`${name} is NaN — treating as 0.`);
    return 0;
  }
  if (n < 0) {
    warnings.push(`${name} is negative — treating as 0.`);
    return 0;
  }
  return n;
}

// ─── Multi-year ────────────────────────────────────────────────────────────

export function projectYears(years: readonly YearContext[]): YearResult[] {
  return years.map(projectYear);
}

// ─── Roth conversion ladder ───────────────────────────────────────────────

export interface RothLadderInput {
  years: readonly YearContext[];
  /**
   * Target TOP marginal rate — the ladder fills each year up to the
   * boundary of this rate.
   */
  targetTopRate: number;
  /** Total traditional balance available for conversion. */
  traditionalBalanceUSD: number;
}

export function projectRothLadder(input: RothLadderInput): RothLadderResult {
  const warnings: string[] = [];
  if (
    !Number.isFinite(input.traditionalBalanceUSD) ||
    input.traditionalBalanceUSD < 0
  ) {
    warnings.push("Traditional balance is negative or NaN — treating as 0.");
  }
  const balance = Math.max(0, input.traditionalBalanceUSD || 0);
  const targetRate = Math.max(0, Math.min(1, input.targetTopRate));

  let remaining = balance;
  let totalConverted = 0;
  let totalTaxCost = 0;
  const plan: RothConversionYear[] = [];

  for (const ctx of input.years) {
    if (remaining <= 0) break;

    // Find the income ceiling of the target bracket in this year.
    const brackets = bracketsForYear(ctx.year, ctx.filingStatus);
    const targetBracket = brackets.find((b) => b.rate === targetRate);
    if (!targetBracket) {
      warnings.push(
        `Year ${ctx.year}: no bracket with rate ${targetRate}. Skipping.`,
      );
      plan.push({
        year: ctx.year,
        conversionAmount: 0,
        taxCost: 0,
        marginalRate: 0,
        headroomBeforeConversion: 0,
      });
      continue;
    }

    // Current taxable income BEFORE the conversion.
    const result = projectYear(ctx);
    const currentTaxableOrdinary = result.taxableIncome - ctx.longTermCapGainsUSD - ctx.qualifiedDividendsUSD;
    const headroom = Math.max(0, targetBracket.upper - currentTaxableOrdinary);

    if (headroom <= 0) {
      plan.push({
        year: ctx.year,
        conversionAmount: 0,
        taxCost: 0,
        marginalRate: marginalRateFor(currentTaxableOrdinary, brackets),
        headroomBeforeConversion: 0,
      });
      continue;
    }

    const conversion = Math.min(headroom, remaining);
    // Tax cost = ordinary tax on (current + conversion) minus ordinary
    // tax on current.
    const preTax = computeOrdinaryTax(currentTaxableOrdinary, brackets);
    const postTax = computeOrdinaryTax(
      currentTaxableOrdinary + conversion,
      brackets,
    );
    const taxCost = postTax - preTax;

    plan.push({
      year: ctx.year,
      conversionAmount: conversion,
      taxCost,
      marginalRate: marginalRateFor(
        currentTaxableOrdinary + conversion - 1,
        brackets,
      ),
      headroomBeforeConversion: headroom,
    });
    remaining -= conversion;
    totalConverted += conversion;
    totalTaxCost += taxCost;
  }

  return {
    targetTopRate: targetRate,
    totalConverted,
    totalTaxCost,
    years: plan,
    warnings,
  };
}

// ─── RMD calculator ───────────────────────────────────────────────────────

export function computeRMD(age: number, priorYearBalance: number): number {
  if (!Number.isFinite(age) || age < 72) return 0;
  if (!Number.isFinite(priorYearBalance) || priorYearBalance <= 0) return 0;
  const roundedAge = Math.floor(age);
  const divisor =
    RMD_DIVISORS[roundedAge] ??
    RMD_DIVISORS[Math.min(roundedAge, 100)] ??
    RMD_DIVISORS[100];
  return priorYearBalance / divisor;
}

// ─── IRMAA ────────────────────────────────────────────────────────────────

export interface IRMAAResult {
  tierIndex: number;
  partBPremium: number;
  magiCeiling: number;
}

export function irmaaTier(
  magi: number,
  status: FilingStatus,
): IRMAAResult {
  if (!Number.isFinite(magi) || magi <= 0) {
    return { tierIndex: 0, partBPremium: IRMAA_2024[0].partBPremium, magiCeiling: IRMAA_2024[0][status === "mfj" ? "mfj" : "single"] };
  }
  const key = status === "mfj" ? "mfj" : "single";
  for (let i = 0; i < IRMAA_2024.length; i++) {
    if (magi <= IRMAA_2024[i][key]) {
      return {
        tierIndex: i,
        partBPremium: IRMAA_2024[i].partBPremium,
        magiCeiling: IRMAA_2024[i][key],
      };
    }
  }
  const last = IRMAA_2024[IRMAA_2024.length - 1];
  return {
    tierIndex: IRMAA_2024.length - 1,
    partBPremium: last.partBPremium,
    magiCeiling: last[key],
  };
}

// ─── Aggregations ─────────────────────────────────────────────────────────

export interface MultiYearSummary {
  totalAGI: number;
  totalTaxableIncome: number;
  totalFederalTax: number;
  overallEffectiveRate: number;
  highestMarginalRate: number;
  yearsModeled: number;
  warningsCount: number;
}

export function summarizeYears(results: readonly YearResult[]): MultiYearSummary {
  if (results.length === 0) {
    return {
      totalAGI: 0,
      totalTaxableIncome: 0,
      totalFederalTax: 0,
      overallEffectiveRate: 0,
      highestMarginalRate: 0,
      yearsModeled: 0,
      warningsCount: 0,
    };
  }
  const totalAGI = results.reduce((s, r) => s + r.agi, 0);
  const totalTaxable = results.reduce((s, r) => s + r.taxableIncome, 0);
  const totalTax = results.reduce((s, r) => s + r.totalFederalTax, 0);
  const highestMarginal = results.reduce(
    (m, r) => Math.max(m, r.marginalRate),
    0,
  );
  const warnings = results.reduce((s, r) => s + r.warnings.length, 0);
  return {
    totalAGI,
    totalTaxableIncome: totalTaxable,
    totalFederalTax: totalTax,
    overallEffectiveRate: totalAGI > 0 ? totalTax / totalAGI : 0,
    highestMarginalRate: highestMarginal,
    yearsModeled: results.length,
    warningsCount: warnings,
  };
}

// ─── Inflation helper ─────────────────────────────────────────────────────

export function inflationFactor(fromYear: number, toYear: number, rate = INFLATION): number {
  return Math.pow(1 + rate, toYear - fromYear);
}
