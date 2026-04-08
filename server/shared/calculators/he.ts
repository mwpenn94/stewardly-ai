/**
 * Holistic Engine (HE) v1.0
 *
 * Integrates the Business Income Engine (BIE) + Unified Wealth Engine
 * (UWE) into a single year-by-year simulation where business income
 * feeds personal savings contributions, which feed product growth,
 * which compounds with tax savings reinvestment.
 *
 * Ported verbatim from the v7 WealthBridge HTML calculators
 * (Business-Calculator-v7, lines 2941-3581). The v7 IIFE defends with
 * `typeof BIE !== 'undefined'` guards; we replace those with direct ES
 * imports from ./bie and ./uwe since the TypeScript port never runs in
 * isolation. The module-level `_strategies` / `_horizon` singleton state
 * is preserved — that's intentional v7 behaviour for the comparison
 * registry used by compareAt / findWinners / milestoneCompare.
 */

import type {
  HolisticStrategy,
  HolisticSnapshot,
  ClientProfile,
  ComparisonRow,
  WinnersMap,
  MilestoneRow,
  ChartSeriesResult,
  UWEStrategy,
  ProductConfig,
  BIEStrategy,
  BIERoleKey,
} from "./types";
import * as BIEMod from "./bie";
import * as UWEMod from "./uwe";

// ═══════════════════════════════════════════════════════════════════════════
// HOLISTIC STRATEGY CREATION
// Combines business + personal + products into a single strategy object
// with sensible defaults.
// ═══════════════════════════════════════════════════════════════════════════

export interface HolisticStrategyConfig {
  color?: string;
  bizStrategy?: BIEStrategy | null;
  hasBizIncome?: boolean;
  profile?: ClientProfile;
  wealthStrategy?: UWEStrategy | null;
  companyKey?: string;
  customProducts?: ProductConfig[] | null;
  savingsRate?: number;
  investmentReturn?: number;
  inflationRate?: number;
  taxRate?: number;
  reinvestTaxSavings?: boolean;
  notes?: string;
}

