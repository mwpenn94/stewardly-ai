/**
 * Estate Planning Knowledge Articles + Industry Benchmarks (LIMRA/LOMA)
 * Seed data for advisor education, client-facing content, and industry metrics
 */
import { getDb } from "../db";
import { industryBenchmarks } from "../../drizzle/schema";

// ─── Estate Planning Knowledge Articles ──────────────────────────────────

export interface EstatePlanningArticle {
  id: string;
  title: string;
  category: string;
  summary: string;
  keyPoints: string[];
  applicableNetWorth: string;
  urgencyLevel: "critical" | "high" | "medium" | "low";
  relatedStrategies: string[];
}

export const ESTATE_PLANNING_ARTICLES: EstatePlanningArticle[] = [
  {
    id: "tcja-sunset-2025",
    title: "TCJA Estate Tax Exemption Sunset — 2025 Action Plan",
    category: "estate_tax",
    summary: "The Tax Cuts and Jobs Act doubled the estate tax exemption to $13.99M per person in 2025. Without Congressional action, this reverts to approximately $7M (inflation-adjusted) on January 1, 2026. Clients with estates between $7M and $14M per person face potential estate tax exposure.",
    keyPoints: [
      "Current exemption: $13.99M per person ($27.98M married couple) for 2025",
      "Sunset reversion: ~$7M per person (inflation-adjusted) starting 2026",
      "Gifting before sunset uses current higher exemption permanently",
      "Spousal Lifetime Access Trusts (SLATs) preserve access while using exemption",
      "Clawback protection: IRS confirmed gifts made under higher exemption won't be clawed back",
      "Consider accelerated gifting of appreciating assets before year-end 2025",
    ],
    applicableNetWorth: "$7M+",
    urgencyLevel: "critical",
    relatedStrategies: ["SLAT", "GRAT", "IDGT", "Annual Exclusion Gifting", "Dynasty Trust"],
  },
  {
    id: "irrevocable-life-insurance-trust",
    title: "Irrevocable Life Insurance Trust (ILIT) — Estate Tax Removal",
    category: "trust_planning",
    summary: "An ILIT removes life insurance proceeds from the taxable estate. The trust owns the policy, and proceeds pass to beneficiaries estate-tax-free. Critical for high-net-worth clients where insurance proceeds would push the estate over the exemption threshold.",
    keyPoints: [
      "Trust must be irrevocable — grantor cannot modify or revoke",
      "Crummey notices required for annual premium gifts to qualify for gift tax exclusion",
      "3-year lookback rule: existing policies transferred to ILIT included in estate if death within 3 years",
      "New policies purchased by ILIT avoid the 3-year rule",
      "Trust must have independent trustee for maximum flexibility",
      "Premium financing through ILIT can leverage policy without large cash outflows",
    ],
    applicableNetWorth: "$5M+",
    urgencyLevel: "high",
    relatedStrategies: ["ILIT", "Premium Finance", "Crummey Trust", "Dynasty Trust"],
  },
  {
    id: "grantor-retained-annuity-trust",
    title: "Grantor Retained Annuity Trust (GRAT) — Transfer Appreciation Tax-Free",
    category: "trust_planning",
    summary: "A GRAT allows the grantor to transfer future appreciation of assets to beneficiaries with minimal or zero gift tax. The grantor retains an annuity stream, and any growth above the IRS Section 7520 rate passes tax-free.",
    keyPoints: [
      "Zeroed-out GRAT: annuity equals initial value, so gift tax is $0",
      "Success depends on assets outperforming the 7520 rate (currently ~5.2%)",
      "Short-term GRATs (2-year rolling) reduce mortality risk",
      "Ideal for concentrated stock positions or pre-IPO shares",
      "Grantor trust status means grantor pays income tax, further reducing estate",
      "Biden administration proposed minimum 10-year term — monitor legislation",
    ],
    applicableNetWorth: "$10M+",
    urgencyLevel: "medium",
    relatedStrategies: ["GRAT", "IDGT", "Installment Sale", "Valuation Discount"],
  },
  {
    id: "charitable-remainder-trust",
    title: "Charitable Remainder Trust (CRT) — Income + Tax Deduction + Legacy",
    category: "charitable_planning",
    summary: "A CRT provides an income stream to the donor (or beneficiaries) for life or a term of years, with the remainder going to charity. Offers an immediate income tax deduction, avoids capital gains on contributed assets, and reduces the taxable estate.",
    keyPoints: [
      "CRAT: fixed annuity (5-50% of initial value); CRUT: fixed percentage of annual value",
      "Immediate income tax deduction for present value of charitable remainder",
      "No capital gains tax on sale of appreciated assets inside the trust",
      "10% remainder test: PV of charitable remainder must be at least 10% of initial contribution",
      "Combine with Wealth Replacement Trust (ILIT) to replace charitable assets for heirs",
      "Ideal for highly appreciated, low-basis assets (real estate, concentrated stock)",
    ],
    applicableNetWorth: "$2M+",
    urgencyLevel: "medium",
    relatedStrategies: ["CRT", "CRUT", "CRAT", "Wealth Replacement Trust", "Donor Advised Fund"],
  },
  {
    id: "dynasty-trust",
    title: "Dynasty Trust — Multi-Generational Wealth Transfer",
    category: "trust_planning",
    summary: "A Dynasty Trust is designed to last for multiple generations (or perpetually in certain states), keeping assets outside the taxable estate of each successive generation. Leverages the GST exemption to transfer wealth without generation-skipping transfer tax.",
    keyPoints: [
      "GST exemption: $13.99M per person in 2025 (same as estate tax exemption)",
      "Trust assets grow outside all beneficiaries' taxable estates",
      "Certain states allow perpetual trusts: SD, NV, AK, DE, NH, WY",
      "Directed trust statutes allow separation of investment, distribution, and administrative roles",
      "Asset protection features vary by state — South Dakota and Nevada strongest",
      "Ideal funding: life insurance, growth assets, or discounted interests",
    ],
    applicableNetWorth: "$10M+",
    urgencyLevel: "high",
    relatedStrategies: ["Dynasty Trust", "GST Planning", "ILIT", "Directed Trust", "Asset Protection"],
  },
  {
    id: "qualified-personal-residence-trust",
    title: "Qualified Personal Residence Trust (QPRT) — Home Transfer at Discount",
    category: "trust_planning",
    summary: "A QPRT transfers a personal residence to beneficiaries at a significantly discounted gift tax value. The grantor retains the right to live in the home for a specified term, after which it passes to beneficiaries.",
    keyPoints: [
      "Gift tax value is discounted by the retained interest (often 40-70% discount)",
      "Grantor must survive the trust term for estate tax benefit",
      "After term, grantor can lease back at fair market rent (further reduces estate)",
      "Only primary or secondary residence qualifies",
      "Higher interest rates increase the discount (favorable in current rate environment)",
      "Risk: if grantor dies during term, full FMV included in estate",
    ],
    applicableNetWorth: "$5M+",
    urgencyLevel: "medium",
    relatedStrategies: ["QPRT", "GRAT", "Installment Sale", "Valuation Discount"],
  },
  {
    id: "roth-conversion-ladder",
    title: "Roth Conversion Ladder — Tax-Free Retirement Income",
    category: "retirement_planning",
    summary: "A Roth conversion ladder systematically converts traditional IRA/401(k) assets to Roth IRA over multiple years, paying income tax at potentially lower rates. Roth assets grow tax-free and have no RMDs, making them ideal for estate planning.",
    keyPoints: [
      "Convert in low-income years (early retirement, sabbatical, market downturns)",
      "Stay within target tax bracket to minimize conversion tax cost",
      "Roth has no RMDs for original owner — maximum tax-free compounding",
      "Inherited Roth: 10-year distribution rule applies but distributions are tax-free",
      "SECURE Act 2.0: Roth employer contributions now available in 401(k)",
      "Pro-rata rule: all traditional IRA balances aggregated for conversion tax calculation",
    ],
    applicableNetWorth: "$500K+",
    urgencyLevel: "high",
    relatedStrategies: ["Roth Conversion", "Backdoor Roth", "Mega Backdoor Roth", "Tax Bracket Management"],
  },
  {
    id: "business-succession-planning",
    title: "Business Succession Planning — Valuation Discounts & Buy-Sell Agreements",
    category: "business_planning",
    summary: "Business owners face unique estate planning challenges. Proper succession planning includes valuation discounts for minority interests and lack of marketability, funded buy-sell agreements, and strategies to minimize estate tax on business interests.",
    keyPoints: [
      "Minority interest discount: 15-35% for non-controlling interests",
      "Lack of marketability discount: 15-30% for non-publicly-traded interests",
      "Combined discounts can reduce gift/estate tax value by 30-50%",
      "Buy-sell agreements funded by life insurance ensure liquidity at death",
      "Section 6166: installment payment of estate tax for closely held businesses",
      "ESOP: Employee Stock Ownership Plan can provide tax-advantaged exit",
    ],
    applicableNetWorth: "$3M+",
    urgencyLevel: "high",
    relatedStrategies: ["Buy-Sell Agreement", "ESOP", "FLP", "Valuation Discount", "Section 6166"],
  },
];

