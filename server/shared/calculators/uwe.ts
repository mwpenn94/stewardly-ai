/**
 * Unified Wealth Engine (UWE) v1.0
 *
 * Holistic year-by-year wealth simulation combining ALL value streams:
 * cash value, death benefit, tax savings, living benefits, legacy value,
 * and annual cost across 14 financial product types.
 *
 * Ported verbatim from the v7 WealthBridge HTML calculators
 * (Business-Calculator-v7, lines 1133-2136 for the engine and 4842-4879
 * for the premium rate table). Every product model intentionally matches
 * the v7 math to the dollar so downstream consumers see stable output.
 *
 * Step 3a: premium rate engine + 14 product models + PRODUCT_MODELS map.
 * Step 3b will append COMPANIES, simulate, buildStrategy, and
 * autoSelectProducts. Step 3c exports the final UWE namespace object.
 */

import type {
  ProductConfig,
  ProductYearResult,
  ProductType,
  CompanyDefinition,
  ClientProfile,
  UWEStrategy,
  SimulationSnapshot,
  ProductDetailRow,
} from "./types";
import { monteCarloSimulate } from "./monteCarlo";

// ═══════════════════════════════════════════════════════════════════════════
// PREMIUM RATE ENGINE
// Age-based rate tables from industry data (2025-2026).
// Sources: Ramsey Solutions, Guardian Life, LocalLifeAgents, LIMRA,
// NerdWallet. Used by autoSelectProducts to pick realistic annual
// premiums when the caller does not supply one explicitly.
// ═══════════════════════════════════════════════════════════════════════════

interface RateEntry {
  age: number;
  rate: number;
}

export const RATES = {
  // Term Life: annual premium per $100K coverage (20yr term, nonsmoker,
  // good health). Blended male/female average. Source: Ramsey Feb 2026.
  termPer100K: [
    { age: 20, rate: 31 },
    { age: 25, rate: 33 },
    { age: 30, rate: 35 },
    { age: 35, rate: 42 },
    { age: 40, rate: 56 },
    { age: 45, rate: 78 },
    { age: 50, rate: 135 },
    { age: 55, rate: 195 },
    { age: 60, rate: 377 },
    { age: 65, rate: 620 },
    { age: 70, rate: 1557 },
  ] as RateEntry[],
  // IUL: annual target premium per $100K face (NLG FlexLife/PeakLife
  // benchmark). Source: LocalLifeAgents Nov 2025, SimplyInsurance Feb 2026.
  iulPer100K: [
    { age: 20, rate: 480 },
    { age: 25, rate: 540 },
    { age: 30, rate: 660 },
    { age: 35, rate: 840 },
    { age: 40, rate: 1080 },
    { age: 45, rate: 1380 },
    { age: 50, rate: 1800 },
    { age: 55, rate: 2400 },
    { age: 60, rate: 3240 },
    { age: 65, rate: 4500 },
  ] as RateEntry[],
  // Whole Life: annual premium per $100K (MassMutual benchmark).
  // Source: Guardian Life Jan 2026, Aflac.
  wlPer100K: [
    { age: 20, rate: 603 },
    { age: 25, rate: 720 },
    { age: 30, rate: 862 },
    { age: 35, rate: 1020 },
    { age: 40, rate: 1277 },
    { age: 45, rate: 1620 },
    { age: 50, rate: 2014 },
    { age: 55, rate: 2580 },
    { age: 60, rate: 3360 },
    { age: 65, rate: 4500 },
  ] as RateEntry[],
  // DI: annual premium as % of benefit amount (60% income replacement).
  // Source: Guardian Life Mar 2025, Policygenius, LifeHappens.
  diPctBenefit: [
    { age: 25, rate: 0.02 },
    { age: 30, rate: 0.022 },
    { age: 35, rate: 0.025 },
    { age: 40, rate: 0.03 },
    { age: 45, rate: 0.038 },
    { age: 50, rate: 0.048 },
    { age: 55, rate: 0.06 },
    { age: 60, rate: 0.08 },
  ] as RateEntry[],
  // LTC Hybrid (Lincoln MoneyGuard): annual premium for $150K benefit pool.
  // Source: CompareLongTermCare.org, LTCInsurancePartner Jun 2025.
  ltcAnnual: [
    { age: 40, rate: 2400 },
    { age: 45, rate: 3200 },
    { age: 50, rate: 4200 },
    { age: 55, rate: 5600 },
    { age: 60, rate: 7800 },
    { age: 65, rate: 10800 },
    { age: 70, rate: 15600 },
  ] as RateEntry[],
  // AUM Advisory Fee (ESI): tiered % of AUM annually.
  // Source: NerdWallet Mar 2026, AdvisorFinder.
  aumFee(aum: number): number {
    if (aum >= 5e6) return 0.006;
    if (aum >= 1e6) return 0.0085;
    if (aum >= 5e5) return 0.01;
    return 0.0125;
  },
  // FIA: no annual management fee; income rider fee if added.
  fiaRiderFee: 0.01,
  // Group Benefits: annual cost per employee (single coverage).
  // Source: KFF Employer Survey 2024.
  groupPerEmp: 7911,
};

/**
 * Interpolate a rate from an age-based table. v7 logic at Business
 * Calculator line 4868. Below the table minimum returns the first rate,
 * above the table maximum returns the last rate, otherwise linearly
 * interpolates between the two surrounding anchors. Rates >= 1 are
 * rounded to integers (used by premium tables), fractional rates pass
 * through unchanged (used by percent-of-benefit tables like DI).
 */
export function interpRate(table: RateEntry[], age: number): number {
  if (age <= table[0].age) return table[0].rate;
  if (age >= table[table.length - 1].age)
    return table[table.length - 1].rate;
  for (let i = 0; i < table.length - 1; i++) {
    if (age >= table[i].age && age <= table[i + 1].age) {
      const pct = (age - table[i].age) / (table[i + 1].age - table[i].age);
      const r = table[i].rate + (table[i + 1].rate - table[i].rate) * pct;
      return r >= 1 ? Math.round(r) : r;
    }
  }
  return table[table.length - 1].rate;
}

/**
 * Estimate an annual premium by product type, age, and amount. v7 logic
 * at Business Calculator line 4870. Returns 0 for unknown types or
 * non-positive amounts so autoSelectProducts can safely chain through.
 */