export function createHolisticStrategy(
  name: string,
  config: HolisticStrategyConfig,
): HolisticStrategy {
  return {
    name: name || "Untitled",
    color: config.color || "#16A34A",
    bizStrategy: config.bizStrategy || null,
    hasBizIncome: config.hasBizIncome !== false,
    profile: config.profile || {
      age: 40,
      income: 120000,
      netWorth: 350000,
      savings: 180000,
      dependents: 2,
      mortgage: 250000,
      debts: 30000,
    },
    wealthStrategy: config.wealthStrategy || null,
    companyKey: config.companyKey || "wealthbridge",
    customProducts: config.customProducts || null,
    savingsRate: config.savingsRate != null ? config.savingsRate : 0.15,
    investmentReturn:
      config.investmentReturn != null ? config.investmentReturn : 0.07,
    inflationRate: config.inflationRate != null ? config.inflationRate : 0.03,
    taxRate: config.taxRate != null ? config.taxRate : 0.25,
    reinvestTaxSavings: config.reinvestTaxSavings !== false,
    notes: config.notes || "",
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HOLISTIC SIMULATION
// Runs the year-by-year loop combining business income, personal income,
// product values from UWE, savings contributions, tax reinvestment, and
// cumulative totals.
// ═══════════════════════════════════════════════════════════════════════════

export function simulate(
  holisticStrategy: HolisticStrategy,
  years?: number,
): HolisticSnapshot[] {
  const yearCount = !years || years < 1 ? 30 : years;
  const hs = holisticStrategy;
  const profile = hs.profile || {};
  const age = profile.age || 40;

  // Run BIE simulation if business income exists
  const bizResults = hs.hasBizIncome && hs.bizStrategy
    ? BIEMod.simulate(hs.bizStrategy, yearCount)
    : null;

  // Build UWE strategy (caller may supply their own)
  const uweStrategy: UWEStrategy =
    hs.wealthStrategy ||
    UWEMod.buildStrategy(
      hs.companyKey || "wealthbridge",
      profile,
      hs.customProducts ?? undefined,
    );

  // Run UWE simulation
  const uweResults = UWEMod.simulate(uweStrategy, yearCount);

  const results: HolisticSnapshot[] = [];
  let cumBizIncome = 0;
  let cumBizCost = 0;
  let cumPersonalIncome = 0;
  let cumSavingsAdded = 0;
  let cumTaxSavingsReinvested = 0;
  let cumTotalCost = 0;

  for (let yr = 1; yr <= yearCount; yr++) {
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

    // 1. Business income
    if (bizResults && yr <= bizResults.length) {
      const bizYr = bizResults[yr - 1];
      snapshot.bizIncome = bizYr.totalIncome || 0;
      snapshot.bizCost = bizYr.totalCost || 0;
      snapshot.bizNetIncome = bizYr.netIncome || 0;
      snapshot.bizStreams = bizYr.streams || {};
      snapshot.bizTeamSize = bizYr.teamSize || 0;
      snapshot.bizAUM = bizYr.aum || 0;

      const streams = bizYr.streams || {};
      snapshot.affiliateIncomeA = streams.affA ? streams.affA.income || 0 : 0;
      snapshot.affiliateIncomeB = streams.affB ? streams.affB.income || 0 : 0;
      snapshot.affiliateIncomeC = streams.affC ? streams.affC.income || 0 : 0;
      snapshot.affiliateIncomeD = streams.affD ? streams.affD.income || 0 : 0;
      snapshot.affiliateTotalIncome =
        (snapshot.affiliateIncomeA || 0) +
        (snapshot.affiliateIncomeB || 0) +
        (snapshot.affiliateIncomeC || 0) +
        (snapshot.affiliateIncomeD || 0);
      snapshot.partnerIncome = streams.partner ? streams.partner.income || 0 : 0;
      snapshot.overrideIncome =
        (streams.override ? streams.override.income || 0 : 0) +
        (streams.overrideG2 ? streams.overrideG2.income || 0 : 0);
      snapshot.channelIncome = streams.channels ? streams.channels.income || 0 : 0;
      snapshot.renewalIncome = streams.renewal ? streams.renewal.income || 0 : 0;
      snapshot.personalProdIncome = streams.personal ? streams.personal.income || 0 : 0;
    }
    cumBizIncome += snapshot.bizIncome;
    cumBizCost += snapshot.bizCost;

    // 2. Personal income (grows with inflation) OR biz income replaces it
    const basePersonalIncome = profile.income || 0;
    if (hs.hasBizIncome && snapshot.bizIncome > 0) {
      snapshot.personalIncome = 0;
      snapshot.totalGrossIncome = snapshot.bizIncome;
    } else {
      snapshot.personalIncome = Math.round(
        basePersonalIncome * Math.pow(1 + hs.inflationRate, yr - 1),
      );
      snapshot.totalGrossIncome = snapshot.personalIncome;
    }
    cumPersonalIncome += snapshot.personalIncome;

    // 3. Taxes
    snapshot.totalTaxes = Math.round(snapshot.totalGrossIncome * hs.taxRate);
    snapshot.totalNetIncome =
      snapshot.totalGrossIncome - snapshot.totalTaxes - snapshot.bizCost;

    // 4. Savings contribution
    snapshot.annualSavingsContrib = Math.round(
      snapshot.totalNetIncome * hs.savingsRate,
    );
    cumSavingsAdded += snapshot.annualSavingsContrib;

    // 5. Product values from UWE
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
      const prevSav =
        yr > 1 && results.length > 0
          ? results[results.length - 1].savingsBalance
          : profile.savings || 0;
      snapshot.savingsBalance = Math.round(
        prevSav * (1 + hs.investmentReturn) + snapshot.annualSavingsContrib,
      );
    }

    // 6. Reinvest tax savings
    if (hs.reinvestTaxSavings && snapshot.productTaxSaving > 0) {
      snapshot.savingsBalance += snapshot.productTaxSaving;
      cumTaxSavingsReinvested += snapshot.productTaxSaving;
    }

    // 7. Holistic totals
    snapshot.totalLiquidWealth =
      snapshot.savingsBalance + snapshot.productCashValue;
    snapshot.totalProtection =
      snapshot.productDeathBenefit + snapshot.productLivingBenefit;

    let cumTaxSav = 0;
    for (let t = 0; t < yr; t++) {
      cumTaxSav +=
        t < results.length
          ? results[t].productTaxSaving
          : snapshot.productTaxSaving;
    }
    snapshot.totalTaxSavings = cumTaxSav;

    snapshot.totalValue =
      snapshot.totalLiquidWealth +
      snapshot.productDeathBenefit +
      snapshot.productLivingBenefit +
      cumTaxSav +
      snapshot.productExpectedValue;

    snapshot.totalCost = snapshot.productAnnualCost + snapshot.bizCost;
    cumTotalCost += snapshot.totalCost;
    snapshot.cumulativeTotalCost = cumTotalCost;

    snapshot.netValue = snapshot.totalValue - cumTotalCost;
    snapshot.roi = cumTotalCost > 0 ? snapshot.totalValue / cumTotalCost : 0;

    snapshot.cumulativeBizIncome = cumBizIncome;
    snapshot.cumulativePersonalIncome = cumPersonalIncome;
    snapshot.cumulativeTotalIncome = cumBizIncome + cumPersonalIncome;
    snapshot.cumulativeNetValue = snapshot.netValue;

    results.push(snapshot);
  }

  // Reference cumBizCost + cumSavingsAdded + cumTaxSavingsReinvested for
  // lint parity with the v7 IIFE, which accumulates but doesn't expose them.
  void cumBizCost;
  void cumSavingsAdded;
  void cumTaxSavingsReinvested;

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// MULTI-STRATEGY COMPARISON REGISTRY
// Module-level singleton state (matches v7 behaviour). Strategies are
// added, simulated once beyond the horizon for flexibility, and then
// compareAt / findWinners / milestoneCompare read from the registry.
// ═══════════════════════════════════════════════════════════════════════════

interface RegisteredStrategy {
  strategy: HolisticStrategy;
  results: HolisticSnapshot[];
  name: string;
  color: string;
}

let _strategies: RegisteredStrategy[] = [];
let _horizon = 30;

export function addStrategy(holisticStrategy: HolisticStrategy): number {
  const results = simulate(holisticStrategy, Math.max(_horizon, 200));
  _strategies.push({
    strategy: holisticStrategy,
    results,
    name: holisticStrategy.name,
    color: holisticStrategy.color,
  });
  return _strategies.length - 1;
}

export function removeStrategy(index: number): void {
  _strategies.splice(index, 1);
}

export function clearStrategies(): void {
  _strategies = [];
}

export function setHorizon(years: number): void {
  _horizon = Math.max(1, years);
}

export function getHorizon(): number {
  return _horizon;
}

export function getStrategies(): RegisteredStrategy[] {
  return _strategies;
}

export function getSnapshot(
  strategyIndex: number,
  year: number,
): HolisticSnapshot | null {
  const s = _strategies[strategyIndex];
  if (!s || !s.results) return null;
  let idx = Math.min(year, s.results.length) - 1;
  if (idx < 0) idx = 0;
  return s.results[idx] || null;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPARISON TABLE DATA
// ═══════════════════════════════════════════════════════════════════════════

export function compareAt(year?: number): ComparisonRow[] {
  const yr = year || _horizon;
  const rows: ComparisonRow[] = [];
  _strategies.forEach((s, i) => {
    const snap = getSnapshot(i, yr);
    if (!snap) return;
    rows.push({
      index: i,
      name: s.name,
      color: s.color,
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
    });
  });
  return rows;
}

export function findWinners(year?: number): WinnersMap {
  const data = compareAt(year || _horizon);
  if (data.length < 2) return {};
  const winners: WinnersMap = {};
  const metrics: Array<keyof ComparisonRow> = [
    "totalValue",
    "netValue",
    "roi",
    "totalLiquidWealth",
    "totalProtection",
    "totalTaxSavings",
    "bizIncome",
    "totalGrossIncome",
  ];
  metrics.forEach((m) => {
    let best: ComparisonRow | null = null;
    let bestVal = -Infinity;
    data.forEach((d) => {
      const val = d[m] as number;
      if (val > bestVal) {
        bestVal = val;
        best = d;
      }
    });
    if (best) {
      const winner = best as ComparisonRow;
      winners[m as string] = {
        name: winner.name,
        color: winner.color,
        value: bestVal,
      };
    }
  });

  let lowestCost: ComparisonRow | null = null;
  let lowestCostVal = Infinity;
  data.forEach((d) => {
    if (d.totalCost < lowestCostVal && d.totalCost > 0) {
      lowestCostVal = d.totalCost;
      lowestCost = d;
    }
  });
  if (lowestCost) {
    const lc = lowestCost as ComparisonRow;
    winners.lowestCost = { name: lc.name, color: lc.color, value: lowestCostVal };
  }
  return winners;
}

// ═══════════════════════════════════════════════════════════════════════════
// MILESTONE COMPARISON (multiple years at once)
// ═══════════════════════════════════════════════════════════════════════════

export function milestoneCompare(milestoneYears?: number[]): MilestoneRow[] {
  const years = milestoneYears || [1, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100];
  const table: MilestoneRow[] = [];
  years.forEach((yr) => {
    const row: MilestoneRow = { year: yr, strategies: [] };
    _strategies.forEach((s, i) => {
      const snap = getSnapshot(i, yr);
      row.strategies.push({
        name: s.name,
        color: s.color,
        totalValue: snap ? snap.totalValue : 0,
        totalLiquidWealth: snap ? snap.totalLiquidWealth : 0,
        netValue: snap ? snap.netValue : 0,
        bizIncome: snap ? snap.bizIncome : 0,
        totalGrossIncome: snap ? snap.totalGrossIncome : 0,
        roi: snap ? snap.roi : 0,
      });
    });
    table.push(row);
  });
  return table;
}

// ═══════════════════════════════════════════════════════════════════════════
// CHART DATA HELPERS
// Smart year selection: more granular early (yrs 1-5), sparser later.
// ═══════════════════════════════════════════════════════════════════════════

export function getChartSeries(
  metric: keyof HolisticSnapshot,
  maxYear?: number,
): ChartSeriesResult {
  const max = maxYear || _horizon;
  const plotYears: number[] = [];
  for (let y = 1; y <= Math.min(5, max); y++) plotYears.push(y);
  for (let y2 = 10; y2 <= max; y2 += y2 < 50 ? 5 : y2 < 100 ? 10 : 25) {
    if (plotYears.indexOf(y2) < 0) plotYears.push(y2);
  }
  if (plotYears.indexOf(max) < 0) plotYears.push(max);
  plotYears.sort((a, b) => a - b);

  const series = _strategies.map((s, i) => {
    const pts = plotYears.map((yr) => {
      const snap = getSnapshot(i, yr);
      return snap ? (snap[metric] as number) || 0 : 0;
    });
    return { n: s.name, c: s.color, pts };
  });

  const labels = plotYears.map((y) => "Yr" + y);
  return { series, labels, years: plotYears };
}

// ═══════════════════════════════════════════════════════════════════════════
// BACK-PLAN: binary search for required income
// "I want $X total value at year Y — what income do I need?"
// ═══════════════════════════════════════════════════════════════════════════

export interface HEBackPlanResult {
  requiredIncome: number;
  targetValue: number;
  targetYear: number;
  iterations: number;
}

export function backPlanHolistic(
  targetValue: number,
  targetYear: number,
  baseStrategy: HolisticStrategy,
): HEBackPlanResult {
  let low = 0;
  let high = 10000000;
  let iterations = 0;
  let bestIncome = 0;

  while (high - low > 1000 && iterations < 50) {
    const mid = Math.round((low + high) / 2);
    const testStrategy: HolisticStrategy = JSON.parse(
      JSON.stringify(baseStrategy),
    );
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
// PRESET HOLISTIC STRATEGIES (9 total)
// ═══════════════════════════════════════════════════════════════════════════

export function presetWealthBridgeClient(profile: ClientProfile): HolisticStrategy {
  return createHolisticStrategy("WealthBridge Plan", {
    color: "#16A34A",
    hasBizIncome: false,
    profile,
    companyKey: "wealthbridge",
    savingsRate: 0.15,
    investmentReturn: 0.07,
    reinvestTaxSavings: true,
  });
}

export function presetWealthBridgePro(
  profile: ClientProfile,
  role: BIERoleKey,
): HolisticStrategy {
  const presetFn = BIEMod.PRESETS[role as keyof typeof BIEMod.PRESETS] || BIEMod.PRESETS.experiencedPro;
  const bizStrat = presetFn();
  const roleName = BIEMod.ROLES[role] ? BIEMod.ROLES[role].name : String(role);
  return createHolisticStrategy("WealthBridge " + roleName, {
    color: "#16A34A",
    hasBizIncome: true,
    bizStrategy: bizStrat,
    profile,
    companyKey: "wealthbridge",
    savingsRate: 0.15,
    investmentReturn: 0.07,
    reinvestTaxSavings: true,
  });
}

export function presetDoNothing(profile: ClientProfile): HolisticStrategy {
  return createHolisticStrategy("Do Nothing (Current Path)", {
    color: "#94A3B8",
    hasBizIncome: false,
    profile,
    companyKey: "donothing",
    savingsRate: 0.1,
    investmentReturn: 0.06,
    reinvestTaxSavings: false,
  });
}

export function presetDIY(profile: ClientProfile): HolisticStrategy {
  return createHolisticStrategy("DIY (Self-Directed)", {
    color: "#7C3AED",
    hasBizIncome: false,
    profile,
    companyKey: "diy",
    savingsRate: 0.15,
    investmentReturn: 0.065,
    reinvestTaxSavings: false,
  });
}

export function presetWirehouse(profile: ClientProfile): HolisticStrategy {
  return createHolisticStrategy("Wirehouse (Full Service)", {
    color: "#2563EB",
    hasBizIncome: false,
    profile,
    companyKey: "wirehouse",
    savingsRate: 0.12,
    investmentReturn: 0.065,
    reinvestTaxSavings: false,
  });
}

export function presetRIA(profile: ClientProfile): HolisticStrategy {
  return createHolisticStrategy("Independent RIA", {
    color: "#0891B2",
    hasBizIncome: false,
    profile,
    companyKey: "ria",
    savingsRate: 0.15,
    investmentReturn: 0.07,
    reinvestTaxSavings: true,
  });
}

export function presetCaptiveMutual(profile: ClientProfile): HolisticStrategy {
  return createHolisticStrategy("Captive Mutual Carrier", {
    color: "#1E40AF",
    hasBizIncome: false,
    profile,
    companyKey: "captivemutual",
    savingsRate: 0.12,
    investmentReturn: 0.065,
    reinvestTaxSavings: false,
  });
}

export function presetCommunityBD(profile: ClientProfile): HolisticStrategy {
  return createHolisticStrategy("Community Broker-Dealer", {
    color: "#0891B2",
    hasBizIncome: false,
    profile,
    companyKey: "communitybd",
    savingsRate: 0.12,
    investmentReturn: 0.06,
    reinvestTaxSavings: false,
  });
}

export function presetWBPremFinance(profile: ClientProfile): HolisticStrategy {
  // Enhanced WB plan including premium financing for HNW clients
  const p: ClientProfile = { ...profile };
  if ((p.netWorth || 0) < 250000) p.netWorth = 250000;
  if ((p.income || 0) < 150000) p.income = 150000;
  return createHolisticStrategy("WealthBridge + Premium Finance", {
    color: "#059669",
    hasBizIncome: false,
    profile: p,
    companyKey: "wealthbridge",
    savingsRate: 0.15,
    investmentReturn: 0.07,
    reinvestTaxSavings: true,
  });
}

export const PRESETS = {
  wealthbridgeClient: presetWealthBridgeClient,
  wealthbridgePro: presetWealthBridgePro,
  doNothing: presetDoNothing,
  diy: presetDIY,
  wirehouse: presetWirehouse,
  ria: presetRIA,
  captivemutual: presetCaptiveMutual,
  communitybd: presetCommunityBD,
  wbPremFinance: presetWBPremFinance,
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// SAVE / LOAD
// ═══════════════════════════════════════════════════════════════════════════

export function exportState(): string {
  return JSON.stringify({
    strategies: _strategies.map((s) => ({
      strategy: s.strategy,
      name: s.name,
      color: s.color,
    })),
    horizon: _horizon,
  });
}

export function importState(json: string): boolean {
  try {
    const data = JSON.parse(json);
    _horizon = data.horizon || 30;
    clearStrategies();
    (data.strategies || []).forEach((s: { strategy: HolisticStrategy }) => {
      addStrategy(s.strategy);
    });
    return true;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HE NAMESPACE EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export const HE = {
  createHolisticStrategy,
  simulate,
  addStrategy,
  removeStrategy,
  clearStrategies,
  setHorizon,
  getHorizon,
  getStrategies,
  getSnapshot,
  compareAt,
  findWinners,
  milestoneCompare,
  getChartSeries,
  backPlanHolistic,
  exportState,
  importState,
  PRESETS,
} as const;

export default HE;
