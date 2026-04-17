/* ═══════════════════════════════════════════════════════════════
   Pass 93 — Full Bidirectional Cascade, CAC/COGS Overrides,
             Scenario Comparison
   ═══════════════════════════════════════════════════════════════ */
import { describe, it, expect } from 'vitest';
import {
  calcUnifiedIncomePlan,
  calcChannelEconomics,
  ROLE_DEFAULTS,
  CHANNEL_BENCHMARKS,
  type EnabledChannels,
  type IncomeSplits,
} from '../client/src/pages/calculators/practiceEngine';

/* Helper to build a full params object with reasonable defaults */
function makeParams(overrides: Record<string, any> = {}) {
  return {
    targetIncome: 200000,
    splits: { gdc: 40, aum: 25, affiliate: 15, override: 10, channel: 10 } as IncomeSplits,
    enabledChannels: { gdc: true, aum: true, affiliate: true, override: true, channel: true } as EnabledChannels,
    role: 'agent' as const,
    targetGDC: 80000,
    wbPct: 50,
    bracketOverride: '',
    avgGDC: 4000,
    funnelRates: { ap: 20, sh: 50, cl: 40, pl: 70 },
    months: 12,
    aumExisting: 2000000,
    aumNew: 500000,
    aumTrailPct: 1.0,
    affCounts: { a: 2, b: 3, c: 2, d: 1 },
    affAvgProd: { a: 80000, b: 50000, c: 30000, d: 15000 },
    teamSize: 5,
    teamAvgGDC: 100000,
    overrideRate: 10,
    channelSpend: {},
    ...overrides,
  };
}

/* ─── Full Forward Cascade ─── */
describe('Full Forward Cascade', () => {
  it('channel targets sum to target income when all enabled', () => {
    const plan = calcUnifiedIncomePlan(makeParams());
    const sumTargets = plan.channels.gdc.target + plan.channels.aum.target +
      plan.channels.affiliate.target + plan.channels.override.target +
      plan.channels.channel.target;
    expect(sumTargets).toBe(200000);
  });

  it('GDC target = targetIncome * gdc split %', () => {
    const plan = calcUnifiedIncomePlan(makeParams());
    expect(plan.channels.gdc.target).toBe(80000); // 40% of 200K
  });

  it('AUM target = targetIncome * aum split %', () => {
    const plan = calcUnifiedIncomePlan(makeParams());
    expect(plan.channels.aum.target).toBe(50000); // 25% of 200K
  });

  it('disabled channels get zero targets', () => {
    const plan = calcUnifiedIncomePlan(makeParams({
      enabledChannels: { gdc: true, aum: true, affiliate: false, override: false, channel: false },
      splits: { gdc: 60, aum: 40, affiliate: 0, override: 0, channel: 0 },
    }));
    expect(plan.channels.affiliate.target).toBe(0);
    expect(plan.channels.override.target).toBe(0);
    expect(plan.channels.channel.target).toBe(0);
  });

  it('totalGap = max(0, targetIncome - totalProjected)', () => {
    const plan = calcUnifiedIncomePlan(makeParams());
    expect(plan.totalGap).toBe(Math.max(0, plan.targetIncome - plan.totalProjected));
  });

  it('doubling target income doubles all channel targets', () => {
    const plan100 = calcUnifiedIncomePlan(makeParams({ targetIncome: 100000 }));
    const plan200 = calcUnifiedIncomePlan(makeParams({ targetIncome: 200000 }));
    expect(plan200.channels.gdc.target).toBe(plan100.channels.gdc.target * 2);
    expect(plan200.channels.aum.target).toBe(plan100.channels.aum.target * 2);
  });
});

/* ─── Backward Cascade ─── */
describe('Backward Cascade', () => {
  it('increasing AUM book increases totalProjected', () => {
    const planSmall = calcUnifiedIncomePlan(makeParams({ aumExisting: 1000000 }));
    const planLarge = calcUnifiedIncomePlan(makeParams({ aumExisting: 5000000 }));
    expect(planLarge.totalProjected).toBeGreaterThan(planSmall.totalProjected);
  });

  it('adding affiliates increases totalProjected', () => {
    const planNoAff = calcUnifiedIncomePlan(makeParams({
      affCounts: { a: 0, b: 0, c: 0, d: 0 },
    }));
    const planWithAff = calcUnifiedIncomePlan(makeParams({
      affCounts: { a: 3, b: 5, c: 3, d: 2 },
    }));
    expect(planWithAff.totalProjected).toBeGreaterThan(planNoAff.totalProjected);
  });

  it('increasing team size increases override projected', () => {
    const planSmallTeam = calcUnifiedIncomePlan(makeParams({ teamSize: 2 }));
    const planLargeTeam = calcUnifiedIncomePlan(makeParams({ teamSize: 10 }));
    expect(planLargeTeam.channels.override.detail.projectedIncome)
      .toBeGreaterThan(planSmallTeam.channels.override.detail.projectedIncome);
  });
});

