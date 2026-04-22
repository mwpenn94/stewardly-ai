/**
 * Strategy Archetypes & Leader Personas Knowledge Base
 *
 * Comprehensive taxonomy of financial services approaches, leader personas,
 * strategy categories, and cross-archetype comparison engine. Integrates
 * across practice planning, client planning, advanced strategies, and references.
 *
 * Sources: 10 strategy archetypes + 12 strategy categories from operator-grade taxonomy
 */

import { getDb } from "../../db";
import { sql } from "drizzle-orm";

// ─── ARCHETYPE DEFINITIONS ────────────────────────────────────────

export interface StrategyArchetype {
  id: string;
  name: string;
  leaderPersona: string;
  leaderName: string;
  coreBelief: string;
  characteristics: string[];
  personalAdvisingApplications: string[];
  idealClientFit: string[];
  strengths: string[];
  weaknesses: string[];
  relevantCalculators: string[];
  relevantAdvancedPanels: string[];
  revenueStreams: string[];
  riskLevel: "low" | "moderate" | "high" | "very_high";
  timeHorizon: "short" | "medium" | "long" | "very_long";
  minimumAUM: number; // typical minimum AUM where this approach is most effective
  complexityLevel: 1 | 2 | 3 | 4 | 5;
}

export interface StrategyCategory {
  id: string;
  name: string;
  description: string;
  strategies: Array<{
    name: string;
    description: string;
    applicableArchetypes: string[];
    examples: string[];
  }>;
}

export interface ArchetypeComparison {
  archetypes: StrategyArchetype[];
  comparisonMatrix: Array<{
    dimension: string;
    values: Record<string, string | number>;
  }>;
  clientFitMatrix: Array<{
    clientProfile: string;
    scores: Record<string, number>; // archetype id -> fit score 0-100
    bestFit: string;
    reasoning: string;
  }>;
  impactProjections: Array<{
    metric: string;
    projections: Record<string, { low: number; mid: number; high: number }>;
  }>;
}

// ─── 10 STRATEGY ARCHETYPES ──────────────────────────────────────

