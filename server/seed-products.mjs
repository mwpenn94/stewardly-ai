// Seed WealthBridge Financial Group product data
// Run: node server/seed-products.mjs

import mysql from "mysql2/promise";

const products = [
  {
    name: "WealthBridge IUL Accumulator",
    category: "IUL",
    description: "Indexed Universal Life policy designed for maximum cash value accumulation with downside protection. Features uncapped S&P 500 index strategy with 0% floor and participation rates up to 100%.",
    features: JSON.stringify(["0% floor protection", "Uncapped S&P 500 strategy", "Tax-free policy loans", "Flexible premium payments", "Living benefits rider available", "Chronic illness rider included"]),
    suitableFor: JSON.stringify(["High-income earners seeking tax-advantaged growth", "Business owners looking for supplemental retirement income", "Individuals wanting death benefit with cash accumulation"]),
    riskLevel: "moderate",
    minInvestment: "500/month or 6000/year",
    complianceNotes: "Must complete suitability assessment. Not suitable for short-term savings. Illustrated rates are not guaranteed. Policy charges apply.",
  },
  {
    name: "WealthBridge IUL Protector",
    category: "IUL",
    description: "Indexed Universal Life policy focused on providing maximum death benefit protection with competitive cash value growth. Ideal for estate planning and income replacement needs.",
    features: JSON.stringify(["Guaranteed death benefit", "Multiple index strategies", "No-lapse guarantee rider", "Accelerated death benefit", "Waiver of premium option"]),
    suitableFor: JSON.stringify(["Families needing income replacement", "Estate planning for high-net-worth individuals", "Business succession planning"]),
    riskLevel: "conservative",
    minInvestment: "300/month or 3600/year",
    complianceNotes: "Death benefit guarantees subject to policy terms. Riders may have additional costs. Suitability review required.",
  },
  {
    name: "WealthBridge Premium Finance Solution",
    category: "Premium Finance",
    description: "Leveraged life insurance strategy for high-net-worth clients. Finance large premium payments using third-party lending, allowing clients to maintain liquidity while securing substantial death benefits.",
    features: JSON.stringify(["Third-party premium financing", "Competitive loan rates", "Collateral optimization", "Exit strategy planning", "Annual review process", "Multiple carrier options"]),
    suitableFor: JSON.stringify(["Net worth $5M+", "Business owners with significant assets", "Estate planning needs exceeding $3M death benefit", "Clients seeking leverage strategies"]),
    riskLevel: "aggressive",
    minInvestment: "100000/year financed premium",
    complianceNotes: "Premium financing involves significant risks including collateral calls, interest rate changes, and policy performance risk. Requires detailed suitability analysis. Not suitable for all clients.",
  },
  {
    name: "WealthBridge Executive Bonus Plan (162)",
    category: "Executive Benefits",
    description: "Section 162 executive bonus arrangement using life insurance to provide tax-deductible bonuses to key employees. Employer pays premiums as compensation; employee owns the policy.",
    features: JSON.stringify(["Tax-deductible to employer", "Employee-owned policy", "Vesting schedule options", "Golden handcuff provisions", "Portable benefit", "Simple administration"]),
    suitableFor: JSON.stringify(["Businesses retaining key executives", "Companies seeking tax-deductible benefit plans", "Employers wanting selective benefit programs"]),
    riskLevel: "moderate",
    minInvestment: "25000/year",
    complianceNotes: "Tax implications vary. Employer receives tax deduction; employee reports as income. Consult tax advisor. Subject to reasonable compensation rules.",
  },
  {
    name: "WealthBridge Key Person Insurance",
    category: "Business Insurance",
    description: "Life insurance protecting businesses against the financial impact of losing a key employee or owner. Proceeds help cover lost revenue, recruitment costs, and business continuity.",
    features: JSON.stringify(["Business-owned policy", "Tax-free death benefit to business", "Flexible coverage amounts", "Term or permanent options", "Buy-sell agreement funding", "Business loan collateral"]),
    suitableFor: JSON.stringify(["Small to mid-size businesses", "Companies with key revenue-generating employees", "Partnership and LLC structures", "Businesses with outstanding loans"]),
    riskLevel: "conservative",
    minInvestment: "5000/year",
    complianceNotes: "Business must have insurable interest. Premium payments not tax-deductible. Death benefit generally tax-free to business. Consult business attorney.",
  },
  {
    name: "WealthBridge Retirement Income Maximizer",
    category: "Retirement",
    description: "Comprehensive retirement planning strategy combining IUL cash value accumulation with systematic distribution planning. Designed to provide tax-free retirement income supplementing Social Security and 401(k).",
    features: JSON.stringify(["Tax-free policy loans for income", "No contribution limits like 401(k)", "No required minimum distributions", "Market downside protection", "Legacy planning component", "Long-term care benefits"]),
    suitableFor: JSON.stringify(["Individuals maxing out 401(k) contributions", "High earners seeking additional tax-advantaged savings", "Pre-retirees planning income strategies", "Those concerned about future tax rate increases"]),
    riskLevel: "moderate",
    minInvestment: "12000/year",
    complianceNotes: "Policy loans reduce death benefit. Must maintain sufficient premiums to avoid lapse. Not a replacement for qualified retirement plans. Illustrated rates not guaranteed.",
  },
  {
    name: "WealthBridge Charitable Legacy Plan",
    category: "Estate Planning",
    description: "Life insurance strategy designed to maximize charitable giving while providing estate tax benefits. Combines wealth replacement trust with charitable remainder trust for optimal tax efficiency.",
    features: JSON.stringify(["Charitable income tax deduction", "Estate tax reduction", "Wealth replacement for heirs", "Lifetime income stream", "Legacy to chosen charities", "Professional trust administration"]),
    suitableFor: JSON.stringify(["Philanthropically-minded high-net-worth individuals", "Those with appreciated assets", "Estate tax planning needs", "Clients wanting to leave charitable legacy"]),
    riskLevel: "moderate",
    minInvestment: "50000/year",
    complianceNotes: "Requires irrevocable trust structure. Tax benefits depend on individual circumstances. Must work with estate planning attorney. Gift tax implications apply.",
  },
  {
    name: "WealthBridge Disability Income Protection",
    category: "Income Protection",
    description: "Individual disability insurance providing income replacement if unable to work due to illness or injury. Own-occupation definition protects specialized professionals.",
    features: JSON.stringify(["Own-occupation definition", "Non-cancelable guaranteed renewable", "Cost of living adjustment", "Future increase option", "Partial disability benefits", "Recovery benefit"]),
    suitableFor: JSON.stringify(["Medical professionals", "Attorneys and executives", "High-income earners", "Business owners", "Anyone dependent on earned income"]),
    riskLevel: "conservative",
    minInvestment: "2000/year",
    complianceNotes: "Benefits subject to underwriting. Pre-existing conditions may be excluded. Benefit amount limited to percentage of earned income. Tax treatment depends on premium payment method.",
  },
];

async function seed() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }
  const conn = await mysql.createConnection(url);
  
  for (const p of products) {
    await conn.execute(
      `INSERT INTO products (name, category, description, features, suitableFor, riskLevel, minInvestment, complianceNotes) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE description=VALUES(description), features=VALUES(features), suitableFor=VALUES(suitableFor), riskLevel=VALUES(riskLevel), minInvestment=VALUES(minInvestment), complianceNotes=VALUES(complianceNotes)`,
      [p.name, p.category, p.description, p.features, p.suitableFor, p.riskLevel, p.minInvestment, p.complianceNotes]
    );
    console.log(`  Seeded: ${p.name}`);
  }
  
  console.log(`\nDone! Seeded ${products.length} products.`);
  await conn.end();
}

seed().catch(console.error);
