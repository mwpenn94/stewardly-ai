/**
 * seed-formulas.mjs — Seed the learning_formulas table with core financial formulas.
 * Run: node server/seed-formulas.mjs
 */
import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const formulas = [
  // ─── Time Value of Money ───────────────────────────────────────────
  {
    name: "Future Value (FV)",
    formula: "FV = PV × (1 + r)^n",
    variables: JSON.stringify([
      { name: "PV", label: "Present Value", default: 10000, unit: "$" },
      { name: "r", label: "Annual Rate (%)", default: 7, unit: "%", divisor: 100 },
      { name: "n", label: "Years", default: 10, unit: "years" }
    ]),
    tags: JSON.stringify(["time-value", "investing", "core"]),
    sourceRef: "CFA Level I — Quantitative Methods"
  },
  {
    name: "Present Value (PV)",
    formula: "PV = FV / (1 + r)^n",
    variables: JSON.stringify([
      { name: "FV", label: "Future Value", default: 25000, unit: "$" },
      { name: "r", label: "Discount Rate (%)", default: 5, unit: "%", divisor: 100 },
      { name: "n", label: "Years", default: 10, unit: "years" }
    ]),
    tags: JSON.stringify(["time-value", "valuation", "core"]),
    sourceRef: "CFA Level I — Quantitative Methods"
  },
  {
    name: "Net Present Value (NPV)",
    formula: "NPV = Σ [CFt / (1 + r)^t] − Initial Investment",
    variables: JSON.stringify([
      { name: "initialInvestment", label: "Initial Investment", default: 100000, unit: "$" },
      { name: "cf1", label: "Cash Flow Year 1", default: 30000, unit: "$" },
      { name: "cf2", label: "Cash Flow Year 2", default: 35000, unit: "$" },
      { name: "cf3", label: "Cash Flow Year 3", default: 40000, unit: "$" },
      { name: "cf4", label: "Cash Flow Year 4", default: 45000, unit: "$" },
      { name: "r", label: "Discount Rate (%)", default: 10, unit: "%", divisor: 100 }
    ]),
    tags: JSON.stringify(["capital-budgeting", "valuation", "core"]),
    sourceRef: "CFA Level I — Corporate Finance"
  },
  {
    name: "Payment (PMT) — Annuity",
    formula: "PMT = PV × r / [1 − (1 + r)^(−n)]",
    variables: JSON.stringify([
      { name: "PV", label: "Loan Amount", default: 250000, unit: "$" },
      { name: "r", label: "Monthly Rate (%)", default: 0.5, unit: "%", divisor: 100 },
      { name: "n", label: "Number of Payments", default: 360, unit: "months" }
    ]),
    tags: JSON.stringify(["time-value", "lending", "mortgage", "core"]),
    sourceRef: "CFP — General Principles of Financial Planning"
  },
  {
    name: "Future Value of Annuity (FVA)",
    formula: "FVA = PMT × [(1 + r)^n − 1] / r",
    variables: JSON.stringify([
      { name: "PMT", label: "Periodic Payment", default: 500, unit: "$" },
      { name: "r", label: "Period Rate (%)", default: 0.583, unit: "%", divisor: 100 },
      { name: "n", label: "Number of Periods", default: 360, unit: "months" }
    ]),
    tags: JSON.stringify(["time-value", "retirement", "savings"]),
    sourceRef: "CFP — Retirement Planning"
  },
  // ─── Investment Analysis ───────────────────────────────────────────
  {
    name: "Compound Annual Growth Rate (CAGR)",
    formula: "CAGR = (Ending / Beginning)^(1/n) − 1",
    variables: JSON.stringify([
      { name: "beginning", label: "Beginning Value", default: 10000, unit: "$" },
      { name: "ending", label: "Ending Value", default: 25000, unit: "$" },
      { name: "n", label: "Years", default: 5, unit: "years" }
    ]),
    tags: JSON.stringify(["investing", "performance", "core"]),
    sourceRef: "CFA Level I — Portfolio Management"
  },
  {
    name: "Sharpe Ratio",
    formula: "Sharpe = (Rp − Rf) / σp",
    variables: JSON.stringify([
      { name: "Rp", label: "Portfolio Return (%)", default: 12, unit: "%" },
      { name: "Rf", label: "Risk-Free Rate (%)", default: 3, unit: "%" },
      { name: "sigmaP", label: "Portfolio Std Dev (%)", default: 15, unit: "%" }
    ]),
    tags: JSON.stringify(["risk-adjusted", "portfolio", "core"]),
    sourceRef: "CFA Level I — Portfolio Management"
  },
  {
    name: "Internal Rate of Return (IRR)",
    formula: "0 = Σ [CFt / (1 + IRR)^t] − Initial Investment",
    variables: JSON.stringify([
      { name: "initialInvestment", label: "Initial Investment", default: 100000, unit: "$" },
      { name: "cf1", label: "Cash Flow Year 1", default: 30000, unit: "$" },
      { name: "cf2", label: "Cash Flow Year 2", default: 40000, unit: "$" },
      { name: "cf3", label: "Cash Flow Year 3", default: 50000, unit: "$" }
    ]),
    tags: JSON.stringify(["capital-budgeting", "valuation"]),
    sourceRef: "CFA Level I — Corporate Finance"
  },
  {
    name: "Weighted Average Cost of Capital (WACC)",
    formula: "WACC = (E/V × Re) + (D/V × Rd × (1 − Tc))",
    variables: JSON.stringify([
      { name: "E", label: "Market Value of Equity", default: 500000, unit: "$" },
      { name: "D", label: "Market Value of Debt", default: 200000, unit: "$" },
      { name: "Re", label: "Cost of Equity (%)", default: 12, unit: "%", divisor: 100 },
      { name: "Rd", label: "Cost of Debt (%)", default: 6, unit: "%", divisor: 100 },
      { name: "Tc", label: "Tax Rate (%)", default: 21, unit: "%", divisor: 100 }
    ]),
    tags: JSON.stringify(["corporate-finance", "valuation", "core"]),
    sourceRef: "CFA Level II — Corporate Finance"
  },
  // ─── Risk & Insurance ─────────────────────────────────────────────
  {
    name: "Human Life Value (HLV)",
    formula: "HLV = Annual Income × [(1 − (1 + r)^(−n)) / r]",
    variables: JSON.stringify([
      { name: "income", label: "Annual Income", default: 100000, unit: "$" },
      { name: "r", label: "Discount Rate (%)", default: 5, unit: "%", divisor: 100 },
      { name: "n", label: "Working Years Remaining", default: 25, unit: "years" }
    ]),
    tags: JSON.stringify(["insurance", "life-insurance", "needs-analysis"]),
    sourceRef: "CLU — Life Insurance Planning"
  },
  {
    name: "Capital Needs Analysis",
    formula: "Capital Need = (Annual Expenses − Other Income) / Assumed Rate",
    variables: JSON.stringify([
      { name: "expenses", label: "Annual Expenses", default: 80000, unit: "$" },
      { name: "otherIncome", label: "Other Income (SS, pension)", default: 30000, unit: "$" },
      { name: "rate", label: "Assumed Return (%)", default: 4, unit: "%", divisor: 100 }
    ]),
    tags: JSON.stringify(["insurance", "needs-analysis", "retirement"]),
    sourceRef: "CFP — Insurance Planning"
  },
  // ─── Retirement Planning ───────────────────────────────────────────
  {
    name: "Retirement Income Replacement Ratio",
    formula: "Replacement Ratio = Retirement Income / Pre-Retirement Income",
    variables: JSON.stringify([
      { name: "retirementIncome", label: "Target Retirement Income", default: 60000, unit: "$" },
      { name: "preRetirementIncome", label: "Pre-Retirement Income", default: 100000, unit: "$" }
    ]),
    tags: JSON.stringify(["retirement", "planning"]),
    sourceRef: "CFP — Retirement Planning"
  },
  {
    name: "4% Safe Withdrawal Rate",
    formula: "Annual Withdrawal = Portfolio × 0.04",
    variables: JSON.stringify([
      { name: "portfolio", label: "Portfolio Value", default: 1500000, unit: "$" },
      { name: "rate", label: "Withdrawal Rate (%)", default: 4, unit: "%" }
    ]),
    tags: JSON.stringify(["retirement", "withdrawal", "core"]),
    sourceRef: "Trinity Study — Bengen Rule"
  },
  {
    name: "Required Savings Rate",
    formula: "Savings Rate = (FV × r) / [(1 + r)^n − 1] / Income",
    variables: JSON.stringify([
      { name: "targetNest", label: "Target Nest Egg", default: 2000000, unit: "$" },
      { name: "income", label: "Annual Income", default: 100000, unit: "$" },
      { name: "r", label: "Expected Return (%)", default: 7, unit: "%", divisor: 100 },
      { name: "n", label: "Years to Retirement", default: 30, unit: "years" }
    ]),
    tags: JSON.stringify(["retirement", "savings", "planning"]),
    sourceRef: "CFP — Retirement Planning"
  },
  // ─── Tax Planning ─────────────────────────────────────────────────
  {
    name: "Effective Tax Rate",
    formula: "Effective Rate = Total Tax / Taxable Income",
    variables: JSON.stringify([
      { name: "totalTax", label: "Total Tax Paid", default: 22000, unit: "$" },
      { name: "taxableIncome", label: "Taxable Income", default: 100000, unit: "$" }
    ]),
    tags: JSON.stringify(["tax", "planning"]),
    sourceRef: "CFP — Tax Planning"
  },
  {
    name: "Tax-Equivalent Yield",
    formula: "TEY = Municipal Yield / (1 − Marginal Tax Rate)",
    variables: JSON.stringify([
      { name: "muniYield", label: "Municipal Bond Yield (%)", default: 3.5, unit: "%" },
      { name: "taxRate", label: "Marginal Tax Rate (%)", default: 32, unit: "%", divisor: 100 }
    ]),
    tags: JSON.stringify(["tax", "fixed-income", "investing"]),
    sourceRef: "CFA Level I — Fixed Income"
  },
  // ─── Estate Planning ──────────────────────────────────────────────
  {
    name: "Estate Tax Liability (Simplified)",
    formula: "Estate Tax = max(0, Gross Estate − Exemption) × Rate",
    variables: JSON.stringify([
      { name: "grossEstate", label: "Gross Estate Value", default: 15000000, unit: "$" },
      { name: "exemption", label: "Federal Exemption", default: 13610000, unit: "$" },
      { name: "rate", label: "Estate Tax Rate (%)", default: 40, unit: "%", divisor: 100 }
    ]),
    tags: JSON.stringify(["estate", "tax", "planning"]),
    sourceRef: "CFP — Estate Planning (2024 exemption)"
  },
  {
    name: "Charitable Remainder Trust Income",
    formula: "Annual Income = Trust Value × Payout Rate",
    variables: JSON.stringify([
      { name: "trustValue", label: "Trust Value", default: 1000000, unit: "$" },
      { name: "payoutRate", label: "Payout Rate (%)", default: 5, unit: "%" }
    ]),
    tags: JSON.stringify(["estate", "charitable", "trust"]),
    sourceRef: "CFP — Estate Planning"
  },
  // ─── Debt & Credit ────────────────────────────────────────────────
  {
    name: "Debt-to-Income Ratio (DTI)",
    formula: "DTI = Monthly Debt Payments / Gross Monthly Income",
    variables: JSON.stringify([
      { name: "monthlyDebt", label: "Monthly Debt Payments", default: 2500, unit: "$" },
      { name: "grossIncome", label: "Gross Monthly Income", default: 8000, unit: "$" }
    ]),
    tags: JSON.stringify(["debt", "lending", "qualification"]),
    sourceRef: "CFP — General Principles"
  },
  {
    name: "Debt Avalanche Payoff Time",
    formula: "Months = −ln(1 − (Balance × r / Payment)) / ln(1 + r)",
    variables: JSON.stringify([
      { name: "balance", label: "Outstanding Balance", default: 15000, unit: "$" },
      { name: "r", label: "Monthly Rate (%)", default: 1.5, unit: "%", divisor: 100 },
      { name: "payment", label: "Monthly Payment", default: 500, unit: "$" }
    ]),
    tags: JSON.stringify(["debt", "payoff", "strategy"]),
    sourceRef: "CFP — General Principles"
  },
  // ─── Business Valuation ───────────────────────────────────────────
  {
    name: "Price-to-Earnings Ratio (P/E)",
    formula: "P/E = Market Price per Share / Earnings per Share",
    variables: JSON.stringify([
      { name: "price", label: "Market Price", default: 150, unit: "$" },
      { name: "eps", label: "Earnings per Share", default: 7.5, unit: "$" }
    ]),
    tags: JSON.stringify(["valuation", "equity", "core"]),
    sourceRef: "CFA Level I — Equity Investments"
  },
  {
    name: "Discounted Cash Flow (DCF) — Gordon Growth",
    formula: "Value = D1 / (r − g)",
    variables: JSON.stringify([
      { name: "D1", label: "Next Year Dividend", default: 5, unit: "$" },
      { name: "r", label: "Required Return (%)", default: 10, unit: "%", divisor: 100 },
      { name: "g", label: "Growth Rate (%)", default: 3, unit: "%", divisor: 100 }
    ]),
    tags: JSON.stringify(["valuation", "equity", "dividend", "core"]),
    sourceRef: "CFA Level I — Equity Investments"
  },
  {
    name: "Enterprise Value (EV)",
    formula: "EV = Market Cap + Total Debt − Cash",
    variables: JSON.stringify([
      { name: "marketCap", label: "Market Capitalization", default: 5000000, unit: "$" },
      { name: "totalDebt", label: "Total Debt", default: 1000000, unit: "$" },
      { name: "cash", label: "Cash & Equivalents", default: 500000, unit: "$" }
    ]),
    tags: JSON.stringify(["valuation", "corporate-finance"]),
    sourceRef: "CFA Level II — Equity Investments"
  },
  // ─── Portfolio Theory ─────────────────────────────────────────────
  {
    name: "Capital Asset Pricing Model (CAPM)",
    formula: "E(Ri) = Rf + βi × (E(Rm) − Rf)",
    variables: JSON.stringify([
      { name: "Rf", label: "Risk-Free Rate (%)", default: 3, unit: "%" },
      { name: "beta", label: "Beta", default: 1.2, unit: "" },
      { name: "Rm", label: "Market Return (%)", default: 10, unit: "%" }
    ]),
    tags: JSON.stringify(["portfolio", "risk", "core"]),
    sourceRef: "CFA Level I — Portfolio Management"
  },
  {
    name: "Portfolio Standard Deviation (2-Asset)",
    formula: "σp = √(w1²σ1² + w2²σ2² + 2·w1·w2·σ1·σ2·ρ)",
    variables: JSON.stringify([
      { name: "w1", label: "Weight Asset 1 (%)", default: 60, unit: "%", divisor: 100 },
      { name: "sigma1", label: "Std Dev Asset 1 (%)", default: 20, unit: "%" },
      { name: "sigma2", label: "Std Dev Asset 2 (%)", default: 12, unit: "%" },
      { name: "rho", label: "Correlation", default: 0.3, unit: "" }
    ]),
    tags: JSON.stringify(["portfolio", "diversification", "risk"]),
    sourceRef: "CFA Level I — Portfolio Management"
  },
  {
    name: "Treynor Ratio",
    formula: "Treynor = (Rp − Rf) / βp",
    variables: JSON.stringify([
      { name: "Rp", label: "Portfolio Return (%)", default: 14, unit: "%" },
      { name: "Rf", label: "Risk-Free Rate (%)", default: 3, unit: "%" },
      { name: "beta", label: "Portfolio Beta", default: 1.1, unit: "" }
    ]),
    tags: JSON.stringify(["risk-adjusted", "portfolio"]),
    sourceRef: "CFA Level I — Portfolio Management"
  },
  {
    name: "Jensen's Alpha",
    formula: "α = Rp − [Rf + βp × (Rm − Rf)]",
    variables: JSON.stringify([
      { name: "Rp", label: "Portfolio Return (%)", default: 14, unit: "%" },
      { name: "Rf", label: "Risk-Free Rate (%)", default: 3, unit: "%" },
      { name: "beta", label: "Portfolio Beta", default: 1.1, unit: "" },
      { name: "Rm", label: "Market Return (%)", default: 10, unit: "%" }
    ]),
    tags: JSON.stringify(["risk-adjusted", "portfolio", "performance"]),
    sourceRef: "CFA Level I — Portfolio Management"
  },
  // ─── Fixed Income ─────────────────────────────────────────────────
  {
    name: "Bond Price (Coupon Bond)",
    formula: "Price = Σ [C / (1+y)^t] + [FV / (1+y)^n]",
    variables: JSON.stringify([
      { name: "FV", label: "Face Value", default: 1000, unit: "$" },
      { name: "C", label: "Annual Coupon", default: 50, unit: "$" },
      { name: "y", label: "Yield to Maturity (%)", default: 6, unit: "%", divisor: 100 },
      { name: "n", label: "Years to Maturity", default: 10, unit: "years" }
    ]),
    tags: JSON.stringify(["fixed-income", "bonds", "core"]),
    sourceRef: "CFA Level I — Fixed Income"
  },
  {
    name: "Current Yield",
    formula: "Current Yield = Annual Coupon / Market Price",
    variables: JSON.stringify([
      { name: "coupon", label: "Annual Coupon", default: 50, unit: "$" },
      { name: "price", label: "Market Price", default: 950, unit: "$" }
    ]),
    tags: JSON.stringify(["fixed-income", "bonds"]),
    sourceRef: "CFA Level I — Fixed Income"
  },
  {
    name: "Duration (Macaulay)",
    formula: "D = Σ [t × PV(CFt)] / Bond Price",
    variables: JSON.stringify([
      { name: "coupon", label: "Annual Coupon", default: 50, unit: "$" },
      { name: "FV", label: "Face Value", default: 1000, unit: "$" },
      { name: "y", label: "YTM (%)", default: 6, unit: "%", divisor: 100 },
      { name: "n", label: "Years to Maturity", default: 5, unit: "years" }
    ]),
    tags: JSON.stringify(["fixed-income", "risk", "duration"]),
    sourceRef: "CFA Level I — Fixed Income"
  },
  // ─── Real Estate ──────────────────────────────────────────────────
  {
    name: "Cap Rate",
    formula: "Cap Rate = NOI / Property Value",
    variables: JSON.stringify([
      { name: "NOI", label: "Net Operating Income", default: 75000, unit: "$" },
      { name: "value", label: "Property Value", default: 1000000, unit: "$" }
    ]),
    tags: JSON.stringify(["real-estate", "valuation"]),
    sourceRef: "CFP — Investment Planning"
  },
  {
    name: "Cash-on-Cash Return",
    formula: "CoC = Annual Cash Flow / Total Cash Invested",
    variables: JSON.stringify([
      { name: "cashFlow", label: "Annual Cash Flow", default: 15000, unit: "$" },
      { name: "invested", label: "Total Cash Invested", default: 200000, unit: "$" }
    ]),
    tags: JSON.stringify(["real-estate", "investing"]),
    sourceRef: "CFP — Investment Planning"
  },
  // ─── Behavioral / Planning ────────────────────────────────────────
  {
    name: "Rule of 72",
    formula: "Years to Double = 72 / Annual Return",
    variables: JSON.stringify([
      { name: "rate", label: "Annual Return (%)", default: 8, unit: "%" }
    ]),
    tags: JSON.stringify(["rule-of-thumb", "investing", "core"]),
    sourceRef: "General Financial Planning"
  },
  {
    name: "Emergency Fund Target",
    formula: "Emergency Fund = Monthly Expenses × Months",
    variables: JSON.stringify([
      { name: "expenses", label: "Monthly Expenses", default: 5000, unit: "$" },
      { name: "months", label: "Months of Coverage", default: 6, unit: "months" }
    ]),
    tags: JSON.stringify(["planning", "emergency", "core"]),
    sourceRef: "CFP — General Principles"
  }
];

async function seed() {
  const conn = await mysql.createConnection(DATABASE_URL);
  
  // Check if formulas already exist
  const [existing] = await conn.execute("SELECT COUNT(*) as cnt FROM learning_formulas");
  if (existing[0].cnt > 0) {
    console.log(`Already have ${existing[0].cnt} formulas. Skipping seed.`);
    await conn.end();
    return;
  }

  let inserted = 0;
  for (const f of formulas) {
    await conn.execute(
      "INSERT INTO learning_formulas (name, formula, variables, tags, source_ref, visibility, status, version) VALUES (?, ?, ?, ?, ?, 'public', 'published', 1)",
      [f.name, f.formula, f.variables, f.tags, f.sourceRef]
    );
    inserted++;
  }

  console.log(`Seeded ${inserted} financial formulas.`);
  await conn.end();
}

seed().catch(err => { console.error(err); process.exit(1); });