const STRATEGY_ARCHETYPES: StrategyArchetype[] = [
  {
    id: "quantitative",
    name: "Quantitative / Systematic",
    leaderPersona: "Jim Simons (Renaissance Technologies)",
    leaderName: "Jim Simons",
    coreBelief: "Markets are noisy systems with exploitable statistical edges.",
    characteristics: [
      "Data-driven, no discretion",
      "Small edges compounded at scale",
      "High diversification",
      "Rapid iteration and model refinement",
      "Zero reliance on narrative or emotion",
    ],
    personalAdvisingApplications: [
      "Systematic ETF/factor portfolios",
      "Direct indexing",
      "Risk-parity allocations",
      "Rules-based rebalancing",
      "Tax-loss harvesting algorithms",
    ],
    idealClientFit: [
      "Engineers, quants, analytical thinkers",
      "High-income earners who want discipline and automation",
    ],
    strengths: ["Discipline", "Automation", "Consistency", "Removes emotion"],
    weaknesses: ["Requires trust in models", "Black-box perception", "May underperform in trending markets"],
    relevantCalculators: ["retirement", "tax", "income", "risk", "sensitivity", "what-if"],
    relevantAdvancedPanels: ["strategy-comparison", "holistic-comparison", "configurator"],
    revenueStreams: ["AUM fees", "Advisory fees", "Direct indexing fees"],
    riskLevel: "moderate",
    timeHorizon: "long",
    minimumAUM: 100000,
    complexityLevel: 4,
  },
  {
    id: "value",
    name: "Value Investing",
    leaderPersona: "Warren Buffett",
    leaderName: "Warren Buffett",
    coreBelief: "Buy wonderful businesses at fair prices and hold indefinitely.",
    characteristics: [
      "Fundamental analysis",
      "Moats, management quality, cash flow",
      "Long time horizon",
      "Low turnover",
    ],
    personalAdvisingApplications: [
      "Concentrated equity sleeves",
      "Dividend growth portfolios",
      "Long-term retirement accumulation",
    ],
    idealClientFit: [
      "Patient investors",
      "Business owners",
      "High-net-worth families",
    ],
    strengths: ["Low turnover", "Durable returns", "Tax-efficient", "Compounding"],
    weaknesses: ["Slow periods", "Requires patience", "May miss growth trends"],
    relevantCalculators: ["retirement", "income", "estate", "tax"],
    relevantAdvancedPanels: ["strategy-comparison", "holistic-comparison", "business-valuation"],
    revenueStreams: ["AUM fees", "Financial planning fees"],
    riskLevel: "moderate",
    timeHorizon: "very_long",
    minimumAUM: 50000,
    complexityLevel: 2,
  },
  {
    id: "growth",
    name: "Growth / Story-Driven Investing",
    leaderPersona: "Peter Lynch",
    leaderName: "Peter Lynch",
    coreBelief: "Invest in what you understand; find fast-growing companies early.",
    characteristics: [
      "Bottom-up research",
      "Sector specialization",
      "\"Tenbagger\" hunting",
      "Higher volatility tolerance",
    ],
    personalAdvisingApplications: [
      "Satellite growth portfolios",
      "Thematic investing",
      "Tech/innovation sleeves",
    ],
    idealClientFit: [
      "Younger investors",
      "High-risk tolerance",
      "Tech-savvy clients",
    ],
    strengths: ["High upside potential", "Exciting narrative", "Captures innovation"],
    weaknesses: ["High volatility", "Drawdown risk", "Requires active monitoring"],
    relevantCalculators: ["retirement", "income", "risk", "what-if", "sensitivity"],
    relevantAdvancedPanels: ["strategy-comparison", "holistic-comparison"],
    revenueStreams: ["AUM fees", "Trading commissions", "Advisory fees"],
    riskLevel: "high",
    timeHorizon: "long",
    minimumAUM: 25000,
    complexityLevel: 3,
  },
  {
    id: "behavioral",
    name: "Behavioral / Simplicity / Debt-Aversion",
    leaderPersona: "Dave Ramsey",
    leaderName: "Dave Ramsey",
    coreBelief: "Behavior > math. Avoid debt, simplify, and invest consistently.",
    characteristics: [
      "Term life only",
      "Mutual funds for long-term growth",
      "No leverage",
      "Debt snowball",
      "High behavioral coaching",
    ],
    personalAdvisingApplications: [
      "Middle-income households",
      "Debt-reduction planning",
      "Simple retirement accumulation",
    ],
    idealClientFit: [
      "Households with debt",
      "People who need structure and accountability",
      "Simplicity-oriented clients",
    ],
    strengths: ["Simple", "Motivating", "Behavioral discipline", "Accessible"],
    weaknesses: ["Oversimplified for HNW", "Misses tax optimization", "Anti-leverage bias"],
    relevantCalculators: ["retirement", "income", "social-security"],
    relevantAdvancedPanels: ["holistic-comparison"],
    revenueStreams: ["Financial coaching fees", "Mutual fund commissions"],
    riskLevel: "low",
    timeHorizon: "medium",
    minimumAUM: 0,
    complexityLevel: 1,
  },
  {
    id: "macro",
    name: "Macro / Global Systems",
    leaderPersona: "Ray Dalio",
    leaderName: "Ray Dalio",
    coreBelief: "Economies follow predictable cycles; diversify across uncorrelated assets.",
    characteristics: [
      "Risk-parity",
      "Global diversification",
      "Inflation/deflation regime modeling",
      "Bridgewater \"All Weather\" philosophy",
    ],
    personalAdvisingApplications: [
      "All-weather portfolios",
      "Inflation-hedging strategies",
      "Alternatives integration",
    ],
    idealClientFit: [
      "High-net-worth",
      "Risk-aware investors",
      "Clients concerned about macro instability",
    ],
    strengths: ["Resilient portfolios", "Downside protection", "Regime-aware"],
    weaknesses: ["Complex", "May underperform in bull markets", "Requires education"],
    relevantCalculators: ["retirement", "income", "risk", "sensitivity", "what-if"],
    relevantAdvancedPanels: ["strategy-comparison", "holistic-comparison", "configurator"],
    revenueStreams: ["AUM fees", "Advisory fees", "Alternative investment fees"],
    riskLevel: "moderate",
    timeHorizon: "long",
    minimumAUM: 250000,
    complexityLevel: 4,
  },
  {
    id: "insurance_centric",
    name: "Insurance-Centric / Cash Value Optimization",
    leaderPersona: "Nelson Nash (Infinite Banking)",
    leaderName: "Nelson Nash",
    coreBelief: "Use permanent life insurance as a personal banking system.",
    characteristics: [
      "Overfunded WL/IUL",
      "Policy loans for liquidity",
      "Tax-advantaged accumulation",
      "Leverage + guarantees",
    ],
    personalAdvisingApplications: [
      "High-income earners",
      "Business owners",
      "Clients needing tax-free retirement income",
    ],
    idealClientFit: [
      "Entrepreneurs",
      "Real estate investors",
      "Clients with volatile income",
    ],
    strengths: ["Tax-free income", "Leverage", "Death benefit", "Guaranteed floor"],
    weaknesses: ["Requires discipline", "Long break-even", "Complexity", "Surrender charges"],
    relevantCalculators: ["retirement", "tax", "income", "insurance-analysis", "protection-score"],
    relevantAdvancedPanels: ["quick-bundle", "strategy-comparison", "holistic-comparison", "insurance-analysis"],
    revenueStreams: ["Insurance commissions", "Trail commissions", "Advisory fees"],
    riskLevel: "low",
    timeHorizon: "very_long",
    minimumAUM: 100000,
    complexityLevel: 3,
  },
  {
    id: "premium_finance",
    name: "Premium Financing / Advanced Markets",
    leaderPersona: "HNW estate planners, private banking groups",
    leaderName: "Private Banking Groups",
    coreBelief: "Use leverage + life insurance to create estate liquidity and tax arbitrage.",
    characteristics: [
      "Bank-financed premiums",
      "ILIT structures",
      "Collateral management",
      "Multi-generational planning",
    ],
    personalAdvisingApplications: [
      "Estate tax mitigation",
      "Executive benefits",
      "Large-case design",
    ],
    idealClientFit: [
      "Ultra-HNW ($5M+ net worth)",
      "Business owners",
      "Families with estate tax exposure",
    ],
    strengths: ["Large tax arbitrage", "Estate liquidity", "Leverage amplification"],
    weaknesses: ["Complexity", "Collateral risk", "Interest rate sensitivity", "Regulatory scrutiny"],
    relevantCalculators: ["estate", "tax", "retirement", "income", "insurance-analysis"],
    relevantAdvancedPanels: ["strategy-comparison", "holistic-comparison", "business-valuation"],
    revenueStreams: ["Large case commissions", "Advisory fees", "Ongoing management fees"],
    riskLevel: "high",
    timeHorizon: "very_long",
    minimumAUM: 1000000,
    complexityLevel: 5,
  },
  {
    id: "holistic",
    name: "Holistic / Planning-Centric",
    leaderPersona: "CFP-style fiduciary planners",
    leaderName: "CFP Board",
    coreBelief: "Integrate cash flow, taxes, insurance, investments, and estate into one plan.",
    characteristics: [
      "Goals-based planning",
      "Cash-flow mapping",
      "Tax optimization",
      "Retirement income sequencing",
      "Estate coordination",
    ],
    personalAdvisingApplications: [
      "Comprehensive planning",
      "Multi-goal households",
      "Retirement income planning",
    ],
    idealClientFit: [
      "Families",
      "Pre-retirees",
      "Clients with multiple priorities",
    ],
    strengths: ["Comprehensive", "Client-centered", "Fiduciary standard", "Integrative"],
    weaknesses: ["Time-intensive", "Higher fees", "Requires broad expertise"],
    relevantCalculators: ["retirement", "tax", "estate", "income", "social-security", "medicare", "risk", "insurance-analysis"],
    relevantAdvancedPanels: ["planning-hierarchy", "holistic-comparison", "strategy-comparison", "advanced-workflows"],
    revenueStreams: ["Financial planning fees", "AUM fees", "Retainer fees"],
    riskLevel: "moderate",
    timeHorizon: "long",
    minimumAUM: 50000,
    complexityLevel: 3,
  },
  {
    id: "alternatives",
    name: "Alternatives / Private Markets",
    leaderPersona: "Modern institutional CIOs",
    leaderName: "Institutional CIOs",
    coreBelief: "Private credit, private equity, and real assets improve risk-adjusted returns.",
    characteristics: [
      "Illiquidity premium",
      "Diversification beyond public markets",
      "Income-focused private credit",
      "Opportunistic real estate",
    ],
    personalAdvisingApplications: [
      "Accredited investors",
      "Income-focused retirees",
      "HNW diversification",
    ],
    idealClientFit: [
      "High-net-worth ($1M+)",
      "Investors seeking non-correlated returns",
      "Accredited investors",
    ],
    strengths: ["Diversification", "Income generation", "Illiquidity premium"],
    weaknesses: ["Illiquidity", "Complexity", "Higher minimums", "Due diligence burden"],
    relevantCalculators: ["retirement", "income", "risk", "tax"],
    relevantAdvancedPanels: ["strategy-comparison", "holistic-comparison"],
    revenueStreams: ["Placement fees", "Advisory fees", "Performance fees"],
    riskLevel: "high",
    timeHorizon: "long",
    minimumAUM: 500000,
    complexityLevel: 4,
  },
  {
    id: "fire",
    name: "Frugality / Financial Independence (FIRE)",
    leaderPersona: "FIRE movement leaders (Mr. Money Mustache, etc.)",
    leaderName: "Mr. Money Mustache",
    coreBelief: "Reduce expenses, invest aggressively, retire early.",
    characteristics: [
      "Extreme savings rates (50-70%)",
      "Low-cost index funds",
      "Minimalism",
      "Tax optimization",
    ],
    personalAdvisingApplications: [
      "Young professionals",
      "High savings capacity",
      "Early retirement planning",
    ],
    idealClientFit: [
      "Tech workers",
      "High earners with low expenses",
      "Minimalist-minded clients",
    ],
    strengths: ["Fast independence", "Low fees", "Simple execution"],
    weaknesses: ["Lifestyle constraints", "Sequence-of-returns risk", "Healthcare gap"],
    relevantCalculators: ["retirement", "tax", "income", "social-security"],
    relevantAdvancedPanels: ["holistic-comparison", "strategy-comparison"],
    revenueStreams: ["Advisory fees", "Financial planning fees"],
    riskLevel: "moderate",
    timeHorizon: "medium",
    minimumAUM: 0,
    complexityLevel: 2,
  },
];

