/**
 * SCUI — Stress Testing, Compliance, Historical Data, Industry Benchmarks
 *
 * Consolidated from server/engines/scui.ts into the canonical shared/calculators
 * namespace. Re-exports shared data from benchmarks.ts and adds unique SCUI
 * features: SP500 history, stress scenarios, historical backtesting, stress
 * testing, and guardrail checks.
 */

import type {
  StressScenario, BacktestResult, BacktestSummary, GuardrailWarning,
} from "./types";
import {
  PRODUCT_REFERENCES,
  INDUSTRY_BENCHMARKS,
  METHODOLOGY_DISCLOSURE,
} from "./benchmarks";

// Re-export the shared data so SCUI consumers don't need to know about benchmarks.ts
export { PRODUCT_REFERENCES, INDUSTRY_BENCHMARKS, METHODOLOGY_DISCLOSURE };

// ═══════════════════════════════════════════════════════════════════════════
// S&P 500 ANNUAL RETURNS 1928-2025 (exact from v7)
// ═══════════════════════════════════════════════════════════════════════════

export const SP500_HISTORY: Record<number, number> = {
  1928: .438, 1929: -.083, 1930: -.251, 1931: -.435, 1932: -.085, 1933: .540, 1934: -.014, 1935: .477,
  1936: .339, 1937: -.351, 1938: .311, 1939: -.004, 1940: -.098, 1941: -.116, 1942: .205, 1943: .259,
  1944: .198, 1945: .364, 1946: -.081, 1947: .057, 1948: .055, 1949: .187, 1950: .317, 1951: .244,
  1952: .183, 1953: -.010, 1954: .526, 1955: .316, 1956: .066, 1957: -.108, 1958: .434, 1959: .120,
  1960: .007, 1961: .269, 1962: -.088, 1963: .227, 1964: .164, 1965: .124, 1966: -.101, 1967: .240,
  1968: .110, 1969: -.085, 1970: .040, 1971: .143, 1972: .189, 1973: -.146, 1974: -.264, 1975: .372,
  1976: .239, 1977: -.072, 1978: .066, 1979: .184, 1980: .324, 1981: -.049, 1982: .215, 1983: .225,
  1984: .063, 1985: .316, 1986: .186, 1987: .052, 1988: .168, 1989: .315, 1990: -.031, 1991: .305,
  1992: .076, 1993: .100, 1994: .013, 1995: .376, 1996: .230, 1997: .333, 1998: .286, 1999: .210,
  2000: -.091, 2001: -.119, 2002: -.221, 2003: .287, 2004: .109, 2005: .049, 2006: .158, 2007: .055,
  2008: -.370, 2009: .265, 2010: .151, 2011: .021, 2012: .160, 2013: .324, 2014: .137, 2015: .014,
  2016: .120, 2017: .218, 2018: -.044, 2019: .314, 2020: .184, 2021: .286, 2022: -.181, 2023: .263,
  2024: .250, 2025: .100,
};

// ═══════════════════════════════════════════════════════════════════════════
// STRESS SCENARIOS (exact from v7)
// ═══════════════════════════════════════════════════════════════════════════

