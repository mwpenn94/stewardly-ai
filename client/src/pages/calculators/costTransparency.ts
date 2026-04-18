/**
 * costTransparency.ts — Advisor Cost Transparency Engine
 *
 * Pass 123: Consolidates all fee layers (advisory, fund expenses, platform,
 * insurance, transaction, tax drag) into a unified cost-of-ownership view.
 *
 * Sources: Morningstar 2024 Fee Study, Cerulli U.S. Advisor Metrics 2025,
 * LIMRA Distribution Economics 2024, Kitces Research 2024.
 */

/* ─── Fee Layer Types ─── */
export interface FeeLayer {
  category: string;
  label: string;
  bps: number;          // basis points
  annualDollar: number; // computed from AUM/portfolio
  description: string;
  source: string;
  isAvoidable: boolean;
}

export interface CostSummary {
  totalBps: number;
  totalAnnual: number;
  totalOver10Years: number;
  totalOver20Years: number;
  feeLayers: FeeLayer[];
  comparisonToMedian: number; // percentage above/below median
  dragOnReturns10yr: number;  // cumulative return drag over 10 years
  dragOnReturns20yr: number;  // cumulative return drag over 20 years
  breakEvenAlpha: number;     // alpha needed to justify costs
}

/* ─── Industry Median Fee Benchmarks (bps) ─── */
export const INDUSTRY_FEE_BENCHMARKS = {
  // Advisory fees
  riaAdvisoryFee: { median: 100, low: 50, high: 150, source: 'Kitces Research 2024' },
  wirehouseAdvisoryFee: { median: 125, low: 100, high: 175, source: 'Cerulli 2025' },
  ibdAdvisoryFee: { median: 115, low: 75, high: 150, source: 'Cerulli 2025' },
  roboadvisorFee: { median: 25, low: 0, high: 50, source: 'Backend Benchmarking 2024' },

  // Fund expenses
  activeEquityER: { median: 65, low: 30, high: 120, source: 'Morningstar 2024' },
  passiveEquityER: { median: 5, low: 3, high: 15, source: 'Morningstar 2024' },
  activeBondER: { median: 50, low: 20, high: 85, source: 'Morningstar 2024' },
  passiveBondER: { median: 4, low: 3, high: 10, source: 'Morningstar 2024' },
  targetDateER: { median: 35, low: 10, high: 75, source: 'Morningstar 2024' },
  alternativesER: { median: 150, low: 80, high: 250, source: 'Morningstar 2024' },

  // Platform/custodian fees
  custodianFee: { median: 10, low: 0, high: 25, source: 'Schwab/Fidelity/Pershing 2024' },
  platformFee: { median: 15, low: 0, high: 35, source: 'Orion/Black Diamond/Tamarac 2024' },

  // Insurance product costs
  iulCOI: { median: 200, low: 100, high: 400, source: 'LIMRA 2024' },
  variableAnnuityME: { median: 130, low: 80, high: 200, source: 'Morningstar VA Report 2024' },
  fixedIndexedAnnuity: { median: 0, low: 0, high: 50, source: 'LIMRA 2024 — spread-based' },

  // Transaction costs
  tradingCost: { median: 0, low: 0, high: 5, source: 'Most custodians: $0 commissions' },
  bidAskSpread: { median: 2, low: 1, high: 10, source: 'FINRA Trade Reporting 2024' },

  // Tax drag (not a fee but a cost)
  taxDrag: { median: 50, low: 10, high: 150, source: 'Vanguard Advisor Alpha 2024' },
} as const;

