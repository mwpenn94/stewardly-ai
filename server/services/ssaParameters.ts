import { getDb } from "../db";
import { ssaParameters, ssaLifeTables } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

// ─── SSA 2025 Parameters ──────────────────────────────────────────────────

const SSA_PARAMS_2025 = {
  full_retirement_age: { year: 1960, months: 0, fra: "67" },
  bend_points: { first: 1226, second: 7391 },
  bend_factors: { first: 0.90, second: 0.32, third: 0.15 },
  cola_2025: 2.5,
  max_taxable_earnings: 176100,
  tax_rate_employee: 6.2,
  tax_rate_employer: 6.2,
  earnings_test_under_fra: { exempt_amount: 23400, withhold_rate: 0.5 },
  earnings_test_fra_year: { exempt_amount: 62160, withhold_rate: 0.333 },
  delayed_retirement_credit: 8.0,
  early_retirement_reduction_per_month_first_36: 0.5556,
  early_retirement_reduction_per_month_after_36: 0.4167,
  spousal_benefit_max_percent: 50,
  survivor_benefit_max_percent: 100,
  minimum_quarters_of_coverage: 40,
};

// ─── Life Table Data (SSA Period Life Table 2021, abridged) ────────────────

const LIFE_TABLE_MALE = [
  { age: 0, qx: "0.005590", ex: "74.50" }, { age: 1, qx: "0.000380", ex: "73.92" },
  { age: 5, qx: "0.000110", ex: "69.95" }, { age: 10, qx: "0.000090", ex: "64.96" },
  { age: 15, qx: "0.000410", ex: "59.99" }, { age: 20, qx: "0.001100", ex: "55.11" },
  { age: 25, qx: "0.001200", ex: "50.30" }, { age: 30, qx: "0.001350", ex: "45.48" },
  { age: 35, qx: "0.001600", ex: "40.67" }, { age: 40, qx: "0.002100", ex: "35.91" },
  { age: 45, qx: "0.003100", ex: "31.24" }, { age: 50, qx: "0.004800", ex: "26.72" },
  { age: 55, qx: "0.007600", ex: "22.42" }, { age: 60, qx: "0.011800", ex: "18.37" },
  { age: 62, qx: "0.013800", ex: "16.79" }, { age: 65, qx: "0.017200", ex: "14.64" },
  { age: 67, qx: "0.020200", ex: "13.19" }, { age: 70, qx: "0.026100", ex: "11.22" },
  { age: 75, qx: "0.042000", ex: "8.58" }, { age: 80, qx: "0.068000", ex: "6.33" },
  { age: 85, qx: "0.112000", ex: "4.52" }, { age: 90, qx: "0.179000", ex: "3.13" },
  { age: 95, qx: "0.271000", ex: "2.14" }, { age: 100, qx: "0.382000", ex: "1.50" },
];

const LIFE_TABLE_FEMALE = [
  { age: 0, qx: "0.004660", ex: "79.90" }, { age: 1, qx: "0.000310", ex: "79.27" },
  { age: 5, qx: "0.000090", ex: "75.30" }, { age: 10, qx: "0.000070", ex: "70.31" },
  { age: 15, qx: "0.000200", ex: "65.33" }, { age: 20, qx: "0.000400", ex: "60.38" },
  { age: 25, qx: "0.000480", ex: "55.46" }, { age: 30, qx: "0.000580", ex: "50.55" },
  { age: 35, qx: "0.000780", ex: "45.67" }, { age: 40, qx: "0.001150", ex: "40.84" },
  { age: 45, qx: "0.001750", ex: "36.10" }, { age: 50, qx: "0.002800", ex: "31.48" },
  { age: 55, qx: "0.004500", ex: "27.02" }, { age: 60, qx: "0.007000", ex: "22.76" },
  { age: 62, qx: "0.008200", ex: "21.04" }, { age: 65, qx: "0.010500", ex: "18.55" },
  { age: 67, qx: "0.012500", ex: "16.89" }, { age: 70, qx: "0.016500", ex: "14.63" },
  { age: 75, qx: "0.028000", ex: "11.27" }, { age: 80, qx: "0.047000", ex: "8.34" },
  { age: 85, qx: "0.081000", ex: "5.89" }, { age: 90, qx: "0.139000", ex: "4.00" },
  { age: 95, qx: "0.222000", ex: "2.66" }, { age: 100, qx: "0.330000", ex: "1.79" },
];

