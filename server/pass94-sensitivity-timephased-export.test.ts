/* ═══════════════════════════════════════════════════════════════
   Pass 94 — Sensitivity Analysis, Time-Phased Projections,
             Export Data Structure Verification
   ═══════════════════════════════════════════════════════════════ */
import { describe, it, expect } from 'vitest';
import {
  calcUnifiedIncomePlan,
  calcChannelEconomics,
  calcSensitivity,
  calcTimePhasedProjections,
  ROLE_DEFAULTS,
  CHANNEL_BENCHMARKS,
  type EnabledChannels,
  type IncomeSplits,
  type RoleId,
  type SensitivityResult,
  type TimePhasedResult,
} from '../client/src/pages/calculators/practiceEngine';

/* ─── Shared helper: build full params with reasonable defaults ─── */
function makeParams(overrides: Record<string, any> = {}) {
  return {
    targetIncome: 200000,
    splits: { gdc: 40, aum: 25, affiliate: 15, override: 10, channel: 10 } as IncomeSplits,
    enabledChannels: { gdc: true, aum: true, affiliate: true, override: true, channel: true } as EnabledChannels,
    role: 'exp' as RoleId,
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

/* ═══════════════════════════════════════════════════════════════
   SECTION A: calcSensitivity
   ═══════════════════════════════════════════════════════════════ */
describe('calcSensitivity', () => {
  const params = makeParams();
  const results = calcSensitivity(params);

  it('returns exactly 8 sensitivity variables', () => {
    expect(results).toHaveLength(8);
  });

  it('covers all expected variable keys', () => {
    const keys = results.map(r => r.variable.key);
    expect(keys).toContain('closeRate');
    expect(keys).toContain('showRate');
    expect(keys).toContain('avgGDC');
    expect(keys).toContain('aumTrailPct');
    expect(keys).toContain('aumExisting');
    expect(keys).toContain('affAvgProdA');
    expect(keys).toContain('overrideRate');
    expect(keys).toContain('teamAvgGDC');
  });

  it('each variable has 6 variations (±10%, ±25%, ±50%)', () => {
    for (const r of results) {
      expect(r.variations).toHaveLength(6);
      const pcts = r.variations.map(v => v.pctChange);
      expect(pcts).toEqual([-50, -25, -10, 10, 25, 50]);
    }
  });

  it('results are sorted by impactRange descending (most impactful first)', () => {
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].impactRange).toBeGreaterThanOrEqual(results[i].impactRange);
    }
  });

  it('impactRange equals max projected minus min projected', () => {
    for (const r of results) {
      const projections = r.variations.map(v => v.projected);
      const expectedRange = Math.max(...projections) - Math.min(...projections);
      expect(r.impactRange).toBe(expectedRange);
    }
  });

  it('delta is difference from base projected for each variation', () => {
    const basePlan = calcUnifiedIncomePlan(params);
    const baseProjected = basePlan.totalProjected;
    for (const r of results) {
      for (const v of r.variations) {
        expect(v.delta).toBe(v.projected - baseProjected);
      }
    }
  });

  it('positive % changes increase projected income for close rate', () => {
    const closeRate = results.find(r => r.variable.key === 'closeRate')!;
    const plus10 = closeRate.variations.find(v => v.pctChange === 10)!;
    const plus50 = closeRate.variations.find(v => v.pctChange === 50)!;
    // Higher close rate should produce higher income
    expect(plus10.delta).toBeGreaterThanOrEqual(0);
    expect(plus50.delta).toBeGreaterThanOrEqual(plus10.delta);
  });

  it('negative % changes decrease projected income for close rate', () => {
    const closeRate = results.find(r => r.variable.key === 'closeRate')!;
    const minus10 = closeRate.variations.find(v => v.pctChange === -10)!;
    const minus50 = closeRate.variations.find(v => v.pctChange === -50)!;
    expect(minus10.delta).toBeLessThanOrEqual(0);
    expect(minus50.delta).toBeLessThanOrEqual(minus10.delta);
  });

  it('base values match the input parameters', () => {
    const closeRate = results.find(r => r.variable.key === 'closeRate')!;
    expect(closeRate.variable.baseValue).toBe(params.funnelRates.pl);

    const avgGDC = results.find(r => r.variable.key === 'avgGDC')!;
    expect(avgGDC.variable.baseValue).toBe(params.avgGDC);

    const aumBook = results.find(r => r.variable.key === 'aumExisting')!;
    expect(aumBook.variable.baseValue).toBe(params.aumExisting);
  });

  it('handles zero base value gracefully (all deltas = 0)', () => {
    const zeroParams = makeParams({ teamAvgGDC: 0 });
    const zeroResults = calcSensitivity(zeroParams);
    const teamGDC = zeroResults.find(r => r.variable.key === 'teamAvgGDC')!;
    expect(teamGDC.impactRange).toBe(0);
    for (const v of teamGDC.variations) {
      expect(v.delta).toBe(0);
    }
  });
});

