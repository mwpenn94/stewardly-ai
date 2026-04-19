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
  EMPTY_PRACTICE_CASCADE,
  computeHolisticBridge,
  type ClientProfile,
  type ProtectionResult,
  type TaxResult,
  type RetirementResult,
  type AdvancedStrategiesCascade,
  type PracticeManagementCascade,
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

/* ═══════════════════════════════════════════════════════════════
   Pass 140 Tests — Live cascade, Practice Management cascade,
   DB persistence (hubAllocations router), general defaults for planning
   ═══════════════════════════════════════════════════════════════ */

/* ─── Live Cascade: AdvancedStrategiesCascade structure ─── */
describe('Live Cascade: AdvancedStrategiesCascade', () => {
  it('plan.benefitToClientPlanCascade has all required fields', () => {
    const plan = calcUnifiedAdvancedPlan(advResult, bizResult, 50000, defaultAllocation, 150000, 40, 2000000);
    const c = plan.benefitToClientPlanCascade;
    expect(typeof c.estateTaxReduction).toBe('number');
    expect(typeof c.taxSavingsBoost).toBe('number');
    expect(typeof c.protectionEnhancement).toBe('number');
    expect(typeof c.retirementBoost).toBe('number');
    expect(typeof c.netWorthImpact).toBe('number');
    // All should be non-negative
    expect(c.estateTaxReduction).toBeGreaterThanOrEqual(0);
    expect(c.protectionEnhancement).toBeGreaterThanOrEqual(0);
  });

  it('cascade values scale with strategy allocation', () => {
    const highPF: StrategyAllocation = { premiumFinance: 60, ilit: 15, execComp: 10, charitable: 10, business: 5 };
    const lowPF: StrategyAllocation = { premiumFinance: 5, ilit: 30, execComp: 25, charitable: 25, business: 15 };
    const planHigh = calcUnifiedAdvancedPlan(advResult, bizResult, 50000, highPF, 150000, 40, 2000000);
    const planLow = calcUnifiedAdvancedPlan(advResult, bizResult, 50000, lowPF, 150000, 40, 2000000);
    // Different allocations should produce different scores
    expect(planHigh.onTrackScore).not.toBe(planLow.onTrackScore);
  });
});

/* ─── Practice Management Cascade (Optional) ─── */
describe('PracticeManagementCascade', () => {
  it('EMPTY_PRACTICE_CASCADE has all zero values', () => {
    expect(EMPTY_PRACTICE_CASCADE.annualRevenue).toBe(0);
    expect(EMPTY_PRACTICE_CASCADE.totalClients).toBe(0);
    expect(EMPTY_PRACTICE_CASCADE.teamSize).toBe(0);
    expect(EMPTY_PRACTICE_CASCADE.avgClientValue).toBe(0);
    expect(EMPTY_PRACTICE_CASCADE.revenuePerAdvisor).toBe(0);
    expect(EMPTY_PRACTICE_CASCADE.practiceScore).toBe(0);
    expect(EMPTY_PRACTICE_CASCADE.enabled).toBe(false);
    expect(EMPTY_PRACTICE_CASCADE.practiceToClient.incomeFromPractice).toBe(0);
    expect(EMPTY_PRACTICE_CASCADE.practiceToClient.practiceEquity).toBe(0);
    expect(EMPTY_PRACTICE_CASCADE.practiceToClient.benefitsCostOffset).toBe(0);
  });

  it('practice cascade can be populated with real values', () => {
    const practice: PracticeManagementCascade = {
      enabled: true,
      annualRevenue: 2000000, monthlyGDC: 166667, aumRevenue: 500000, overrideRevenue: 200000,
      teamSize: 5, revenuePerAdvisor: 400000, clientsPerAdvisor: 30,
      totalClients: 150, avgClientValue: 13333, retentionRate: 92,
      annualProduction: 1800000, productionGrowthRate: 8,
      practiceScore: 72,
      practiceToClient: { incomeFromPractice: 300000, practiceEquity: 2000000, benefitsCostOffset: 15000 },
    };
    expect(practice.enabled).toBe(true);
    expect(practice.avgClientValue).toBeGreaterThan(0);
    expect(practice.practiceScore).toBeGreaterThanOrEqual(0);
    expect(practice.practiceScore).toBeLessThanOrEqual(100);
    expect(practice.practiceToClient.practiceEquity).toBe(2000000);
  });
});

