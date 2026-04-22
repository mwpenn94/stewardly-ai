/**
 * Firm/Strategy Comparison Engine
 *
 * Provides comprehensive total-benefit vs total-cost analysis across
 * firm categories (Wirehouse, RIA, Captive, Community BD, DIY, WealthBridge)
 * and strategy offerings. Mirrors the original HTML comparison structure
 * with holistic cost-benefit analysis, ROI calculations, and positioning.
 *
 * Key features:
 * 1. Firm-to-firm comparison across 7 firm categories
 * 2. Total benefits vs total costs breakdown per firm type
 * 3. Strategy/offering comparison across components
 * 4. WealthBridge positioning vs competitor firms
 * 5. ROI, margin, and LTV calculations per strategy
 * 6. Component-level granular comparison
 */

import { getDb } from "../../db";
import { sql } from "drizzle-orm";

// ─── TYPES ────────────────────────────────────────────────────────

export type FirmCategory =
  | "wirehouse" | "ria" | "captive_mutual" | "community_bd"
  | "diy" | "wealthbridge" | "wealthbridge_premium";

export interface FirmProfile {
  category: FirmCategory;
  label: string;
  description: string;
  color: string;
  // Cost structure
  costs: {
    advisoryFee: number; // % of AUM
    platformFee: number; // % or flat
    tradingCosts: number; // per trade or % of AUM
    insurancePremiums: number; // annual
    taxPrepFee: number; // annual
    estatePlanningFee: number; // one-time
    financialPlanFee: number; // one-time or annual
    complianceCost: number; // annual overhead
    technologyFee: number; // annual
    totalAnnualCost: number; // computed
    totalCostOver10Years: number; // computed
    totalCostOver30Years: number; // computed
  };
  // Benefits structure
  benefits: {
    taxSavings: number; // annual estimated
    insuranceOptimization: number; // annual savings
    investmentAlpha: number; // basis points above benchmark
    estateTaxSavings: number; // one-time
    retirementIncomeLift: number; // annual
    riskReduction: number; // % reduction in downside
    behavioralCoaching: number; // estimated annual value
    holisticPlanningValue: number; // annual
    totalAnnualBenefit: number; // computed
    totalBenefitOver10Years: number; // computed
    totalBenefitOver30Years: number; // computed
  };
  // Capabilities
  capabilities: {
    fiduciary: boolean;
    holisticPlanning: boolean;
    taxOptimization: boolean;
    estatePlanning: boolean;
    insuranceAnalysis: boolean;
    businessPlanning: boolean;
    premiumFinance: boolean;
    behavioralCoaching: boolean;
    technologyPlatform: boolean;
    complianceSupport: boolean;
    teamApproach: boolean;
    clientPortal: boolean;
  };
  // Metrics
  metrics: {
    roi: number; // (benefits - costs) / costs
    netValueAdd: number; // benefits - costs annual
    breakEvenMonths: number;
    clientSatisfaction: number; // 1-10
    retentionRate: number; // %
    avgClientNetWorth: number;
    advisorToClientRatio: number;
  };
}

export interface StrategyComparison {
  strategyName: string;
  description: string;
  firms: Array<{
    firmCategory: FirmCategory;
    available: boolean;
    cost: number;
    benefit: number;
    netValue: number;
    quality: "excellent" | "good" | "adequate" | "limited" | "unavailable";
    notes: string;
  }>;
  bestFirm: FirmCategory;
  worstFirm: FirmCategory;
}

export interface ComponentComparison {
  component: string;
  category: "planning" | "protection" | "growth" | "tax" | "estate" | "technology";
  firms: Record<FirmCategory, {
    available: boolean;
    quality: number; // 1-10
    cost: number;
    included: boolean; // included in base fee or extra
    notes: string;
  }>;
}

export interface FirmComparisonResult {
  clientProfile: {
    aum: number;
    income: number;
    netWorth: number;
    age: number;
    goals: string[];
  };
  firms: FirmProfile[];
  strategyComparisons: StrategyComparison[];
  componentComparisons: ComponentComparison[];
  recommendation: {
    bestOverall: FirmCategory;
    bestValue: FirmCategory;
    bestService: FirmCategory;
    bestForGoals: FirmCategory;
    rationale: string;
  };
  wealthbridgeAdvantage: {
    totalSavingsVsAverage: number;
    totalBenefitVsAverage: number;
    uniqueCapabilities: string[];
    clientTestimonialThemes: string[];
  };
}

// ─── FIRM PROFILES ────────────────────────────────────────────────

function buildFirmProfiles(aum: number, income: number): FirmProfile[] {
  return [
    buildWirehouse(aum, income),
    buildRIA(aum, income),
    buildCaptiveMutual(aum, income),
    buildCommunityBD(aum, income),
    buildDIY(aum, income),
    buildWealthBridge(aum, income),
    buildWealthBridgePremium(aum, income),
  ];
}

