/* ═══════════════════════════════════════════════════════════════
   Domain A — Practice Management Engine
   Production Optimization, Channel Diversification, Marketing/Acquisition ROI
   ═══════════════════════════════════════════════════════════════ */

/* ─── Production Optimization ─── */
export interface WeeklyStructure {
  prospectingHours: number;
  meetingHours: number;
  adminHours: number;
  learningHours: number;
  networkingHours: number;
  totalHours: number;
}

export interface ProductionTarget {
  weeklyCallTarget: number;
  weeklyMeetingTarget: number;
  weeklyProposalTarget: number;
  monthlyCloseTarget: number;
  avgRevenuePerClose: number;
}

export interface ProductionOptResult {
  weeklyStructure: WeeklyStructure;
  targets: ProductionTarget;
  projectedMonthlyGDC: number;
  projectedAnnualGDC: number;
  efficiencyScore: number; // 0-100
  benchmarkComparison: {
    metric: string;
    yours: number;
    mdrtAvg: number;
    top10Pct: number;
    status: 'below' | 'at' | 'above';
  }[];
  recommendations: string[];
}

export const MDRT_BENCHMARKS = {
  weeklyProspectingHours: 15,
  weeklyMeetingHours: 12,
  weeklyCallTarget: 50,
  weeklyMeetingTarget: 12,
  monthlyCloseRate: 8,
  avgRevenuePerClose: 5000,
  annualGDC: 250000,
};

export const TOP_10_BENCHMARKS = {
  weeklyProspectingHours: 20,
  weeklyMeetingHours: 15,
  weeklyCallTarget: 75,
  weeklyMeetingTarget: 18,
  monthlyCloseRate: 15,
  avgRevenuePerClose: 12000,
  annualGDC: 750000,
};

export function calcProductionOptimization(
  prospectingHrs: number, meetingHrs: number, adminHrs: number,
  learningHrs: number, networkingHrs: number,
  callTarget: number, meetingTarget: number, proposalTarget: number,
  closeTarget: number, avgRevPerClose: number,
  callToMeetingRate: number, meetingToProposalRate: number, proposalToCloseRate: number
): ProductionOptResult {
  const totalHours = prospectingHrs + meetingHrs + adminHrs + learningHrs + networkingHrs;
  const projectedMonthlyGDC = closeTarget * avgRevPerClose;
  const projectedAnnualGDC = projectedMonthlyGDC * 12;

  // Efficiency = weighted score based on time allocation vs benchmarks
  const prospectPct = prospectingHrs / Math.max(totalHours, 1);
  const meetingPct = meetingHrs / Math.max(totalHours, 1);
  const adminPct = adminHrs / Math.max(totalHours, 1);
  // Ideal: 35% prospecting, 30% meetings, 15% admin, 10% learning, 10% networking
  const idealProspect = 0.35, idealMeeting = 0.30, idealAdmin = 0.15;
  const efficiencyScore = Math.round(
    100 - (Math.abs(prospectPct - idealProspect) + Math.abs(meetingPct - idealMeeting) + Math.abs(adminPct - idealAdmin)) * 100
  );

  const benchmarks: ProductionOptResult['benchmarkComparison'] = [
    {
      metric: 'Weekly Calls',
      yours: callTarget,
      mdrtAvg: MDRT_BENCHMARKS.weeklyCallTarget,
      top10Pct: TOP_10_BENCHMARKS.weeklyCallTarget,
      status: callTarget >= TOP_10_BENCHMARKS.weeklyCallTarget ? 'above' : callTarget >= MDRT_BENCHMARKS.weeklyCallTarget ? 'at' : 'below',
    },
    {
      metric: 'Weekly Meetings',
      yours: meetingTarget,
      mdrtAvg: MDRT_BENCHMARKS.weeklyMeetingTarget,
      top10Pct: TOP_10_BENCHMARKS.weeklyMeetingTarget,
      status: meetingTarget >= TOP_10_BENCHMARKS.weeklyMeetingTarget ? 'above' : meetingTarget >= MDRT_BENCHMARKS.weeklyMeetingTarget ? 'at' : 'below',
    },
    {
      metric: 'Monthly Closes',
      yours: closeTarget,
      mdrtAvg: MDRT_BENCHMARKS.monthlyCloseRate,
      top10Pct: TOP_10_BENCHMARKS.monthlyCloseRate,
      status: closeTarget >= TOP_10_BENCHMARKS.monthlyCloseRate ? 'above' : closeTarget >= MDRT_BENCHMARKS.monthlyCloseRate ? 'at' : 'below',
    },
    {
      metric: 'Avg Rev/Close',
      yours: avgRevPerClose,
      mdrtAvg: MDRT_BENCHMARKS.avgRevenuePerClose,
      top10Pct: TOP_10_BENCHMARKS.avgRevenuePerClose,
      status: avgRevPerClose >= TOP_10_BENCHMARKS.avgRevenuePerClose ? 'above' : avgRevPerClose >= MDRT_BENCHMARKS.avgRevenuePerClose ? 'at' : 'below',
    },
    {
      metric: 'Annual GDC',
      yours: projectedAnnualGDC,
      mdrtAvg: MDRT_BENCHMARKS.annualGDC,
      top10Pct: TOP_10_BENCHMARKS.annualGDC,
      status: projectedAnnualGDC >= TOP_10_BENCHMARKS.annualGDC ? 'above' : projectedAnnualGDC >= MDRT_BENCHMARKS.annualGDC ? 'at' : 'below',
    },
  ];

  const recommendations: string[] = [];
  if (prospectPct < 0.25) recommendations.push('Increase prospecting time — top producers spend 30-40% of their week on prospecting activities.');
  if (adminPct > 0.25) recommendations.push('Reduce admin overhead — consider hiring a VA or using automation. Top producers keep admin below 15%.');
  if (callToMeetingRate < 0.25) recommendations.push('Improve call-to-meeting conversion — review your phone script and value proposition. Industry best: 35-40%.');
  if (proposalToCloseRate < 0.40) recommendations.push('Improve proposal-to-close rate — review your presentation and objection handling. Top performers: 50-60%.');
  if (avgRevPerClose < 5000) recommendations.push('Focus on higher-value cases — consider moving upmarket or adding AUM/advisory services to increase average case size.');
  if (recommendations.length === 0) recommendations.push('Your metrics are strong. Focus on consistency and scaling through team building or channel diversification.');

  return {
    weeklyStructure: { prospectingHours: prospectingHrs, meetingHours: meetingHrs, adminHours: adminHrs, learningHours: learningHrs, networkingHours: networkingHrs, totalHours },
    targets: { weeklyCallTarget: callTarget, weeklyMeetingTarget: meetingTarget, weeklyProposalTarget: proposalTarget, monthlyCloseTarget: closeTarget, avgRevenuePerClose: avgRevPerClose },
    projectedMonthlyGDC,
    projectedAnnualGDC,
    efficiencyScore: Math.max(0, Math.min(100, efficiencyScore)),
    benchmarkComparison: benchmarks,
    recommendations,
  };
}