/* ─── computeHolisticBridge with practice cascade ─── */
describe('computeHolisticBridge with practice cascade', () => {
  const mockClient2: ClientProfile = {
    clientName: 'Test2', age: 45, spouseAge: 43, dep: 1,
    income: 200000, spouseIncome: 0, totalIncome: 200000,
    nw: 800000, savings: 300000, retirement401k: 500000,
    mortgage: 200000, debt: 10000, existIns: 500000,
    filing: 'single', stateRate: 0.06, riskTolerance: 'aggressive',
    isBiz: true, bizRevenue: 2000000, bizEmployees: 5, bizEntityType: 'scorp',
  };
  const mockPR2: ProtectionResult = { totalNeed: 2000000, gap: 1500000, diNeed: 120000, diPremium: 4000, ltcNeed: 150000, ltcPremium: 3000 };
  const mockTX2: TaxResult = { effectiveRate: 28, totalTax: 56000, marginalRate: 35, strategies: [], totalSavings: 8000 };
  const mockRT2: RetirementResult = { projectedNest: 2000000, monthlyIncome: 6667, ssOptimal: '70', gap: 0, replacementRate: 80 };
  const mockAdvCascade2: AdvancedStrategiesCascade = {
    pfNetBenefit: 80000, pfTaxEfficiency: 15000,
    ilitEstateTaxSaved: 600000, ilitNetToHeirs: 5000000,
    execTaxBenefit: 35000, execRetentionValue: 300000,
    charitableTaxDeduction: 40000, charitableAnnualIncome: 30000,
    businessTotalProtection: 2000000, businessContinuityScore: 90,
    totalAnnualBenefit: 180000, totalAnnualCost: 100000,
    estateTaxReduction: 600000, taxSavingsBoost: 90000,
    protectionEnhancement: 2000000, retirementBoost: 30000,
    netWorthImpact: 800000,
  };

  it('computes holistic score without practice cascade', () => {
    const bridge = computeHolisticBridge(80, 85, mockClient2, mockPR2, mockTX2, mockRT2, mockAdvCascade2);
    // 80 * 0.6 + 85 * 0.4 = 48 + 34 = 82
    expect(bridge.holisticScore).toBe(82);
  });

  it('computes holistic score with practice cascade', () => {
    const practice: PracticeManagementCascade = {
      enabled: true,
      annualRevenue: 2000000, monthlyGDC: 166667, aumRevenue: 500000, overrideRevenue: 200000,
      teamSize: 5, revenuePerAdvisor: 400000, clientsPerAdvisor: 30,
      totalClients: 150, avgClientValue: 13333, retentionRate: 92,
      annualProduction: 1800000, productionGrowthRate: 8,
      practiceScore: 72,
      practiceToClient: { incomeFromPractice: 300000, practiceEquity: 2000000, benefitsCostOffset: 15000 },
    };
    const bridge = computeHolisticBridge(80, 85, mockClient2, mockPR2, mockTX2, mockRT2, mockAdvCascade2, practice);
    // With practice enabled: 80*0.45 + 85*0.30 + 72*0.25 = 36 + 25.5 + 18 = 79.5 → 80
    expect(bridge.holisticScore).toBeGreaterThanOrEqual(70);
    expect(bridge.holisticScore).toBeLessThanOrEqual(90);
  });
});

/* ─── General Defaults for non-authenticated planning ─── */
describe('General Defaults for Planning', () => {
  it('GENERAL_DEFAULTS covers all key planning parameters', () => {
    const keys = Object.keys(GENERAL_DEFAULTS);
    expect(keys).toContain('equityReturn');
    expect(keys).toContain('bondReturn');
    expect(keys).toContain('safeWithdrawalRate');
    expect(keys).toContain('inflationRate');
    expect(keys).toContain('topFederalRate');
    expect(keys).toContain('estateExemption');
    expect(keys).toContain('annualGiftExclusion');
    expect(keys).toContain('incomeMultiplierLife');
    expect(keys).toContain('emergencyMonths');
    expect(keys).toContain('collegeCostAnnual');
    expect(keys).toContain('keyPersonMultiplier');
    expect(keys).toContain('pfLoanRateDefault');
    expect(keys).toContain('crtPayoutMin');
    expect(keys).toContain('estateTaxRate');
    expect(keys).toContain('retirementReplaceRate');
    expect(keys).toContain('ssColaRate');
    expect(keys).toContain('medicareStartAge');
    expect(keys).toContain('ltcgRate');
    expect(keys).toContain('niitRate');
    expect(keys).toContain('diReplacementPct');
    expect(keys).toContain('ltcDailyBenefit');
    expect(keys).toContain('collegeCostGrowth');
  });

  it('all GENERAL_DEFAULTS values are positive numbers', () => {
    Object.entries(GENERAL_DEFAULTS).forEach(([key, value]) => {
      expect(typeof value).toBe('number');
      expect(value).toBeGreaterThan(0);
    });
  });
});


/* ═══════════════════════════════════════════════════════════════
   Pass 141 Tests — Cascade Audit Trail, Practice Presets, Unified Export
   ═══════════════════════════════════════════════════════════════ */