// ─── Industry Benchmarks (LIMRA/LOMA/SOA/NAIC) ──────────────────────────

const INDUSTRY_BENCHMARKS_DATA = [
  // LIMRA Life Insurance
  { category: "life_insurance_market", name: "Total US Individual Life Premium (2024)", value: "14.8", unit: "billion_usd", period: "2024", source: "LIMRA", notes: "Includes all individual life product lines" },
  { category: "life_insurance_market", name: "IUL New Premium Share", value: "28", unit: "percent", period: "2024", source: "LIMRA", notes: "IUL share of total individual life new premium" },
  { category: "life_insurance_market", name: "Term Life New Premium Share", value: "18", unit: "percent", period: "2024", source: "LIMRA", notes: "Term share of total individual life new premium" },
  { category: "life_insurance_market", name: "Whole Life New Premium Share", value: "32", unit: "percent", period: "2024", source: "LIMRA", notes: "WL share of total individual life new premium" },
  { category: "life_insurance_market", name: "VUL New Premium Share", value: "12", unit: "percent", period: "2024", source: "LIMRA", notes: "VUL share of total individual life new premium" },
  { category: "life_insurance_market", name: "Average Face Amount — Individual Life", value: "178000", unit: "usd", period: "2024", source: "LIMRA", notes: "Average face amount of new individual life policies" },
  { category: "life_insurance_market", name: "Individual Life Policies In Force", value: "265000000", unit: "count", period: "2024", source: "ACLI", notes: "Total individual life policies in force in US" },
  { category: "life_insurance_market", name: "Life Insurance Coverage Gap", value: "12", unit: "trillion_usd", period: "2024", source: "LIMRA", notes: "Estimated underinsurance gap in the US" },

  // Annuity Market
  { category: "annuity_market", name: "Total US Annuity Sales (2024)", value: "432", unit: "billion_usd", period: "2024", source: "LIMRA", notes: "Record annuity sales year" },
  { category: "annuity_market", name: "Fixed Indexed Annuity Sales", value: "128", unit: "billion_usd", period: "2024", source: "LIMRA", notes: "FIA sales at record levels" },
  { category: "annuity_market", name: "MYGA Sales", value: "152", unit: "billion_usd", period: "2024", source: "LIMRA", notes: "Multi-year guaranteed annuity sales" },
  { category: "annuity_market", name: "Variable Annuity Sales", value: "58", unit: "billion_usd", period: "2024", source: "LIMRA", notes: "VA sales declining from peak" },
  { category: "annuity_market", name: "RILA Sales", value: "54", unit: "billion_usd", period: "2024", source: "LIMRA", notes: "Registered index-linked annuity sales growing rapidly" },

  // Advisor Metrics
  { category: "advisor_metrics", name: "Average Revenue Per Advisor", value: "285000", unit: "usd", period: "2024", source: "Cerulli Associates", notes: "Average gross revenue for financial advisors" },
  { category: "advisor_metrics", name: "Average AUM Per Advisor", value: "115000000", unit: "usd", period: "2024", source: "Cerulli Associates", notes: "Average assets under management" },
  { category: "advisor_metrics", name: "Advisor-to-Client Ratio", value: "98", unit: "clients_per_advisor", period: "2024", source: "Kitces Research", notes: "Median number of client households per advisor" },
  { category: "advisor_metrics", name: "Client Acquisition Cost", value: "3200", unit: "usd", period: "2024", source: "Kitces Research", notes: "Average cost to acquire a new client" },
  { category: "advisor_metrics", name: "Client Retention Rate", value: "95.2", unit: "percent", period: "2024", source: "Cerulli Associates", notes: "Average annual client retention rate" },
  { category: "advisor_metrics", name: "Fee-Based Revenue Share", value: "72", unit: "percent", period: "2024", source: "Cerulli Associates", notes: "Share of advisor revenue from fees vs commissions" },

  // Retirement Planning
  { category: "retirement_planning", name: "Average 401(k) Balance", value: "125900", unit: "usd", period: "2024-Q3", source: "Fidelity", notes: "Average 401(k) balance across all age groups" },
  { category: "retirement_planning", name: "Average 401(k) Balance — Age 60-69", value: "272600", unit: "usd", period: "2024-Q3", source: "Fidelity", notes: "Average for near-retirees" },
  { category: "retirement_planning", name: "Average IRA Balance", value: "127745", unit: "usd", period: "2024-Q3", source: "Fidelity", notes: "Average IRA balance" },
  { category: "retirement_planning", name: "Retirement Savings Gap (Median)", value: "165000", unit: "usd", period: "2024", source: "EBRI", notes: "Median shortfall between savings and estimated need" },
  { category: "retirement_planning", name: "Social Security Replacement Rate", value: "40", unit: "percent", period: "2024", source: "SSA", notes: "Average SS replaces ~40% of pre-retirement income" },
  { category: "retirement_planning", name: "Healthcare Cost in Retirement (Couple)", value: "315000", unit: "usd", period: "2024", source: "Fidelity", notes: "Estimated lifetime healthcare cost for 65-year-old couple" },

  // Estate Planning
  { category: "estate_planning", name: "Estate Tax Returns Filed (2023)", value: "6200", unit: "count", period: "2023", source: "IRS SOI", notes: "Number of estate tax returns filed" },
  { category: "estate_planning", name: "Taxable Estate Returns", value: "2500", unit: "count", period: "2023", source: "IRS SOI", notes: "Returns with tax liability" },
  { category: "estate_planning", name: "Average Taxable Estate", value: "22500000", unit: "usd", period: "2023", source: "IRS SOI", notes: "Average gross estate for taxable returns" },
  { category: "estate_planning", name: "Estate Tax Revenue", value: "18.4", unit: "billion_usd", period: "2023", source: "IRS", notes: "Total federal estate tax revenue" },
  { category: "estate_planning", name: "Wealth Transfer Expected (Next 25 Years)", value: "84", unit: "trillion_usd", period: "2024-2048", source: "Cerulli Associates", notes: "Great Wealth Transfer estimate" },

  // Insurance Industry Health
  { category: "industry_health", name: "Life Insurer Total Assets", value: "8.9", unit: "trillion_usd", period: "2024", source: "ACLI", notes: "Total assets of US life insurers" },
  { category: "industry_health", name: "Life Insurer Surplus", value: "520", unit: "billion_usd", period: "2024", source: "NAIC", notes: "Total statutory surplus" },
  { category: "industry_health", name: "Industry Combined Ratio", value: "96.2", unit: "percent", period: "2024", source: "AM Best", notes: "Combined ratio below 100 indicates profitability" },
  { category: "industry_health", name: "Policy Lapse Rate — UL", value: "4.8", unit: "percent", period: "2024", source: "SOA", notes: "Annual lapse rate for universal life policies" },
  { category: "industry_health", name: "Policy Lapse Rate — Term", value: "6.2", unit: "percent", period: "2024", source: "SOA", notes: "Annual lapse rate for term life policies" },
  { category: "industry_health", name: "Policy Lapse Rate — WL", value: "2.1", unit: "percent", period: "2024", source: "SOA", notes: "Annual lapse rate for whole life policies" },

  // Disability Insurance
  { category: "disability_insurance", name: "Individual DI Premium (2024)", value: "3.2", unit: "billion_usd", period: "2024", source: "LIMRA", notes: "Total individual DI new premium" },
  { category: "disability_insurance", name: "DI Claim Incidence Rate", value: "3.5", unit: "per_1000", period: "2024", source: "SOA", notes: "Claims per 1,000 lives insured" },
  { category: "disability_insurance", name: "Average DI Claim Duration", value: "34.6", unit: "months", period: "2024", source: "CIGNA", notes: "Average long-term disability claim duration" },

  // Long-Term Care
  { category: "long_term_care", name: "LTC Insurance Policies In Force", value: "6800000", unit: "count", period: "2024", source: "NAIC", notes: "Standalone LTC policies in force" },
  { category: "long_term_care", name: "Average Annual LTC Premium", value: "2700", unit: "usd", period: "2024", source: "AALTCI", notes: "Average annual premium for new LTC policies" },
  { category: "long_term_care", name: "Nursing Home Cost (Private Room)", value: "116800", unit: "usd_per_year", period: "2024", source: "Genworth", notes: "National median annual cost" },
  { category: "long_term_care", name: "Home Health Aide Cost", value: "75500", unit: "usd_per_year", period: "2024", source: "Genworth", notes: "National median annual cost for 44hrs/week" },
  { category: "long_term_care", name: "Probability of Needing LTC (Age 65+)", value: "70", unit: "percent", period: "2024", source: "ACL/HHS", notes: "Probability someone turning 65 will need LTC" },
];

