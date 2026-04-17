/* ═══════════════════════════════════════════════════════════════
   AUM Override Cascade Engine
   Implements: p² + p − 1/3 = 0 → 26.375% default override
   + AUM Pipeline Funnel + Affiliate Pipeline Funnel
   + Activity Metrics + Production Forecasting + Ramp Modeling
   ═══════════════════════════════════════════════════════════════ */

// fmt/fmtSm/pct from standalone leaf module (avoids TDZ)

/* ═══ AUM OVERRIDE CASCADE ═══
   The formula p² + p − 1/3 = 0 has positive root ≈ 0.26375 (26.375%).
   This is the default standard tiered upline override rate for MDs/RVPs.
   
   For an individual advisor with X% of GDC retained:
   - Anything less than 90% individual GDC triggers upline override calculation
   - The upline at the next tier earns ~20% of the advisor's payable earnings
   - 26.375% = blended effective override rate across the hierarchy
   
   Hierarchy cascade: individual → team lead → MD/RVP → regional
*/

/** Solve p² + p − 1/3 = 0 for the positive root */
export function solveOverrideFormula(): number {
  // p² + p − 1/3 = 0
  // Using quadratic formula: p = (-1 + sqrt(1 + 4/3)) / 2
  const discriminant = 1 + 4 / 3;
  const root = (-1 + Math.sqrt(discriminant)) / 2;
  return root; // ≈ 0.26375
}

export const DEFAULT_OVERRIDE_RATE = solveOverrideFormula(); // 26.375%

/* ═══ HIERARCHY TIER STRUCTURE ═══ */
export interface HierarchyTier {
  id: string;
  label: string;
  overrideRate: number;    // % of immediate reports' payable earnings
  isFormulaDefault: boolean; // true if using the p²+p−1/3=0 derived rate
}

export const DEFAULT_TIERS: HierarchyTier[] = [
  { id: 'team_lead', label: 'Team Lead / Sr Associate', overrideRate: 0.10, isFormulaDefault: false },
  { id: 'director', label: 'Director', overrideRate: 0.15, isFormulaDefault: false },
  { id: 'md', label: 'Managing Director', overrideRate: 0.20, isFormulaDefault: true },
  { id: 'rvp', label: 'Regional Vice President', overrideRate: 0.20, isFormulaDefault: true },
];

/* ═══ TEAM MEMBER FOR AUM OVERRIDE ═══ */
export interface AUMTeamMember {
  id: string;
  name: string;
  role: string;
  aumTotal: number;       // Total AUM under management
  gdcRetainedPct: number; // % of GDC retained (e.g., 80%)
  feeSchedulePct: number; // Annual fee as % of AUM (e.g., 1.0%)
  billingFreq: 'quarterly' | 'semi-annual' | 'annual';
}

/* ═══ AUM OVERRIDE CALCULATION ═══ */
export interface AUMOverrideResult {
  member: AUMTeamMember;
  annualFees: number;       // AUM × fee schedule %
  payableEarnings: number;  // Annual fees × GDC retained %
  overrideByTier: { tier: HierarchyTier; overrideAmount: number }[];
  totalOverride: number;
  effectiveOverrideRate: number;
  netToAdvisor: number;
}

export function calcAUMOverride(
  member: AUMTeamMember,
  tiers: HierarchyTier[]
): AUMOverrideResult {
  const annualFees = Math.round(member.aumTotal * (member.feeSchedulePct / 100));
  const payableEarnings = Math.round(annualFees * (member.gdcRetainedPct / 100));

  let remaining = payableEarnings;
  const overrideByTier: { tier: HierarchyTier; overrideAmount: number }[] = [];
  let totalOverride = 0;

  for (const tier of tiers) {
    const overrideAmount = Math.round(remaining * tier.overrideRate);
    overrideByTier.push({ tier, overrideAmount });
    totalOverride += overrideAmount;
    remaining -= overrideAmount;
  }

  const effectiveOverrideRate = payableEarnings > 0 ? totalOverride / payableEarnings : 0;
  const netToAdvisor = payableEarnings - totalOverride;

  return {
    member,
    annualFees,
    payableEarnings,
    overrideByTier,
    totalOverride,
    effectiveOverrideRate,
    netToAdvisor,
  };
}

