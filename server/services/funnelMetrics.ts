/**
 * Funnel-by-Funnel Metrics Service — v10 Spec Alignment
 * ======================================================
 * Calculates CAC, ROI (with revenue, COGS, margin), and LTV per funnel:
 *   - Recruit funnel (new associates, experienced professionals)
 *   - HNW prospect funnel (high-net-worth individuals)
 *   - COI funnel (centers of influence / strategic partners)
 *   - B2B prospect funnel (WTA/PCMP businesses)
 *   - Dormant re-engagement funnel
 *   - Affiliate funnel (Stewardly affiliates)
 *
 * Also provides roll-up values for planning and prioritization.
 */

// ─── Types ───────────────────────────────────────────────────────────────

export interface FunnelCostMetrics {
  totalSpend: number;          // Total marketing/outreach spend for this funnel
  touchesSent: number;         // Total touches sent
  costPerTouch: number;        // totalSpend / touchesSent
  leadsGenerated: number;      // Total leads entered
  leadsQualified: number;      // Leads that passed qualification
  leadsConverted: number;      // Leads that converted to clients/hires/partners
  cac: number;                 // Customer Acquisition Cost = totalSpend / leadsConverted
  cacQualified: number;        // Cost per qualified lead = totalSpend / leadsQualified
}

export interface FunnelRevenueMetrics {
  totalRevenue: number;        // Revenue attributed to this funnel
  cogs: number;                // Cost of Goods Sold (platform fees, compliance costs, etc.)
  grossMarginDollar: number;   // totalRevenue - cogs
  grossMarginPct: number;      // grossMarginDollar / totalRevenue
  netMarginDollar: number;     // grossMarginDollar - totalSpend
  netMarginPct: number;        // netMarginDollar / totalRevenue
  roi: number;                 // (totalRevenue - totalSpend) / totalSpend
  roiPct: number;              // roi * 100
}

export interface FunnelLtvMetrics {
  avgClientLtv: number;        // Average lifetime value per converted lead
  avgClientRetentionMonths: number;
  avgMonthlyRevenue: number;   // avgClientLtv / avgClientRetentionMonths
  ltvToCacRatio: number;       // avgClientLtv / cac
  paybackMonths: number;       // cac / avgMonthlyRevenue
}

export interface ExtendedNetworkMetrics {
  referralsGenerated: number;
  referralConversionRate: number;
  extendedNetworkCac: number;  // CAC for referral-sourced leads
  extendedNetworkRoi: number;
  extendedNetworkLtv: number;
  networkMultiplier: number;   // Total value including referrals / direct value
}

export interface FunnelMetricsResult {
  funnelName: string;
  funnelId: string;
  period: { startDate: string; endDate: string };
  costs: FunnelCostMetrics;
  revenue: FunnelRevenueMetrics;
  ltv: FunnelLtvMetrics;
  extendedNetwork: ExtendedNetworkMetrics;
  conversionFunnel: {
    entered: number;
    qualified: number;
    solutionDesign: number;
    validation: number;
    commit: number;
    converted: number;
    conversionRate: number;
    avgDaysToConvert: number;
  };
  benchmarks: {
    industryCac: number;
    industryRoi: number;
    industryLtv: number;
    performanceVsBenchmark: "above" | "at" | "below";
  };
}

export interface FunnelRollup {
  totalFunnels: number;
  totalSpend: number;
  totalRevenue: number;
  totalCogs: number;
  blendedCac: number;
  blendedRoi: number;
  blendedLtv: number;
  blendedLtvToCac: number;
  totalLeadsGenerated: number;
  totalLeadsConverted: number;
  overallConversionRate: number;
  bestPerformingFunnel: string;
  worstPerformingFunnel: string;
  funnels: FunnelMetricsResult[];
}

// ─── Industry Benchmarks ─────────────────────────────────────────────────