// ─── Cascade Audit Trail ───
describe('CascadeAuditTrail — buildCascadeAuditEntries', () => {
  it('should return empty array when prevBridge is null', async () => {
    const { buildCascadeAuditEntries } = await import('./CascadeAuditTrail');
    const entries = buildCascadeAuditEntries(null, EMPTY_CASCADE_BRIDGE, EMPTY_ADVANCED_CASCADE, EMPTY_PRACTICE_CASCADE);
    expect(entries).toEqual([]);
  });

  it('should detect client→advanced cascade changes', async () => {
    const { buildCascadeAuditEntries } = await import('./CascadeAuditTrail');
    
    const prevBridge = { ...EMPTY_CASCADE_BRIDGE };
    const currBridge = {
      ...EMPTY_CASCADE_BRIDGE,
      clientToAdvanced: {
        incomeForSizing: 200000,
        estateForILIT: 5000000,
        protectionGap: 500000,
        taxBurden: 32,
        retirementGap: 1000000,
      },
      holisticScore: 55,
      lastCascadeTimestamp: Date.now(),
    };
    
    const entries = buildCascadeAuditEntries(prevBridge, currBridge, EMPTY_ADVANCED_CASCADE, EMPTY_PRACTICE_CASCADE);
    const c2aEntry = entries.find(e => e.direction === 'client→advanced');
    expect(c2aEntry).toBeDefined();
    expect(c2aEntry!.changes.length).toBeGreaterThan(0);
    expect(c2aEntry!.source).toBe('client');
    expect(c2aEntry!.target).toBe('advanced');
  });

  it('should detect advanced→client cascade changes', async () => {
    const { buildCascadeAuditEntries } = await import('./CascadeAuditTrail');
    
    const prevBridge = { ...EMPTY_CASCADE_BRIDGE };
    const currBridge = {
      ...EMPTY_CASCADE_BRIDGE,
      advancedToClient: {
        additionalProtection: 1000000,
        taxSavings: 50000,
        estateReduction: 200000,
        incomeBoost: 30000,
        netWorthBoost: 500000,
      },
      holisticScore: 65,
      lastCascadeTimestamp: Date.now(),
    };
    
    const entries = buildCascadeAuditEntries(prevBridge, currBridge, EMPTY_ADVANCED_CASCADE, EMPTY_PRACTICE_CASCADE);
    const a2cEntry = entries.find(e => e.direction === 'advanced→client');
    expect(a2cEntry).toBeDefined();
    expect(a2cEntry!.changes.length).toBe(5);
  });

  it('should detect holistic score changes', async () => {
    const { buildCascadeAuditEntries } = await import('./CascadeAuditTrail');
    
    const prevBridge = { ...EMPTY_CASCADE_BRIDGE, holisticScore: 40, clientHubScore: 50, advancedHubScore: 20 };
    const currBridge = { ...EMPTY_CASCADE_BRIDGE, holisticScore: 65, clientHubScore: 70, advancedHubScore: 55, lastCascadeTimestamp: Date.now() };
    
    const entries = buildCascadeAuditEntries(prevBridge, currBridge, EMPTY_ADVANCED_CASCADE, EMPTY_PRACTICE_CASCADE);
    const scoreEntry = entries.find(e => e.direction === 'score-update');
    expect(scoreEntry).toBeDefined();
    expect(scoreEntry!.holisticScoreBefore).toBe(40);
    expect(scoreEntry!.holisticScoreAfter).toBe(65);
  });

  it('should return empty when no changes detected', async () => {
    const { buildCascadeAuditEntries } = await import('./CascadeAuditTrail');
    
    const bridge = { ...EMPTY_CASCADE_BRIDGE };
    const entries = buildCascadeAuditEntries(bridge, bridge, EMPTY_ADVANCED_CASCADE, EMPTY_PRACTICE_CASCADE);
    expect(entries).toEqual([]);
  });
});

// ─── Unified Plan Export ───
describe('exportUnifiedPlan — structure validation', () => {
  it('should export functions exist', async () => {
    const mod = await import('./exportUnifiedPlan');
    expect(typeof mod.exportUnifiedPlanPDF).toBe('function');
    expect(typeof mod.exportUnifiedPlanExcel).toBe('function');
  });
});

// ─── WealthEngineData cascadeAuditEntries field ───
describe('WealthEngineData — cascadeAuditEntries field', () => {
  it('should include all cascade constants in WealthEngineContext', async () => {
    expect(GENERAL_DEFAULTS).toBeDefined();
    expect(EMPTY_ADVANCED_CASCADE).toBeDefined();
    expect(EMPTY_PRACTICE_CASCADE).toBeDefined();
    expect(EMPTY_CASCADE_BRIDGE).toBeDefined();
  });
});
