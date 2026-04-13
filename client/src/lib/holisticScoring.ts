/**
 * holisticScoring.ts — Profile-driven holistic financial scoring engine.
 *
 * Mirrors the v7 HTML cA() master function: reads a shared FinancialProfile,
 * scores 7 domains (0-3), rolls up to a composite Financial Health %,
 * generates recommended products, cost-benefit analysis, and action timeline.
 *
 * Pure TypeScript — no React, no side effects, fully testable.
 */

import type { FinancialProfile } from "@/hooks/useFinancialProfile";

// ─── Types ────────────────────────────────────────────────────────

export type DomainId = "cashFlow" | "protection" | "growth" | "retirement" | "tax" | "estate" | "education";

export interface DomainMetric {
  name: string;
  value: string;
  status: "good" | "warn" | "bad";
}

export interface DomainScore {
  id: DomainId;
  label: string;
  score: 0 | 1 | 2 | 3;
  statusLabel: string;
  metrics: DomainMetric[];
  actions: string[];
  deepDiveUrl: string;
  icon: string; // lucide icon name
}

export interface RecommendedProduct {
  product: string;
  coverage: string;
  estPremium: string;
  priority: "high" | "medium" | "low";
  carrier: string;
  rationale: string;
}

export interface ActionItem {
  priority: 1 | 2 | 3;
  priorityLabel: string;
  area: string;
  action: string;
  timeline: string;
  estCost: string;
}

export interface CostBenefitSummary {
  annualPlanningCost: number;
  totalBenefitValue: number;
  roiRatio: number;
  pctOfIncome: number;
  productCount: number;
}

export interface HolisticResult {
  domains: DomainScore[];
  compositeScore: number; // 0-100
  compositeRaw: number;   // sum of domain scores
  compositeMax: number;   // max possible
  stageLabel: string;
  products: RecommendedProduct[];
  costBenefit: CostBenefitSummary;
  actions: ActionItem[];
  profileCompleteness: number; // 0-1
}

// ─── Rate Tables (from v7 HTML) ───────────────────────────────────

interface RatePoint { age: number; rate: number }

const RATES = {
  termPer100K: [
    { age: 20, rate: 31 }, { age: 25, rate: 33 }, { age: 30, rate: 35 },
    { age: 35, rate: 42 }, { age: 40, rate: 56 }, { age: 45, rate: 78 },
    { age: 50, rate: 135 }, { age: 55, rate: 195 }, { age: 60, rate: 377 },
    { age: 65, rate: 620 }, { age: 70, rate: 1557 },
  ] as RatePoint[],
  iulPer100K: [
    { age: 20, rate: 480 }, { age: 25, rate: 540 }, { age: 30, rate: 660 },
    { age: 35, rate: 840 }, { age: 40, rate: 1080 }, { age: 45, rate: 1380 },
    { age: 50, rate: 1800 }, { age: 55, rate: 2400 }, { age: 60, rate: 3240 },
    { age: 65, rate: 4500 },
  ] as RatePoint[],
  wlPer100K: [
    { age: 20, rate: 603 }, { age: 25, rate: 720 }, { age: 30, rate: 862 },
    { age: 35, rate: 1020 }, { age: 40, rate: 1277 }, { age: 45, rate: 1620 },
    { age: 50, rate: 2014 }, { age: 55, rate: 2580 }, { age: 60, rate: 3360 },
    { age: 65, rate: 4500 },
  ] as RatePoint[],
  diPctBenefit: [
    { age: 25, rate: 0.020 }, { age: 30, rate: 0.022 }, { age: 35, rate: 0.025 },
    { age: 40, rate: 0.030 }, { age: 45, rate: 0.038 }, { age: 50, rate: 0.048 },
    { age: 55, rate: 0.060 }, { age: 60, rate: 0.080 },
  ] as RatePoint[],
  ltcAnnual: [
    { age: 40, rate: 2400 }, { age: 45, rate: 3200 }, { age: 50, rate: 4200 },
    { age: 55, rate: 5600 }, { age: 60, rate: 7800 }, { age: 65, rate: 10800 },
    { age: 70, rate: 15600 },
  ] as RatePoint[],
  groupPerEmp: 7911,
};

