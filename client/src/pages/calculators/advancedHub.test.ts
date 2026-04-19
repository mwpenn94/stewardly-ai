/* ═══════════════════════════════════════════════════════════════
   Pass 139 Tests — AdvancedStrategiesHub engine functions,
   WealthEngineContext general defaults, and holistic cascade bridge
   ═══════════════════════════════════════════════════════════════ */
import { describe, it, expect } from 'vitest';
import {
  calcAdvanced,
  calcBizClient,
  calcUnifiedAdvancedPlan,
  calcAdvancedSensitivity,
  calcAdvancedTimePhasedProjections,
  type StrategyAllocation,
} from './engine';
import {
  GENERAL_DEFAULTS,
  EMPTY_ADVANCED_CASCADE,
  EMPTY_CASCADE_BRIDGE,
  computeHolisticBridge,
  type ClientProfile,
  type ProtectionResult,
  type TaxResult,
  type RetirementResult,
  type AdvancedStrategiesCascade,
} from '@/contexts/WealthEngineContext';

/* ─── Shared test fixtures ─── */
const advResult = calcAdvanced(
  5000000, 100000, 25000, 5, 6.5, 10,
  3000000, 30000, 3, 40,
  200000, 25000, 50000, 0,
  500000, 5, 50000, 500000,
  0,
);
const bizResult = calcBizClient(1000000, 150000, 5, 2, 15, 40);
const defaultAllocation: StrategyAllocation = {
  premiumFinance: 25, ilit: 25, execComp: 20, charitable: 15, business: 15,
};

/* ─── calcUnifiedAdvancedPlan ─── */
describe('calcUnifiedAdvancedPlan', () => {
  it('returns a valid unified plan with all strategy domains', () => {
    const plan = calcUnifiedAdvancedPlan(advResult, bizResult, 50000, defaultAllocation, 150000, 40, 2000000);
    expect(plan).toBeDefined();
    expect(plan.strategies).toBeDefined();
    expect(plan.strategies.premiumFinance).toBeDefined();
    expect(plan.strategies.ilit).toBeDefined();
    expect(plan.strategies.execComp).toBeDefined();
    expect(plan.strategies.charitable).toBeDefined();
    expect(plan.strategies.business).toBeDefined();
    expect(typeof plan.totalProjectedBenefit).toBe('number');
    expect(typeof plan.totalAnnualCost).toBe('number');
    expect(typeof plan.onTrackScore).toBe('number');
    expect(plan.onTrackScore).toBeGreaterThanOrEqual(0);
    expect(plan.onTrackScore).toBeLessThanOrEqual(100);
  });

  it('respects benefit goal met logic', () => {
    const plan = calcUnifiedAdvancedPlan(advResult, bizResult, 1, defaultAllocation, 150000, 40, 2000000);
    expect(plan.goalMet).toBe(true); // Very low goal should be met
    const plan2 = calcUnifiedAdvancedPlan(advResult, bizResult, 999999999, defaultAllocation, 150000, 40, 2000000);
    expect(plan2.goalMet).toBe(false); // Impossibly high goal
  });

  it('has valid back-solve structure', () => {
    const plan = calcUnifiedAdvancedPlan(advResult, bizResult, 50000, defaultAllocation, 150000, 40, 2000000);
    expect(plan.backSolve).toBeDefined();
    expect(typeof plan.backSolve.gapToGoal).toBe('number');
    expect(typeof plan.backSolve.achievable).toBe('boolean');
    expect(typeof plan.backSolve.requiredPFAllocation).toBe('number');
  });

  it('has valid benefitToClientPlanCascade', () => {
    const plan = calcUnifiedAdvancedPlan(advResult, bizResult, 50000, defaultAllocation, 150000, 40, 2000000);
    const cascade = plan.benefitToClientPlanCascade;
    expect(typeof cascade.estateTaxReduction).toBe('number');
    expect(typeof cascade.taxSavingsBoost).toBe('number');
    expect(typeof cascade.protectionEnhancement).toBe('number');
    expect(typeof cascade.retirementBoost).toBe('number');
    expect(typeof cascade.netWorthImpact).toBe('number');
  });
});

