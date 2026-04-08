/**
 * HE — Holistic Engine v7
 * Faithfully extracted from WealthBridge-Business-Calculator-v7.html
 *
 * Integrates BIE + UWE into a single year-by-year simulation where
 * business income feeds personal wealth, which feeds product benefits,
 * which all compound together. Supports unlimited planning horizon.
 */

import type {
  HolisticStrategyConfig, HolisticSnapshot, ComparisonRow,
  ClientProfile, CompanyKey, BIEStrategy, StrategyConfig,
  BIEStreamResult,
} from "./types";
import { BIE } from "./bie";
import { UWE } from "./uwe";

// ═══════════════════════════════════════════════════════════════════════════
// CREATE HOLISTIC STRATEGY
// ═══════════════════════════════════════════════════════════════════════════

export function createHolisticStrategy(name: string, config: Partial<HolisticStrategyConfig>): HolisticStrategyConfig {
  return {
    name: name || "Untitled",
    color: config.color || "#16A34A",
    bizStrategy: config.bizStrategy || null,
    hasBizIncome: config.hasBizIncome !== false,
    profile: config.profile || { age: 40, income: 120000, netWorth: 350000, savings: 180000, dependents: 2, mortgage: 250000, debts: 30000 },
    wealthStrategy: config.wealthStrategy || null,
    companyKey: config.companyKey || "wealthbridge",
    customProducts: config.customProducts || null,
    savingsRate: config.savingsRate ?? 0.15,
    investmentReturn: config.investmentReturn ?? 0.07,
    inflationRate: config.inflationRate ?? 0.03,
    taxRate: config.taxRate ?? 0.25,
    reinvestTaxSavings: config.reinvestTaxSavings !== false,
    notes: config.notes || "",
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SIMULATE (year-by-year combining ALL streams)
// ═══════════════════════════════════════════════════════════════════════════

export function simulate(holisticStrategy: HolisticStrategyConfig, years: number = 30): HolisticSnapshot[] {
  if (!holisticStrategy) throw new Error("HE.simulate: holisticStrategy is required");
  if (years < 1 || years > 200) throw new Error("HE.simulate: years must be 1-200");
  const hs = holisticStrategy;
  const profile = hs.profile || {};
  const age = profile.age || 40;

  // Run BIE simulation if business income exists
  let bizResults: ReturnType<typeof BIE.simulate> | null = null;
  if (hs.hasBizIncome && hs.bizStrategy) {
    bizResults = BIE.simulate(hs.bizStrategy, years);
  }

  // Build UWE strategy
  let uweStrategy: StrategyConfig | null = hs.wealthStrategy || null;
  if (!uweStrategy) {
    uweStrategy = UWE.buildStrategy(hs.companyKey || "wealthbridge", profile, hs.customProducts);
  }

  // Run UWE simulation
  let uweResults: ReturnType<typeof UWE.simulate> | null = null;
  if (uweStrategy) {
    uweResults = UWE.simulate(uweStrategy, years);
  }

  // Combine year-by-year
  const results: HolisticSnapshot[] = [];
  let cumBizIncome = 0, cumBizCost = 0;
  let cumPersonalIncome = 0;
  let cumTotalCost = 0;

  for (let yr = 1; yr <= years; yr++) {
    const snapshot: HolisticSnapshot = {
      year: yr,
      age: age + yr,
      bizIncome: 0,
      bizCost: 0,
      bizNetIncome: 0,
      bizStreams: {},
      bizTeamSize: 0,
      bizAUM: 0,
      personalIncome: 0,
      totalGrossIncome: 0,
      totalTaxes: 0,
      totalNetIncome: 0,
      annualSavingsContrib: 0,
      savingsBalance: 0,
      productCashValue: 0,
      productDeathBenefit: 0,
      productTaxSaving: 0,
      productLivingBenefit: 0,
      productLegacyValue: 0,
      productAnnualCost: 0,
      productExpectedValue: 0,
      productDetails: [],
      totalLiquidWealth: 0,
      totalProtection: 0,
      totalTaxSavings: 0,
      totalValue: 0,
      totalCost: 0,
      netValue: 0,
      roi: 0,
      cumulativeBizIncome: 0,
      cumulativePersonalIncome: 0,
      cumulativeTotalIncome: 0,
      cumulativeTotalCost: 0,
      cumulativeNetValue: 0,
    };

    // 1. BUSINESS INCOME
    if (bizResults && yr <= bizResults.length) {
      const bizYr = bizResults[yr - 1];
      snapshot.bizIncome = bizYr.totalIncome || 0;
      snapshot.bizCost = bizYr.totalCost || 0;
      snapshot.bizNetIncome = bizYr.netIncome || 0;
      snapshot.bizStreams = bizYr.streams || {};
      snapshot.bizTeamSize = bizYr.teamSize || 0;
      snapshot.bizAUM = bizYr.aum || 0;

      // Expose affiliate/partner value streams explicitly
      const streams = bizYr.streams || {};
      snapshot.affiliateIncomeA = streams.affA ? (streams.affA.income || 0) : 0;
      snapshot.affiliateIncomeB = streams.affB ? (streams.affB.income || 0) : 0;
      snapshot.affiliateIncomeC = streams.affC ? (streams.affC.income || 0) : 0;
      snapshot.affiliateIncomeD = streams.affD ? (streams.affD.income || 0) : 0;
      snapshot.affiliateTotalIncome = (snapshot.affiliateIncomeA || 0) + (snapshot.affiliateIncomeB || 0) + (snapshot.affiliateIncomeC || 0) + (snapshot.affiliateIncomeD || 0);
      snapshot.partnerIncome = streams.partner ? (streams.partner.income || 0) : 0;
      snapshot.overrideIncome = (streams.override ? (streams.override.income || 0) : 0) + (streams.overrideG2 ? (streams.overrideG2.income || 0) : 0);
      snapshot.channelIncome = streams.channels ? (streams.channels.income || 0) : 0;
      snapshot.renewalIncome = streams.renewal ? (streams.renewal.income || 0) : 0;
      snapshot.personalProdIncome = streams.personal ? (streams.personal.income || 0) : 0;
    }
    cumBizIncome += snapshot.bizIncome;
    cumBizCost += snapshot.bizCost;

    // 2. PERSONAL INCOME (grows with inflation)
    const basePersonalIncome = profile.income || 0;
    if (hs.hasBizIncome && snapshot.bizIncome > 0) {
      snapshot.personalIncome = 0;
      snapshot.totalGrossIncome = snapshot.bizIncome;
    } else {
      snapshot.personalIncome = Math.round(basePersonalIncome * Math.pow(1 + hs.inflationRate, yr - 1));
      snapshot.totalGrossIncome = snapshot.personalIncome;
    }
    cumPersonalIncome += snapshot.personalIncome;

    // 3. TAXES
    snapshot.totalTaxes = Math.round(snapshot.totalGrossIncome * hs.taxRate);
    snapshot.totalNetIncome = snapshot.totalGrossIncome - snapshot.totalTaxes - snapshot.bizCost;

    // 4. SAVINGS CONTRIBUTION
    snapshot.annualSavingsContrib = Math.round(snapshot.totalNetIncome * hs.savingsRate);

    // 5. PRODUCT VALUES (from UWE)
    if (uweResults && yr <= uweResults.length) {
      const uweYr = uweResults[yr - 1];
      snapshot.productCashValue = uweYr.productCashValue || 0;
      snapshot.productDeathBenefit = uweYr.productDeathBenefit || 0;
      snapshot.productTaxSaving = uweYr.productTaxSaving || 0;
      snapshot.productLivingBenefit = uweYr.productLivingBenefit || 0;
      snapshot.productLegacyValue = uweYr.productLegacyValue || 0;
      snapshot.productAnnualCost = uweYr.productAnnualCost || 0;
      snapshot.productExpectedValue = uweYr.productExpectedValue || 0;
      snapshot.productDetails = uweYr.productDetails || [];
      snapshot.savingsBalance = uweYr.savingsBalance || 0;
    } else {
      const prevSav = yr > 1 && results.length > 0 ? results[results.length - 1].savingsBalance : (profile.savings || 0);
      snapshot.savingsBalance = Math.round(prevSav * (1 + hs.investmentReturn) + snapshot.annualSavingsContrib);
    }

    // 6. REINVEST TAX SAVINGS
    if (hs.reinvestTaxSavings && snapshot.productTaxSaving > 0) {
      snapshot.savingsBalance += snapshot.productTaxSaving;
    }

    // 7. HOLISTIC TOTALS
    snapshot.totalLiquidWealth = snapshot.savingsBalance + snapshot.productCashValue;
    snapshot.totalProtection = snapshot.productDeathBenefit + snapshot.productLivingBenefit;

    // Cumulative tax savings
    let cumTaxSav = 0;
    for (let t = 0; t < yr; t++) {
      cumTaxSav += (t < results.length ? results[t].productTaxSaving : snapshot.productTaxSaving);
    }
    snapshot.totalTaxSavings = cumTaxSav;

    // TOTAL VALUE
    snapshot.totalValue = snapshot.totalLiquidWealth
      + snapshot.productDeathBenefit
      + snapshot.productLivingBenefit
      + cumTaxSav
      + snapshot.productExpectedValue;

    // TOTAL COST
    snapshot.totalCost = snapshot.productAnnualCost + snapshot.bizCost;
    cumTotalCost += snapshot.totalCost;
    snapshot.cumulativeTotalCost = cumTotalCost;

    // NET VALUE
    snapshot.netValue = snapshot.totalValue - cumTotalCost;

    // ROI
    snapshot.roi = cumTotalCost > 0 ? snapshot.totalValue / cumTotalCost : 0;

    // CUMULATIVE
    snapshot.cumulativeBizIncome = cumBizIncome;
    snapshot.cumulativePersonalIncome = cumPersonalIncome;
    snapshot.cumulativeTotalIncome = cumBizIncome + cumPersonalIncome;
    snapshot.cumulativeNetValue = snapshot.netValue;

    results.push(snapshot);
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// MULTI-STRATEGY COMPARISON
// ═══════════════════════════════════════════════════════════════════════════

interface StrategyEntry {
  strategy: HolisticStrategyConfig;
  results: HolisticSnapshot[];
  name: string;
  color: string;
}

export function compareStrategies(
  strategies: HolisticStrategyConfig[],
  horizon: number = 30,
): { entries: StrategyEntry[]; comparison: ComparisonRow[]; winners: Record<string, { name: string; color: string; value: number }> } {
  const entries: StrategyEntry[] = strategies.map((s) => ({
    strategy: s,
    results: simulate(s, Math.max(horizon, 200)),
    name: s.name,
    color: s.color,
  }));

  // Compare at horizon year
  const comparison: ComparisonRow[] = entries.map((e, i) => {
    const idx = Math.min(horizon, e.results.length) - 1;
    const snap = e.results[Math.max(0, idx)];
    return {
      index: i,
      name: e.name,
      color: e.color,
      bizIncome: snap.bizIncome,
      bizCumIncome: snap.cumulativeBizIncome,
      bizTeamSize: snap.bizTeamSize,
      bizAUM: snap.bizAUM,
      personalProdIncome: snap.personalProdIncome || 0,
      overrideIncome: snap.overrideIncome || 0,
      affiliateIncomeA: snap.affiliateIncomeA || 0,
      affiliateIncomeB: snap.affiliateIncomeB || 0,
      affiliateIncomeC: snap.affiliateIncomeC || 0,
      affiliateIncomeD: snap.affiliateIncomeD || 0,
      affiliateTotalIncome: snap.affiliateTotalIncome || 0,
      partnerIncome: snap.partnerIncome || 0,
      channelIncome: snap.channelIncome || 0,
      renewalIncome: snap.renewalIncome || 0,
      personalIncome: snap.personalIncome,
      totalGrossIncome: snap.totalGrossIncome,
      totalNetIncome: snap.totalNetIncome,
      savingsBalance: snap.savingsBalance,
      productCashValue: snap.productCashValue,
      totalLiquidWealth: snap.totalLiquidWealth,
      productDeathBenefit: snap.productDeathBenefit,
      productLivingBenefit: snap.productLivingBenefit,
      totalProtection: snap.totalProtection,
      totalTaxSavings: snap.totalTaxSavings,
      totalValue: snap.totalValue,
      totalCost: snap.cumulativeTotalCost,
      netValue: snap.netValue,
      roi: snap.roi,
    };
  });

  // Find winners
  const winners: Record<string, { name: string; color: string; value: number }> = {};
  const metrics = ["totalValue", "netValue", "roi", "totalLiquidWealth", "totalProtection", "totalTaxSavings", "bizIncome", "totalGrossIncome"] as const;
  for (const m of metrics) {
    let best: ComparisonRow | null = null;
    let bestVal = -Infinity;
    for (const d of comparison) {
      const v = d[m as keyof ComparisonRow] as number;
      if (v > bestVal) { bestVal = v; best = d; }
    }
    if (best) winners[m] = { name: best.name, color: best.color, value: bestVal };
  }

  // Lowest cost
  let lowestCost: ComparisonRow | null = null;
  let lowestCostVal = Infinity;
  for (const d of comparison) {
    if (d.totalCost < lowestCostVal && d.totalCost > 0) {
      lowestCostVal = d.totalCost;
      lowestCost = d;
    }
  }
  if (lowestCost) winners.lowestCost = { name: lowestCost.name, color: lowestCost.color, value: lowestCostVal };

  return { entries, comparison, winners };
}

// ═══════════════════════════════════════════════════════════════════════════
// MILESTONE COMPARISON
// ═══════════════════════════════════════════════════════════════════════════

export function milestoneCompare(
  strategies: HolisticStrategyConfig[],
  milestoneYears: number[] = [1, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100],
) {
  const entries = strategies.map((s) => ({
    strategy: s,
    results: simulate(s, Math.max(...milestoneYears, 200)),
    name: s.name,
    color: s.color,
  }));

  return milestoneYears.map((yr) => ({
    year: yr,
    strategies: entries.map((e) => {
      const idx = Math.min(yr, e.results.length) - 1;
      const snap = e.results[Math.max(0, idx)];
      return {
        name: e.name,
        color: e.color,
        totalValue: snap?.totalValue || 0,
        totalLiquidWealth: snap?.totalLiquidWealth || 0,
        netValue: snap?.netValue || 0,
        bizIncome: snap?.bizIncome || 0,
        totalGrossIncome: snap?.totalGrossIncome || 0,
        roi: snap?.roi || 0,
      };
    }),
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// CHART DATA HELPER
// ═══════════════════════════════════════════════════════════════════════════

export function getChartSeries(
  strategies: HolisticStrategyConfig[],
  metric: keyof HolisticSnapshot,
  maxYear: number = 30,
) {
  const entries = strategies.map((s) => ({
    results: simulate(s, maxYear),
    name: s.name,
    color: s.color,
  }));

  // Smart year selection
  const plotYears: number[] = [];
  for (let y = 1; y <= Math.min(5, maxYear); y++) plotYears.push(y);
  for (let y = 10; y <= maxYear; y += (y < 50 ? 5 : y < 100 ? 10 : 25)) {
    if (!plotYears.includes(y)) plotYears.push(y);
  }
  if (!plotYears.includes(maxYear)) plotYears.push(maxYear);
  plotYears.sort((a, b) => a - b);

  const series = entries.map((e) => ({
    name: e.name,
    color: e.color,
    points: plotYears.map((yr) => {
      const snap = e.results[Math.min(yr, e.results.length) - 1];
      return snap ? (snap[metric] as number || 0) : 0;
    }),
  }));

  return {
    series,
    labels: plotYears.map((y) => `Yr${y}`),
    years: plotYears,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// BACK PLAN HOLISTIC
// ═══════════════════════════════════════════════════════════════════════════

export function backPlanHolistic(
  targetValue: number,
  targetYear: number,
  baseStrategy: HolisticStrategyConfig,
): { requiredIncome: number; targetValue: number; targetYear: number; iterations: number } {
  let low = 0, high = 10000000, iterations = 0;
  let bestIncome = 0;

  while (high - low > 1000 && iterations < 50) {
    const mid = Math.round((low + high) / 2);
    const testStrategy = JSON.parse(JSON.stringify(baseStrategy)) as HolisticStrategyConfig;
    if (testStrategy.bizStrategy) {
      testStrategy.bizStrategy.personalGDC = mid;
    } else {
      testStrategy.profile.income = mid;
    }
    const testResults = simulate(testStrategy, targetYear);
    const finalSnap = testResults[testResults.length - 1];

    if (finalSnap.totalValue >= targetValue) {
      high = mid;
      bestIncome = mid;
    } else {
      low = mid;
    }
    iterations++;
  }

  return {
    requiredIncome: bestIncome || high,
    targetValue,
    targetYear,
    iterations,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PRESET HOLISTIC STRATEGIES
// ═══════════════════════════════════════════════════════════════════════════

export function presetWealthBridgeClient(profile?: Partial<ClientProfile>): HolisticStrategyConfig {
  const p = { age: 40, income: 120000, netWorth: 350000, savings: 180000, dependents: 2, mortgage: 250000, debts: 30000, ...profile };
  return createHolisticStrategy("WealthBridge Client", {
    color: "#C9A84C",
    hasBizIncome: false,
    profile: p,
    companyKey: "wealthbridge",
    savingsRate: 0.15,
    investmentReturn: 0.07,
    inflationRate: 0.03,
    taxRate: 0.25,
  });
}

export function presetWealthBridgeProfessional(profile?: Partial<ClientProfile>): HolisticStrategyConfig {
  const p = { age: 35, income: 200000, netWorth: 500000, savings: 250000, dependents: 2, mortgage: 400000, debts: 50000, ...profile };
  return createHolisticStrategy("WealthBridge Professional", {
    color: "#C9A84C",
    hasBizIncome: true,
    profile: p,
    bizStrategy: BIE.PRESETS.experiencedPro(),
    companyKey: "wealthbridge",
    savingsRate: 0.20,
    investmentReturn: 0.07,
    inflationRate: 0.03,
    taxRate: 0.28,
  });
}

export function presetDoNothing(profile?: Partial<ClientProfile>): HolisticStrategyConfig {
  const p = { age: 40, income: 120000, netWorth: 350000, savings: 180000, dependents: 2, mortgage: 250000, debts: 30000, ...profile };
  return createHolisticStrategy("Do Nothing (Status Quo)", {
    color: "#94A3B8",
    hasBizIncome: false,
    profile: p,
    companyKey: "donothing",
    savingsRate: 0.062,
    investmentReturn: 0.035,
    inflationRate: 0.03,
    taxRate: 0.25,
  });
}

export const HE_PRESETS = {
  wealthBridgeClient: presetWealthBridgeClient,
  wealthBridgeProfessional: presetWealthBridgeProfessional,
  doNothing: presetDoNothing,
};

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

export const HE = {
  createHolisticStrategy,
  simulate,
  compareStrategies,
  milestoneCompare,
  getChartSeries,
  backPlanHolistic,
  PRESETS: HE_PRESETS,
};

export default HE;