// ─── 12 STRATEGY CATEGORIES ─────────────────────────────────────

const STRATEGY_CATEGORIES: StrategyCategory[] = [
  {
    id: "core_planning",
    name: "Core Planning Frameworks",
    description: "Foundational planning approaches that integrate across all financial domains.",
    strategies: [
      { name: "Goals-Based Planning", description: "Map cash flow, risk, taxes, retirement income, estate wishes.", applicableArchetypes: ["holistic", "behavioral", "fire"], examples: ["Retirement income guardrails plan", "Tax-efficient withdrawal sequencing", "Multi-bucket retirement income strategy"] },
      { name: "Holistic Financial Planning", description: "Integrate insurance, investments, tax, estate, and business planning.", applicableArchetypes: ["holistic", "macro"], examples: ["Comprehensive financial plan", "Integrated wealth management"] },
      { name: "Life-Stage Planning", description: "Accumulation, preservation, distribution, legacy.", applicableArchetypes: ["holistic", "value", "behavioral"], examples: ["Pre-retirement transition plan", "Legacy planning framework"] },
      { name: "Values-Based Planning", description: "Align financial decisions with client priorities and purpose.", applicableArchetypes: ["holistic", "behavioral"], examples: ["ESG-aligned portfolio", "Charitable giving strategy"] },
    ],
  },
  {
    id: "insurance_driven",
    name: "Insurance-Driven Strategies",
    description: "Protection, cash value optimization, and risk management through insurance products.",
    strategies: [
      { name: "Term Laddering", description: "Stagger term policies to match declining coverage needs.", applicableArchetypes: ["behavioral", "holistic"], examples: ["20/15/10-year term ladder"] },
      { name: "Cash Value Optimization", description: "Overfunded IUL/WL for tax-advantaged accumulation.", applicableArchetypes: ["insurance_centric", "premium_finance"], examples: ["IUL max-funding for tax-free retirement supplement"] },
      { name: "Premium Financing", description: "Collateralized lending to fund large IUL/WL.", applicableArchetypes: ["premium_finance"], examples: ["Premium finance ILIT for estate tax mitigation"] },
      { name: "Executive Bonus (162)", description: "Employer-funded life insurance as executive benefit.", applicableArchetypes: ["insurance_centric", "premium_finance"], examples: ["162 Executive Bonus for business owners"] },
      { name: "Buy-Sell Funding", description: "Insurance-funded business succession.", applicableArchetypes: ["insurance_centric", "holistic"], examples: ["Buy-sell funded with term or perm"] },
      { name: "Disability Income Gap", description: "Analyze and fill disability income coverage gaps.", applicableArchetypes: ["holistic", "behavioral"], examples: ["Individual DI to supplement group coverage"] },
      { name: "LTC Hybrid Strategies", description: "Long-term care coverage via hybrid life/LTC products.", applicableArchetypes: ["insurance_centric", "holistic"], examples: ["Hybrid LTC with return of premium"] },
    ],
  },
  {
    id: "investment_driven",
    name: "Investment-Driven Strategies",
    description: "Portfolio construction and management approaches for wealth accumulation and income.",
    strategies: [
      { name: "Core-Satellite Construction", description: "Low-cost core + active satellite positions.", applicableArchetypes: ["quantitative", "value", "growth"], examples: ["60/40 with alternatives sleeve"] },
      { name: "Tax-Loss Harvesting", description: "Systematic realization of losses to offset gains.", applicableArchetypes: ["quantitative", "holistic"], examples: ["Automated daily tax-loss harvesting"] },
      { name: "Direct Indexing", description: "Own individual stocks instead of ETFs for tax optimization.", applicableArchetypes: ["quantitative"], examples: ["Direct indexing for high-income clients"] },
      { name: "Factor-Based Investing", description: "Target value, momentum, quality, and size factors.", applicableArchetypes: ["quantitative", "macro"], examples: ["Multi-factor ETF portfolio"] },
      { name: "Risk-Parity Allocation", description: "Equal risk contribution across asset classes.", applicableArchetypes: ["macro", "quantitative"], examples: ["All-weather risk-parity portfolio"] },
      { name: "Bucket Strategy", description: "Time-segmented portfolio for retirement income.", applicableArchetypes: ["holistic", "behavioral"], examples: ["Multi-bucket retirement income plan"] },
    ],
  },
  {
    id: "tax_strategies",
    name: "Tax Strategies",
    description: "Tax optimization approaches across income, capital gains, and estate taxes.",
    strategies: [
      { name: "Roth Conversions", description: "Convert traditional IRA to Roth for tax-free growth.", applicableArchetypes: ["holistic", "fire", "quantitative"], examples: ["Roth conversion ladder", "Pre-RMD Roth conversions"] },
      { name: "Backdoor Roth", description: "Non-deductible IRA contribution + conversion.", applicableArchetypes: ["holistic", "fire", "quantitative"], examples: ["Backdoor Roth for high earners"] },
      { name: "Mega Backdoor Roth", description: "After-tax 401k contributions + in-plan Roth conversion.", applicableArchetypes: ["fire", "quantitative"], examples: ["Mega backdoor Roth via employer plan"] },
      { name: "Tax-Efficient Asset Location", description: "Place assets in optimal account types.", applicableArchetypes: ["quantitative", "holistic"], examples: ["Bonds in tax-advantaged, equities in taxable"] },
      { name: "Charitable Trusts (CRT/DAF)", description: "Tax-advantaged charitable giving vehicles.", applicableArchetypes: ["holistic", "value"], examples: ["DAF for high-income charitable clients"] },
      { name: "QSBS Planning", description: "Qualified Small Business Stock exclusion.", applicableArchetypes: ["growth", "holistic"], examples: ["Section 1202 QSBS for startup founders"] },
      { name: "1031 Exchanges", description: "Tax-deferred real estate exchanges.", applicableArchetypes: ["alternatives", "holistic"], examples: ["1031 exchange for investment property"] },
    ],
  },
  {
    id: "estate_legacy",
    name: "Estate & Legacy Strategies",
    description: "Wealth transfer, estate tax mitigation, and multi-generational planning.",
    strategies: [
      { name: "Revocable Living Trust", description: "Avoid probate and maintain control.", applicableArchetypes: ["holistic", "value"], examples: ["Revocable trust for estate simplification"] },
      { name: "ILIT", description: "Irrevocable Life Insurance Trust for estate tax exclusion.", applicableArchetypes: ["premium_finance", "insurance_centric"], examples: ["ILIT to remove death benefit from estate"] },
      { name: "GRAT", description: "Grantor Retained Annuity Trust for appreciating assets.", applicableArchetypes: ["premium_finance", "alternatives"], examples: ["GRAT for appreciating assets"] },
      { name: "SLAT", description: "Spousal Lifetime Access Trust.", applicableArchetypes: ["premium_finance", "holistic"], examples: ["SLAT for married HNW couples"] },
      { name: "Dynasty Trust", description: "Multi-generational wealth transfer.", applicableArchetypes: ["premium_finance"], examples: ["Dynasty trust for generational wealth"] },
      { name: "Family Limited Partnership", description: "Valuation discounts for family wealth transfer.", applicableArchetypes: ["premium_finance", "alternatives"], examples: ["FLP for business succession"] },
    ],
  },
  {
    id: "business_owner",
    name: "Business Owner Strategies",
    description: "Specialized planning for business owners including succession, compensation, and retirement.",
    strategies: [
      { name: "Buy-Sell Planning", description: "Funded agreements for business continuity.", applicableArchetypes: ["insurance_centric", "holistic"], examples: ["Cross-purchase buy-sell agreement"] },
      { name: "Key-Person Coverage", description: "Insurance on critical employees.", applicableArchetypes: ["insurance_centric"], examples: ["Key-person life and disability"] },
      { name: "Executive Compensation", description: "SERP, 162 bonus, deferred comp.", applicableArchetypes: ["premium_finance", "insurance_centric"], examples: ["SERP for executive retention", "NQDC for key employees"] },
      { name: "Cash Balance Plans", description: "Defined benefit plan for high tax deferral.", applicableArchetypes: ["holistic", "value"], examples: ["401(k) + cash balance combo for high earners"] },
      { name: "Business Valuation + Succession", description: "Comprehensive business transition planning.", applicableArchetypes: ["holistic", "value"], examples: ["Business valuation for succession planning"] },
    ],
  },
  {
    id: "retirement_income",
    name: "Retirement Income Strategies",
    description: "Income generation and distribution strategies for retirement.",
    strategies: [
      { name: "Guaranteed Income Annuity Ladder", description: "SPIA ladder for baseline income.", applicableArchetypes: ["holistic", "behavioral"], examples: ["SPIA ladder for baseline income"] },
      { name: "Time-Segmented Buckets", description: "Short/medium/long-term income buckets.", applicableArchetypes: ["holistic", "behavioral"], examples: ["3-bucket retirement income strategy"] },
      { name: "Social Security Optimization", description: "Maximize lifetime SS benefits.", applicableArchetypes: ["holistic", "fire", "behavioral"], examples: ["Delayed claiming strategy for higher benefits"] },
      { name: "RMD Minimization", description: "Reduce required minimum distributions.", applicableArchetypes: ["holistic", "quantitative"], examples: ["Pre-RMD Roth conversions"] },
      { name: "Tax-Efficient Withdrawal Sequencing", description: "Optimal order of account withdrawals.", applicableArchetypes: ["holistic", "quantitative", "fire"], examples: ["Guardrails withdrawal strategy"] },
    ],
  },
  {
    id: "premium_financing",
    name: "Premium Financing (Advanced Markets)",
    description: "Leveraged insurance strategies for ultra-HNW estate and executive planning.",
    strategies: [
      { name: "Collateralized Premium Finance", description: "Bank lending to fund large life policies.", applicableArchetypes: ["premium_finance"], examples: ["Premium finance ILIT for estate tax mitigation"] },
      { name: "COLI/BOLI", description: "Corporate/bank-owned life insurance.", applicableArchetypes: ["premium_finance"], examples: ["COLI for executive benefits"] },
      { name: "Multi-Generational Transfer", description: "Leveraged wealth transfer across generations.", applicableArchetypes: ["premium_finance"], examples: ["Dynasty ILIT with premium financing"] },
    ],
  },
  {
    id: "employer_retirement",
    name: "Retirement Plan & Employer Strategies",
    description: "Employer-sponsored retirement plan design and optimization.",
    strategies: [
      { name: "401(k) Optimization", description: "Maximize employer plan benefits.", applicableArchetypes: ["holistic", "fire", "behavioral"], examples: ["Max employer match + Roth 401(k)"] },
      { name: "Safe Harbor Design", description: "Avoid top-heavy testing with safe harbor.", applicableArchetypes: ["holistic"], examples: ["Safe harbor 401(k) for small businesses"] },
      { name: "Profit Sharing", description: "Flexible employer contributions.", applicableArchetypes: ["holistic", "value"], examples: ["New comparability profit sharing"] },
      { name: "Non-Qualified Deferred Comp", description: "NQDC for executive retention.", applicableArchetypes: ["premium_finance", "insurance_centric"], examples: ["NQDC with COLI funding"] },
    ],
  },
  {
    id: "advanced_wealth",
    name: "Advanced Wealth Strategies",
    description: "Sophisticated strategies for ultra-HNW clients.",
    strategies: [
      { name: "PPLI", description: "Private Placement Life Insurance for tax-efficient alternatives.", applicableArchetypes: ["premium_finance", "alternatives"], examples: ["PPLI for tax-efficient alternative investing"] },
      { name: "Opportunity Zone Investing", description: "Capital gains deferral via OZ funds.", applicableArchetypes: ["alternatives", "growth"], examples: ["OZ fund for capital gains deferral"] },
      { name: "Structured Notes", description: "Custom payoff profiles with downside protection.", applicableArchetypes: ["macro", "quantitative"], examples: ["Principal-protected note with equity upside"] },
      { name: "Asset Protection Planning", description: "Legal structures to protect wealth.", applicableArchetypes: ["holistic", "premium_finance"], examples: ["Asset protection trust", "Domestic asset protection trust"] },
    ],
  },
  {
    id: "client_acquisition",
    name: "Client Acquisition & Marketing",
    description: "Practice-level strategies for client acquisition and growth.",
    strategies: [
      { name: "CPA/Attorney Referral Partnerships", description: "Professional referral networks.", applicableArchetypes: ["holistic", "premium_finance"], examples: ["CPA partnership for business owner planning"] },
      { name: "Educational Workshops", description: "Seminars and webinars for lead generation.", applicableArchetypes: ["holistic", "behavioral"], examples: ["Webinar funnel for retirement income planning"] },
      { name: "Digital Funnels", description: "Online lead generation and nurture.", applicableArchetypes: ["quantitative", "holistic"], examples: ["3-email nurture sequence for tax planning"] },
      { name: "Premium Financing Roundtables", description: "HNW-focused educational events.", applicableArchetypes: ["premium_finance"], examples: ["Executive benefits roundtable"] },
    ],
  },
  {
    id: "ai_enabled",
    name: "AI-Enabled Advisory",
    description: "Technology-driven approaches to enhance advisory efficiency and outcomes.",
    strategies: [
      { name: "Automated Fact-Finding", description: "AI-assisted client discovery and profiling.", applicableArchetypes: ["quantitative", "holistic"], examples: ["AI-generated retirement income scenarios"] },
      { name: "Scenario Modeling", description: "Monte Carlo and what-if analysis.", applicableArchetypes: ["quantitative", "macro", "holistic"], examples: ["AI-driven tax optimization modeling"] },
      { name: "Personalized Plan Generation", description: "AI-generated financial plans.", applicableArchetypes: ["holistic", "quantitative"], examples: ["Automated comprehensive financial plan"] },
      { name: "Compliance-Safe Content", description: "AI-generated compliant communications.", applicableArchetypes: ["holistic"], examples: ["AI-drafted client review letters"] },
    ],
  },
];

