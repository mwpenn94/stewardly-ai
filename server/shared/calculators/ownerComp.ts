/**
 * Owner Compensation Engine (OCE) — force multiplier for business owners.
 *
 * Complements BIE (producer income forecasting) with a dedicated
 * owner-operator cash-flow / tax / retirement stack:
 *
 *   • Entity comparison (Sole Prop, LLC/Partnership, S-Corp, C-Corp)
 *   • Reasonable compensation split (S-Corp salary vs distribution)
 *   • Self-employment tax + FICA + QBI 199A deduction
 *   • Retirement contribution stacking (Solo 401k, SEP, Defined Benefit)
 *   • Net take-home after federal income tax
 *   • Business valuation (SDE/EBITDA multiples, 5-year exit projection)
 *
 * All pure functions — no IO, no database, no network. Safe to run
 * thousands of times per second inside the React UI or inside the
 * tRPC/ReAct agent orchestrator.
 *
 * April 2026 tax constants (single-filer defaults):
 *   • SS wage base: $176,100 (SSA)
 *   • SE tax: 15.3% on first $176,100; 2.9% Medicare above + 0.9%
 *     additional Medicare above $200k.
 *   • QBI: 20% deduction on qualified business income, phase-out
 *     for SSTBs begins at $241,950 single / $483,900 MFJ taxable income.
 *   • 401(k): $23,500 employee + $77,500 combined (age 50+ adds $7,500).
 *   • SEP-IRA: lesser of 25% compensation or $70,000.
 *   • DB plan target: $280,000 annual benefit cap.
 */

export type EntityType = "sole_prop" | "llc" | "s_corp" | "c_corp";

export type FilingStatus = "single" | "mfj" | "hoh";

// ───────────────────────────────────────────────────────────
// CONSTANTS (April 2026)
// ───────────────────────────────────────────────────────────

export const OWNER_COMP_CONSTANTS = {
  SS_WAGE_BASE: 176_100,
  SS_RATE: 0.062,
  SS_SE_RATE: 0.124, // both halves
  MEDICARE_RATE: 0.0145,
  MEDICARE_SE_RATE: 0.029,
  ADDL_MEDICARE_RATE: 0.009,
  ADDL_MEDICARE_THRESHOLD: 200_000,
  SE_DEDUCTIBLE_PORTION: 0.9235, // 92.35% of net SE income
  QBI_RATE: 0.2,
  QBI_PHASEOUT_SINGLE_START: 241_950,
  QBI_PHASEOUT_SINGLE_END: 291_950,
  QBI_PHASEOUT_MFJ_START: 483_900,
  QBI_PHASEOUT_MFJ_END: 583_900,
  SOLO_401K_EMPLOYEE: 23_500,
  SOLO_401K_COMBINED: 77_500,
  SOLO_401K_CATCHUP_50: 7_500,
  SEP_IRA_LIMIT: 70_000,
  SEP_IRA_PCT: 0.25,
  DB_ANNUAL_BENEFIT_CAP: 280_000,
  C_CORP_RATE: 0.21,
  STANDARD_DEDUCTION: { single: 15_000, mfj: 30_000, hoh: 22_500 } as Record<FilingStatus, number>,
  REASONABLE_COMP_FLOOR_PCT: 0.3, // at least 30% of net profit as salary (IRS safe harbor heuristic)
  REASONABLE_COMP_CEILING_PCT: 0.6, // <= 60% keeps pass-through distributions attractive
} as const;

// 2025 Federal brackets (same used by server/taxProjector.ts — kept in sync)
const FED_BRACKETS_SINGLE = [
  { min: 0, max: 11925, rate: 0.10 },
  { min: 11925, max: 48475, rate: 0.12 },
  { min: 48475, max: 103350, rate: 0.22 },
  { min: 103350, max: 197300, rate: 0.24 },
  { min: 197300, max: 250525, rate: 0.32 },
  { min: 250525, max: 626350, rate: 0.35 },
  { min: 626350, max: Number.POSITIVE_INFINITY, rate: 0.37 },
];