// ─── Seed Functions ────────────────────────────────────────────────────────

export async function seedSsaParameters2025(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  let inserted = 0;

  // SSA parameters
  const params = [
    { name: "bend_points", value: SSA_PARAMS_2025.bend_points },
    { name: "bend_factors", value: SSA_PARAMS_2025.bend_factors },
    { name: "cola", value: { rate: SSA_PARAMS_2025.cola_2025 } },
    { name: "max_taxable_earnings", value: { amount: SSA_PARAMS_2025.max_taxable_earnings } },
    { name: "tax_rates", value: { employee: SSA_PARAMS_2025.tax_rate_employee, employer: SSA_PARAMS_2025.tax_rate_employer } },
    { name: "earnings_test", value: { under_fra: SSA_PARAMS_2025.earnings_test_under_fra, fra_year: SSA_PARAMS_2025.earnings_test_fra_year } },
    { name: "delayed_retirement_credit", value: { annual_percent: SSA_PARAMS_2025.delayed_retirement_credit } },
    { name: "early_retirement_reduction", value: { per_month_first_36: SSA_PARAMS_2025.early_retirement_reduction_per_month_first_36, per_month_after_36: SSA_PARAMS_2025.early_retirement_reduction_per_month_after_36 } },
    { name: "spousal_benefit", value: { max_percent: SSA_PARAMS_2025.spousal_benefit_max_percent } },
    { name: "survivor_benefit", value: { max_percent: SSA_PARAMS_2025.survivor_benefit_max_percent } },
    { name: "full_retirement_age", value: SSA_PARAMS_2025.full_retirement_age },
  ];

  for (const p of params) {
    try {
      await db.insert(ssaParameters).values({
        parameterYear: 2025,
        parameterName: p.name,
        valueJson: p.value,
        sourceUrl: "https://www.ssa.gov/oact/cola/Benefits.html",
        effectiveDate: "2025-01-01",
      });
      inserted++;
    } catch (e: any) {
      if (!e?.message?.includes("Duplicate")) console.error("[SSA] Insert error:", e?.message);
    }
  }

  // Life tables
  for (const row of LIFE_TABLE_MALE) {
    try {
      await db.insert(ssaLifeTables).values({
        age: row.age, sex: "male",
        probabilityOfDeath: row.qx, lifeExpectancy: row.ex,
        tableYear: 2021,
      });
      inserted++;
    } catch (e: any) { /* skip duplicates */ }
  }
  for (const row of LIFE_TABLE_FEMALE) {
    try {
      await db.insert(ssaLifeTables).values({
        age: row.age, sex: "female",
        probabilityOfDeath: row.qx, lifeExpectancy: row.ex,
        tableYear: 2021,
      });
      inserted++;
    } catch (e: any) { /* skip duplicates */ }
  }

  return inserted;
}

// ─── PIA Calculation ───────────────────────────────────────────────────────

export function calculatePIA(
  aime: number,
  bendPoints = SSA_PARAMS_2025.bend_points,
  bendFactors = SSA_PARAMS_2025.bend_factors
): number {
  let pia = 0;
  if (aime <= bendPoints.first) {
    pia = aime * bendFactors.first;
  } else if (aime <= bendPoints.second) {
    pia = bendPoints.first * bendFactors.first +
      (aime - bendPoints.first) * bendFactors.second;
  } else {
    pia = bendPoints.first * bendFactors.first +
      (bendPoints.second - bendPoints.first) * bendFactors.second +
      (aime - bendPoints.second) * bendFactors.third;
  }
  return Math.floor(pia * 10) / 10; // SSA rounds down to nearest dime
}

export function calculateAIME(earningsHistory: number[]): number {
  // Take top 35 years, divide by 420 months
  const sorted = [...earningsHistory].sort((a, b) => b - a);
  const top35 = sorted.slice(0, 35);
  while (top35.length < 35) top35.push(0);
  const totalEarnings = top35.reduce((s, e) => s + e, 0);
  return Math.floor(totalEarnings / 420);
}

// ─── Benefit at Different Ages ─────────────────────────────────────────────