/* ─── Compute Total Cost of Ownership ─── */
export function computeCostTransparency(params: {
  portfolioValue: number;
  advisoryFeeBps: number;
  fundExpenseRatioBps: number;
  platformFeeBps: number;
  insuranceCostBps: number;
  transactionCostBps: number;
  taxDragBps: number;
  expectedReturnBps: number;
  customLayers?: { label: string; bps: number; description: string }[];
}): CostSummary {
  const {
    portfolioValue, advisoryFeeBps, fundExpenseRatioBps, platformFeeBps,
    insuranceCostBps, transactionCostBps, taxDragBps, expectedReturnBps,
    customLayers = [],
  } = params;

  const layers: FeeLayer[] = [
    {
      category: 'Advisory',
      label: 'Advisory / Management Fee',
      bps: advisoryFeeBps,
      annualDollar: portfolioValue * advisoryFeeBps / 10000,
      description: 'Fee paid to financial advisor for portfolio management and planning',
      source: 'Kitces Research 2024',
      isAvoidable: false,
    },
    {
      category: 'Fund Expenses',
      label: 'Fund Expense Ratios',
      bps: fundExpenseRatioBps,
      annualDollar: portfolioValue * fundExpenseRatioBps / 10000,
      description: 'Weighted average expense ratio of underlying funds/ETFs',
      source: 'Morningstar 2024',
      isAvoidable: true,
    },
    {
      category: 'Platform',
      label: 'Platform / Custodian Fee',
      bps: platformFeeBps,
      annualDollar: portfolioValue * platformFeeBps / 10000,
      description: 'Technology platform and custodial services',
      source: 'Industry average 2024',
      isAvoidable: true,
    },
    {
      category: 'Insurance',
      label: 'Insurance Product Costs',
      bps: insuranceCostBps,
      annualDollar: portfolioValue * insuranceCostBps / 10000,
      description: 'Cost of insurance (mortality charges, rider fees, spread)',
      source: 'LIMRA 2024',
      isAvoidable: false,
    },
    {
      category: 'Transaction',
      label: 'Trading & Transaction Costs',
      bps: transactionCostBps,
      annualDollar: portfolioValue * transactionCostBps / 10000,
      description: 'Commissions, bid-ask spreads, market impact',
      source: 'FINRA 2024',
      isAvoidable: true,
    },
    {
      category: 'Tax',
      label: 'Tax Drag (Estimated)',
      bps: taxDragBps,
      annualDollar: portfolioValue * taxDragBps / 10000,
      description: 'Estimated annual tax cost from distributions and turnover',
      source: 'Vanguard Advisor Alpha 2024',
      isAvoidable: true,
    },
    ...customLayers.map(cl => ({
      category: 'Custom',
      label: cl.label,
      bps: cl.bps,
      annualDollar: portfolioValue * cl.bps / 10000,
      description: cl.description,
      source: 'User-defined',
      isAvoidable: false,
    })),
  ];

  const totalBps = layers.reduce((s, l) => s + l.bps, 0);
  const totalAnnual = layers.reduce((s, l) => s + l.annualDollar, 0);

  // Compound cost drag over time
  const grossReturn = expectedReturnBps / 10000;
  const netReturn = grossReturn - totalBps / 10000;
  const grossValue10 = portfolioValue * Math.pow(1 + grossReturn, 10);
  const netValue10 = portfolioValue * Math.pow(1 + netReturn, 10);
  const grossValue20 = portfolioValue * Math.pow(1 + grossReturn, 20);
  const netValue20 = portfolioValue * Math.pow(1 + netReturn, 20);

  const totalOver10Years = grossValue10 - netValue10;
  const totalOver20Years = grossValue20 - netValue20;

  // Comparison to median all-in cost (advisory + fund + platform + trading)
  const medianAllIn = INDUSTRY_FEE_BENCHMARKS.riaAdvisoryFee.median +
    INDUSTRY_FEE_BENCHMARKS.activeEquityER.median +
    INDUSTRY_FEE_BENCHMARKS.platformFee.median +
    INDUSTRY_FEE_BENCHMARKS.tradingCost.median +
    INDUSTRY_FEE_BENCHMARKS.taxDrag.median;
  const comparisonToMedian = medianAllIn > 0 ? ((totalBps - medianAllIn) / medianAllIn) * 100 : 0;

  return {
    totalBps,
    totalAnnual,
    totalOver10Years,
    totalOver20Years,
    feeLayers: layers,
    comparisonToMedian,
    dragOnReturns10yr: totalOver10Years,
    dragOnReturns20yr: totalOver20Years,
    breakEvenAlpha: totalBps / 100, // percentage alpha needed
  };
}

/* ─── Preset Scenarios ─── */
export const COST_SCENARIOS = {
  'DIY Passive': {
    advisoryFeeBps: 0,
    fundExpenseRatioBps: 5,
    platformFeeBps: 0,
    insuranceCostBps: 0,
    transactionCostBps: 0,
    taxDragBps: 15,
  },
  'Robo-Advisor': {
    advisoryFeeBps: 25,
    fundExpenseRatioBps: 5,
    platformFeeBps: 0,
    insuranceCostBps: 0,
    transactionCostBps: 0,
    taxDragBps: 10,
  },
  'RIA (Passive)': {
    advisoryFeeBps: 100,
    fundExpenseRatioBps: 8,
    platformFeeBps: 10,
    insuranceCostBps: 0,
    transactionCostBps: 2,
    taxDragBps: 20,
  },
  'RIA (Active)': {
    advisoryFeeBps: 100,
    fundExpenseRatioBps: 65,
    platformFeeBps: 15,
    insuranceCostBps: 0,
    transactionCostBps: 5,
    taxDragBps: 50,
  },
  'Wirehouse': {
    advisoryFeeBps: 125,
    fundExpenseRatioBps: 70,
    platformFeeBps: 20,
    insuranceCostBps: 0,
    transactionCostBps: 5,
    taxDragBps: 60,
  },
  'Insurance-Focused': {
    advisoryFeeBps: 0,
    fundExpenseRatioBps: 0,
    platformFeeBps: 0,
    insuranceCostBps: 200,
    transactionCostBps: 0,
    taxDragBps: 0,
  },
  'Hybrid (Advisory + Insurance)': {
    advisoryFeeBps: 80,
    fundExpenseRatioBps: 30,
    platformFeeBps: 10,
    insuranceCostBps: 100,
    transactionCostBps: 2,
    taxDragBps: 25,
  },
  'WealthBridge Optimized': {
    advisoryFeeBps: 75,
    fundExpenseRatioBps: 12,
    platformFeeBps: 5,
    insuranceCostBps: 50,
    transactionCostBps: 1,
    taxDragBps: 15,
  },
} as const;