const FED_BRACKETS_MFJ = [
  { min: 0, max: 23850, rate: 0.10 },
  { min: 23850, max: 96950, rate: 0.12 },
  { min: 96950, max: 206700, rate: 0.22 },
  { min: 206700, max: 394600, rate: 0.24 },
  { min: 394600, max: 501050, rate: 0.32 },
  { min: 501050, max: 751600, rate: 0.35 },
  { min: 751600, max: Number.POSITIVE_INFINITY, rate: 0.37 },
];

const FED_BRACKETS_HOH = [
  { min: 0, max: 17000, rate: 0.10 },
  { min: 17000, max: 64850, rate: 0.12 },
  { min: 64850, max: 103350, rate: 0.22 },
  { min: 103350, max: 197300, rate: 0.24 },
  { min: 197300, max: 250500, rate: 0.32 },
  { min: 250500, max: 626350, rate: 0.35 },
  { min: 626350, max: Number.POSITIVE_INFINITY, rate: 0.37 },
];

function bracketsFor(status: FilingStatus) {
  return status === "mfj" ? FED_BRACKETS_MFJ : status === "hoh" ? FED_BRACKETS_HOH : FED_BRACKETS_SINGLE;
}

/** Pure federal-tax calculator on taxable income, no credits applied. */
export function calcFederalIncomeTax(taxableIncome: number, status: FilingStatus): number {
  if (taxableIncome <= 0) return 0;
  const brackets = bracketsFor(status);
  let tax = 0;
  for (const b of brackets) {
    if (taxableIncome <= b.min) break;
    const slice = Math.min(taxableIncome, b.max) - b.min;
    tax += slice * b.rate;
  }
  return tax;
}

// ───────────────────────────────────────────────────────────
// FICA / SELF-EMPLOYMENT TAX
// ───────────────────────────────────────────────────────────

export interface PayrollTaxResult {
  ssTax: number;
  medicareTax: number;
  addlMedicareTax: number;
  total: number;
  deductibleHalf: number; // for SE only
}

/** W-2 employee payroll tax (employee side only). */
export function calcEmployeePayrollTax(wages: number): PayrollTaxResult {
  const ss = Math.min(wages, OWNER_COMP_CONSTANTS.SS_WAGE_BASE) * OWNER_COMP_CONSTANTS.SS_RATE;
  const medicare = wages * OWNER_COMP_CONSTANTS.MEDICARE_RATE;
  const addl = Math.max(0, wages - OWNER_COMP_CONSTANTS.ADDL_MEDICARE_THRESHOLD) * OWNER_COMP_CONSTANTS.ADDL_MEDICARE_RATE;
  const total = ss + medicare + addl;
  return { ssTax: ss, medicareTax: medicare, addlMedicareTax: addl, total, deductibleHalf: 0 };
}

/** Self-employment tax on Schedule C / K-1 net earnings. */
export function calcSelfEmploymentTax(netSeIncome: number): PayrollTaxResult {
  if (netSeIncome <= 0) {
    return { ssTax: 0, medicareTax: 0, addlMedicareTax: 0, total: 0, deductibleHalf: 0 };
  }
  const seBase = netSeIncome * OWNER_COMP_CONSTANTS.SE_DEDUCTIBLE_PORTION;
  const ss = Math.min(seBase, OWNER_COMP_CONSTANTS.SS_WAGE_BASE) * OWNER_COMP_CONSTANTS.SS_SE_RATE;
  const medicare = seBase * OWNER_COMP_CONSTANTS.MEDICARE_SE_RATE;
  const addl = Math.max(0, seBase - OWNER_COMP_CONSTANTS.ADDL_MEDICARE_THRESHOLD) * OWNER_COMP_CONSTANTS.ADDL_MEDICARE_RATE;
  const total = ss + medicare + addl;
  return {
    ssTax: ss,
    medicareTax: medicare,
    addlMedicareTax: addl,
    total,
    deductibleHalf: total / 2, // deductible above-the-line
  };
}

