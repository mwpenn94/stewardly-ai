import { getDb } from "./db";
import { businessExitPlans } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";

// ─── Types ─────────────────────────────────────────────────────
export interface ExitPlanInput {
  userId: number;
  businessName: string;
  businessType: string;
  annualRevenue: number;
  annualProfit: number;
  employeeCount: number;
  ownerHoursPerWeek: number;
  yearsInBusiness: number;
  keyEmployeeDependence: number; // 0-100 (how dependent on owner)
  customerConcentration: number; // 0-100 (top 3 customers as % of revenue)
  recurringRevenuePercent: number; // 0-100
  preferredTimeline: number; // years until exit
  preferredPath?: "sale" | "merger" | "esop" | "family" | "ipo" | "liquidation";
}

export interface ExitPlanResult {
  valuation: ValuationEstimate;
  readinessScore: number; // 0-100
  readinessFactors: ReadinessFactor[];
  exitPaths: ExitPath[];
  timeline: TimelinePhase[];
  recommendations: string[];
}

export interface ValuationEstimate {
  lowMultiple: number;
  midMultiple: number;
  highMultiple: number;
  lowValue: number;
  midValue: number;
  highValue: number;
  method: string;
  adjustments: string[];
}

export interface ReadinessFactor {
  factor: string;
  score: number; // 0-100
  weight: number;
  notes: string;
}

export interface ExitPath {
  type: "sale" | "merger" | "esop" | "family" | "ipo" | "liquidation";
  name: string;
  suitabilityScore: number;
  estimatedTimeline: string;
  taxImplications: string;
  pros: string[];
  cons: string[];
}

export interface TimelinePhase {
  phase: string;
  duration: string;
  tasks: string[];
}

// ─── Valuation ─────────────────────────────────────────────────
function getIndustryMultiples(type: string): { low: number; mid: number; high: number } {
  const multiples: Record<string, { low: number; mid: number; high: number }> = {
    "professional_services": { low: 2.5, mid: 4.0, high: 6.0 },
    "technology": { low: 4.0, mid: 8.0, high: 15.0 },
    "healthcare": { low: 3.0, mid: 5.0, high: 8.0 },
    "retail": { low: 1.5, mid: 3.0, high: 5.0 },
    "manufacturing": { low: 3.0, mid: 5.0, high: 7.0 },
    "financial_services": { low: 3.0, mid: 5.5, high: 9.0 },
    "real_estate": { low: 2.0, mid: 4.0, high: 7.0 },
    "default": { low: 2.0, mid: 4.0, high: 6.0 },
  };
  return multiples[type] || multiples.default;
}

export function estimateValuation(input: ExitPlanInput): ValuationEstimate {
  const multiples = getIndustryMultiples(input.businessType);
  const sde = input.annualProfit + (input.ownerHoursPerWeek > 30 ? input.annualRevenue * 0.1 : 0); // Seller's Discretionary Earnings
  
  const adjustments: string[] = [];
  let multiplierAdj = 0;

  // Recurring revenue premium
  if (input.recurringRevenuePercent > 70) { multiplierAdj += 0.5; adjustments.push("+0.5x for strong recurring revenue"); }
  else if (input.recurringRevenuePercent > 40) { multiplierAdj += 0.2; adjustments.push("+0.2x for moderate recurring revenue"); }

  // Customer concentration discount
  if (input.customerConcentration > 50) { multiplierAdj -= 0.5; adjustments.push("-0.5x for high customer concentration"); }
  else if (input.customerConcentration > 30) { multiplierAdj -= 0.2; adjustments.push("-0.2x for moderate customer concentration"); }

  // Owner dependence discount
  if (input.keyEmployeeDependence > 70) { multiplierAdj -= 0.5; adjustments.push("-0.5x for high owner dependence"); }
  else if (input.keyEmployeeDependence > 40) { multiplierAdj -= 0.2; adjustments.push("-0.2x for moderate owner dependence"); }

  // Growth premium
  if (input.yearsInBusiness > 10 && input.annualProfit > 0) { multiplierAdj += 0.3; adjustments.push("+0.3x for established track record"); }

  return {
    lowMultiple: Math.max(1, multiples.low + multiplierAdj),
    midMultiple: Math.max(1.5, multiples.mid + multiplierAdj),
    highMultiple: Math.max(2, multiples.high + multiplierAdj),
    lowValue: Math.round(sde * Math.max(1, multiples.low + multiplierAdj)),
    midValue: Math.round(sde * Math.max(1.5, multiples.mid + multiplierAdj)),
    highValue: Math.round(sde * Math.max(2, multiples.high + multiplierAdj)),
    method: "SDE Multiple (Seller's Discretionary Earnings)",
    adjustments,
  };
}