function buildWirehouse(aum: number, income: number): FirmProfile {
  const advisoryFee = aum * 0.012; // 1.2% AUM
  const platformFee = 500;
  const tradingCosts = aum * 0.002;
  const insurancePremiums = income * 0.02;
  const taxPrepFee = 1500;
  const estatePlanningFee = 5000;
  const financialPlanFee = 2500;
  const complianceCost = 200;
  const technologyFee = 0;
  const totalAnnualCost = advisoryFee + platformFee + tradingCosts + insurancePremiums + taxPrepFee + complianceCost + technologyFee;

  const taxSavings = income * 0.02;
  const insuranceOptimization = income * 0.005;
  const investmentAlpha = aum * 0.005;
  const estateTaxSavings = aum * 0.01;
  const retirementIncomeLift = income * 0.03;
  const riskReduction = aum * 0.008;
  const behavioralCoaching = aum * 0.015;
  const holisticPlanningValue = income * 0.02;
  const totalAnnualBenefit = taxSavings + insuranceOptimization + investmentAlpha + retirementIncomeLift + riskReduction + behavioralCoaching + holisticPlanningValue;

  return {
    category: "wirehouse",
    label: "Wirehouse (Full Service)",
    description: "Traditional full-service broker-dealer with bundled advisory fees, proprietary products, and institutional research.",
    color: "#2563EB",
    costs: {
      advisoryFee, platformFee, tradingCosts, insurancePremiums, taxPrepFee,
      estatePlanningFee, financialPlanFee, complianceCost, technologyFee,
      totalAnnualCost,
      totalCostOver10Years: Math.round(totalAnnualCost * 10 + estatePlanningFee + financialPlanFee),
      totalCostOver30Years: Math.round(totalAnnualCost * 30 + estatePlanningFee * 3 + financialPlanFee),
    },
    benefits: {
      taxSavings, insuranceOptimization, investmentAlpha, estateTaxSavings,
      retirementIncomeLift, riskReduction, behavioralCoaching, holisticPlanningValue,
      totalAnnualBenefit,
      totalBenefitOver10Years: Math.round(totalAnnualBenefit * 10 + estateTaxSavings),
      totalBenefitOver30Years: Math.round(totalAnnualBenefit * 30 + estateTaxSavings * 3),
    },
    capabilities: {
      fiduciary: false, holisticPlanning: true, taxOptimization: true,
      estatePlanning: true, insuranceAnalysis: true, businessPlanning: false,
      premiumFinance: false, behavioralCoaching: true, technologyPlatform: true,
      complianceSupport: true, teamApproach: true, clientPortal: true,
    },
    metrics: {
      roi: totalAnnualCost > 0 ? Math.round((totalAnnualBenefit - totalAnnualCost) / totalAnnualCost * 100) / 100 : 0,
      netValueAdd: Math.round(totalAnnualBenefit - totalAnnualCost),
      breakEvenMonths: totalAnnualBenefit > 0 ? Math.round((estatePlanningFee + financialPlanFee) / (totalAnnualBenefit / 12)) : 999,
      clientSatisfaction: 7.2,
      retentionRate: 85,
      avgClientNetWorth: 1500000,
      advisorToClientRatio: 150,
    },
  };
}

function buildRIA(aum: number, income: number): FirmProfile {
  const advisoryFee = aum * 0.01;
  const platformFee = 300;
  const tradingCosts = aum * 0.001;
  const insurancePremiums = income * 0.015;
  const taxPrepFee = 0;
  const estatePlanningFee = 3000;
  const financialPlanFee = 2000;
  const complianceCost = 150;
  const technologyFee = 200;
  const totalAnnualCost = advisoryFee + platformFee + tradingCosts + insurancePremiums + complianceCost + technologyFee;

  const taxSavings = income * 0.025;
  const insuranceOptimization = income * 0.008;
  const investmentAlpha = aum * 0.006;
  const estateTaxSavings = aum * 0.012;
  const retirementIncomeLift = income * 0.035;
  const riskReduction = aum * 0.01;
  const behavioralCoaching = aum * 0.018;
  const holisticPlanningValue = income * 0.025;
  const totalAnnualBenefit = taxSavings + insuranceOptimization + investmentAlpha + retirementIncomeLift + riskReduction + behavioralCoaching + holisticPlanningValue;

  return {
    category: "ria",
    label: "Independent RIA",
    description: "Fee-only fiduciary advisor with open architecture, tax-loss harvesting, and independent research.",
    color: "#0891B2",
    costs: {
      advisoryFee, platformFee, tradingCosts, insurancePremiums, taxPrepFee,
      estatePlanningFee, financialPlanFee, complianceCost, technologyFee,
      totalAnnualCost,
      totalCostOver10Years: Math.round(totalAnnualCost * 10 + estatePlanningFee + financialPlanFee),
      totalCostOver30Years: Math.round(totalAnnualCost * 30 + estatePlanningFee * 3 + financialPlanFee),
    },
    benefits: {
      taxSavings, insuranceOptimization, investmentAlpha, estateTaxSavings,
      retirementIncomeLift, riskReduction, behavioralCoaching, holisticPlanningValue,
      totalAnnualBenefit,
      totalBenefitOver10Years: Math.round(totalAnnualBenefit * 10 + estateTaxSavings),
      totalBenefitOver30Years: Math.round(totalAnnualBenefit * 30 + estateTaxSavings * 3),
    },
    capabilities: {
      fiduciary: true, holisticPlanning: true, taxOptimization: true,
      estatePlanning: true, insuranceAnalysis: true, businessPlanning: false,
      premiumFinance: false, behavioralCoaching: true, technologyPlatform: true,
      complianceSupport: false, teamApproach: false, clientPortal: true,
    },
    metrics: {
      roi: totalAnnualCost > 0 ? Math.round((totalAnnualBenefit - totalAnnualCost) / totalAnnualCost * 100) / 100 : 0,
      netValueAdd: Math.round(totalAnnualBenefit - totalAnnualCost),
      breakEvenMonths: totalAnnualBenefit > 0 ? Math.round((estatePlanningFee + financialPlanFee) / (totalAnnualBenefit / 12)) : 999,
      clientSatisfaction: 8.1,
      retentionRate: 90,
      avgClientNetWorth: 2000000,
      advisorToClientRatio: 80,
    },
  };
}