/* ─── CAC/COGS Overrides ─── */
describe('CAC/COGS Overrides in Channel Economics', () => {
  const baseProjections = { gdc: 100000, aum: 50000, affiliate: 30000, override: 20000, channel: 15000 };
  const allEnabled: EnabledChannels = { gdc: true, aum: true, affiliate: true, override: true, channel: true };

  it('uses industry benchmarks when no overrides provided', () => {
    const economics = calcChannelEconomics({
      enabledChannels: allEnabled,
      projections: baseProjections,
    });
    const gdcEcon = economics.find(e => e.channel === 'gdc');
    expect(gdcEcon).toBeDefined();
    expect(gdcEcon!.cac).toBe(CHANNEL_BENCHMARKS.gdc.cac);
    expect(gdcEcon!.cogsPct).toBe(CHANNEL_BENCHMARKS.gdc.cogsPct);
  });

  it('applies CAC overrides when provided', () => {
    const economics = calcChannelEconomics({
      enabledChannels: allEnabled,
      projections: baseProjections,
      cacOverrides: { gdc: 500 },
    });
    const gdcEcon = economics.find(e => e.channel === 'gdc');
    expect(gdcEcon!.cac).toBe(500);
  });

  it('applies COGS overrides when provided', () => {
    const economics = calcChannelEconomics({
      enabledChannels: allEnabled,
      projections: baseProjections,
      cogsOverrides: { aum: 20 },
    });
    const aumEcon = economics.find(e => e.channel === 'aum');
    expect(aumEcon!.cogsPct).toBe(20);
    expect(aumEcon!.cogsDollar).toBe(10000); // 20% of 50000
  });

  it('lower COGS override means higher margin', () => {
    const withoutOverride = calcChannelEconomics({
      enabledChannels: allEnabled,
      projections: baseProjections,
    });
    const withOverride = calcChannelEconomics({
      enabledChannels: allEnabled,
      projections: baseProjections,
      cogsOverrides: { gdc: 10 },
    });
    const gdcBase = withoutOverride.find(e => e.channel === 'gdc')!;
    const gdcOverride = withOverride.find(e => e.channel === 'gdc')!;
    expect(gdcOverride.grossMarginPct).toBeGreaterThanOrEqual(gdcBase.grossMarginPct);
  });

  it('disabled channels are excluded from economics', () => {
    const economics = calcChannelEconomics({
      enabledChannels: { gdc: true, aum: false, affiliate: false, override: false, channel: false },
      projections: baseProjections,
    });
    expect(economics.length).toBe(1);
    expect(economics[0].channel).toBe('gdc');
  });
});

/* ─── CHANNEL_BENCHMARKS structure ─── */
describe('CHANNEL_BENCHMARKS', () => {
  it('has all 5 channels', () => {
    expect(CHANNEL_BENCHMARKS).toHaveProperty('gdc');
    expect(CHANNEL_BENCHMARKS).toHaveProperty('aum');
    expect(CHANNEL_BENCHMARKS).toHaveProperty('affiliate');
    expect(CHANNEL_BENCHMARKS).toHaveProperty('override');
    expect(CHANNEL_BENCHMARKS).toHaveProperty('channel');
  });

  it('each channel has required benchmark fields', () => {
    for (const key of ['gdc', 'aum', 'affiliate', 'override', 'channel'] as const) {
      const b = CHANNEL_BENCHMARKS[key];
      expect(b.cac).toBeGreaterThan(0);
      expect(b.cogsPct).toBeGreaterThanOrEqual(0);
      expect(b.cogsPct).toBeLessThanOrEqual(100);
      expect(b.avgRevenuePerClient).toBeGreaterThan(0);
      expect(b.avgLifetimeYears).toBeGreaterThan(0);
    }
  });
});
