import { describe, it, expect } from 'vitest';

// Test the unified income planning engine
// We import from the client-side engine since it's pure TypeScript
import { calcUnifiedIncomePlan, ROLE_DEFAULTS } from '../client/src/pages/calculators/practiceEngine';

describe('Pass 89 — Unified Income Planning Engine', () => {
  const baseParams = {
    targetIncome: 150000,
    splits: { gdc: 55, aum: 20, affiliate: 10, override: 10, channel: 5 },
    role: 'exp' as const,
    enabledChannels: { gdc: true, aum: true, affiliate: true, override: true, channel: true },
    targetGDC: 82500, // 55% of 150k
    wbPct: 60,
    bracketOverride: 'auto',
    avgGDC: 82500,
    funnelRates: { ap: 0.20, sh: 0.85, cl: 0.45, pl: 0.85 },
    months: 11,
    aumExisting: 5000000,
    aumNew: 0,
    aumTrailPct: 1,
    aumOverrideRate: 100,
    affCounts: { a: 1, b: 2, c: 1, d: 0 },
    affAvgProd: { a: 8000, b: 6000, c: 10000, d: 0 },
    teamSize: 0,
    teamAvgGDC: 0,
    overrideRate: 0,
    channelSpend: {},
  };

  it('calcUnifiedIncomePlan returns all required channel breakdowns', () => {
    const plan = calcUnifiedIncomePlan(baseParams);
    expect(plan).toBeDefined();
    expect(plan.channels).toBeDefined();
    expect(plan.channels.gdc).toBeDefined();
    expect(plan.channels.aum).toBeDefined();
    expect(plan.channels.affiliate).toBeDefined();
    expect(plan.channels.override).toBeDefined();
    expect(plan.channels.channel).toBeDefined();
    expect(typeof plan.totalProjected).toBe('number');
    expect(typeof plan.totalGap).toBe('number');
    expect(typeof plan.onTrack).toBe('boolean');
  });

  it('channel targets sum to target income based on splits', () => {
    const plan = calcUnifiedIncomePlan(baseParams);
    const targetSum = plan.channels.gdc.target + plan.channels.aum.target +
      plan.channels.affiliate.target + plan.channels.override.target + plan.channels.channel.target;
    expect(targetSum).toBe(baseParams.targetIncome);
  });

  it('GDC channel target matches split percentage', () => {
    const plan = calcUnifiedIncomePlan(baseParams);
    expect(plan.channels.gdc.target).toBe(Math.round(150000 * 55 / 100));
  });

  it('AUM channel target matches split percentage', () => {
    const plan = calcUnifiedIncomePlan(baseParams);
    expect(plan.channels.aum.target).toBe(Math.round(150000 * 20 / 100));
  });

  it('AUM projected income includes existing book trail', () => {
    const plan = calcUnifiedIncomePlan(baseParams);
    // 5M existing * 1% trail = $50,000
    expect(plan.channels.aum.detail.projectedIncome).toBeGreaterThanOrEqual(50000);
  });

  it('affiliate channel calculates per-type projected income', () => {
    const plan = calcUnifiedIncomePlan(baseParams);
    expect(plan.channels.affiliate.totalProjected).toBeGreaterThan(0);
    // Should have details for each affiliate type
    expect(plan.channels.affiliate.details).toBeDefined();
    expect(Array.isArray(plan.channels.affiliate.details)).toBe(true);
    expect(plan.channels.affiliate.details.length).toBe(4);
  });

  it('gap is zero or positive (never negative)', () => {
    const plan = calcUnifiedIncomePlan(baseParams);
    expect(plan.totalGap).toBeGreaterThanOrEqual(0);
    expect(plan.channels.gdc.gap).toBeGreaterThanOrEqual(0);
    // AUM gap is inside detail
    expect(plan.channels.aum.detail.gap).toBeGreaterThanOrEqual(0);
    expect(plan.channels.affiliate.gap).toBeGreaterThanOrEqual(0);
  });

  it('onTrack is true when totalProjected >= targetIncome', () => {
    // Give very high AUM to ensure on track
    const plan = calcUnifiedIncomePlan({
      ...baseParams,
      aumExisting: 50000000, // $50M book
      targetGDC: 200000,
      teamSize: 10,
      teamAvgGDC: 100000,
      overrideRate: 10,
    });
    // With $50M AUM at 1% trail = $500k, should be on track for $150k target
    expect(plan.onTrack).toBe(true);
  });

  it('ROLE_DEFAULTS have unified income planning fields for all roles', () => {
    const roles = ['new', 'exp', 'sa', 'dir', 'md', 'rvp'];
    for (const role of roles) {
      const rd = ROLE_DEFAULTS[role];
      expect(rd).toBeDefined();
      expect(rd.defaultTargetIncome).toBeDefined();
      expect(rd.defaultTargetIncome).toBeGreaterThan(0);
      expect(rd.incomeSplits).toBeDefined();
      expect(rd.incomeSplits.gdc).toBeGreaterThanOrEqual(0);
      expect(rd.incomeSplits.aum).toBeGreaterThanOrEqual(0);
      expect(rd.incomeSplits.affiliate).toBeGreaterThanOrEqual(0);
      expect(rd.incomeSplits.override).toBeGreaterThanOrEqual(0);
      expect(rd.incomeSplits.channel).toBeGreaterThanOrEqual(0);
      // Splits should sum to 100
      const sum = rd.incomeSplits.gdc + rd.incomeSplits.aum + rd.incomeSplits.affiliate + rd.incomeSplits.override + rd.incomeSplits.channel;
      expect(sum).toBe(100);
      expect(rd.defaultAUM).toBeDefined();
      expect(rd.defaultAffiliates).toBeDefined();
      expect(rd.defaultAffProd).toBeDefined();
    }
  });

  it('changing target income recalculates all channel targets proportionally', () => {
    const plan1 = calcUnifiedIncomePlan(baseParams);
    const plan2 = calcUnifiedIncomePlan({ ...baseParams, targetIncome: 300000 });
    // Channel targets should double
    expect(plan2.channels.gdc.target).toBe(plan1.channels.gdc.target * 2);
    expect(plan2.channels.aum.target).toBe(plan1.channels.aum.target * 2);
  });

  it('zero splits result in zero channel targets', () => {
    const plan = calcUnifiedIncomePlan({
      ...baseParams,
      splits: { gdc: 100, aum: 0, affiliate: 0, override: 0, channel: 0 },
    });
    expect(plan.channels.aum.target).toBe(0);
    expect(plan.channels.affiliate.target).toBe(0);
    expect(plan.channels.override.target).toBe(0);
    expect(plan.channels.channel.target).toBe(0);
  });
});