function buildCaptiveMutual(aum: number, income: number): FirmProfile {
  const advisoryFee = aum * 0.008;
  const platformFee = 0;
  const tradingCosts = aum * 0.003;
  const insurancePremiums = income * 0.035;
  const taxPrepFee = 0;
  const estatePlanningFee = 2000;
  const financialPlanFee = 0;
  const complianceCost = 100;
  const technologyFee = 0;
  const totalAnnualCost = advisoryFee + platformFee + tradingCosts + insurancePremiums + complianceCost;

  const taxSavings = income * 0.01;
  const insuranceOptimization = income * 0.003;
  const investmentAlpha = aum * 0.003;
  const estateTaxSavings = aum * 0.005;
  const retirementIncomeLift = income * 0.02;
  const riskReduction = aum * 0.006;
  const behavioralCoaching = aum * 0.008;
  const holisticPlanningValue = income * 0.01;
  const totalAnnualBenefit = taxSavings + insuranceOptimization + investmentAlpha + retirementIncomeLift + riskReduction + behavioralCoaching + holisticPlanningValue;

  return {
    category: "captive_mutual",
    label: "Captive Mutual Carrier",
    description: "Insurance-led captive carrier focused on whole life, annuities, and proprietary products.",
    color: "#1E40AF",
    costs: {
      advisoryFee, platformFee, tradingCosts, insurancePremiums, taxPrepFee,
      estatePlanningFee, financialPlanFee, complianceCost, technologyFee,
      totalAnnualCost,
      totalCostOver10Years: Math.round(totalAnnualCost * 10 + estatePlanningFee),
      totalCostOver30Years: Math.round(totalAnnualCost * 30 + estatePlanningFee * 3),
    },
    benefits: {
      taxSavings, insuranceOptimization, investmentAlpha, estateTaxSavings,
      retirementIncomeLift, riskReduction, behavioralCoaching, holisticPlanningValue,
      totalAnnualBenefit,
      totalBenefitOver10Years: Math.round(totalAnnualBenefit * 10 + estateTaxSavings),
      totalBenefitOver30Years: Math.round(totalAnnualBenefit * 30 + estateTaxSavings * 3),
    },
    capabilities: {
      fiduciary: false, holisticPlanning: false, taxOptimization: false,
      estatePlanning: true, insuranceAnalysis: true, businessPlanning: false,
      premiumFinance: false, behavioralCoaching: true, technologyPlatform: false,
      complianceSupport: true, teamApproach: false, clientPortal: false,
    },
    metrics: {
      roi: totalAnnualCost > 0 ? Math.round((totalAnnualBenefit - totalAnnualCost) / totalAnnualCost * 100) / 100 : 0,
      netValueAdd: Math.round(totalAnnualBenefit - totalAnnualCost),
      breakEvenMonths: totalAnnualBenefit > 0 ? Math.round(estatePlanningFee / (totalAnnualBenefit / 12)) : 999,
      clientSatisfaction: 6.5,
      retentionRate: 78,
      avgClientNetWorth: 500000,
      advisorToClientRatio: 250,
    },
  };
}

