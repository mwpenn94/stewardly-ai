/**
 * calculatorExport.ts — Formats calculator results into columns+rows
 * for the existing trpc.exports.exportPDF / exportCSV mutations.
 *
 * Each calculator type has a formatter that extracts the key metrics
 * into a standardized { title, subtitle, columns, rows } shape.
 */

export interface ExportColumn {
  key: string;
  label: string;
  format?: "text" | "number" | "currency" | "date" | "percent";
}

export interface CalcExportPayload {
  title: string;
  subtitle: string;
  columns: ExportColumn[];
  rows: Record<string, unknown>[];
}

// ─── Formatters per calculator type ─────────────────────────────────

function exportIUL(data: any): CalcExportPayload {
  return {
    title: "IUL Projection Report",
    subtitle: `Premium: $${data.annualPremium?.toLocaleString()} | Years: ${data.projections?.length || 0}`,
    columns: [
      { key: "year", label: "Year", format: "number" },
      { key: "cashValue", label: "Cash Value", format: "currency" },
      { key: "surrenderValue", label: "Surrender Value", format: "currency" },
      { key: "deathBenefit", label: "Death Benefit", format: "currency" },
      { key: "premiumPaid", label: "Premium Paid", format: "currency" },
    ],
    rows: (data.projections ?? []).map((p: any, i: number) => ({
      year: i + 1,
      cashValue: p.cashValue ?? 0,
      surrenderValue: p.surrenderValue ?? 0,
      deathBenefit: p.deathBenefit ?? 0,
      premiumPaid: p.premiumPaid ?? data.annualPremium ?? 0,
    })),
  };
}

function exportPF(data: any): CalcExportPayload {
  return {
    title: "Premium Finance Analysis Report",
    subtitle: `ROI: ${data.roi}% | Breakeven: ${data.breakevenYear ? `Year ${data.breakevenYear}` : "N/A"}`,
    columns: [
      { key: "year", label: "Year", format: "number" },
      { key: "cashValue", label: "Cash Value", format: "currency" },
      { key: "loanBalance", label: "Loan Balance", format: "currency" },
      { key: "netEquity", label: "Net Equity", format: "currency" },
      { key: "deathBenefit", label: "Death Benefit", format: "currency" },
    ],
    rows: (data.projections ?? []).map((p: any) => ({
      year: p.year ?? 0,
      cashValue: p.cashValue ?? 0,
      loanBalance: p.loanBalance ?? 0,
      netEquity: p.netEquity ?? 0,
      deathBenefit: p.deathBenefit ?? 0,
    })),
  };
}

function exportRetirement(data: any): CalcExportPayload {
  return {
    title: "Retirement Projection Report",
    subtitle: `Target: $${data.targetWealth?.toLocaleString()} | Projected: $${data.projectedWealth?.toLocaleString()}`,
    columns: [
      { key: "year", label: "Year", format: "number" },
      { key: "age", label: "Age", format: "number" },
      { key: "balance", label: "Balance", format: "currency" },
      { key: "contributions", label: "Contributions", format: "currency" },
      { key: "growth", label: "Growth", format: "currency" },
    ],
    rows: (data.projections ?? []).map((p: any) => ({
      year: p.year ?? 0,
      age: p.age ?? 0,
      balance: p.balance ?? 0,
      contributions: p.contributions ?? 0,
      growth: p.growth ?? 0,
    })),
  };
}

function exportTax(data: any): CalcExportPayload {
  return {
    title: "Tax Projection Report",
    subtitle: `Effective Rate: ${data.effectiveRate}% | Total Tax: $${data.totalTax?.toLocaleString()}`,
    columns: [
      { key: "bracket", label: "Tax Bracket", format: "text" },
      { key: "rate", label: "Rate", format: "percent" },
      { key: "taxableIncome", label: "Taxable Income", format: "currency" },
      { key: "taxOwed", label: "Tax Owed", format: "currency" },
    ],
    rows: (data.bracketBreakdown ?? []).map((b: any) => ({
      bracket: b.bracket ?? "",
      rate: b.rate ?? 0,
      taxableIncome: b.taxableIncome ?? 0,
      taxOwed: b.taxOwed ?? 0,
    })),
  };
}