// ───────────────────────────────────────────────────────────
// QBI § 199A
// ───────────────────────────────────────────────────────────

export interface QbiInput {
  qualifiedBusinessIncome: number;
  taxableIncomeBeforeQbi: number;
  filingStatus: FilingStatus;
  isSstb?: boolean;
  w2Wages?: number;
  ubia?: number;
}

export interface QbiResult {
  deduction: number;
  phaseoutApplied: boolean;
  reason: string;
}

/**
 * § 199A Qualified Business Income Deduction.
 *
 * Simplified: 20% of QBI, capped at 20% of (taxable income - net capital
 * gains). For SSTBs above the phaseout ceiling, deduction = 0. Between
 * start and end, linearly phase out. Above ceiling for non-SSTB, apply
 * the W-2 wage / UBIA limitation (max of 50% W-2 or 25% W-2 + 2.5% UBIA).
 */
export function calcQbiDeduction(input: QbiInput): QbiResult {
  const {
    qualifiedBusinessIncome: qbi,
    taxableIncomeBeforeQbi: ti,
    filingStatus,
    isSstb = false,
    w2Wages = 0,
    ubia = 0,
  } = input;

  if (qbi <= 0 || ti <= 0) {
    return { deduction: 0, phaseoutApplied: false, reason: "no-qbi" };
  }

  const start = filingStatus === "mfj"
    ? OWNER_COMP_CONSTANTS.QBI_PHASEOUT_MFJ_START
    : OWNER_COMP_CONSTANTS.QBI_PHASEOUT_SINGLE_START;
  const end = filingStatus === "mfj"
    ? OWNER_COMP_CONSTANTS.QBI_PHASEOUT_MFJ_END
    : OWNER_COMP_CONSTANTS.QBI_PHASEOUT_SINGLE_END;

  const baseDeduction = qbi * OWNER_COMP_CONSTANTS.QBI_RATE;
  const tiCap = ti * 0.2; // naive approximation, ignores net capital gain subtraction

  // Below phaseout: no limitation
  if (ti <= start) {
    return { deduction: Math.min(baseDeduction, tiCap), phaseoutApplied: false, reason: "below-phaseout" };
  }

  // Above ceiling
  if (ti >= end) {
    if (isSstb) {
      return { deduction: 0, phaseoutApplied: true, reason: "sstb-above-ceiling" };
    }
    // W-2 / UBIA limitation applies
    const wageLimit = Math.max(w2Wages * 0.5, w2Wages * 0.25 + ubia * 0.025);
    return {
      deduction: Math.min(baseDeduction, tiCap, wageLimit),
      phaseoutApplied: true,
      reason: "w2-ubia-limit",
    };
  }

  // Within phaseout corridor (linear interpolation)
  const pct = (ti - start) / (end - start);
  if (isSstb) {
    const allowed = baseDeduction * (1 - pct);
    return { deduction: Math.min(allowed, tiCap), phaseoutApplied: true, reason: "sstb-phaseout" };
  }
  // Non-SSTB in the corridor: blend full deduction into w2-limited deduction
  const wageLimit = Math.max(w2Wages * 0.5, w2Wages * 0.25 + ubia * 0.025);
  const limitedDeduction = Math.min(baseDeduction, wageLimit);
  const blended = baseDeduction - (baseDeduction - limitedDeduction) * pct;
  return {
    deduction: Math.min(blended, tiCap),
    phaseoutApplied: true,
    reason: "corridor-blend",
  };
}

// ───────────────────────────────────────────────────────────
// RETIREMENT PLAN STACKING
// ───────────────────────────────────────────────────────────