function buildCommunityBD(aum: number, income: number): FirmProfile {
  const advisoryFee = aum * 0.009;
  const platformFee = 200;
  const tradingCosts = aum * 0.002;
  const insurancePremiums = income * 0.02;
  const taxPrepFee = 500;
  const estatePlanningFee = 2500;
  const financialPlanFee = 1000;
  const complianceCost = 150;
  const technologyFee = 100;
  const totalAnnualCost = advisoryFee + platformFee + tradingCosts + insurancePremiums + taxPrepFee + complianceCost + technologyFee;

  const taxSavings = income * 0.015;
  const insuranceOptimization = income * 0.005;
  const investmentAlpha = aum * 0.004;
  const estateTaxSavings = aum * 0.008;
  const retirementIncomeLift = income * 0.025;
  const riskReduction = aum * 0.007;
  const behavioralCoaching = aum * 0.01;
  const holisticPlanningValue = income * 0.015;
  const totalAnnualBenefit = taxSavings + insuranceOptimization + investmentAlpha + retirementIncomeLift + riskReduction + behavioralCoaching + holisticPlanningValue;

  return {
    category: "community_bd",
    label: "Community Broker-Dealer",
    description: "Local independent broker-dealer with limited advisory layering and community focus.",
    color: "#7C3AED",
    costs: {
      advisoryFee, platformFee, tradingCosts, insurancePremiums, taxPrepFee,
      estatePlanningFee, financialPlanFee, complianceCost, technologyFee,
      totalAnnualCost,
      totalCostOver10Years: Math.round(totalAnnualCost * 10 + estatePlanningFee + financialPlanFee),
      totalCostOver30Years: Math.round(totalAnnualCost * 30 + estatePlanningFee * 3 + financialPlanFee),
    },
    benefits: {
      taxSavings, insuranceOptimization, investmentAlpha, estateTaxSavings,
      retirementIncomeLift, riskReduction, behavioralCoaching, holisticPlanningValue,
      totalAnnualBenefit,
      totalBenefitOver10Years: Math.round(totalAnnualBenefit * 10 + estateTaxSavings),
      totalBenefitOver30Years: Math.round(totalAnnualBenefit * 30 + estateTaxSavings * 3),
    },
    capabilities: {
      fiduciary: false, holisticPlanning: true, taxOptimization: true,
      estatePlanning: true, insuranceAnalysis: true, businessPlanning: false,
      premiumFinance: false, behavioralCoaching: true, technologyPlatform: false,
      complianceSupport: true, teamApproach: false, clientPortal: false,
    },
    metrics: {
      roi: totalAnnualCost > 0 ? Math.round((totalAnnualBenefit - totalAnnualCost) / totalAnnualCost * 100) / 100 : 0,
      netValueAdd: Math.round(totalAnnualBenefit - totalAnnualCost),
      breakEvenMonths: totalAnnualBenefit > 0 ? Math.round((estatePlanningFee + financialPlanFee) / (totalAnnualBenefit / 12)) : 999,
      clientSatisfaction: 7.5,
      retentionRate: 82,
      avgClientNetWorth: 750000,
      advisorToClientRatio: 120,
    },
  };
}

function buildDIY(aum: number, income: number): FirmProfile {
  const advisoryFee = 0;
  const platformFee = 100;
  const tradingCosts = aum * 0.0005;
  const insurancePremiums = income * 0.015;
  const taxPrepFee = 300;
  const estatePlanningFee = 1500;
  const financialPlanFee = 0;
  const complianceCost = 0;
  const technologyFee = 200;
  const totalAnnualCost = platformFee + tradingCosts + insurancePremiums + taxPrepFee + technologyFee;

  const taxSavings = income * 0.005;
  const insuranceOptimization = 0;
  const investmentAlpha = aum * 0.001;
  const estateTaxSavings = 0;
  const retirementIncomeLift = income * 0.01;
  const riskReduction = aum * 0.002;
  const behavioralCoaching = 0;
  const holisticPlanningValue = 0;
  const totalAnnualBenefit = taxSavings + investmentAlpha + retirementIncomeLift + riskReduction;

  return {
    category: "diy",
    label: "DIY (Self-Directed)",
    description: "Self-directed brokerage or robo-advisor with no advisor fees but no personalized guidance.",
    color: "#94A3B8",
    costs: {
      advisoryFee, platformFee, tradingCosts, insurancePremiums, taxPrepFee,
      estatePlanningFee, financialPlanFee, complianceCost, technologyFee,
      totalAnnualCost,
      totalCostOver10Years: Math.round(totalAnnualCost * 10 + estatePlanningFee),
      totalCostOver30Years: Math.round(totalAnnualCost * 30 + estatePlanningFee * 3),
    },
    benefits: {
      taxSavings, insuranceOptimization, investmentAlpha, estateTaxSavings,
      retirementIncomeLift, riskReduction, behavioralCoaching, holisticPlanningValue,
      totalAnnualBenefit,
      totalBenefitOver10Years: Math.round(totalAnnualBenefit * 10),
      totalBenefitOver30Years: Math.round(totalAnnualBenefit * 30),
    },
    capabilities: {
      fiduciary: false, holisticPlanning: false, taxOptimization: false,
      estatePlanning: false, insuranceAnalysis: false, businessPlanning: false,
      premiumFinance: false, behavioralCoaching: false, technologyPlatform: true,
      complianceSupport: false, teamApproach: false, clientPortal: true,
    },
    metrics: {
      roi: totalAnnualCost > 0 ? Math.round((totalAnnualBenefit - totalAnnualCost) / totalAnnualCost * 100) / 100 : 0,
      netValueAdd: Math.round(totalAnnualBenefit - totalAnnualCost),
      breakEvenMonths: 0,
      clientSatisfaction: 5.5,
      retentionRate: 60,
      avgClientNetWorth: 300000,
      advisorToClientRatio: 0,
    },
  };
}

