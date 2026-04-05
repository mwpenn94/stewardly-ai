/**
 * Calculator Importer — Import calculator configurations and formulas
 * Calculator configs are defined in-memory. DB persistence uses calculatorResultCache.
 */
import { logger } from "../../_core/logger";

const log = logger.child({ module: "calculatorImporter" });

export interface CalculatorConfig {
  name: string;
  type: "retirement" | "tax" | "insurance" | "estate" | "social_security" | "medicare" | "risk" | "income";
  version: string;
  inputs: Array<{ field: string; label: string; type: "number" | "select" | "date" | "boolean"; required: boolean; default?: unknown }>;
  formula: string;
  outputFields: string[];
}

const BUILT_IN_CALCULATORS: CalculatorConfig[] = [
  {
    name: "Retirement Readiness", type: "retirement", version: "1.0",
    inputs: [
      { field: "currentAge", label: "Current Age", type: "number", required: true },
      { field: "retirementAge", label: "Target Retirement Age", type: "number", required: true, default: 65 },
      { field: "currentSavings", label: "Current Savings ($)", type: "number", required: true },
      { field: "annualContribution", label: "Annual Contribution ($)", type: "number", required: true },
      { field: "expectedReturn", label: "Expected Return (%)", type: "number", required: true, default: 7 },
      { field: "desiredIncome", label: "Desired Annual Income ($)", type: "number", required: true },
    ],
    formula: "retirementReadiness",
    outputFields: ["projectedBalance", "incomeReplacement", "gap", "readinessScore"],
  },
  {
    name: "Tax Optimization", type: "tax", version: "1.0",
    inputs: [
      { field: "filingStatus", label: "Filing Status", type: "select", required: true },
      { field: "grossIncome", label: "Gross Income ($)", type: "number", required: true },
      { field: "deductions", label: "Itemized Deductions ($)", type: "number", required: false },
      { field: "state", label: "State", type: "select", required: true },
    ],
    formula: "taxOptimization",
    outputFields: ["effectiveRate", "marginalRate", "totalTax", "optimizationOpportunities"],
  },
  {
    name: "Insurance Gap", type: "insurance", version: "1.0",
    inputs: [
      { field: "age", label: "Age", type: "number", required: true },
      { field: "annualIncome", label: "Annual Income ($)", type: "number", required: true },
      { field: "dependents", label: "Number of Dependents", type: "number", required: true },
      { field: "currentCoverage", label: "Current Coverage ($)", type: "number", required: false, default: 0 },
      { field: "hasDisability", label: "Has Disability Coverage", type: "boolean", required: false },
    ],
    formula: "insuranceGap",
    outputFields: ["recommendedCoverage", "gap", "monthlyPremiumEstimate", "protectionScore"],
  },
  {
    name: "Social Security Timing", type: "social_security", version: "1.0",
    inputs: [
      { field: "birthYear", label: "Birth Year", type: "number", required: true },
      { field: "estimatedPIA", label: "Estimated PIA ($)", type: "number", required: true },
      { field: "claimAge", label: "Planned Claim Age", type: "number", required: true, default: 67 },
      { field: "lifeExpectancy", label: "Life Expectancy", type: "number", required: true, default: 85 },
    ],
    formula: "socialSecurityTiming",
    outputFields: ["monthlyBenefit", "lifetimeTotal", "breakEvenAge", "optimalAge"],
  },
  {
    name: "Estate Planning", type: "estate", version: "1.0",
    inputs: [
      { field: "totalEstate", label: "Total Estate Value ($)", type: "number", required: true },
      { field: "filingStatus", label: "Filing Status", type: "select", required: true },
      { field: "stateOfResidence", label: "State", type: "select", required: true },
      { field: "charitableIntent", label: "Charitable Intent (%)", type: "number", required: false, default: 0 },
    ],
    formula: "estatePlanning",
    outputFields: ["federalExemption", "stateExemption", "estimatedTax", "strategies"],
  },
];

export function getBuiltInCalculators(): CalculatorConfig[] {
  return BUILT_IN_CALCULATORS;
}

export function getCalculatorByType(type: string): CalculatorConfig | undefined {
  return BUILT_IN_CALCULATORS.find((c) => c.type === type);
}

export function getCalculatorByName(name: string): CalculatorConfig | undefined {
  return BUILT_IN_CALCULATORS.find((c) => c.name === name);
}

export function getAllCalculatorTypes(): string[] {
  return BUILT_IN_CALCULATORS.map((c) => c.type);
}