/* ─── Channel Diversification ─── */
export interface ChannelMix {
  insuranceGDC: number;
  aumFees: number;
  affiliateIncome: number;
  customChannelIncome: number;
  teamOverrides: number;
}

export interface ChannelDiversResult {
  totalGDC: number;
  channelBreakdown: { name: string; amount: number; pct: number; color: string }[];
  concentrationRisk: 'low' | 'medium' | 'high';
  herfindahlIndex: number; // 0-1, lower = more diversified
  recommendations: string[];
  overrideImpact: number;
  effectivePayout: number;
}

export function calcChannelDiversification(mix: ChannelMix, gdcRetainedPct: number): ChannelDiversResult {
  const channels = [
    { name: 'Insurance', amount: mix.insuranceGDC, color: '#3b82f6' },
    { name: 'AUM/Advisory', amount: mix.aumFees, color: '#22c55e' },
    { name: 'Affiliate/Referral', amount: mix.affiliateIncome, color: '#f59e0b' },
    { name: 'Custom Channel', amount: mix.customChannelIncome, color: '#8b5cf6' },
    { name: 'Team Overrides', amount: mix.teamOverrides, color: '#ef4444' },
  ].filter(c => c.amount > 0);

  const totalGDC = channels.reduce((s, c) => s + c.amount, 0);
  const breakdown = channels.map(c => ({
    ...c,
    pct: totalGDC > 0 ? c.amount / totalGDC : 0,
  }));

  // Herfindahl-Hirschman Index for concentration
  const hhi = breakdown.reduce((s, c) => s + c.pct * c.pct, 0);
  const concentrationRisk: 'low' | 'medium' | 'high' =
    hhi > 0.6 ? 'high' : hhi > 0.35 ? 'medium' : 'low';

  const overrideImpact = totalGDC * (1 - gdcRetainedPct / 100);
  const effectivePayout = totalGDC - overrideImpact;

  const recommendations: string[] = [];
  if (hhi > 0.6) recommendations.push('High concentration risk — consider diversifying into additional channels to reduce revenue dependency.');
  if (mix.aumFees === 0 && totalGDC > 100000) recommendations.push('No AUM/advisory income — adding recurring AUM fees creates predictable revenue and increases practice valuation.');
  if (mix.affiliateIncome === 0) recommendations.push('No affiliate income — strategic partnerships can generate referral revenue with minimal marginal cost.');
  if (mix.teamOverrides === 0 && totalGDC > 200000) recommendations.push('No team overrides — building a team creates leverage and passive income through override compensation.');
  if (channels.length >= 3 && hhi < 0.35) recommendations.push('Well-diversified practice — focus on growing each channel proportionally and optimizing margins.');

  return { totalGDC, channelBreakdown: breakdown, concentrationRisk, herfindahlIndex: hhi, recommendations, overrideImpact, effectivePayout };
}