// ─── PUBLIC API ──────────────────────────────────────────────────

/**
 * Get all 10 strategy archetypes with full details.
 */
export function getAllArchetypes(): StrategyArchetype[] {
  return STRATEGY_ARCHETYPES;
}

/**
 * Get a single archetype by ID.
 */
export function getArchetype(id: string): StrategyArchetype | undefined {
  return STRATEGY_ARCHETYPES.find(a => a.id === id);
}

/**
 * Get all 12 strategy categories with full details.
 */
export function getAllStrategyCategories(): StrategyCategory[] {
  return STRATEGY_CATEGORIES;
}

/**
 * Get strategies applicable to a specific archetype.
 */
export function getStrategiesForArchetype(archetypeId: string): Array<{ category: string; strategies: StrategyCategory["strategies"] }> {
  return STRATEGY_CATEGORIES.map(cat => ({
    category: cat.name,
    strategies: cat.strategies.filter(s => s.applicableArchetypes.includes(archetypeId)),
  })).filter(c => c.strategies.length > 0);
}

/**
 * Match a client profile to the best-fit archetypes.
 */
export async function matchClientToArchetypes(clientId: number): Promise<Array<{
  archetype: StrategyArchetype;
  fitScore: number;
  reasoning: string[];
}>> {
  const db = (await getDb())!;
  let profile: any = {};
  let riskProfile: any = {};

  try {
    const [profiles] = await db.execute(sql`SELECT profile_json FROM financial_profiles WHERE user_id = ${clientId} ORDER BY updated_at DESC LIMIT 1`) as any;
    if (profiles?.[0]?.profile_json) {
      profile = typeof profiles[0].profile_json === "string" ? JSON.parse(profiles[0].profile_json) : profiles[0].profile_json;
    }
  } catch { /* no profile */ }

  try {
    const [risks] = await db.execute(sql`SELECT assessment_json FROM suitability_assessments WHERE user_id = ${clientId} ORDER BY created_at DESC LIMIT 1`) as any;
    if (risks?.[0]?.assessment_json) {
      riskProfile = typeof risks[0].assessment_json === "string" ? JSON.parse(risks[0].assessment_json) : risks[0].assessment_json;
    }
  } catch { /* no risk profile */ }

  const age = profile.age ?? 45;
  const income = profile.income ?? profile.annualIncome ?? 100000;
  const netWorth = profile.netWorth ?? profile.savings ?? 250000;
  const riskTolerance = riskProfile.riskTolerance ?? riskProfile.riskScore ?? "moderate";
  const hasDebt = profile.totalDebt > 0 || profile.hasDebt;
  const isBizOwner = profile.isBusinessOwner ?? profile.isBizOwner ?? false;
  const isAccredited = netWorth >= 1000000 || income >= 200000;

  const results = STRATEGY_ARCHETYPES.map(archetype => {
    let score = 50; // baseline
    const reasoning: string[] = [];

    // AUM/net worth fit
    if (netWorth >= archetype.minimumAUM) {
      score += 10;
      reasoning.push(`Net worth ($${Math.round(netWorth / 1000)}K) meets minimum threshold`);
    } else {
      score -= 15;
      reasoning.push(`Net worth below typical minimum for this approach`);
    }

    // Risk tolerance fit
    const riskMap: Record<string, string[]> = {
      low: ["behavioral", "holistic", "insurance_centric"],
      moderate: ["value", "holistic", "macro", "quantitative", "fire"],
      high: ["growth", "alternatives", "premium_finance"],
      very_high: ["growth", "alternatives"],
    };
    const riskStr = typeof riskTolerance === "string" ? riskTolerance.toLowerCase() : "moderate";
    if (riskMap[riskStr]?.includes(archetype.id)) {
      score += 15;
      reasoning.push(`Risk tolerance (${riskStr}) aligns well`);
    }

    // Age-based adjustments
    if (age < 35 && ["growth", "fire", "quantitative"].includes(archetype.id)) {
      score += 10;
      reasoning.push("Young age favors growth-oriented approaches");
    }
    if (age > 55 && ["holistic", "behavioral", "insurance_centric"].includes(archetype.id)) {
      score += 10;
      reasoning.push("Pre-retirement age favors planning-centric approaches");
    }

    // Business owner boost
    if (isBizOwner && ["insurance_centric", "premium_finance", "holistic"].includes(archetype.id)) {
      score += 15;
      reasoning.push("Business ownership aligns with this approach");
    }

    // Debt-averse boost
    if (hasDebt && archetype.id === "behavioral") {
      score += 20;
      reasoning.push("Existing debt makes behavioral/simplicity approach highly relevant");
    }

    // Accredited investor boost
    if (isAccredited && ["alternatives", "premium_finance"].includes(archetype.id)) {
      score += 15;
      reasoning.push("Accredited investor status unlocks advanced strategies");
    }

    // High income boost
    if (income > 300000 && ["quantitative", "insurance_centric", "premium_finance", "holistic"].includes(archetype.id)) {
      score += 10;
      reasoning.push("High income supports sophisticated planning approaches");
    }

    return {
      archetype,
      fitScore: Math.min(100, Math.max(0, score)),
      reasoning,
    };
  });

  // Sort by fit score descending
  results.sort((a, b) => b.fitScore - a.fitScore);
  return results;
}