export type RetirementPlanKind = "solo_401k" | "sep_ira" | "simple_ira" | "defined_benefit" | "none";

export interface RetirementRecommendation {
  plan: RetirementPlanKind;
  employeeContribution: number;
  employerContribution: number;
  total: number;
  afterTaxSavings: number; // approximation — marginal rate × contribution
  reasoning: string;
}

export interface RetirementInput {
  age: number;
  netSeOrW2Income: number;
  marginalRate: number;
  hasEmployees?: boolean;
  targetYearsToRetire?: number;
}

/**
 * Recommend a tax-optimized retirement plan stack for a single owner.
 * Heuristics:
 *   • Under $100k net: Solo 401(k) to capture the full $23,500 elective.
 *   • $100k–$300k: Solo 401(k) with max combined $77,500.
 *   • $300k+ with <3 years to retirement: add Defined Benefit plan
 *     (lets owner contribute $100k–$280k/yr).
 *   • Has rank-and-file employees: SEP-IRA (uniform percentage rule).
 */
export function recommendRetirementPlan(input: RetirementInput): RetirementRecommendation {
  const income = Math.max(0, input.netSeOrW2Income);
  const catchUp = input.age >= 50 ? OWNER_COMP_CONSTANTS.SOLO_401K_CATCHUP_50 : 0;

  if (input.hasEmployees) {
    const sep = Math.min(income * OWNER_COMP_CONSTANTS.SEP_IRA_PCT, OWNER_COMP_CONSTANTS.SEP_IRA_LIMIT);
    return {
      plan: "sep_ira",
      employeeContribution: 0,
      employerContribution: sep,
      total: sep,
      afterTaxSavings: sep * input.marginalRate,
      reasoning: "SEP-IRA — uniform rate across owner + employees; simplest plan to administer.",
    };
  }

  const employee = Math.min(income, OWNER_COMP_CONSTANTS.SOLO_401K_EMPLOYEE + catchUp);
  const employerRoom = Math.max(0, OWNER_COMP_CONSTANTS.SOLO_401K_COMBINED + catchUp - employee);
  // Employer profit-sharing can be up to 25% of W-2 comp (or 20% SE earnings)
  const employer = Math.min(employerRoom, income * 0.2);

  if (
    income >= 300_000 &&
    (input.targetYearsToRetire ?? 20) <= 15 &&
    input.age >= 45
  ) {
    // Add DB plan layer — approximate annual contribution target
    const dbTarget = Math.min(
      OWNER_COMP_CONSTANTS.DB_ANNUAL_BENEFIT_CAP,
      Math.max(100_000, income * 0.4),
    );
    return {
      plan: "defined_benefit",
      employeeContribution: employee,
      employerContribution: employer + dbTarget,
      total: employee + employer + dbTarget,
      afterTaxSavings: (employee + employer + dbTarget) * input.marginalRate,
      reasoning:
        "Defined Benefit + Solo 401(k) combo — large deductible contributions for high-income owners with a compressed retirement horizon.",
    };
  }

  return {
    plan: "solo_401k",
    employeeContribution: employee,
    employerContribution: employer,
    total: employee + employer,
    afterTaxSavings: (employee + employer) * input.marginalRate,
    reasoning:
      "Solo 401(k) — maximum flexibility, Roth option available, no nondiscrimination testing for solo owners.",
  };
}

// ───────────────────────────────────────────────────────────
// ENTITY OPTIMIZATION
// ───────────────────────────────────────────────────────────

export interface OwnerCompInput {
  netBusinessProfit: number; // before owner compensation
  entity: EntityType;
  filingStatus: FilingStatus;
  age: number;
  ownerSalary?: number; // S-Corp only — if omitted, engine suggests
  hasEmployees?: boolean;
  w2WagesToOthers?: number; // for QBI limitation
  ubia?: number;
  isSstb?: boolean;
  stateRate?: number; // flat approximation for state income tax
  retirementContributions?: number; // overrides recommended plan
  itemizedDeductions?: number; // 0 = use standard
  targetYearsToRetire?: number;
}

