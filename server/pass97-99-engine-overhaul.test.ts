/* ═══════════════════════════════════════════════════════════════
   Pass 97-99 Vitest — Engine Overhaul Tests
   AUM Override, Flexible Affiliate, Progressive Disclosure,
   Client-Practice Cross-Cascade, Cascade Chain, Planning Horizon
   ═══════════════════════════════════════════════════════════════ */

import { describe, it, expect } from 'vitest';
import {
  calcUnifiedIncomePlan,
  calcProducerAffiliateIncome,
  AUM_OVERRIDE_DEFAULTS,
  PRODUCER_DEFAULTS,
  isSectionVisible,
  calcClientPracticeOpportunity,
  buildCascadeChain,
  calcPlanningHorizon,
  ROLE_DEFAULTS,
  type EnabledChannels,
  type IncomeSplits,
  type ComplexityLevel,
  type ClientPracticeInputs,
} from '../client/src/pages/calculators/practiceEngine';

/* ─── Shared test fixtures ─── */
const baseSplits: IncomeSplits = { gdc: 40, aum: 25, affiliate: 15, override: 10, channel: 10 };
const allEnabled: EnabledChannels = { gdc: true, aum: true, affiliate: true, override: true, channel: true };

const baseParams = {
  targetIncome: 200000,
  splits: baseSplits,
  role: 'new' as const,
  enabledChannels: allEnabled,
  targetGDC: 80000,
  wbPct: 80,
  bracketOverride: 'auto',
  avgGDC: 2500,
  funnelRates: { ap: 10, sh: 50, cl: 40, pl: 70 },
  months: 10,
  aumExisting: 5000000,
  aumNew: 500000,
  aumTrailPct: 1.0,
  aumOverrideRate: 90,
  affiliateMode: 'recruiter' as const,
  affCounts: { a: 2, b: 3, c: 5, d: 10 },
  affAvgProd: { a: 100000, b: 50000, c: 25000, d: 10000 },
  producerInputs: PRODUCER_DEFAULTS,
  teamSize: 5,
  teamAvgGDC: 50000,
  overrideRate: 8,
  channelSpend: { sem: 500, social: 300, content: 200, email: 100, events: 400, referral: 0, direct: 0 },
};

/* ═══════════════════════════════════════════════════════════════
   PASS 97: AUM Override Rate
   ═══════════════════════════════════════════════════════════════ */

describe('Pass 97: AUM Override Rate', () => {
  it('should apply aumOverrideRate to AUM income calculation', () => {
    const plan90 = calcUnifiedIncomePlan({ ...baseParams, aumOverrideRate: 90 });
    const plan100 = calcUnifiedIncomePlan({ ...baseParams, aumOverrideRate: 100 });
    // 100% override should yield higher AUM income than 90%
    expect(plan100.channels.aum.detail.projectedIncome).toBeGreaterThanOrEqual(
      plan90.channels.aum.detail.projectedIncome
    );
  });

  it('should have AUM_OVERRIDE_DEFAULTS for all roles', () => {
    expect(AUM_OVERRIDE_DEFAULTS).toBeDefined();
    expect(AUM_OVERRIDE_DEFAULTS.new).toBeDefined();
    expect(AUM_OVERRIDE_DEFAULTS.new).toBeGreaterThan(0);
    expect(AUM_OVERRIDE_DEFAULTS.new).toBeLessThanOrEqual(100);
  });

  it('should handle 0% override rate (no AUM income)', () => {
    const plan = calcUnifiedIncomePlan({ ...baseParams, aumOverrideRate: 0 });
    expect(plan.channels.aum.detail.projectedIncome).toBe(0);
  });

  it('should handle 100% override rate (full AUM income)', () => {
    const plan = calcUnifiedIncomePlan({ ...baseParams, aumOverrideRate: 100 });
    expect(plan.channels.aum.detail.projectedIncome).toBeGreaterThan(0);
  });
});

/* ═══════════════════════════════════════════════════════════════
   PASS 97: Flexible Affiliate Income Modes
   ═══════════════════════════════════════════════════════════════ */

describe('Pass 97: Flexible Affiliate Income — Recruiter Mode', () => {
  it('should calculate recruiter mode using affCounts and affAvgProd', () => {
    const plan = calcUnifiedIncomePlan({ ...baseParams, affiliateMode: 'recruiter' });
    expect(plan.channels.affiliate.totalProjected).toBeGreaterThan(0);
  });

  it('should increase with more affiliates', () => {
    const planFew = calcUnifiedIncomePlan({
      ...baseParams, affiliateMode: 'recruiter',
      affCounts: { a: 1, b: 1, c: 1, d: 1 },
    });
    const planMany = calcUnifiedIncomePlan({
      ...baseParams, affiliateMode: 'recruiter',
      affCounts: { a: 5, b: 10, c: 15, d: 20 },
    });
    expect(planMany.channels.affiliate.totalProjected).toBeGreaterThan(
      planFew.channels.affiliate.totalProjected
    );
  });
});