export function estPrem(type: string, age: number, amount: number): number {
  if (amount <= 0) return 0;
  switch (type) {
    case "term":
      return Math.round(
        interpRate(RATES.termPer100K, age) * (amount / 100000),
      );
    case "iul":
      return Math.round(
        interpRate(RATES.iulPer100K, age) * (amount / 100000),
      );
    case "wl":
      return Math.round(interpRate(RATES.wlPer100K, age) * (amount / 100000));
    case "di":
      return Math.round(interpRate(RATES.diPctBenefit, age) * amount);
    case "ltc":
      return Math.round(
        interpRate(RATES.ltcAnnual, age) * (amount / 150000),
      );
    case "group":
      return Math.round(RATES.groupPerEmp * amount);
    default:
      return 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCT MODELS
// Each model is a pure year function: (cfg, year, age) => ProductYearResult.
// Per-year carry state (prev cash value, etc.) is stored on the cfg object
// under underscore-prefixed fields. The v7 simulate loop clones each product
// config before running so nothing leaks between simulations.
// ═══════════════════════════════════════════════════════════════════════════

// ─── Term Life ───
// Level death benefit during the term, $0 after. Adds a small conversion
// option value in the final 5 years of the term (~2% of face).
export function modelTerm(
  cfg: ProductConfig,
  year: number,
  _age: number,
): ProductYearResult {
  const termYears = cfg.termYears || 20;
  const inForce = year <= termYears;
  const annPrem = cfg.annualPremium || 0;
  const face = cfg.face || 0;
  const conversionValue =
    inForce && year > termYears - 5 ? Math.round(face * 0.02) : 0;
  return {
    cashValue: conversionValue,
    deathBenefit: inForce ? face : 0,
    taxSaving: 0,
    livingBenefit: 0,
    legacyValue: inForce ? face : 0,
    annualCost: inForce ? annPrem : 0,
    label: "Term " + termYears + "yr",
    carrier: cfg.carrier || "NLG",
  };
}

// ─── Indexed Universal Life (IUL) ───
// Cash value compounds with net crediting rate after COI/fees. Death
// benefit corridor factor adjusts with age. Tax-free growth relative to a
// taxable account. Living benefit riders ~50% of death benefit by default.
export function modelIUL(
  cfg: ProductConfig,
  year: number,
  age: number,
): ProductYearResult {
  const fundingYears = cfg.fundingYears || 15;
  const annPrem = cfg.annualPremium || 0;
  const paying = year <= fundingYears;

  const prevCV = cfg._prevCashValue || 0;
  let netRate: number;
  if (year <= 3) netRate = 0.02;
  else if (year <= 7) netRate = 0.035;
  else if (year <= fundingYears) netRate = 0.04;
  else netRate = 0.05;

  const cashValue = prevCV * (1 + netRate) + (paying ? annPrem * 0.65 : 0);
  cfg._prevCashValue = cashValue;

  const corridorFactor =
    age + year < 60 ? 2.5 : age + year < 75 ? 1.5 : 1.2;
  const face = cfg.face || 0;
  const deathBenefit = Math.max(face, Math.round(cashValue * corridorFactor));

  const taxRate = cfg.marginalRate || 0.25;
  const taxableEquiv = prevCV * netRate;
  const taxSaving = Math.round(taxableEquiv * taxRate);

  const livingBenefit = Math.round(deathBenefit * (cfg.livingBenPct || 0.5));
  const legacyValue = deathBenefit;

  return {
    cashValue: Math.round(cashValue),
    deathBenefit: Math.round(deathBenefit),
    taxSaving,
    livingBenefit,
    legacyValue: Math.round(legacyValue),
    annualCost: paying ? annPrem : 0,
    label: "IUL",
    carrier: cfg.carrier || "NLG FlexLife",
  };
}

// ─── Whole Life ───
// Guaranteed base rate ~2.5% + dividend ~2% = ~4.5% total. Early years
// lose to surrender charges; after year 10 CV growth is strong.
export function modelWL(
  cfg: ProductConfig,
  year: number,
  _age: number,
): ProductYearResult {
  const annPrem = cfg.annualPremium || 0;
  const payYears = cfg.payYears || 99;
  const paying = year <= payYears;
  const prevCV = cfg._prevCashValue || 0;

  const guaranteedRate = 0.025;
  const dividendRate = cfg.dividendRate || 0.02;
  const totalRate = guaranteedRate + dividendRate;

  let cvGrowth: number;
  if (year <= 3)
    cvGrowth = prevCV * totalRate + (paying ? annPrem * 0.15 : 0);
  else if (year <= 7)
    cvGrowth = prevCV * totalRate + (paying ? annPrem * 0.35 : 0);
  else if (year <= 15)
    cvGrowth = prevCV * totalRate + (paying ? annPrem * 0.55 : 0);
  else cvGrowth = prevCV * totalRate + (paying ? annPrem * 0.7 : 0);

  const cashValue = prevCV + cvGrowth;
  cfg._prevCashValue = cashValue;

  const face = cfg.face || 0;
  const deathBenefit = Math.max(face, Math.round(cashValue * 1.1));
  const taxRate = cfg.marginalRate || 0.25;
  const taxSaving = Math.round(prevCV * totalRate * taxRate);
  const legacyValue = deathBenefit;

  return {
    cashValue: Math.round(cashValue),
    deathBenefit: Math.round(deathBenefit),
    taxSaving,
    livingBenefit: 0,
    legacyValue: Math.round(legacyValue),
    annualCost: paying ? annPrem : 0,
    label: "Whole Life" + (payYears <= 30 ? " " + payYears + "-Pay" : ""),
    carrier: cfg.carrier || "NLG/MassMutual",
  };
}

// ─── Disability Insurance ───
// SSA: 1 in 4 disabled before 67. Average claim: 34.6 months. Annual prob
// ~1.2% per year. Expected value = prob * benefit * avg duration.
export function modelDI(
  cfg: ProductConfig,
  year: number,
  _age: number,
): ProductYearResult {
  const toAge = cfg.toAge || 65;
  const currentAge = (cfg.startAge || 40) + year;
  const inForce = currentAge <= toAge;
  const annPrem = cfg.annualPremium || 0;
  const annBenefit = cfg.annualBenefit || 0;

  const annualProb = 0.012;
  const expectedBenefit = inForce
    ? Math.round(annBenefit * annualProb * 2.88)
    : 0;

  const cumExpected = (cfg._cumExpected || 0) + expectedBenefit;
  cfg._cumExpected = cumExpected;

  const livingBenefit = inForce ? annBenefit : 0;

  return {
    cashValue: 0,
    deathBenefit: 0,
    taxSaving: 0,
    livingBenefit,
    legacyValue: 0,
    annualCost: inForce ? annPrem : 0,
    expectedValue: cumExpected,
    label: "Disability Insurance",
    carrier: cfg.carrier || "Guardian",
  };
}

// ─── Hybrid LTC (Lincoln MoneyGuard style) ───
// LTC benefit pool grows with inflation. Death benefit ~80% of premiums
// paid if LTC unused. Partial deductibility under IRC §213(d).
export function modelLTC(
  cfg: ProductConfig,
  year: number,
  _age: number,
): ProductYearResult {
  const annPrem = cfg.annualPremium || 0;
  const payYears = cfg.payYears || 10;
  const paying = year <= payYears;
  const baseBenefitPool = cfg.benefitPool || 150000;
  const inflationRate = cfg.inflationRate || 0.03;

  const benefitPool = Math.round(
    baseBenefitPool * Math.pow(1 + inflationRate, year),
  );

  const cumPrem = Math.min(year, payYears) * annPrem;
  const deathBenefit = Math.round(cumPrem * 0.8);

  const livingBenefit = benefitPool;
  const legacyValue = deathBenefit;

  return {
    cashValue: 0,
    deathBenefit,
    taxSaving: Math.round(annPrem * 0.15),
    livingBenefit,
    legacyValue,
    annualCost: paying ? annPrem : 0,
    label: "Hybrid LTC",
    carrier: cfg.carrier || "Lincoln MoneyGuard",
  };
}

// ─── Fixed Indexed Annuity (FIA) ───
// Principal protection, capped upside (~5.5% net avg), income rider with
// ~6.5% simple roll-up and 5% lifetime withdrawal rate.
export function modelFIA(
  cfg: ProductConfig,
  year: number,
  _age: number,
): ProductYearResult {
  const deposit = cfg.deposit || 0;
  const annPrem = cfg.annualPremium || 0;
  const prevValue = cfg._prevValue || deposit;
  const paying = year <= (cfg.fundingYears || 5);

  const avgReturn = cfg.avgReturn || 0.055;
  const riderFee = cfg.riderFee || 0.01;
  const netReturn = avgReturn - riderFee;

  const value = prevValue * (1 + netReturn) + (paying ? annPrem : 0);
  cfg._prevValue = value;

  let incomeBase = cfg._incomeBase || deposit;
  const rollUpRate = cfg.rollUpRate || 0.065;
  incomeBase = incomeBase + deposit * rollUpRate;
  cfg._incomeBase = incomeBase;

  const annualIncome = Math.round(
    incomeBase * (cfg.withdrawalRate || 0.05),
  );

  return {
    cashValue: Math.round(value),
    deathBenefit: Math.round(value),
    taxSaving: Math.round(value * netReturn * 0.15),
    livingBenefit: annualIncome,
    legacyValue: Math.round(value),
    annualCost: paying ? annPrem : 0,
    label: "Fixed Indexed Annuity",
    carrier: cfg.carrier || "NLG/Athene",
  };
}

// ─── Advisory / AUM ───
// Investment management with advisory alpha. Vanguard Advisor's Alpha
// ~3%, conservative default 1.5% to stay on the defensible side.
export function modelAUM(
  cfg: ProductConfig,
  _year: number,
  _age: number,
): ProductYearResult {
  const prevValue = cfg._prevValue || cfg.initialAUM || 0;
  const annualAdd = cfg.annualAdd || 0;
  const feeRate = cfg.feeRate || 0.01;
  const grossReturn = cfg.grossReturn || 0.08;
  const advisoryAlpha = cfg.advisoryAlpha || 0.015;
  const taxDrag = cfg.taxDrag || 0.005;

  const netReturn = grossReturn + advisoryAlpha - feeRate - taxDrag;
  const value = prevValue * (1 + netReturn) + annualAdd;
  cfg._prevValue = value;

  const fee = Math.round(prevValue * feeRate);
  const taxSaving = Math.round(prevValue * advisoryAlpha * 0.3);

  return {
    cashValue: Math.round(value),
    deathBenefit: 0,
    taxSaving,
    livingBenefit: 0,
    legacyValue: Math.round(value),
    annualCost: fee,
    label: "Advisory/AUM",
    carrier: cfg.carrier || "ESI/WealthBridge",
  };
}

// ─── 401k / Roth ───
// Tax-advantaged retirement savings. Traditional saves tax on
// contributions; Roth grows tax-free. isRoth flag switches the math.
export function model401k(
  cfg: ProductConfig,
  _year: number,
  _age: number,
): ProductYearResult {
  const prevValue = cfg._prevValue || cfg.initialBalance || 0;
  const annualContrib = cfg.annualContrib || 0;
  const employerMatch = cfg.employerMatch || 0;
  const grossReturn = cfg.grossReturn || 0.07;
  const feeRate = cfg.feeRate || 0.005;

  const totalContrib = annualContrib + employerMatch;
  const netReturn = grossReturn - feeRate;
  const value = prevValue * (1 + netReturn) + totalContrib;
  cfg._prevValue = value;

  const taxRate = cfg.marginalRate || 0.25;
  let taxSaving = Math.round(annualContrib * taxRate);
  if (cfg.isRoth) taxSaving = Math.round(prevValue * netReturn * taxRate);

  return {
    cashValue: Math.round(value),
    deathBenefit: 0,
    taxSaving,
    livingBenefit: 0,
    legacyValue: Math.round(value * (cfg.isRoth ? 1 : 0.75)),
    annualCost: 0,
    label: cfg.isRoth ? "Roth IRA/401k" : "401k",
    carrier: cfg.carrier || "Employer Plan",
  };
}

// ─── 529 Education Savings ───
// State tax deduction + tax-free growth for qualified expenses.
export function model529(
  cfg: ProductConfig,
  _year: number,
  _age: number,
): ProductYearResult {
  const prevValue = cfg._prevValue || 0;
  const annualContrib = cfg.annualContrib || 0;
  const grossReturn = cfg.grossReturn || 0.06;

  const value = prevValue * (1 + grossReturn) + annualContrib;
  cfg._prevValue = value;

  const taxRate = cfg.marginalRate || 0.25;
  const taxSaving = Math.round(prevValue * grossReturn * taxRate * 0.5);

  return {
    cashValue: Math.round(value),
    deathBenefit: 0,
    taxSaving,
    livingBenefit: 0,
    legacyValue: Math.round(value),
    annualCost: 0,
    label: "529 Plan",
    carrier: cfg.carrier || "State Plan",
  };
}

// ─── Estate Planning ───
// Trust / will / beneficiary optimization. $15M per-person exemption is
// the 2026 One Big Beautiful Bill Act number; trusts save ~30% of
// projected estate tax exposure.
export function modelEstate(
  cfg: ProductConfig,
  year: number,
  _age: number,
): ProductYearResult {
  const netWorth = cfg.netWorth || 0;
  const growthRate = cfg.growthRate || 0.06;
  const projectedEstate = netWorth * Math.pow(1 + growthRate, year);
  const exemption = cfg.exemption || 15000000;
  const taxableEstate = Math.max(0, projectedEstate - exemption);
  const estateTax = Math.round(taxableEstate * 0.4);
  const taxSaving = estateTax > 0 ? Math.round(estateTax * 0.3) : 0;

  return {
    cashValue: 0,
    deathBenefit: 0,
    taxSaving,
    livingBenefit: 0,
    legacyValue: Math.round(projectedEstate - estateTax + taxSaving),
    annualCost:
      year <= 1 ? cfg.setupCost || 2500 : cfg.annualReview || 500,
    label: "Estate Plan",
    carrier: cfg.carrier || "WB Adv Markets",
  };
}

// ─── Premium Finance (Leveraged IUL) ───
// Bank funds premium, client pays interest + collateral. Arbitrage on
// crediting rate (6-8%) vs loan rate (SOFR+spread ~5-6%). Min case:
// typically $1M+ face, $250K+ NW, $150K+ income.
export function modelPremFin(
  cfg: ProductConfig,
  year: number,
  _age: number,
): ProductYearResult {
  const face = cfg.face || 5000000;
  const annPrem = cfg.annualPremium || 100000;
  const fundYrs = cfg.fundingYears || 10;
  const loanRate = cfg.loanRate || 0.055;
  const creditRate = cfg.creditingRate || 0.07;
  const cashOutlay = cfg.cashOutlay || 25000;
  const spread = creditRate - loanRate;

  const cumPrem = Math.min(year, fundYrs) * annPrem;
  let loanBalance = 0;
  let cashValue = 0;
  for (let y = 1; y <= year; y++) {
    if (y <= fundYrs) {
      loanBalance = loanBalance * (1 + loanRate) + annPrem;
      const bonusCredit = y <= 5 ? 0.01 : y <= 10 ? 0.005 : 0;
      const coiRate = Math.max(0.002, 0.015 - y * 0.001);
      cashValue =
        cashValue * (1 + creditRate + bonusCredit - coiRate) + annPrem * 0.85;
    } else {
      loanBalance = loanBalance * (1 + loanRate);
      const postCoiRate = Math.max(0.002, 0.008 - (y - fundYrs) * 0.0003);
      cashValue = cashValue * (1 + creditRate - postCoiRate);
    }
  }
  const netEquity = Math.max(0, cashValue - loanBalance);
  const netDB = Math.max(0, face - loanBalance);
  const livingBen = face * 0.5;

  return {
    cashValue: Math.round(netEquity),
    deathBenefit: Math.round(netDB),
    taxSaving: Math.round(netEquity > 0 ? netEquity * 0.03 : 0),
    livingBenefit: Math.round(livingBen),
    legacyValue: Math.round(netDB),
    annualCost:
      year <= fundYrs
        ? cashOutlay
        : Math.round(Math.max(0, loanBalance * loanRate * 0.05)),
    label: "Premium Finance (IUL)",
    carrier: cfg.carrier || "NLG LSW FlexLife",
    details: {
      loanBalance: Math.round(loanBalance),
      grossCSV: Math.round(cashValue),
      netEquity: Math.round(netEquity),
      spread: (spread * 100).toFixed(1) + "%",
      canPayoff: cashValue > loanBalance,
      leverage: cumPrem > 0 ? (face / cumPrem).toFixed(1) + "x" : "N/A",
    },
  };
}

// ─── Split Dollar ───
// Employer-funded life insurance with shared benefits. Employer recovers
// contributed premium from cash value; employee gets death benefit above
// that threshold.
export function modelSplitDollar(
  cfg: ProductConfig,
  year: number,
  _age: number,
): ProductYearResult {
  const face = cfg.face || 1000000;
  const annPrem = cfg.annualPremium || 15000;
  const employerShare = cfg.employerShare || 0.8;
  const employeeCost = annPrem * (1 - employerShare);
  let cashValue = 0;
  for (let y = 1; y <= year; y++) {
    cashValue = cashValue * 1.05 + annPrem * 0.55;
  }
  const employerRecovery = Math.min(cashValue, annPrem * year * employerShare);
  const employeeBenefit = Math.max(0, cashValue - employerRecovery);
  return {
    cashValue: Math.round(employeeBenefit),
    deathBenefit: Math.round(face - employerRecovery),
    taxSaving: Math.round(employeeCost * 0.25 * year),
    livingBenefit: 0,
    legacyValue: Math.round(face - employerRecovery),
    annualCost: Math.round(employeeCost),
    label: "Split Dollar",
    carrier: cfg.carrier || "NLG/MassMutual",
  };
}

// ─── Non-Qualified Deferred Compensation ───
// Executive-level deferral above 401k limits at top marginal rate.
export function modelDeferredComp(
  cfg: ProductConfig,
  year: number,
  _age: number,
): ProductYearResult {
  const annContrib = cfg.annualContrib || 50000;
  const growthRate = cfg.growthRate || 0.06;
  let balance = 0;
  for (let y = 1; y <= year; y++) {
    balance = (balance + annContrib) * (1 + growthRate);
  }
  const taxSaving = annContrib * 0.37 * Math.min(year, 20);
  return {
    cashValue: Math.round(balance),
    deathBenefit: Math.round(balance),
    taxSaving: Math.round(taxSaving),
    livingBenefit: 0,
    legacyValue: Math.round(balance),
    annualCost: 0,
    label: "Deferred Comp (NQDC)",
    carrier: cfg.carrier || "Plan Administrator",
  };
}

// ─── PRODUCT MODEL DISPATCH ───
// Ordered keys map ProductType strings to their year-by-year model
// functions. simulate() in Step 3b looks up by `cfg.type`.
export type ProductModel = (
  cfg: ProductConfig,
  year: number,
  age: number,
) => ProductYearResult;

export const PRODUCT_MODELS: Record<ProductType, ProductModel> = {
  term: modelTerm,
  iul: modelIUL,
  wl: modelWL,
  di: modelDI,
  ltc: modelLTC,
  fia: modelFIA,
  aum: modelAUM,
  "401k": model401k,
  roth: model401k, // same model, isRoth flag switches the math
  "529": model529,
  estate: modelEstate,
  premfin: modelPremFin,
  splitdollar: modelSplitDollar,
  deferredcomp: modelDeferredComp,
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPANY PROFILES
// Real fee structures and product availability by company. 7 companies:
// wealthbridge, captivemutual, wirehouse, ria, communitybd, diy, donothing.
// Consumed by simulate() for company-level fee adjustments and by
// autoSelectProducts for building out a realistic default product mix.
// ═══════════════════════════════════════════════════════════════════════════

export const COMPANIES: Record<string, CompanyDefinition> = {
  wealthbridge: {
    name: "WealthBridge Plan",
    desc:
      "NLG/MassMutual products + ESI advisory + holistic planning + advanced strategies",
    color: "#16A34A",
    aumFee: 0.01,
    advisoryAlpha: 0.015,
    taxDrag: 0.005,
    products: [
      "term",
      "iul",
      "wl",
      "di",
      "ltc",
      "fia",
      "aum",
      "401k",
      "roth",
      "529",
      "estate",
      "premfin",
      "splitdollar",
      "deferredcomp",
    ],
    features: {
      holistic: true,
      taxFree: true,
      livingBen: true,
      advisor: true,
      estate: true,
      group: true,
      fiduciary: true,
      lowFees: false,
      insurance: true,
      premFinance: true,
      advancedPlanning: true,
    },
    notes:
      "NLG ranked #2 WSJ Best Whole Life 2026. Living Benefits on all life products. ESI 100% AUM payout. Premium Financing for HNW clients.",
    strategyInfo: {
      whyChoose:
        "Only platform combining insurance carrier products (NLG/MassMutual), RIA advisory (ESI), and advanced markets (premium financing, ILIT, split dollar, deferred comp) under one advisor relationship. Eliminates coordination risk between separate providers.",
      included:
        "Term life (income replacement), IUL (tax-free retirement income + living benefits), Whole Life (guaranteed growth + dividends), DI (income protection), LTC/Hybrid (long-term care), FIA (principal-protected growth), Advisory/AUM (1% fee, 1.5% alpha), 401K/Roth, 529, Estate Planning (ILIT + trusts), Premium Financing (for $250K+ NW), Split Dollar, Deferred Comp.",
      omitted:
        "Direct indexing, alternative investments, cryptocurrency, variable annuities (excluded: higher fees, less downside protection than FIA). These are available through ESI but not modeled here.",
      idealFor:
        "Clients wanting comprehensive holistic planning across all 8 financial domains with one advisor. Especially valuable for HNW clients ($250K+ NW) who qualify for premium financing and advanced strategies.",
      sources:
        "NLG Commission Schedule 2026, WSJ Best Whole Life Rankings 2026, ESI Advisory Fee Schedule, LIMRA 2025 ($17.5B record individual life premium), ACLI Fact Book 2024",
    },
  },
  captivemutual: {
    name: "Captive Mutual Carrier",
    desc:
      "e.g., Northwestern Mutual, New York Life, Guardian, Penn Mutual — captive agents, strong WL dividends, proprietary products",
    color: "#1E40AF",
    aumFee: 0.012,
    advisoryAlpha: 0.01,
    taxDrag: 0.008,
    products: ["term", "wl", "di", "ltc", "aum"],
    features: {
      holistic: true,
      taxFree: false,
      livingBen: false,
      advisor: true,
      estate: true,
      group: false,
      fiduciary: false,
      lowFees: false,
      insurance: true,
    },
    notes:
      "Strong WL dividends (3-5% historical). Limited/no IUL. Higher premiums. Captive agents restricted to proprietary products.",
    strategyInfo: {
      whyChoose:
        "Strong whole life dividend track record (3-5% historical depending on carrier). Well-known brands with AM Best A++ ratings. Good DI products through captive channel. Established estate planning support through affiliated attorneys/CPAs.",
      included:
        "Term life, Whole Life (with dividends), DI, LTC, Advisory/AUM (1.2% fee).",
      omitted:
        "No IUL (no tax-free retirement income via policy loans), no FIA (no principal-protected growth), no premium financing, no living benefit riders on life policies, no 529 planning, limited group benefits. Captive model restricts product selection.",
      idealFor:
        "Conservative clients who prioritize guaranteed whole life growth and dividends over IUL upside. Those who value brand recognition.",
      sources:
        "AM Best Carrier Ratings 2025, ACLI Fact Book 2024, LIMRA Whole Life Market Share 2025, carrier annual reports (NWM, NYL, Guardian)",
    },
  },
  wirehouse: {
    name: "Traditional Wirehouse",
    desc: "Merrill Lynch, Morgan Stanley, UBS, Wells Fargo",
    color: "#2563EB",
    aumFee: 0.0135,
    advisoryAlpha: 0.008,
    taxDrag: 0.012,
    products: ["term", "aum", "401k", "roth"],
    features: {
      holistic: false,
      taxFree: false,
      livingBen: false,
      advisor: true,
      estate: false,
      group: false,
      fiduciary: false,
      lowFees: false,
      insurance: false,
    },
    notes:
      "Brand name. AUM-focused. Limited/no insurance. Proprietary products. Higher fees.",
    strategyInfo: {
      whyChoose:
        "Major brand recognition. Access to IPOs and institutional research. Physical office locations. Comprehensive investment platform.",
      included:
        "Term life (basic, often outsourced), Advisory/AUM (1.35% fee, ~0.8% alpha), 401K, Roth IRA.",
      omitted:
        "No IUL, no Whole Life, no DI (must go elsewhere), no LTC, no FIA, no living benefits, no premium financing, no estate planning integration, no 529 planning. Insurance needs require a separate relationship. Higher AUM fees reduce compounding. Proprietary products create conflicts of interest. Not a fiduciary.",
      idealFor:
        "Clients who prioritize brand name and are primarily investment-focused with minimal insurance needs. Those comfortable managing insurance separately.",
      sources:
        "Cerulli Associates 2025 Wirehouse Report, SEC ADV Part 2 filings, J.D. Power 2025 Financial Advisor Satisfaction",
    },
  },
  ria: {
    name: "Independent RIA",
    desc: "Fee-only registered investment advisor",
    color: "#7C3AED",
    aumFee: 0.01,
    advisoryAlpha: 0.012,
    taxDrag: 0.008,
    products: ["aum", "401k", "roth", "529", "estate"],
    features: {
      holistic: false,
      taxFree: false,
      livingBen: false,
      advisor: true,
      estate: true,
      group: false,
      fiduciary: true,
      lowFees: true,
      insurance: false,
    },
    notes:
      "Fiduciary duty. Lower AUM fees. No insurance expertise. Tax planning focus.",
    strategyInfo: {
      whyChoose:
        "Fiduciary standard (legally required to act in your best interest). Lower AUM fees. Strong tax planning and investment management. Open architecture product selection.",
      included:
        "Advisory/AUM (1% fee, ~1.2% alpha), 401K, Roth IRA, 529, Estate Planning coordination.",
      omitted:
        "No life insurance products (Term, IUL, WL), no DI, no LTC, no FIA, no living benefits, no premium financing, no group benefits. Insurance must be handled by a separate advisor, creating coordination risk and coverage gaps. Cannot provide tax-free retirement income via IUL loans.",
      idealFor:
        "Clients focused primarily on investment management and tax planning who already have adequate insurance coverage through another relationship.",
      sources: "SEC ADV Statistics 2025, Kitces Research on RIA Fees 2025, CFP Board Standards",
    },
  },
  communitybd: {
    name: "Community Broker-Dealer",
    desc:
      "e.g., Edward Jones, Ameriprise, Raymond James — local office, community-focused, moderate product shelf",
    color: "#0891B2",
    aumFee: 0.0135,
    advisoryAlpha: 0.006,
    taxDrag: 0.01,
    products: ["term", "aum", "401k", "roth", "529"],
    features: {
      holistic: false,
      taxFree: false,
      livingBen: false,
      advisor: true,
      estate: false,
      group: false,
      fiduciary: false,
      lowFees: false,
      insurance: false,
    },
    notes:
      "Local advisor with community presence. Moderate fees. Limited product shelf vs. full wirehouses. No advanced strategies like premium financing.",
    strategyInfo: {
      whyChoose:
        "Convenient local office locations across the country. Face-to-face relationship with a dedicated local advisor. Simple, traditional investment approach. Good for clients who prefer in-person meetings and community presence.",
      included:
        "Term life (basic), Advisory/AUM (1.35% fee, ~0.6% alpha), 401K, Roth IRA, 529.",
      omitted:
        "No IUL, no Whole Life, no DI, no LTC, no FIA, no living benefits, no premium financing, no estate planning, no group benefits, no advanced strategies. Higher fees with lower alpha than competitors. Limited product shelf restricts optimization.",
      idealFor:
        "Clients who prioritize local, face-to-face relationships over comprehensive planning or cost efficiency.",
      sources:
        "SEC ADV Part 2 filings (EJ, Ameriprise, RJ), J.D. Power 2025 Advisor Satisfaction, Investor.com Fee Analysis, Cerulli Associates 2025",
    },
  },
  diy: {
    name: "DIY / Robo-Advisor",
    desc: "Betterment, Wealthfront, Vanguard self-directed",
    color: "#64748B",
    aumFee: 0.003,
    advisoryAlpha: 0.002,
    taxDrag: 0.015,
    products: ["aum", "401k", "roth", "529"],
    features: {
      holistic: false,
      taxFree: false,
      livingBen: false,
      advisor: false,
      estate: false,
      group: false,
      fiduciary: true,
      lowFees: true,
      insurance: false,
    },
    notes:
      "Lowest fees. No advisor. No insurance. Basic tax-loss harvest. No estate planning.",
    strategyInfo: {
      whyChoose:
        "Lowest cost option. Algorithmic tax-loss harvesting. Good for disciplined self-directed investors with simple needs. No advisor conflicts.",
      included:
        "Advisory/AUM (0.3% fee, ~0.2% alpha from tax-loss harvesting), 401K, Roth IRA, 529.",
      omitted:
        "No human advisor, no life insurance, no DI, no LTC, no FIA, no living benefits, no premium financing, no estate planning, no behavioral coaching. Higher tax drag from lack of tax optimization beyond basic TLH. No protection against behavioral mistakes (Dalbar: average investor underperforms by 3.5%/yr). Coordination of multiple accounts/needs falls entirely on the client.",
      idealFor:
        "Young, disciplined investors with simple financial situations, no dependents, and minimal insurance needs who are comfortable managing everything themselves.",
      sources:
        "Betterment/Wealthfront Fee Schedules 2025, Vanguard Personal Advisor Services, Dalbar QAIB 2025 (investor behavior gap)",
    },
  },
  donothing: {
    name: "Do Nothing",
    desc: "Current path with no changes",
    color: "#DC2626",
    aumFee: 0,
    advisoryAlpha: 0,
    taxDrag: 0.02,
    products: [],
    features: {
      holistic: false,
      taxFree: false,
      livingBen: false,
      advisor: false,
      estate: false,
      group: false,
      fiduciary: false,
      lowFees: true,
      insurance: false,
    },
    notes: "No cost. No protection. No optimization. Maximum risk.",
    strategyInfo: {
      whyChoose:
        "Zero cost. No commitments. Preserves full flexibility. Appropriate only as a baseline comparison.",
      included: "Nothing. No products, no advisor, no planning.",
      omitted:
        "Everything. No life insurance (family unprotected), no DI (income unprotected), no LTC (long-term care unplanned), no tax optimization (paying maximum taxes), no estate planning (assets exposed to probate and estate tax), no investment management (no compounding alpha). Maximum exposure to every financial risk.",
      idealFor:
        "Serves as a baseline to understand the value of taking action. Shows the opportunity cost of inaction. Every individual's situation is unique — consult a qualified professional to determine what's right for you.",
      sources:
        "Life Happens 2025 Insurance Barometer (41% of Americans lack adequate life insurance), Federal Reserve SCF 2025",
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// CORE SIMULATION
// Runs a year-by-year simulation for a given strategy configuration.
// Returns an array of yearly snapshots combining ALL value streams across
// the selected products plus non-product savings growth.
// ═══════════════════════════════════════════════════════════════════════════

export function simulate(
  strategyConfig: UWEStrategy,
  maxYears?: number,
): SimulationSnapshot[] {
  const years = maxYears || 100;
  const results: SimulationSnapshot[] = [];
  const profile: ClientProfile = strategyConfig.profile || {};
  const products = strategyConfig.products || [];
  const company = strategyConfig.company ? COMPANIES[strategyConfig.company] : null;

  // Clone product configs so _prev carry-state doesn't leak between
  // simulations. v7 uses a shallow for-in copy; mirror exactly.
  const prodStates: ProductConfig[] = products.map((p) => {
    const clone: ProductConfig = { ...p };
    clone.marginalRate = profile.marginalRate || 0.25;
    clone.startAge = profile.age || 40;
    clone.netWorth = profile.netWorth || 0;
    return clone;
  });

  let savingsBalance = profile.savings || 0;
  const monthlySavings = profile.monthlySavings || 0;
  const equitiesReturn = profile.equitiesReturn || 0.07;
  const existingInsurance = profile.existingInsurance || 0;

  const compAumFee = company ? company.aumFee : 0;
  const compTaxDrag = company ? company.taxDrag : 0.01;

  let cumCost = 0;

  for (let yr = 1; yr <= years; yr++) {
    const yearAge = (profile.age || 40) + yr;
    const snapshot: SimulationSnapshot = {
      year: yr,
      age: yearAge,
      productCashValue: 0,
      productDeathBenefit: existingInsurance,
      productTaxSaving: 0,
      productLivingBenefit: 0,
      productLegacyValue: 0,
      productAnnualCost: 0,
      productExpectedValue: 0,
      savingsBalance: 0,
      totalWealth: 0,
      totalProtection: 0,
      totalAnnualCost: 0,
      cumulativeCost: 0,
      productDetails: [],
      cumulativeTaxSaving: 0,
      totalValue: 0,
      netValue: 0,
      roi: 0,
    };

    // 1. Grow savings (non-product equities)
    let netSavReturn = equitiesReturn - compAumFee - compTaxDrag;
    if (netSavReturn < 0) netSavReturn = 0;
    savingsBalance =
      savingsBalance * (1 + netSavReturn) + monthlySavings * 12;

    // 2. Reinvest last year's tax savings into savings
    const priorTaxSavings =
      yr > 1 && results[yr - 2] ? results[yr - 2].productTaxSaving : 0;
    savingsBalance += priorTaxSavings;

    snapshot.savingsBalance = Math.round(savingsBalance);

    // 3. Run each product model
    for (let p = 0; p < prodStates.length; p++) {
      const pCfg = prodStates[p];
      const modelFn = PRODUCT_MODELS[pCfg.type];
      if (!modelFn) continue;

      const result = modelFn(pCfg, yr, yearAge);
      snapshot.productCashValue += result.cashValue || 0;
      snapshot.productDeathBenefit += result.deathBenefit || 0;
      snapshot.productTaxSaving += result.taxSaving || 0;
      snapshot.productLivingBenefit += result.livingBenefit || 0;
      snapshot.productLegacyValue += result.legacyValue || 0;
      snapshot.productAnnualCost += result.annualCost || 0;
      if (result.expectedValue)
        snapshot.productExpectedValue += result.expectedValue;

      const detail: ProductDetailRow = {
        type: pCfg.type,
        label: result.label,
        carrier: result.carrier,
        cashValue: result.cashValue || 0,
        deathBenefit: result.deathBenefit || 0,
        taxSaving: result.taxSaving || 0,
        livingBenefit: result.livingBenefit || 0,
        legacyValue: result.legacyValue || 0,
        annualCost: result.annualCost || 0,
      };
      snapshot.productDetails.push(detail);
    }

    // 4. Compute totals
    cumCost += snapshot.productAnnualCost;
    snapshot.totalAnnualCost = snapshot.productAnnualCost;
    snapshot.cumulativeCost = cumCost;

    snapshot.totalWealth = snapshot.savingsBalance + snapshot.productCashValue;
    snapshot.totalProtection =
      snapshot.productDeathBenefit + snapshot.productLivingBenefit;

    // Cumulative tax savings (walk current results + self)
    let cumTaxSavings = 0;
    for (let t = 0; t < yr; t++) {
      cumTaxSavings +=
        t < results.length ? results[t].productTaxSaving : snapshot.productTaxSaving;
    }
    snapshot.cumulativeTaxSaving = cumTaxSavings;

    snapshot.totalValue =
      snapshot.totalWealth +
      snapshot.productDeathBenefit +
      snapshot.productLivingBenefit +
      cumTaxSavings +
      snapshot.productExpectedValue;

    snapshot.netValue = snapshot.totalValue - snapshot.cumulativeCost;
    snapshot.roi =
      snapshot.cumulativeCost > 0
        ? snapshot.totalValue / snapshot.cumulativeCost
        : 0;

    results.push(snapshot);
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// STRATEGY BUILDER
// Creates a strategy configuration from user inputs + company profile.
// Either uses the caller-supplied product list verbatim, or auto-builds a
// realistic default mix via autoSelectProducts.
// ═══════════════════════════════════════════════════════════════════════════

export function buildStrategy(
  companyKey: string,
  profile: ClientProfile,
  customProducts?: ProductConfig[] | null,
): UWEStrategy {
  const company = COMPANIES[companyKey] || COMPANIES.donothing;
  const products: ProductConfig[] =
    customProducts && customProducts.length > 0
      ? customProducts
      : autoSelectProducts(company, profile, companyKey);

  return {
    company: companyKey,
    companyName: company.name,
    color: company.color,
    profile,
    products,
    features: company.features,
    notes: company.notes,
  };
}

// Auto-select products based on company availability and client profile.
// Mirrors the v7 heuristic rule set at Business Calculator line 1921.
export function autoSelectProducts(
  company: CompanyDefinition,
  profile: ClientProfile,
  companyKey?: string,
): ProductConfig[] {
  const prods: ProductConfig[] = [];
  const age = profile.age || 40;
  const inc = profile.income || 120000;
  const nw = profile.netWorth || 350000;
  const sav = profile.savings || 180000;
  const dep = profile.dependents || 0;
  const mort = profile.mortgage || 0;
  const debts = profile.debts || 0;

  // DIME-based life insurance need
  const lifeNeed = debts + mort + inc * 10 + dep * 250000 + 25000;
  const existingIns = profile.existingInsurance || 0;
  const gap = Math.max(0, lifeNeed - existingIns);

  if (company.products.indexOf("term") >= 0 && gap > 0) {
    const termFace = Math.round((gap * 0.7) / 100000) * 100000;
    if (termFace > 0) {
      prods.push({
        type: "term",
        face: termFace,
        termYears: age < 45 ? 20 : 15,
        annualPremium: estPrem("term", age, termFace),
        carrier: company.name,
      });
    }
  }

  if (company.products.indexOf("iul") >= 0) {
    const iulFace = Math.max(100000, Math.round((inc * 1.2) / 100000) * 100000);
    prods.push({
      type: "iul",
      face: iulFace,
      fundingYears: 15,
      annualPremium: estPrem("iul", age, iulFace),
      livingBenPct: 0.5,
      carrier: company.name,
    });
  }

  if (company.products.indexOf("wl") >= 0) {
    const wlFace = Math.max(100000, Math.round((nw * 0.5) / 100000) * 100000);
    prods.push({
      type: "wl",
      face: wlFace,
      payYears: 20,
      annualPremium: estPrem("wl", age, wlFace),
      dividendRate: companyKey === "captivemutual" ? 0.04 : 0.02,
      carrier: company.name,
    });
  }

  if (company.products.indexOf("di") >= 0) {
    const diBenefit = Math.round(inc * 0.6);
    prods.push({
      type: "di",
      annualBenefit: diBenefit,
      toAge: 65,
      annualPremium: estPrem("di", age, diBenefit),
      carrier: company.name,
    });
  }

  if (company.products.indexOf("ltc") >= 0 && age >= 35) {
    prods.push({
      type: "ltc",
      benefitPool: 150000,
      payYears: 10,
      inflationRate: 0.03,
      annualPremium: estPrem("ltc", age, 150000),
      carrier: company.name,
    });
  }

  if (company.products.indexOf("fia") >= 0 && nw > 100000) {
    const fiaDeposit = Math.max(25000, Math.round(nw * 0.1));
    prods.push({
      type: "fia",
      deposit: fiaDeposit,
      fundingYears: 5,
      annualPremium: 0,
      avgReturn: 0.055,
      riderFee: 0.01,
      carrier: company.name,
    });
  }

  if (company.products.indexOf("aum") >= 0) {
    const aumInitial = Math.max(50000, Math.round(sav * 0.5));
    prods.push({
      type: "aum",
      initialAUM: aumInitial,
      annualAdd: Math.round(inc * 0.05),
      feeRate: company.aumFee || 0.01,
      grossReturn: 0.08,
      advisoryAlpha: company.advisoryAlpha || 0.01,
      taxDrag: company.taxDrag || 0.005,
      carrier: company.name,
    });
  }

  if (company.products.indexOf("401k") >= 0) {
    prods.push({
      type: "401k",
      initialBalance: Math.round(sav * 0.3),
      annualContrib: Math.min(23000, Math.round(inc * 0.15)),
      employerMatch: Math.round(Math.min(23000, inc * 0.15) * 0.5),
      grossReturn: 0.07,
      feeRate: 0.005,
      carrier: "Employer Plan",
    });
  }

  if (company.products.indexOf("roth") >= 0) {
    prods.push({
      type: "roth",
      isRoth: true,
      initialBalance: 0,
      annualContrib: 7000,
      employerMatch: 0,
      grossReturn: 0.07,
      feeRate: 0.003,
      carrier: "Roth IRA",
    });
  }

  if (company.products.indexOf("529") >= 0 && dep > 0) {
    prods.push({
      type: "529",
      annualContrib: dep * 6000,
      grossReturn: 0.06,
      carrier: "State 529",
    });
  }

  if (company.products.indexOf("estate") >= 0 && nw > 500000) {
    prods.push({
      type: "estate",
      netWorth: nw,
      growthRate: 0.06,
      setupCost: 2500,
      annualReview: 500,
      carrier: company.name,
    });
  }

  // Premium Financing: HNW clients with $250K+ NW and $150K+ income
  if (
    company.products.indexOf("premfin") >= 0 &&
    nw >= 250000 &&
    inc >= 150000
  ) {
    const pfFace = Math.max(1000000, Math.round((nw * 2) / 100000) * 100000);
    const pfPrem = Math.round(pfFace * 0.02);
    prods.push({
      type: "premfin",
      face: pfFace,
      annualPremium: pfPrem,
      cashOutlay: Math.round(pfPrem * 0.25),
      loanRate: 0.055,
      creditingRate: 0.07,
      fundingYears: 10,
      carrier: company.name + " Premium Finance",
    });
  }

  // Split Dollar: business owners / executives with $200K+ income
  if (
    company.products.indexOf("splitdollar") >= 0 &&
    inc >= 200000 &&
    profile.isBizOwner
  ) {
    prods.push({
      type: "splitdollar",
      face: Math.round(inc * 5),
      annualPremium: Math.round(inc * 0.05),
      employerShare: 0.8,
      carrier: company.name,
    });
  }

  // Deferred Comp: executives with $200K+ income wanting to defer above
  // 401K limits
  if (company.products.indexOf("deferredcomp") >= 0 && inc >= 200000) {
    prods.push({
      type: "deferredcomp",
      annualContrib: Math.round(inc * 0.15),
      growthRate: 0.06,
      carrier: "Plan Administrator",
    });
  }

  return prods;
}

// ═══════════════════════════════════════════════════════════════════════════
// BEST OVERALL GENERATOR
// Cherry-picks the best product from each category across all companies.
// For each product type, finds the company that offers the best version
// based on a simple fee/alpha/product-strength heuristic.
// ═══════════════════════════════════════════════════════════════════════════

export function generateBestOverall(profile: ClientProfile): UWEStrategy {
  const bestProducts: ProductConfig[] = [];
  const productTypes: ProductType[] = [
    "term",
    "iul",
    "wl",
    "di",
    "ltc",
    "fia",
    "aum",
    "401k",
    "roth",
    "529",
    "estate",
  ];

  productTypes.forEach((type) => {
    let bestCompany: string | null = null;
    let bestScore = -Infinity;

    Object.keys(COMPANIES).forEach((key) => {
      if (key === "donothing") return;
      const co = COMPANIES[key];
      if (co.products.indexOf(type) < 0) return;

      let score = 0;
      if (type === "aum") score = (co.advisoryAlpha || 0) - (co.aumFee || 0);
      else if (type === "iul") score = key === "wealthbridge" ? 2 : 1;
      else if (type === "wl")
        score = key === "captivemutual" ? 2 : key === "wealthbridge" ? 1.8 : 1;
      else if (type === "di") score = key === "wealthbridge" ? 2 : 1;
      else if (type === "ltc") score = key === "wealthbridge" ? 2 : 1;
      else score = 1;

      if (score > bestScore) {
        bestScore = score;
        bestCompany = key;
      }
    });

    if (bestCompany) {
      const co = COMPANIES[bestCompany];
      const tempProds = autoSelectProducts(co, profile);
      const match = tempProds.filter((p) => p.type === type)[0];
      if (match) {
        match.carrier = co.name + " (Best-in-Class)";
        bestProducts.push(match);
      }
    }
  });

  return {
    company: "bestoverall",
    companyName: "Best Overall (Cross-Company)",
    color: "#F59E0B",
    profile,
    products: bestProducts,
    features: {
      holistic: true,
      taxFree: true,
      livingBen: true,
      advisor: true,
      estate: true,
      group: true,
      fiduciary: true,
      lowFees: true,
      insurance: true,
    },
    notes: "Cherry-picks the best product from each category across all companies.",
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// UWE NAMESPACE EXPORT
// Matches v7 public API shape so downstream code can treat this as the
// same `UWE` global. `monteCarloSimulate` re-exports the percentile-band
// runner from ./monteCarlo for parity with v7.
// ═══════════════════════════════════════════════════════════════════════════

export const UWE = {
  simulate,
  buildStrategy,
  generateBestOverall,
  autoSelectProducts,
  COMPANIES,
  PRODUCT_MODELS,
  RATES,
  estPrem,
  interpRate,
  monteCarloSimulate,
} as const;

export default UWE;
export { monteCarloSimulate };