/** Calculate team-wide AUM override economics */
export function calcTeamAUMOverrides(
  members: AUMTeamMember[],
  tiers: HierarchyTier[]
): {
  memberResults: AUMOverrideResult[];
  totalAUM: number;
  totalFees: number;
  totalPayable: number;
  totalOverride: number;
  totalNetToAdvisors: number;
  blendedOverrideRate: number;
  blendedFeeRate: number;
} {
  const memberResults = members.map(m => calcAUMOverride(m, tiers));

  const totalAUM = members.reduce((s, m) => s + m.aumTotal, 0);
  const totalFees = memberResults.reduce((s, r) => s + r.annualFees, 0);
  const totalPayable = memberResults.reduce((s, r) => s + r.payableEarnings, 0);
  const totalOverride = memberResults.reduce((s, r) => s + r.totalOverride, 0);
  const totalNetToAdvisors = memberResults.reduce((s, r) => s + r.netToAdvisor, 0);
  const blendedOverrideRate = totalPayable > 0 ? totalOverride / totalPayable : 0;
  const blendedFeeRate = totalAUM > 0 ? totalFees / totalAUM : 0;

  return {
    memberResults,
    totalAUM,
    totalFees,
    totalPayable,
    totalOverride,
    totalNetToAdvisors,
    blendedOverrideRate,
    blendedFeeRate,
  };
}

/* ═══ AUM FEE SCHEDULE WITH BREAKPOINTS ═══ */
export interface FeeBreakpoint {
  minAUM: number;
  maxAUM: number;
  feePct: number;
  label: string;
}

export const DEFAULT_FEE_BREAKPOINTS: FeeBreakpoint[] = [
  { minAUM: 0, maxAUM: 249999, feePct: 1.50, label: '<$250K' },
  { minAUM: 250000, maxAUM: 499999, feePct: 1.25, label: '$250K–$500K' },
  { minAUM: 500000, maxAUM: 999999, feePct: 1.00, label: '$500K–$1M' },
  { minAUM: 1000000, maxAUM: 2999999, feePct: 0.85, label: '$1M–$3M' },
  { minAUM: 3000000, maxAUM: 4999999, feePct: 0.75, label: '$3M–$5M' },
  { minAUM: 5000000, maxAUM: 9999999, feePct: 0.65, label: '$5M–$10M' },
  { minAUM: 10000000, maxAUM: Infinity, feePct: 0.50, label: '$10M+' },
];

export function getBlendedFeeRate(aum: number, breakpoints: FeeBreakpoint[] = DEFAULT_FEE_BREAKPOINTS): number {
  if (aum <= 0) return 0;
  let totalFee = 0;
  let remaining = aum;

  for (const bp of breakpoints) {
    if (remaining <= 0) break;
    const tierSize = Math.min(remaining, bp.maxAUM - bp.minAUM + 1);
    totalFee += tierSize * (bp.feePct / 100);
    remaining -= tierSize;
  }

  return totalFee / aum * 100; // Return as percentage
}

/* ═══ AUM PIPELINE FUNNEL ═══
   prospects → discovery → proposal → investment agreement → AUM onboarded → billing active → under management
*/
export interface AUMPipelineStage {
  id: string;
  label: string;
  count: number;
  avgAUM: number;     // Average AUM per prospect at this stage
  conversionRate: number; // % that advance to next stage
}

