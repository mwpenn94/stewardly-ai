/**
 * formulaRegistry.ts — Client-side formula computation registry
 *
 * Pass 124 bug fix. Since database can't store functions, formulas
 * are looked up by ID from this registry.
 */

export const FORMULA_REGISTRY: Record<string, (vars: Record<string, number>) => number> = {
  "future-value": (v) => v.PV * Math.pow(1 + v.r, v.n),
  "present-value": (v) => v.FV / Math.pow(1 + v.r, v.n),
  "compound-interest": (v) => v.P * Math.pow(1 + v.r / v.n, v.n * v.t),
  "rule-of-72": (v) => 72 / (v.r * 100),
  "debt-to-income": (v) => (v.monthlyDebt / v.monthlyIncome) * 100,
  "net-worth": (v) => v.totalAssets - v.totalLiabilities,
  "monthly-payment": (v) => {
    const r = v.rate / 12;
    const n = v.years * 12;
    return (v.principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  },
  "savings-goal": (v) => {
    const r = v.rate / 12;
    const n = v.months;
    return (v.goal * r) / (Math.pow(1 + r, n) - 1);
  },
};
