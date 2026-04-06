export const PILLAR_PAGES = [
  { slug: "life-insurance-guide", title: "Complete Guide to Life Insurance", category: "insurance", seoTitle: "Life Insurance Guide 2026 — Types, Costs, & How to Choose", seoDescription: "Comprehensive guide to term, whole life, IUL, and universal life insurance. Compare costs, coverage, and find the right policy." },
  { slug: "retirement-planning-guide", title: "Retirement Planning Guide", category: "retirement", seoTitle: "Retirement Planning Guide — How Much You Need & When to Start", seoDescription: "Step-by-step retirement planning: savings targets, investment strategies, Social Security optimization, and tax-efficient withdrawal." },
  { slug: "estate-planning-guide", title: "Estate Planning Essentials", category: "estate", seoTitle: "Estate Planning Guide — Wills, Trusts, & Tax Strategies", seoDescription: "Estate planning fundamentals: wills, trusts, ILIT, gifting strategies, and how to minimize estate taxes." },
  { slug: "tax-strategy-guide", title: "Tax Strategy Guide", category: "tax", seoTitle: "Tax Strategy Guide — Deductions, Credits, & Roth Conversions", seoDescription: "Tax optimization strategies: deductions, credits, Roth conversions, tax-loss harvesting, and QBI deductions." },
  { slug: "investment-guide", title: "Investment Guide", category: "investing", seoTitle: "Investment Guide — Stocks, Bonds, IUL & Alternative Assets", seoDescription: "Investment fundamentals: asset allocation, diversification, IUL vs market, FIA, and alternative investments." },
  { slug: "education-planning-guide", title: "Education Planning Guide", category: "education", seoTitle: "Education Planning — 529 Plans, Funding Strategies & Costs", seoDescription: "College funding strategies: 529 plans, financial aid, scholarships, and tax-advantaged education savings." },
  { slug: "business-planning-guide", title: "Business Planning Guide", category: "business", seoTitle: "Business Planning for Financial Professionals — Growth & Exit", seoDescription: "Business planning: production targets, recruiting, succession, buy-sell agreements, and exit strategies." },
  { slug: "financial-protection-score-explained", title: "Financial Protection Score Explained", category: "general", seoTitle: "What Is Your Financial Protection Score? — Free Assessment", seoDescription: "Understand your financial protection across 12 dimensions. Free score assessment with personalized improvement plan." },
  { slug: "premium-finance-explained", title: "Premium Finance Explained", category: "insurance", seoTitle: "Premium Finance — How High Net Worth Clients Fund Large Policies", seoDescription: "Premium financing explained: how it works, SOFR rates, cash value arbitrage, and when it makes sense." },
  { slug: "calculator-faq", title: "Financial Calculator FAQ", category: "calculator_faq", seoTitle: "Financial Calculator Help — How to Use Our Planning Tools", seoDescription: "Help guide for all financial calculators: retirement, tax, estate, insurance, education, and business planning." },
];
export async function seed() {
  console.log(`[seed:18] Content pillar pages: ${PILLAR_PAGES.length} SEO pages defined`);
  PILLAR_PAGES.forEach(p => console.log(`  - /${p.slug} — ${p.title}`));
}
if (import.meta.url === `file://${process.argv[1]}`) seed();