export const STRESS_SCENARIOS: Record<string, StressScenario> = {
  dotcom: {
    name: "Dot-Com Crash (2000-2002)",
    years: [2000, 2001, 2002, 2003, 2004],
    returns: [-0.091, -0.119, -0.221, 0.287, 0.109],
    description: "Tech bubble burst. S&P 500 fell 49% peak-to-trough over 30 months.",
  },
  gfc: {
    name: "Financial Crisis (2007-2009)",
    years: [2007, 2008, 2009, 2010, 2011],
    returns: [0.055, -0.370, 0.265, 0.151, 0.021],
    description: "Housing/credit crisis. S&P 500 fell 57% peak-to-trough. Lehman Brothers collapsed.",
  },
  covid: {
    name: "COVID Crash (2020)",
    years: [2019, 2020, 2021, 2022, 2023],
    returns: [0.314, 0.184, 0.286, -0.181, 0.263],
    description: "Pandemic shock. S&P 500 fell 34% in 23 trading days, then recovered within 5 months.",
  },
  stagflation: {
    name: "Stagflation (1973-1974)",
    years: [1972, 1973, 1974, 1975, 1976],
    returns: [0.189, -0.146, -0.264, 0.372, 0.239],
    description: "Oil embargo + high inflation. S&P 500 fell 48% peak-to-trough. CPI hit 12.3%. Double whammy of declining portfolio + eroding purchasing power.",
  },
  rising_rates: {
    name: "Rising Rates (2022)",
    years: [2020, 2021, 2022, 2023, 2024],
    returns: [0.184, 0.286, -0.181, 0.263, 0.250],
    description: "Fed hiked rates from 0% to 5.25% in 16 months. S&P 500 fell 25%. Bonds fell simultaneously — traditional 60/40 portfolio offered no refuge.",
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// HISTORICAL BACKTESTING
// ═══════════════════════════════════════════════════════════════════════════

export function historicalBacktest(
  startBalance: number,
  annualContribution: number,
  annualCost: number,
  horizon: number,
): BacktestSummary {
  const years = Object.keys(SP500_HISTORY).map(Number).sort((a, b) => a - b);
  let survived = 0, total = 0;
  let worst = { year: 0, final: Infinity, min: Infinity };
  let best = { year: 0, final: 0 };
  const allPaths: BacktestResult[] = [];

  for (let i = 0; i < years.length; i++) {
    const startYr = years[i];
    if (startYr + horizon > 2025) break;
    total++;
    let bal = startBalance;
    let minBal = startBalance;
    const path: number[] = [startBalance];
    let failed = false;

    for (let y = 0; y < horizon; y++) {
      const ret = SP500_HISTORY[startYr + y] || 0.07;
      bal = (bal + annualContribution - annualCost) * (1 + ret);
      if (bal < 0) { bal = 0; failed = true; }
      path.push(Math.max(0, Math.round(bal)));
      if (bal < minBal) minBal = bal;
    }

    if (!failed && bal > 0) survived++;
    allPaths.push({ startYear: startYr, finalBalance: Math.round(bal), minBalance: Math.round(minBal), path });
    if (bal < worst.final) worst = { year: startYr, final: Math.round(bal), min: Math.round(minBal) };
    if (bal > best.final) best = { year: startYr, final: Math.round(bal) };
  }

  const survivalRate = total > 0 ? survived / total : 1;
  const finals = allPaths.map((p) => p.finalBalance).sort((a, b) => a - b);
  const medianFinal = finals[Math.floor(finals.length / 2)] || 0;

  return { survivalRate, survived, total, worst, best, medianFinal, allPaths };
}

// ═══════════════════════════════════════════════════════════════════════════
// STRESS TEST (apply specific scenario to a balance)
// ═══════════════════════════════════════════════════════════════════════════

export function stressTest(
  scenarioKey: string,
  startBalance: number,
  annualContribution: number = 0,
  annualCost: number = 0,
): { scenario: StressScenario; path: number[]; finalBalance: number; maxDrawdown: number; recoveryYears: number } | null {
  const scenario = STRESS_SCENARIOS[scenarioKey];
  if (!scenario) return null;

  let bal = startBalance;
  let peak = startBalance;
  let maxDrawdown = 0;
  const path: number[] = [startBalance];

  for (let i = 0; i < scenario.returns.length; i++) {
    bal = (bal + annualContribution - annualCost) * (1 + scenario.returns[i]);
    if (bal < 0) bal = 0;
    path.push(Math.round(bal));
    if (bal > peak) peak = bal;
    const dd = peak > 0 ? (peak - bal) / peak : 0;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  let recoveryYears = 0;
  let recBal = bal;
  while (recBal < peak && recoveryYears < 20) {
    recBal = (recBal + annualContribution) * 1.07;
    recoveryYears++;
  }

  return {
    scenario,
    path,
    finalBalance: Math.round(bal),
    maxDrawdown: Math.round(maxDrawdown * 10000) / 10000,
    recoveryYears,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// GUARDRAIL CHECKS
// ═══════════════════════════════════════════════════════════════════════════

export function checkGuardrails(params: Record<string, number>): GuardrailWarning[] {
  const warnings: GuardrailWarning[] = [];

  const checks: { field: string; max: number; message: string; severity: "info" | "warning" | "error" }[] = [
    { field: "returnRate", max: 0.12, message: "Return rate exceeds historical S&P 500 average (10.3%). Consider using a more conservative estimate.", severity: "warning" },
    { field: "savingsRate", max: 0.50, message: "Savings rate above 50% is unusual. National average is 6.2% (BEA 2025).", severity: "info" },
    { field: "growthRate", max: 0.20, message: "Growth rate above 20% is aggressive. Consider industry benchmarks.", severity: "warning" },
    { field: "inflationRate", max: 0.06, message: "Inflation rate above 6% is historically unusual for sustained periods.", severity: "info" },
    { field: "taxRate", max: 0.50, message: "Effective tax rate above 50% is unusual. Top marginal federal rate is 37%.", severity: "warning" },
  ];

  for (const check of checks) {
    const val = params[check.field];
    if (val !== undefined && val > check.max) {
      warnings.push({
        field: check.field,
        value: val,
        threshold: check.max,
        message: check.message,
        severity: check.severity,
      });
    }
  }

  return warnings;
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

export const SCUI = {
  SP500_HISTORY,
  STRESS_SCENARIOS,
  PRODUCT_REFERENCES,
  INDUSTRY_BENCHMARKS,
  METHODOLOGY_DISCLOSURE,
  historicalBacktest,
  stressTest,
  checkGuardrails,
  getStressScenarioKeys: () => Object.keys(STRESS_SCENARIOS),
  getProductReferenceKeys: () => Object.keys(PRODUCT_REFERENCES),
  getBenchmarkKeys: () => Object.keys(INDUSTRY_BENCHMARKS),
};

export default SCUI;
