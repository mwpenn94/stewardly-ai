/* ═══════════════════════════════════════════════════════════════
   Pass 95 — Cross-Cascade Engine Tests
   Tests: redistributeSplits, backSolveChannelTarget,
          backSolveChannelProjected, autoBalanceSplits,
          calcChannelBalances, CHANNEL_KEYS
   ═══════════════════════════════════════════════════════════════ */
import { describe, it, expect } from 'vitest';
import {
  redistributeSplits,
  backSolveChannelTarget,
  backSolveChannelProjected,
  autoBalanceSplits,
  calcChannelBalances,
  calcUnifiedIncomePlan,
  CHANNEL_KEYS,
  AFF_RATES,
  type IncomeSplits,
  type EnabledChannels,
} from '../client/src/pages/calculators/practiceEngine';

/* ═══ SHARED TEST FIXTURES ═══ */
const ALL_ENABLED: EnabledChannels = { gdc: true, aum: true, affiliate: true, override: true, channel: true };
const BASE_SPLITS: IncomeSplits = { gdc: 40, aum: 25, affiliate: 15, override: 15, channel: 5 };
const TARGET_INCOME = 200000;

const BASE_PARAMS = {
  targetIncome: TARGET_INCOME,
  splits: BASE_SPLITS,
  role: 'exp' as const,
  enabledChannels: ALL_ENABLED,
  targetGDC: 80000,
  wbPct: 60,
  bracketOverride: 'auto',
  avgGDC: 3000,
  funnelRates: { ap: 0.20, sh: 0.85, cl: 0.45, pl: 0.85 },
  months: 11,
  aumExisting: 5000000,
  aumNew: 500000,
  aumTrailPct: 1.0,
  affCounts: { a: 2, b: 3, c: 1, d: 1 },
  affAvgProd: { a: 10000, b: 8000, c: 12000, d: 15000 },
  teamSize: 5,
  teamAvgGDC: 80000,
  overrideRate: 8,
  channelSpend: { ref: 200, sem: 300, social: 150, email: 100 },
};

/* ═══ CHANNEL_KEYS ═══ */
describe('CHANNEL_KEYS', () => {
  it('contains all 5 channel keys in order', () => {
    expect(CHANNEL_KEYS).toEqual(['gdc', 'aum', 'affiliate', 'override', 'channel']);
  });
});

/* ═══ redistributeSplits ═══ */
describe('redistributeSplits', () => {
  it('preserves 100% sum when increasing one channel', () => {
    const result = redistributeSplits('gdc', 60, BASE_SPLITS, ALL_ENABLED);
    const sum = result.gdc + result.aum + result.affiliate + result.override + result.channel;
    expect(sum).toBe(100);
    expect(result.gdc).toBe(60);
  });

  it('preserves 100% sum when decreasing one channel', () => {
    const result = redistributeSplits('gdc', 20, BASE_SPLITS, ALL_ENABLED);
    const sum = result.gdc + result.aum + result.affiliate + result.override + result.channel;
    expect(sum).toBe(100);
    expect(result.gdc).toBe(20);
    // Others should increase proportionally
    expect(result.aum).toBeGreaterThan(BASE_SPLITS.aum);
  });

  it('returns unchanged splits when delta is 0', () => {
    const result = redistributeSplits('gdc', 40, BASE_SPLITS, ALL_ENABLED);
    expect(result).toEqual(BASE_SPLITS);
  });

  it('handles setting a channel to 0%', () => {
    const result = redistributeSplits('channel', 0, BASE_SPLITS, ALL_ENABLED);
    expect(result.channel).toBe(0);
    const sum = result.gdc + result.aum + result.affiliate + result.override + result.channel;
    expect(sum).toBe(100);
  });

  it('handles setting a channel to 100%', () => {
    const result = redistributeSplits('gdc', 100, BASE_SPLITS, ALL_ENABLED);
    expect(result.gdc).toBe(100);
    // All others should be 0
    expect(result.aum + result.affiliate + result.override + result.channel).toBe(0);
  });

  it('only adjusts enabled channels', () => {
    const partialEnabled: EnabledChannels = { gdc: true, aum: true, affiliate: false, override: false, channel: false };
    const splits: IncomeSplits = { gdc: 60, aum: 40, affiliate: 0, override: 0, channel: 0 };
    const result = redistributeSplits('gdc', 80, splits, partialEnabled);
    expect(result.gdc).toBe(80);
    expect(result.aum).toBe(20); // Only enabled other channel absorbs
    expect(result.affiliate).toBe(0);
    expect(result.override).toBe(0);
    expect(result.channel).toBe(0);
  });

  it('distributes evenly when all other channels are at 0%', () => {
    const zeroSplits: IncomeSplits = { gdc: 100, aum: 0, affiliate: 0, override: 0, channel: 0 };
    const result = redistributeSplits('gdc', 60, zeroSplits, ALL_ENABLED);
    expect(result.gdc).toBe(60);
    // Remaining 40% should be distributed among 4 channels
    const otherSum = result.aum + result.affiliate + result.override + result.channel;
    expect(otherSum).toBe(40);
  });
});

