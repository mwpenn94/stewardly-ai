/**
 * Calculator Input Validation
 * 
 * Validates and sanitizes inputs to all financial calculators (UWE, BIE, HE, SCUI).
 * Prevents NaN propagation, negative values where inappropriate, and out-of-range inputs
 * that could produce misleading financial projections.
 * 
 * Audit finding: WE-003 — calculators accept raw inputs without boundary validation
 */
import type { ClientProfile, ProductConfig, UWEStrategy } from "./types";

export interface ValidationResult {
  valid: boolean;
  sanitized: Record<string, unknown>;
  warnings: string[];
  errors: string[];
}

/**
 * Clamp a number to a valid range, returning the default if NaN/undefined
 */
function clampOrDefault(value: unknown, min: number, max: number, defaultVal: number): number {
  if (value === undefined || value === null) return defaultVal;
  const num = Number(value);
  if (!Number.isFinite(num)) return defaultVal;
  return Math.max(min, Math.min(max, num));
}

/**
 * Validate and sanitize a ClientProfile for UWE/BIE/HE/SCUI calculations
 */
export function validateClientProfile(profile: Partial<ClientProfile>): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  const age = clampOrDefault(profile.age, 18, 100, 40);
  if (profile.age !== undefined && (profile.age < 18 || profile.age > 100)) {
    warnings.push(`Age ${profile.age} clamped to ${age} (valid range: 18-100)`);
  }

  const income = clampOrDefault(profile.income, 0, 100_000_000, 0);
  if (profile.income !== undefined && profile.income < 0) {
    warnings.push(`Negative income ${profile.income} clamped to 0`);
  }

  const netWorth = clampOrDefault(profile.netWorth, -50_000_000, 1_000_000_000, 0);
  const savings = clampOrDefault(profile.savings, 0, 1_000_000_000, 0);
  const monthlySavings = clampOrDefault(profile.monthlySavings, 0, 1_000_000, 0);
  const dependents = clampOrDefault(profile.dependents, 0, 20, 0);
  const mortgage = clampOrDefault(profile.mortgage, 0, 100_000_000, 0);
  const debts = clampOrDefault(profile.debts, 0, 100_000_000, 0);

  const marginalRate = clampOrDefault(profile.marginalRate, 0, 0.60, 0.25);
  if (profile.marginalRate !== undefined && (profile.marginalRate < 0 || profile.marginalRate > 0.60)) {
    warnings.push(`Marginal tax rate ${profile.marginalRate} clamped to ${marginalRate} (valid range: 0-0.60)`);
  }

  const equitiesReturn = clampOrDefault(profile.equitiesReturn, -0.20, 0.30, 0.07);
  if (profile.equitiesReturn !== undefined && (profile.equitiesReturn < -0.20 || profile.equitiesReturn > 0.30)) {
    warnings.push(`Equities return ${profile.equitiesReturn} clamped to ${equitiesReturn} (valid range: -0.20 to 0.30)`);
  }

  const existingInsurance = clampOrDefault(profile.existingInsurance, 0, 100_000_000, 0);

  const sanitized: ClientProfile = {
    age,
    income,
    netWorth,
    savings,
    monthlySavings,
    dependents: Math.round(dependents),
    mortgage,
    debts,
    marginalRate,
    equitiesReturn,
    existingInsurance,
    isBizOwner: Boolean(profile.isBizOwner),
  };

  return {
    valid: errors.length === 0,
    sanitized,
    warnings,
    errors,
  };
}

/**
 * Validate a ProductConfig for simulation
 */
export function validateProductConfig(config: Partial<ProductConfig>): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!config.type) {
    errors.push("Product type is required");
  }

  const amount = clampOrDefault(config.amount, 0, 100_000_000, 0);
  if (config.amount !== undefined && config.amount < 0) {
    warnings.push(`Negative product amount ${config.amount} clamped to 0`);
  }

  const premium = clampOrDefault(config.premium, 0, 10_000_000, 0);
  const term = clampOrDefault(config.term, 1, 100, 20);

  const sanitized = {
    ...config,
    amount,
    premium,
    term: Math.round(term),
  };

  return {
    valid: errors.length === 0,
    sanitized,
    warnings,
    errors,
  };
}

/**
 * Validate a full UWE strategy before simulation
 */
export function validateUWEStrategy(strategy: Partial<UWEStrategy>): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Validate profile
  const profileResult = validateClientProfile(strategy.profile || {});
  warnings.push(...profileResult.warnings);
  errors.push(...profileResult.errors);

  // Validate each product
  const products = strategy.products || [];
  if (products.length === 0) {
    warnings.push("No products in strategy — simulation will only show savings growth");
  }

  const sanitizedProducts: Record<string, unknown>[] = [];
  for (let i = 0; i < products.length; i++) {
    const prodResult = validateProductConfig(products[i]);
    if (!prodResult.valid) {
      errors.push(`Product ${i}: ${prodResult.errors.join(", ")}`);
    }
    warnings.push(...prodResult.warnings.map(w => `Product ${i}: ${w}`));
    sanitizedProducts.push(prodResult.sanitized);
  }

  return {
    valid: errors.length === 0,
    sanitized: {
      ...strategy,
      profile: profileResult.sanitized,
      products: sanitizedProducts,
    },
    warnings,
    errors,
  };
}

/**
 * Validate BIE comparison inputs
 */
export function validateBIEInputs(inputs: {
  age?: number;
  income?: number;
  netWorth?: number;
  premium?: number;
  products?: string[];
}): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  const age = clampOrDefault(inputs.age, 18, 100, 40);
  const income = clampOrDefault(inputs.income, 0, 100_000_000, 0);
  const netWorth = clampOrDefault(inputs.netWorth, -50_000_000, 1_000_000_000, 0);
  const premium = clampOrDefault(inputs.premium, 0, 10_000_000, 0);

  if (!inputs.products || inputs.products.length === 0) {
    warnings.push("No products specified for comparison — using defaults");
  }

  return {
    valid: errors.length === 0,
    sanitized: { age, income, netWorth, premium, products: inputs.products || [] },
    warnings,
    errors,
  };
}

/**
 * Validate SCUI stress test inputs
 */
export function validateSCUIInputs(inputs: {
  initialValue?: number;
  annualContribution?: number;
  growthRate?: number;
  years?: number;
  withdrawalRate?: number;
}): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  const initialValue = clampOrDefault(inputs.initialValue, 0, 1_000_000_000, 100_000);
  const annualContribution = clampOrDefault(inputs.annualContribution, 0, 10_000_000, 0);
  const growthRate = clampOrDefault(inputs.growthRate, -0.50, 0.50, 0.07);
  const years = clampOrDefault(inputs.years, 1, 100, 30);
  const withdrawalRate = clampOrDefault(inputs.withdrawalRate, 0, 0.20, 0.04);

  if (inputs.growthRate !== undefined && inputs.growthRate > 0.20) {
    warnings.push(`Growth rate ${(inputs.growthRate * 100).toFixed(1)}% exceeds 20% — consider industry benchmarks`);
  }

  if (inputs.withdrawalRate !== undefined && inputs.withdrawalRate > 0.06) {
    warnings.push(`Withdrawal rate ${(inputs.withdrawalRate * 100).toFixed(1)}% exceeds the 4-6% safe range`);
  }

  return {
    valid: errors.length === 0,
    sanitized: { initialValue, annualContribution, growthRate, years: Math.round(years), withdrawalRate },
    warnings,
    errors,
  };
}
