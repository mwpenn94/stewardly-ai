import { getDb } from "../db";
import { medicareParameters } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

// ─── Medicare 2025 Parameters (CMS) ───────────────────────────────────────

const MEDICARE_2025 = {
  part_b_premium: 185.00,
  part_b_deductible: 257,
  part_a_deductible: 1676,
  part_a_coinsurance_61_90: 419,
  part_a_coinsurance_91_150: 838,
  part_d_deductible: 590,
  irmaa_brackets: [
    { single_min: 0, single_max: 106000, mfj_min: 0, mfj_max: 212000, part_b_surcharge: 0, part_d_surcharge: 0 },
    { single_min: 106000, single_max: 133000, mfj_min: 212000, mfj_max: 266000, part_b_surcharge: 74.00, part_d_surcharge: 13.70 },
    { single_min: 133000, single_max: 167000, mfj_min: 266000, mfj_max: 334000, part_b_surcharge: 185.00, part_d_surcharge: 35.30 },
    { single_min: 167000, single_max: 200000, mfj_min: 334000, mfj_max: 400000, part_b_surcharge: 295.90, part_d_surcharge: 57.00 },
    { single_min: 200000, single_max: 500000, mfj_min: 400000, mfj_max: 750000, part_b_surcharge: 406.90, part_d_surcharge: 78.60 },
    { single_min: 500000, single_max: Infinity, mfj_min: 750000, mfj_max: Infinity, part_b_surcharge: 443.90, part_d_surcharge: 85.80 },
  ],
  hsa_eligibility_cutoff_age: 65,
  hsa_note: "HSA contributions must stop the month Medicare coverage begins (typically age 65). Clients should plan to max out HSA contributions before enrollment.",
  medigap_open_enrollment_months: 6,
  medigap_note: "Medigap open enrollment begins the month a person turns 65 AND is enrolled in Part B. During this 6-month window, insurers cannot deny coverage or charge more due to health conditions.",
};

// ─── Seed Functions ────────────────────────────────────────────────────────

export async function seedMedicareParameters2025(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  let inserted = 0;
  const params = [
    { name: "part_b_premium", value: { monthly: MEDICARE_2025.part_b_premium } },
    { name: "part_b_deductible", value: { annual: MEDICARE_2025.part_b_deductible } },
    { name: "part_a_deductible", value: { per_benefit_period: MEDICARE_2025.part_a_deductible } },
    { name: "part_a_coinsurance", value: { days_61_90: MEDICARE_2025.part_a_coinsurance_61_90, days_91_150: MEDICARE_2025.part_a_coinsurance_91_150 } },
    { name: "part_d_deductible", value: { annual: MEDICARE_2025.part_d_deductible } },
    { name: "irmaa_brackets", value: MEDICARE_2025.irmaa_brackets },
    { name: "hsa_eligibility", value: { cutoff_age: MEDICARE_2025.hsa_eligibility_cutoff_age, note: MEDICARE_2025.hsa_note } },
    { name: "medigap_enrollment", value: { open_enrollment_months: MEDICARE_2025.medigap_open_enrollment_months, note: MEDICARE_2025.medigap_note } },
  ];

  for (const p of params) {
    try {
      await db.insert(medicareParameters).values({
        parameterYear: 2025,
        parameterName: p.name,
        valueJson: p.value,
        sourceUrl: "https://www.cms.gov/newsroom/fact-sheets/2025-medicare-parts-b-premiums-and-deductibles",
        effectiveDate: "2025-01-01",
      });
      inserted++;
    } catch (e: any) {
      if (!e?.message?.includes("Duplicate")) console.error("[Medicare] Insert error:", e?.message);
    }
  }

  return inserted;
}

// ─── Lookup Functions ──────────────────────────────────────────────────────

export async function getPartBPremium(year: number): Promise<number> {
  const db = await getDb();
  if (!db) return MEDICARE_2025.part_b_premium;

  const rows = await db
    .select()
    .from(medicareParameters)
    .where(and(eq(medicareParameters.parameterYear, year), eq(medicareParameters.parameterName, "part_b_premium")))
    .limit(1);

  if (rows.length > 0) return (rows[0].valueJson as any)?.monthly ?? MEDICARE_2025.part_b_premium;
  return MEDICARE_2025.part_b_premium;
}