function exportSS(data: any): CalcExportPayload {
  return {
    title: "Social Security Optimization Report",
    subtitle: `Optimal Age: ${data.optimalAge ?? "N/A"} | Max Lifetime: $${data.maxLifetimeBenefit?.toLocaleString()}`,
    columns: [
      { key: "claimAge", label: "Claiming Age", format: "number" },
      { key: "monthlyBenefit", label: "Monthly Benefit", format: "currency" },
      { key: "annualBenefit", label: "Annual Benefit", format: "currency" },
      { key: "lifetimeBenefit", label: "Lifetime Benefit", format: "currency" },
      { key: "breakeven", label: "Breakeven Age", format: "number" },
    ],
    rows: (data.scenarios ?? []).map((s: any) => ({
      claimAge: s.claimAge ?? 0,
      monthlyBenefit: s.monthlyBenefit ?? 0,
      annualBenefit: s.annualBenefit ?? 0,
      lifetimeBenefit: s.lifetimeBenefit ?? 0,
      breakeven: s.breakevenAge ?? 0,
    })),
  };
}

function exportMedicare(data: any): CalcExportPayload {
  return {
    title: "Medicare Analysis Report",
    subtitle: `IRMAA Surcharge: $${data.irmaaSurcharge?.toLocaleString() ?? 0}/yr`,
    columns: [
      { key: "pathway", label: "Pathway", format: "text" },
      { key: "monthlyCost", label: "Monthly Cost", format: "currency" },
      { key: "annualCost", label: "Annual Cost", format: "currency" },
      { key: "coverage", label: "Coverage Level", format: "text" },
    ],
    rows: (data.pathways ?? []).map((p: any) => ({
      pathway: p.name ?? "",
      monthlyCost: p.monthlyCost ?? 0,
      annualCost: p.annualCost ?? 0,
      coverage: p.coverageLevel ?? "",
    })),
  };
}

function exportHSA(data: any): CalcExportPayload {
  return {
    title: "HSA Optimizer Report",
    subtitle: `Max Contribution: $${data.maxContribution?.toLocaleString()} | Tax Savings: $${data.taxSavings?.toLocaleString()}`,
    columns: [
      { key: "strategy", label: "Strategy", format: "text" },
      { key: "contribution", label: "Contribution", format: "currency" },
      { key: "taxSavings", label: "Tax Savings", format: "currency" },
      { key: "projectedBalance", label: "Projected Balance", format: "currency" },
    ],
    rows: (data.strategies ?? []).map((s: any) => ({
      strategy: s.name ?? "",
      contribution: s.contribution ?? 0,
      taxSavings: s.taxSavings ?? 0,
      projectedBalance: s.projectedBalance ?? 0,
    })),
  };
}

function exportCharitable(data: any): CalcExportPayload {
  return {
    title: "Charitable Giving Strategy Report",
    subtitle: `Total Deduction: $${data.totalDeduction?.toLocaleString()} | Tax Savings: $${data.taxSavings?.toLocaleString()}`,
    columns: [
      { key: "vehicle", label: "Vehicle", format: "text" },
      { key: "deduction", label: "Deduction", format: "currency" },
      { key: "taxSavings", label: "Tax Savings", format: "currency" },
      { key: "effectiveCost", label: "Effective Cost", format: "currency" },
    ],
    rows: (data.vehicles ?? []).map((v: any) => ({
      vehicle: v.name ?? "",
      deduction: v.deduction ?? 0,
      taxSavings: v.taxSavings ?? 0,
      effectiveCost: v.effectiveCost ?? 0,
    })),
  };
}

function exportDivorce(data: any): CalcExportPayload {
  return {
    title: "Divorce Financial Analysis Report",
    subtitle: `Total Assets: $${data.totalAssets?.toLocaleString()} | Equitable Split: $${data.equitableSplit?.toLocaleString()}`,
    columns: [
      { key: "asset", label: "Asset", format: "text" },
      { key: "value", label: "Value", format: "currency" },
      { key: "party1Share", label: "Party 1 Share", format: "currency" },
      { key: "party2Share", label: "Party 2 Share", format: "currency" },
    ],
    rows: (data.assetDivision ?? []).map((a: any) => ({
      asset: a.name ?? "",
      value: a.value ?? 0,
      party1Share: a.party1 ?? 0,
      party2Share: a.party2 ?? 0,
    })),
  };
}

