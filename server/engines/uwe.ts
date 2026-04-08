/**
 * UWE — Unified Wealth Engine v7
 * Faithfully extracted from WealthBridge-Client-Calculator-v7.html
 *
 * 14 product models, 8 company profiles, Monte Carlo, strategy builder.
 * All numerical logic preserved for parity with the HTML reference.
 */

import type {
  ProductType, ProductConfig, ProductResult, ClientProfile,
  CompanyKey, CompanyProfile, StrategyConfig, YearlySnapshot,
  MonteCarloPercentile, RatePoint, RateTables,
} from "./types";

// ═══════════════════════════════════════════════════════════════════════════
// RATE TABLES (exact values from v7)
// ═══════════════════════════════════════════════════════════════════════════

export const RATES: RateTables = {
  termPer100K: [
    { age: 20, rate: 31 }, { age: 25, rate: 33 }, { age: 30, rate: 35 },
    { age: 35, rate: 42 }, { age: 40, rate: 56 }, { age: 45, rate: 78 },
    { age: 50, rate: 135 }, { age: 55, rate: 195 }, { age: 60, rate: 377 },
    { age: 65, rate: 620 }, { age: 70, rate: 1557 },
  ],
  iulPer100K: [
    { age: 20, rate: 480 }, { age: 25, rate: 540 }, { age: 30, rate: 660 },
    { age: 35, rate: 840 }, { age: 40, rate: 1080 }, { age: 45, rate: 1380 },
    { age: 50, rate: 1800 }, { age: 55, rate: 2400 }, { age: 60, rate: 3240 },
    { age: 65, rate: 4500 },
  ],
  wlPer100K: [
    { age: 20, rate: 603 }, { age: 25, rate: 720 }, { age: 30, rate: 862 },
    { age: 35, rate: 1020 }, { age: 40, rate: 1277 }, { age: 45, rate: 1620 },
    { age: 50, rate: 2014 }, { age: 55, rate: 2580 }, { age: 60, rate: 3360 },
    { age: 65, rate: 4500 },
  ],
  diPctBenefit: [
    { age: 25, rate: 0.020 }, { age: 30, rate: 0.022 }, { age: 35, rate: 0.025 },
    { age: 40, rate: 0.030 }, { age: 45, rate: 0.038 }, { age: 50, rate: 0.048 },
    { age: 55, rate: 0.060 }, { age: 60, rate: 0.080 },
  ],
  ltcAnnual: [
    { age: 40, rate: 2400 }, { age: 45, rate: 3200 }, { age: 50, rate: 4200 },
    { age: 55, rate: 5600 }, { age: 60, rate: 7800 }, { age: 65, rate: 10800 },
    { age: 70, rate: 15600 },
  ],
  aumFee: (aum: number) => {
    if (aum >= 5e6) return 0.006;
    if (aum >= 1e6) return 0.0085;
    if (aum >= 5e5) return 0.01;
    return 0.0125;
  },
  fiaRiderFee: 0.01,
  groupPerEmp: 7911,
};

// ═══════════════════════════════════════════════════════════════════════════
// INTERPOLATION
// ═══════════════════════════════════════════════════════════════════════════

export function interpRate(table: RatePoint[], age: number): number {
  if (age <= table[0].age) return table[0].rate;
  if (age >= table[table.length - 1].age) return table[table.length - 1].rate;
  for (let i = 0; i < table.length - 1; i++) {
    if (age >= table[i].age && age <= table[i + 1].age) {
      const p = (age - table[i].age) / (table[i + 1].age - table[i].age);
      const r = table[i].rate + (table[i + 1].rate - table[i].rate) * p;
      return r >= 1 ? Math.round(r) : r;
    }
  }
  return table[table.length - 1].rate;
}

