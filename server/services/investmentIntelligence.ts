/**
 * Investment Intelligence Service
 * Economic History (Shiller CAPE), IUL Back-Test Engine, Monte Carlo Simulation
 */
import { getDb } from "../db";
import { economicHistory, marketIndexHistory } from "../../drizzle/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";

// ─── Shiller CAPE Historical Data (Annual, 1990–2025) ────────────────────

const SHILLER_CAPE_DATA = [
  { year: 1990, cape: 15.5, sp500Return: -3.1, inflation: 5.4, tenYrYield: 8.55 },
  { year: 1991, cape: 17.3, sp500Return: 30.5, inflation: 4.2, tenYrYield: 7.86 },
  { year: 1992, cape: 18.1, sp500Return: 7.6, inflation: 3.0, tenYrYield: 7.01 },
  { year: 1993, cape: 19.6, sp500Return: 10.1, inflation: 3.0, tenYrYield: 5.87 },
  { year: 1994, cape: 17.5, sp500Return: 1.3, inflation: 2.6, tenYrYield: 7.09 },
  { year: 1995, cape: 20.0, sp500Return: 37.6, inflation: 2.8, tenYrYield: 6.57 },
  { year: 1996, cape: 24.7, sp500Return: 23.0, inflation: 3.0, tenYrYield: 6.44 },
  { year: 1997, cape: 28.3, sp500Return: 33.4, inflation: 2.3, tenYrYield: 6.35 },
  { year: 1998, cape: 32.9, sp500Return: 28.6, inflation: 1.6, tenYrYield: 5.26 },
  { year: 1999, cape: 40.6, sp500Return: 21.0, inflation: 2.2, tenYrYield: 5.65 },
  { year: 2000, cape: 43.8, sp500Return: -9.1, inflation: 3.4, tenYrYield: 6.03 },
  { year: 2001, cape: 36.0, sp500Return: -11.9, inflation: 2.8, tenYrYield: 5.02 },
  { year: 2002, cape: 28.0, sp500Return: -22.1, inflation: 1.6, tenYrYield: 4.61 },
  { year: 2003, cape: 22.9, sp500Return: 28.7, inflation: 2.3, tenYrYield: 4.01 },
  { year: 2004, cape: 25.9, sp500Return: 10.9, inflation: 2.7, tenYrYield: 4.27 },
  { year: 2005, cape: 25.6, sp500Return: 4.9, inflation: 3.4, tenYrYield: 4.29 },
  { year: 2006, cape: 26.2, sp500Return: 15.8, inflation: 3.2, tenYrYield: 4.80 },
  { year: 2007, cape: 25.9, sp500Return: 5.5, inflation: 2.8, tenYrYield: 4.63 },
  { year: 2008, cape: 21.5, sp500Return: -37.0, inflation: 3.8, tenYrYield: 3.66 },
  { year: 2009, cape: 15.2, sp500Return: 26.5, inflation: -0.4, tenYrYield: 3.26 },
  { year: 2010, cape: 20.5, sp500Return: 15.1, inflation: 1.6, tenYrYield: 3.22 },
  { year: 2011, cape: 20.4, sp500Return: 2.1, inflation: 3.2, tenYrYield: 2.78 },
  { year: 2012, cape: 19.7, sp500Return: 16.0, inflation: 2.1, tenYrYield: 1.80 },
  { year: 2013, cape: 22.2, sp500Return: 32.4, inflation: 1.5, tenYrYield: 2.35 },
  { year: 2014, cape: 25.9, sp500Return: 13.7, inflation: 1.6, tenYrYield: 2.54 },
  { year: 2015, cape: 25.0, sp500Return: 1.4, inflation: 0.1, tenYrYield: 2.14 },
  { year: 2016, cape: 24.2, sp500Return: 12.0, inflation: 1.3, tenYrYield: 1.84 },
  { year: 2017, cape: 28.1, sp500Return: 21.8, inflation: 2.1, tenYrYield: 2.33 },
  { year: 2018, cape: 30.3, sp500Return: -4.4, inflation: 2.4, tenYrYield: 2.91 },
  { year: 2019, cape: 28.4, sp500Return: 31.5, inflation: 1.8, tenYrYield: 2.14 },
  { year: 2020, cape: 30.0, sp500Return: 18.4, inflation: 1.2, tenYrYield: 0.93 },
  { year: 2021, cape: 35.8, sp500Return: 28.7, inflation: 4.7, tenYrYield: 1.52 },
  { year: 2022, cape: 28.0, sp500Return: -18.1, inflation: 8.0, tenYrYield: 2.95 },
  { year: 2023, cape: 29.5, sp500Return: 26.3, inflation: 4.1, tenYrYield: 3.88 },
  { year: 2024, cape: 33.2, sp500Return: 23.3, inflation: 2.9, tenYrYield: 4.25 },
  { year: 2025, cape: 34.5, sp500Return: 5.2, inflation: 2.5, tenYrYield: 4.30 },
];

