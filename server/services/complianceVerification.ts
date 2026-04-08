/**
 * Compliance Verification Service — Task 9
 *
 * Provides methodology disclosures, product reference citations,
 * and industry benchmark validation for all calculator outputs.
 * Ensures every projection includes proper disclaimers and sources.
 */
import { logger } from "../_core/logger";

const log = logger.child({ module: "compliance" });

// ═══════════════════════════════════════════════════════════════════════════
// METHODOLOGY DISCLOSURES
// ═══════════════════════════════════════════════════════════════════════════

export interface MethodologyDisclosure {
  id: string;
  title: string;
  description: string;
  assumptions: string[];
  limitations: string[];
  sources: string[];
  lastUpdated: string;
}

export const METHODOLOGY_DISCLOSURES: Record<string, MethodologyDisclosure> = {
  uwe: {
    id: "uwe-methodology",
    title: "Unified Wealth Engine (UWE) Methodology",
    description: "The UWE projects long-term wealth accumulation by modeling annual savings, investment returns, insurance product cash values, and tax-advantaged growth across a configurable time horizon.",
    assumptions: [
      "Investment returns are modeled as constant annual rates unless Monte Carlo simulation is used",
      "Tax rates are based on current federal brackets and may not reflect future legislative changes",
      "Insurance product illustrations use carrier-published current rates, not guaranteed minimums",
      "Inflation is assumed at 2.5% annually for real-value calculations",
      "Social Security benefits are estimated using current SSA formulas and may change",
    ],
    limitations: [
      "Past performance does not guarantee future results",
      "Actual insurance product performance may differ from illustrated values",
      "Tax implications depend on individual circumstances not fully captured by the model",
      "The model does not account for major life events (disability, divorce, inheritance)",
      "State-specific tax rules are not included in the base projection",
    ],
    sources: [
      "LIMRA Annual U.S. Individual Life Insurance Sales Report",
      "Society of Actuaries (SOA) mortality tables",
      "Morningstar historical market return data",
      "Federal Reserve Economic Data (FRED)",
      "IRS Publication 590 (IRA rules)",
      "SSA Actuarial Life Table",
    ],
    lastUpdated: "2026-04-07",
  },
  bie: {
    id: "bie-methodology",
    title: "Business Income Engine (BIE) Methodology",
    description: "The BIE models insurance agency income by combining role-based compensation, GDC brackets, channel economics, and multi-stream revenue projections including renewals, overrides, and bonuses.",
    assumptions: [
      "GDC brackets and commission rates are based on published carrier compensation schedules",
      "Persistency rates use LIMRA industry averages (85% first-year, 92% renewal)",
      "Seasonality patterns are derived from historical industry production data",
      "Team growth assumes linear recruitment with configurable ramp periods",
      "Override structures follow standard carrier hierarchical compensation models",
    ],
    limitations: [
      "Actual compensation depends on carrier-specific contracts not fully modeled",
      "Regulatory changes may affect commission structures",
      "Market conditions affect product mix and average case size",
      "Individual production varies significantly from statistical averages",
      "Multi-level override calculations may differ by carrier agreement",
    ],
    sources: [
      "LIMRA Compensation Study for Financial Services Professionals",
      "National Association of Insurance Commissioners (NAIC) Market Share Reports",
      "Insurance Marketing & Research Association (IMRA) production benchmarks",
      "Bureau of Labor Statistics (BLS) insurance industry employment data",
      "Carrier-published compensation schedules (anonymized)",
    ],
    lastUpdated: "2026-04-07",
  },
  he: {
    id: "he-methodology",
    title: "Holistic Engine (HE) Methodology",
    description: "The HE combines UWE wealth projections with BIE income projections to create a unified year-by-year financial picture, enabling multi-strategy comparison and milestone tracking.",
    assumptions: [
      "UWE and BIE projections are additive and independent",
      "Milestone targets are user-defined and may not reflect realistic timelines",
      "Strategy comparison uses identical time horizons for fair comparison",
      "Back-planning calculations assume linear scaling of activity metrics",
    ],
    limitations: [
      "Combined projections amplify individual engine uncertainties",
      "Correlation between business income and investment returns is not modeled",
      "Milestone tracking does not account for non-linear wealth accumulation patterns",
    ],
    sources: [
      "All UWE and BIE sources apply",
      "Financial Planning Association (FPA) practice management benchmarks",
    ],
    lastUpdated: "2026-04-07",
  },
  monteCarlo: {
    id: "mc-methodology",
    title: "Monte Carlo Simulation Methodology",
    description: "Monte Carlo analysis runs 1,000+ randomized trials using historical market volatility parameters to estimate probability distributions of future portfolio values.",
    assumptions: [
      "Returns follow a log-normal distribution with mean and standard deviation derived from historical data",
      "Volatility is calibrated to S&P 500 historical data (1928-2025)",
      "Trials are independent and identically distributed",
      "No regime changes or structural breaks in market behavior are modeled",
    ],
    limitations: [
      "Historical volatility may not predict future market behavior",
      "Extreme tail events (black swans) may be underrepresented",
      "Correlation between asset classes is simplified",
      "1,000 trials provide reasonable but not exhaustive coverage of outcomes",
    ],
    sources: [
      "S&P 500 total return data (1928-2025)",
      "Robert Shiller's historical market data",
      "Journal of Financial Planning — Monte Carlo simulation best practices",
    ],
    lastUpdated: "2026-04-07",
  },
  stressTest: {
    id: "stress-methodology",
    title: "Stress Test Methodology",
    description: "Stress tests apply actual historical market crash sequences to the projected portfolio to evaluate resilience under extreme conditions.",
    assumptions: [
      "Historical crash sequences are applied as-is without modification",
      "Recovery patterns follow the actual historical recovery timeline",
      "Portfolio rebalancing during stress events follows the original allocation",
    ],
    limitations: [
      "Future crises may differ in magnitude, duration, and character from historical events",
      "Behavioral responses (panic selling, rebalancing) are not modeled",
      "Stress scenarios are limited to equity market crashes; other risks (inflation, deflation, geopolitical) are not included",
    ],
    sources: [
      "S&P 500 daily return data for crash periods",
      "National Bureau of Economic Research (NBER) recession dating",
      "Federal Reserve stress testing frameworks (CCAR/DFAST) for methodology reference",
    ],
    lastUpdated: "2026-04-07",
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCT REFERENCE CITATIONS
// ═══════════════════════════════════════════════════════════════════════════

export interface ProductCitation {
  productType: string;
  companyName: string;
  sourceDocument: string;
  sourceDate: string;
  rateType: string;
  citedValue: string;
  notes: string;
}

export const PRODUCT_CITATIONS: ProductCitation[] = [
  {
    productType: "Indexed Universal Life (IUL)",
    companyName: "Nationwide",
    sourceDocument: "Nationwide IUL Accumulator 3.0 Product Guide",
    sourceDate: "2025",
    rateType: "Illustrated Rate",
    citedValue: "6.5% current illustrated rate",
    notes: "Cap rate and participation rate subject to change. Guaranteed minimum 0% floor.",
  },
  {
    productType: "Indexed Universal Life (IUL)",
    companyName: "Pacific Life",
    sourceDocument: "Pacific Discovery Xelerator IUL II Illustration",
    sourceDate: "2025",
    rateType: "Illustrated Rate",
    citedValue: "6.75% current illustrated rate",
    notes: "S&P 500 index strategy with 10.5% cap.",
  },
  {
    productType: "Term Life Insurance",
    companyName: "Industry Average",
    sourceDocument: "LIMRA U.S. Individual Life Insurance Sales Report",
    sourceDate: "2025",
    rateType: "Average Premium",
    citedValue: "See RATES table by age/term/face amount",
    notes: "Rates vary by health class, age, and coverage amount.",
  },
  {
    productType: "Whole Life Insurance",
    companyName: "Industry Average",
    sourceDocument: "SOA Individual Life Experience Study",
    sourceDate: "2024",
    rateType: "Dividend Rate",
    citedValue: "4.0-5.5% current dividend scale",
    notes: "Dividends are not guaranteed and may vary.",
  },
  {
    productType: "Fixed Indexed Annuity",
    companyName: "Industry Average",
    sourceDocument: "LIMRA Secure Retirement Institute Annuity Sales Report",
    sourceDate: "2025",
    rateType: "Crediting Rate",
    citedValue: "4.5-7.0% illustrated rate range",
    notes: "Subject to cap rates and participation rates set by carrier.",
  },
  {
    productType: "Variable Universal Life (VUL)",
    companyName: "Industry Average",
    sourceDocument: "Morningstar Variable Annuity/Life Research",
    sourceDate: "2025",
    rateType: "Subaccount Performance",
    citedValue: "Historical equity subaccount average 8-10%",
    notes: "Past performance does not guarantee future results. Subject to market risk.",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// INDUSTRY BENCHMARKS
// ═══════════════════════════════════════════════════════════════════════════

export interface IndustryBenchmark {
  category: string;
  metric: string;
  value: string;
  source: string;
  year: number;
  notes: string;
}

export const INDUSTRY_BENCHMARKS: IndustryBenchmark[] = [
  {
    category: "Life Insurance",
    metric: "Average Policy Size",
    value: "$178,150",
    source: "LIMRA 2024 Individual Life Insurance Report",
    year: 2024,
    notes: "Includes all policy types. IUL average is higher at ~$250K.",
  },
  {
    category: "Life Insurance",
    metric: "First-Year Persistency",
    value: "85%",
    source: "LIMRA Persistency Study",
    year: 2024,
    notes: "Varies by product type and distribution channel.",
  },
  {
    category: "Life Insurance",
    metric: "Renewal Persistency",
    value: "92%",
    source: "LIMRA Persistency Study",
    year: 2024,
    notes: "13th-month and beyond.",
  },
  {
    category: "Investment Returns",
    metric: "S&P 500 Long-Term Average",
    value: "10.3% nominal, 7.1% real",
    source: "S&P Global / Shiller Data",
    year: 2025,
    notes: "1928-2025 geometric mean total return.",
  },
  {
    category: "Investment Returns",
    metric: "Bond Market Long-Term Average",
    value: "5.2% nominal",
    source: "Federal Reserve / Barclays Aggregate",
    year: 2025,
    notes: "1976-2025 Bloomberg US Aggregate Bond Index.",
  },
  {
    category: "Insurance Industry",
    metric: "Average Agent First-Year Commission",
    value: "55-110% of target premium",
    source: "LIMRA Compensation Study",
    year: 2024,
    notes: "Varies by product type and carrier.",
  },
  {
    category: "Insurance Industry",
    metric: "Average Renewal Commission",
    value: "2-5% of premium",
    source: "LIMRA Compensation Study",
    year: 2024,
    notes: "Years 2-10 depending on product.",
  },
  {
    category: "Financial Planning",
    metric: "Recommended Savings Rate",
    value: "15-20% of gross income",
    source: "Financial Planning Association",
    year: 2025,
    notes: "Including employer match for retirement savings.",
  },
  {
    category: "Financial Planning",
    metric: "Emergency Fund Target",
    value: "3-6 months expenses",
    source: "CFP Board Standards",
    year: 2025,
    notes: "Higher for self-employed or single-income households.",
  },
  {
    category: "Tax",
    metric: "Top Marginal Federal Rate",
    value: "37%",
    source: "IRS Revenue Procedure 2025-11",
    year: 2025,
    notes: "For taxable income over $609,350 (married filing jointly).",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// COMPLIANCE VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

export interface ComplianceCheck {
  rule: string;
  passed: boolean;
  message: string;
  severity: "error" | "warning" | "info";
}

/**
 * Validate that calculator output includes required compliance elements
 */
export function validateCompliance(output: {
  hasDisclaimer: boolean;
  hasMethodology: boolean;
  hasSources: boolean;
  illustratedRateUsed: number;
  guaranteedRateShown: boolean;
  projectionHorizon: number;
  includesStressTest: boolean;
}): ComplianceCheck[] {
  const checks: ComplianceCheck[] = [];

  checks.push({
    rule: "Disclaimer Required",
    passed: output.hasDisclaimer,
    message: output.hasDisclaimer
      ? "Disclaimer present in output"
      : "MISSING: All projections must include a disclaimer that past performance does not guarantee future results",
    severity: output.hasDisclaimer ? "info" : "error",
  });

  checks.push({
    rule: "Methodology Disclosure",
    passed: output.hasMethodology,
    message: output.hasMethodology
      ? "Methodology disclosure included"
      : "MISSING: Methodology assumptions and limitations must be disclosed",
    severity: output.hasMethodology ? "info" : "warning",
  });

  checks.push({
    rule: "Source Citations",
    passed: output.hasSources,
    message: output.hasSources
      ? "Source citations included"
      : "MISSING: Data sources should be cited for verifiability",
    severity: output.hasSources ? "info" : "warning",
  });

  checks.push({
    rule: "Illustrated Rate Reasonableness",
    passed: output.illustratedRateUsed <= 0.12,
    message: output.illustratedRateUsed <= 0.12
      ? `Illustrated rate ${(output.illustratedRateUsed * 100).toFixed(1)}% within reasonable range`
      : `WARNING: Illustrated rate ${(output.illustratedRateUsed * 100).toFixed(1)}% exceeds 12% — may be unrealistic`,
    severity: output.illustratedRateUsed <= 0.12 ? "info" : "warning",
  });

  if (!output.guaranteedRateShown) {
    checks.push({
      rule: "Guaranteed Rate Display",
      passed: false,
      message: "RECOMMENDED: Show guaranteed minimum rates alongside illustrated rates for insurance products",
      severity: "warning",
    });
  }

  if (output.projectionHorizon > 40) {
    checks.push({
      rule: "Projection Horizon",
      passed: false,
      message: `Projection horizon of ${output.projectionHorizon} years exceeds 40 years — uncertainty increases significantly`,
      severity: "warning",
    });
  }

  if (!output.includesStressTest) {
    checks.push({
      rule: "Stress Test Inclusion",
      passed: false,
      message: "RECOMMENDED: Include stress test results to show downside scenarios",
      severity: "info",
    });
  }

  return checks;
}

/**
 * Get all compliance data for a given engine type
 */
export function getComplianceBundle(engineType: string): {
  methodology: MethodologyDisclosure | null;
  citations: ProductCitation[];
  benchmarks: IndustryBenchmark[];
} {
  return {
    methodology: METHODOLOGY_DISCLOSURES[engineType] || null,
    citations: PRODUCT_CITATIONS,
    benchmarks: INDUSTRY_BENCHMARKS,
  };
}