export interface OwnerCompSnapshot {
  entity: EntityType;
  grossProfit: number;
  ownerSalary: number;
  employerPayrollTax: number;
  employeePayrollTax: number;
  selfEmploymentTax: number;
  netDistributable: number; // distributions after comp + payroll taxes
  qbi: QbiResult;
  retirementPlan: RetirementRecommendation;
  taxableIncome: number;
  federalIncomeTax: number;
  stateTax: number;
  totalTaxes: number;
  netTakeHome: number;
  effectiveRate: number;
  notes: string[];
}

export function buildOwnerCompSnapshot(input: OwnerCompInput): OwnerCompSnapshot {
  const notes: string[] = [];
  const profit = Math.max(0, input.netBusinessProfit);

  let ownerSalary = 0;
  let employerPayroll = 0;
  let employeePayroll = 0;
  let seTax = 0;
  let netDistributable = 0;
  let qualifiedBi = 0;

  switch (input.entity) {
    case "sole_prop":
    case "llc": {
      // Pass-through, full self-employment tax on profit
      const se = calcSelfEmploymentTax(profit);
      seTax = se.total;
      ownerSalary = 0;
      netDistributable = profit - se.deductibleHalf;
      qualifiedBi = profit - se.deductibleHalf;
      notes.push("Schedule C / K-1 treatment — full self-employment tax applied.");
      break;
    }
    case "s_corp": {
      // Recommend salary between 30-60% of profit unless user pins one
      const defaultSalary = Math.max(
        profit * OWNER_COMP_CONSTANTS.REASONABLE_COMP_FLOOR_PCT,
        40_000,
      );
      ownerSalary = input.ownerSalary !== undefined
        ? Math.min(input.ownerSalary, profit)
        : Math.min(defaultSalary, profit * OWNER_COMP_CONSTANTS.REASONABLE_COMP_CEILING_PCT);
      // Employer matches employee FICA
      const emp = calcEmployeePayrollTax(ownerSalary);
      employeePayroll = emp.total;
      employerPayroll =
        Math.min(ownerSalary, OWNER_COMP_CONSTANTS.SS_WAGE_BASE) * OWNER_COMP_CONSTANTS.SS_RATE +
        ownerSalary * OWNER_COMP_CONSTANTS.MEDICARE_RATE;
      netDistributable = profit - ownerSalary - employerPayroll;
      qualifiedBi = netDistributable; // distributions flow to K-1
      notes.push(
        `S-Corp — owner salary $${ownerSalary.toLocaleString()} (${((ownerSalary / profit) * 100).toFixed(0)}% of profit). Distributions avoid FICA.`,
      );
      if (ownerSalary < profit * OWNER_COMP_CONSTANTS.REASONABLE_COMP_FLOOR_PCT) {
        notes.push(
          "Warning: owner salary below 30% of profit — IRS may reclassify distributions as wages.",
        );
      }
      break;
    }
    case "c_corp": {
      // C-corp: 21% corporate rate on profit; owner salary optional
      ownerSalary = input.ownerSalary ?? Math.min(profit * 0.6, 300_000);
      const emp = calcEmployeePayrollTax(ownerSalary);
      employeePayroll = emp.total;
      employerPayroll =
        Math.min(ownerSalary, OWNER_COMP_CONSTANTS.SS_WAGE_BASE) * OWNER_COMP_CONSTANTS.SS_RATE +
        ownerSalary * OWNER_COMP_CONSTANTS.MEDICARE_RATE;
      const corpTaxable = Math.max(0, profit - ownerSalary - employerPayroll);
      const corpTax = corpTaxable * OWNER_COMP_CONSTANTS.C_CORP_RATE;
      netDistributable = corpTaxable - corpTax; // retained after tax
      qualifiedBi = 0; // C-corp doesn't qualify for QBI
      notes.push(
        `C-Corp — 21% corporate tax applied to $${corpTaxable.toLocaleString()} retained profit. QBI deduction not available.`,
      );
      break;
    }
  }

  // Retirement plan recommendation based on salary or SE income
  const retirementBase =
    input.entity === "s_corp" || input.entity === "c_corp" ? ownerSalary : profit;

  const retirement = recommendRetirementPlan({
    age: input.age,
    netSeOrW2Income: retirementBase,
    marginalRate: 0.3, // placeholder, refined below
    hasEmployees: input.hasEmployees,
    targetYearsToRetire: input.targetYearsToRetire,
  });
  const retirementContrib = input.retirementContributions ?? retirement.total;

  // Taxable income calculation
  const wages = input.entity === "s_corp" || input.entity === "c_corp" ? ownerSalary : 0;
  const passThrough = input.entity === "c_corp" ? 0 : Math.max(0, qualifiedBi);
  const adjustedGross = wages + passThrough + netDistributable * (input.entity === "c_corp" ? 0 : 0);
  // AGI approximation: wages + K-1 income (for pass-throughs)
  const agi =
    input.entity === "c_corp"
      ? wages
      : wages + (input.entity === "sole_prop" || input.entity === "llc" ? qualifiedBi : netDistributable);
  void adjustedGross;

  const standardDeduction = OWNER_COMP_CONSTANTS.STANDARD_DEDUCTION[input.filingStatus];
  const deduction = Math.max(standardDeduction, input.itemizedDeductions ?? 0);
  const retirementDeduction = Math.min(retirementContrib, agi);
  const tiBeforeQbi = Math.max(0, agi - deduction - retirementDeduction);

  const qbi =
    input.entity === "c_corp"
      ? { deduction: 0, phaseoutApplied: false, reason: "c-corp-excluded" }
      : calcQbiDeduction({
          qualifiedBusinessIncome: qualifiedBi,
          taxableIncomeBeforeQbi: tiBeforeQbi,
          filingStatus: input.filingStatus,
          isSstb: input.isSstb,
          w2Wages: input.w2WagesToOthers ?? ownerSalary,
          ubia: input.ubia,
        });

  const taxableIncome = Math.max(0, tiBeforeQbi - qbi.deduction);
  const federalTax = calcFederalIncomeTax(taxableIncome, input.filingStatus);
  const stateTax = taxableIncome * (input.stateRate ?? 0.05);

  const marginalBracket = bracketsFor(input.filingStatus)
    .filter((b) => taxableIncome > b.min)
    .pop();
  const marginalRate = marginalBracket?.rate ?? 0.22;
  // Recompute retirement plan now that we have a real marginal rate
  const refinedRetirement = recommendRetirementPlan({
    age: input.age,
    netSeOrW2Income: retirementBase,
    marginalRate,
    hasEmployees: input.hasEmployees,
    targetYearsToRetire: input.targetYearsToRetire,
  });

  const cCorpTax =
    input.entity === "c_corp"
      ? Math.max(0, profit - ownerSalary - employerPayroll) * OWNER_COMP_CONSTANTS.C_CORP_RATE
      : 0;
  const totalTaxes = federalTax + stateTax + seTax + employeePayroll + employerPayroll + cCorpTax;
  const netTakeHome = profit - totalTaxes - retirementContrib;
  const effectiveRate = profit > 0 ? totalTaxes / profit : 0;

  notes.push(`Marginal bracket: ${(marginalRate * 100).toFixed(0)}%`);
  if (qbi.deduction > 0) {
    notes.push(`QBI deduction: $${Math.round(qbi.deduction).toLocaleString()}`);
  }
  notes.push(refinedRetirement.reasoning);

  return {
    entity: input.entity,
    grossProfit: profit,
    ownerSalary,
    employerPayrollTax: employerPayroll,
    employeePayrollTax: employeePayroll,
    selfEmploymentTax: seTax,
    netDistributable,
    qbi,
    retirementPlan: refinedRetirement,
    taxableIncome,
    federalIncomeTax: federalTax,
    stateTax,
    totalTaxes,
    netTakeHome,
    effectiveRate,
    notes,
  };
}