/* ─── Marketing / Acquisition ROI ─── */
export interface Campaign {
  id: string;
  name: string;
  type: 'digital' | 'events' | 'referral' | 'coi' | 'direct_mail' | 'other';
  monthlyCost: number;
  leadsPerMonth: number;
  conversionRate: number; // leads → clients
  avgRevenuePerClient: number;
  avgLTV: number; // lifetime value
}

export interface MarketingROIResult {
  campaigns: (Campaign & {
    monthlyRevenue: number;
    monthlyROI: number;
    cac: number; // customer acquisition cost
    ltv: number;
    ltvCacRatio: number;
    paybackMonths: number;
    annualRevenue: number;
    annualProfit: number;
    marginPct: number;
  })[];
  totalMonthlyCost: number;
  totalMonthlyRevenue: number;
  totalMonthlyProfit: number;
  blendedCAC: number;
  blendedLTV: number;
  blendedROI: number;
  recommendations: string[];
}

export const DEFAULT_CAMPAIGNS: Campaign[] = [
  { id: '1', name: 'LinkedIn Ads', type: 'digital', monthlyCost: 2000, leadsPerMonth: 15, conversionRate: 0.08, avgRevenuePerClient: 5000, avgLTV: 25000 },
  { id: '2', name: 'Seminar Series', type: 'events', monthlyCost: 3000, leadsPerMonth: 20, conversionRate: 0.15, avgRevenuePerClient: 8000, avgLTV: 40000 },
  { id: '3', name: 'COI Partnerships', type: 'coi', monthlyCost: 500, leadsPerMonth: 5, conversionRate: 0.25, avgRevenuePerClient: 12000, avgLTV: 60000 },
  { id: '4', name: 'Client Referrals', type: 'referral', monthlyCost: 200, leadsPerMonth: 8, conversionRate: 0.35, avgRevenuePerClient: 10000, avgLTV: 50000 },
];

export function calcMarketingROI(campaigns: Campaign[]): MarketingROIResult {
  const enriched = campaigns.map(c => {
    const clientsPerMonth = c.leadsPerMonth * c.conversionRate;
    const monthlyRevenue = clientsPerMonth * c.avgRevenuePerClient;
    const monthlyProfit = monthlyRevenue - c.monthlyCost;
    const cac = clientsPerMonth > 0 ? c.monthlyCost / clientsPerMonth : Infinity;
    const ltvCacRatio = cac > 0 && isFinite(cac) ? c.avgLTV / cac : 0;
    const paybackMonths = monthlyProfit > 0 ? Math.ceil(c.monthlyCost / monthlyProfit) : Infinity;

    return {
      ...c,
      monthlyRevenue,
      monthlyROI: c.monthlyCost > 0 ? monthlyProfit / c.monthlyCost : 0,
      cac,
      ltv: c.avgLTV,
      ltvCacRatio,
      paybackMonths: isFinite(paybackMonths) ? paybackMonths : 999,
      annualRevenue: monthlyRevenue * 12,
      annualProfit: monthlyProfit * 12,
      marginPct: monthlyRevenue > 0 ? monthlyProfit / monthlyRevenue : 0,
    };
  });

  const totalMonthlyCost = enriched.reduce((s, c) => s + c.monthlyCost, 0);
  const totalMonthlyRevenue = enriched.reduce((s, c) => s + c.monthlyRevenue, 0);
  const totalMonthlyProfit = totalMonthlyRevenue - totalMonthlyCost;
  const totalClients = enriched.reduce((s, c) => s + c.leadsPerMonth * c.conversionRate, 0);
  const blendedCAC = totalClients > 0 ? totalMonthlyCost / totalClients : 0;
  const blendedLTV = totalClients > 0 ? enriched.reduce((s, c) => s + c.leadsPerMonth * c.conversionRate * c.avgLTV, 0) / totalClients : 0;
  const blendedROI = totalMonthlyCost > 0 ? totalMonthlyProfit / totalMonthlyCost : 0;

  const recommendations: string[] = [];
  const sortedByROI = [...enriched].sort((a, b) => b.monthlyROI - a.monthlyROI);
  if (sortedByROI.length > 0 && sortedByROI[0].monthlyROI > 1) {
    recommendations.push(`Best ROI channel: ${sortedByROI[0].name} (${(sortedByROI[0].monthlyROI * 100).toFixed(0)}% monthly ROI). Consider increasing budget here.`);
  }
  const lowROI = enriched.filter(c => c.monthlyROI < 0);
  if (lowROI.length > 0) {
    recommendations.push(`Negative ROI channels: ${lowROI.map(c => c.name).join(', ')}. Review targeting, messaging, or consider reallocation.`);
  }
  if (blendedCAC > 5000) recommendations.push('Blended CAC is high ($5K+). Focus on lower-cost channels like referrals and COI partnerships.');
  if (blendedLTV / blendedCAC < 3) recommendations.push('LTV:CAC ratio below 3:1 — industry benchmark is 3:1 minimum. Improve client retention or reduce acquisition costs.');
  const referralCampaign = enriched.find(c => c.type === 'referral');
  if (!referralCampaign) recommendations.push('No referral program — referrals typically have the highest conversion rate and lowest CAC. Implement a systematic referral program.');

  return { campaigns: enriched, totalMonthlyCost, totalMonthlyRevenue, totalMonthlyProfit, blendedCAC, blendedLTV, blendedROI, recommendations };
}