// ─── S&P 500 Annual Returns (1928–2025, for Monte Carlo) ─────────────────

const SP500_ANNUAL_RETURNS = [
  43.6, -8.4, -24.9, -43.3, -8.2, 54.0, -1.4, 47.7, 33.9, -35.0, 31.1, -0.4,
  -9.8, -11.6, 20.3, 25.9, 19.8, 36.4, -8.1, 5.7, 5.5, 18.8, 31.7, 24.0,
  18.4, -1.0, 52.6, 31.6, 6.6, -10.8, 43.4, 12.0, 0.5, 26.9, -8.7, 22.8,
  16.5, 12.5, -10.1, 24.0, 11.1, -8.5, 4.0, 14.3, 19.0, -14.7, -26.5, 37.2,
  23.8, -7.2, 6.6, 18.4, 32.4, -4.9, 21.4, 22.5, 6.3, 31.7, 18.7, 5.3,
  16.6, 31.5, -3.1, 30.5, 7.6, 10.1, 1.3, 37.6, 23.0, 33.4, 28.6, 21.0,
  -9.1, -11.9, -22.1, 28.7, 10.9, 4.9, 15.8, 5.5, -37.0, 26.5, 15.1, 2.1,
  16.0, 32.4, 13.7, 1.4, 12.0, 21.8, -4.4, 31.5, 18.4, 28.7, -18.1, 26.3, 23.3, 5.2,
];

// ─── Seed Economic History ───────────────────────────────────────────────

export async function seedEconomicHistory(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const records: any[] = [];

  for (const d of SHILLER_CAPE_DATA) {
    records.push(
      { date: `${d.year}-12-31`, metricName: "shiller_cape", value: d.cape.toString(), source: "Robert Shiller / Yale" },
      { date: `${d.year}-12-31`, metricName: "sp500_annual_return", value: d.sp500Return.toString(), source: "S&P Dow Jones Indices" },
      { date: `${d.year}-12-31`, metricName: "cpi_inflation", value: d.inflation.toString(), source: "BLS CPI-U" },
      { date: `${d.year}-12-31`, metricName: "ten_year_treasury", value: d.tenYrYield.toString(), source: "US Treasury" },
    );
  }

  let inserted = 0;
  const batchSize = 50;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    try {
      await db.insert(economicHistory).values(batch);
      inserted += batch.length;
    } catch (e: any) {
      if (!e?.message?.includes("Duplicate")) console.error("[EconHistory] Insert error:", e?.message);
    }
  }

  return inserted;
}

export async function getShillerCAPE(startYear?: number, endYear?: number): Promise<any[]> {
  const db = await getDb();
  if (!db) {
    let data = SHILLER_CAPE_DATA;
    if (startYear) data = data.filter(d => d.year >= startYear);
    if (endYear) data = data.filter(d => d.year <= endYear);
    return data;
  }

  const conditions = [eq(economicHistory.metricName, "shiller_cape")];
  if (startYear) conditions.push(gte(economicHistory.date, `${startYear}-01-01`));
  if (endYear) conditions.push(lte(economicHistory.date, `${endYear}-12-31`));

  return db.select().from(economicHistory).where(and(...conditions)).orderBy(desc(economicHistory.date));
}