function exportEducation(data: any): CalcExportPayload {
  return {
    title: "Education Funding Report",
    subtitle: `Total Cost: $${data.totalCost?.toLocaleString()} | Funding Gap: $${data.fundingGap?.toLocaleString()}`,
    columns: [
      { key: "year", label: "Year", format: "number" },
      { key: "cost", label: "Annual Cost", format: "currency" },
      { key: "savings", label: "Savings Balance", format: "currency" },
      { key: "contribution", label: "Annual Contribution", format: "currency" },
    ],
    rows: (data.projections ?? []).map((p: any) => ({
      year: p.year ?? 0,
      cost: p.cost ?? 0,
      savings: p.savings ?? 0,
      contribution: p.contribution ?? 0,
    })),
  };
}

function exportStress(data: any): CalcExportPayload {
  return {
    title: "Stress Test Report",
    subtitle: "S&P 500 Historical Backtest + Crisis Scenarios",
    columns: [
      { key: "scenario", label: "Scenario", format: "text" },
      { key: "years", label: "Period", format: "text" },
      { key: "maxDrawdown", label: "Max Drawdown", format: "percent" },
      { key: "finalReturn", label: "Final Return", format: "percent" },
    ],
    rows: (Array.isArray(data) ? data : []).map((s: any) => ({
      scenario: s.name ?? s.key ?? "",
      years: s.years ?? "",
      maxDrawdown: s.returns?.maxDrawdown ?? 0,
      finalReturn: s.returns?.totalReturn ?? 0,
    })),
  };
}

function exportMonteCarlo(data: any): CalcExportPayload {
  return {
    title: "Monte Carlo Simulation Report",
    subtitle: "1,000-Trial Probability Analysis",
    columns: [
      { key: "percentile", label: "Percentile", format: "text" },
      { key: "finalValue", label: "Final Portfolio Value", format: "currency" },
      { key: "annualReturn", label: "Avg Annual Return", format: "percent" },
    ],
    rows: (Array.isArray(data) ? data : []).map((p: any, i: number) => ({
      percentile: p.percentile ?? `${(i + 1) * 10}th`,
      finalValue: p.finalValue ?? p.value ?? 0,
      annualReturn: p.annualReturn ?? 0,
    })),
  };
}

function exportHolisticScorecard(holisticResult: any, profile: any): CalcExportPayload {
  const domains = holisticResult?.domains ?? [];
  return {
    title: "Holistic Financial Scorecard",
    subtitle: `Composite Score: ${holisticResult?.compositeScore ?? 0}/3 | Stage: ${holisticResult?.stage ?? "Unknown"}`,
    columns: [
      { key: "domain", label: "Domain", format: "text" },
      { key: "score", label: "Score (0-3)", format: "number" },
      { key: "label", label: "Rating", format: "text" },
      { key: "metrics", label: "Key Metrics", format: "text" },
      { key: "topAction", label: "Top Action", format: "text" },
    ],
    rows: domains.map((d: any) => ({
      domain: d.label ?? d.id ?? "",
      score: d.score ?? 0,
      label: d.score === 3 ? "Strong" : d.score === 2 ? "Fair" : d.score === 1 ? "Needs Work" : "N/A",
      metrics: (d.metrics ?? []).slice(0, 2).map((m: any) => `${m.name}: ${m.value}`).join("; "),
      topAction: (d.actions ?? [])[0] ?? "",
    })),
  };
}

// ─── Public API ─────────────────────────────────────────────────────

const FORMATTERS: Record<string, (data: any) => CalcExportPayload> = {
  iul: exportIUL,
  pf: exportPF,
  ret: exportRetirement,
  tax: exportTax,
  ss: exportSS,
  medicare: exportMedicare,
  hsa: exportHSA,
  charitable: exportCharitable,
  divorce: exportDivorce,
  education: exportEducation,
  stress: exportStress,
  montecarlo: exportMonteCarlo,
};

/**
 * Format calculator results for export.
 * Returns null if the calculator type is unknown or data is empty.
 */
export function formatCalcForExport(calcId: string, data: any): CalcExportPayload | null {
  const formatter = FORMATTERS[calcId];
  if (!formatter || !data) return null;
  try {
    return formatter(data);
  } catch {
    return null;
  }
}

/**
 * Format the holistic scorecard for export.
 */
export function formatScorecardForExport(holisticResult: any, profile: any): CalcExportPayload {
  return exportHolisticScorecard(holisticResult, profile);
}

/**
 * Get the list of supported calculator export types.
 */
export function getSupportedExportTypes(): string[] {
  return Object.keys(FORMATTERS);
}