/* ═══════════════════════════════════════════════════════════════
   Recruiting Funnel Strategy Engine
   Stages: Identify → Outreach → Interview → Offer → Onboard → Ramp
   ═══════════════════════════════════════════════════════════════ */

export interface RecruitingFunnelStage {
  stage: string;
  count: number;
  conversionRate: number; // rate TO this stage from previous
  dropoff: number;
  costPerUnit: number;
  totalCost: number;
}

export interface RecruitingFunnelResult {
  stages: RecruitingFunnelStage[];
  totalPipelineCount: number;
  overallConversionRate: number; // identify → productive
  timeToProductivity: number; // months
  totalCAC: number; // cost per productive hire
  estimatedLTV: number; // lifetime value per hire
  ltvCacRatio: number;
  annualOverrideRevenue: number;
  breakEvenMonths: number;
  recommendations: string[];
  benchmarks: {
    metric: string;
    yours: number;
    industryAvg: number;
    topQuartile: number;
    status: 'below' | 'at' | 'above';
  }[];
}

export const RECRUITING_BENCHMARKS = {
  identifyToOutreach: 0.60,
  outreachToInterview: 0.35,
  interviewToOffer: 0.45,
  offerToOnboard: 0.70,
  onboardToProductive: 0.65,
  avgCAC: 8500,
  avgTimeToProductivity: 6,
  avgLTV: 85000,
  topQuartileCAC: 5000,
  topQuartileConversion: 0.08,
  topQuartileLTV: 150000,
};