export function estPrem(type: ProductType, age: number, amount: number): number {
  if (amount <= 0) return 0;
  switch (type) {
    case "term": return Math.round(interpRate(RATES.termPer100K, age) * (amount / 100000));
    case "iul": return Math.round(interpRate(RATES.iulPer100K, age) * (amount / 100000));
    case "wl": return Math.round(interpRate(RATES.wlPer100K, age) * (amount / 100000));
    case "di": return Math.round(interpRate(RATES.diPctBenefit, age) * amount);
    case "ltc": return Math.round(interpRate(RATES.ltcAnnual, age) * (amount / 150000));
    default: return 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPANY PROFILES (exact from v7)
// ═══════════════════════════════════════════════════════════════════════════

export const COMPANIES: Record<CompanyKey, CompanyProfile> = {
  wealthbridge: {
    name: "WealthBridge (Holistic)",
    desc: "Full-spectrum: insurance + investments + tax + estate + premium finance",
    color: "#C9A84C",
    aumFee: 0.0085,
    advisoryAlpha: 0.03,
    taxDrag: 0.005,
    products: ["term", "iul", "wl", "di", "ltc", "fia", "aum", "401k", "roth", "529", "estate", "premfin", "splitdollar", "deferredcomp"],
    features: { holistic: true, taxFree: true, livingBen: true, advisor: true, estate: true, group: true, fiduciary: true, lowFees: false, insurance: true, premFinance: true, advancedPlanning: true },
    notes: "Only firm offering all 14 product categories with integrated planning.",
    strategyInfo: {
      whyChoose: "Comprehensive holistic planning combining insurance, investments, tax optimization, and estate planning under one roof.",
      included: "All 14 product categories: Term, IUL, WL, DI, LTC, FIA, AUM, 401(k), Roth, 529, Estate, Premium Finance, Split Dollar, Deferred Comp.",
      omitted: "Nothing — full spectrum coverage.",
      idealFor: "High-income professionals, business owners, and families seeking integrated wealth management.",
      sources: "Vanguard Advisor Alpha 2025, Kitces Fee Study 2025, LIMRA 2025.",
    },
  },
  captivemutual: {
    name: "Captive Mutual (NWM/MassMutual)",
    desc: "Strong insurance, limited investment options, higher costs",
    color: "#2563EB",
    aumFee: 0.0125,
    advisoryAlpha: 0.015,
    taxDrag: 0.008,
    products: ["term", "wl", "di", "ltc", "aum", "401k"],
    features: { holistic: false, taxFree: false, livingBen: false, advisor: true, estate: false, group: false, fiduciary: false, lowFees: false, insurance: true },
    notes: "Strong whole life dividends but limited product shelf.",
    strategyInfo: {
      whyChoose: "Strong whole life dividend track record, established brand trust.",
      included: "Term, Whole Life, DI, LTC, AUM advisory, 401(k).",
      omitted: "IUL, FIA, 529, Estate planning, Premium Finance, Split Dollar, Deferred Comp.",
      idealFor: "Conservative clients prioritizing guaranteed whole life cash value.",
      sources: "NWM 2025 Annual Report, MassMutual Dividend History.",
    },
  },
  wirehouse: {
    name: "Wirehouse (Merrill/Morgan Stanley)",
    desc: "Investment-focused, high fees, limited insurance",
    color: "#7C3AED",
    aumFee: 0.0135,
    advisoryAlpha: 0.01,
    taxDrag: 0.012,
    products: ["aum", "401k", "529"],
    features: { holistic: false, taxFree: false, livingBen: false, advisor: true, estate: false, group: false, fiduciary: false, lowFees: false, insurance: false },
    notes: "High AUM fees, limited insurance integration.",
    strategyInfo: {
      whyChoose: "Brand recognition, research access, IPO allocations.",
      included: "AUM advisory, 401(k), 529 plans.",
      omitted: "All insurance products, estate planning, premium finance.",
      idealFor: "Clients focused purely on investment management.",
      sources: "Merrill Lynch ADV Part 2A 2025, Morgan Stanley Fee Schedule.",
    },
  },
  ria: {
    name: "Independent RIA (Fee-Only)",
    desc: "Low-cost investments, fiduciary, no insurance",
    color: "#06B6D4",
    aumFee: 0.0075,
    advisoryAlpha: 0.025,
    taxDrag: 0.003,
    products: ["aum", "401k", "roth", "529"],
    features: { holistic: false, taxFree: false, livingBen: false, advisor: true, estate: false, group: false, fiduciary: true, lowFees: true, insurance: false },
    notes: "Lowest fees, fiduciary standard, but no insurance.",
    strategyInfo: {
      whyChoose: "Lowest fees, fiduciary obligation, tax-loss harvesting.",
      included: "AUM advisory, 401(k), Roth IRA, 529.",
      omitted: "All insurance products, estate planning, premium finance.",
      idealFor: "Cost-conscious investors comfortable sourcing insurance separately.",
      sources: "Kitces 2025 RIA Benchmarking, Vanguard Advisor Alpha.",
    },
  },
  communitybd: {
    name: "Community Broker-Dealer",
    desc: "Insurance + some investments, moderate fees",
    color: "#F59E0B",
    aumFee: 0.011,
    advisoryAlpha: 0.02,
    taxDrag: 0.007,
    products: ["term", "iul", "wl", "di", "aum", "401k"],
    features: { holistic: false, taxFree: true, livingBen: true, advisor: true, estate: false, group: false, fiduciary: false, lowFees: false, insurance: true },
    notes: "Good insurance shelf, moderate investment capabilities.",
    strategyInfo: {
      whyChoose: "Balanced insurance + investment access, community relationships.",
      included: "Term, IUL, WL, DI, AUM advisory, 401(k).",
      omitted: "LTC, FIA, 529, Estate, Premium Finance, Split Dollar, Deferred Comp.",
      idealFor: "Clients wanting insurance + investments from one advisor.",
      sources: "FINRA BD Statistics 2025.",
    },
  },
  diy: {
    name: "DIY (Self-Directed)",
    desc: "Lowest cost, no advisor, no insurance",
    color: "#16A34A",
    aumFee: 0.0003,
    advisoryAlpha: 0,
    taxDrag: 0.002,
    products: ["aum", "401k", "roth"],
    features: { holistic: false, taxFree: false, livingBen: false, advisor: false, estate: false, group: false, fiduciary: false, lowFees: true, insurance: false },
    notes: "Cheapest option but no professional guidance.",
    strategyInfo: {
      whyChoose: "Absolute lowest cost, full control.",
      included: "Self-directed brokerage, 401(k), Roth IRA.",
      omitted: "All insurance, estate planning, professional advice.",
      idealFor: "Financially literate individuals comfortable managing everything themselves.",
      sources: "Vanguard, Fidelity, Schwab fee schedules 2025.",
    },
  },
  donothing: {
    name: "Do Nothing (Status Quo)",
    desc: "No planning, no products, savings only",
    color: "#94A3B8",
    aumFee: 0,
    advisoryAlpha: -0.035,
    taxDrag: 0.015,
    products: [],
    features: { holistic: false, taxFree: false, livingBen: false, advisor: false, estate: false, group: false, fiduciary: false, lowFees: true, insurance: false },
    notes: "Dalbar QAIB 2025: average investor underperforms by 3.5%/yr.",
    strategyInfo: {
      whyChoose: "No effort required.",
      included: "Savings account only.",
      omitted: "Everything — no insurance, no investments, no tax planning.",
      idealFor: "Baseline comparison only. Not recommended.",
      sources: "Dalbar QAIB 2025, Federal Reserve SCF 2025.",
    },
  },
  bestoverall: {
    name: "Best-of-Breed (Cherry Pick)",
    desc: "Best product from each category, multiple providers",
    color: "#EC4899",
    aumFee: 0.006,
    advisoryAlpha: 0.025,
    taxDrag: 0.004,
    products: ["term", "iul", "wl", "di", "ltc", "fia", "aum", "401k", "roth", "529", "estate"],
    features: { holistic: true, taxFree: true, livingBen: true, advisor: true, estate: true, group: false, fiduciary: true, lowFees: true, insurance: true },
    notes: "Theoretical best — requires coordinating multiple providers.",
    strategyInfo: {
      whyChoose: "Theoretical optimum — best product from each category.",
      included: "Best-in-class from each: Term (Haven), IUL (Penn Mutual), WL (NWM), DI (Guardian), LTC (Mutual of Omaha), FIA (Athene), AUM (Dimensional), 401(k), Roth, 529, Estate.",
      omitted: "Premium Finance, Split Dollar, Deferred Comp (require single-firm coordination).",
      idealFor: "Theoretical comparison. Practically difficult to coordinate.",
      sources: "Multiple carrier rate sheets 2025.",
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCT MODEL FUNCTIONS (exact from v7)
// ═══════════════════════════════════════════════════════════════════════════

function modelTerm(p: ProductConfig, yr: number, age: number): ProductResult {
  const face = p.face || 500000;
  const termYears = p.termYears || 20;
  const prem = p.annualPremium || estPrem("term", age - yr, face);
  const active = yr <= termYears;
  return {
    cashValue: 0,
    deathBenefit: active ? face : 0,
    taxSaving: 0,
    livingBenefit: 0,
    legacyValue: active ? face : 0,
    annualCost: active ? prem : 0,
    label: `Term Life (${termYears}yr)`,
    carrier: p.carrier || "WealthBridge",
  };
}

function modelIUL(p: ProductConfig, yr: number, age: number): ProductResult {
  const face = p.face || 500000;
  const prem = p.annualPremium || estPrem("iul", age - yr, face);
  const fundingYears = p.fundingYears || 10;
  const livingBenPct = p.livingBenPct || 0.90;

  // IUL cash value accumulation with cap/floor
  const capRate = 0.10;
  const floorRate = 0.0;
  const avgCrediting = 0.065;
  const coiPct = yr <= 10 ? 0.02 : yr <= 20 ? 0.025 : 0.03;

  const prevCV = p._prevCashValue || 0;
  const premium = yr <= fundingYears ? prem : 0;
  const credited = prevCV * avgCrediting;
  const coi = (prevCV + premium) * coiPct;
  const cv = Math.max(0, prevCV + premium + credited - coi);
  p._prevCashValue = cv;

  return {
    cashValue: Math.round(cv),
    deathBenefit: Math.max(face, Math.round(cv * 1.1)),
    taxSaving: Math.round(premium * 0.25),
    livingBenefit: Math.round(Math.max(face, cv * 1.1) * livingBenPct),
    legacyValue: Math.max(face, Math.round(cv * 1.1)),
    annualCost: premium,
    label: "IUL (Tax-Free Retirement)",
    carrier: p.carrier || "WealthBridge",
    expectedValue: Math.round(cv * 0.8),
    details: { capRate, floorRate, avgCrediting, coiPct, credited: Math.round(credited), coi: Math.round(coi) },
  };
}

function modelWL(p: ProductConfig, yr: number, age: number): ProductResult {
  const face = p.face || 300000;
  const prem = p.annualPremium || estPrem("wl", age - yr, face);
  const payYears = p.payYears || 20;
  const divRate = p.dividendRate || 0.045;

  const prevCV = p._prevCashValue || 0;
  const premium = yr <= payYears ? prem : 0;
  const guaranteedGrowth = prevCV * 0.025;
  const dividend = prevCV * divRate;
  const cv = prevCV + premium * 0.65 + guaranteedGrowth + dividend;
  p._prevCashValue = cv;

  return {
    cashValue: Math.round(cv),
    deathBenefit: Math.round(face + cv * 0.5),
    taxSaving: Math.round(premium * 0.15),
    livingBenefit: 0,
    legacyValue: Math.round(face + cv * 0.5),
    annualCost: premium,
    label: "Whole Life (Guaranteed Growth)",
    carrier: p.carrier || "WealthBridge",
    details: { guaranteedGrowth: Math.round(guaranteedGrowth), dividend: Math.round(dividend), divRate },
  };
}

function modelDI(p: ProductConfig, yr: number, age: number): ProductResult {
  const benefit = p.annualBenefit || Math.round((p.face || 60000) * 0.6);
  const prem = p.annualPremium || estPrem("di", age - yr, benefit);
  const toAge = p.toAge || 65;
  const active = (age - yr + yr) <= toAge;
  return {
    cashValue: 0,
    deathBenefit: 0,
    taxSaving: 0,
    livingBenefit: active ? benefit : 0,
    legacyValue: 0,
    annualCost: active ? prem : 0,
    label: "Disability Income",
    carrier: p.carrier || "WealthBridge",
  };
}

function modelLTC(p: ProductConfig, yr: number, age: number): ProductResult {
  const pool = p.benefitPool || 150000;
  const inflation = p.inflationRate || 0.03;
  const prem = p.annualPremium || estPrem("ltc", age - yr, pool);
  const adjustedPool = Math.round(pool * Math.pow(1 + inflation, yr));
  return {
    cashValue: 0,
    deathBenefit: 0,
    taxSaving: Math.round(prem * 0.20),
    livingBenefit: adjustedPool,
    legacyValue: 0,
    annualCost: prem,
    label: "Long-Term Care",
    carrier: p.carrier || "WealthBridge",
    details: { adjustedPool, inflation },
  };
}

function modelFIA(p: ProductConfig, yr: number, _age: number): ProductResult {
  const deposit = p.deposit || 100000;
  const avgReturn = p.avgReturn || 0.05;
  const riderFee = p.riderFee || RATES.fiaRiderFee;
  const rollUpRate = p.rollUpRate || 0.07;
  const withdrawalRate = p.withdrawalRate || 0.05;

  const prevVal = p._prevValue || deposit;
  const credited = prevVal * avgReturn;
  const fee = prevVal * riderFee;
  const val = prevVal + credited - fee;
  p._prevValue = val;

  const incomeBase = (p._incomeBase || deposit) * (1 + rollUpRate);
  p._incomeBase = incomeBase;
  const annualIncome = Math.round(incomeBase * withdrawalRate);

  return {
    cashValue: Math.round(val),
    deathBenefit: Math.round(Math.max(val, deposit)),
    taxSaving: 0,
    livingBenefit: annualIncome,
    legacyValue: Math.round(Math.max(val, deposit)),
    annualCost: Math.round(fee),
    label: "Fixed Indexed Annuity",
    carrier: p.carrier || "WealthBridge",
    expectedValue: Math.round(val),
    details: { incomeBase: Math.round(incomeBase), annualIncome, rollUpRate, withdrawalRate },
  };
}

function modelAUM(p: ProductConfig, yr: number, _age: number): ProductResult {
  const initial = p.initialAUM || 100000;
  const add = p.annualAdd || 12000;
  const feeRate = p.feeRate || 0.0085;
  const grossReturn = p.grossReturn || 0.08;
  const alpha = p.advisoryAlpha || 0.03;
  const taxDrag = p.taxDrag || 0.005;

  const prevVal = p._prevValue || initial;
  const netReturn = grossReturn + alpha - feeRate - taxDrag;
  const growth = prevVal * netReturn;
  const val = prevVal + growth + add;
  p._prevValue = val;
  const fee = Math.round(val * feeRate);
  const taxSaving = Math.round(val * taxDrag * 0.5);

  return {
    cashValue: Math.round(val),
    deathBenefit: 0,
    taxSaving,
    livingBenefit: 0,
    legacyValue: Math.round(val),
    annualCost: fee,
    label: "AUM Advisory",
    carrier: p.carrier || "WealthBridge",
    expectedValue: Math.round(val),
    details: { grossReturn, alpha, feeRate, taxDrag, netReturn: Math.round(netReturn * 10000) / 10000 },
  };
}

function model401k(p: ProductConfig, yr: number, _age: number): ProductResult {
  const contrib = p.annualContrib || 23500;
  const match = p.employerMatch || 0.047;
  const grossReturn = p.grossReturn || 0.07;
  const isRoth = p.isRoth || false;

  const prevVal = p._prevValue || (p.initialBalance || 0);
  const totalContrib = contrib + contrib * match;
  const growth = prevVal * grossReturn;
  const val = prevVal + totalContrib + growth;
  p._prevValue = val;

  const taxSaving = isRoth ? 0 : Math.round(contrib * 0.25);

  return {
    cashValue: Math.round(val),
    deathBenefit: 0,
    taxSaving,
    livingBenefit: 0,
    legacyValue: Math.round(val),
    annualCost: 0,
    label: isRoth ? "Roth 401(k)" : "Traditional 401(k)",
    carrier: p.carrier || "Employer Plan",
    expectedValue: Math.round(val),
    details: { contrib, matchPct: match, totalContrib: Math.round(totalContrib) },
  };
}

function modelRoth(p: ProductConfig, yr: number, _age: number): ProductResult {
  const contrib = p.annualContrib || 7000;
  const grossReturn = p.grossReturn || 0.08;

  const prevVal = p._prevValue || (p.initialBalance || 0);
  const growth = prevVal * grossReturn;
  const val = prevVal + contrib + growth;
  p._prevValue = val;

  return {
    cashValue: Math.round(val),
    deathBenefit: 0,
    taxSaving: Math.round(val * grossReturn * 0.25),
    livingBenefit: 0,
    legacyValue: Math.round(val),
    annualCost: 0,
    label: "Roth IRA (Tax-Free Growth)",
    carrier: p.carrier || "WealthBridge",
    expectedValue: Math.round(val),
  };
}

function model529(p: ProductConfig, yr: number, _age: number): ProductResult {
  const contrib = p.annualContrib || 5000;
  const grossReturn = p.grossReturn || 0.06;

  const prevVal = p._prevValue || (p.initialBalance || 0);
  const growth = prevVal * grossReturn;
  const val = prevVal + contrib + growth;
  p._prevValue = val;

  return {
    cashValue: Math.round(val),
    deathBenefit: 0,
    taxSaving: Math.round(contrib * 0.05),
    livingBenefit: 0,
    legacyValue: Math.round(val),
    annualCost: 0,
    label: "529 Education Savings",
    carrier: p.carrier || "State Plan",
    expectedValue: Math.round(val),
  };
}

function modelEstate(p: ProductConfig, yr: number, _age: number): ProductResult {
  const nw = p.netWorth || 5000000;
  const growth = p.growthRate || 0.06;
  const setupCost = p.setupCost || 5000;
  const annualReview = p.annualReview || 1500;
  const exemption = p.exemption || 13990000;

  const estateValue = nw * Math.pow(1 + growth, yr);
  const taxableEstate = Math.max(0, estateValue - exemption);
  const estateTax = Math.round(taxableEstate * 0.40);
  const taxSaving = Math.round(estateTax * 0.6);

  return {
    cashValue: 0,
    deathBenefit: 0,
    taxSaving,
    livingBenefit: 0,
    legacyValue: Math.round(estateValue - estateTax * 0.4),
    annualCost: yr === 1 ? setupCost + annualReview : annualReview,
    label: "Estate Planning",
    carrier: p.carrier || "WealthBridge",
    details: { estateValue: Math.round(estateValue), taxableEstate: Math.round(taxableEstate), estateTax, exemption },
  };
}

function modelPremFin(p: ProductConfig, yr: number, age: number): ProductResult {
  const face = p.face || 5000000;
  const cashOutlay = p.cashOutlay || 50000;
  const loanRate = p.loanRate || 0.055;
  const creditingRate = p.creditingRate || 0.065;
  const fundingYears = p.fundingYears || 10;

  const prem = estPrem("iul", age - yr, face);
  const prevCV = p._prevCashValue || 0;
  const prevLoan = p._prevValue || 0;

  const premium = yr <= fundingYears ? prem : 0;
  const loanAdvance = yr <= fundingYears ? Math.max(0, premium - cashOutlay) : 0;
  const loanBalance = (prevLoan + loanAdvance) * (1 + loanRate);
  p._prevValue = loanBalance;

  const credited = prevCV * creditingRate;
  const coi = (prevCV + premium) * 0.02;
  const cv = Math.max(0, prevCV + premium + credited - coi);
  p._prevCashValue = cv;

  const netEquity = cv - loanBalance;

  return {
    cashValue: Math.round(netEquity),
    deathBenefit: Math.round(face - loanBalance),
    taxSaving: Math.round(premium * 0.25),
    livingBenefit: Math.round(Math.max(0, face - loanBalance) * 0.9),
    legacyValue: Math.round(face - loanBalance),
    annualCost: yr <= fundingYears ? cashOutlay : 0,
    label: "Premium Finance IUL",
    carrier: p.carrier || "WealthBridge",
    expectedValue: Math.round(netEquity),
    details: { loanBalance: Math.round(loanBalance), csv: Math.round(cv), netEquity: Math.round(netEquity), spread: creditingRate - loanRate },
  };
}

function modelSplitDollar(p: ProductConfig, yr: number, age: number): ProductResult {
  const face = p.face || 2000000;
  const employerShare = p.employerShare || 0.80;
  const prem = estPrem("iul", age - yr, face);
  const employeeCost = Math.round(prem * (1 - employerShare));

  const prevCV = p._prevCashValue || 0;
  const cv = prevCV + prem * 0.55 + prevCV * 0.05;
  p._prevCashValue = cv;

  const employerRecovery = Math.min(cv, prem * yr * employerShare);
  const employeeBenefit = face - employerRecovery;

  return {
    cashValue: Math.round(cv - employerRecovery),
    deathBenefit: Math.round(employeeBenefit),
    taxSaving: Math.round(prem * employerShare * 0.21),
    livingBenefit: 0,
    legacyValue: Math.round(employeeBenefit),
    annualCost: employeeCost,
    label: "Split Dollar",
    carrier: p.carrier || "WealthBridge",
    details: { employerRecovery: Math.round(employerRecovery), employeeBenefit: Math.round(employeeBenefit), employerShare },
  };
}

function modelDeferredComp(p: ProductConfig, yr: number, _age: number): ProductResult {
  const contrib = p.annualContrib || 50000;
  const grossReturn = p.grossReturn || 0.07;
  const marginalRate = p.marginalRate || 0.37;

  const prevVal = p._prevValue || 0;
  const growth = prevVal * grossReturn;
  const val = prevVal + contrib + growth;
  p._prevValue = val;

  const taxSaving = Math.round(contrib * marginalRate);

  return {
    cashValue: Math.round(val),
    deathBenefit: 0,
    taxSaving,
    livingBenefit: 0,
    legacyValue: Math.round(val * (1 - marginalRate * 0.7)),
    annualCost: 0,
    label: "Deferred Compensation (NQDC)",
    carrier: p.carrier || "Employer",
    expectedValue: Math.round(val),
    details: { marginalRate, taxSaving, deferralAmount: contrib },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MODEL DISPATCHER
// ═══════════════════════════════════════════════════════════════════════════

const MODEL_MAP: Record<ProductType, (p: ProductConfig, yr: number, age: number) => ProductResult> = {
  term: modelTerm,
  iul: modelIUL,
  wl: modelWL,
  di: modelDI,
  ltc: modelLTC,
  fia: modelFIA,
  aum: modelAUM,
  "401k": model401k,
  roth: modelRoth,
  "529": model529,
  estate: modelEstate,
  premfin: modelPremFin,
  splitdollar: modelSplitDollar,
  deferredcomp: modelDeferredComp,
};

// ═══════════════════════════════════════════════════════════════════════════
// STRATEGY BUILDER (auto-select products for a company)
// ═══════════════════════════════════════════════════════════════════════════

export function buildStrategy(companyKey: CompanyKey, profile: ClientProfile, customProducts?: ProductConfig[] | null): StrategyConfig {
  if (!companyKey || !COMPANIES[companyKey]) throw new Error(`UWE.buildStrategy: unknown company '${companyKey}'`);
  if (!profile) throw new Error("UWE.buildStrategy: profile is required");
  const co = COMPANIES[companyKey] || COMPANIES.wealthbridge;
  const age = profile.age || 40;
  const income = profile.income || 120000;
  const nw = profile.netWorth || 350000;
  const savings = profile.savings || 180000;
  const deps = profile.dependents || 2;
  const mortgage = profile.mortgage || 250000;
  const debts = profile.debts || 30000;
  const existIns = profile.existingInsurance || 0;

  const products: ProductConfig[] = customProducts ? [...customProducts] : [];

  if (!customProducts) {
    const availableTypes = co.products;

    if (availableTypes.includes("term")) {
      const need = Math.max(0, income * 10 + mortgage + debts - existIns);
      if (need > 0) products.push({ type: "term", face: need, termYears: 20 });
    }
    if (availableTypes.includes("iul")) {
      const face = Math.max(500000, income * 15);
      products.push({ type: "iul", face, fundingYears: 10, livingBenPct: 0.90 });
    }
    if (availableTypes.includes("wl")) {
      const face = Math.max(300000, income * 5);
      products.push({ type: "wl", face, payYears: 20, dividendRate: 0.045 });
    }
    if (availableTypes.includes("di")) {
      products.push({ type: "di", annualBenefit: Math.round(income * 0.6), toAge: 65 });
    }
    if (availableTypes.includes("ltc")) {
      products.push({ type: "ltc", benefitPool: 150000, inflationRate: 0.03 });
    }
    if (availableTypes.includes("fia")) {
      products.push({ type: "fia", deposit: Math.max(50000, savings * 0.3), avgReturn: 0.05 });
    }
    if (availableTypes.includes("aum")) {
      products.push({
        type: "aum",
        initialAUM: savings,
        annualAdd: Math.round(income * 0.10),
        feeRate: co.aumFee,
        grossReturn: 0.08,
        advisoryAlpha: co.advisoryAlpha,
        taxDrag: co.taxDrag,
      });
    }
    if (availableTypes.includes("401k")) {
      products.push({ type: "401k", annualContrib: 23500, employerMatch: 0.047, grossReturn: 0.07 });
    }
    if (availableTypes.includes("roth")) {
      products.push({ type: "roth", annualContrib: 7000, grossReturn: 0.08 });
    }
    if (availableTypes.includes("529") && deps > 0) {
      products.push({ type: "529", annualContrib: 5000 * deps, grossReturn: 0.06 });
    }
    if (availableTypes.includes("estate") && nw > 2000000) {
      products.push({ type: "estate", netWorth: nw, growthRate: 0.06 });
    }
    if (availableTypes.includes("premfin") && nw > 1000000) {
      products.push({ type: "premfin", face: 5000000, cashOutlay: 50000, loanRate: 0.055, creditingRate: 0.065 });
    }
    if (availableTypes.includes("splitdollar") && profile.isBizOwner) {
      products.push({ type: "splitdollar", face: 2000000, employerShare: 0.80 });
    }
    if (availableTypes.includes("deferredcomp") && income > 200000) {
      products.push({ type: "deferredcomp", annualContrib: 50000, grossReturn: 0.07, marginalRate: 0.37 });
    }
  }

  return {
    company: companyKey,
    companyName: co.name,
    color: co.color,
    profile,
    products,
    features: co.features,
    notes: co.notes,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SIMULATE (year-by-year product accumulation)
// ═══════════════════════════════════════════════════════════════════════════

export function simulate(strategy: StrategyConfig, years: number = 30): YearlySnapshot[] {
  if (!strategy || !strategy.profile) throw new Error("UWE.simulate: strategy and profile are required");
  if (years < 1 || years > 200) throw new Error("UWE.simulate: years must be 1-200");
  const profile = strategy.profile;
  const age = profile.age || 40;
  const savings = profile.savings || 0;
  const monthlySav = profile.monthlySavings || Math.round((profile.income || 120000) * 0.10 / 12);

  // Deep-clone products to reset mutable state
  const products: ProductConfig[] = strategy.products.map((p) => ({ ...p, _prevCashValue: undefined, _prevValue: undefined, _incomeBase: undefined }));

  const results: YearlySnapshot[] = [];
  let cumCost = 0;
  let cumTaxSaving = 0;
  let savBal = savings;

  for (let yr = 1; yr <= years; yr++) {
    let totalCV = 0, totalDB = 0, totalTS = 0, totalLB = 0, totalLV = 0, totalCost = 0, totalEV = 0;
    const details: ProductResult[] = [];

    for (const p of products) {
      const modelFn = MODEL_MAP[p.type];
      if (!modelFn) continue;
      const r = modelFn(p, yr, age + yr);
      totalCV += r.cashValue;
      totalDB += r.deathBenefit;
      totalTS += r.taxSaving;
      totalLB += r.livingBenefit;
      totalLV += r.legacyValue;
      totalCost += r.annualCost;
      totalEV += (r.expectedValue || 0);
      details.push(r);
    }

    cumCost += totalCost;
    cumTaxSaving += totalTS;

    // Savings balance grows with investment return + monthly contributions
    const investReturn = profile.equitiesReturn || 0.07;
    savBal = savBal * (1 + investReturn) + monthlySav * 12 + totalTS * 0.5;

    const totalWealth = savBal + totalCV;
    const totalProtection = totalDB + totalLB;
    const totalValue = totalWealth + totalDB + totalLB + cumTaxSaving + totalEV;
    const netValue = totalValue - cumCost;
    const roi = cumCost > 0 ? totalValue / cumCost : 0;

    results.push({
      year: yr,
      age: age + yr,
      productCashValue: Math.round(totalCV),
      productDeathBenefit: Math.round(totalDB),
      productTaxSaving: Math.round(totalTS),
      productLivingBenefit: Math.round(totalLB),
      productLegacyValue: Math.round(totalLV),
      productAnnualCost: Math.round(totalCost),
      productExpectedValue: Math.round(totalEV),
      savingsBalance: Math.round(savBal),
      totalWealth: Math.round(totalWealth),
      totalProtection: Math.round(totalProtection),
      totalAnnualCost: Math.round(totalCost),
      cumulativeCost: Math.round(cumCost),
      cumulativeTaxSaving: Math.round(cumTaxSaving),
      totalValue: Math.round(totalValue),
      netValue: Math.round(netValue),
      roi: Math.round(roi * 100) / 100,
      productDetails: details,
    });
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// MONTE CARLO SIMULATION
// ═══════════════════════════════════════════════════════════════════════════

function boxMuller(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export function monteCarlo(
  strategy: StrategyConfig,
  years: number = 30,
  trials: number = 1000,
  volatility: number = 0.15,
): MonteCarloPercentile[] {
  if (!strategy || !strategy.profile) throw new Error("UWE.monteCarlo: strategy and profile are required");
  if (trials < 1 || trials > 100000) throw new Error("UWE.monteCarlo: trials must be 1-100000");
  const profile = strategy.profile;
  const savings = profile.savings || 0;
  const monthlySav = profile.monthlySavings || Math.round((profile.income || 120000) * 0.10 / 12);
  const expectedReturn = profile.equitiesReturn || 0.07;

  // Collect all trial paths
  const paths: number[][] = [];
  for (let t = 0; t < trials; t++) {
    const path: number[] = [];
    let bal = savings;
    for (let yr = 1; yr <= years; yr++) {
      const randReturn = expectedReturn + volatility * boxMuller();
      const clampedReturn = Math.max(-0.40, Math.min(0.60, randReturn));
      bal = (bal + monthlySav * 12) * (1 + clampedReturn);
      if (bal < 0) bal = 0;
      path.push(Math.round(bal));
    }
    paths.push(path);
  }

  // Compute percentiles per year
  const result: MonteCarloPercentile[] = [];
  for (let yr = 0; yr < years; yr++) {
    const vals = paths.map((p) => p[yr]).sort((a, b) => a - b);
    const n = vals.length;
    const sum = vals.reduce((a, b) => a + b, 0);
    const successCount = vals.filter((v) => v > 0).length;

    result.push({
      p10: vals[Math.floor(n * 0.10)],
      p25: vals[Math.floor(n * 0.25)],
      p50: vals[Math.floor(n * 0.50)],
      p75: vals[Math.floor(n * 0.75)],
      p90: vals[Math.floor(n * 0.90)],
      mean: Math.round(sum / n),
      min: vals[0],
      max: vals[n - 1],
      successRate: successCount / n,
    });
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

export const UWE = {
  RATES,
  COMPANIES,
  interpRate,
  estPrem,
  buildStrategy,
  simulate,
  monteCarlo,
  getCompanyKeys: (): CompanyKey[] => Object.keys(COMPANIES) as CompanyKey[],
  getCompany: (key: CompanyKey) => COMPANIES[key],
};

export default UWE;