// ─── Seed Functions ──────────────────────────────────────────────────────

export async function seedIndustryBenchmarks(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  let inserted = 0;
  const batchSize = 20;

  for (let i = 0; i < INDUSTRY_BENCHMARKS_DATA.length; i += batchSize) {
    const batch = INDUSTRY_BENCHMARKS_DATA.slice(i, i + batchSize).map(b => ({
      benchmarkCategory: b.category,
      benchmarkName: b.name,
      benchmarkValue: b.value,
      benchmarkUnit: b.unit,
      reportingPeriod: b.period,
      source: b.source,
      notes: b.notes,
    }));

    try {
      await db.insert(industryBenchmarks).values(batch);
      inserted += batch.length;
    } catch (e: any) {
      if (!e?.message?.includes("Duplicate")) console.error("[Benchmarks] Insert error:", e?.message);
    }
  }

  return inserted;
}

// ─── Lookup Functions ────────────────────────────────────────────────────

export async function getBenchmarksByCategory(category: string): Promise<any[]> {
  const db = await getDb();
  if (!db) return INDUSTRY_BENCHMARKS_DATA.filter(b => b.category === category);

  const { eq } = await import("drizzle-orm");
  return db.select().from(industryBenchmarks).where(eq(industryBenchmarks.benchmarkCategory, category));
}