const INDUSTRY_BENCHMARKS: Record<string, { cac: number; roi: number; ltv: number }> = {
  recruit: { cac: 15000, roi: 3.5, ltv: 250000 },
  hnw: { cac: 8000, roi: 5.0, ltv: 500000 },
  coi: { cac: 3000, roi: 8.0, ltv: 150000 },
  b2b: { cac: 12000, roi: 4.0, ltv: 300000 },
  dormant: { cac: 1500, roi: 12.0, ltv: 200000 },
  affiliate: { cac: 5000, roi: 6.0, ltv: 180000 },
};

// ─── Core Calculation ────────────────────────────────────────────────────

export interface FunnelInput {
  funnelId: string;
  funnelName: string;
  period: { startDate: string; endDate: string };
  spend: number;
  touchesSent: number;
  leadsEntered: number;
  leadsQualified: number;
  leadsSolutionDesign: number;
  leadsValidation: number;
  leadsCommit: number;
  leadsConverted: number;
  avgDaysToConvert: number;
  revenue: number;
  cogs: number;
  avgClientRetentionMonths: number;
  referralsGenerated: number;
  referralConversions: number;
  referralRevenue: number;
  referralSpend: number;
}

export function calculateFunnelMetrics(input: FunnelInput): FunnelMetricsResult {
  const safeDiv = (a: number, b: number) => b === 0 ? 0 : a / b;

  // Cost metrics
  const costs: FunnelCostMetrics = {
    totalSpend: input.spend,
    touchesSent: input.touchesSent,
    costPerTouch: safeDiv(input.spend, input.touchesSent),
    leadsGenerated: input.leadsEntered,
    leadsQualified: input.leadsQualified,
    leadsConverted: input.leadsConverted,
    cac: safeDiv(input.spend, input.leadsConverted),
    cacQualified: safeDiv(input.spend, input.leadsQualified),
  };

  // Revenue metrics
  const grossMarginDollar = input.revenue - input.cogs;
  const netMarginDollar = grossMarginDollar - input.spend;
  const revenue: FunnelRevenueMetrics = {
    totalRevenue: input.revenue,
    cogs: input.cogs,
    grossMarginDollar,
    grossMarginPct: safeDiv(grossMarginDollar, input.revenue),
    netMarginDollar,
    netMarginPct: safeDiv(netMarginDollar, input.revenue),
    roi: safeDiv(input.revenue - input.spend, input.spend),
    roiPct: safeDiv(input.revenue - input.spend, input.spend) * 100,
  };

  // LTV metrics
  const avgClientLtv = input.leadsConverted > 0
    ? safeDiv(input.revenue, input.leadsConverted) * safeDiv(input.avgClientRetentionMonths, 12)
    : 0;
  const avgMonthlyRevenue = safeDiv(avgClientLtv, input.avgClientRetentionMonths);
  const ltv: FunnelLtvMetrics = {
    avgClientLtv,
    avgClientRetentionMonths: input.avgClientRetentionMonths,
    avgMonthlyRevenue,
    ltvToCacRatio: safeDiv(avgClientLtv, costs.cac),
    paybackMonths: safeDiv(costs.cac, avgMonthlyRevenue),
  };

  // Extended network metrics
  const extendedNetworkCac = input.referralConversions > 0
    ? safeDiv(input.referralSpend, input.referralConversions)
    : 0;
  const extendedNetworkLtv = input.referralConversions > 0
    ? safeDiv(input.referralRevenue, input.referralConversions) * safeDiv(input.avgClientRetentionMonths, 12)
    : 0;
  const extendedNetwork: ExtendedNetworkMetrics = {
    referralsGenerated: input.referralsGenerated,
    referralConversionRate: safeDiv(input.referralConversions, input.referralsGenerated),
    extendedNetworkCac,
    extendedNetworkRoi: safeDiv(input.referralRevenue - input.referralSpend, input.referralSpend),
    extendedNetworkLtv,
    networkMultiplier: safeDiv(
      input.revenue + input.referralRevenue,
      input.revenue || 1
    ),
  };

  // Benchmarks
  const benchmark = INDUSTRY_BENCHMARKS[input.funnelId] || INDUSTRY_BENCHMARKS.hnw;
  const performanceScore = (
    (costs.cac < benchmark.cac ? 1 : 0) +
    (revenue.roi > benchmark.roi ? 1 : 0) +
    (avgClientLtv > benchmark.ltv ? 1 : 0)
  );

  return {
    funnelName: input.funnelName,
    funnelId: input.funnelId,
    period: input.period,
    costs,
    revenue,
    ltv,
    extendedNetwork,
    conversionFunnel: {
      entered: input.leadsEntered,
      qualified: input.leadsQualified,
      solutionDesign: input.leadsSolutionDesign,
      validation: input.leadsValidation,
      commit: input.leadsCommit,
      converted: input.leadsConverted,
      conversionRate: safeDiv(input.leadsConverted, input.leadsEntered),
      avgDaysToConvert: input.avgDaysToConvert,
    },
    benchmarks: {
      industryCac: benchmark.cac,
      industryRoi: benchmark.roi,
      industryLtv: benchmark.ltv,
      performanceVsBenchmark: performanceScore >= 2 ? "above" : performanceScore === 1 ? "at" : "below",
    },
  };
}

