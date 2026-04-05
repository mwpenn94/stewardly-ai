/**
 * Seed: Content Articles
 * SEO-optimized financial education articles for the content hub.
 * Idempotent: checks existing slug before insert.
 */
import { getDb } from "../db";
import { contentArticles } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { logger } from "../_core/logger";

const ARTICLES: Array<{
  slug: string; title: string; category: string;
  summary: string; content: string;
}> = [
  {
    slug: "iul-explained-2025",
    title: "Indexed Universal Life Insurance Explained: 2025 Complete Guide",
    category: "insurance",
    summary: "A comprehensive guide to how IUL policies work, including cap rates, participation rates, floor protection, and how they compare to traditional investments for wealth building.",
    content: `Indexed Universal Life (IUL) insurance is a type of permanent life insurance that combines a death benefit with a cash value component linked to stock market index performance. Unlike direct market investment, IUL policies provide downside protection through a guaranteed floor rate—typically 0%—while offering upside potential through index-linked crediting strategies.\n\nThe key mechanics include cap rates (the maximum credited return, typically 8-12%), participation rates (the percentage of index gains credited, often 100%), and spread/margin deductions. For 2025, leading carriers are offering competitive rates as the interest rate environment stabilizes.\n\nIUL is not a replacement for traditional investments but rather a complementary tool in a comprehensive financial plan, particularly for high-income earners who have maximized tax-advantaged retirement accounts.`,
  },
  {
    slug: "estate-planning-tcja-sunset-2026",
    title: "Estate Planning Before the TCJA Sunset: What You Need to Know",
    category: "estate",
    summary: "The Tax Cuts and Jobs Act estate tax exemption is scheduled to sunset in 2026. Learn what this means for your estate plan and strategies to consider now.",
    content: `The current federal estate tax exemption of $13.99 million per individual ($27.98 million for married couples) is set to approximately halve when the Tax Cuts and Jobs Act provisions sunset after December 31, 2025. This creates a narrow window for high-net-worth individuals to implement estate planning strategies.\n\nKey strategies to consider include: making large gifts before the sunset using the current exemption, establishing Irrevocable Life Insurance Trusts (ILITs) to remove life insurance proceeds from the taxable estate, creating Grantor Retained Annuity Trusts (GRATs) to transfer appreciation tax-free, and reviewing existing trusts to ensure they are optimized for the changing landscape.\n\nThe IRS has confirmed that gifts made under the current higher exemption will not be clawed back even if the exemption decreases, providing certainty for proactive planning.`,
  },
  {
    slug: "social-security-claiming-strategies-2025",
    title: "Social Security Claiming Strategies for Maximum Benefits in 2025",
    category: "retirement",
    summary: "Optimize your Social Security benefits with strategic claiming decisions. Learn about delayed credits, spousal benefits, and the earnings test.",
    content: `Social Security remains the foundation of retirement income for most Americans. In 2025, the maximum benefit at full retirement age (67) is $4,018 per month, while delaying to age 70 increases this to $5,108—a 24% increase through delayed retirement credits.\n\nThe optimal claiming strategy depends on multiple factors: health and longevity expectations, other income sources, marital status and spousal benefit coordination, tax implications, and cash flow needs. For married couples, the higher earner typically benefits most from delaying to age 70, as this also maximizes the survivor benefit.\n\nThe 2025 earnings test exempts $23,400 for those under full retirement age, with $1 withheld for every $2 earned above the threshold. Benefits withheld are not lost—they are added back to your benefit calculation at full retirement age.`,
  },
  {
    slug: "roth-conversion-strategies-2025",
    title: "Roth Conversion Strategies: When and How Much to Convert",
    category: "tax",
    summary: "Strategic Roth conversions can save hundreds of thousands in lifetime taxes. Learn the optimal timing, amount, and tax bracket management techniques.",
    content: `A Roth conversion involves moving funds from a traditional IRA or 401(k) to a Roth IRA, paying income tax on the converted amount now in exchange for tax-free growth and withdrawals in retirement. The strategy is particularly valuable when current tax rates are lower than expected future rates.\n\nOptimal conversion windows include: years with lower income (career transitions, early retirement before Social Security), years before RMDs begin at age 73, and the current period before potential TCJA sunset in 2026 which could increase tax rates.\n\nThe key is bracket management—converting just enough to fill your current tax bracket without pushing into the next one. For example, a married couple in the 22% bracket with $110,000 of taxable income could convert up to $96,700 before entering the 24% bracket.\n\nConsider the impact on Medicare IRMAA surcharges (income thresholds start at $106,000 for single filers in 2025) and the 3.8% Net Investment Income Tax.`,
  },
  {
    slug: "premium-finance-high-net-worth",
    title: "Premium Finance for High-Net-Worth Life Insurance: A Complete Guide",
    category: "insurance",
    summary: "How premium financing works for large life insurance policies, including eligibility requirements, risks, and when it makes sense.",
    content: `Premium financing allows high-net-worth individuals to acquire large life insurance policies by borrowing the premium payments from a third-party lender. This strategy preserves liquidity and can provide significant estate planning benefits when structured properly.\n\nTypical eligibility requires a net worth of $5 million or more, with the policy death benefit often ranging from $5 million to $50 million or more. The borrower typically provides collateral (often 10-20% of the loan amount) and pays interest on the loan, which is offset by the policy's cash value growth.\n\nKey risks include: interest rate risk (if borrowing rates exceed policy crediting rates), collateral calls if policy performance underperforms, and the need for an exit strategy (typically policy cash value repays the loan within 10-15 years).\n\nPremium financing is most appropriate when: the client needs a large death benefit for estate planning, they prefer not to liquidate assets to pay premiums, the spread between borrowing costs and policy crediting rates is favorable, and proper suitability analysis confirms the strategy aligns with their overall financial plan.`,
  },
  {
    slug: "medicare-irmaa-planning-2025",
    title: "Medicare IRMAA Surcharges: How to Avoid Paying More for Medicare",
    category: "retirement",
    summary: "Understanding Medicare Income-Related Monthly Adjustment Amounts (IRMAA) and strategies to manage your modified adjusted gross income.",
    content: `Medicare Part B and Part D premiums are income-adjusted through IRMAA surcharges. In 2025, the standard Part B premium is $185.00 per month, but high-income beneficiaries can pay up to $628.90 per month based on their modified adjusted gross income (MAGI) from two years prior.\n\nThe 2025 IRMAA brackets for individuals start at $106,000 MAGI, with the highest surcharge applying to income above $500,000. For married couples filing jointly, the thresholds are doubled.\n\nStrategies to manage IRMAA include: timing Roth conversions to avoid IRMAA bracket jumps, managing capital gains realization, using qualified charitable distributions (QCDs) from IRAs after age 70½, and filing for IRMAA reduction if you've experienced a life-changing event (retirement, divorce, death of spouse).\n\nPlanning tip: Since IRMAA uses a two-year lookback, the year you retire is often an ideal time for Roth conversions, as your income drops but IRMAA is still based on your higher pre-retirement income.`,
  },
  {
    slug: "financial-protection-score-explained",
    title: "Your Financial Protection Score: Understanding and Improving It",
    category: "general",
    summary: "Learn how the Financial Protection Score works, what dimensions it measures, and actionable steps to improve your financial resilience.",
    content: `The Financial Protection Score is a comprehensive assessment of your financial resilience across multiple dimensions. Unlike a credit score that measures borrowing risk, the Protection Score evaluates how well-prepared you are for life's financial challenges.\n\nThe score evaluates six key dimensions:\n1. **Income Protection** - Life insurance coverage relative to income replacement needs\n2. **Emergency Preparedness** - Liquid savings relative to monthly expenses\n3. **Retirement Readiness** - Retirement savings trajectory vs. projected needs\n4. **Debt Management** - Debt-to-income ratio and payoff trajectory\n5. **Estate Preparedness** - Essential documents and beneficiary designations\n6. **Insurance Coverage** - Health, disability, liability, and property insurance adequacy\n\nEach dimension is scored 0-100, with the overall score being a weighted average. A score above 80 indicates strong financial protection, 60-79 is moderate with specific gaps to address, and below 60 suggests significant vulnerabilities.\n\nThe most impactful improvements typically come from: establishing adequate life insurance coverage, building a 3-6 month emergency fund, and ensuring all essential estate documents are in place.`,
  },
  {
    slug: "digital-financial-twin-guide",
    title: "The Digital Financial Twin: Your Complete Financial Life in One View",
    category: "general",
    summary: "How the Digital Financial Twin technology creates a comprehensive model of your financial life for better planning and decision-making.",
    content: `A Digital Financial Twin is a comprehensive, real-time digital model of your entire financial life. It integrates all financial accounts, insurance policies, tax situations, estate plans, and goals into a single unified view, enabling holistic financial planning that traditional tools cannot match.\n\nThe Digital Financial Twin continuously monitors and analyzes:\n- **Net Worth Tracking** - All assets and liabilities in real-time\n- **Cash Flow Analysis** - Income, expenses, and savings patterns\n- **Insurance Coverage** - Life, health, disability, property, and liability policies\n- **Tax Situation** - Current year projections and multi-year planning\n- **Retirement Trajectory** - Monte Carlo simulations with current data\n- **Estate Plan Status** - Document currency and beneficiary alignment\n\nThe AI-powered analysis identifies opportunities and risks that might be missed in siloed planning: a Roth conversion opportunity created by a job change, an insurance gap exposed by a new mortgage, or an estate plan that needs updating after a life event.\n\nFor financial professionals, the Digital Financial Twin provides a complete client picture that enables proactive, personalized advice rather than reactive, product-focused recommendations.`,
  },
];

export async function seedContentArticles(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  let inserted = 0;
  for (const a of ARTICLES) {
    const existing = await db.select({ id: contentArticles.id })
      .from(contentArticles)
      .where(eq(contentArticles.slug, a.slug))
      .limit(1);
    if (existing.length > 0) continue;
    try {
      await db.insert(contentArticles).values({
        slug: a.slug,
        title: a.title,
        category: a.category as any,
        excerpt: a.summary,
        content: a.content,
        status: "published" as any,
      });
      inserted++;
    } catch (e: any) {
      if (!e?.message?.includes("Duplicate")) {
        logger.error({ operation: "seedContentArticles", err: e }, `[SeedArticles] Error: ${e?.message}`);
      }
    }
  }
  return inserted;
}
