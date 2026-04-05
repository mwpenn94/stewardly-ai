/**
 * Seed: Education Modules
 * Financial education content for the education hub.
 * Idempotent: checks existing title before insert.
 */
import { getDb } from "../db";
import { educationModules } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { logger } from "../_core/logger";

const MODULES: Array<{
  title: string; description: string; category: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedMinutes: number; content: string;
}> = [
  {
    title: "Understanding Life Insurance Basics",
    description: "Learn the fundamentals of life insurance including term, whole, and universal life policies.",
    category: "insurance", difficulty: "beginner", estimatedMinutes: 10,
    content: `# Understanding Life Insurance Basics\n\nLife insurance provides financial protection for your loved ones. There are three main types:\n\n## Term Life Insurance\n- Covers a specific period (10, 20, or 30 years)\n- Most affordable option\n- No cash value component\n- Best for: temporary needs like mortgage protection or income replacement during working years\n\n## Whole Life Insurance\n- Permanent coverage that lasts your entire life\n- Guaranteed cash value growth\n- Fixed premiums\n- Best for: estate planning, legacy creation, guaranteed protection\n\n## Universal Life Insurance\n- Flexible premiums and death benefits\n- Cash value grows based on credited interest\n- Indexed Universal Life (IUL) ties growth to market indices with downside protection\n- Best for: those wanting permanent coverage with growth potential\n\n## Key Takeaway\nThe right type depends on your needs, budget, and financial goals. A comprehensive needs analysis considers income replacement, debt coverage, education funding, and estate planning.`,
  },
  {
    title: "IUL vs. Traditional Investments",
    description: "Compare Indexed Universal Life insurance with traditional market investments for wealth building.",
    category: "insurance", difficulty: "intermediate", estimatedMinutes: 15,
    content: `# IUL vs. Traditional Investments\n\n## How IUL Works\nIndexed Universal Life policies credit interest based on market index performance (e.g., S&P 500) with a guaranteed floor (typically 0%) and a cap rate.\n\n## Key Differences\n\n| Feature | IUL | Traditional Investments |\n|---------|-----|------------------------|\n| Downside Protection | 0% floor | Full market risk |\n| Upside Potential | Capped (8-12% typical) | Unlimited |\n| Tax Treatment | Tax-free loans & death benefit | Capital gains tax |\n| Liquidity | Policy loans after accumulation | Generally liquid |\n| Fees | COI + admin charges | Expense ratios |\n| Death Benefit | Included | None (separate purchase) |\n\n## When IUL May Be Appropriate\n- High-income earners who have maxed out 401(k) and IRA contributions\n- Those seeking tax-free retirement income supplementation\n- Individuals wanting death benefit protection with growth potential\n- Business owners looking for key person coverage with cash accumulation\n\n## Important Considerations\n- IUL illustrations are not guarantees\n- Policy charges reduce net returns\n- Proper funding is critical for performance\n- Suitability assessment required`,
  },
  {
    title: "Tax Bracket Management Strategies",
    description: "Learn how to optimize your tax situation through bracket management and strategic planning.",
    category: "tax", difficulty: "intermediate", estimatedMinutes: 12,
    content: `# Tax Bracket Management Strategies\n\n## 2025 Federal Tax Brackets (Married Filing Jointly)\n- 10%: $0 - $23,850\n- 12%: $23,851 - $96,950\n- 22%: $96,951 - $206,700\n- 24%: $206,701 - $394,600\n- 32%: $394,601 - $501,050\n- 35%: $501,051 - $751,600\n- 37%: Over $751,600\n\n## Key Strategies\n\n### 1. Roth Conversion Ladder\nConvert traditional IRA funds to Roth IRA in years when your income is lower, filling up lower tax brackets.\n\n### 2. Income Timing\nDefer bonuses, accelerate deductions, or time capital gains to manage which bracket you fall into.\n\n### 3. Tax-Loss Harvesting\nSell losing investments to offset gains. Up to $3,000 in net losses can offset ordinary income.\n\n### 4. Charitable Giving Strategies\nBunch charitable donations using donor-advised funds to exceed the standard deduction in alternating years.\n\n### 5. Retirement Account Optimization\nMaximize pre-tax contributions ($23,500 for 401(k) in 2025) to reduce current taxable income.`,
  },
  {
    title: "Estate Planning Fundamentals",
    description: "Essential estate planning concepts including wills, trusts, and tax strategies.",
    category: "estate", difficulty: "beginner", estimatedMinutes: 15,
    content: `# Estate Planning Fundamentals\n\n## Why Estate Planning Matters\nEstate planning ensures your assets are distributed according to your wishes and minimizes tax burden on heirs.\n\n## Essential Documents\n1. **Last Will and Testament** - Directs asset distribution and names guardians for minor children\n2. **Revocable Living Trust** - Avoids probate, provides privacy, and enables seamless asset transfer\n3. **Durable Power of Attorney** - Designates someone to handle financial affairs if incapacitated\n4. **Healthcare Power of Attorney** - Designates someone to make medical decisions\n5. **Advance Directive** - Documents end-of-life care preferences\n\n## 2025 Estate Tax Thresholds\n- Federal exemption: $13.99 million per individual ($27.98 million for married couples with portability)\n- Estate tax rate: 40% on amounts above exemption\n- Annual gift tax exclusion: $19,000 per recipient\n- **Sunset Warning**: The current exemption is scheduled to revert to approximately $7 million in 2026 under TCJA sunset provisions\n\n## Common Strategies\n- **ILIT (Irrevocable Life Insurance Trust)**: Removes life insurance from taxable estate\n- **GRAT (Grantor Retained Annuity Trust)**: Transfers appreciation to heirs tax-free\n- **Family Limited Partnership**: Provides valuation discounts for family business transfers\n- **Charitable Remainder Trust**: Provides income stream with charitable deduction`,
  },
  {
    title: "Retirement Income Planning",
    description: "Strategies for creating sustainable retirement income from multiple sources.",
    category: "retirement", difficulty: "intermediate", estimatedMinutes: 15,
    content: `# Retirement Income Planning\n\n## The Three-Bucket Strategy\n\n### Bucket 1: Short-Term (0-3 years)\n- High-yield savings, money market, short-term bonds\n- Covers 2-3 years of living expenses\n- Provides stability during market downturns\n\n### Bucket 2: Medium-Term (3-10 years)\n- Balanced portfolio of bonds and dividend stocks\n- Moderate growth with lower volatility\n- Replenishes Bucket 1 as needed\n\n### Bucket 3: Long-Term (10+ years)\n- Growth-oriented stocks and alternatives\n- Designed to outpace inflation\n- Replenishes Bucket 2 over time\n\n## Income Sources\n- **Social Security**: Optimal claiming age depends on health, spousal benefits, and other income\n- **Pensions**: Evaluate lump sum vs. annuity options carefully\n- **401(k)/IRA Withdrawals**: Subject to RMDs starting at age 73\n- **Roth IRA**: Tax-free withdrawals, no RMDs during owner's lifetime\n- **IUL Policy Loans**: Tax-free income supplementation\n- **Annuities**: Guaranteed income floor\n\n## Key Considerations\n- Inflation averaging 3% doubles costs every 24 years\n- Healthcare costs average $315,000+ per couple in retirement (Fidelity 2024 estimate)\n- Sequence of returns risk is highest in first 5-10 years of retirement`,
  },
  {
    title: "Social Security Optimization",
    description: "Maximize your Social Security benefits through strategic claiming decisions.",
    category: "retirement", difficulty: "advanced", estimatedMinutes: 20,
    content: `# Social Security Optimization\n\n## 2025 Key Numbers\n- Maximum benefit at FRA (67): $4,018/month\n- Maximum benefit at 70: $5,108/month\n- COLA adjustment: 2.5%\n- Earnings test (under FRA): $23,400 exempt, $1 withheld per $2 over\n- Taxable wage base: $176,100\n\n## Claiming Strategies\n\n### Early Claiming (Age 62)\n- Permanent 30% reduction from FRA benefit\n- Break-even vs. FRA claiming: approximately age 78-80\n- Consider if: health concerns, immediate income need, or can invest the benefits\n\n### Full Retirement Age (67)\n- Receive 100% of calculated benefit\n- No earnings test restrictions\n- Spousal benefit available: up to 50% of higher earner's FRA benefit\n\n### Delayed Claiming (Age 70)\n- 8% increase per year of delay (24% total increase from 67 to 70)\n- Maximum benefit strategy\n- Break-even vs. FRA: approximately age 82-83\n- Consider if: good health, other income sources, married (survivor benefit maximization)\n\n## Spousal Strategies\n- Higher earner delays to 70 to maximize survivor benefit\n- Lower earner may claim earlier\n- Divorced spouse eligible if marriage lasted 10+ years\n\n## Tax Considerations\n- Up to 85% of benefits may be taxable\n- Provisional income thresholds: $25,000 (single), $32,000 (married)`,
  },
  {
    title: "Understanding Your Credit Score",
    description: "How credit scores work and strategies to improve them.",
    category: "credit", difficulty: "beginner", estimatedMinutes: 8,
    content: `# Understanding Your Credit Score\n\n## FICO Score Components\n1. **Payment History (35%)** - On-time payments are the most important factor\n2. **Credit Utilization (30%)** - Keep balances below 30% of credit limits (ideal: under 10%)\n3. **Length of Credit History (15%)** - Older accounts help your score\n4. **Credit Mix (10%)** - Having different types of credit (cards, loans, mortgage)\n5. **New Credit (10%)** - Hard inquiries and new accounts can temporarily lower scores\n\n## Score Ranges\n- Exceptional: 800-850\n- Very Good: 740-799\n- Good: 670-739\n- Fair: 580-669\n- Poor: 300-579\n\n## Quick Improvement Strategies\n1. Pay all bills on time (set up autopay)\n2. Pay down credit card balances\n3. Don't close old credit cards\n4. Limit new credit applications\n5. Dispute any errors on your credit report\n6. Become an authorized user on a family member's old, well-managed card\n\n## Free Credit Reports\nAnnualCreditReport.com provides free weekly reports from all three bureaus (Equifax, Experian, TransUnion).`,
  },
  {
    title: "Budgeting with the 50/30/20 Rule",
    description: "A simple framework for managing your monthly budget effectively.",
    category: "budgeting", difficulty: "beginner", estimatedMinutes: 8,
    content: `# Budgeting with the 50/30/20 Rule\n\n## The Framework\nDivide your after-tax income into three categories:\n\n### 50% - Needs\n- Housing (rent/mortgage)\n- Utilities\n- Groceries\n- Insurance premiums\n- Minimum debt payments\n- Transportation\n\n### 30% - Wants\n- Dining out\n- Entertainment\n- Shopping\n- Hobbies\n- Subscriptions\n- Travel\n\n### 20% - Savings & Debt Payoff\n- Emergency fund (3-6 months expenses)\n- Retirement contributions\n- Extra debt payments\n- Investment contributions\n- Sinking funds for large purchases\n\n## Getting Started\n1. Calculate your after-tax monthly income\n2. Track spending for one month\n3. Categorize each expense as Need, Want, or Savings\n4. Adjust spending to match the 50/30/20 targets\n5. Automate savings and bill payments\n\n## When to Adjust\n- High cost-of-living areas may need 60/20/20\n- High debt situations may need 50/20/30 (30% to debt)\n- High earners should aim for 40/20/40 or better`,
  },
  {
    title: "Real Estate Investment Fundamentals",
    description: "Introduction to real estate investing including rental properties and REITs.",
    category: "real_estate", difficulty: "intermediate", estimatedMinutes: 12,
    content: `# Real Estate Investment Fundamentals\n\n## Direct Ownership\n\n### Key Metrics\n- **Cap Rate**: Net Operating Income / Property Value (good: 5-10%)\n- **Cash-on-Cash Return**: Annual Cash Flow / Total Cash Invested\n- **1% Rule**: Monthly rent should be at least 1% of purchase price\n- **Debt Service Coverage Ratio**: NOI / Annual Debt Service (minimum 1.25x)\n\n### Tax Benefits\n- Depreciation deduction (27.5 years for residential)\n- Mortgage interest deduction\n- 1031 Exchange for tax-deferred property swaps\n- Qualified Business Income (QBI) deduction potential\n\n## REITs (Real Estate Investment Trusts)\n- Publicly traded, liquid real estate exposure\n- Required to distribute 90% of taxable income as dividends\n- Types: Equity REITs, Mortgage REITs, Hybrid REITs\n- Average historical return: 10-12% annually\n\n## Considerations\n- Location, location, location\n- Property management costs (8-12% of rent)\n- Vacancy rates (budget 5-10%)\n- Maintenance reserves (1-2% of property value annually)\n- Insurance and property tax increases\n- Leverage amplifies both gains and losses`,
  },
  {
    title: "Debt Elimination Strategies",
    description: "Compare debt payoff methods and create your elimination plan.",
    category: "debt", difficulty: "beginner", estimatedMinutes: 10,
    content: `# Debt Elimination Strategies\n\n## The Debt Avalanche Method\n1. List all debts from highest to lowest interest rate\n2. Make minimum payments on all debts\n3. Put extra money toward the highest-rate debt\n4. When that's paid off, roll the payment to the next highest rate\n\n**Pros**: Minimizes total interest paid\n**Cons**: May take longer to see first debt eliminated\n\n## The Debt Snowball Method\n1. List all debts from smallest to largest balance\n2. Make minimum payments on all debts\n3. Put extra money toward the smallest balance\n4. When that's paid off, roll the payment to the next smallest\n\n**Pros**: Quick psychological wins, builds momentum\n**Cons**: May pay more total interest\n\n## Dave Ramsey's Baby Steps\n1. Save $1,000 emergency fund\n2. Pay off all debt (except mortgage) using debt snowball\n3. Save 3-6 months of expenses\n4. Invest 15% of income in retirement\n5. Save for children's college\n6. Pay off home early\n7. Build wealth and give generously\n\n## When to Consider Consolidation\n- Multiple high-interest debts (>15% APR)\n- Good credit score (670+) to qualify for lower rates\n- Committed to not accumulating new debt\n- Balance transfer offers (0% APR for 12-21 months)`,
  },
];

export async function seedEducationModules(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  let inserted = 0;
  for (const m of MODULES) {
    const existing = await db.select({ id: educationModules.id })
      .from(educationModules)
      .where(eq(educationModules.title, m.title))
      .limit(1);
    if (existing.length > 0) continue;
    try {
      await db.insert(educationModules).values({
        title: m.title,
        description: m.description,
        category: m.category as any,
        difficulty: m.difficulty,
        estimatedMinutes: m.estimatedMinutes,
        content: m.content,
        isActive: true,
      });
      inserted++;
    } catch (e: any) {
      if (!e?.message?.includes("Duplicate")) {
        logger.error({ operation: "seedEducationModules", err: e }, `[SeedEducation] Error: ${e?.message}`);
      }
    }
  }
  return inserted;
}