export const DEFAULT_AUM_PIPELINE: AUMPipelineStage[] = [
  { id: 'prospects', label: 'Prospects Identified', count: 50, avgAUM: 500000, conversionRate: 0.40 },
  { id: 'discovery', label: 'Discovery Meeting', count: 20, avgAUM: 600000, conversionRate: 0.60 },
  { id: 'proposal', label: 'Proposal Presented', count: 12, avgAUM: 650000, conversionRate: 0.65 },
  { id: 'agreement', label: 'Investment Agreement', count: 8, avgAUM: 700000, conversionRate: 0.85 },
  { id: 'onboarded', label: 'AUM Onboarded', count: 7, avgAUM: 700000, conversionRate: 0.95 },
  { id: 'billing', label: 'Billing Active', count: 6, avgAUM: 700000, conversionRate: 0.98 },
  { id: 'managed', label: 'Under Management', count: 6, avgAUM: 700000, conversionRate: 1.00 },
];

export interface AUMPipelineResult {
  stages: AUMPipelineStage[];
  totalProspectAUM: number;
  projectedNewAUM: number;
  projectedAnnualFees: number;
  avgConversionRate: number;
  pipelineVelocityDays: number; // avg days from prospect to managed
}

export function calcAUMPipeline(
  stages: AUMPipelineStage[],
  feeRate: number = 1.0, // % annual fee
  avgCycleDays: number = 90
): AUMPipelineResult {
  const totalProspectAUM = stages[0] ? stages[0].count * stages[0].avgAUM : 0;
  const lastStage = stages[stages.length - 1];
  const projectedNewAUM = lastStage ? lastStage.count * lastStage.avgAUM : 0;
  const projectedAnnualFees = Math.round(projectedNewAUM * (feeRate / 100));

  // Calculate overall conversion rate (prospect to managed)
  let overallConversion = 1;
  for (let i = 0; i < stages.length - 1; i++) {
    overallConversion *= stages[i].conversionRate;
  }

  return {
    stages,
    totalProspectAUM,
    projectedNewAUM,
    projectedAnnualFees,
    avgConversionRate: overallConversion,
    pipelineVelocityDays: avgCycleDays,
  };
}

/* ═══ AFFILIATE PIPELINE FUNNEL ═══
   For RECRUITING affiliates:
   identified → outreach → exploratory → MOU → active referrals → strategic alliance
   
   For AFFILIATE OWN production planning:
   prospect → intro meeting → needs analysis → proposal → placement → ongoing service
*/
export interface AffiliatePipelineStage {
  id: string;
  label: string;
  count: number;
  conversionRate: number;
  avgRevenue: number; // Expected revenue per affiliate at this stage
}

export const DEFAULT_AFFILIATE_RECRUITING_PIPELINE: AffiliatePipelineStage[] = [
  { id: 'identified', label: 'Identified', count: 40, conversionRate: 0.50, avgRevenue: 0 },
  { id: 'outreach', label: 'Outreach Completed', count: 20, conversionRate: 0.45, avgRevenue: 0 },
  { id: 'exploratory', label: 'Exploratory Meeting', count: 9, conversionRate: 0.55, avgRevenue: 0 },
  { id: 'mou', label: 'MOU / Agreement', count: 5, conversionRate: 0.80, avgRevenue: 15000 },
  { id: 'active', label: 'Active Referrals', count: 4, conversionRate: 0.75, avgRevenue: 25000 },
  { id: 'strategic', label: 'Strategic Alliance', count: 3, conversionRate: 1.00, avgRevenue: 50000 },
];

export const DEFAULT_AFFILIATE_PRODUCTION_PIPELINE: AffiliatePipelineStage[] = [
  { id: 'prospect', label: 'Prospects (from affiliate)', count: 30, conversionRate: 0.35, avgRevenue: 0 },
  { id: 'intro', label: 'Intro Meeting', count: 10, conversionRate: 0.60, avgRevenue: 0 },
  { id: 'needs', label: 'Needs Analysis', count: 6, conversionRate: 0.70, avgRevenue: 0 },
  { id: 'proposal', label: 'Proposal Presented', count: 4, conversionRate: 0.75, avgRevenue: 3000 },
  { id: 'placement', label: 'Case Placed', count: 3, conversionRate: 0.90, avgRevenue: 3500 },
  { id: 'service', label: 'Ongoing Service', count: 3, conversionRate: 1.00, avgRevenue: 4000 },
];

