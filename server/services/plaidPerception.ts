/**
 * Plaid Perception Enhancement — Task 7
 *
 * Enriches Plaid account data with calculator context to provide
 * deeper financial insights. Maps Plaid balances, transactions,
 * and account types to UWE/BIE engine input profiles.
 */
import { logger } from "../_core/logger";

const log = logger.child({ module: "plaid-perception" });

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface PlaidAccount {
  accountId: string;
  name: string;
  type: "depository" | "credit" | "loan" | "investment" | "other";
  subtype: string;
  balances: {
    available: number | null;
    current: number | null;
    limit: number | null;
  };
  mask?: string;
}

export interface PlaidTransaction {
  transactionId: string;
  accountId: string;
  amount: number;
  date: string;
  category: string[];
  merchantName?: string;
}

export interface UWEProfileInput {
  age: number;
  income: number;
  savings: number;
  investmentBalance: number;
  debtBalance: number;
  monthlyExpenses: number;
  savingsRate: number;
  riskTolerance: "conservative" | "moderate" | "aggressive";
  hasLifeInsurance: boolean;
  hasRetirementAccount: boolean;
}

export interface EnrichedPlaidData {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  liquidAssets: number;
  investmentAssets: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  savingsRate: number;
  debtToIncomeRatio: number;
  accountBreakdown: Array<{
    type: string;
    count: number;
    totalBalance: number;
    percentage: number;
  }>;
  riskProfile: "conservative" | "moderate" | "aggressive";
  uweProfile: UWEProfileInput;
  insights: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// ENRICHMENT LOGIC
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Enrich Plaid account data with calculator context
 */
export function enrichPlaidAccounts(
  accounts: PlaidAccount[],
  transactions: PlaidTransaction[],
  clientAge: number,
): EnrichedPlaidData {
  // Categorize accounts
  const depository = accounts.filter((a) => a.type === "depository");
  const investment = accounts.filter((a) => a.type === "investment");
  const credit = accounts.filter((a) => a.type === "credit");
  const loan = accounts.filter((a) => a.type === "loan");

  // Calculate balances
  const liquidAssets = depository.reduce((sum, a) => sum + (a.balances.current || 0), 0);
  const investmentAssets = investment.reduce((sum, a) => sum + (a.balances.current || 0), 0);
  const creditDebt = credit.reduce((sum, a) => sum + (a.balances.current || 0), 0);
  const loanDebt = loan.reduce((sum, a) => sum + (a.balances.current || 0), 0);

  const totalAssets = liquidAssets + investmentAssets;
  const totalLiabilities = creditDebt + loanDebt;
  const netWorth = totalAssets - totalLiabilities;

  // Analyze transactions for income/expense patterns
  const last90Days = transactions.filter((t) => {
    const txDate = new Date(t.date);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    return txDate >= cutoff;
  });

  const incomeTransactions = last90Days.filter((t) => t.amount < 0); // Plaid: negative = income
  const expenseTransactions = last90Days.filter((t) => t.amount > 0);

  const totalIncome90d = Math.abs(incomeTransactions.reduce((s, t) => s + t.amount, 0));
  const totalExpenses90d = expenseTransactions.reduce((s, t) => s + t.amount, 0);

  const monthlyIncome = totalIncome90d / 3;
  const monthlyExpenses = totalExpenses90d / 3;
  const savingsRate = monthlyIncome > 0 ? Math.max(0, (monthlyIncome - monthlyExpenses) / monthlyIncome) : 0;
  const debtToIncomeRatio = monthlyIncome > 0 ? totalLiabilities / (monthlyIncome * 12) : 0;

  // Determine risk profile from portfolio composition
  const investmentRatio = totalAssets > 0 ? investmentAssets / totalAssets : 0;
  const riskProfile: "conservative" | "moderate" | "aggressive" =
    investmentRatio >= 0.6 ? "aggressive" :
    investmentRatio >= 0.3 ? "moderate" : "conservative";

  // Account breakdown
  const typeMap = new Map<string, { count: number; total: number }>();
  for (const a of accounts) {
    const entry = typeMap.get(a.type) || { count: 0, total: 0 };
    entry.count++;
    entry.total += a.balances.current || 0;
    typeMap.set(a.type, entry);
  }

  const accountBreakdown = Array.from(typeMap.entries()).map(([type, data]) => ({
    type,
    count: data.count,
    totalBalance: data.total,
    percentage: totalAssets > 0 ? data.total / (totalAssets + totalLiabilities) : 0,
  }));

  // Generate insights
  const insights: string[] = [];

  if (savingsRate < 0.10) {
    insights.push("Savings rate is below 10%. Consider increasing contributions to reach the recommended 15-20% range.");
  } else if (savingsRate >= 0.20) {
    insights.push(`Strong savings rate of ${(savingsRate * 100).toFixed(1)}%. Well-positioned for wealth accumulation strategies.`);
  }

  if (debtToIncomeRatio > 0.36) {
    insights.push("Debt-to-income ratio exceeds 36%. Debt reduction should be prioritized before aggressive investment strategies.");
  }

  if (investmentAssets === 0 && monthlyIncome > 3000) {
    insights.push("No investment accounts detected. Opening a brokerage or retirement account could significantly improve long-term wealth projections.");
  }

  if (liquidAssets > monthlyExpenses * 12) {
    insights.push("Liquid assets exceed 12 months of expenses. Consider deploying excess cash into higher-yield investment vehicles.");
  } else if (liquidAssets < monthlyExpenses * 3) {
    insights.push("Emergency fund is below the recommended 3-6 months of expenses. Building this buffer should be a priority.");
  }

  const hasRetirement = accounts.some((a) =>
    a.subtype === "401k" || a.subtype === "ira" || a.subtype === "roth" || a.subtype === "403b"
  );

  if (!hasRetirement && clientAge >= 25) {
    insights.push("No retirement accounts detected. Tax-advantaged retirement savings should be a core component of any wealth strategy.");
  }

  // Build UWE profile input
  const uweProfile: UWEProfileInput = {
    age: clientAge,
    income: monthlyIncome * 12,
    savings: liquidAssets,
    investmentBalance: investmentAssets,
    debtBalance: totalLiabilities,
    monthlyExpenses,
    savingsRate,
    riskTolerance: riskProfile,
    hasLifeInsurance: false, // Cannot determine from Plaid
    hasRetirementAccount: hasRetirement,
  };

  log.info({
    accountCount: accounts.length,
    netWorth,
    savingsRate: savingsRate.toFixed(3),
    riskProfile,
    insightCount: insights.length,
  }, "Plaid data enriched");

  return {
    totalAssets,
    totalLiabilities,
    netWorth,
    liquidAssets,
    investmentAssets,
    monthlyIncome,
    monthlyExpenses,
    savingsRate,
    debtToIncomeRatio,
    accountBreakdown,
    riskProfile,
    uweProfile,
    insights,
  };
}

/**
 * Map enriched Plaid data to UWE simulation input
 */
export function mapToUWEInput(enriched: EnrichedPlaidData): {
  age: number;
  income: number;
  horizon: number;
  savingsRate: number;
  investmentReturn: number;
  companyKey: string;
} {
  // Determine appropriate investment return based on risk profile
  const investmentReturn =
    enriched.riskProfile === "aggressive" ? 0.09 :
    enriched.riskProfile === "moderate" ? 0.07 : 0.05;

  // Determine horizon based on age (target retirement at 65)
  const horizon = Math.max(10, 65 - enriched.uweProfile.age);

  return {
    age: enriched.uweProfile.age,
    income: enriched.uweProfile.income,
    horizon,
    savingsRate: enriched.savingsRate,
    investmentReturn,
    companyKey: "nationwide", // Default; user can override
  };
}