function interpRate(table: RatePoint[], age: number): number {
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

function estPrem(type: string, age: number, amount: number): number {
  if (amount <= 0) return 0;
  switch (type) {
    case "term": return Math.round(interpRate(RATES.termPer100K, age) * (amount / 100000));
    case "iul": return Math.round(interpRate(RATES.iulPer100K, age) * (amount / 100000));
    case "wl": return Math.round(interpRate(RATES.wlPer100K, age) * (amount / 100000));
    case "di": return Math.round(interpRate(RATES.diPctBenefit, age) * amount);
    case "ltc": return Math.round(interpRate(RATES.ltcAnnual, age) * (amount / 150000));
    case "group": return Math.round(RATES.groupPerEmp * amount);
    default: return 0;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────

function n(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return fallback;
}

function fmt(v: number): string {
  return "$" + v.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function pct(v: number): string {
  return (v * 100).toFixed(1) + "%";
}

function scoreLabel(s: 0 | 1 | 2 | 3): string {
  if (s === 3) return "Strong";
  if (s === 2) return "Needs Work";
  if (s === 1) return "Critical";
  return "Not Scored";
}

// ─── Domain Scoring Functions ─────────────────────────────────────

function scoreCashFlow(p: FinancialProfile): DomainScore {
  const income = n(p.annualIncome ?? p.income);
  const monthlyIncome = income / 12;
  const savings = n(p.portfolioBalance ?? p.savings);
  const monthlySavings = n(p.monthlyContribution ?? p.monthlySavings);
  const mortgage = n(p.mortgageBalance ?? p.mortgage);
  const debts = n(p.otherDebts ?? p.debts);
  const monthlyDebt = (mortgage + debts) / 12 * 0.08; // approximate monthly debt service

  const savingsRate = monthlyIncome > 0 ? monthlySavings / monthlyIncome : 0;
  const dti = monthlyIncome > 0 ? monthlyDebt / monthlyIncome : 0;
  const emergencyMonths = monthlySavings > 0 ? savings / (monthlyIncome - monthlySavings) : (monthlyIncome > 0 ? savings / monthlyIncome : 0);

  let score: 0 | 1 | 2 | 3 = 0;
  if (income > 0) {
    score = savingsRate >= 0.15 ? 3 : savingsRate >= 0.10 ? 2 : 1;
  }

  const metrics: DomainMetric[] = [];
  if (income > 0) {
    metrics.push({ name: "Savings Rate", value: pct(savingsRate), status: savingsRate >= 0.15 ? "good" : savingsRate >= 0.10 ? "warn" : "bad" });
    metrics.push({ name: "Emergency Fund", value: emergencyMonths >= 6 ? `${Math.round(emergencyMonths)} mo` : emergencyMonths > 0 ? `${emergencyMonths.toFixed(1)} mo` : "None", status: emergencyMonths >= 6 ? "good" : emergencyMonths >= 3 ? "warn" : "bad" });
    metrics.push({ name: "DTI Ratio", value: pct(dti), status: dti <= 0.36 ? "good" : dti <= 0.50 ? "warn" : "bad" });
    metrics.push({ name: "Monthly Surplus", value: fmt(monthlySavings), status: monthlySavings > 0 ? "good" : "bad" });
  }

  const actions: string[] = [];
  if (savingsRate < 0.15) actions.push("Increase savings rate to 15%+ of gross income");
  if (emergencyMonths < 6) actions.push("Build emergency fund to 6 months of expenses");
  if (dti > 0.36) actions.push("Reduce debt-to-income ratio below 36%");

  return {
    id: "cashFlow", label: "Cash Flow", score, statusLabel: scoreLabel(score),
    metrics, actions, deepDiveUrl: "/income-projection", icon: "Wallet",
  };
}

function scoreProtection(p: FinancialProfile): DomainScore {
  const income = n(p.annualIncome ?? p.income);
  const age = n(p.currentAge ?? p.age, 35);
  const dependents = n(p.childrenCount ?? p.dependents);
  const mortgage = n(p.mortgageBalance ?? p.mortgage);
  const debts = n(p.otherDebts ?? p.debts);
  const existingIns = n(p.existingLifeInsurance ?? p.lifeInsuranceCoverage ?? p.existingInsurance);

  // DIME method
  const incomeYears = age < 40 ? 12 : age < 55 ? 10 : 6;
  const eduPerChild = 100000;
  const finalExpenses = 25000;
  const dimeNeed = mortgage + debts + (income * 0.8 * incomeYears) + (dependents * eduPerChild) + finalExpenses;
  const lifeGap = Math.max(0, dimeNeed - existingIns);

  // DI need (60% of income)
  const diNeed = Math.round(income * 0.6);
  const hasDI = p.hasDisability === true;
  const diGap = hasDI ? 0 : diNeed;

  // LTC need
  const ltcDailyRate = 300;
  const ltcYears = 3;
  const ltcInflation = 0.03;
  const ltcFutureCost = Math.round(ltcDailyRate * Math.pow(1 + ltcInflation, Math.max(0, 65 - age)));
  const ltcTotal = ltcFutureCost * 365 * ltcYears;
  const hasLTC = p.hasLtc === true;

  let score: 0 | 1 | 2 | 3 = 0;
  if (income > 0) {
    score = (lifeGap <= 0 && diGap <= 0) ? 3 : lifeGap < income * 5 ? 2 : 1;
  }

  const metrics: DomainMetric[] = [];
  if (income > 0) {
    metrics.push({ name: "Life Insurance Gap", value: lifeGap > 0 ? fmt(lifeGap) : "Covered", status: lifeGap <= 0 ? "good" : lifeGap < income * 5 ? "warn" : "bad" });
    metrics.push({ name: "Disability Income", value: hasDI ? "Covered" : fmt(diGap) + "/yr gap", status: hasDI ? "good" : "bad" });
    if (age >= 30) metrics.push({ name: "LTC Coverage", value: hasLTC ? "Covered" : fmt(ltcTotal) + " need", status: hasLTC ? "good" : "warn" });
    metrics.push({ name: "DIME Need", value: fmt(dimeNeed), status: existingIns >= dimeNeed ? "good" : "bad" });
  }

  const actions: string[] = [];
  if (lifeGap > 0) actions.push(`Close ${fmt(lifeGap)} life insurance gap (Term + IUL blend)`);
  if (!hasDI) actions.push("Obtain disability income coverage (60% of income)");
  if (!hasLTC && age >= 30) actions.push("Evaluate LTC hybrid policy");

  return {
    id: "protection", label: "Protection", score, statusLabel: scoreLabel(score),
    metrics, actions, deepDiveUrl: "/insurance-analysis", icon: "Shield",
  };
}

function scoreGrowth(p: FinancialProfile): DomainScore {
  const age = n(p.currentAge ?? p.age, 35);
  const retAge = n(p.retirementAge, 65);
  const income = n(p.annualIncome ?? p.income);
  const savings = n(p.portfolioBalance ?? p.savings);
  const monthlySavings = n(p.monthlyContribution ?? p.monthlySavings);
  const returnRate = n(p.equitiesReturn, 0.07);
  const years = Math.max(1, retAge - age);

  // Project future value
  let balance = savings;
  for (let y = 0; y < years; y++) {
    balance = (balance + monthlySavings * 12) * (1 + returnRate);
  }
  const projectedBalance = Math.round(balance);

  // Target: 25× desired retirement income (4% rule)
  const desiredIncome = n(p.desiredRetirementIncome, income * 0.8);
  const target = desiredIncome * 25;
  const pctOfTarget = target > 0 ? projectedBalance / target : 0;

  let score: 0 | 1 | 2 | 3 = 0;
  if (income > 0) {
    score = pctOfTarget >= 1 ? 3 : pctOfTarget >= 0.75 ? 2 : 1;
  }

  const metrics: DomainMetric[] = [];
  if (income > 0) {
    metrics.push({ name: "Projected at Retirement", value: fmt(projectedBalance), status: pctOfTarget >= 1 ? "good" : pctOfTarget >= 0.75 ? "warn" : "bad" });
    metrics.push({ name: "Target (25× income)", value: fmt(target), status: pctOfTarget >= 1 ? "good" : "warn" });
    metrics.push({ name: "% of Target", value: pct(pctOfTarget), status: pctOfTarget >= 1 ? "good" : pctOfTarget >= 0.75 ? "warn" : "bad" });
    metrics.push({ name: "Years to Retirement", value: `${years} yr`, status: years > 10 ? "good" : years > 5 ? "warn" : "bad" });
  }

  const actions: string[] = [];
  if (pctOfTarget < 1) actions.push("Increase monthly contributions to close retirement gap");
  if (monthlySavings < income / 12 * 0.15) actions.push("Target 15%+ savings rate for growth");
  if (savings < income * 0.5) actions.push("Build investment portfolio to at least 50% of annual income");

  return {
    id: "growth", label: "Growth & Investment", score, statusLabel: scoreLabel(score),
    metrics, actions, deepDiveUrl: "/financial-planning", icon: "TrendingUp",
  };
}

function scoreRetirement(p: FinancialProfile): DomainScore {
  const age = n(p.currentAge ?? p.age, 35);
  const retAge = n(p.retirementAge, 65);
  const income = n(p.annualIncome ?? p.income);
  const savings = n(p.portfolioBalance ?? p.savings);
  const monthlySavings = n(p.monthlyContribution ?? p.monthlySavings);
  const desiredIncome = n(p.desiredRetirementIncome, income * 0.8);
  const ssEstimate = n(p.estimatedSSBenefit, income * 0.25);
  const returnRate = n(p.equitiesReturn, 0.07);
  const years = Math.max(1, retAge - age);
  const retYears = n(p.yearsInRetirement, 25);

  // Project savings at retirement
  let balance = savings;
  for (let y = 0; y < years; y++) {
    balance = (balance + monthlySavings * 12) * (1 + returnRate);
  }

  // Safe withdrawal (4% rule)
  const safeWithdrawal = Math.round(balance * 0.04);
  const totalRetIncome = safeWithdrawal + ssEstimate;
  const replacementRatio = desiredIncome > 0 ? totalRetIncome / desiredIncome : 0;
  const retGap = Math.max(0, desiredIncome - totalRetIncome);

  let score: 0 | 1 | 2 | 3 = 0;
  if (income > 0) {
    score = replacementRatio >= 0.8 ? 3 : replacementRatio >= 0.6 ? 2 : 1;
  }

  const metrics: DomainMetric[] = [];
  if (income > 0) {
    metrics.push({ name: "Income Replacement", value: pct(replacementRatio), status: replacementRatio >= 0.8 ? "good" : replacementRatio >= 0.6 ? "warn" : "bad" });
    metrics.push({ name: "Retirement Income", value: fmt(totalRetIncome) + "/yr", status: retGap <= 0 ? "good" : "warn" });
    metrics.push({ name: "Income Gap", value: retGap > 0 ? fmt(retGap) + "/yr" : "None", status: retGap <= 0 ? "good" : "bad" });
    metrics.push({ name: "Portfolio at Retirement", value: fmt(Math.round(balance)), status: balance > desiredIncome * 25 ? "good" : "warn" });
  }

  const actions: string[] = [];
  if (replacementRatio < 0.8) actions.push("Close retirement income gap with increased contributions or FIA");
  if (age >= 55 && !p.estimatedSSBenefit) actions.push("Get Social Security estimate from ssa.gov");
  if (retGap > 0) actions.push(`Bridge ${fmt(retGap)}/yr gap with annuity or additional savings`);

  return {
    id: "retirement", label: "Retirement", score, statusLabel: scoreLabel(score),
    metrics, actions, deepDiveUrl: "/wealth-engine/retirement", icon: "Palmtree",
  };
}

function scoreTax(p: FinancialProfile): DomainScore {
  const income = n(p.annualIncome ?? p.income);
  const marginalRate = n(p.marginalRate, 0.22);
  const savings = n(p.portfolioBalance ?? p.savings);
  const monthlySavings = n(p.monthlyContribution ?? p.monthlySavings);
  const retContrib = n(p.retirementContributions);
  const hsaContrib = n(p.hsaContributions);
  const itemized = n(p.itemizedDeductions);

  // Estimate effective rate (simplified)
  const maxRetContrib = 23500; // 2026 401k limit
  const maxHSA = 4300; // 2026 HSA limit (individual)
  const retUtilization = retContrib > 0 ? Math.min(1, retContrib / maxRetContrib) : 0;
  const hsaUtilization = hsaContrib > 0 ? Math.min(1, hsaContrib / maxHSA) : 0;
  const taxOptimization = (retUtilization * 0.4 + hsaUtilization * 0.2 + (itemized > 15000 ? 0.2 : 0) + (monthlySavings > income / 12 * 0.1 ? 0.2 : 0));

  let score: 0 | 1 | 2 | 3 = 0;
  if (income > 0) {
    score = taxOptimization >= 0.7 ? 3 : taxOptimization >= 0.4 ? 2 : 1;
  }

  const potentialSavings = Math.round(income * marginalRate * (1 - taxOptimization) * 0.15);

  const metrics: DomainMetric[] = [];
  if (income > 0) {
    metrics.push({ name: "Marginal Rate", value: pct(marginalRate), status: marginalRate <= 0.22 ? "good" : marginalRate <= 0.32 ? "warn" : "bad" });
    metrics.push({ name: "Tax Optimization", value: pct(taxOptimization), status: taxOptimization >= 0.7 ? "good" : taxOptimization >= 0.4 ? "warn" : "bad" });
    metrics.push({ name: "401k Utilization", value: pct(retUtilization), status: retUtilization >= 0.8 ? "good" : retUtilization >= 0.5 ? "warn" : "bad" });
    metrics.push({ name: "Potential Savings", value: fmt(potentialSavings) + "/yr", status: potentialSavings < 2000 ? "good" : "warn" });
  }

  const actions: string[] = [];
  if (retUtilization < 0.8) actions.push("Max out 401k/IRA contributions");
  if (hsaUtilization < 0.5 && income > 0) actions.push("Maximize HSA contributions for triple tax benefit");
  if (marginalRate >= 0.32) actions.push("Evaluate Roth conversion strategy");
  if (savings > 100000) actions.push("Consider tax-loss harvesting opportunities");

  return {
    id: "tax", label: "Tax Planning", score, statusLabel: scoreLabel(score),
    metrics, actions, deepDiveUrl: "/tax-planning", icon: "Receipt",
  };
}

function scoreEstate(p: FinancialProfile): DomainScore {
  const income = n(p.annualIncome ?? p.income);
  const netWorth = n(p.netWorth ?? p.netEstate);
  const age = n(p.currentAge ?? p.age, 35);
  const dependents = n(p.childrenCount ?? p.dependents);
  const lifeInsInEstate = n(p.lifeInsuranceInEstate);
  const estateGoal = p.estateGoal || "none";

  const totalEstate = netWorth + lifeInsInEstate;
  const exemption = 13610000; // 2026 federal estate tax exemption
  const taxableEstate = Math.max(0, totalEstate - exemption);
  const estateTax = Math.round(taxableEstate * 0.40);

  const hasEstatePlan = estateGoal !== "none";
  const needsEstatePlan = netWorth > 500000 || dependents > 0 || age >= 40;

  let score: 0 | 1 | 2 | 3 = 0;
  if (income > 0) {
    if (hasEstatePlan && taxableEstate <= 0) score = 3;
    else if (hasEstatePlan || !needsEstatePlan) score = 2;
    else score = 1;
  }

  const metrics: DomainMetric[] = [];
  if (income > 0) {
    metrics.push({ name: "Total Estate", value: fmt(totalEstate), status: "good" });
    metrics.push({ name: "Estate Tax Exposure", value: taxableEstate > 0 ? fmt(estateTax) : "None", status: taxableEstate <= 0 ? "good" : "bad" });
    metrics.push({ name: "Estate Plan", value: hasEstatePlan ? "In Place" : "Not Set", status: hasEstatePlan ? "good" : needsEstatePlan ? "bad" : "warn" });
    if (dependents > 0) metrics.push({ name: "Beneficiaries", value: `${dependents} dependent(s)`, status: hasEstatePlan ? "good" : "warn" });
  }

  const actions: string[] = [];
  if (!hasEstatePlan && needsEstatePlan) actions.push("Establish estate plan (will, trust, POA, healthcare directive)");
  if (taxableEstate > 0) actions.push("Implement estate tax reduction strategies (ILIT, gifting)");
  if (dependents > 0 && !hasEstatePlan) actions.push("Name guardians and set up trust for dependents");
  if (lifeInsInEstate > 0) actions.push("Consider ILIT to remove life insurance from taxable estate");

  return {
    id: "estate", label: "Estate Planning", score, statusLabel: scoreLabel(score),
    metrics, actions, deepDiveUrl: "/estate", icon: "Landmark",
  };
}

function scoreEducation(p: FinancialProfile): DomainScore {
  const income = n(p.annualIncome ?? p.income);
  const dependents = n(p.childrenCount ?? p.dependents);
  const age = n(p.currentAge ?? p.age, 35);
  const costPerChild = n(p.educationCostPerChild, 100000);
  const savings = n(p.portfolioBalance ?? p.savings);

  const totalNeed = dependents * costPerChild;
  // Estimate 529 balance as a fraction of savings (simplified)
  const est529 = Math.min(savings * 0.1, totalNeed);
  const eduGap = Math.max(0, totalNeed - est529);

  let score: 0 | 1 | 2 | 3 = 0;
  if (dependents > 0 && income > 0) {
    score = eduGap <= 0 ? 3 : eduGap < totalNeed * 0.5 ? 2 : 1;
  }

  const metrics: DomainMetric[] = [];
  if (dependents > 0 && income > 0) {
    metrics.push({ name: "Education Need", value: fmt(totalNeed), status: "warn" });
    metrics.push({ name: "Est. 529 Balance", value: fmt(est529), status: est529 >= totalNeed ? "good" : est529 > 0 ? "warn" : "bad" });
    metrics.push({ name: "Education Gap", value: eduGap > 0 ? fmt(eduGap) : "Funded", status: eduGap <= 0 ? "good" : "bad" });
    metrics.push({ name: "Children", value: `${dependents}`, status: "good" });
  }

  const actions: string[] = [];
  if (eduGap > 0) actions.push("Open or increase 529 plan contributions");
  if (dependents > 0 && est529 <= 0) actions.push("Start education savings immediately — compound growth matters");

  return {
    id: "education", label: "Education", score, statusLabel: scoreLabel(score),
    metrics, actions, deepDiveUrl: "/financial-planning", icon: "GraduationCap",
  };
}

// ─── Recommended Products ─────────────────────────────────────────

function buildProducts(p: FinancialProfile, domains: DomainScore[]): RecommendedProduct[] {
  const products: RecommendedProduct[] = [];
  const age = n(p.currentAge ?? p.age, 35);
  const income = n(p.annualIncome ?? p.income);
  const netWorth = n(p.netWorth);
  const existingIns = n(p.existingLifeInsurance ?? p.lifeInsuranceCoverage ?? p.existingInsurance);
  const dependents = n(p.childrenCount ?? p.dependents);
  const isBiz = p.isBizOwner === true;

  const protDomain = domains.find(d => d.id === "protection");
  const lifeGapMetric = protDomain?.metrics.find(m => m.name === "Life Insurance Gap");
  const hasLifeGap = lifeGapMetric?.status !== "good";

  if (hasLifeGap && income > 0) {
    // DIME calculation
    const incYrs = age < 40 ? 12 : age < 55 ? 10 : 6;
    const dimeNeed = n(p.mortgageBalance ?? p.mortgage) + n(p.otherDebts ?? p.debts) + (income * 0.8 * incYrs) + (dependents * 100000) + 25000;
    const gap = Math.max(0, dimeNeed - existingIns);
    const termAmt = Math.round(gap * 0.6);
    const iulAmt = Math.round(gap * 0.4);

    if (termAmt > 0) {
      products.push({
        product: "Term Life (NLG)", coverage: fmt(termAmt),
        estPremium: fmt(estPrem("term", age, termAmt)) + "/yr",
        priority: "high", carrier: "NLG / Protective",
        rationale: "Income replacement for dependents (DIME method)",
      });
    }
    if (iulAmt > 0) {
      products.push({
        product: "IUL (FlexLife)", coverage: fmt(iulAmt),
        estPremium: fmt(estPrem("iul", age, iulAmt)) + "/yr",
        priority: "high", carrier: "NLG / Pacific Life",
        rationale: "Tax-advantaged accumulation + living benefits",
      });
    }
  }

  if (!p.hasDisability && age < 65 && income > 0) {
    const diNeed = Math.round(income * 0.6);
    products.push({
      product: "Disability Income", coverage: fmt(diNeed) + "/yr",
      estPremium: fmt(estPrem("di", age, diNeed)) + "/yr",
      priority: "high", carrier: "Guardian / Principal",
      rationale: "Protect 60% of income if unable to work",
    });
  }

  if (!p.hasLtc && age >= 30 && age < 75) {
    const ltcFuture = Math.round(300 * Math.pow(1.03, Math.max(0, 65 - age)));
    const ltcTotal = ltcFuture * 365 * 3;
    products.push({
      product: "LTC Hybrid", coverage: fmt(ltcTotal),
      estPremium: fmt(estPrem("ltc", age, ltcTotal)) + "/yr",
      priority: age >= 45 ? "high" : "medium", carrier: "Lincoln MoneyGuard",
      rationale: "Long-term care protection with death benefit",
    });
  }

  if (income > 0) {
    products.push({
      product: "401k / Roth IRA", coverage: "Max contribution",
      estPremium: fmt(23500) + "/yr (401k limit)",
      priority: "high", carrier: "Fidelity / Vanguard / Schwab",
      rationale: "Tax-advantaged retirement savings",
    });
  }

  if (age >= 35 || netWorth > 100000) {
    products.push({
      product: "Fixed Indexed Annuity", coverage: "Growth + protection",
      estPremium: "Varies by deposit",
      priority: "medium", carrier: "Athene / Allianz / NLG",
      rationale: "Principal protection with market-linked growth",
    });
  }

  if (netWorth > 50000) {
    const fee = netWorth >= 5000000 ? "0.60%" : netWorth >= 1000000 ? "0.85%" : netWorth >= 500000 ? "1.00%" : "1.25%";
    products.push({
      product: "Advisory / AUM", coverage: fmt(netWorth) + " managed",
      estPremium: fee + " AUM fee",
      priority: "medium", carrier: "RIA / Broker-Dealer",
      rationale: "Professional portfolio management and rebalancing",
    });
  }

  if (dependents > 0) {
    products.push({
      product: "529 Education Plan", coverage: fmt(dependents * 100000),
      estPremium: fmt(Math.round(dependents * 500)) + "/mo contribution",
      priority: "medium", carrier: "State plan / Vanguard",
      rationale: "Tax-advantaged education savings",
    });
  }

  if (isBiz && income > 250000) {
    products.push({
      product: "Key Person Insurance", coverage: fmt(income * 3),
      estPremium: fmt(estPrem("term", age, income * 3)) + "/yr",
      priority: "medium", carrier: "NLG / Protective",
      rationale: "Protect business from loss of key personnel",
    });
  }

  if (netWorth > 2000000 && income > 250000) {
    products.push({
      product: "Premium Finance IUL", coverage: fmt(netWorth),
      estPremium: "Leveraged — net cost varies",
      priority: "low", carrier: "Pacific Life / NLG",
      rationale: "High-net-worth wealth transfer strategy",
    });
  }

  if (netWorth > 500000) {
    products.push({
      product: "Estate Plan (Trust)", coverage: "Comprehensive",
      estPremium: "$2,500 - $5,000 one-time",
      priority: netWorth > 5000000 ? "high" : "medium", carrier: "Estate Attorney",
      rationale: "Will, trust, POA, healthcare directive, beneficiary review",
    });
  }

  return products;
}

// ─── Cost-Benefit Analysis ────────────────────────────────────────

function buildCostBenefit(p: FinancialProfile, products: RecommendedProduct[]): CostBenefitSummary {
  const income = n(p.annualIncome ?? p.income);
  const age = n(p.currentAge ?? p.age, 35);
  const netWorth = n(p.netWorth);

  // Estimate annual planning cost from products
  let annualCost = 0;
  let count = 0;
  for (const prod of products) {
    const match = prod.estPremium.match(/\$([\d,]+)/);
    if (match) {
      annualCost += parseInt(match[1].replace(/,/g, ""));
      count++;
    }
  }

  // Estimate total benefit value (mirrors v7 buildCombined)
  const incYrs = age < 40 ? 12 : age < 55 ? 10 : 6;
  const deathBenefit = income * incYrs;
  const wealthBuilding = Math.round(income * 0.08 * 20 * 0.6);
  const taxBenefit = Math.round(income * 0.08 * 20 * 0.25);
  const livingBenefit = Math.round(income * 0.6) + (age >= 40 ? 150000 : 0);
  const totalBenefit = deathBenefit + wealthBuilding + taxBenefit + livingBenefit;

  const roi = annualCost > 0 ? Math.round(totalBenefit / annualCost) : 0;
  const pctIncome = income > 0 ? annualCost / income : 0;

  return {
    annualPlanningCost: annualCost,
    totalBenefitValue: totalBenefit,
    roiRatio: roi,
    pctOfIncome: pctIncome,
    productCount: count,
  };
}

// ─── Action Timeline ──────────────────────────────────────────────

function buildActions(domains: DomainScore[]): ActionItem[] {
  const actions: ActionItem[] = [];

  for (const d of domains) {
    if (d.score === 0) continue; // not scored
    const priority: 1 | 2 | 3 = d.score === 1 ? 1 : d.score === 2 ? 2 : 3;
    const priorityLabel = priority === 1 ? "URGENT" : priority === 2 ? "Important" : "Maintain";

    for (const action of d.actions) {
      let timeline = "Month 1-3";
      if (priority === 1) timeline = "Week 1-4";
      else if (priority === 3) timeline = "Quarterly review";

      actions.push({
        priority, priorityLabel,
        area: d.label, action, timeline,
        estCost: "—",
      });
    }
  }

  // Sort by priority (URGENT first)
  actions.sort((a, b) => a.priority - b.priority);
  return actions;
}

// ─── Profile Completeness ─────────────────────────────────────────

function calcCompleteness(p: FinancialProfile): number {
  const coreFields: (keyof FinancialProfile)[] = [
    "age", "currentAge", "income", "annualIncome", "savings", "portfolioBalance",
    "monthlySavings", "monthlyContribution", "dependents", "childrenCount", "marginalRate",
  ];
  const extFields: (keyof FinancialProfile)[] = [
    "netWorth", "mortgage", "mortgageBalance", "debts", "otherDebts",
    "stateOfResidence", "stateCode", "filingStatus", "isBizOwner",
    "existingLifeInsurance", "lifeInsuranceCoverage", "retirementAge",
    "desiredRetirementIncome", "estimatedSSBenefit", "hasDisability", "hasLtc",
  ];

  // Deduplicate — count a field as present if either alias has a value
  const corePresent = new Set<string>();
  for (const k of coreFields) {
    if (p[k] !== undefined && p[k] !== null) {
      const base = String(k).replace(/^(current|annual|monthly|portfolio|children)/, "").toLowerCase();
      corePresent.add(base || String(k));
    }
  }
  const coreScore = Math.min(1, corePresent.size / 6) * 0.7;

  const extPresent = new Set<string>();
  for (const k of extFields) {
    if (p[k] !== undefined && p[k] !== null) {
      const base = String(k).replace(/^(mortgage|other|existing|life|state)/, "").toLowerCase();
      extPresent.add(base || String(k));
    }
  }
  const extScore = Math.min(1, extPresent.size / 8) * 0.3;

  return Math.min(1, coreScore + extScore);
}

// ─── Stage Label ──────────────────────────────────────────────────

function stageLabel(p: FinancialProfile): string {
  const age = n(p.currentAge ?? p.age, 35);
  if (age < 30) return "Early Career";
  if (age < 40) return "Building Phase";
  if (age < 50) return "Peak Earning";
  if (age < 60) return "Pre-Retirement";
  if (age < 70) return "Transition";
  return "Distribution";
}

// ─── Master Function ──────────────────────────────────────────────

export function computeHolisticScore(profile: FinancialProfile): HolisticResult {
  const dependents = n(profile.childrenCount ?? profile.dependents);

  const domains: DomainScore[] = [
    scoreCashFlow(profile),
    scoreProtection(profile),
    scoreGrowth(profile),
    scoreRetirement(profile),
    scoreTax(profile),
    scoreEstate(profile),
  ];

  // Only include education if there are dependents
  if (dependents > 0) {
    domains.push(scoreEducation(profile));
  }

  const scoredDomains = domains.filter(d => d.score > 0);
  const compositeRaw = scoredDomains.reduce((sum, d) => sum + d.score, 0);
  const compositeMax = scoredDomains.length * 3;
  const compositeScore = compositeMax > 0 ? Math.round((compositeRaw / compositeMax) * 100) : 0;

  const products = buildProducts(profile, domains);
  const costBenefit = buildCostBenefit(profile, products);
  const actions = buildActions(domains);
  const profileCompleteness = calcCompleteness(profile);

  return {
    domains,
    compositeScore,
    compositeRaw,
    compositeMax,
    stageLabel: stageLabel(profile),
    products,
    costBenefit,
    actions,
    profileCompleteness,
  };
}

// ─── Exports for testing ──────────────────────────────────────────

export { interpRate, estPrem, fmt, pct, scoreLabel, RATES };
export { scoreCashFlow, scoreProtection, scoreGrowth, scoreRetirement, scoreTax, scoreEstate, scoreEducation };