export interface AffiliatePipelineResult {
  stages: AffiliatePipelineStage[];
  totalIdentified: number;
  totalActive: number;
  projectedAnnualRevenue: number;
  overallConversion: number;
  revenuePerAffiliate: number;
}

export function calcAffiliatePipeline(
  stages: AffiliatePipelineStage[]
): AffiliatePipelineResult {
  const totalIdentified = stages[0]?.count || 0;
  const lastStage = stages[stages.length - 1];
  const totalActive = lastStage?.count || 0;
  const projectedAnnualRevenue = stages.reduce((s, st) => s + (st.count * st.avgRevenue), 0);

  let overallConversion = 1;
  for (let i = 0; i < stages.length - 1; i++) {
    overallConversion *= stages[i].conversionRate;
  }

  const revenuePerAffiliate = totalActive > 0 ? Math.round(projectedAnnualRevenue / totalActive) : 0;

  return {
    stages,
    totalIdentified,
    totalActive,
    projectedAnnualRevenue,
    overallConversion,
    revenuePerAffiliate,
  };
}

/* ═══ ACTIVITY METRICS ═══ */
export interface ActivityMetrics {
  calls: number;
  meetings: number;
  proposals: number;
  closes: number;
  period: 'weekly' | 'monthly' | 'quarterly';
}

export interface ActivityResult {
  metrics: ActivityMetrics;
  callToMeetingRate: number;
  meetingToProposalRate: number;
  proposalToCloseRate: number;
  overallConversion: number;
  projectedMonthlyRevenue: number;
  projectedAnnualRevenue: number;
}

export function calcActivityMetrics(
  metrics: ActivityMetrics,
  avgRevenuePerClose: number = 3000
): ActivityResult {
  const multiplier = metrics.period === 'weekly' ? 4.3 : metrics.period === 'quarterly' ? 1 / 3 : 1;
  const monthlyCalls = Math.round(metrics.calls * multiplier);
  const monthlyMeetings = Math.round(metrics.meetings * multiplier);
  const monthlyProposals = Math.round(metrics.proposals * multiplier);
  const monthlyCloses = Math.round(metrics.closes * multiplier);

  const callToMeetingRate = monthlyCalls > 0 ? monthlyMeetings / monthlyCalls : 0;
  const meetingToProposalRate = monthlyMeetings > 0 ? monthlyProposals / monthlyMeetings : 0;
  const proposalToCloseRate = monthlyProposals > 0 ? monthlyCloses / monthlyProposals : 0;
  const overallConversion = monthlyCalls > 0 ? monthlyCloses / monthlyCalls : 0;

  return {
    metrics,
    callToMeetingRate,
    meetingToProposalRate,
    proposalToCloseRate,
    overallConversion,
    projectedMonthlyRevenue: monthlyCloses * avgRevenuePerClose,
    projectedAnnualRevenue: monthlyCloses * avgRevenuePerClose * 12,
  };
}

/* ═══ PRODUCTION FORECASTING ═══ */
export interface ProductionForecast {
  month: number;
  label: string;
  pipelineAUM: number;
  projectedNewAUM: number;
  cumulativeAUM: number;
  projectedFees: number;
  cumulativeFees: number;
}