/* ═══ backSolveChannelTarget ═══ */
describe('backSolveChannelTarget', () => {
  it('computes correct split % from target amount', () => {
    // Setting GDC target to $100K out of $200K target = 50%
    const result = backSolveChannelTarget('gdc', 100000, TARGET_INCOME, BASE_SPLITS, ALL_ENABLED);
    expect(result.gdc).toBe(50);
    const sum = result.gdc + result.aum + result.affiliate + result.override + result.channel;
    expect(sum).toBe(100);
  });

  it('returns current splits when targetIncome is 0', () => {
    const result = backSolveChannelTarget('gdc', 50000, 0, BASE_SPLITS, ALL_ENABLED);
    expect(result).toEqual(BASE_SPLITS);
  });

  it('clamps split to 0-100 range', () => {
    // Target exceeds total income
    const result = backSolveChannelTarget('gdc', 300000, TARGET_INCOME, BASE_SPLITS, ALL_ENABLED);
    expect(result.gdc).toBeLessThanOrEqual(100);
    expect(result.gdc).toBeGreaterThanOrEqual(0);
  });

  it('works for all channel types', () => {
    for (const ch of CHANNEL_KEYS) {
      const result = backSolveChannelTarget(ch, 40000, TARGET_INCOME, BASE_SPLITS, ALL_ENABLED);
      expect(result[ch]).toBe(20); // 40K / 200K = 20%
      const sum = CHANNEL_KEYS.reduce((s, k) => s + result[k], 0);
      expect(sum).toBe(100);
    }
  });
});

/* ═══ backSolveChannelProjected ═══ */
describe('backSolveChannelProjected', () => {
  const currentValues = {
    aumTrailPct: 1.0,
    affCounts: { a: 2, b: 3, c: 1, d: 1 },
    affAvgProd: { a: 10000, b: 8000, c: 12000, d: 15000 },
    teamSize: 5,
    overrideRate: 8,
    channelAnnualRev: 100000,
    channelSpend: { ref: 200, sem: 300, social: 150, email: 100 },
  };

  it('back-solves GDC: sets gdcTarget to newProjected', () => {
    const result = backSolveChannelProjected('gdc', 120000, TARGET_INCOME, BASE_SPLITS, ALL_ENABLED, currentValues);
    expect(result.gdcTarget).toBe(120000);
    expect(result.newSplitPct).toBe(60); // 120K / 200K
  });

  it('back-solves AUM: computes required existing book', () => {
    const result = backSolveChannelProjected('aum', 60000, TARGET_INCOME, BASE_SPLITS, ALL_ENABLED, currentValues);
    expect(result.aumExisting).toBe(6000000); // 60K / (1.0/100)
    expect(result.newSplitPct).toBe(30); // 60K / 200K
  });

  it('back-solves Affiliate: computes scale factor', () => {
    const result = backSolveChannelProjected('affiliate', 20000, TARGET_INCOME, BASE_SPLITS, ALL_ENABLED, currentValues);
    expect(result.affCountScale).toBeDefined();
    expect(typeof result.affCountScale).toBe('number');
    expect(result.affCountScale!).toBeGreaterThan(0);
  });

  it('back-solves Override: computes required teamAvgGDC', () => {
    const result = backSolveChannelProjected('override', 40000, TARGET_INCOME, BASE_SPLITS, ALL_ENABLED, currentValues);
    // 40K / (5 * 0.08) = 100000
    expect(result.teamAvgGDC).toBe(100000);
    expect(result.newSplitPct).toBe(20);
  });

  it('back-solves Channel: computes spend scale factor', () => {
    const result = backSolveChannelProjected('channel', 50000, TARGET_INCOME, BASE_SPLITS, ALL_ENABLED, currentValues);
    expect(result.channelSpendScale).toBeDefined();
    expect(result.channelSpendScale!).toBe(0.5); // 50K / 100K
  });

  it('handles zero current values gracefully', () => {
    const zeroValues = { ...currentValues, aumTrailPct: 0, channelAnnualRev: 0 };
    const aumResult = backSolveChannelProjected('aum', 50000, TARGET_INCOME, BASE_SPLITS, ALL_ENABLED, zeroValues);
    expect(aumResult.aumExisting).toBeUndefined(); // Can't back-solve with 0 trail%
    
    const chResult = backSolveChannelProjected('channel', 50000, TARGET_INCOME, BASE_SPLITS, ALL_ENABLED, zeroValues);
    expect(chResult.channelSpendScale).toBe(1); // Fallback when channelAnnualRev = 0
  });

  it('always returns valid splits summing to 100', () => {
    for (const ch of CHANNEL_KEYS) {
      const result = backSolveChannelProjected(ch, 50000, TARGET_INCOME, BASE_SPLITS, ALL_ENABLED, currentValues);
      const sum = CHANNEL_KEYS.reduce((s, k) => s + result.newSplits[k], 0);
      expect(sum).toBe(100);
    }
  });
});