/* ═══════════════════════════════════════════════════════════════
   SECTION B: calcTimePhasedProjections
   ═══════════════════════════════════════════════════════════════ */
describe('calcTimePhasedProjections', () => {
  const params = makeParams();
  const plan = calcUnifiedIncomePlan(params);
  const allEnabled: EnabledChannels = { gdc: true, aum: true, affiliate: true, override: true, channel: true };

  const timePhased = calcTimePhasedProjections({
    targetIncome: 200000,
    plan,
    role: 'exp',
    enabledChannels: allEnabled,
    startMonth: 0, // January start for deterministic testing
  });

  it('returns exactly 12 monthly entries', () => {
    expect(timePhased.monthly).toHaveLength(12);
  });

  it('monthly entries have sequential month numbers 1-12', () => {
    for (let i = 0; i < 12; i++) {
      expect(timePhased.monthly[i].month).toBe(i + 1);
    }
  });

  it('monthly labels match calendar months starting from startMonth', () => {
    const expectedLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let i = 0; i < 12; i++) {
      expect(timePhased.monthly[i].label).toBe(expectedLabels[i]);
    }
  });

  it('cumulative total is monotonically increasing', () => {
    for (let i = 1; i < 12; i++) {
      expect(timePhased.monthly[i].cumulativeTotal).toBeGreaterThanOrEqual(
        timePhased.monthly[i - 1].cumulativeTotal
      );
    }
  });

  it('cumulative total equals sum of all monthly totals up to that point', () => {
    let running = 0;
    for (const m of timePhased.monthly) {
      running += m.monthlyTotal;
      expect(m.cumulativeTotal).toBe(running);
    }
  });

  it('monthlyTotal equals sum of all channel amounts', () => {
    for (const m of timePhased.monthly) {
      expect(m.monthlyTotal).toBe(m.gdc + m.aum + m.affiliate + m.override + m.channel);
    }
  });

  it('returns exactly 4 quarterly entries', () => {
    expect(timePhased.quarterly).toHaveLength(4);
    expect(timePhased.quarterly.map(q => q.label)).toEqual(['Q1', 'Q2', 'Q3', 'Q4']);
  });

  it('quarterly totals equal sum of their 3 monthly totals', () => {
    for (let q = 0; q < 4; q++) {
      const qMonths = timePhased.monthly.slice(q * 3, q * 3 + 3);
      const expectedTotal = qMonths.reduce((s, m) => s + m.monthlyTotal, 0);
      expect(timePhased.quarterly[q].total).toBe(expectedTotal);
    }
  });

  it('quarterly target is approximately targetIncome / 4', () => {
    for (const q of timePhased.quarterly) {
      expect(q.target).toBe(Math.round(200000 / 4));
    }
  });

  it('quarterly gap is max(0, target - total)', () => {
    for (const q of timePhased.quarterly) {
      expect(q.gap).toBe(Math.max(0, q.target - q.total));
    }
  });

  it('returns 5 milestones (25%, 50%, 75%, 100%, Break Even)', () => {
    expect(timePhased.milestones).toHaveLength(5);
    expect(timePhased.milestones[0].label).toBe('25% of Target');
    expect(timePhased.milestones[1].label).toBe('50% of Target');
    expect(timePhased.milestones[2].label).toBe('75% of Target');
    expect(timePhased.milestones[3].label).toBe('100% of Target');
    expect(timePhased.milestones[4].label).toBe('Break Even (COGS)');
  });

  it('milestone amounts are correct fractions of target income', () => {
    expect(timePhased.milestones[0].amount).toBe(50000);  // 25% of 200000
    expect(timePhased.milestones[1].amount).toBe(100000); // 50% of 200000
    expect(timePhased.milestones[2].amount).toBe(150000); // 75% of 200000
    expect(timePhased.milestones[3].amount).toBe(200000); // 100% of 200000
  });

  it('milestone expectedMonth is null or 1-12', () => {
    for (const m of timePhased.milestones) {
      if (m.expectedMonth !== null) {
        expect(m.expectedMonth).toBeGreaterThanOrEqual(1);
        expect(m.expectedMonth).toBeLessThanOrEqual(12);
      }
    }
  });

  it('annualTarget equals targetIncome', () => {
    expect(timePhased.annualTarget).toBe(200000);
  });

  it('annualTotal equals last month cumulative total', () => {
    expect(timePhased.annualTotal).toBe(timePhased.monthly[11].cumulativeTotal);
  });

  it('onPace flag is correct for each month', () => {
    for (const m of timePhased.monthly) {
      expect(m.onPace).toBe(m.cumulativeTotal >= m.cumulativeTarget);
    }
  });

  it('disabled channels produce zero monthly amounts', () => {
    const partialEnabled: EnabledChannels = { gdc: true, aum: false, affiliate: false, override: false, channel: false };
    const partial = calcTimePhasedProjections({
      targetIncome: 200000,
      plan,
      role: 'exp',
      enabledChannels: partialEnabled,
      startMonth: 0,
    });
    for (const m of partial.monthly) {
      expect(m.aum).toBe(0);
      expect(m.affiliate).toBe(0);
      expect(m.override).toBe(0);
      expect(m.channel).toBe(0);
    }
  });

  it('different startMonth shifts calendar labels', () => {
    const julyStart = calcTimePhasedProjections({
      targetIncome: 200000,
      plan,
      role: 'exp',
      enabledChannels: allEnabled,
      startMonth: 6, // July
    });
    expect(julyStart.monthly[0].label).toBe('Jul');
    expect(julyStart.monthly[6].label).toBe('Jan');
    expect(julyStart.monthly[11].label).toBe('Jun');
  });

  it('new role has steeper ramp (lower early months) than experienced role', () => {
    const newTP = calcTimePhasedProjections({
      targetIncome: 200000,
      plan,
      role: 'new',
      enabledChannels: allEnabled,
      startMonth: 0,
    });
    const expTP = calcTimePhasedProjections({
      targetIncome: 200000,
      plan,
      role: 'exp',
      enabledChannels: allEnabled,
      startMonth: 0,
    });
    // New role month 1 should be lower than experienced role month 1
    expect(newTP.monthly[0].monthlyTotal).toBeLessThan(expTP.monthly[0].monthlyTotal);
  });
});