export async function getEconomicMetric(metricName: string, years?: number): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(economicHistory.metricName, metricName)];
  if (years) {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - years);
    conditions.push(gte(economicHistory.date, cutoff.toISOString().split("T")[0]));
  }

  return db.select().from(economicHistory).where(and(...conditions)).orderBy(desc(economicHistory.date));
}

// ─── IUL Back-Test Engine ────────────────────────────────────────────────

export interface IulBackTestParams {
  initialPremium: number;
  annualPremium: number;
  years: number;
  capRate: number;
  participationRate: number;
  floorRate: number;
  spread: number;
  costOfInsurance: number; // annual COI as percentage of account value
  startYear?: number; // historical start year for back-testing
}

export interface IulBackTestResult {
  year: number;
  calendarYear: number;
  sp500Return: number;
  creditedRate: number;
  premiumPaid: number;
  coiDeducted: number;
  accountValueStart: number;
  accountValueEnd: number;
  cumulativePremiums: number;
  netSurrenderValue: number;
  deathBenefit: number;
}

export function runIulBackTest(params: IulBackTestParams): {
  results: IulBackTestResult[];
  summary: {
    totalPremiums: number;
    finalAccountValue: number;
    averageCreditedRate: number;
    worstYear: number;
    bestYear: number;
    internalRateOfReturn: number;
  };
} {
  const {
    initialPremium, annualPremium, years, capRate,
    participationRate, floorRate, spread, costOfInsurance,
    startYear = 2000,
  } = params;

  const results: IulBackTestResult[] = [];
  let accountValue = 0;
  let cumulativePremiums = 0;
  let worstCredited = Infinity;
  let bestCredited = -Infinity;
  let totalCredited = 0;

  for (let y = 0; y < years; y++) {
    const calendarYear = startYear + y;
    const returnIdx = calendarYear - 1928;
    const sp500Return = returnIdx >= 0 && returnIdx < SP500_ANNUAL_RETURNS.length
      ? SP500_ANNUAL_RETURNS[returnIdx]
      : 7.0; // default if out of range

    // Calculate credited rate
    let creditedRate: number;
    if (sp500Return <= 0) {
      creditedRate = floorRate;
    } else {
      const afterParticipation = sp500Return * (participationRate / 100);
      const afterSpread = Math.max(afterParticipation - spread, 0);
      creditedRate = Math.min(afterSpread, capRate);
    }

    worstCredited = Math.min(worstCredited, creditedRate);
    bestCredited = Math.max(bestCredited, creditedRate);
    totalCredited += creditedRate;

    const premium = y === 0 ? initialPremium : annualPremium;
    cumulativePremiums += premium;

    const accountValueStart = accountValue + premium;
    const coiDeducted = accountValueStart * (costOfInsurance / 100);
    const afterCoi = accountValueStart - coiDeducted;
    const accountValueEnd = afterCoi * (1 + creditedRate / 100);

    accountValue = accountValueEnd;

    results.push({
      year: y + 1,
      calendarYear,
      sp500Return,
      creditedRate: parseFloat(creditedRate.toFixed(2)),
      premiumPaid: premium,
      coiDeducted: parseFloat(coiDeducted.toFixed(2)),
      accountValueStart: parseFloat(accountValueStart.toFixed(2)),
      accountValueEnd: parseFloat(accountValueEnd.toFixed(2)),
      cumulativePremiums,
      netSurrenderValue: parseFloat((accountValueEnd * 0.9).toFixed(2)), // simplified 10% surrender charge
      deathBenefit: parseFloat(Math.max(accountValueEnd * 1.1, cumulativePremiums * 1.5).toFixed(2)),
    });
  }

  // Simplified IRR approximation
  const irr = years > 0 ? ((Math.pow(accountValue / cumulativePremiums, 1 / years) - 1) * 100) : 0;

  return {
    results,
    summary: {
      totalPremiums: cumulativePremiums,
      finalAccountValue: parseFloat(accountValue.toFixed(2)),
      averageCreditedRate: parseFloat((totalCredited / years).toFixed(2)),
      worstYear: parseFloat(worstCredited.toFixed(2)),
      bestYear: parseFloat(bestCredited.toFixed(2)),
      internalRateOfReturn: parseFloat(irr.toFixed(2)),
    },
  };
}