/* ─── calcAdvancedSensitivity ─── */
describe('calcAdvancedSensitivity', () => {
  it('returns sensitivity scenarios', () => {
    const sens = calcAdvancedSensitivity(advResult, bizResult, 5, 6.5, 40, 1000000, 150000);
    expect(sens).toBeDefined();
    expect(sens.scenarios).toBeDefined();
    expect(sens.scenarios.length).toBeGreaterThanOrEqual(3);
  });

  it('each scenario has required fields', () => {
    const sens = calcAdvancedSensitivity(advResult, bizResult, 5, 6.5, 40, 1000000, 150000);
    const s = sens.scenarios[0];
    expect(typeof s.label).toBe('string');
    expect(typeof s.variable).toBe('string');
    expect(typeof s.baseValue).toBe('number');
    expect(typeof s.adjustedValue).toBe('number');
    expect(typeof s.impactOnBenefit).toBe('number');
    expect(typeof s.impactOnCost).toBe('number');
    expect(typeof s.impactPct).toBe('number');
  });

  it('has both positive and negative impact scenarios', () => {
    const sens = calcAdvancedSensitivity(advResult, bizResult, 5, 6.5, 40, 1000000, 150000);
    const impacts = sens.scenarios.map(s => s.impactOnBenefit);
    const hasPositive = impacts.some(i => i > 0);
    const hasNegative = impacts.some(i => i < 0);
    expect(hasPositive).toBe(true);
    expect(hasNegative).toBe(true);
  });
});

/* ─── calcAdvancedTimePhasedProjections ─── */
describe('calcAdvancedTimePhasedProjections', () => {
  it('returns projections for up to 30 years', () => {
    const proj = calcAdvancedTimePhasedProjections(advResult, bizResult, 30);
    expect(proj).toBeDefined();
    expect(proj.length).toBe(30);
  });

  it('has increasing cumulative cost over time', () => {
    const proj = calcAdvancedTimePhasedProjections(advResult, bizResult, 30);
    expect(proj[0].cumulativeCost).toBeLessThanOrEqual(proj[proj.length - 1].cumulativeCost);
  });

  it('each projection has required fields', () => {
    const proj = calcAdvancedTimePhasedProjections(advResult, bizResult, 30);
    const p = proj[0];
    expect(typeof p.year).toBe('number');
    expect(typeof p.pfCashValue).toBe('number');
    expect(typeof p.pfLoanBalance).toBe('number');
    expect(typeof p.pfNetBenefit).toBe('number');
    expect(typeof p.ilitEstateSavings).toBe('number');
    expect(typeof p.execRetentionValue).toBe('number');
    expect(typeof p.charitableIncome).toBe('number');
    expect(typeof p.totalBenefit).toBe('number');
    expect(typeof p.cumulativeCost).toBe('number');
  });

  it('respects year limit', () => {
    const proj = calcAdvancedTimePhasedProjections(advResult, bizResult, 10);
    expect(proj.length).toBe(10);
  });
});

/* ─── GENERAL_DEFAULTS ─── */
describe('GENERAL_DEFAULTS', () => {
  it('has all required planning default fields', () => {
    expect(GENERAL_DEFAULTS.equityReturn).toBe(7);
    expect(GENERAL_DEFAULTS.bondReturn).toBe(4);
    expect(GENERAL_DEFAULTS.safeWithdrawalRate).toBe(4);
    expect(GENERAL_DEFAULTS.inflationRate).toBe(3);
    expect(GENERAL_DEFAULTS.topFederalRate).toBe(37);
    expect(GENERAL_DEFAULTS.estateExemption).toBe(13610000);
    expect(GENERAL_DEFAULTS.annualGiftExclusion).toBe(18000);
    expect(GENERAL_DEFAULTS.incomeMultiplierLife).toBe(10);
    expect(GENERAL_DEFAULTS.emergencyMonths).toBe(6);
    expect(GENERAL_DEFAULTS.collegeCostAnnual).toBe(35000);
    expect(GENERAL_DEFAULTS.keyPersonMultiplier).toBe(5);
    expect(GENERAL_DEFAULTS.pfLoanRateDefault).toBe(5);
    expect(GENERAL_DEFAULTS.crtPayoutMin).toBe(5);
  });

  it('has reasonable value ranges', () => {
    expect(GENERAL_DEFAULTS.equityReturn).toBeGreaterThan(0);
    expect(GENERAL_DEFAULTS.equityReturn).toBeLessThan(20);
    expect(GENERAL_DEFAULTS.inflationRate).toBeGreaterThan(0);
    expect(GENERAL_DEFAULTS.inflationRate).toBeLessThan(10);
    expect(GENERAL_DEFAULTS.estateTaxRate).toBe(40);
    expect(GENERAL_DEFAULTS.retirementReplaceRate).toBe(80);
  });
});