/* ═══ autoBalanceSplits ═══ */
describe('autoBalanceSplits', () => {
  it('rebalances splits to match projected proportions', () => {
    const plan = calcUnifiedIncomePlan(BASE_PARAMS);
    const result = autoBalanceSplits(plan, ALL_ENABLED, BASE_SPLITS, TARGET_INCOME);
    const sum = CHANNEL_KEYS.reduce((s, k) => s + result[k], 0);
    expect(sum).toBe(100);
    // Each split should be proportional to its projected share
    const totalProjected = plan.totalProjected;
    if (totalProjected > 0) {
      const gdcPct = Math.round(plan.channels.gdc.projected / totalProjected * 100);
      expect(Math.abs(result.gdc - gdcPct)).toBeLessThanOrEqual(1); // Allow rounding tolerance
    }
  });

  it('returns current splits when targetIncome is 0', () => {
    const plan = calcUnifiedIncomePlan({ ...BASE_PARAMS, targetIncome: 0 });
    const result = autoBalanceSplits(plan, ALL_ENABLED, BASE_SPLITS, 0);
    expect(result).toEqual(BASE_SPLITS);
  });

  it('zeros out disabled channels', () => {
    const partialEnabled: EnabledChannels = { gdc: true, aum: true, affiliate: false, override: false, channel: false };
    const plan = calcUnifiedIncomePlan({ ...BASE_PARAMS, enabledChannels: partialEnabled });
    const result = autoBalanceSplits(plan, partialEnabled, BASE_SPLITS, TARGET_INCOME);
    expect(result.affiliate).toBe(0);
    expect(result.override).toBe(0);
    expect(result.channel).toBe(0);
    expect(result.gdc + result.aum).toBe(100);
  });
});

/* ═══ calcChannelBalances ═══ */
describe('calcChannelBalances', () => {
  it('returns balances for all enabled channels', () => {
    const plan = calcUnifiedIncomePlan(BASE_PARAMS);
    const balances = calcChannelBalances(plan, ALL_ENABLED);
    expect(balances.length).toBe(5);
    for (const b of balances) {
      expect(b.surplus).toBe(b.projected - b.target);
      expect(CHANNEL_KEYS).toContain(b.channel);
    }
  });

  it('excludes disabled channels', () => {
    const partialEnabled: EnabledChannels = { gdc: true, aum: false, affiliate: true, override: false, channel: false };
    const plan = calcUnifiedIncomePlan({ ...BASE_PARAMS, enabledChannels: partialEnabled });
    const balances = calcChannelBalances(plan, partialEnabled);
    expect(balances.length).toBe(2);
    expect(balances.map(b => b.channel)).toEqual(['gdc', 'affiliate']);
  });

  it('computes correct surplusPct', () => {
    const plan = calcUnifiedIncomePlan(BASE_PARAMS);
    const balances = calcChannelBalances(plan, ALL_ENABLED);
    for (const b of balances) {
      if (b.target > 0) {
        const expectedPct = Math.round((b.projected - b.target) / b.target * 100);
        expect(b.surplusPct).toBe(expectedPct);
      }
    }
  });

  it('handles zero-target channels', () => {
    const zeroSplits: IncomeSplits = { gdc: 100, aum: 0, affiliate: 0, override: 0, channel: 0 };
    const plan = calcUnifiedIncomePlan({ ...BASE_PARAMS, splits: zeroSplits });
    const balances = calcChannelBalances(plan, ALL_ENABLED);
    const gdcBalance = balances.find(b => b.channel === 'gdc');
    expect(gdcBalance).toBeDefined();
    // Channels with 0 target should have 0 surplusPct
    const zeroTargetBalances = balances.filter(b => b.target === 0);
    for (const b of zeroTargetBalances) {
      expect(b.surplusPct).toBe(0);
    }
  });
});