// ─── Monte Carlo Simulation ──────────────────────────────────────────────

export interface MonteCarloParams {
  initialInvestment: number;
  annualContribution: number;
  years: number;
  simulations: number;
  meanReturn?: number; // if not provided, uses historical
  stdDeviation?: number; // if not provided, uses historical
  inflationRate?: number;
  withdrawalRate?: number; // for retirement scenarios
  withdrawalStartYear?: number;
}

export interface MonteCarloResult {
  percentile10: number[];
  percentile25: number[];
  percentile50: number[];
  percentile75: number[];
  percentile90: number[];
  successRate: number; // % of simulations that don't run out of money
  medianFinalValue: number;
  meanFinalValue: number;
  worstCase: number;
  bestCase: number;
  statistics: {
    meanReturn: number;
    stdDeviation: number;
    simulations: number;
    years: number;
  };
}

function boxMullerRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export function runMonteCarlo(params: MonteCarloParams): MonteCarloResult {
  const {
    initialInvestment, annualContribution, years, simulations = 1000,
    inflationRate = 2.5, withdrawalRate = 0, withdrawalStartYear = years,
  } = params;

  // Calculate historical mean and std dev from S&P 500 returns
  const returns = SP500_ANNUAL_RETURNS;
  const historicalMean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const historicalStdDev = Math.sqrt(
    returns.reduce((s, r) => s + Math.pow(r - historicalMean, 2), 0) / returns.length
  );

  const meanReturn = params.meanReturn ?? historicalMean;
  const stdDeviation = params.stdDeviation ?? historicalStdDev;

  // Run simulations
  const allPaths: number[][] = [];
  const finalValues: number[] = [];

  for (let sim = 0; sim < simulations; sim++) {
    const path: number[] = [initialInvestment];
    let value = initialInvestment;
    let depleted = false;

    for (let y = 1; y <= years; y++) {
      if (depleted) {
        path.push(0);
        continue;
      }

      // Random return using Box-Muller
      const randomReturn = meanReturn + stdDeviation * boxMullerRandom();
      value = value * (1 + randomReturn / 100);

      // Add contribution
      if (y <= withdrawalStartYear) {
        value += annualContribution;
      }

      // Withdrawal phase
      if (y > withdrawalStartYear && withdrawalRate > 0) {
        const withdrawal = value * (withdrawalRate / 100);
        value -= withdrawal;
      }

      // Inflation adjustment for display
      const realValue = value / Math.pow(1 + inflationRate / 100, y);

      if (realValue <= 0) {
        depleted = true;
        path.push(0);
      } else {
        path.push(parseFloat(realValue.toFixed(2)));
      }
    }

    allPaths.push(path);
    finalValues.push(path[path.length - 1]);
  }

  // Calculate percentiles
  const getPercentile = (yearIdx: number, pct: number): number => {
    const values = allPaths.map(p => p[yearIdx] ?? 0).filter(v => v !== undefined).sort((a, b) => a - b);
    if (values.length === 0) return 0;
    const idx = Math.floor(values.length * pct / 100);
    return values[Math.min(idx, values.length - 1)] ?? 0;
  };

  const percentile10: number[] = [];
  const percentile25: number[] = [];
  const percentile50: number[] = [];
  const percentile75: number[] = [];
  const percentile90: number[] = [];

  for (let y = 0; y <= years; y++) {
    percentile10.push(parseFloat(getPercentile(y, 10).toFixed(2)));
    percentile25.push(parseFloat(getPercentile(y, 25).toFixed(2)));
    percentile50.push(parseFloat(getPercentile(y, 50).toFixed(2)));
    percentile75.push(parseFloat(getPercentile(y, 75).toFixed(2)));
    percentile90.push(parseFloat(getPercentile(y, 90).toFixed(2)));
  }

  const sortedFinal = [...finalValues].sort((a, b) => a - b);
  const successRate = (finalValues.filter(v => v > 0).length / simulations) * 100;

  return {
    percentile10,
    percentile25,
    percentile50,
    percentile75,
    percentile90,
    successRate: parseFloat(successRate.toFixed(1)),
    medianFinalValue: sortedFinal[Math.floor(simulations / 2)],
    meanFinalValue: parseFloat((finalValues.reduce((s, v) => s + v, 0) / simulations).toFixed(2)),
    worstCase: sortedFinal[0],
    bestCase: sortedFinal[sortedFinal.length - 1],
    statistics: {
      meanReturn: parseFloat(meanReturn.toFixed(2)),
      stdDeviation: parseFloat(stdDeviation.toFixed(2)),
      simulations,
      years,
    },
  };
}