/* ─── EMPTY cascade objects ─── */
describe('Empty cascade objects', () => {
  it('EMPTY_ADVANCED_CASCADE has all zero values', () => {
    expect(EMPTY_ADVANCED_CASCADE.pfNetBenefit).toBe(0);
    expect(EMPTY_ADVANCED_CASCADE.totalAnnualBenefit).toBe(0);
    expect(EMPTY_ADVANCED_CASCADE.netWorthImpact).toBe(0);
  });

  it('EMPTY_CASCADE_BRIDGE has zero scores and none direction', () => {
    expect(EMPTY_CASCADE_BRIDGE.holisticScore).toBe(0);
    expect(EMPTY_CASCADE_BRIDGE.cascadeDirection).toBe('none');
    expect(EMPTY_CASCADE_BRIDGE.clientToAdvanced.incomeForSizing).toBe(0);
  });
});

/* ─── computeHolisticBridge ─── */
describe('computeHolisticBridge', () => {
  const mockClient: ClientProfile = {
    clientName: 'Test', age: 40, spouseAge: 38, dep: 2,
    income: 150000, spouseIncome: 50000, totalIncome: 200000,
    nw: 500000, savings: 200000, retirement401k: 350000,
    mortgage: 300000, debt: 25000, existIns: 250000,
    filing: 'mfj', stateRate: 0.05, riskTolerance: 'moderate',
    isBiz: false, bizRevenue: 0, bizEmployees: 0, bizEntityType: 'llc',
  };
  const mockPR: ProtectionResult = { totalNeed: 2000000, gap: 1750000, diNeed: 90000, diPremium: 3000, ltcNeed: 109500, ltcPremium: 2500 };
  const mockTX: TaxResult = { effectiveRate: 22, totalTax: 44000, marginalRate: 32, strategies: [], totalSavings: 5000 };
  const mockRT: RetirementResult = { projectedNest: 1500000, monthlyIncome: 5000, ssOptimal: '67', gap: 2000, replacementRate: 60 };
  const mockAdvCascade: AdvancedStrategiesCascade = {
    pfNetBenefit: 50000, pfTaxEfficiency: 10000,
    ilitEstateTaxSaved: 400000, ilitNetToHeirs: 3000000,
    execTaxBenefit: 28000, execRetentionValue: 250000,
    charitableTaxDeduction: 30000, charitableAnnualIncome: 25000,
    businessTotalProtection: 1500000, businessContinuityScore: 85,
    totalAnnualBenefit: 120000, totalAnnualCost: 80000,
    estateTaxReduction: 400000, taxSavingsBoost: 68000,
    protectionEnhancement: 1500000, retirementBoost: 25000,
    netWorthImpact: 500000,
  };

  it('computes a weighted holistic score', () => {
    const bridge = computeHolisticBridge(75, 80, mockClient, mockPR, mockTX, mockRT, mockAdvCascade);
    // 75 * 0.6 + 80 * 0.4 = 45 + 32 = 77
    expect(bridge.holisticScore).toBe(77);
    expect(bridge.clientHubScore).toBe(75);
    expect(bridge.advancedHubScore).toBe(80);
  });

  it('sets bidirectional cascade when advanced has benefits', () => {
    const bridge = computeHolisticBridge(75, 80, mockClient, mockPR, mockTX, mockRT, mockAdvCascade);
    expect(bridge.cascadeDirection).toBe('bidirectional');
  });

  it('sets client→advanced when no advanced benefits', () => {
    const bridge = computeHolisticBridge(75, 0, mockClient, mockPR, mockTX, mockRT, EMPTY_ADVANCED_CASCADE);
    expect(bridge.cascadeDirection).toBe('client→advanced');
  });

  it('populates clientToAdvanced from client profile', () => {
    const bridge = computeHolisticBridge(75, 80, mockClient, mockPR, mockTX, mockRT, mockAdvCascade);
    expect(bridge.clientToAdvanced.incomeForSizing).toBe(200000);
    expect(bridge.clientToAdvanced.protectionGap).toBe(1750000);
    expect(bridge.clientToAdvanced.taxBurden).toBe(22);
    expect(bridge.clientToAdvanced.retirementGap).toBe(2000);
  });

  it('populates advancedToClient from cascade data', () => {
    const bridge = computeHolisticBridge(75, 80, mockClient, mockPR, mockTX, mockRT, mockAdvCascade);
    expect(bridge.advancedToClient.additionalProtection).toBe(1500000);
    expect(bridge.advancedToClient.taxSavings).toBe(68000);
    expect(bridge.advancedToClient.estateReduction).toBe(400000);
    expect(bridge.advancedToClient.incomeBoost).toBe(25000);
    expect(bridge.advancedToClient.netWorthBoost).toBe(500000);
  });

  it('sets a recent timestamp', () => {
    const before = Date.now();
    const bridge = computeHolisticBridge(75, 80, mockClient, mockPR, mockTX, mockRT, mockAdvCascade);
    expect(bridge.lastCascadeTimestamp).toBeGreaterThanOrEqual(before);
  });
});