export function calcProductionForecast(
  currentAUM: number,
  monthlyNewAUM: number,
  feeRatePct: number = 1.0,
  horizonMonths: number = 36,
  growthRatePct: number = 0, // organic growth rate per month
  attritionRatePct: number = 0.5 // monthly attrition rate
): ProductionForecast[] {
  const months: ProductionForecast[] = [];
  let cumAUM = currentAUM;
  let cumFees = 0;
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  for (let m = 1; m <= horizonMonths; m++) {
    // Organic growth on existing AUM
    const organicGrowth = Math.round(cumAUM * (growthRatePct / 100));
    // Attrition
    const attrition = Math.round(cumAUM * (attritionRatePct / 100));
    // New AUM gathered this month (with ramp)
    const rampFactor = m <= 6 ? 0.3 + (m / 6) * 0.7 : 1.0;
    const newAUM = Math.round(monthlyNewAUM * rampFactor);

    cumAUM = cumAUM + organicGrowth - attrition + newAUM;
    const monthlyFees = Math.round(cumAUM * (feeRatePct / 100) / 12);
    cumFees += monthlyFees;

    months.push({
      month: m,
      label: `${monthNames[(m - 1) % 12]} Y${Math.ceil(m / 12)}`,
      pipelineAUM: Math.round(newAUM * 3), // 3x pipeline coverage
      projectedNewAUM: newAUM,
      cumulativeAUM: cumAUM,
      projectedFees: monthlyFees,
      cumulativeFees: cumFees,
    });
  }

  return months;
}

/* ═══ RAMP SCHEDULE MODELING ═══ */
export interface RampSchedule {
  month: number;
  label: string;
  targetAUM: number;
  actualAUM: number;
  gapToTarget: number;
  onTrack: boolean;
  feeIncome: number;
}

export function buildRampSchedule(
  targetAUM12: number,  // 12-month target
  targetAUM24: number,  // 24-month target
  targetAUM36: number,  // 36-month target
  currentAUM: number = 0,
  feeRatePct: number = 1.0
): RampSchedule[] {
  const schedule: RampSchedule[] = [];
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // Linear interpolation between targets
  for (let m = 1; m <= 36; m++) {
    let target: number;
    if (m <= 12) {
      target = Math.round(currentAUM + (targetAUM12 - currentAUM) * (m / 12));
    } else if (m <= 24) {
      target = Math.round(targetAUM12 + (targetAUM24 - targetAUM12) * ((m - 12) / 12));
    } else {
      target = Math.round(targetAUM24 + (targetAUM36 - targetAUM24) * ((m - 24) / 12));
    }

    // Simulate actual with some variance (for display purposes, actual = target in planning mode)
    const actual = target;
    const feeIncome = Math.round(actual * (feeRatePct / 100) / 12);

    schedule.push({
      month: m,
      label: `${monthNames[(m - 1) % 12]} Y${Math.ceil(m / 12)}`,
      targetAUM: target,
      actualAUM: actual,
      gapToTarget: actual - target,
      onTrack: actual >= target * 0.9,
      feeIncome,
    });
  }

  return schedule;
}

/* ═══ WHAT-IF MODELING ═══ */
export interface WhatIfScenario {
  label: string;
  additionalAdvisors: number;
  avgProductionPerAdvisor: number;
  gdcRetainedPct: number;
}

export function calcWhatIfScenario(
  baseMembers: AUMTeamMember[],
  scenario: WhatIfScenario,
  tiers: HierarchyTier[]
): {
  baseResult: ReturnType<typeof calcTeamAUMOverrides>;
  scenarioResult: ReturnType<typeof calcTeamAUMOverrides>;
  deltaOverride: number;
  deltaAUM: number;
  deltaFees: number;
} {
  const baseResult = calcTeamAUMOverrides(baseMembers, tiers);

  // Add scenario advisors
  const newMembers: AUMTeamMember[] = [];
  for (let i = 0; i < scenario.additionalAdvisors; i++) {
    newMembers.push({
      id: `scenario-${i}`,
      name: `New Advisor ${i + 1}`,
      role: 'advisor',
      aumTotal: scenario.avgProductionPerAdvisor,
      gdcRetainedPct: scenario.gdcRetainedPct,
      feeSchedulePct: 1.0,
      billingFreq: 'quarterly',
    });
  }

  const scenarioResult = calcTeamAUMOverrides([...baseMembers, ...newMembers], tiers);

  return {
    baseResult,
    scenarioResult,
    deltaOverride: scenarioResult.totalOverride - baseResult.totalOverride,
    deltaAUM: scenarioResult.totalAUM - baseResult.totalAUM,
    deltaFees: scenarioResult.totalFees - baseResult.totalFees,
  };
}