// ─── IUL vs Market Comparison ────────────────────────────────────────────

export function compareIulVsMarket(
  annualPremium: number,
  years: number,
  iulCap: number,
  iulFloor: number,
  iulParticipation: number,
  iulCoi: number,
  startYear: number = 2000,
): {
  iulFinalValue: number;
  marketFinalValue: number;
  iulTotalReturn: number;
  marketTotalReturn: number;
  iulWorstYear: number;
  marketWorstYear: number;
  yearByYear: Array<{ year: number; iulValue: number; marketValue: number; sp500Return: number }>;
} {
  let iulValue = 0;
  let marketValue = 0;
  let iulWorst = Infinity;
  let marketWorst = Infinity;
  const yearByYear: Array<{ year: number; iulValue: number; marketValue: number; sp500Return: number }> = [];

  for (let y = 0; y < years; y++) {
    const calendarYear = startYear + y;
    const returnIdx = calendarYear - 1928;
    const sp500Return = returnIdx >= 0 && returnIdx < SP500_ANNUAL_RETURNS.length
      ? SP500_ANNUAL_RETURNS[returnIdx]
      : 7.0;

    // IUL
    iulValue += annualPremium;
    const coiDeducted = iulValue * (iulCoi / 100);
    iulValue -= coiDeducted;
    let iulCredited: number;
    if (sp500Return <= 0) {
      iulCredited = iulFloor;
    } else {
      const afterPart = sp500Return * (iulParticipation / 100);
      iulCredited = Math.min(afterPart, iulCap);
    }
    iulValue *= (1 + iulCredited / 100);
    iulWorst = Math.min(iulWorst, iulCredited);

    // Direct market
    marketValue += annualPremium;
    marketValue *= (1 + sp500Return / 100);
    marketWorst = Math.min(marketWorst, sp500Return);

    yearByYear.push({
      year: calendarYear,
      iulValue: parseFloat(iulValue.toFixed(2)),
      marketValue: parseFloat(marketValue.toFixed(2)),
      sp500Return,
    });
  }

  const totalPremiums = annualPremium * years;

  return {
    iulFinalValue: parseFloat(iulValue.toFixed(2)),
    marketFinalValue: parseFloat(marketValue.toFixed(2)),
    iulTotalReturn: parseFloat(((iulValue - totalPremiums) / totalPremiums * 100).toFixed(2)),
    marketTotalReturn: parseFloat(((marketValue - totalPremiums) / totalPremiums * 100).toFixed(2)),
    iulWorstYear: parseFloat(iulWorst.toFixed(2)),
    marketWorstYear: parseFloat(marketWorst.toFixed(2)),
    yearByYear,
  };
}