// ─── Readiness Assessment ──────────────────────────────────────
export function assessReadiness(input: ExitPlanInput): { score: number; factors: ReadinessFactor[] } {
  const factors: ReadinessFactor[] = [
    {
      factor: "Owner Independence",
      score: 100 - input.keyEmployeeDependence,
      weight: 0.25,
      notes: input.keyEmployeeDependence > 60 ? "Business is heavily dependent on owner — needs management team" : "Good management structure in place",
    },
    {
      factor: "Customer Diversification",
      score: 100 - input.customerConcentration,
      weight: 0.15,
      notes: input.customerConcentration > 40 ? "Revenue concentrated in few customers — diversify" : "Healthy customer diversification",
    },
    {
      factor: "Revenue Quality",
      score: Math.min(100, input.recurringRevenuePercent + 20),
      weight: 0.20,
      notes: input.recurringRevenuePercent > 50 ? "Strong recurring revenue base" : "Build more predictable revenue streams",
    },
    {
      factor: "Profitability",
      score: input.annualRevenue > 0 ? Math.min(100, (input.annualProfit / input.annualRevenue) * 300) : 0,
      weight: 0.20,
      notes: input.annualProfit / Math.max(1, input.annualRevenue) > 0.2 ? "Healthy margins" : "Improve profitability before exit",
    },
    {
      factor: "Scale & Track Record",
      score: Math.min(100, input.yearsInBusiness * 8 + input.employeeCount * 3),
      weight: 0.10,
      notes: input.yearsInBusiness > 5 ? "Established business with track record" : "Build more operating history",
    },
    {
      factor: "Documentation & Systems",
      score: input.employeeCount > 5 ? 60 : 40, // Proxy — larger teams tend to have better systems
      weight: 0.10,
      notes: "Ensure SOPs, financial records, and contracts are well-documented",
    },
  ];

  const score = Math.round(factors.reduce((sum, f) => sum + f.score * f.weight, 0));
  return { score, factors };
}

// ─── Exit Paths ────────────────────────────────────────────────
export function evaluateExitPaths(input: ExitPlanInput, valuation: ValuationEstimate): ExitPath[] {
  const paths: ExitPath[] = [
    {
      type: "sale",
      name: "Third-Party Sale",
      suitabilityScore: input.keyEmployeeDependence < 50 ? 85 : 55,
      estimatedTimeline: "6-18 months",
      taxImplications: "Capital gains on sale proceeds. Asset vs stock sale structure affects tax treatment significantly.",
      pros: ["Highest potential value", "Clean break", "Market-tested price"],
      cons: ["Lengthy process", "Due diligence burden", "Confidentiality risk"],
    },
    {
      type: "merger",
      name: "Strategic Merger",
      suitabilityScore: input.annualRevenue > 1_000_000 ? 75 : 45,
      estimatedTimeline: "6-12 months",
      taxImplications: "Tax-free reorganization possible if structured as stock-for-stock exchange.",
      pros: ["Synergy premium", "Continued involvement option", "Shared risk"],
      cons: ["Culture integration risk", "Loss of control", "Complex negotiation"],
    },
    {
      type: "esop",
      name: "Employee Stock Ownership Plan (ESOP)",
      suitabilityScore: input.employeeCount >= 10 ? 70 : 30,
      estimatedTimeline: "6-12 months to establish",
      taxImplications: "Tax-deferred rollover possible (Section 1042). Company gets tax deduction for contributions.",
      pros: ["Tax advantages", "Employee retention", "Legacy preservation"],
      cons: ["Complex setup", "Ongoing administration", "Requires sufficient cash flow"],
    },
    {
      type: "family",
      name: "Family Succession",
      suitabilityScore: 50, // Can't assess without family info
      estimatedTimeline: "2-5 years (gradual transition)",
      taxImplications: "Gift/estate tax implications. Installment sales and GRATs can minimize tax burden.",
      pros: ["Legacy preservation", "Gradual transition", "Trusted successor"],
      cons: ["Family dynamics", "May undervalue business", "Successor readiness"],
    },
    {
      type: "liquidation",
      name: "Orderly Liquidation",
      suitabilityScore: input.annualProfit < 0 ? 60 : 20,
      estimatedTimeline: "3-12 months",
      taxImplications: "Ordinary income on inventory/receivables. Capital gains on equipment/real estate.",
      pros: ["Simplest process", "Quick resolution", "No successor needed"],
      cons: ["Lowest value recovery", "Employee displacement", "Customer disruption"],
    },
  ];

  return paths.sort((a, b) => b.suitabilityScore - a.suitabilityScore);
}