/* ═══════════════════════════════════════════════════════════════
   SECTION C: Export Data Structure (getChannelData equivalent)
   ═══════════════════════════════════════════════════════════════ */
describe('Export Plan Data Structure', () => {
  const params = makeParams();
  const plan = calcUnifiedIncomePlan(params);

  it('plan.channels.gdc has target, projected, and gap', () => {
    expect(plan.channels.gdc).toHaveProperty('target');
    expect(plan.channels.gdc).toHaveProperty('projected');
    expect(plan.channels.gdc).toHaveProperty('gap');
    expect(typeof plan.channels.gdc.target).toBe('number');
    expect(typeof plan.channels.gdc.projected).toBe('number');
    expect(typeof plan.channels.gdc.gap).toBe('number');
  });

  it('plan.channels.aum has target and detail.projectedIncome/gap', () => {
    expect(plan.channels.aum).toHaveProperty('target');
    expect(plan.channels.aum.detail).toHaveProperty('projectedIncome');
    expect(plan.channels.aum.detail).toHaveProperty('gap');
    expect(typeof plan.channels.aum.target).toBe('number');
    expect(typeof plan.channels.aum.detail.projectedIncome).toBe('number');
  });

  it('plan.channels.affiliate has target, totalProjected, and gap', () => {
    expect(plan.channels.affiliate).toHaveProperty('target');
    expect(plan.channels.affiliate).toHaveProperty('totalProjected');
    expect(plan.channels.affiliate).toHaveProperty('gap');
    expect(typeof plan.channels.affiliate.target).toBe('number');
    expect(typeof plan.channels.affiliate.totalProjected).toBe('number');
  });

  it('plan.channels.override has target and detail.projectedIncome/gap', () => {
    expect(plan.channels.override).toHaveProperty('target');
    expect(plan.channels.override.detail).toHaveProperty('projectedIncome');
    expect(plan.channels.override.detail).toHaveProperty('gap');
  });

  it('plan.channels.channel has target and detail.projectedAnnualRevenue/gap', () => {
    expect(plan.channels.channel).toHaveProperty('target');
    expect(plan.channels.channel.detail).toHaveProperty('projectedAnnualRevenue');
    expect(plan.channels.channel.detail).toHaveProperty('gap');
  });

  it('plan has totalProjected, totalGap, and onTrack at top level', () => {
    expect(plan).toHaveProperty('totalProjected');
    expect(plan).toHaveProperty('totalGap');
    expect(plan).toHaveProperty('onTrack');
    expect(typeof plan.totalProjected).toBe('number');
    expect(typeof plan.totalGap).toBe('number');
    expect(typeof plan.onTrack).toBe('boolean');
  });

  it('totalProjected is sum of all channel projected values', () => {
    const sumProjected =
      (plan.channels.gdc.projected) +
      (plan.channels.aum.detail.projectedIncome) +
      (plan.channels.affiliate.totalProjected) +
      (plan.channels.override.detail.projectedIncome) +
      (plan.channels.channel.detail.projectedAnnualRevenue);
    expect(plan.totalProjected).toBe(sumProjected);
  });

  it('gap values are non-negative for all channels', () => {
    expect(plan.channels.gdc.gap).toBeGreaterThanOrEqual(0);
    expect(plan.channels.aum.detail.gap).toBeGreaterThanOrEqual(0);
    expect(plan.channels.affiliate.gap).toBeGreaterThanOrEqual(0);
    expect(plan.channels.override.detail.gap).toBeGreaterThanOrEqual(0);
    expect(plan.channels.channel.detail.gap).toBeGreaterThanOrEqual(0);
  });

  it('onTrack is true when totalProjected >= targetIncome', () => {
    expect(plan.onTrack).toBe(plan.totalProjected >= params.targetIncome);
  });
});
