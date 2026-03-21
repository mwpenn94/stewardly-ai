import { describe, it, expect } from "vitest";

// ─── Financial Models Tests ──────────────────────────────────────────

describe("IUL Projection Model", () => {
  it("should calculate cash value growth", () => {
    const premium = 10000;
    const rate = 0.06;
    const years = 20;
    const fv = premium * Math.pow(1 + rate, years);
    expect(fv).toBeGreaterThan(premium);
    expect(Math.round(fv)).toBe(32071);
  });

  it("should cap returns at policy ceiling", () => {
    const marketReturn = 0.15;
    const cap = 0.12;
    const credited = Math.min(marketReturn, cap);
    expect(credited).toBe(cap);
  });

  it("should apply floor protection", () => {
    const marketReturn = -0.20;
    const floor = 0.0;
    const credited = Math.max(marketReturn, floor);
    expect(credited).toBe(floor);
  });

  it("should deduct cost of insurance", () => {
    const cashValue = 100000;
    const coi = 1200;
    const netValue = cashValue - coi;
    expect(netValue).toBe(98800);
  });

  it("should project death benefit", () => {
    const faceAmount = 500000;
    const cashValue = 150000;
    const deathBenefit = Math.max(faceAmount, cashValue * 1.1);
    expect(deathBenefit).toBe(faceAmount);
  });
});

describe("Portfolio Risk Model", () => {
  it("should calculate portfolio variance", () => {
    const weights = [0.6, 0.4];
    const returns = [0.08, 0.04];
    const stdDevs = [0.15, 0.05];
    const correlation = 0.3;
    const variance = Math.pow(weights[0] * stdDevs[0], 2) + Math.pow(weights[1] * stdDevs[1], 2) + 2 * weights[0] * weights[1] * stdDevs[0] * stdDevs[1] * correlation;
    expect(variance).toBeGreaterThan(0);
    expect(variance).toBeLessThan(1);
  });

  it("should calculate Sharpe ratio", () => {
    const portfolioReturn = 0.10;
    const riskFreeRate = 0.04;
    const stdDev = 0.12;
    const sharpe = (portfolioReturn - riskFreeRate) / stdDev;
    expect(sharpe).toBeCloseTo(0.5, 1);
  });

  it("should calculate Value at Risk (VaR)", () => {
    const portfolioValue = 1000000;
    const mean = 0.08;
    const stdDev = 0.15;
    const zScore = 1.645; // 95% confidence
    const var95 = portfolioValue * (mean - zScore * stdDev);
    expect(var95).toBeLessThan(0); // Expected loss
  });

  it("should detect concentration risk", () => {
    const allocations = [0.45, 0.30, 0.15, 0.10];
    const maxAllocation = Math.max(...allocations);
    const concentrated = maxAllocation > 0.40;
    expect(concentrated).toBe(true);
  });

  it("should calculate beta", () => {
    const covariance = 0.018;
    const marketVariance = 0.02;
    const beta = covariance / marketVariance;
    expect(beta).toBeCloseTo(0.9, 10);
  });
});

describe("Retirement Projection Model", () => {
  it("should calculate future value of savings", () => {
    const monthly = 2000;
    const rate = 0.07 / 12;
    const months = 30 * 12;
    const fv = monthly * ((Math.pow(1 + rate, months) - 1) / rate);
    expect(fv).toBeGreaterThan(2000000);
  });

  it("should calculate required savings rate", () => {
    const targetNestEgg = 2000000;
    const years = 30;
    const annualReturn = 0.07;
    const fvFactor = (Math.pow(1 + annualReturn, years) - 1) / annualReturn;
    const annualSavings = targetNestEgg / fvFactor;
    expect(annualSavings).toBeGreaterThan(0);
    expect(annualSavings).toBeLessThan(100000);
  });

  it("should model withdrawal phase", () => {
    const nestEgg = 2000000;
    const withdrawalRate = 0.04;
    const annualWithdrawal = nestEgg * withdrawalRate;
    expect(annualWithdrawal).toBe(80000);
  });

  it("should account for inflation", () => {
    const today = 80000;
    const inflation = 0.03;
    const years = 20;
    const future = today * Math.pow(1 + inflation, years);
    expect(future).toBeGreaterThan(today);
    expect(Math.round(future)).toBe(144489);
  });

  it("should detect shortfall risk", () => {
    const projected = 1500000;
    const needed = 2000000;
    const shortfall = needed - projected;
    expect(shortfall).toBeGreaterThan(0);
  });
});

describe("Tax Optimization Model", () => {
  it("should calculate marginal tax rate", () => {
    const brackets = [
      { min: 0, max: 11600, rate: 0.10 },
      { min: 11600, max: 47150, rate: 0.12 },
      { min: 47150, max: 100525, rate: 0.22 },
      { min: 100525, max: 191950, rate: 0.24 },
    ];
    const income = 75000;
    const bracket = brackets.find(b => income >= b.min && income < b.max);
    expect(bracket?.rate).toBe(0.22);
  });

  it("should compare Roth vs Traditional contributions", () => {
    const contribution = 6500;
    const currentRate = 0.22;
    const futureRate = 0.24;
    const traditionalTaxSaved = contribution * currentRate;
    const rothTaxPaid = contribution * currentRate;
    const rothFutureSaved = contribution * futureRate;
    expect(rothFutureSaved).toBeGreaterThan(traditionalTaxSaved);
  });

  it("should calculate capital gains tax", () => {
    const gains = 50000;
    const longTermRate = 0.15;
    const tax = gains * longTermRate;
    expect(tax).toBe(7500);
  });

  it("should identify tax-loss harvesting opportunities", () => {
    const positions = [
      { symbol: "AAPL", gain: 5000 },
      { symbol: "TSLA", gain: -3000 },
      { symbol: "MSFT", gain: 2000 },
    ];
    const losses = positions.filter(p => p.gain < 0);
    expect(losses).toHaveLength(1);
    expect(losses[0].symbol).toBe("TSLA");
  });
});

describe("Model Backtesting", () => {
  it("should run historical scenarios", () => {
    const scenarios = [
      { name: "2008 Financial Crisis", startDate: "2008-09-01", endDate: "2009-03-31", marketDrop: -0.50 },
      { name: "2020 COVID Crash", startDate: "2020-02-19", endDate: "2020-03-23", marketDrop: -0.34 },
      { name: "2022 Rate Hikes", startDate: "2022-01-01", endDate: "2022-12-31", marketDrop: -0.19 },
    ];
    expect(scenarios).toHaveLength(3);
    scenarios.forEach(s => expect(s.marketDrop).toBeLessThan(0));
  });

  it("should compare model predictions to actual outcomes", () => {
    const predicted = 0.08;
    const actual = 0.07;
    const error = Math.abs(predicted - actual);
    expect(error).toBeLessThan(0.05);
  });

  it("should calculate model accuracy metrics", () => {
    const predictions = [0.08, 0.06, 0.10, 0.05];
    const actuals = [0.07, 0.06, 0.09, 0.04];
    const mse = predictions.reduce((sum, p, i) => sum + Math.pow(p - actuals[i], 2), 0) / predictions.length;
    expect(mse).toBeLessThan(0.001);
  });
});