function buildWealthBridge(aum: number, income: number): FirmProfile {
  const advisoryFee = aum * 0.008;
  const platformFee = 0;
  const tradingCosts = aum * 0.001;
  const insurancePremiums = income * 0.015;
  const taxPrepFee = 0;
  const estatePlanningFee = 0;
  const financialPlanFee = 0;
  const complianceCost = 0;
  const technologyFee = 0;
  const totalAnnualCost = advisoryFee + tradingCosts + insurancePremiums;

  const taxSavings = income * 0.035;
  const insuranceOptimization = income * 0.012;
  const investmentAlpha = aum * 0.008;
  const estateTaxSavings = aum * 0.015;
  const retirementIncomeLift = income * 0.04;
  const riskReduction = aum * 0.012;
  const behavioralCoaching = aum * 0.02;
  const holisticPlanningValue = income * 0.035;
  const totalAnnualBenefit = taxSavings + insuranceOptimization + investmentAlpha + retirementIncomeLift + riskReduction + behavioralCoaching + holisticPlanningValue;

  return {
    category: "wealthbridge",
    label: "WealthBridge Plan",
    description: "Holistic fiduciary planning with integrated tax optimization, estate planning, insurance analysis, and behavioral coaching — all included.",
    color: "#16A34A",
    costs: {
      advisoryFee, platformFee, tradingCosts, insurancePremiums, taxPrepFee,
      estatePlanningFee, financialPlanFee, complianceCost, technologyFee,
      totalAnnualCost,
      totalCostOver10Years: Math.round(totalAnnualCost * 10),
      totalCostOver30Years: Math.round(totalAnnualCost * 30),
    },
    benefits: {
      taxSavings, insuranceOptimization, investmentAlpha, estateTaxSavings,
      retirementIncomeLift, riskReduction, behavioralCoaching, holisticPlanningValue,
      totalAnnualBenefit,
      totalBenefitOver10Years: Math.round(totalAnnualBenefit * 10 + estateTaxSavings),
      totalBenefitOver30Years: Math.round(totalAnnualBenefit * 30 + estateTaxSavings * 3),
    },
    capabilities: {
      fiduciary: true, holisticPlanning: true, taxOptimization: true,
      estatePlanning: true, insuranceAnalysis: true, businessPlanning: true,
      premiumFinance: false, behavioralCoaching: true, technologyPlatform: true,
      complianceSupport: true, teamApproach: true, clientPortal: true,
    },
    metrics: {
      roi: totalAnnualCost > 0 ? Math.round((totalAnnualBenefit - totalAnnualCost) / totalAnnualCost * 100) / 100 : 0,
      netValueAdd: Math.round(totalAnnualBenefit - totalAnnualCost),
      breakEvenMonths: 0,
      clientSatisfaction: 9.2,
      retentionRate: 95,
      avgClientNetWorth: 1000000,
      advisorToClientRatio: 50,
    },
  };
}

function buildWealthBridgePremium(aum: number, income: number): FirmProfile {
  const base = buildWealthBridge(aum, income);
  const premFinBenefit = aum * 0.005;

  return {
    ...base,
    category: "wealthbridge_premium",
    label: "WealthBridge + Premium Finance",
    description: "WealthBridge holistic plan layered with premium financing for HNW clients — maximum wealth acceleration.",
    color: "#059669",
    benefits: {
      ...base.benefits,
      totalAnnualBenefit: base.benefits.totalAnnualBenefit + premFinBenefit,
      totalBenefitOver10Years: base.benefits.totalBenefitOver10Years + Math.round(premFinBenefit * 10),
      totalBenefitOver30Years: base.benefits.totalBenefitOver30Years + Math.round(premFinBenefit * 30),
    },
    capabilities: {
      ...base.capabilities,
      premiumFinance: true,
    },
    metrics: {
      ...base.metrics,
      roi: base.costs.totalAnnualCost > 0
        ? Math.round((base.benefits.totalAnnualBenefit + premFinBenefit - base.costs.totalAnnualCost) / base.costs.totalAnnualCost * 100) / 100
        : 0,
      netValueAdd: Math.round(base.benefits.totalAnnualBenefit + premFinBenefit - base.costs.totalAnnualCost),
      clientSatisfaction: 9.5,
      avgClientNetWorth: 3000000,
    },
  };
}

// ─── STRATEGY COMPARISONS ─────────────────────────────────────────