export function calcRecruitingFunnel(
  identifyCount: number,
  outreachRate: number,
  interviewRate: number,
  offerRate: number,
  onboardRate: number,
  productiveRate: number,
  costPerIdentify: number,
  costPerOutreach: number,
  costPerInterview: number,
  costPerOffer: number,
  costPerOnboard: number,
  rampMonths: number,
  avgFYCPerHire: number,
  overrideRate: number,
  retentionYears: number,
): RecruitingFunnelResult {
  const outreach = Math.round(identifyCount * outreachRate);
  const interviews = Math.round(outreach * interviewRate);
  const offers = Math.round(interviews * offerRate);
  const onboarded = Math.round(offers * onboardRate);
  const productive = Math.round(onboarded * productiveRate);

  const stages: RecruitingFunnelStage[] = [
    { stage: 'Identify', count: identifyCount, conversionRate: 1, dropoff: 0, costPerUnit: costPerIdentify, totalCost: identifyCount * costPerIdentify },
    { stage: 'Outreach', count: outreach, conversionRate: outreachRate, dropoff: identifyCount - outreach, costPerUnit: costPerOutreach, totalCost: outreach * costPerOutreach },
    { stage: 'Interview', count: interviews, conversionRate: interviewRate, dropoff: outreach - interviews, costPerUnit: costPerInterview, totalCost: interviews * costPerInterview },
    { stage: 'Offer', count: offers, conversionRate: offerRate, dropoff: interviews - offers, costPerUnit: costPerOffer, totalCost: offers * costPerOffer },
    { stage: 'Onboard', count: onboarded, conversionRate: onboardRate, dropoff: offers - onboarded, costPerUnit: costPerOnboard, totalCost: onboarded * costPerOnboard },
    { stage: 'Productive', count: productive, conversionRate: productiveRate, dropoff: onboarded - productive, costPerUnit: 0, totalCost: 0 },
  ];

  const totalCost = stages.reduce((s, st) => s + st.totalCost, 0);
  const totalCAC = productive > 0 ? Math.round(totalCost / productive) : 0;
  const overallConversionRate = identifyCount > 0 ? productive / identifyCount : 0;
  const annualOverrideRevenue = Math.round(productive * avgFYCPerHire * overrideRate);
  const estimatedLTV = Math.round(avgFYCPerHire * overrideRate * retentionYears);
  const ltvCacRatio = totalCAC > 0 ? estimatedLTV / totalCAC : 0;
  const monthlyOverride = annualOverrideRevenue / 12;
  const breakEvenMonths = monthlyOverride > 0 ? Math.ceil(totalCost / monthlyOverride) : 999;

  const recommendations: string[] = [];
  if (outreachRate < 0.50) recommendations.push('Low identify→outreach rate. Improve prospect qualification criteria to reduce wasted outreach effort.');
  if (interviewRate < 0.30) recommendations.push('Low outreach→interview rate. Strengthen your value proposition and follow-up cadence.');
  if (offerRate < 0.40) recommendations.push('Low interview→offer rate. Review interview process — consider structured interviews and clearer career path presentations.');
  if (onboardRate < 0.65) recommendations.push('Low offer→onboard rate. Competitive compensation analysis needed. Consider signing bonuses or enhanced training programs.');
  if (productiveRate < 0.60) recommendations.push('Low onboard→productive rate. Strengthen onboarding program — assign mentors, provide structured 90-day plans.');
  if (totalCAC > 10000) recommendations.push('High CAC ($10K+). Focus on lower-cost channels: referrals, campus recruiting, and inbound marketing.');
  if (ltvCacRatio < 3) recommendations.push('LTV:CAC below 3:1. Improve retention programs or reduce acquisition costs to achieve sustainable unit economics.');
  if (recommendations.length === 0) recommendations.push('Strong recruiting funnel metrics. Focus on scaling volume while maintaining conversion quality.');

  const benchmarks = [
    { metric: 'Overall Conversion', yours: Math.round(overallConversionRate * 100), industryAvg: Math.round(RECRUITING_BENCHMARKS.identifyToOutreach * RECRUITING_BENCHMARKS.outreachToInterview * RECRUITING_BENCHMARKS.interviewToOffer * RECRUITING_BENCHMARKS.offerToOnboard * RECRUITING_BENCHMARKS.onboardToProductive * 100), topQuartile: Math.round(RECRUITING_BENCHMARKS.topQuartileConversion * 100), status: overallConversionRate >= RECRUITING_BENCHMARKS.topQuartileConversion ? 'above' as const : overallConversionRate >= 0.04 ? 'at' as const : 'below' as const },
    { metric: 'CAC ($)', yours: totalCAC, industryAvg: RECRUITING_BENCHMARKS.avgCAC, topQuartile: RECRUITING_BENCHMARKS.topQuartileCAC, status: totalCAC <= RECRUITING_BENCHMARKS.topQuartileCAC ? 'above' as const : totalCAC <= RECRUITING_BENCHMARKS.avgCAC ? 'at' as const : 'below' as const },
    { metric: 'Time to Productivity (mo)', yours: rampMonths, industryAvg: RECRUITING_BENCHMARKS.avgTimeToProductivity, topQuartile: 4, status: rampMonths <= 4 ? 'above' as const : rampMonths <= 6 ? 'at' as const : 'below' as const },
    { metric: 'LTV per Hire ($)', yours: estimatedLTV, industryAvg: RECRUITING_BENCHMARKS.avgLTV, topQuartile: RECRUITING_BENCHMARKS.topQuartileLTV, status: estimatedLTV >= RECRUITING_BENCHMARKS.topQuartileLTV ? 'above' as const : estimatedLTV >= RECRUITING_BENCHMARKS.avgLTV ? 'at' as const : 'below' as const },
    { metric: 'LTV:CAC Ratio', yours: Math.round(ltvCacRatio * 10) / 10, industryAvg: 5, topQuartile: 10, status: ltvCacRatio >= 10 ? 'above' as const : ltvCacRatio >= 5 ? 'at' as const : 'below' as const },
  ];

  return {
    stages,
    totalPipelineCount: identifyCount,
    overallConversionRate,
    timeToProductivity: rampMonths,
    totalCAC,
    estimatedLTV,
    ltvCacRatio,
    annualOverrideRevenue,
    breakEvenMonths,
    recommendations,
    benchmarks,
  };
}

/* ═══════════════════════════════════════════════════════════════
   P&L / Business Economics Strategy Engine
   Revenue → COGS → Gross Margin → OpEx → EBITDA → Tax → Net Income
   with channel attribution and break-even analysis
   ═══════════════════════════════════════════════════════════════ */

export interface PnLChannelLine {
  channel: string;
  revenue: number;
  cogsPct: number;
  cogs: number;
  grossMargin: number;
  gmPct: number;
}

export interface PnLBusinessResult {
  channels: PnLChannelLine[];
  totalRevenue: number;
  totalCOGS: number;
  grossProfit: number;
  grossMarginPct: number;
  opExBreakdown: { category: string; amount: number; pct: number }[];
  totalOpEx: number;
  ebitda: number;
  ebitdaMarginPct: number;
  interestExpense: number;
  depAmort: number;
  ebt: number;
  estimatedTax: number;
  effectiveTaxRate: number;
  netIncome: number;
  netMarginPct: number;
  breakEvenRevenue: number;
  breakEvenMonthlyGDC: number;
  marginOptLevers: { lever: string; impact: number; description: string }[];
  recommendations: string[];
}