/**
 * Compare all entity structures side-by-side and rank by net take-home.
 * Used by the Unified Wealth Engine hub's "entity selector" force-multiplier.
 */
export function compareEntities(input: Omit<OwnerCompInput, "entity">): {
  results: OwnerCompSnapshot[];
  recommended: EntityType;
  savings: number;
} {
  const entities: EntityType[] = ["sole_prop", "llc", "s_corp", "c_corp"];
  const results = entities.map((entity) => buildOwnerCompSnapshot({ ...input, entity }));
  const sorted = [...results].sort((a, b) => b.netTakeHome - a.netTakeHome);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  return {
    results,
    recommended: best.entity,
    savings: best.netTakeHome - worst.netTakeHome,
  };
}

// ───────────────────────────────────────────────────────────
// BUSINESS VALUATION (quick multiples + 5-year exit projection)
// ───────────────────────────────────────────────────────────

export type ValuationMethod = "sde_multiple" | "ebitda_multiple" | "revenue_multiple";

export interface ValuationInput {
  annualRevenue: number;
  annualEbitda: number;
  ownerAddBack?: number; // owner salary + benefits
  growthRate?: number;
  industryMultiple?: number; // sde multiple override
  exitYears?: number;
}

export interface ValuationResult {
  method: ValuationMethod;
  currentValue: number;
  projectedExitValue: number;
  multipleApplied: number;
  sde: number;
  cagr: number;
  reasoning: string;
}

