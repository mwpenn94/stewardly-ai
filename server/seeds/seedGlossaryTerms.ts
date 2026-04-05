/**
 * Seed: Glossary Terms
 * Financial glossary for the education hub.
 * Idempotent: checks existing term before insert.
 */
import { getDb } from "../db";
import { glossaryTerms } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { logger } from "../_core/logger";

const TERMS: Array<{ term: string; definition: string; category: string }> = [
  // Insurance
  { term: "Indexed Universal Life (IUL)", definition: "A permanent life insurance policy that earns interest based on the performance of a market index (e.g., S&P 500) while providing a guaranteed floor rate, typically 0%, to protect against market losses.", category: "insurance" },
  { term: "Cash Value Accumulation", definition: "The savings component of a permanent life insurance policy that grows tax-deferred over time and can be accessed through policy loans or withdrawals.", category: "insurance" },
  { term: "Death Benefit", definition: "The amount of money paid to beneficiaries upon the death of the insured person. It is generally income-tax-free to beneficiaries under IRC Section 101(a).", category: "insurance" },
  { term: "Cap Rate", definition: "The maximum rate of interest that can be credited to an IUL policy in a given period. For example, a 10% cap means even if the index returns 15%, the policy is credited only 10%.", category: "insurance" },
  { term: "Participation Rate", definition: "The percentage of the index gain that is credited to an IUL policy. A 100% participation rate means the full index gain (up to the cap) is credited.", category: "insurance" },
  { term: "Floor Rate", definition: "The minimum guaranteed interest rate on an IUL policy, typically 0%, ensuring the cash value does not decrease due to negative index performance.", category: "insurance" },
  { term: "Premium Finance", definition: "A strategy where a third-party lender finances life insurance premiums, allowing high-net-worth individuals to acquire large policies without liquidating assets.", category: "insurance" },
  { term: "Cost of Insurance (COI)", definition: "The actual cost of providing the death benefit in a life insurance policy, which increases with age and is deducted from the policy's cash value.", category: "insurance" },
  { term: "Accelerated Death Benefit", definition: "A rider that allows the policyholder to receive a portion of the death benefit while still living if diagnosed with a terminal, chronic, or critical illness.", category: "insurance" },
  { term: "Waiver of Premium", definition: "A rider that waives premium payments if the policyholder becomes disabled and unable to work, keeping the policy in force.", category: "insurance" },
  // Tax
  { term: "Marginal Tax Rate", definition: "The tax rate applied to the last dollar of taxable income. The U.S. uses a progressive system with brackets ranging from 10% to 37% for 2025.", category: "tax" },
  { term: "Effective Tax Rate", definition: "The average rate at which income is taxed, calculated by dividing total tax paid by total taxable income. Always lower than the marginal rate in a progressive system.", category: "tax" },
  { term: "Roth Conversion", definition: "The process of moving funds from a traditional IRA or 401(k) to a Roth IRA, paying income tax on the converted amount now for tax-free withdrawals in retirement.", category: "tax" },
  { term: "Tax-Loss Harvesting", definition: "An investment strategy of selling securities at a loss to offset capital gains tax liability, with up to $3,000 in net losses deductible against ordinary income annually.", category: "tax" },
  { term: "Qualified Dividends", definition: "Dividends from domestic corporations and qualified foreign corporations that are taxed at the lower long-term capital gains rate (0%, 15%, or 20%) rather than ordinary income rates.", category: "tax" },
  { term: "Alternative Minimum Tax (AMT)", definition: "A parallel tax system that ensures high-income taxpayers pay a minimum amount of tax. The 2025 exemption is $88,100 for single filers and $137,000 for married filing jointly.", category: "tax" },
  { term: "Standard Deduction", definition: "A fixed dollar amount that reduces taxable income. For 2025: $15,000 for single filers, $30,000 for married filing jointly, with additional amounts for those 65+ or blind.", category: "tax" },
  // Retirement
  { term: "401(k) Plan", definition: "An employer-sponsored defined contribution retirement plan allowing employees to save and invest a portion of their paycheck before taxes. 2025 contribution limit: $23,500 ($31,000 if 50+).", category: "retirement" },
  { term: "Required Minimum Distribution (RMD)", definition: "The minimum amount that must be withdrawn annually from tax-deferred retirement accounts starting at age 73 (under SECURE 2.0 Act), calculated based on life expectancy tables.", category: "retirement" },
  { term: "Monte Carlo Simulation", definition: "A statistical method using thousands of random scenarios to model the probability of different retirement outcomes, accounting for market volatility, inflation, and spending patterns.", category: "retirement" },
  { term: "Sequence of Returns Risk", definition: "The risk that the timing of poor investment returns early in retirement can significantly reduce portfolio longevity, even if average returns are acceptable over the full period.", category: "retirement" },
  { term: "Safe Withdrawal Rate", definition: "The percentage of a retirement portfolio that can be withdrawn annually with a high probability of not running out of money. The traditional '4% rule' is based on the Trinity Study.", category: "retirement" },
  // Estate Planning
  { term: "Irrevocable Life Insurance Trust (ILIT)", definition: "A trust that owns a life insurance policy, removing the death benefit from the insured's taxable estate. The 2025 federal estate tax exemption is $13.99 million per individual.", category: "estate" },
  { term: "Generation-Skipping Transfer Tax (GSTT)", definition: "A federal tax on transfers of property to beneficiaries who are two or more generations below the donor, with a 2025 exemption of $13.99 million.", category: "estate" },
  { term: "Grantor Retained Annuity Trust (GRAT)", definition: "An irrevocable trust where the grantor transfers assets and receives annuity payments for a set term. Appreciation above the IRS Section 7520 rate passes to beneficiaries tax-free.", category: "estate" },
  { term: "Power of Attorney (POA)", definition: "A legal document authorizing someone to act on another's behalf in financial or healthcare matters. A durable POA remains effective if the principal becomes incapacitated.", category: "estate" },
  { term: "Portability", definition: "The ability of a surviving spouse to use the deceased spouse's unused federal estate and gift tax exemption (DSUE), effectively doubling the exemption to $27.98 million for 2025.", category: "estate" },
  // Investing
  { term: "Asset Allocation", definition: "The strategy of dividing investments among different asset categories (stocks, bonds, cash, alternatives) based on risk tolerance, time horizon, and financial goals.", category: "investing" },
  { term: "Sharpe Ratio", definition: "A measure of risk-adjusted return calculated as (portfolio return - risk-free rate) / portfolio standard deviation. Higher values indicate better risk-adjusted performance.", category: "investing" },
  { term: "Dollar-Cost Averaging", definition: "An investment strategy of investing a fixed amount at regular intervals regardless of market conditions, reducing the impact of volatility on the overall purchase price.", category: "investing" },
  { term: "Expense Ratio", definition: "The annual fee charged by mutual funds and ETFs as a percentage of assets under management. Index funds typically charge 0.03%-0.20%, while active funds charge 0.50%-1.50%.", category: "investing" },
  // Debt
  { term: "Debt-to-Income Ratio (DTI)", definition: "The percentage of gross monthly income that goes toward paying debts. Lenders typically prefer a DTI below 36%, with no more than 28% going toward housing costs.", category: "debt" },
  { term: "Debt Avalanche Method", definition: "A debt repayment strategy that prioritizes paying off debts with the highest interest rates first while making minimum payments on others, minimizing total interest paid.", category: "debt" },
  { term: "Debt Snowball Method", definition: "A debt repayment strategy popularized by Dave Ramsey that prioritizes paying off the smallest debts first for psychological wins, regardless of interest rates.", category: "debt" },
  // General
  { term: "Emergency Fund", definition: "Liquid savings set aside for unexpected expenses or income loss. Financial planners generally recommend 3-6 months of essential expenses, held in high-yield savings accounts.", category: "general" },
  { term: "Net Worth", definition: "The total value of all assets minus all liabilities. It provides a snapshot of overall financial health and is a key metric tracked by the Digital Financial Twin.", category: "general" },
  { term: "Fiduciary Duty", definition: "A legal obligation to act in the best interest of another party. Registered Investment Advisors (RIAs) are held to a fiduciary standard, unlike broker-dealers who follow a suitability standard.", category: "general" },
  { term: "Compound Interest", definition: "Interest calculated on both the initial principal and the accumulated interest from previous periods. Albert Einstein reportedly called it 'the eighth wonder of the world.'", category: "general" },
  { term: "Suitability Assessment", definition: "A regulatory requirement to evaluate whether a financial product or strategy is appropriate for a client based on their financial situation, risk tolerance, and objectives.", category: "general" },
  { term: "Digital Financial Twin", definition: "A comprehensive digital model of an individual's complete financial life, integrating all accounts, insurance policies, tax situations, and goals for holistic planning.", category: "general" },
];

export async function seedGlossaryTerms(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  let inserted = 0;
  for (const t of TERMS) {
    const existing = await db.select({ id: glossaryTerms.id })
      .from(glossaryTerms)
      .where(eq(glossaryTerms.term, t.term))
      .limit(1);
    if (existing.length > 0) continue;
    try {
      await db.insert(glossaryTerms).values({
        term: t.term,
        definition: t.definition,
        category: t.category as any,
      });
      inserted++;
    } catch (e: any) {
      if (!e?.message?.includes("Duplicate")) {
        logger.error({ operation: "seedGlossaryTerms", err: e }, `[SeedGlossary] Error: ${e?.message}`);
      }
    }
  }
  return inserted;
}