/**
 * Generate cross-archetype comparison for specific archetypes.
 */
export function compareArchetypes(archetypeIds: string[]): ArchetypeComparison {
  const archetypes = archetypeIds
    .map(id => STRATEGY_ARCHETYPES.find(a => a.id === id))
    .filter(Boolean) as StrategyArchetype[];

  const comparisonMatrix = [
    { dimension: "Risk Level", values: Object.fromEntries(archetypes.map(a => [a.id, a.riskLevel])) },
    { dimension: "Time Horizon", values: Object.fromEntries(archetypes.map(a => [a.id, a.timeHorizon])) },
    { dimension: "Complexity", values: Object.fromEntries(archetypes.map(a => [a.id, `${a.complexityLevel}/5`])) },
    { dimension: "Min AUM", values: Object.fromEntries(archetypes.map(a => [a.id, `$${(a.minimumAUM / 1000).toFixed(0)}K`])) },
    { dimension: "Core Strength", values: Object.fromEntries(archetypes.map(a => [a.id, a.strengths[0] ?? "—"])) },
    { dimension: "Key Weakness", values: Object.fromEntries(archetypes.map(a => [a.id, a.weaknesses[0] ?? "—"])) },
    { dimension: "Revenue Model", values: Object.fromEntries(archetypes.map(a => [a.id, a.revenueStreams[0] ?? "—"])) },
  ];

  const clientProfiles = [
    { profile: "Young Professional ($75K income, $50K NW)", age: 28, income: 75000, netWorth: 50000, risk: "high" },
    { profile: "Mid-Career Family ($150K income, $500K NW)", age: 42, income: 150000, netWorth: 500000, risk: "moderate" },
    { profile: "Business Owner ($300K income, $2M NW)", age: 50, income: 300000, netWorth: 2000000, risk: "moderate" },
    { profile: "Pre-Retiree ($200K income, $1.5M NW)", age: 60, income: 200000, netWorth: 1500000, risk: "low" },
    { profile: "Ultra-HNW ($500K+ income, $10M+ NW)", age: 55, income: 500000, netWorth: 10000000, risk: "moderate" },
  ];

  const clientFitMatrix = clientProfiles.map(cp => {
    const scores: Record<string, number> = {};
    archetypes.forEach(a => {
      let score = 50;
      if (cp.netWorth >= a.minimumAUM) score += 15;
      else score -= 10;
      if (cp.risk === "high" && a.riskLevel === "high") score += 10;
      if (cp.risk === "low" && a.riskLevel === "low") score += 10;
      if (cp.age < 35 && ["growth", "fire", "quantitative"].includes(a.id)) score += 10;
      if (cp.age > 55 && ["holistic", "behavioral"].includes(a.id)) score += 10;
      if (cp.income > 200000 && ["premium_finance", "insurance_centric", "quantitative"].includes(a.id)) score += 10;
      scores[a.id] = Math.min(100, Math.max(0, score));
    });
    const bestId = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    const bestArch = archetypes.find(a => a.id === bestId);
    return {
      clientProfile: cp.profile,
      scores,
      bestFit: bestArch?.name ?? "—",
      reasoning: `Best fit based on ${cp.risk} risk tolerance, $${Math.round(cp.netWorth / 1000)}K net worth, age ${cp.age}.`,
    };
  });

  // Impact projections (hypothetical 10-year projections)
  const impactProjections = [
    {
      metric: "10-Year Portfolio Growth (%)",
      projections: Object.fromEntries(archetypes.map(a => {
        const base = a.riskLevel === "high" ? 120 : a.riskLevel === "moderate" ? 90 : 60;
        return [a.id, { low: base * 0.5, mid: base, high: base * 1.5 }];
      })),
    },
    {
      metric: "Annual Tax Savings ($)",
      projections: Object.fromEntries(archetypes.map(a => {
        const base = ["quantitative", "holistic", "insurance_centric", "fire"].includes(a.id) ? 15000 : 5000;
        return [a.id, { low: base * 0.5, mid: base, high: base * 2 }];
      })),
    },
    {
      metric: "Estate Transfer Efficiency (%)",
      projections: Object.fromEntries(archetypes.map(a => {
        const base = ["premium_finance", "insurance_centric", "holistic"].includes(a.id) ? 85 : 60;
        return [a.id, { low: base * 0.8, mid: base, high: base * 1.1 }];
      })),
    },
  ];

  return { archetypes, comparisonMatrix, clientFitMatrix, impactProjections };
}