function buildStrategyComparisons(firms: FirmProfile[]): StrategyComparison[] {
  const strategies = [
    {
      name: "Retirement Income Planning",
      description: "Comprehensive retirement income strategy with Social Security optimization, pension analysis, and withdrawal sequencing.",
      costKey: "advisoryFee" as const,
      benefitKey: "retirementIncomeLift" as const,
      capabilityKey: "holisticPlanning" as const,
    },
    {
      name: "Tax Optimization",
      description: "Multi-year tax planning including loss harvesting, Roth conversions, charitable giving strategies, and business entity optimization.",
      costKey: "taxPrepFee" as const,
      benefitKey: "taxSavings" as const,
      capabilityKey: "taxOptimization" as const,
    },
    {
      name: "Estate Planning",
      description: "Comprehensive estate plan including trusts, beneficiary optimization, estate tax minimization, and legacy planning.",
      costKey: "estatePlanningFee" as const,
      benefitKey: "estateTaxSavings" as const,
      capabilityKey: "estatePlanning" as const,
    },
    {
      name: "Insurance & Protection",
      description: "Life, disability, long-term care, and umbrella insurance analysis with carrier comparison and policy optimization.",
      costKey: "insurancePremiums" as const,
      benefitKey: "insuranceOptimization" as const,
      capabilityKey: "insuranceAnalysis" as const,
    },
    {
      name: "Investment Management",
      description: "Portfolio construction, rebalancing, risk management, and performance monitoring with behavioral coaching.",
      costKey: "advisoryFee" as const,
      benefitKey: "investmentAlpha" as const,
      capabilityKey: "holisticPlanning" as const,
    },
    {
      name: "Business Planning",
      description: "Business valuation, succession planning, buy-sell agreements, and key person insurance.",
      costKey: "financialPlanFee" as const,
      benefitKey: "holisticPlanningValue" as const,
      capabilityKey: "businessPlanning" as const,
    },
    {
      name: "Behavioral Coaching",
      description: "Ongoing behavioral coaching to prevent emotional investing, maintain discipline, and optimize decision-making.",
      costKey: "advisoryFee" as const,
      benefitKey: "behavioralCoaching" as const,
      capabilityKey: "behavioralCoaching" as const,
    },
  ];

  return strategies.map(s => {
    const firmResults = firms.map(f => {
      const cost = f.costs[s.costKey] ?? 0;
      const benefit = f.benefits[s.benefitKey] ?? 0;
      const available = f.capabilities[s.capabilityKey] ?? false;
      const quality = !available ? "unavailable" as const
        : benefit > cost * 3 ? "excellent" as const
        : benefit > cost * 2 ? "good" as const
        : benefit > cost ? "adequate" as const
        : "limited" as const;

      return {
        firmCategory: f.category,
        available,
        cost: Math.round(cost),
        benefit: Math.round(benefit),
        netValue: Math.round(benefit - cost),
        quality,
        notes: available ? `${quality} value — ${Math.round(benefit / Math.max(cost, 1) * 100)}% ROI` : "Not available",
      };
    });

    const availableFirms = firmResults.filter(f => f.available);
    const bestFirm = availableFirms.sort((a, b) => b.netValue - a.netValue)[0]?.firmCategory ?? "wealthbridge";
    const worstFirm = availableFirms.sort((a, b) => a.netValue - b.netValue)[0]?.firmCategory ?? "diy";

    return {
      strategyName: s.name,
      description: s.description,
      firms: firmResults,
      bestFirm,
      worstFirm,
    };
  });
}

// ─── COMPONENT COMPARISONS ────────────────────────────────────────