export async function getIrmaaBrackets(year: number) {
  const db = await getDb();
  if (!db) return MEDICARE_2025.irmaa_brackets;

  const rows = await db
    .select()
    .from(medicareParameters)
    .where(and(eq(medicareParameters.parameterYear, year), eq(medicareParameters.parameterName, "irmaa_brackets")))
    .limit(1);

  if (rows.length > 0) return rows[0].valueJson;
  return MEDICARE_2025.irmaa_brackets;
}

// ─── IRMAA Calculator ──────────────────────────────────────────────────────

export interface IrmaaResult {
  tier: number;
  partBPremium: number;
  partBSurcharge: number;
  partDSurcharge: number;
  totalMonthlyPremium: number;
  totalAnnualPremium: number;
  magi: number;
  filingStatus: string;
}

export function calculateIrmaa(
  magi: number,
  filingStatus: "single" | "married_filing_jointly",
  basePremium: number = MEDICARE_2025.part_b_premium,
  brackets = MEDICARE_2025.irmaa_brackets
): IrmaaResult {
  let tier = 0;
  let partBSurcharge = 0;
  let partDSurcharge = 0;

  for (let i = brackets.length - 1; i >= 0; i--) {
    const bracket = brackets[i];
    const min = filingStatus === "single" ? bracket.single_min : bracket.mfj_min;
    if (magi > min) {
      tier = i;
      partBSurcharge = bracket.part_b_surcharge;
      partDSurcharge = bracket.part_d_surcharge;
      break;
    }
  }

  const totalMonthly = basePremium + partBSurcharge + partDSurcharge;

  return {
    tier,
    partBPremium: basePremium,
    partBSurcharge,
    partDSurcharge,
    totalMonthlyPremium: totalMonthly,
    totalAnnualPremium: totalMonthly * 12,
    magi,
    filingStatus,
  };
}

// ─── HSA Cutoff Logic ──────────────────────────────────────────────────────

export function getHsaCutoffDate(birthDate: Date): { cutoffDate: Date; monthsRemaining: number; warning: string } {
  const cutoffDate = new Date(birthDate);
  cutoffDate.setFullYear(cutoffDate.getFullYear() + MEDICARE_2025.hsa_eligibility_cutoff_age);

  const now = new Date();
  const monthsRemaining = Math.max(0, (cutoffDate.getFullYear() - now.getFullYear()) * 12 + (cutoffDate.getMonth() - now.getMonth()));

  let warning = "";
  if (monthsRemaining <= 0) {
    warning = "HSA contributions should have stopped when Medicare coverage began. Excess contributions may incur a 6% excise tax.";
  } else if (monthsRemaining <= 12) {
    warning = `HSA eligibility ends in ${monthsRemaining} months when Medicare begins. Maximize contributions now — consider front-loading the annual limit.`;
  } else if (monthsRemaining <= 36) {
    warning = `HSA eligibility ends in approximately ${Math.round(monthsRemaining / 12)} years. Plan to maximize catch-up contributions ($1,000 extra if 55+).`;
  }

  return { cutoffDate, monthsRemaining, warning };
}

export function getRetirementHealthcareCostEstimate(currentAge: number, sex: "male" | "female"): {
  estimatedLifetimeCost: number;
  annualCostAtRetirement: number;
  inflationAssumption: number;
  note: string;
} {
  // Fidelity 2024 estimate: average 65-year-old couple needs ~$315,000 for healthcare in retirement
  // Per person: ~$157,500
  const baseCostPerPerson = sex === "male" ? 150000 : 165000;
  const annualAtRetirement = sex === "male" ? 7500 : 8500;
  const inflationRate = 0.055; // Healthcare inflation ~5.5%

  const yearsToRetirement = Math.max(0, 65 - currentAge);
  const adjustedLifetime = baseCostPerPerson * Math.pow(1 + inflationRate, yearsToRetirement);
  const adjustedAnnual = annualAtRetirement * Math.pow(1 + inflationRate, yearsToRetirement);

  return {
    estimatedLifetimeCost: Math.round(adjustedLifetime),
    annualCostAtRetirement: Math.round(adjustedAnnual),
    inflationAssumption: inflationRate * 100,
    note: "Based on Fidelity Retiree Health Care Cost Estimate (2024), adjusted for healthcare inflation. Includes Medicare premiums, Medigap, Part D, dental, vision, and out-of-pocket costs. Does not include long-term care.",
  };
}
