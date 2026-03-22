import { getDb } from "../db";
import { taxParameters } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

// ─── Tax Bracket Data (2025 IRS Rev. Proc. 2024-40) ───────────────────────
const TAX_BRACKETS_2025 = {
  single: [
    { min: 0, max: 11925, rate: 10 },
    { min: 11925, max: 48475, rate: 12 },
    { min: 48475, max: 103350, rate: 22 },
    { min: 103350, max: 197300, rate: 24 },
    { min: 197300, max: 250525, rate: 32 },
    { min: 250525, max: 626350, rate: 35 },
    { min: 626350, max: Infinity, rate: 37 },
  ],
  married_filing_jointly: [
    { min: 0, max: 23850, rate: 10 },
    { min: 23850, max: 96950, rate: 12 },
    { min: 96950, max: 206700, rate: 22 },
    { min: 206700, max: 394600, rate: 24 },
    { min: 394600, max: 501050, rate: 32 },
    { min: 501050, max: 751600, rate: 35 },
    { min: 751600, max: Infinity, rate: 37 },
  ],
  married_filing_separately: [
    { min: 0, max: 11925, rate: 10 },
    { min: 11925, max: 48475, rate: 12 },
    { min: 48475, max: 103350, rate: 22 },
    { min: 103350, max: 197300, rate: 24 },
    { min: 197300, max: 250525, rate: 32 },
    { min: 250525, max: 375800, rate: 35 },
    { min: 375800, max: Infinity, rate: 37 },
  ],
  head_of_household: [
    { min: 0, max: 17000, rate: 10 },
    { min: 17000, max: 64850, rate: 12 },
    { min: 64850, max: 103350, rate: 22 },
    { min: 103350, max: 197300, rate: 24 },
    { min: 197300, max: 250500, rate: 32 },
    { min: 250500, max: 626350, rate: 35 },
    { min: 626350, max: Infinity, rate: 37 },
  ],
};

const STANDARD_DEDUCTIONS_2025: Record<string, number> = {
  single: 15000,
  married_filing_jointly: 30000,
  married_filing_separately: 15000,
  head_of_household: 22500,
};

const CONTRIBUTION_LIMITS_2025 = {
  "401k_employee": 23500,
  "401k_catch_up_50_plus": 7500,
  "401k_catch_up_60_63": 11250,
  ira_traditional: 7000,
  ira_catch_up_50_plus: 1000,
  hsa_self: 4300,
  hsa_family: 8550,
  hsa_catch_up_55_plus: 1000,
  "529_annual_gift_exclusion": 19000,
  "529_superfund_5yr": 95000,
  sep_ira_max: 70000,
  simple_ira: 16500,
  simple_ira_catch_up: 3500,
};

const ESTATE_TAX_2025 = {
  exemption_per_person: 13990000,
  exemption_married: 27980000,
  top_rate: 40,
  annual_gift_exclusion: 19000,
  sunset_date: "2025-12-31",
  sunset_reversion_amount: 7000000,
  sunset_note: "TCJA estate exemption sunsets after 2025. Without extension, exemption reverts to approximately $7M (inflation-adjusted) in 2026.",
};

const CAPITAL_GAINS_2025 = {
  long_term_rates: [
    { single_max: 48350, mfj_max: 96700, rate: 0 },
    { single_max: 533400, mfj_max: 600050, rate: 15 },
    { single_max: Infinity, mfj_max: Infinity, rate: 20 },
  ],
  niit_threshold_single: 200000,
  niit_threshold_mfj: 250000,
  niit_rate: 3.8,
  qualified_dividend_rates: "same_as_ltcg",
};

// ─── Seed Functions ────────────────────────────────────────────────────────