function buildComponentComparisons(firms: FirmProfile[]): ComponentComparison[] {
  const components: Array<{
    component: string;
    category: ComponentComparison["category"];
    ratings: Record<FirmCategory, { quality: number; cost: number; included: boolean; notes: string }>;
  }> = [
    {
      component: "Financial Plan Creation",
      category: "planning",
      ratings: {
        wirehouse: { quality: 7, cost: 2500, included: false, notes: "Comprehensive but template-driven" },
        ria: { quality: 8, cost: 2000, included: false, notes: "Customized, fiduciary-aligned" },
        captive_mutual: { quality: 4, cost: 0, included: true, notes: "Insurance-focused, limited scope" },
        community_bd: { quality: 6, cost: 1000, included: false, notes: "Basic planning with local expertise" },
        diy: { quality: 2, cost: 0, included: false, notes: "Self-guided tools only" },
        wealthbridge: { quality: 9, cost: 0, included: true, notes: "AI-powered holistic plan included" },
        wealthbridge_premium: { quality: 10, cost: 0, included: true, notes: "Premium holistic plan with premium finance" },
      },
    },
    {
      component: "Tax-Loss Harvesting",
      category: "tax",
      ratings: {
        wirehouse: { quality: 6, cost: 0, included: true, notes: "Automated, limited customization" },
        ria: { quality: 8, cost: 0, included: true, notes: "Direct indexing available" },
        captive_mutual: { quality: 2, cost: 0, included: false, notes: "Not typically offered" },
        community_bd: { quality: 5, cost: 0, included: true, notes: "Basic implementation" },
        diy: { quality: 3, cost: 0, included: false, notes: "Manual only" },
        wealthbridge: { quality: 9, cost: 0, included: true, notes: "AI-optimized with multi-year planning" },
        wealthbridge_premium: { quality: 9, cost: 0, included: true, notes: "AI-optimized with multi-year planning" },
      },
    },
    {
      component: "Estate Document Review",
      category: "estate",
      ratings: {
        wirehouse: { quality: 7, cost: 5000, included: false, notes: "Referral to partner attorneys" },
        ria: { quality: 7, cost: 3000, included: false, notes: "Coordinated with tax planning" },
        captive_mutual: { quality: 5, cost: 2000, included: false, notes: "Basic trust review" },
        community_bd: { quality: 6, cost: 2500, included: false, notes: "Local attorney network" },
        diy: { quality: 1, cost: 1500, included: false, notes: "No guidance, self-directed" },
        wealthbridge: { quality: 9, cost: 0, included: true, notes: "Integrated estate analysis included" },
        wealthbridge_premium: { quality: 10, cost: 0, included: true, notes: "Full estate optimization included" },
      },
    },
    {
      component: "Insurance Policy Audit",
      category: "protection",
      ratings: {
        wirehouse: { quality: 6, cost: 0, included: true, notes: "Limited to in-house products" },
        ria: { quality: 7, cost: 500, included: false, notes: "Independent analysis" },
        captive_mutual: { quality: 3, cost: 0, included: true, notes: "Biased toward own products" },
        community_bd: { quality: 6, cost: 0, included: true, notes: "Multi-carrier access" },
        diy: { quality: 1, cost: 0, included: false, notes: "No audit capability" },
        wealthbridge: { quality: 9, cost: 0, included: true, notes: "AI-powered multi-carrier comparison" },
        wealthbridge_premium: { quality: 10, cost: 0, included: true, notes: "Full audit with premium finance options" },
      },
    },
    {
      component: "Behavioral Coaching",
      category: "growth",
      ratings: {
        wirehouse: { quality: 7, cost: 0, included: true, notes: "Advisor-led, scheduled reviews" },
        ria: { quality: 8, cost: 0, included: true, notes: "Proactive, relationship-driven" },
        captive_mutual: { quality: 5, cost: 0, included: true, notes: "Product-focused guidance" },
        community_bd: { quality: 6, cost: 0, included: true, notes: "Local relationship" },
        diy: { quality: 0, cost: 0, included: false, notes: "No coaching available" },
        wealthbridge: { quality: 9, cost: 0, included: true, notes: "AI + human coaching hybrid" },
        wealthbridge_premium: { quality: 10, cost: 0, included: true, notes: "Premium coaching with dedicated team" },
      },
    },
    {
      component: "Technology Platform",
      category: "technology",
      ratings: {
        wirehouse: { quality: 7, cost: 500, included: false, notes: "Proprietary platform" },
        ria: { quality: 7, cost: 200, included: false, notes: "Third-party integrations" },
        captive_mutual: { quality: 4, cost: 0, included: true, notes: "Basic online access" },
        community_bd: { quality: 5, cost: 100, included: false, notes: "Limited digital tools" },
        diy: { quality: 8, cost: 200, included: false, notes: "Best-in-class self-service" },
        wealthbridge: { quality: 10, cost: 0, included: true, notes: "AI-powered wealth engine included" },
        wealthbridge_premium: { quality: 10, cost: 0, included: true, notes: "Full platform with premium features" },
      },
    },
  ];

  return components.map(c => ({
    component: c.component,
    category: c.category,
    firms: Object.fromEntries(
      Object.entries(c.ratings).map(([cat, r]) => [
        cat,
        { available: r.quality > 0, quality: r.quality, cost: r.cost, included: r.included, notes: r.notes },
      ])
    ) as ComponentComparison["firms"],
  }));
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────

/**
 * Generate a comprehensive firm comparison for a client.
 */
export async function generateFirmComparison(
  clientId: number,
  overrides?: { aum?: number; income?: number; netWorth?: number; age?: number }
): Promise<FirmComparisonResult> {
  const db = (await getDb())!;

  // Get client financial profile
  let aum = overrides?.aum ?? 500000;
  let income = overrides?.income ?? 150000;
  let netWorth = overrides?.netWorth ?? 750000;
  let age = overrides?.age ?? 45;
  const goals: string[] = [];

  try {
    const [rows] = await db.execute(sql`SELECT profile_json FROM financial_profiles WHERE user_id = ${clientId} ORDER BY updated_at DESC LIMIT 1`) as any;
    if (rows?.[0]?.profile_json) {
      const profile = typeof rows[0].profile_json === "string" ? JSON.parse(rows[0].profile_json) : rows[0].profile_json;
      aum = overrides?.aum ?? profile.netWorth ?? profile.savings ?? aum;
      income = overrides?.income ?? profile.income ?? income;
      netWorth = overrides?.netWorth ?? profile.netWorth ?? netWorth;
      age = overrides?.age ?? profile.age ?? age;
    }
  } catch { /* use defaults */ }

  // Get client goals
  try {
    const [goalRows] = await db.execute(sql`SELECT title FROM client_goals WHERE client_id = ${clientId} LIMIT 5`) as any;
    for (const g of (goalRows ?? [])) {
      if (g.title) goals.push(g.title);
    }
  } catch { /* no goals */ }

  const firms = buildFirmProfiles(aum, income);
  const strategyComparisons = buildStrategyComparisons(firms);
  const componentComparisons = buildComponentComparisons(firms);

  // Determine recommendations
  const sortedByROI = [...firms].sort((a, b) => b.metrics.roi - a.metrics.roi);
  const sortedByNetValue = [...firms].sort((a, b) => b.metrics.netValueAdd - a.metrics.netValueAdd);
  const sortedBySatisfaction = [...firms].sort((a, b) => b.metrics.clientSatisfaction - a.metrics.clientSatisfaction);

  // WealthBridge advantage calculation
  const avgCost = firms.reduce((s, f) => s + f.costs.totalAnnualCost, 0) / firms.length;
  const avgBenefit = firms.reduce((s, f) => s + f.benefits.totalAnnualBenefit, 0) / firms.length;
  const wb = firms.find(f => f.category === "wealthbridge")!;

  return {
    clientProfile: { aum, income, netWorth, age, goals },
    firms,
    strategyComparisons,
    componentComparisons,
    recommendation: {
      bestOverall: sortedByROI[0].category,
      bestValue: sortedByNetValue[0].category,
      bestService: sortedBySatisfaction[0].category,
      bestForGoals: "wealthbridge", // WealthBridge covers all goal types
      rationale: `Based on your profile ($${Math.round(aum / 1000)}K AUM, $${Math.round(income / 1000)}K income), ${sortedByROI[0].label} provides the best overall ROI at ${Math.round(sortedByROI[0].metrics.roi * 100)}%. ${sortedByNetValue[0].label} delivers the highest net annual value of $${sortedByNetValue[0].metrics.netValueAdd.toLocaleString()}.`,
    },
    wealthbridgeAdvantage: {
      totalSavingsVsAverage: Math.round(avgCost - wb.costs.totalAnnualCost),
      totalBenefitVsAverage: Math.round(wb.benefits.totalAnnualBenefit - avgBenefit),
      uniqueCapabilities: [
        "AI-powered holistic wealth engine",
        "Integrated tax, estate, and insurance planning at no extra cost",
        "Real-time cascade alignment across all planning domains",
        "Behavioral coaching with AI + human hybrid approach",
        "Business planning and valuation included",
        "Premium finance options for HNW clients",
      ],
      clientTestimonialThemes: [
        "Comprehensive planning I couldn't get elsewhere",
        "Saved significantly on taxes in the first year",
        "Finally understand my complete financial picture",
        "Technology makes it easy to stay on track",
      ],
    },
  };
}

/**
 * Quick comparison for a specific strategy across all firm types.
 */
export async function compareStrategyAcrossFirms(
  clientId: number,
  strategyName: string
): Promise<StrategyComparison | null> {
  const result = await generateFirmComparison(clientId);
  return result.strategyComparisons.find(s =>
    s.strategyName.toLowerCase().includes(strategyName.toLowerCase())
  ) ?? null;
}

/**
 * Get the WealthBridge advantage summary for a client.
 */
export async function getWealthBridgeAdvantage(clientId: number): Promise<FirmComparisonResult["wealthbridgeAdvantage"] & {
  totalCostSavings10Year: number;
  totalBenefitGain10Year: number;
  netAdvantage10Year: number;
}> {
  const result = await generateFirmComparison(clientId);
  const wb = result.firms.find(f => f.category === "wealthbridge")!;
  const avgCost10 = result.firms.reduce((s, f) => s + f.costs.totalCostOver10Years, 0) / result.firms.length;
  const avgBenefit10 = result.firms.reduce((s, f) => s + f.benefits.totalBenefitOver10Years, 0) / result.firms.length;

  return {
    ...result.wealthbridgeAdvantage,
    totalCostSavings10Year: Math.round(avgCost10 - wb.costs.totalCostOver10Years),
    totalBenefitGain10Year: Math.round(wb.benefits.totalBenefitOver10Years - avgBenefit10),
    netAdvantage10Year: Math.round(
      (wb.benefits.totalBenefitOver10Years - wb.costs.totalCostOver10Years) -
      (avgBenefit10 - avgCost10)
    ),
  };
}
