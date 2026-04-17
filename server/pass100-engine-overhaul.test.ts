/**
 * Pass 100 — Engine Overhaul Tests
 *
 * Covers:
 * 1. Retirement Income Engineering (Bucket Strategy, Floor-Upside, Guyton-Klinger)
 * 2. Roth Conversion Ladder
 * 3. Roll-Up Unification (P&L with GDC Brackets, Chart Data)
 * 4. Configurable Defaults (EngineConfig, mergeEngineConfig)
 * 5. AUM Override Rate in Unified Plan
 * 6. Flexible Affiliate Income (Producer Mode)
 * 7. PDF Generation Service
 */
import { describe, it, expect } from 'vitest';
import {
  calcBucketStrategy,
  calcFloorUpside,
  calcGuytonKlinger,
  calcRothLadder,
} from '../client/src/pages/calculators/engine';
import {
  calcUnifiedIncomePlan,
  calcUnifiedPnL,
  calcRollUpChartData,
  calcProducerAffiliateIncome,
  DEFAULT_ENGINE_CONFIG,
  mergeEngineConfig,
  GDC_BRACKETS,
  getBracket,
} from '../client/src/pages/calculators/practiceEngine';

// ─── Shared base params matching the CURRENT function signature ──────
const baseParams = {
  targetIncome: 200_000,
  splits: { gdc: 40, aum: 25, affiliate: 15, override: 10, channel: 10 },
  role: 'exp' as const,
  enabledChannels: { gdc: true, aum: true, affiliate: true, override: true, channel: true },
  targetGDC: 80_000,
  wbPct: 50,
  bracketOverride: '',
  avgGDC: 6_000,
  funnelRates: { ap: 20, sh: 50, cl: 40, pl: 80 },
  months: 12,
  aumExisting: 5_000_000,
  aumNew: 500_000,
  aumTrailPct: 1,
  aumOverrideRate: 90,
  affiliateMode: 'recruiter' as const,
  affCounts: { a: 5, b: 3, c: 1, d: 0 },
  affAvgProd: { a: 30_000, b: 25_000, c: 20_000, d: 0 },
  producerInputs: { dealsPerMonth: 0, avgCommissionPerDeal: 0, splitPct: 0, fixedBonusPerDeal: 0, monthlyRetainer: 0 },
  teamSize: 5,
  teamAvgGDC: 40_000,
  overrideRate: 10,
  channelSpend: {},
};

// ─── RETIREMENT INCOME ENGINEERING ─────────────────────────────

describe('Bucket Strategy', () => {
  it('creates 3 buckets with correct labels', () => {
    const result = calcBucketStrategy(1_000_000, 50_000, 24_000, 0);
    expect(result.buckets).toHaveLength(3);
    expect(result.buckets[0].label).toContain('Near');
    expect(result.buckets[1].label).toContain('Mid');
    expect(result.buckets[2].label).toContain('Long');
  });

  it('allocations sum to portfolio', () => {
    const result = calcBucketStrategy(1_000_000, 50_000, 24_000, 0);
    const totalAlloc = result.buckets.reduce((s, b) => s + b.allocation, 0);
    expect(totalAlloc).toBeCloseTo(1_000_000, -2);
  });

  it('near-term bucket covers spending gap', () => {
    const result = calcBucketStrategy(500_000, 40_000, 20_000, 0);
    // Net spend = 40k - 20k = 20k, near-term = 3 years = 60k
    expect(result.buckets[0].allocation).toBeGreaterThanOrEqual(50_000);
  });

  it('handles zero portfolio gracefully', () => {
    const result = calcBucketStrategy(0, 40_000, 20_000, 0);
    expect(result.buckets).toHaveLength(3);
    const totalAlloc = result.buckets.reduce((s, b) => s + b.allocation, 0);
    expect(totalAlloc).toBe(0);
  });

  it('generates refill schedule', () => {
    const result = calcBucketStrategy(1_000_000, 50_000, 24_000, 0);
    expect(result.refillSchedule.length).toBeGreaterThan(0);
  });

  it('calculates sustainability years', () => {
    const result = calcBucketStrategy(1_000_000, 50_000, 24_000, 0);
    expect(result.sustainabilityYears).toBeGreaterThan(10);
  });
});