export async function seedTaxParameters2025(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const records: Array<{
    taxYear: number;
    parameterName: string;
    parameterCategory: string;
    filingStatus: string;
    valueJson: unknown;
    sourceUrl: string;
    effectiveDate: string;
    expiryDate?: string;
    notes?: string;
  }> = [];

  // Tax brackets per filing status
  for (const [status, brackets] of Object.entries(TAX_BRACKETS_2025)) {
    records.push({
      taxYear: 2025,
      parameterName: "income_tax_brackets",
      parameterCategory: "income_tax",
      filingStatus: status,
      valueJson: brackets,
      sourceUrl: "https://www.irs.gov/newsroom/irs-provides-tax-inflation-adjustments-for-tax-year-2025",
      effectiveDate: "2025-01-01",
      expiryDate: "2025-12-31",
    });
  }

  // Standard deductions per filing status
  for (const [status, amount] of Object.entries(STANDARD_DEDUCTIONS_2025)) {
    records.push({
      taxYear: 2025,
      parameterName: "standard_deduction",
      parameterCategory: "deductions",
      filingStatus: status,
      valueJson: { amount },
      sourceUrl: "https://www.irs.gov/newsroom/irs-provides-tax-inflation-adjustments-for-tax-year-2025",
      effectiveDate: "2025-01-01",
      expiryDate: "2025-12-31",
    });
  }

  // Contribution limits
  records.push({
    taxYear: 2025,
    parameterName: "contribution_limits",
    parameterCategory: "retirement",
    filingStatus: "all",
    valueJson: CONTRIBUTION_LIMITS_2025,
    sourceUrl: "https://www.irs.gov/newsroom/401k-limit-increases-to-23500-for-2025",
    effectiveDate: "2025-01-01",
    expiryDate: "2025-12-31",
  });

  // Estate tax
  records.push({
    taxYear: 2025,
    parameterName: "estate_tax_parameters",
    parameterCategory: "estate",
    filingStatus: "all",
    valueJson: ESTATE_TAX_2025,
    sourceUrl: "https://www.irs.gov/businesses/small-businesses-self-employed/estate-tax",
    effectiveDate: "2025-01-01",
    expiryDate: "2025-12-31",
    notes: ESTATE_TAX_2025.sunset_note,
  });

  // Capital gains
  records.push({
    taxYear: 2025,
    parameterName: "capital_gains_rates",
    parameterCategory: "capital_gains",
    filingStatus: "all",
    valueJson: CAPITAL_GAINS_2025,
    sourceUrl: "https://www.irs.gov/taxtopics/tc409",
    effectiveDate: "2025-01-01",
    expiryDate: "2025-12-31",
  });

  // AMT
  records.push({
    taxYear: 2025,
    parameterName: "amt_exemption",
    parameterCategory: "amt",
    filingStatus: "single",
    valueJson: { exemption: 88100, phaseout_start: 626350 },
    sourceUrl: "https://www.irs.gov/newsroom/irs-provides-tax-inflation-adjustments-for-tax-year-2025",
    effectiveDate: "2025-01-01",
    expiryDate: "2025-12-31",
  });

  records.push({
    taxYear: 2025,
    parameterName: "amt_exemption",
    parameterCategory: "amt",
    filingStatus: "married_filing_jointly",
    valueJson: { exemption: 137000, phaseout_start: 1252700 },
    sourceUrl: "https://www.irs.gov/newsroom/irs-provides-tax-inflation-adjustments-for-tax-year-2025",
    effectiveDate: "2025-01-01",
    expiryDate: "2025-12-31",
  });

  // Insert with ON DUPLICATE KEY UPDATE pattern
  let inserted = 0;
  for (const rec of records) {
    try {
      await db.insert(taxParameters).values(rec as any);
      inserted++;
    } catch (e: any) {
      if (e?.code === "ER_DUP_ENTRY") {
        // Already seeded, skip
      } else {
        console.error("[TaxParams] Insert error:", e?.message);
      }
    }
  }

  return inserted;
}

// ─── Lookup Functions ──────────────────────────────────────────────────────

export async function getTaxBrackets(year: number, filingStatus: string) {
  const db = await getDb();
  if (!db) return TAX_BRACKETS_2025[filingStatus as keyof typeof TAX_BRACKETS_2025] || TAX_BRACKETS_2025.single;

  const rows = await db
    .select()
    .from(taxParameters)
    .where(
      and(
        eq(taxParameters.taxYear, year),
        eq(taxParameters.parameterName, "income_tax_brackets"),
        eq(taxParameters.filingStatus, filingStatus)
      )
    )
    .limit(1);

  if (rows.length > 0) return rows[0].valueJson;
  // Fallback to hardcoded 2025
  return TAX_BRACKETS_2025[filingStatus as keyof typeof TAX_BRACKETS_2025] || TAX_BRACKETS_2025.single;
}

