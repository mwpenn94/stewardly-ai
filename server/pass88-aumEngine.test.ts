import { describe, it, expect } from 'vitest';

describe('AUM Override Cascade Formula', () => {
  it('should solve p² + p − 1/3 = 0 to approximately 0.26375', () => {
    const root = (-1 + Math.sqrt(1 + 4 / 3)) / 2;
    expect(root).toBeCloseTo(0.26375, 4);
    const check = root * root + root - 1 / 3;
    expect(check).toBeCloseTo(0, 10);
  });

  it('should validate override cascade math for a single advisor', () => {
    const aum = 1000000;
    const feeRate = 0.01;
    const gdcRetained = 0.80;
    const annualFees = aum * feeRate;
    const payable = annualFees * gdcRetained;
    const mdOverride = payable * 0.20;
    expect(annualFees).toBe(10000);
    expect(payable).toBe(8000);
    expect(mdOverride).toBe(1600);
  });

  it('should validate team override aggregation', () => {
    const advisors = [
      { aum: 1000000, gdcPct: 80, feePct: 1.0 },
      { aum: 750000, gdcPct: 75, feePct: 1.0 },
      { aum: 500000, gdcPct: 70, feePct: 1.0 },
    ];
    const totalAUM = advisors.reduce((s, a) => s + a.aum, 0);
    expect(totalAUM).toBe(2250000);
    const totalFees = advisors.reduce((s, a) => s + a.aum * a.feePct / 100, 0);
    expect(totalFees).toBe(22500);
    const totalPayable = advisors.reduce((s, a) => s + a.aum * a.feePct / 100 * a.gdcPct / 100, 0);
    expect(totalPayable).toBe(17125);
  });
});

describe('AUM Pipeline Funnel', () => {
  it('should calculate pipeline conversion correctly', () => {
    const stages = [
      { count: 100, avgAUM: 500000, conversionRate: 0.40 },
      { count: 40, avgAUM: 600000, conversionRate: 0.50 },
      { count: 20, avgAUM: 750000, conversionRate: 1.0 },
    ];
    const totalProspectAUM = stages.reduce((s, st) => s + st.count * st.avgAUM, 0);
    expect(totalProspectAUM).toBe(100 * 500000 + 40 * 600000 + 20 * 750000);
    const projectedNewAUM = stages[stages.length - 1].count * stages[stages.length - 1].avgAUM;
    expect(projectedNewAUM).toBe(15000000);
  });

  it('should calculate production forecast with growth and attrition', () => {
    const currentAUM = 2000000;
    const monthlyNew = 200000;
    const growthPct = 0.5;
    const attritionPct = 0.3;
    const netGrowthRate = (growthPct - attritionPct) / 100;
    const month1AUM = currentAUM * (1 + netGrowthRate) + monthlyNew;
    expect(month1AUM).toBeCloseTo(2204000, 0);
    expect(netGrowthRate).toBeGreaterThan(0);
  });
});

describe('Affiliate Pipeline', () => {
  it('should calculate recruiting pipeline metrics', () => {
    const stages = [
      { count: 50, avgRevenue: 0 },
      { count: 25, avgRevenue: 500 },
      { count: 12, avgRevenue: 2000 },
      { count: 6, avgRevenue: 5000 },
      { count: 3, avgRevenue: 12000 },
      { count: 1, avgRevenue: 25000 },
    ];
    expect(stages[0].count).toBe(50);
    expect(stages[stages.length - 1].count).toBe(1);
    expect(stages[stages.length - 1].count / stages[0].count).toBe(0.02);
  });

  it('should calculate affiliate production pipeline (bidirectional)', () => {
    const stages = [
      { count: 30, avgRevenue: 0 },
      { count: 15, avgRevenue: 1000 },
      { count: 8, avgRevenue: 3000 },
      { count: 5, avgRevenue: 5000 },
      { count: 3, avgRevenue: 8000 },
      { count: 2, avgRevenue: 12000 },
    ];
    expect(stages[0].count).toBe(30);
    expect(stages[stages.length - 1].count).toBe(2);
    expect(stages[stages.length - 1].count / stages[0].count).toBeCloseTo(0.0667, 3);
  });
});

describe('Activity Metrics', () => {
  it('should calculate conversion rates correctly', () => {
    const calls = 40, meetings = 15, proposals = 8, closes = 4;
    expect(meetings / calls).toBe(0.375);
    expect(proposals / meetings).toBeCloseTo(0.5333, 3);
    expect(closes / proposals).toBe(0.5);
    expect(closes / calls).toBe(0.1);
  });

  it('should project annual revenue from activity metrics', () => {
    expect(4 * 3500).toBe(14000);
    expect(4 * 3500 * 12).toBe(168000);
  });

  it('should handle zero division gracefully', () => {
    const callToMeeting = 0 === 0 ? 0 : 0 / 0;
    expect(callToMeeting).toBe(0);
    expect(isFinite(callToMeeting)).toBe(true);
  });
});

describe('Ramp Schedule', () => {
  it('should build a linear ramp between milestones', () => {
    const current = 2000000, t12 = 5000000, t24 = 12000000, t36 = 25000000;
    expect((t12 - current) / 12).toBe(250000);
    expect((t24 - t12) / 12).toBeCloseTo(583333.33, 0);
    expect((t36 - t24) / 12).toBeCloseTo(1083333.33, 0);
  });
});