// Rough industry medians (BizBuySell / IBBA 2024 data; conservative).
const DEFAULT_MULTIPLES = {
  sub_500k: 2.0,
  sub_1m: 2.5,
  sub_5m: 3.5,
  sub_10m: 4.5,
  sub_25m: 5.5,
  above_25m: 6.5,
};

export function pickDefaultMultiple(sde: number): number {
  if (sde < 500_000) return DEFAULT_MULTIPLES.sub_500k;
  if (sde < 1_000_000) return DEFAULT_MULTIPLES.sub_1m;
  if (sde < 5_000_000) return DEFAULT_MULTIPLES.sub_5m;
  if (sde < 10_000_000) return DEFAULT_MULTIPLES.sub_10m;
  if (sde < 25_000_000) return DEFAULT_MULTIPLES.sub_25m;
  return DEFAULT_MULTIPLES.above_25m;
}

export function valueBusiness(input: ValuationInput): ValuationResult {
  const ownerAddBack = input.ownerAddBack ?? 0;
  const sde = Math.max(0, input.annualEbitda + ownerAddBack);
  const multiple = input.industryMultiple ?? pickDefaultMultiple(sde);
  const currentValue = sde * multiple;
  const years = input.exitYears ?? 5;
  const growth = input.growthRate ?? 0.08;
  const projectedSde = sde * Math.pow(1 + growth, years);
  const projectedValue = projectedSde * multiple;
  const cagr = input.annualRevenue > 0 ? Math.pow(projectedValue / currentValue, 1 / years) - 1 : 0;

  return {
    method: "sde_multiple",
    currentValue,
    projectedExitValue: projectedValue,
    multipleApplied: multiple,
    sde,
    cagr,
    reasoning: `SDE of $${Math.round(sde).toLocaleString()} × ${multiple.toFixed(1)}x industry multiple → $${Math.round(
      currentValue,
    ).toLocaleString()} today; $${Math.round(projectedValue).toLocaleString()} in ${years} years at ${(growth * 100).toFixed(0)}% growth.`,
  };
}