export async function getStandardDeduction(year: number, filingStatus: string) {
  const db = await getDb();
  if (!db) return STANDARD_DEDUCTIONS_2025[filingStatus] || STANDARD_DEDUCTIONS_2025.single;

  const rows = await db
    .select()
    .from(taxParameters)
    .where(
      and(
        eq(taxParameters.taxYear, year),
        eq(taxParameters.parameterName, "standard_deduction"),
        eq(taxParameters.filingStatus, filingStatus)
      )
    )
    .limit(1);

  if (rows.length > 0) return (rows[0].valueJson as any)?.amount;
  return STANDARD_DEDUCTIONS_2025[filingStatus] || STANDARD_DEDUCTIONS_2025.single;
}

export async function getContributionLimits(year: number) {
  const db = await getDb();
  if (!db) return CONTRIBUTION_LIMITS_2025;

  const rows = await db
    .select()
    .from(taxParameters)
    .where(
      and(
        eq(taxParameters.taxYear, year),
        eq(taxParameters.parameterName, "contribution_limits")
      )
    )
    .limit(1);

  if (rows.length > 0) return rows[0].valueJson;
  return CONTRIBUTION_LIMITS_2025;
}

export async function getEstateParameters(year: number) {
  const db = await getDb();
  if (!db) return ESTATE_TAX_2025;

  const rows = await db
    .select()
    .from(taxParameters)
    .where(
      and(
        eq(taxParameters.taxYear, year),
        eq(taxParameters.parameterName, "estate_tax_parameters")
      )
    )
    .limit(1);

  if (rows.length > 0) return rows[0].valueJson;
  return ESTATE_TAX_2025;
}

export async function getCapitalGainsRates(year: number) {
  const db = await getDb();
  if (!db) return CAPITAL_GAINS_2025;

  const rows = await db
    .select()
    .from(taxParameters)
    .where(
      and(
        eq(taxParameters.taxYear, year),
        eq(taxParameters.parameterName, "capital_gains_rates")
      )
    )
    .limit(1);

  if (rows.length > 0) return rows[0].valueJson;
  return CAPITAL_GAINS_2025;
}

export async function getAllTaxParametersForYear(year: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(taxParameters)
    .where(eq(taxParameters.taxYear, year));
}

// ─── Tax Calculation Helpers ───────────────────────────────────────────────

export function calculateFederalTax(
  taxableIncome: number,
  brackets: Array<{ min: number; max: number; rate: number }>
): number {
  let tax = 0;
  for (const bracket of brackets) {
    if (taxableIncome <= bracket.min) break;
    const taxableInBracket = Math.min(taxableIncome, bracket.max === Infinity ? taxableIncome : bracket.max) - bracket.min;
    tax += taxableInBracket * (bracket.rate / 100);
  }
  return Math.round(tax * 100) / 100;
}

export function getMarginalRate(
  taxableIncome: number,
  brackets: Array<{ min: number; max: number; rate: number }>
): number {
  for (let i = brackets.length - 1; i >= 0; i--) {
    if (taxableIncome > brackets[i].min) return brackets[i].rate;
  }
  return brackets[0].rate;
}

export function getEstateSunsetWarning(year: number): string | null {
  if (year >= 2026) {
    return "The TCJA estate tax exemption has sunset. The exemption has reverted to approximately $7M per person (inflation-adjusted). Clients with estates between $7M and $14M per person should review their estate plans.";
  }
  if (year === 2025) {
    return "WARNING: The TCJA estate tax exemption ($13.99M per person) sunsets after December 31, 2025. Without Congressional action, the exemption reverts to approximately $7M. Clients should consider accelerated gifting strategies before year-end.";
  }
  return null;
}