export function calcPnLBusinessEconomics(
  gdcRevenue: number,
  aumRevenue: number,
  affiliateRevenue: number,
  overrideRevenue: number,
  channelRevenue: number,
  gdcCogsPct: number,
  aumCogsPct: number,
  affiliateCogsPct: number,
  overrideCogsPct: number,
  channelCogsPct: number,
  staffCost: number,
  officeCost: number,
  techCost: number,
  marketingCost: number,
  insuranceCost: number,
  otherOpEx: number,
  interestExpense: number,
  depAmort: number,
  taxRate: number,
): PnLBusinessResult {
  const channels: PnLChannelLine[] = [
    { channel: 'Insurance GDC', revenue: gdcRevenue, cogsPct: gdcCogsPct, cogs: Math.round(gdcRevenue * gdcCogsPct / 100), grossMargin: 0, gmPct: 0 },
    { channel: 'AUM/Advisory', revenue: aumRevenue, cogsPct: aumCogsPct, cogs: Math.round(aumRevenue * aumCogsPct / 100), grossMargin: 0, gmPct: 0 },
    { channel: 'Affiliate', revenue: affiliateRevenue, cogsPct: affiliateCogsPct, cogs: Math.round(affiliateRevenue * affiliateCogsPct / 100), grossMargin: 0, gmPct: 0 },
    { channel: 'Override', revenue: overrideRevenue, cogsPct: overrideCogsPct, cogs: Math.round(overrideRevenue * overrideCogsPct / 100), grossMargin: 0, gmPct: 0 },
    { channel: 'Marketing/Channel', revenue: channelRevenue, cogsPct: channelCogsPct, cogs: Math.round(channelRevenue * channelCogsPct / 100), grossMargin: 0, gmPct: 0 },
  ].map(c => ({
    ...c,
    grossMargin: c.revenue - c.cogs,
    gmPct: c.revenue > 0 ? Math.round((c.revenue - c.cogs) / c.revenue * 100) : 0,
  }));

  const totalRevenue = channels.reduce((s, c) => s + c.revenue, 0);
  const totalCOGS = channels.reduce((s, c) => s + c.cogs, 0);
  const grossProfit = totalRevenue - totalCOGS;
  const grossMarginPct = totalRevenue > 0 ? Math.round(grossProfit / totalRevenue * 100) : 0;

  const opExBreakdown = [
    { category: 'Staff/Payroll', amount: staffCost, pct: 0 },
    { category: 'Office/Rent', amount: officeCost, pct: 0 },
    { category: 'Technology', amount: techCost, pct: 0 },
    { category: 'Marketing', amount: marketingCost, pct: 0 },
    { category: 'Insurance/E&O', amount: insuranceCost, pct: 0 },
    { category: 'Other', amount: otherOpEx, pct: 0 },
  ].map(o => ({ ...o, pct: totalRevenue > 0 ? Math.round(o.amount / totalRevenue * 100) : 0 }));

  const totalOpEx = opExBreakdown.reduce((s, o) => s + o.amount, 0);
  const ebitda = grossProfit - totalOpEx;
  const ebitdaMarginPct = totalRevenue > 0 ? Math.round(ebitda / totalRevenue * 100) : 0;
  const ebt = ebitda - interestExpense - depAmort;
  const estimatedTax = Math.round(Math.max(0, ebt) * taxRate / 100);
  const effectiveTaxRate = ebt > 0 ? Math.round(estimatedTax / ebt * 100) : 0;
  const netIncome = ebt - estimatedTax;
  const netMarginPct = totalRevenue > 0 ? Math.round(netIncome / totalRevenue * 100) : 0;

  // Break-even: fixed costs / (1 - variable cost ratio)
  const variableCostRatio = totalRevenue > 0 ? totalCOGS / totalRevenue : 0.35;
  const fixedCosts = totalOpEx + interestExpense + depAmort;
  const breakEvenRevenue = variableCostRatio < 1 ? Math.round(fixedCosts / (1 - variableCostRatio)) : 0;
  const breakEvenMonthlyGDC = Math.round(breakEvenRevenue / 12);

  // Margin optimization levers
  const marginOptLevers = [
    { lever: 'Reduce COGS by 5%', impact: Math.round(totalCOGS * 0.05), description: 'Negotiate better payout splits or reduce direct costs' },
    { lever: 'Cut OpEx by 10%', impact: Math.round(totalOpEx * 0.10), description: 'Streamline operations, automate admin, reduce overhead' },
    { lever: 'Grow Revenue by 15%', impact: Math.round(totalRevenue * 0.15 * (1 - variableCostRatio)), description: 'Incremental revenue flows at gross margin rate to bottom line' },
    { lever: 'Shift 10% to AUM', impact: Math.round(totalRevenue * 0.10 * 0.20), description: 'AUM has higher margins (~75%) vs insurance GDC (~65%)' },
    { lever: 'Add 2 Producers', impact: Math.round(2 * 150000 * 0.15), description: 'Each producer at $150K GDC generates ~$22.5K override income' },
  ];

  const recommendations: string[] = [];
  if (grossMarginPct < 50) recommendations.push('Gross margin below 50% — review payout structures and COGS allocation. Industry benchmark: 55-65%.');
  if (ebitdaMarginPct < 15) recommendations.push('EBITDA margin below 15% — focus on operational efficiency. Top practices achieve 25-35%.');
  if (netMarginPct < 10) recommendations.push('Net margin below 10% — review tax strategy and consider entity restructuring (S-Corp, LLC).');
  if (staffCost > totalRevenue * 0.30) recommendations.push('Staff costs exceed 30% of revenue — evaluate team productivity and consider performance-based compensation.');
  if (totalRevenue > 0 && breakEvenRevenue / totalRevenue > 0.80) recommendations.push('Break-even point is 80%+ of current revenue — thin margin of safety. Reduce fixed costs or diversify revenue.');
  if (recommendations.length === 0) recommendations.push('Strong P&L fundamentals. Focus on scaling revenue while maintaining margin discipline.');

  return {
    channels, totalRevenue, totalCOGS, grossProfit, grossMarginPct,
    opExBreakdown, totalOpEx, ebitda, ebitdaMarginPct,
    interestExpense, depAmort, ebt, estimatedTax, effectiveTaxRate,
    netIncome, netMarginPct, breakEvenRevenue, breakEvenMonthlyGDC,
    marginOptLevers, recommendations,
  };
}