/**
 * Get which calculators and panels are most relevant for a given archetype.
 */
export function getArchetypeToolMapping(archetypeId: string): {
  archetype: StrategyArchetype | undefined;
  calculators: Array<{ id: string; relevance: "primary" | "secondary" }>;
  advancedPanels: Array<{ id: string; relevance: "primary" | "secondary" }>;
  strategies: Array<{ category: string; name: string; description: string }>;
} {
  const archetype = STRATEGY_ARCHETYPES.find(a => a.id === archetypeId);
  if (!archetype) return { archetype: undefined, calculators: [], advancedPanels: [], strategies: [] };

  const calculators = archetype.relevantCalculators.map((id, i) => ({
    id,
    relevance: (i < 3 ? "primary" : "secondary") as "primary" | "secondary",
  }));

  const advancedPanels = archetype.relevantAdvancedPanels.map((id, i) => ({
    id,
    relevance: (i < 2 ? "primary" : "secondary") as "primary" | "secondary",
  }));

  const strategies = STRATEGY_CATEGORIES.flatMap(cat =>
    cat.strategies
      .filter(s => s.applicableArchetypes.includes(archetypeId))
      .map(s => ({ category: cat.name, name: s.name, description: s.description }))
  );

  return { archetype, calculators, advancedPanels, strategies };
}