describe('Floor-Upside Strategy', () => {
  it('separates floor and upside correctly', () => {
    const result = calcFloorUpside(24_000, 0, 0, 1_000_000, 0.04, 50_000);
    expect(result.totalFloor).toBe(24_000);
    expect(result.totalUpside).toBeGreaterThan(0);
    expect(result.totalIncome).toBe(result.totalFloor + result.totalUpside);
  });

  it('floor income includes all guaranteed sources', () => {
    const result = calcFloorUpside(20_000, 10_000, 5_000, 500_000, 0.04, 40_000);
    expect(result.totalFloor).toBe(35_000);
    expect(result.floor.length).toBe(3); // SS + Pension + Annuity
  });

  it('calculates floor coverage percentage', () => {
    const result = calcFloorUpside(30_000, 0, 0, 500_000, 0.04, 40_000);
    expect(result.floorCoversPct).toBeCloseTo(0.75, 1);
  });
});

describe('Guyton-Klinger Guardrails', () => {
  it('returns year-by-year projections', () => {
    const result = calcGuytonKlinger(1_000_000, 0.04, 0.03, 30);
    expect(result.projectedYears.length).toBe(30);
    expect(result.projectedYears[0].year).toBe(1);
    expect(result.projectedYears[0].withdrawal).toBeGreaterThan(0);
  });

  it('has ceiling and floor rates', () => {
    const result = calcGuytonKlinger(1_000_000, 0.04, 0.03, 30);
    expect(result.ceilingRate).toBeGreaterThan(0.04);
    expect(result.floorRate).toBeLessThan(0.04);
  });

  it('initial withdrawal matches rate * portfolio', () => {
    const result = calcGuytonKlinger(1_000_000, 0.04, 0.03, 30);
    expect(result.initialWithdrawal).toBe(40_000);
  });

  it('defines guardrails', () => {
    const result = calcGuytonKlinger(1_000_000, 0.04, 0.03, 30);
    expect(result.guardrails.length).toBeGreaterThan(0);
  });
});

describe('Roth Conversion Ladder', () => {
  it('generates conversion plan for specified years', () => {
    const result = calcRothLadder(55, 65, 500_000, 60_000, 'single', 0.05, 0.8);
    expect(result.years.length).toBeGreaterThan(0);
    expect(result.totalConverted).toBeGreaterThan(0);
  });

  it('respects bracket fill target', () => {
    const result = calcRothLadder(50, 65, 1_000_000, 40_000, 'single', 0.05, 0.5);
    // Each year should convert some amount
    result.years.forEach(y => {
      expect(y.age).toBeGreaterThanOrEqual(50);
    });
  });

  it('calculates total tax paid', () => {
    const result = calcRothLadder(55, 65, 500_000, 60_000, 'single', 0.05, 0.8);
    expect(result.totalTaxPaid).toBeGreaterThan(0);
  });

  it('projects tax saved', () => {
    const result = calcRothLadder(55, 65, 500_000, 60_000, 'single', 0.05, 0.8);
    expect(result.projectedTaxSaved).toBeGreaterThan(0);
  });
});

// ─── ROLL-UP UNIFICATION ───────────────────────────────────────