/* ═══════════════════════════════════════════════════════════════
   GDC / Override Optimization Engine
   Bracket visualization, override rate optimization, team production targets
   ═══════════════════════════════════════════════════════════════ */

export interface GDCBracketViz {
  label: string;
  min: number;
  max: number;
  rate: number;
  isCurrentBracket: boolean;
  fillPct: number; // how much of this bracket is filled (0-100)
  incomeAtBracket: number; // income if you hit the top of this bracket
}

export interface OverrideOptResult {
  currentGDC: number;
  currentBracket: { label: string; rate: number };
  currentPayout: number;
  nextBracket: { label: string; rate: number; gapToNext: number } | null;
  bracketLiftIncome: number; // additional income from hitting next bracket
  brackets: GDCBracketViz[];
  teamProduction: {
    memberName: string;
    gdcProduction: number;
    overrideRate: number;
    overrideIncome: number;
    bracketContribution: number;
  }[];
  totalTeamGDC: number;
  totalOverrideIncome: number;
  blendedOverrideRate: number;
  optimizationScenarios: {
    scenario: string;
    additionalGDC: number;
    newBracket: string;
    newRate: number;
    additionalIncome: number;
    roi: string;
  }[];
  recommendations: string[];
}

// GDC brackets matching practiceEngine.ts
const GDC_BRACKETS_LOCAL = [
  { mn: 0, mx: 64999, r: 0.55, l: '<$65K' },
  { mn: 65000, mx: 94999, r: 0.65, l: '$65–95K' },
  { mn: 95000, mx: 149999, r: 0.70, l: '$95–150K' },
  { mn: 150000, mx: 199999, r: 0.75, l: '$150–200K' },
  { mn: 200000, mx: 239999, r: 0.80, l: '$200–240K' },
  { mn: 240000, mx: 274999, r: 0.825, l: '$240–275K' },
  { mn: 275000, mx: 299999, r: 0.84, l: '$275–300K' },
  { mn: 300000, mx: 9000000, r: 0.85, l: '$300K+' },
];

function getLocalBracket(gdc: number) {
  for (const b of GDC_BRACKETS_LOCAL) {
    if (gdc >= b.mn && gdc <= b.mx) return b;
  }
  return GDC_BRACKETS_LOCAL[GDC_BRACKETS_LOCAL.length - 1];
}

