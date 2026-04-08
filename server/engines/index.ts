/**
 * WealthBridge Calculator Engines — Barrel Export
 *
 * UWE: Unified Wealth Engine (14 product models, 8 companies, Monte Carlo)
 * BIE: Business Income Engine (13 streams, roles, brackets, channels)
 * HE:  Holistic Engine (combines BIE+UWE, multi-strategy comparison)
 * SCUI: Stress/Compliance/Historical (S&P 500, backtesting, references)
 */

export { UWE, RATES, COMPANIES, interpRate, estPrem, buildStrategy, simulate as simulateUWE, monteCarlo } from "./uwe";
export { BIE, ROLES, GDC_BRACKETS, CHANNELS, SEASON_PROFILES, STREAM_TYPES, FREQUENCIES } from "./bie";
export { HE, createHolisticStrategy, simulate as simulateHE, compareStrategies, milestoneCompare, getChartSeries, backPlanHolistic } from "./he";
export { SCUI, SP500_HISTORY, STRESS_SCENARIOS, PRODUCT_REFERENCES, INDUSTRY_BENCHMARKS, METHODOLOGY_DISCLOSURE, historicalBacktest, stressTest, checkGuardrails } from "./scui";

// Re-export all types
export type * from "./types";
