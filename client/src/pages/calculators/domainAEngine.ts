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