export function calcGDCOverrideOpt(
  personalGDC: number,
  teamMembers: { name: string; gdcProduction: number; overrideRate: number }[],
  targetGDC?: number,
): OverrideOptResult {
  const currentBracketObj = getLocalBracket(personalGDC);
  const currentIdx = GDC_BRACKETS_LOCAL.indexOf(currentBracketObj);
  const nextBracketObj = currentIdx < GDC_BRACKETS_LOCAL.length - 1 ? GDC_BRACKETS_LOCAL[currentIdx + 1] : null;
  const currentPayout = Math.round(personalGDC * currentBracketObj.r);
  const gapToNext = nextBracketObj ? Math.max(0, nextBracketObj.mn - personalGDC) : 0;
  const bracketLiftIncome = nextBracketObj ? Math.round(personalGDC * (nextBracketObj.r - currentBracketObj.r)) : 0;

  const brackets: GDCBracketViz[] = GDC_BRACKETS_LOCAL.map(b => {
    const isCurrentBracket = personalGDC >= b.mn && personalGDC <= b.mx;
    const fillPct = personalGDC >= b.mx ? 100 : personalGDC >= b.mn ? Math.round((personalGDC - b.mn) / (b.mx - b.mn + 1) * 100) : 0;
    const incomeAtBracket = Math.round(b.mx * b.r);
    return { label: b.l, min: b.mn, max: b.mx, rate: b.r, isCurrentBracket, fillPct, incomeAtBracket };
  });

  const teamProduction = teamMembers.map(m => ({
    memberName: m.name,
    gdcProduction: m.gdcProduction,
    overrideRate: m.overrideRate,
    overrideIncome: Math.round(m.gdcProduction * m.overrideRate / 100),
    bracketContribution: m.gdcProduction, // each member's production contributes to team GDC
  }));

  const totalTeamGDC = teamProduction.reduce((s, m) => s + m.gdcProduction, 0);
  const totalOverrideIncome = teamProduction.reduce((s, m) => s + m.overrideIncome, 0);
  const blendedOverrideRate = totalTeamGDC > 0 ? totalOverrideIncome / totalTeamGDC * 100 : 0;

  // Optimization scenarios
  const scenarios: OverrideOptResult['optimizationScenarios'] = [];
  if (nextBracketObj) {
    scenarios.push({
      scenario: `Reach ${nextBracketObj.l} bracket`,
      additionalGDC: gapToNext,
      newBracket: nextBracketObj.l,
      newRate: nextBracketObj.r,
      additionalIncome: bracketLiftIncome,
      roi: `${Math.round(bracketLiftIncome / Math.max(1, gapToNext) * 100)}% lift`,
    });
  }
  // Add 1 producer scenario
  scenarios.push({
    scenario: 'Add 1 producer ($150K GDC)',
    additionalGDC: 150000,
    newBracket: getLocalBracket(personalGDC + 150000).l,
    newRate: getLocalBracket(personalGDC + 150000).r,
    additionalIncome: Math.round(150000 * (blendedOverrideRate / 100 || 0.10)),
    roi: `${Math.round(150000 * (blendedOverrideRate / 100 || 0.10) / 8500 * 100)}% ROI on CAC`,
  });
  // Increase avg production 20%
  const boostedGDC = Math.round(personalGDC * 1.20);
  scenarios.push({
    scenario: 'Increase personal GDC 20%',
    additionalGDC: boostedGDC - personalGDC,
    newBracket: getLocalBracket(boostedGDC).l,
    newRate: getLocalBracket(boostedGDC).r,
    additionalIncome: Math.round(boostedGDC * getLocalBracket(boostedGDC).r - personalGDC * currentBracketObj.r),
    roi: 'Organic growth — no additional cost',
  });
  // Target scenario
  if (targetGDC && targetGDC > personalGDC) {
    const targetBracket = getLocalBracket(targetGDC);
    scenarios.push({
      scenario: `Reach target $${Math.round(targetGDC / 1000)}K`,
      additionalGDC: targetGDC - personalGDC,
      newBracket: targetBracket.l,
      newRate: targetBracket.r,
      additionalIncome: Math.round(targetGDC * targetBracket.r - personalGDC * currentBracketObj.r),
      roi: `${Math.round((targetGDC * targetBracket.r - personalGDC * currentBracketObj.r) / Math.max(1, targetGDC - personalGDC) * 100)}% effective rate on increment`,
    });
  }

  const recommendations: string[] = [];
  if (gapToNext > 0 && gapToNext < personalGDC * 0.15) {
    recommendations.push(`Only ${gapToNext.toLocaleString()} away from next bracket — a ${Math.round(gapToNext / personalGDC * 100)}% increase would unlock ${bracketLiftIncome.toLocaleString()} additional income.`);
  }
  if (blendedOverrideRate < 8) recommendations.push('Blended override rate below 8%. Negotiate higher override splits or focus on higher-producing team members.');
  if (teamMembers.length < 3 && personalGDC > 200000) recommendations.push('Small team relative to production. Adding producers creates leverage through override income.');
  if (totalOverrideIncome > personalGDC * currentBracketObj.r * 0.50) recommendations.push('Override income exceeds 50% of personal payout — strong team leverage. Focus on retention and team development.');
  if (recommendations.length === 0) recommendations.push('Solid GDC and override structure. Focus on bracket advancement and team scaling for maximum leverage.');

  return {
    currentGDC: personalGDC,
    currentBracket: { label: currentBracketObj.l, rate: currentBracketObj.r },
    currentPayout,
    nextBracket: nextBracketObj ? { label: nextBracketObj.l, rate: nextBracketObj.r, gapToNext } : null,
    bracketLiftIncome,
    brackets,
    teamProduction,
    totalTeamGDC,
    totalOverrideIncome,
    blendedOverrideRate: Math.round(blendedOverrideRate * 10) / 10,
    optimizationScenarios: scenarios,
    recommendations,
  };
}