describe('Pass 97: Flexible Affiliate Income — Producer Mode', () => {
  it('should calculate producer mode from deals, commission, split, bonus', () => {
    const result = calcProducerAffiliateIncome({
      dealsPerMonth: 3,
      avgCommissionPerDeal: 5000,
      splitPct: 60,
      fixedBonusPerDeal: 500,
      monthlyRetainer: 1000,
    });
    // 3 deals * ($5000 * 60% + $500) + $1000 = 3 * ($3000 + $500) + $1000 = $10,500 + $1000 = $11,500/mo
    expect(result.monthlyIncome).toBe(11500);
    expect(result.annualIncome).toBe(138000);
    expect(result.commissionIncome).toBe(108000); // 3 * 5000 * 0.6 * 12
    expect(result.bonusIncome).toBe(18000); // 3 * 500 * 12
    expect(result.retainerIncome).toBe(12000); // 1000 * 12
  });

  it('should handle zero deals gracefully', () => {
    const result = calcProducerAffiliateIncome({
      dealsPerMonth: 0,
      avgCommissionPerDeal: 5000,
      splitPct: 60,
      fixedBonusPerDeal: 500,
      monthlyRetainer: 1000,
    });
    expect(result.monthlyIncome).toBe(1000); // only retainer
    expect(result.annualIncome).toBe(12000);
  });

  it('should use producer mode in unified plan when affiliateMode is producer', () => {
    const plan = calcUnifiedIncomePlan({
      ...baseParams,
      affiliateMode: 'producer',
      producerInputs: { dealsPerMonth: 4, avgCommissionPerDeal: 4000, splitPct: 50, fixedBonusPerDeal: 300, monthlyRetainer: 500 },
    });
    expect(plan.channels.affiliate.totalProjected).toBeGreaterThan(0);
  });

  it('should have PRODUCER_DEFAULTS with reasonable values', () => {
    expect(PRODUCER_DEFAULTS.dealsPerMonth).toBeGreaterThan(0);
    expect(PRODUCER_DEFAULTS.avgCommissionPerDeal).toBeGreaterThan(0);
    expect(PRODUCER_DEFAULTS.splitPct).toBeGreaterThan(0);
    expect(PRODUCER_DEFAULTS.splitPct).toBeLessThanOrEqual(100);
  });
});

/* ═══════════════════════════════════════════════════════════════
   PASS 97: Progressive Disclosure
   ═══════════════════════════════════════════════════════════════ */