export async function getAllBenchmarks(): Promise<any[]> {
  const db = await getDb();
  if (!db) return INDUSTRY_BENCHMARKS_DATA;

  return db.select().from(industryBenchmarks);
}

export function getEstatePlanningArticles(filter?: {
  category?: string;
  minNetWorth?: number;
  urgencyLevel?: string;
}): EstatePlanningArticle[] {
  let articles = [...ESTATE_PLANNING_ARTICLES];

  if (filter?.category) {
    articles = articles.filter(a => a.category === filter.category);
  }
  if (filter?.urgencyLevel) {
    articles = articles.filter(a => a.urgencyLevel === filter.urgencyLevel);
  }
  if (filter?.minNetWorth) {
    const parseNetWorth = (s: string): number => {
      const num = parseFloat(s.replace(/[^0-9.]/g, ""));
      if (s.includes("M")) return num * 1_000_000;
      if (s.includes("K")) return num * 1_000;
      return num;
    };
    articles = articles.filter(a => parseNetWorth(a.applicableNetWorth) <= filter.minNetWorth!);
  }

  return articles;
}

export function getArticleById(id: string): EstatePlanningArticle | undefined {
  return ESTATE_PLANNING_ARTICLES.find(a => a.id === id);
}

export function getRecommendedStrategies(netWorth: number, age: number, hasBusinessInterest: boolean): {
  strategies: EstatePlanningArticle[];
  priority: string;
  timelineSensitive: boolean;
} {
  const applicable = ESTATE_PLANNING_ARTICLES.filter(a => {
    const threshold = parseFloat(a.applicableNetWorth.replace(/[^0-9.]/g, "")) * 1_000_000;
    return netWorth >= threshold;
  });

  // Filter business-specific if no business interest
  const filtered = hasBusinessInterest
    ? applicable
    : applicable.filter(a => a.category !== "business_planning");

  // Sort by urgency
  const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  filtered.sort((a, b) => urgencyOrder[a.urgencyLevel] - urgencyOrder[b.urgencyLevel]);

  const hasCritical = filtered.some(a => a.urgencyLevel === "critical");
  const timelineSensitive = hasCritical || (netWorth > 7_000_000 && new Date().getFullYear() === 2025);

  return {
    strategies: filtered,
    priority: hasCritical ? "URGENT — TCJA sunset requires immediate action" : "Standard planning timeline",
    timelineSensitive,
  };
}