// ─── Roll-Up Calculation ─────────────────────────────────────────────────

export function calculateFunnelRollup(funnels: FunnelMetricsResult[]): FunnelRollup {
  if (funnels.length === 0) {
    return {
      totalFunnels: 0,
      totalSpend: 0,
      totalRevenue: 0,
      totalCogs: 0,
      blendedCac: 0,
      blendedRoi: 0,
      blendedLtv: 0,
      blendedLtvToCac: 0,
      totalLeadsGenerated: 0,
      totalLeadsConverted: 0,
      overallConversionRate: 0,
      bestPerformingFunnel: "N/A",
      worstPerformingFunnel: "N/A",
      funnels: [],
    };
  }

  const totalSpend = funnels.reduce((s, f) => s + f.costs.totalSpend, 0);
  const totalRevenue = funnels.reduce((s, f) => s + f.revenue.totalRevenue, 0);
  const totalCogs = funnels.reduce((s, f) => s + f.revenue.cogs, 0);
  const totalLeadsGenerated = funnels.reduce((s, f) => s + f.costs.leadsGenerated, 0);
  const totalLeadsConverted = funnels.reduce((s, f) => s + f.costs.leadsConverted, 0);

  const safeDiv = (a: number, b: number) => b === 0 ? 0 : a / b;

  const blendedCac = safeDiv(totalSpend, totalLeadsConverted);
  const blendedRoi = safeDiv(totalRevenue - totalSpend, totalSpend);
  const blendedLtv = funnels.reduce((s, f) => s + f.ltv.avgClientLtv * f.costs.leadsConverted, 0)
    / (totalLeadsConverted || 1);

  // Find best/worst by ROI
  const sorted = [...funnels].sort((a, b) => b.revenue.roi - a.revenue.roi);

  return {
    totalFunnels: funnels.length,
    totalSpend,
    totalRevenue,
    totalCogs,
    blendedCac,
    blendedRoi,
    blendedLtv,
    blendedLtvToCac: safeDiv(blendedLtv, blendedCac),
    totalLeadsGenerated,
    totalLeadsConverted,
    overallConversionRate: safeDiv(totalLeadsConverted, totalLeadsGenerated),
    bestPerformingFunnel: sorted[0]?.funnelName || "N/A",
    worstPerformingFunnel: sorted[sorted.length - 1]?.funnelName || "N/A",
    funnels,
  };
}

// ─── Reasonably Expected Values (v10 spec) ──────────────────────────────

export interface ExpectedMetrics {
  funnelId: string;
  funnelName: string;
  expectedCac: number;
  expectedRoi: number;
  expectedLtv: number;
  expectedExtendedNetworkCac: number;
  expectedExtendedNetworkRoi: number;
  expectedExtendedNetworkLtv: number;
  reasoning: string;
}