describe('Pass 97: Progressive Disclosure — isSectionVisible', () => {
  it('should show target section at all complexity levels', () => {
    expect(isSectionVisible('target', 'simple')).toBe(true);
    expect(isSectionVisible('target', 'detailed')).toBe(true);
    expect(isSectionVisible('target', 'expert')).toBe(true);
  });

  it('should hide splits at simple level', () => {
    expect(isSectionVisible('splits-sliders', 'simple')).toBe(false);
    expect(isSectionVisible('splits-sliders', 'detailed')).toBe(true);
    expect(isSectionVisible('splits-sliders', 'expert')).toBe(true);
  });

  it('should hide sensitivity at simple and detailed levels', () => {
    expect(isSectionVisible('sensitivity', 'simple')).toBe(false);
    expect(isSectionVisible('sensitivity', 'detailed')).toBe(false);
    expect(isSectionVisible('sensitivity', 'expert')).toBe(true);
  });

  it('should show roll-up-table at detailed and expert levels', () => {
    expect(isSectionVisible('roll-up-table', 'simple')).toBe(false);
    expect(isSectionVisible('roll-up-table', 'detailed')).toBe(true);
    expect(isSectionVisible('roll-up-table', 'expert')).toBe(true);
  });

  it('should show scenarios only at expert level', () => {
    expect(isSectionVisible('scenarios', 'simple')).toBe(false);
    expect(isSectionVisible('scenarios', 'detailed')).toBe(false);
    expect(isSectionVisible('scenarios', 'expert')).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════
   PASS 98: Client-Practice Cross-Cascade
   ═══════════════════════════════════════════════════════════════ */

describe('Pass 98: Client-Practice Cross-Cascade', () => {
  const clientInputs: ClientPracticeInputs = {
    clientIncome: 250000,
    clientNetWorth: 2000000,
    clientSavings: 500000,
    clientRetirement401k: 800000,
    clientAge: 45,
    clientDep: 2,
    clientMortgage: 400000,
    clientDebt: 50000,
    clientExistingInsurance: 500000,
    clientIsBiz: false,
    clientBizRevenue: 0,
    clientBizEmployees: 0,
    clientRiskTolerance: 'moderate',
  };

  it('should calculate AUM opportunity from investable assets', () => {
    const opp = calcClientPracticeOpportunity(clientInputs);
    expect(opp.aumOpportunity).toBeGreaterThan(0);
    // savings + 401k + (nw - mortgage - debt) * 0.3
    const expected = 500000 + 800000 + Math.max(0, (2000000 - 400000 - 50000) * 0.3);
    expect(opp.aumOpportunity).toBe(expected);
  });

  it('should calculate advisory fee at 1%', () => {
    const opp = calcClientPracticeOpportunity(clientInputs);
    expect(opp.advisoryFeeAnnual).toBe(Math.round(opp.aumOpportunity * 0.01));
  });

  it('should calculate insurance gap using DIME method', () => {
    const opp = calcClientPracticeOpportunity(clientInputs);
    const totalNeed = 250000 * 10 + 400000 + 50000 + 2 * 50000;
    const gap = Math.max(0, totalNeed - 500000);
    expect(opp.insuranceGap).toBe(gap);
  });

  it('should calculate insurance GDC from gap', () => {
    const opp = calcClientPracticeOpportunity(clientInputs);
    expect(opp.insuranceGDC).toBeGreaterThan(0);
  });

  it('should calculate client LTV over 10-year horizon', () => {
    const opp = calcClientPracticeOpportunity(clientInputs);
    expect(opp.clientLTV).toBeGreaterThan(opp.totalFirstYearGDC);
  });

  it('should recommend channels based on client profile', () => {
    const opp = calcClientPracticeOpportunity(clientInputs);
    expect(opp.recommendedChannels).toContain('gdc'); // has insurance gap
    expect(opp.recommendedChannels).toContain('aum'); // has investable assets > 100k
  });

  it('should score opportunity 0-100', () => {
    const opp = calcClientPracticeOpportunity(clientInputs);
    expect(opp.opportunityScore).toBeGreaterThanOrEqual(0);
    expect(opp.opportunityScore).toBeLessThanOrEqual(100);
  });

  it('should add business insurance GDC for business clients', () => {
    const bizClient: ClientPracticeInputs = {
      ...clientInputs,
      clientIsBiz: true,
      clientBizRevenue: 1000000,
      clientBizEmployees: 10,
    };
    const opp = calcClientPracticeOpportunity(bizClient);
    expect(opp.bizInsuranceGDC).toBeGreaterThan(0);
    expect(opp.recommendedChannels).toContain('override');
    expect(opp.recommendedChannels).toContain('channel');
  });

  it('should have higher opportunity score for high-income business clients', () => {
    const basicClient = calcClientPracticeOpportunity({
      ...clientInputs, clientIncome: 50000, clientNetWorth: 100000, clientSavings: 10000, clientRetirement401k: 5000,
    });
    const richClient = calcClientPracticeOpportunity(clientInputs);
    expect(richClient.opportunityScore).toBeGreaterThan(basicClient.opportunityScore);
  });
});

/* ═══════════════════════════════════════════════════════════════
   PASS 98: Cascade Chain Visualization
   ═══════════════════════════════════════════════════════════════ */

describe('Pass 98: Cascade Chain Visualization', () => {
  it('should build chain with root target node', () => {
    const plan = calcUnifiedIncomePlan(baseParams);
    const chain = buildCascadeChain(plan, allEnabled, baseSplits, 200000);
    const root = chain.nodes.find(n => n.id === 'target');
    expect(root).toBeDefined();
    expect(root!.value).toBe(200000);
    expect(root!.level).toBe(0);
    expect(root!.type).toBe('target');
  });

  it('should have channel nodes for each enabled channel', () => {
    const plan = calcUnifiedIncomePlan(baseParams);
    const chain = buildCascadeChain(plan, allEnabled, baseSplits, 200000);
    const channelNodes = chain.nodes.filter(n => n.level === 1);
    expect(channelNodes.length).toBe(5); // all 5 channels enabled
  });

  it('should have edges from target to each channel with split %', () => {
    const plan = calcUnifiedIncomePlan(baseParams);
    const chain = buildCascadeChain(plan, allEnabled, baseSplits, 200000);
    const downEdges = chain.edges.filter(e => e.from === 'target' && e.direction === 'down');
    expect(downEdges.length).toBe(5);
    const gdcEdge = downEdges.find(e => e.to === 'ch_gdc');
    expect(gdcEdge).toBeDefined();
    expect(gdcEdge!.label).toBe('40%');
  });

  it('should have total projected output node', () => {
    const plan = calcUnifiedIncomePlan(baseParams);
    const chain = buildCascadeChain(plan, allEnabled, baseSplits, 200000);
    const totalNode = chain.nodes.find(n => n.id === 'totalProjected');
    expect(totalNode).toBeDefined();
    expect(totalNode!.value).toBe(plan.totalProjected);
  });

  it('should exclude disabled channels', () => {
    const plan = calcUnifiedIncomePlan({ ...baseParams, enabledChannels: { ...allEnabled, channel: false } });
    const chain = buildCascadeChain(plan, { ...allEnabled, channel: false }, baseSplits, 200000);
    const channelNodes = chain.nodes.filter(n => n.level === 1);
    expect(channelNodes.length).toBe(4); // channel disabled
    expect(channelNodes.find(n => n.id === 'ch_channel')).toBeUndefined();
  });
});

/* ═══════════════════════════════════════════════════════════════
   PASS 98: Interactive Planning Horizon
   ═══════════════════════════════════════════════════════════════ */

describe('Pass 98: Planning Horizon', () => {
  it('should generate 36 monthly points by default', () => {
    const plan = calcUnifiedIncomePlan(baseParams);
    const horizon = calcPlanningHorizon(plan, 200000, allEnabled, 36, 'new');
    expect(horizon.length).toBe(36);
  });

  it('should have cumulative income increasing over time', () => {
    const plan = calcUnifiedIncomePlan(baseParams);
    const horizon = calcPlanningHorizon(plan, 200000, allEnabled, 36, 'new');
    for (let i = 1; i < horizon.length; i++) {
      expect(horizon[i].cumulativeIncome).toBeGreaterThanOrEqual(horizon[i - 1].cumulativeIncome);
    }
  });

  it('should have cumulative target increasing linearly', () => {
    const plan = calcUnifiedIncomePlan(baseParams);
    const horizon = calcPlanningHorizon(plan, 200000, allEnabled, 36, 'new');
    const monthlyTarget = 200000 / 12;
    for (let i = 0; i < horizon.length; i++) {
      expect(horizon[i].cumulativeTarget).toBeCloseTo(monthlyTarget * (i + 1), -1);
    }
  });

  it('should include milestones at Q1, mid-year, year 1, year 2, year 3', () => {
    const plan = calcUnifiedIncomePlan(baseParams);
    const horizon = calcPlanningHorizon(plan, 200000, allEnabled, 36, 'new');
    const milestones = horizon.filter(p => p.milestone !== null).map(p => p.milestone);
    expect(milestones).toContain('Q1 Review');
    expect(milestones).toContain('Mid-Year');
    expect(milestones).toContain('Year 1');
    expect(milestones).toContain('Year 2');
    expect(milestones).toContain('Year 3');
  });

  it('should track on-track status (within 90% of target)', () => {
    const plan = calcUnifiedIncomePlan(baseParams);
    const horizon = calcPlanningHorizon(plan, 200000, allEnabled, 36, 'new');
    horizon.forEach(pt => {
      if (pt.cumulativeIncome >= pt.cumulativeTarget * 0.9) {
        expect(pt.onTrack).toBe(true);
      } else {
        expect(pt.onTrack).toBe(false);
      }
    });
  });

  it('should break down income by channel per month', () => {
    const plan = calcUnifiedIncomePlan(baseParams);
    const horizon = calcPlanningHorizon(plan, 200000, allEnabled, 36, 'new');
    const pt = horizon[11]; // Month 12
    const monthTotal = pt.gdc + pt.aum + pt.affiliate + pt.override + pt.channel;
    expect(monthTotal).toBeGreaterThan(0);
  });

  it('should apply ramp curves based on role', () => {
    const plan = calcUnifiedIncomePlan(baseParams);
    const horizonNew = calcPlanningHorizon(plan, 200000, allEnabled, 12, 'new');
    const horizonSenior = calcPlanningHorizon(plan, 200000, allEnabled, 12, 'senior');
    // Senior should ramp faster than new
    expect(horizonSenior[0].gdc).toBeGreaterThanOrEqual(horizonNew[0].gdc);
  });

  it('should handle custom horizon length', () => {
    const plan = calcUnifiedIncomePlan(baseParams);
    const horizon12 = calcPlanningHorizon(plan, 200000, allEnabled, 12, 'new');
    const horizon60 = calcPlanningHorizon(plan, 200000, allEnabled, 60, 'new');
    expect(horizon12.length).toBe(12);
    expect(horizon60.length).toBe(60);
  });
});
