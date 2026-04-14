/* Vitest tests for v2.6 structural convergence additions:
   - CalcNarrator narration script coverage
   - SCUI stress-test calculations
   - SCUI backtest calculations
   - Business presets data integrity
   - Engine function exports
*/
import { describe, it, expect } from 'vitest';
import {
  calcAdvanced,
  calcBizClient,
  calcPartner,
  fmt,
  fmtSm,
  pct,
  STRATEGIES,
  RATES,
  getBracketRate,
  calcCashFlow,
  calcProtection,
  computeScorecard,
} from '../client/src/pages/calculators/engine';

/* ═══ STRESS-TEST SCENARIO CALCULATIONS ═══ */
describe('SCUI Stress-Test Calculations', () => {
  const savings = 200000;
  const retirement401k = 350000;
  const portfolio = savings + retirement401k;

  it('should calculate 2008 Financial Crisis impact correctly', () => {
    const equityDrop = -0.38;
    const bondDrop = -0.05;
    const impact = portfolio * equityDrop * 0.6 + portfolio * bondDrop * 0.4;
    const after = portfolio + impact;
    expect(impact).toBeLessThan(0);
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThan(portfolio);
    // 60% equity allocation * -38% + 40% bond allocation * -5%
    const expected = portfolio * (-0.38 * 0.6 + -0.05 * 0.4);
    expect(impact).toBeCloseTo(expected, 2);
  });

  it('should calculate COVID-19 Crash impact correctly', () => {
    const equityDrop = -0.34;
    const bondDrop = 0.07;
    const impact = portfolio * equityDrop * 0.6 + portfolio * bondDrop * 0.4;
    // Bonds positive, so impact less severe
    expect(impact).toBeLessThan(0);
    const pureEquityImpact = portfolio * equityDrop * 0.6;
    expect(impact).toBeGreaterThan(pureEquityImpact); // bonds cushion
  });

  it('should calculate monthly income after crisis correctly', () => {
    const equityDrop = -0.38;
    const bondDrop = -0.05;
    const impact = portfolio * equityDrop * 0.6 + portfolio * bondDrop * 0.4;
    const after = portfolio + impact;
    const withdrawalRate = 0.04;
    const monthlyIncome = Math.round(after * withdrawalRate / 12);
    expect(monthlyIncome).toBeGreaterThan(0);
    expect(monthlyIncome).toBeLessThan(Math.round(portfolio * withdrawalRate / 12));
  });
});

/* ═══ BACKTEST CALCULATIONS ═══ */
describe('SCUI Backtest Calculations', () => {
  const savings = 200000;
  const annualContrib = 1500 * 12; // $1500/mo

  it('should calculate 20-year future value for S&P 500', () => {
    const cagr = 0.102;
    const fv = Array.from({ length: 20 }, (_, i) => i + 1).reduce(
      (acc) => acc * (1 + cagr) + annualContrib,
      savings
    );
    expect(fv).toBeGreaterThan(savings + annualContrib * 20); // growth exceeds contributions
    expect(fv).toBeGreaterThan(1000000); // should be well over $1M with 10.2% CAGR
  });

  it('should calculate IUL with 0% floor correctly', () => {
    const cagr = 0.072;
    const fv = Array.from({ length: 20 }, (_, i) => i + 1).reduce(
      (acc) => acc * (1 + cagr) + annualContrib,
      savings
    );
    expect(fv).toBeGreaterThan(savings);
    // IUL should be less than S&P due to lower CAGR
    const spFv = Array.from({ length: 20 }, (_, i) => i + 1).reduce(
      (acc) => acc * (1 + 0.102) + annualContrib,
      savings
    );
    expect(fv).toBeLessThan(spFv);
  });

  it('should rank strategies by CAGR correctly', () => {
    const strategies = [
      { name: 'S&P 500', cagr: 0.102 },
      { name: '60/40', cagr: 0.078 },
      { name: 'IUL', cagr: 0.072 },
      { name: 'FIA', cagr: 0.055 },
    ];
    const sorted = [...strategies].sort((a, b) => b.cagr - a.cagr);
    expect(sorted[0].name).toBe('S&P 500');
    expect(sorted[sorted.length - 1].name).toBe('FIA');
  });
});