export function getExpectedMetrics(): ExpectedMetrics[] {
  return [
    {
      funnelId: "recruit",
      funnelName: "Recruit (New Associates + Experienced Professionals)",
      expectedCac: 12000,
      expectedRoi: 4.2,
      expectedLtv: 280000,
      expectedExtendedNetworkCac: 6000,
      expectedExtendedNetworkRoi: 7.5,
      expectedExtendedNetworkLtv: 350000,
      reasoning: "Recruit funnel has high upfront cost (screening, interviews, onboarding) but strong LTV from production credits, override commissions, and network expansion. Extended network value is high because recruited advisors bring their own book of business and generate referrals.",
    },
    {
      funnelId: "hnw",
      funnelName: "HNW Prospect (High-Net-Worth Individuals)",
      expectedCac: 6500,
      expectedRoi: 6.0,
      expectedLtv: 550000,
      expectedExtendedNetworkCac: 3000,
      expectedExtendedNetworkRoi: 10.0,
      expectedExtendedNetworkLtv: 400000,
      reasoning: "HNW clients have the highest LTV due to AUM-based fees, insurance premiums, and estate planning revenue. Referral network is extremely valuable as HNW individuals refer within their peer group. CAC is moderate due to multi-touch personalized outreach.",
    },
    {
      funnelId: "coi",
      funnelName: "COI (Centers of Influence / Strategic Partners)",
      expectedCac: 2500,
      expectedRoi: 9.0,
      expectedLtv: 175000,
      expectedExtendedNetworkCac: 1200,
      expectedExtendedNetworkRoi: 15.0,
      expectedExtendedNetworkLtv: 250000,
      reasoning: "COI partnerships (CPAs, attorneys, mortgage brokers) have the lowest CAC and highest ROI because they generate ongoing referral streams. Each COI relationship typically yields 3-8 qualified referrals per year. Extended network value compounds as COI partners refer other COIs.",
    },
    {
      funnelId: "b2b",
      funnelName: "B2B Prospect (WTA/PCMP 10+ W-2 Businesses)",
      expectedCac: 10000,
      expectedRoi: 4.5,
      expectedLtv: 320000,
      expectedExtendedNetworkCac: 5000,
      expectedExtendedNetworkRoi: 8.0,
      expectedExtendedNetworkLtv: 280000,
      reasoning: "B2B prospects (businesses with 10+ W-2 employees) offer group benefits, retirement plans, and key-person insurance. Higher CAC due to longer sales cycle and multiple decision-makers. Strong LTV from recurring group premiums and plan administration fees.",
    },
    {
      funnelId: "dormant",
      funnelName: "Dormant Re-Engagement (90+ Days No Contact)",
      expectedCac: 1200,
      expectedRoi: 14.0,
      expectedLtv: 220000,
      expectedExtendedNetworkCac: 800,
      expectedExtendedNetworkRoi: 18.0,
      expectedExtendedNetworkLtv: 180000,
      reasoning: "Dormant re-engagement has the lowest CAC because these are warm leads with prior relationship. High ROI because minimal incremental spend reactivates existing pipeline. LTV is slightly lower than fresh HNW due to possible relationship degradation.",
    },
    {
      funnelId: "affiliate",
      funnelName: "Stewardly Affiliate Onboarding",
      expectedCac: 4000,
      expectedRoi: 7.0,
      expectedLtv: 200000,
      expectedExtendedNetworkCac: 2000,
      expectedExtendedNetworkRoi: 12.0,
      expectedExtendedNetworkLtv: 250000,
      reasoning: "Affiliate onboarding targets advisors joining the Stewardly platform. Moderate CAC for education and onboarding. Strong LTV from platform fees, shared revenue, and cross-selling. Extended network value is high as affiliates bring their own client base.",
    },
  ];
}