export function getBenefitAtAge(pia: number, claimingAge: number, fraAge: number = 67): number {
  if (claimingAge === fraAge) return pia;

  const monthsDiff = (claimingAge - fraAge) * 12;

  if (claimingAge < fraAge) {
    // Early: reduce
    const monthsEarly = Math.abs(monthsDiff);
    let reduction = 0;
    if (monthsEarly <= 36) {
      reduction = monthsEarly * (SSA_PARAMS_2025.early_retirement_reduction_per_month_first_36 / 100);
    } else {
      reduction = 36 * (SSA_PARAMS_2025.early_retirement_reduction_per_month_first_36 / 100) +
        (monthsEarly - 36) * (SSA_PARAMS_2025.early_retirement_reduction_per_month_after_36 / 100);
    }
    return Math.round(pia * (1 - reduction) * 100) / 100;
  }

  // Delayed: increase (up to age 70)
  const monthsDelayed = Math.min(monthsDiff, 36); // max 3 years past FRA
  const increase = monthsDelayed * (SSA_PARAMS_2025.delayed_retirement_credit / 12 / 100);
  return Math.round(pia * (1 + increase) * 100) / 100;
}

export function calculateSpousalBenefit(workerPia: number, ownPia: number): number {
  const spousalMax = workerPia * (SSA_PARAMS_2025.spousal_benefit_max_percent / 100);
  return Math.max(0, spousalMax - ownPia);
}

export function calculateSurvivorBenefit(deceasedPia: number, survivorOwnPia: number): number {
  const survivorMax = deceasedPia * (SSA_PARAMS_2025.survivor_benefit_max_percent / 100);
  return Math.max(survivorMax, survivorOwnPia);
}

// ─── Claiming Strategy Optimizer ───────────────────────────────────────────

export interface ClaimingScenario {
  age: number;
  monthlyBenefit: number;
  annualBenefit: number;
  breakEvenVsFRA: number | null;
  lifetimeBenefitAtAge85: number;
}

export function optimizeClaimingStrategy(pia: number, fraAge: number = 67): ClaimingScenario[] {
  const scenarios: ClaimingScenario[] = [];
  const fraBenefit = getBenefitAtAge(pia, fraAge, fraAge);

  for (let age = 62; age <= 70; age++) {
    const monthly = getBenefitAtAge(pia, age, fraAge);
    const annual = monthly * 12;

    // Break-even vs FRA
    let breakEven: number | null = null;
    if (age !== fraAge) {
      const fraAnnual = fraBenefit * 12;
      // Cumulative at age X: benefit * (X - claimAge)
      // Find X where cumulative_claim = cumulative_fra
      // annual * (X - age) = fraAnnual * (X - fraAge)
      // X * (annual - fraAnnual) = annual * age - fraAnnual * fraAge
      if (annual !== fraAnnual) {
        breakEven = Math.round(((annual * age - fraAnnual * fraAge) / (annual - fraAnnual)) * 10) / 10;
      }
    }

    const lifetimeAt85 = annual * (85 - age);

    scenarios.push({
      age,
      monthlyBenefit: monthly,
      annualBenefit: annual,
      breakEvenVsFRA: breakEven,
      lifetimeBenefitAtAge85: lifetimeAt85,
    });
  }

  return scenarios;
}

// ─── Life Expectancy Lookup ────────────────────────────────────────────────

export async function getLifeExpectancy(age: number, sex: "male" | "female"): Promise<number> {
  const db = await getDb();
  if (!db) {
    // Fallback to hardcoded
    const table = sex === "male" ? LIFE_TABLE_MALE : LIFE_TABLE_FEMALE;
    const closest = table.reduce((prev, curr) =>
      Math.abs(curr.age - age) < Math.abs(prev.age - age) ? curr : prev
    );
    return parseFloat(closest.ex);
  }

  const rows = await db
    .select()
    .from(ssaLifeTables)
    .where(and(eq(ssaLifeTables.age, age), eq(ssaLifeTables.sex, sex)))
    .limit(1);

  if (rows.length > 0) return parseFloat(rows[0].lifeExpectancy);

  // Fallback
  const table = sex === "male" ? LIFE_TABLE_MALE : LIFE_TABLE_FEMALE;
  const closest = table.reduce((prev, curr) =>
    Math.abs(curr.age - age) < Math.abs(prev.age - age) ? curr : prev
  );
  return parseFloat(closest.ex);
}