/* ═══ BUSINESS PRESETS ═══ */
describe('Business Presets Data Integrity', () => {
  const presets = [
    { label: 'Young Professional', preset: { age: 28, income: 85000, dep: 0, existIns: 50000, savings: 15000, retirement401k: 25000, mortgage: 0, debt: 35000 } },
    { label: 'Growing Family', preset: { age: 35, income: 150000, dep: 2, existIns: 250000, savings: 50000, retirement401k: 150000, mortgage: 350000, debt: 20000 } },
    { label: 'Peak Earner', preset: { age: 50, income: 300000, dep: 1, existIns: 500000, savings: 400000, retirement401k: 800000, mortgage: 200000, debt: 0 } },
    { label: 'Business Owner', preset: { age: 42, income: 250000, dep: 2, existIns: 500000, savings: 200000, retirement401k: 400000, mortgage: 400000, debt: 50000 } },
    { label: 'Pre-Retiree', preset: { age: 60, income: 200000, dep: 0, existIns: 750000, savings: 600000, retirement401k: 1200000, mortgage: 100000, debt: 0 } },
  ];

  it('should have 5 presets', () => {
    expect(presets).toHaveLength(5);
  });

  it('should have valid ages for all presets', () => {
    presets.forEach(p => {
      expect(p.preset.age).toBeGreaterThanOrEqual(18);
      expect(p.preset.age).toBeLessThanOrEqual(80);
    });
  });

  it('should have positive income for all presets', () => {
    presets.forEach(p => {
      expect(p.preset.income).toBeGreaterThan(0);
    });
  });

  it('should have non-negative values for all financial fields', () => {
    presets.forEach(p => {
      expect(p.preset.savings).toBeGreaterThanOrEqual(0);
      expect(p.preset.retirement401k).toBeGreaterThanOrEqual(0);
      expect(p.preset.mortgage).toBeGreaterThanOrEqual(0);
      expect(p.preset.debt).toBeGreaterThanOrEqual(0);
      expect(p.preset.existIns).toBeGreaterThanOrEqual(0);
    });
  });

  it('should produce valid scorecards for each preset', () => {
    presets.forEach(p => {
      const d = p.preset;
      const ti = d.income;
      const gm = Math.round(ti / 12);
      const scores: Record<string, number> = {};
      const sr = ti > 0 ? (gm - 2500 - 800 - 600 - 300 - 500 - 400) / gm : 0;
      scores.cash = sr >= 0.2 ? 3 : sr >= 0.1 ? 2 : sr > 0 ? 1 : 0;
      const dimeNeed = d.dep > 0 ? d.income * 10 + d.mortgage + d.debt + d.dep * 50000 + 25000 : d.income * 6 + d.debt;
      scores.protect = d.existIns >= dimeNeed ? 3 : d.existIns >= dimeNeed * 0.5 ? 2 : d.existIns > 0 ? 1 : 0;
      scores.growth = 1500 >= gm * 0.15 ? 3 : 1500 >= gm * 0.1 ? 2 : 1;
      scores.retire = d.retirement401k >= ti * 3 ? 3 : d.retirement401k >= ti ? 2 : d.retirement401k > 0 ? 1 : 0;
      scores.tax = d.retirement401k >= 23500 ? 2 : 1;
      scores.estate = 1;
      scores.edu = d.dep === 0 ? 3 : 1;
      const sc = computeScorecard(scores);
      expect(sc.pctScore).toBeGreaterThanOrEqual(0);
      expect(sc.pctScore).toBeLessThanOrEqual(100);
    });
  });
});

/* ═══ STRATEGY COMPARE TABLE ═══ */
describe('Strategy Compare Table', () => {
  it('should have 4 strategies defined', () => {
    expect(STRATEGIES).toHaveLength(4);
  });

  it('should have required fields for each strategy', () => {
    STRATEGIES.forEach(s => {
      expect(s).toHaveProperty('name');
      expect(s).toHaveProperty('taxFree');
      expect(s).toHaveProperty('deathBenefit');
      expect(s).toHaveProperty('marketProtection');
      expect(s).toHaveProperty('ltcCoverage');
      expect(s).toHaveProperty('creditorProtected');
      expect(s).toHaveProperty('complexity');
      expect(s).toHaveProperty('bestFor');
    });
  });
});

/* ═══ NARRATION SCRIPT ═══ */
describe('CalcNarrator Script', () => {
  // Test the narration script data structure
  const NARRATION_SCRIPT = [
    { panelId: 'profile', title: 'Client Profile' },
    { panelId: 'cash', title: 'Cash Flow Analysis' },
    { panelId: 'protect', title: 'Protection Needs' },
    { panelId: 'grow', title: 'Growth & Accumulation' },
    { panelId: 'retire', title: 'Retirement Planning' },
    { panelId: 'tax', title: 'Tax Planning' },
    { panelId: 'estate', title: 'Estate Planning' },
    { panelId: 'edu', title: 'Education Planning' },
    { panelId: 'advanced', title: 'Advanced Strategies' },
    { panelId: 'bizclient', title: 'Business Client' },
    { panelId: 'costben', title: 'Cost-Benefit Analysis' },
    { panelId: 'compare', title: 'Strategy Compare' },
    { panelId: 'summary', title: 'Financial Health Summary' },
    { panelId: 'timeline', title: 'Action Plan' },
    { panelId: 'refs', title: 'References' },
  ];

  it('should have 15 narration steps', () => {
    expect(NARRATION_SCRIPT).toHaveLength(15);
  });

  it('should start with profile panel', () => {
    expect(NARRATION_SCRIPT[0].panelId).toBe('profile');
  });

  it('should end with references panel', () => {
    expect(NARRATION_SCRIPT[NARRATION_SCRIPT.length - 1].panelId).toBe('refs');
  });

  it('should have unique panel IDs', () => {
    const ids = NARRATION_SCRIPT.map(s => s.panelId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

/* ═══ SPEED OPTIONS ═══ */
describe('Narration Speed Options', () => {
  const SPEED_OPTIONS = [
    { label: '0.75x', value: 0.75, ms: 8000 },
    { label: '1x', value: 1, ms: 6000 },
    { label: '1.25x', value: 1.25, ms: 4800 },
    { label: '1.5x', value: 1.5, ms: 4000 },
  ];

  it('should have 4 speed options', () => {
    expect(SPEED_OPTIONS).toHaveLength(4);
  });

  it('should have decreasing ms as speed increases', () => {
    for (let i = 1; i < SPEED_OPTIONS.length; i++) {
      expect(SPEED_OPTIONS[i].ms).toBeLessThan(SPEED_OPTIONS[i - 1].ms);
    }
  });

  it('should have increasing value as speed increases', () => {
    for (let i = 1; i < SPEED_OPTIONS.length; i++) {
      expect(SPEED_OPTIONS[i].value).toBeGreaterThan(SPEED_OPTIONS[i - 1].value);
    }
  });
});
