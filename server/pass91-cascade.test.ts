/**
 * Pass 91 — Bidirectional Income Cascade & EnabledChannels Tests
 * Tests the practiceEngine's calcUnifiedIncomePlan with enabledChannels
 */
import { describe, it, expect } from 'vitest';

// We test the engine logic directly since it's a pure function
// Import from the client-side engine (vitest can handle TS imports)
import { calcUnifiedIncomePlan, calcBackFromChannels, type EnabledChannels } from '../client/src/pages/calculators/practiceEngine';

const ALL_ENABLED: EnabledChannels = { gdc: true, aum: true, affiliate: true, override: true, channel: true };
const ALL_DISABLED: EnabledChannels = { gdc: false, aum: false, affiliate: false, override: false, channel: false };

const BASE_PARAMS = {
  targetIncome: 200000,
  splits: { gdc: 40, aum: 20, affiliate: 15, override: 15, channel: 10 },
  role: 'new' as const,
  targetGDC: 80000,
  wbPct: 80,
  bracketOverride: 'auto',
  avgGDC: 2000,
  funnelRates: { ap: 10, sh: 60, cl: 50, pl: 80 },
  months: 10,
  aumExisting: 2000000,
  aumNew: 500000,
  aumTrailPct: 1,
  affCounts: { a: 2, b: 3, c: 1, d: 0 },
  affAvgProd: { a: 150000, b: 80000, c: 50000, d: 30000 },
  teamSize: 5,
  teamAvgGDC: 100000,
  overrideRate: 20,
  channelSpend: { social: 500, events: 300, direct: 200, referral: 100, digital: 400 },
};

describe('calcUnifiedIncomePlan — enabledChannels', () => {
  it('returns non-zero projections when all channels enabled', () => {
    const plan = calcUnifiedIncomePlan({ ...BASE_PARAMS, enabledChannels: ALL_ENABLED });
    expect(plan.totalProjected).toBeGreaterThan(0);
    expect(plan.channels.gdc.target).toBe(80000); // 40% of 200k
    expect(plan.channels.aum.target).toBe(40000); // 20% of 200k
    expect(plan.channels.affiliate.target).toBe(30000); // 15% of 200k
    expect(plan.channels.override.target).toBe(30000); // 15% of 200k
    expect(plan.channels.channel.target).toBe(20000); // 10% of 200k
  });

  it('zeros out disabled channels', () => {
    const plan = calcUnifiedIncomePlan({ ...BASE_PARAMS, enabledChannels: ALL_DISABLED });
    expect(plan.channels.gdc.target).toBe(0);
    expect(plan.channels.gdc.projected).toBe(0);
    expect(plan.channels.aum.target).toBe(0);
    expect(plan.channels.aum.detail.projectedIncome).toBe(0);
    expect(plan.channels.affiliate.target).toBe(0);
    expect(plan.channels.affiliate.totalProjected).toBe(0);
    expect(plan.channels.override.target).toBe(0);
    expect(plan.channels.override.detail.projectedIncome).toBe(0);
    expect(plan.channels.channel.target).toBe(0);
    expect(plan.channels.channel.detail.projectedAnnualRevenue).toBe(0);
    expect(plan.totalProjected).toBe(0);
  });

  it('disabling GDC zeros only GDC, others remain', () => {
    const plan = calcUnifiedIncomePlan({
      ...BASE_PARAMS,
      enabledChannels: { ...ALL_ENABLED, gdc: false },
    });
    expect(plan.channels.gdc.target).toBe(0);
    expect(plan.channels.gdc.projected).toBe(0);
    // AUM should still be active
    expect(plan.channels.aum.target).toBe(40000);
    expect(plan.channels.aum.detail.projectedIncome).toBeGreaterThan(0);
  });

  it('disabling AUM zeros only AUM', () => {
    const plan = calcUnifiedIncomePlan({
      ...BASE_PARAMS,
      enabledChannels: { ...ALL_ENABLED, aum: false },
    });
    expect(plan.channels.aum.target).toBe(0);
    expect(plan.channels.aum.detail.projectedIncome).toBe(0);
    expect(plan.channels.gdc.target).toBe(80000);
  });

  it('disabling affiliate zeros affiliate counts and income', () => {
    const plan = calcUnifiedIncomePlan({
      ...BASE_PARAMS,
      enabledChannels: { ...ALL_ENABLED, affiliate: false },
    });
    expect(plan.channels.affiliate.target).toBe(0);
    expect(plan.channels.affiliate.totalProjected).toBe(0);
    plan.channels.affiliate.details.forEach(d => {
      expect(d.count).toBe(0);
      expect(d.projectedIncome).toBe(0);
    });
  });

  it('totalGap is correct when projected < target', () => {
    const plan = calcUnifiedIncomePlan({ ...BASE_PARAMS, enabledChannels: ALL_ENABLED });
    const expectedGap = Math.max(0, plan.targetIncome - plan.totalProjected);
    expect(plan.totalGap).toBe(expectedGap);
  });

  it('onTrack is true when totalProjected >= targetIncome', () => {
    // Set a very low target that should be easily met
    const plan = calcUnifiedIncomePlan({
      ...BASE_PARAMS,
      targetIncome: 1000,
      splits: { gdc: 40, aum: 20, affiliate: 15, override: 15, channel: 10 },
      enabledChannels: ALL_ENABLED,
    });
    expect(plan.onTrack).toBe(true);
    expect(plan.totalGap).toBe(0);
  });
});

describe('calcBackFromChannels', () => {
  it('sums all channel projections', () => {
    const total = calcBackFromChannels({
      gdcProjected: 50000,
      aumProjected: 20000,
      affProjected: 15000,
      ovrProjected: 10000,
      chProjected: 5000,
    });
    expect(total).toBe(100000);
  });

  it('handles zero channels', () => {
    const total = calcBackFromChannels({
      gdcProjected: 0, aumProjected: 0, affProjected: 0, ovrProjected: 0, chProjected: 0,
    });
    expect(total).toBe(0);
  });
});

describe('forward cascade — split proportionality', () => {
  it('channel targets sum to targetIncome when all enabled', () => {
    const plan = calcUnifiedIncomePlan({ ...BASE_PARAMS, enabledChannels: ALL_ENABLED });
    const sum = plan.channels.gdc.target + plan.channels.aum.target +
      plan.channels.affiliate.target + plan.channels.override.target + plan.channels.channel.target;
    // Allow rounding tolerance
    expect(Math.abs(sum - BASE_PARAMS.targetIncome)).toBeLessThanOrEqual(5);
  });

  it('changing targetIncome proportionally changes channel targets', () => {
    const plan1 = calcUnifiedIncomePlan({ ...BASE_PARAMS, targetIncome: 100000, enabledChannels: ALL_ENABLED });
    const plan2 = calcUnifiedIncomePlan({ ...BASE_PARAMS, targetIncome: 200000, enabledChannels: ALL_ENABLED });
    // GDC target should double
    expect(plan2.channels.gdc.target).toBe(plan1.channels.gdc.target * 2);
    expect(plan2.channels.aum.target).toBe(plan1.channels.aum.target * 2);
  });
});