describe('Unified P&L', () => {
  const plan = calcUnifiedIncomePlan(baseParams);

  it('calculates P&L with all channels', () => {
    const pnl = calcUnifiedPnL(plan, []);
    expect(pnl.totalRevenue).toBeGreaterThan(0);
    expect(pnl.grossProfit).toBeLessThanOrEqual(pnl.totalRevenue);
    expect(pnl.netIncome).toBeLessThanOrEqual(pnl.grossProfit);
  });

  it('gross margin is between 0 and 100%', () => {
    const pnl = calcUnifiedPnL(plan, []);
    expect(pnl.grossMarginPct).toBeGreaterThanOrEqual(0);
    expect(pnl.grossMarginPct).toBeLessThanOrEqual(100);
  });

  it('net margin is less than gross margin', () => {
    const pnl = calcUnifiedPnL(plan, []);
    expect(pnl.netMarginPct).toBeLessThanOrEqual(pnl.grossMarginPct);
  });

  it('includes GDC bracket analysis', () => {
    const pnl = calcUnifiedPnL(plan, []);
    expect(pnl.currentBracket).toBeDefined();
    expect(pnl.currentBracket.l).toBeDefined();
  });

  it('includes channel breakdown', () => {
    const pnl = calcUnifiedPnL(plan, []);
    expect(pnl.channelBreakdown.length).toBeGreaterThan(0);
    pnl.channelBreakdown.forEach(cb => {
      expect(cb.channel).toBeDefined();
      expect(cb.revenue).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('GDC Bracket Analysis', () => {
  it('identifies current bracket correctly', () => {
    const bracket = getBracket(80_000);
    expect(bracket).toBeDefined();
    expect(bracket.mn).toBeLessThanOrEqual(80_000);
  });

  it('handles top bracket correctly', () => {
    const topBracket = GDC_BRACKETS[GDC_BRACKETS.length - 1];
    const bracket = getBracket(topBracket.mn + 100_000);
    expect(bracket.l).toBe(topBracket.l);
  });

  it('P&L calculates gap to next bracket', () => {
    const plan = calcUnifiedIncomePlan(baseParams);
    const pnl = calcUnifiedPnL(plan, []);
    if (pnl.nextBracket) {
      expect(pnl.gdcToNextBracket).toBeGreaterThan(0);
    }
  });
});

describe('Roll-Up Chart Data', () => {
  // calcRollUpChartData takes (points: TimePhasedPoint[], targetIncome, viewMode)
  // We need to generate time-phased points first
  const plan = calcUnifiedIncomePlan(baseParams);
  // Create mock time-phased points (12 months)
  const mockPoints = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    label: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i],
    gdc: Math.round(plan.channels.gdc.projected / 12),
    aum: Math.round(plan.channels.aum.detail.projectedIncome / 12),
    affiliate: Math.round(plan.channels.affiliate.totalProjected / 12),
    override: Math.round(plan.channels.override.detail.projectedIncome / 12),
    channel: Math.round(plan.channels.channel.detail.projectedAnnualRevenue / 12),
    total: 0, cumulative: 0,
  }));
  mockPoints.forEach(p => { p.total = p.gdc + p.aum + p.affiliate + p.override + p.channel; });

  it('generates monthly chart data with labels and datasets', () => {
    const chartData = calcRollUpChartData(mockPoints, 200_000, 'monthly');
    expect(chartData.labels.length).toBe(12);
    expect(chartData.datasets.length).toBeGreaterThan(0);
  });

  it('generates quarterly chart data', () => {
    const chartData = calcRollUpChartData(mockPoints, 200_000, 'quarterly');
    expect(chartData.labels.length).toBe(4);
    expect(chartData.labels[0]).toContain('Q1');
  });

  it('generates annual chart data', () => {
    const chartData = calcRollUpChartData(mockPoints, 200_000, 'annual');
    expect(chartData.labels.length).toBe(1);
    expect(chartData.totals[0]).toBeGreaterThan(0);
  });

  it('datasets have correct structure', () => {
    const chartData = calcRollUpChartData(mockPoints, 200_000, 'monthly');
    chartData.datasets.forEach(ds => {
      expect(ds.label).toBeDefined();
      expect(ds.data.length).toBe(12);
      expect(ds.color).toBeDefined();
    });
  });
});

// ─── CONFIGURABLE DEFAULTS ─────────────────────────────────────

describe('Engine Configuration', () => {
  it('DEFAULT_ENGINE_CONFIG has all required fields', () => {
    expect(DEFAULT_ENGINE_CONFIG).toBeDefined();
    expect(DEFAULT_ENGINE_CONFIG.defaultFunnelRates).toBeDefined();
    expect(DEFAULT_ENGINE_CONFIG.defaultTaxRate).toBeGreaterThan(0);
    expect(DEFAULT_ENGINE_CONFIG.defaultOpExPct).toBeGreaterThan(0);
    expect(DEFAULT_ENGINE_CONFIG.defaultAumTrailPct).toBeGreaterThan(0);
    expect(DEFAULT_ENGINE_CONFIG.defaultComplexity).toBeDefined();
  });

  it('mergeEngineConfig preserves unset fields', () => {
    const merged = mergeEngineConfig({ defaultTaxRate: 0.30 });
    expect(merged.defaultTaxRate).toBe(0.30);
    expect(merged.defaultFunnelRates).toEqual(DEFAULT_ENGINE_CONFIG.defaultFunnelRates);
    expect(merged.defaultOpExPct).toBe(DEFAULT_ENGINE_CONFIG.defaultOpExPct);
  });

  it('mergeEngineConfig overrides specified fields', () => {
    const merged = mergeEngineConfig({
      defaultAffMode: 'producer' as any,
      defaultTaxRate: 0.35,
      defaultOpExPct: 0.20,
    });
    expect(merged.defaultAffMode).toBe('producer');
    expect(merged.defaultTaxRate).toBe(0.35);
    expect(merged.defaultOpExPct).toBe(0.20);
  });
});

// ─── AUM OVERRIDE RATE ─────────────────────────────────────────

describe('AUM Override Rate in Unified Plan', () => {
  it('applies override rate to AUM income', () => {
    const plan100 = calcUnifiedIncomePlan({
      ...baseParams,
      splits: { gdc: 0, aum: 100, affiliate: 0, override: 0, channel: 0 },
      enabledChannels: { gdc: false, aum: true, affiliate: false, override: false, channel: false },
      aumOverrideRate: 100,
    });

    const plan50 = calcUnifiedIncomePlan({
      ...baseParams,
      splits: { gdc: 0, aum: 100, affiliate: 0, override: 0, channel: 0 },
      enabledChannels: { gdc: false, aum: true, affiliate: false, override: false, channel: false },
      aumOverrideRate: 50,
    });

    // 50% override should produce ~50% of 100% override income
    const ratio = plan50.channels.aum.detail.projectedIncome / plan100.channels.aum.detail.projectedIncome;
    expect(ratio).toBeCloseTo(0.5, 1);
  });
});

// ─── FLEXIBLE AFFILIATE INCOME (PRODUCER MODE) ────────────────

describe('Producer Affiliate Income', () => {
  it('calculates producer income from deals and bonuses', () => {
    const result = calcProducerAffiliateIncome({
      dealsPerMonth: 10,
      avgCommissionPerDeal: 5_000,
      splitPct: 50,
      fixedBonusPerDeal: 500,
      monthlyRetainer: 2_000,
    });
    expect(result.commissionIncome).toBe(10 * 5_000 * 0.5 * 12);
    expect(result.bonusIncome).toBe(10 * 500 * 12);
    expect(result.retainerIncome).toBe(2_000 * 12);
    expect(result.annualIncome).toBe(result.commissionIncome + result.bonusIncome + result.retainerIncome);
  });

  it('handles zero deals gracefully', () => {
    const result = calcProducerAffiliateIncome({
      dealsPerMonth: 0,
      avgCommissionPerDeal: 5_000,
      splitPct: 50,
      fixedBonusPerDeal: 500,
      monthlyRetainer: 1_000,
    });
    expect(result.commissionIncome).toBe(0);
    expect(result.bonusIncome).toBe(0);
    expect(result.retainerIncome).toBe(12_000);
    expect(result.annualIncome).toBe(12_000);
  });

  it('monthly income is annual / 12', () => {
    const result = calcProducerAffiliateIncome({
      dealsPerMonth: 5,
      avgCommissionPerDeal: 3_000,
      splitPct: 60,
      fixedBonusPerDeal: 200,
      monthlyRetainer: 1_500,
    });
    expect(result.monthlyIncome).toBe(Math.round(result.annualIncome / 12));
  });
});

// ─── PDF GENERATION ────────────────────────────────────────────

describe('PDF Generation Service', () => {
  it('generates a valid PDF buffer', async () => {
    const { generatePracticePlanPdf } = await import('../server/services/practicePlanPdf');
    const buffer = await generatePracticePlanPdf({
      planName: 'Test Plan',
      role: 'Experienced Professional',
      generatedAt: '2026-04-16',
      targetIncome: 200_000,
      totalProjected: 185_000,
      totalGap: 15_000,
      channels: [
        { name: 'GDC', enabled: true, splitPct: 40, target: 80_000, projected: 75_000, gap: 5_000 },
        { name: 'AUM', enabled: true, splitPct: 25, target: 50_000, projected: 48_000, gap: 2_000 },
      ],
    });
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
    // PDF magic bytes
    expect(buffer.slice(0, 5).toString()).toBe('%PDF-');
  });

  it('includes P&L data when provided', async () => {
    const { generatePracticePlanPdf } = await import('../server/services/practicePlanPdf');
    const buffer = await generatePracticePlanPdf({
      planName: 'P&L Test',
      role: 'Senior',
      generatedAt: '2026-04-16',
      targetIncome: 300_000,
      totalProjected: 310_000,
      totalGap: -10_000,
      channels: [
        { name: 'GDC', enabled: true, splitPct: 100, target: 300_000, projected: 310_000, gap: -10_000 },
      ],
      pnl: {
        totalRevenue: 310_000,
        totalCOGS: 62_000,
        grossProfit: 248_000,
        grossMarginPct: 80,
        opEx: 31_000,
        ebitda: 217_000,
        ebitdaMarginPct: 70,
        estimatedTax: 54_250,
        netIncome: 162_750,
        netMarginPct: 52.5,
      },
    });
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(2000);
  });

  it('includes sensitivity data when provided', async () => {
    const { generatePracticePlanPdf } = await import('../server/services/practicePlanPdf');
    const buffer = await generatePracticePlanPdf({
      planName: 'Sensitivity Test',
      role: 'New',
      generatedAt: '2026-04-16',
      targetIncome: 100_000,
      totalProjected: 95_000,
      totalGap: 5_000,
      channels: [],
      sensitivity: [
        { variable: 'Target GDC', baseValue: 50_000, impact: 15_000 },
        { variable: 'AUM Trail %', baseValue: 1, impact: -8_000 },
      ],
    });
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
  });
});