// ─── Timeline ──────────────────────────────────────────────────
export function buildTimeline(input: ExitPlanInput): TimelinePhase[] {
  const years = input.preferredTimeline || 3;
  if (years <= 1) {
    return [
      { phase: "Immediate Preparation", duration: "Months 1-3", tasks: ["Financial audit", "Legal review", "Valuation assessment", "Broker/advisor selection"] },
      { phase: "Market & Negotiate", duration: "Months 4-9", tasks: ["Confidential marketing", "Buyer screening", "Due diligence", "Negotiate terms"] },
      { phase: "Close & Transition", duration: "Months 10-12", tasks: ["Finalize agreements", "Regulatory approvals", "Knowledge transfer", "Close transaction"] },
    ];
  }
  return [
    { phase: "Foundation (Year 1)", duration: "Months 1-12", tasks: ["Reduce owner dependence", "Document all processes", "Clean up financials", "Build management team"] },
    { phase: "Value Enhancement (Year 2)", duration: "Months 13-24", tasks: ["Grow recurring revenue", "Diversify customer base", "Optimize profitability", "Strengthen contracts"] },
    { phase: "Pre-Market (6 months before)", duration: `Month ${(years - 1) * 12 + 1}-${(years - 1) * 12 + 6}`, tasks: ["Final valuation", "Select advisors", "Prepare data room", "Identify potential buyers"] },
    { phase: "Transaction", duration: `Month ${(years - 1) * 12 + 7}-${years * 12}`, tasks: ["Market business", "Negotiate offers", "Due diligence", "Close and transition"] },
  ];
}

// ─── Full Analysis ─────────────────────────────────────────────
export function analyzeBusinessExit(input: ExitPlanInput): ExitPlanResult {
  const valuation = estimateValuation(input);
  const { score: readinessScore, factors } = assessReadiness(input);
  const exitPaths = evaluateExitPaths(input, valuation);
  const timeline = buildTimeline(input);

  const recommendations: string[] = [];
  if (readinessScore < 60) recommendations.push("Focus on improving exit readiness before pursuing a transaction");
  if (input.keyEmployeeDependence > 60) recommendations.push("Hire or develop a management team to reduce owner dependence");
  if (input.customerConcentration > 40) recommendations.push("Diversify revenue across more customers");
  if (input.recurringRevenuePercent < 30) recommendations.push("Build recurring revenue streams (subscriptions, retainers, contracts)");
  if (recommendations.length === 0) recommendations.push("Business is well-positioned for exit. Begin advisor selection.");

  return { valuation, readinessScore, readinessFactors: factors, exitPaths, timeline, recommendations };
}

// ─── DB Helpers ────────────────────────────────────────────────
export async function saveExitPlan(input: ExitPlanInput, result: ExitPlanResult) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(businessExitPlans).values({
    userId: input.userId,
    businessName: input.businessName,
    businessType: input.businessType,
    annualRevenue: input.annualRevenue,
    annualProfit: input.annualProfit,
    employeeCount: input.employeeCount,
    ownerDependenceScore: input.keyEmployeeDependence,
    readinessScore: result.readinessScore,
    preferredExitPath: input.preferredPath || result.exitPaths[0]?.type || "sale",
    analysisJson: JSON.stringify(result),
  });
}

export async function getUserExitPlans(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(businessExitPlans)
    .where(eq(businessExitPlans.userId, userId))
    .orderBy(desc(businessExitPlans.createdAt));
}