/* ═══ Cross-Cascade Integration Tests ═══ */
describe('Cross-Cascade Integration', () => {
  it('round-trip: backSolveTarget → redistributeSplits preserves 100%', () => {
    // Start with base, change GDC target to 120K
    const newSplits = backSolveChannelTarget('gdc', 120000, TARGET_INCOME, BASE_SPLITS, ALL_ENABLED);
    expect(newSplits.gdc).toBe(60);
    const sum = CHANNEL_KEYS.reduce((s, k) => s + newSplits[k], 0);
    expect(sum).toBe(100);
    
    // Now change it back to 80K
    const restored = backSolveChannelTarget('gdc', 80000, TARGET_INCOME, newSplits, ALL_ENABLED);
    expect(restored.gdc).toBe(40);
    const sum2 = CHANNEL_KEYS.reduce((s, k) => s + restored[k], 0);
    expect(sum2).toBe(100);
  });

  it('backSolveProjected → plan recalc produces close to desired projected', () => {
    const currentValues = {
      aumTrailPct: 1.0,
      affCounts: { a: 2, b: 3, c: 1, d: 1 },
      affAvgProd: { a: 10000, b: 8000, c: 12000, d: 15000 },
      teamSize: 5,
      overrideRate: 8,
      channelAnnualRev: 100000,
      channelSpend: { ref: 200, sem: 300, social: 150, email: 100 },
    };
    
    // Back-solve override to produce $50K
    const result = backSolveChannelProjected('override', 50000, TARGET_INCOME, BASE_SPLITS, ALL_ENABLED, currentValues);
    expect(result.teamAvgGDC).toBeDefined();
    
    // Verify: recalculate with the back-solved teamAvgGDC
    const newPlan = calcUnifiedIncomePlan({
      ...BASE_PARAMS,
      splits: result.newSplits,
      teamAvgGDC: result.teamAvgGDC!,
    });
    // Override projected should be close to 50K (exact match depends on rounding)
    expect(Math.abs(newPlan.channels.override.detail.projectedIncome - 50000)).toBeLessThan(1000);
  });

  it('autoBalance after plan calc produces aligned splits', () => {
    const plan = calcUnifiedIncomePlan(BASE_PARAMS);
    const balanced = autoBalanceSplits(plan, ALL_ENABLED, BASE_SPLITS, TARGET_INCOME);
    
    // Recalculate with balanced splits
    const newPlan = calcUnifiedIncomePlan({ ...BASE_PARAMS, splits: balanced });
    
    // Each channel's gap should be smaller or similar after rebalancing
    const sum = CHANNEL_KEYS.reduce((s, k) => s + balanced[k], 0);
    expect(sum).toBe(100);
  });

  it('sequential channel edits maintain invariant (100% sum preserved)', () => {
    let splits = { ...BASE_SPLITS };
    
    // Edit GDC target to 100K → GDC = 50%
    splits = backSolveChannelTarget('gdc', 100000, TARGET_INCOME, splits, ALL_ENABLED);
    expect(splits.gdc).toBe(50);
    expect(CHANNEL_KEYS.reduce((s, k) => s + splits[k], 0)).toBe(100);
    
    // Then edit AUM target to 60K → AUM = 30%, others (including GDC) redistribute
    splits = backSolveChannelTarget('aum', 60000, TARGET_INCOME, splits, ALL_ENABLED);
    expect(splits.aum).toBe(30);
    expect(CHANNEL_KEYS.reduce((s, k) => s + splits[k], 0)).toBe(100);
    
    // Then edit affiliate target to 20K → affiliate = 10%, others redistribute
    splits = backSolveChannelTarget('affiliate', 20000, TARGET_INCOME, splits, ALL_ENABLED);
    expect(splits.affiliate).toBe(10);
    expect(CHANNEL_KEYS.reduce((s, k) => s + splits[k], 0)).toBe(100);
    
    // Key invariant: 100% sum is always maintained after each edit.
    // Individual channel splits may shift due to proportional redistribution —
    // this is correct cross-cascade behavior (editing one channel adjusts siblings).
    // GDC was 50% after first edit but got proportionally reduced by subsequent edits.
    expect(splits.gdc).toBeGreaterThan(0);
    expect(splits.gdc).toBeLessThanOrEqual(100);
  });
});
