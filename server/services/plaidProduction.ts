/**
 * Plaid Production Webhook Handler + Transaction Categorization + Holdings Sync
 * Handles Plaid webhook events, categorizes transactions, and syncs investment holdings
 */
import { getDb } from "../db";
import { plaidWebhookLog, plaidHoldings } from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

// ─── Transaction Category Mapping (Plaid → Financial Planning) ───────────

export const TRANSACTION_CATEGORIES: Record<string, {
  planningCategory: string;
  subcategory: string;
  isEssential: boolean;
  budgetGroup: string;
}> = {
  // Housing
  "RENT": { planningCategory: "housing", subcategory: "rent", isEssential: true, budgetGroup: "fixed" },
  "MORTGAGE": { planningCategory: "housing", subcategory: "mortgage", isEssential: true, budgetGroup: "fixed" },
  "HOME_IMPROVEMENT": { planningCategory: "housing", subcategory: "maintenance", isEssential: false, budgetGroup: "variable" },
  "REAL_ESTATE": { planningCategory: "housing", subcategory: "property_tax", isEssential: true, budgetGroup: "fixed" },

  // Transportation
  "TRANSPORTATION_PUBLIC_TRANSIT": { planningCategory: "transportation", subcategory: "public_transit", isEssential: true, budgetGroup: "variable" },
  "TRANSPORTATION_TAXI": { planningCategory: "transportation", subcategory: "rideshare", isEssential: false, budgetGroup: "variable" },
  "TRANSPORTATION_GAS": { planningCategory: "transportation", subcategory: "fuel", isEssential: true, budgetGroup: "variable" },
  "TRANSPORTATION_PARKING": { planningCategory: "transportation", subcategory: "parking", isEssential: false, budgetGroup: "variable" },
  "CAR_PAYMENT": { planningCategory: "transportation", subcategory: "auto_loan", isEssential: true, budgetGroup: "fixed" },
  "CAR_INSURANCE": { planningCategory: "transportation", subcategory: "auto_insurance", isEssential: true, budgetGroup: "fixed" },

  // Food
  "FOOD_AND_DRINK_GROCERIES": { planningCategory: "food", subcategory: "groceries", isEssential: true, budgetGroup: "variable" },
  "FOOD_AND_DRINK_RESTAURANT": { planningCategory: "food", subcategory: "dining_out", isEssential: false, budgetGroup: "discretionary" },
  "FOOD_AND_DRINK_COFFEE": { planningCategory: "food", subcategory: "coffee_shops", isEssential: false, budgetGroup: "discretionary" },
  "FOOD_AND_DRINK_FAST_FOOD": { planningCategory: "food", subcategory: "fast_food", isEssential: false, budgetGroup: "discretionary" },
  "FOOD_AND_DRINK_DELIVERY": { planningCategory: "food", subcategory: "delivery", isEssential: false, budgetGroup: "discretionary" },

  // Healthcare
  "HEALTHCARE_MEDICAL": { planningCategory: "healthcare", subcategory: "medical", isEssential: true, budgetGroup: "variable" },
  "HEALTHCARE_DENTAL": { planningCategory: "healthcare", subcategory: "dental", isEssential: true, budgetGroup: "variable" },
  "HEALTHCARE_PHARMACY": { planningCategory: "healthcare", subcategory: "pharmacy", isEssential: true, budgetGroup: "variable" },
  "HEALTHCARE_VISION": { planningCategory: "healthcare", subcategory: "vision", isEssential: true, budgetGroup: "variable" },
  "HEALTH_INSURANCE": { planningCategory: "healthcare", subcategory: "insurance_premium", isEssential: true, budgetGroup: "fixed" },

  // Insurance
  "LIFE_INSURANCE": { planningCategory: "insurance", subcategory: "life_insurance", isEssential: true, budgetGroup: "fixed" },
  "HOME_INSURANCE": { planningCategory: "insurance", subcategory: "homeowners", isEssential: true, budgetGroup: "fixed" },
  "UMBRELLA_INSURANCE": { planningCategory: "insurance", subcategory: "umbrella", isEssential: false, budgetGroup: "fixed" },

  // Savings & Investments
  "TRANSFER_INVESTMENT": { planningCategory: "savings", subcategory: "investment_contribution", isEssential: false, budgetGroup: "savings" },
  "TRANSFER_SAVINGS": { planningCategory: "savings", subcategory: "savings_transfer", isEssential: false, budgetGroup: "savings" },
  "RETIREMENT_CONTRIBUTION": { planningCategory: "savings", subcategory: "retirement_contribution", isEssential: false, budgetGroup: "savings" },

  // Debt Payments
  "LOAN_STUDENT": { planningCategory: "debt", subcategory: "student_loan", isEssential: true, budgetGroup: "fixed" },
  "LOAN_PERSONAL": { planningCategory: "debt", subcategory: "personal_loan", isEssential: true, budgetGroup: "fixed" },
  "CREDIT_CARD_PAYMENT": { planningCategory: "debt", subcategory: "credit_card", isEssential: true, budgetGroup: "fixed" },

  // Utilities
  "UTILITIES_ELECTRIC": { planningCategory: "utilities", subcategory: "electric", isEssential: true, budgetGroup: "fixed" },
  "UTILITIES_GAS": { planningCategory: "utilities", subcategory: "gas", isEssential: true, budgetGroup: "fixed" },
  "UTILITIES_WATER": { planningCategory: "utilities", subcategory: "water", isEssential: true, budgetGroup: "fixed" },
  "UTILITIES_INTERNET": { planningCategory: "utilities", subcategory: "internet", isEssential: true, budgetGroup: "fixed" },
  "UTILITIES_PHONE": { planningCategory: "utilities", subcategory: "phone", isEssential: true, budgetGroup: "fixed" },

  // Entertainment & Subscriptions
  "ENTERTAINMENT": { planningCategory: "entertainment", subcategory: "general", isEssential: false, budgetGroup: "discretionary" },
  "ENTERTAINMENT_STREAMING": { planningCategory: "entertainment", subcategory: "streaming", isEssential: false, budgetGroup: "discretionary" },
  "ENTERTAINMENT_SPORTS": { planningCategory: "entertainment", subcategory: "sports", isEssential: false, budgetGroup: "discretionary" },
  "SUBSCRIPTION": { planningCategory: "entertainment", subcategory: "subscriptions", isEssential: false, budgetGroup: "discretionary" },

  // Shopping
  "SHOPPING_CLOTHING": { planningCategory: "shopping", subcategory: "clothing", isEssential: false, budgetGroup: "discretionary" },
  "SHOPPING_ELECTRONICS": { planningCategory: "shopping", subcategory: "electronics", isEssential: false, budgetGroup: "discretionary" },
  "SHOPPING_GENERAL": { planningCategory: "shopping", subcategory: "general", isEssential: false, budgetGroup: "discretionary" },

  // Education
  "EDUCATION_TUITION": { planningCategory: "education", subcategory: "tuition", isEssential: true, budgetGroup: "fixed" },
  "EDUCATION_BOOKS": { planningCategory: "education", subcategory: "books", isEssential: false, budgetGroup: "variable" },

  // Childcare
  "CHILDCARE": { planningCategory: "childcare", subcategory: "daycare", isEssential: true, budgetGroup: "fixed" },
  "CHILD_SUPPORT": { planningCategory: "childcare", subcategory: "child_support", isEssential: true, budgetGroup: "fixed" },

  // Charitable
  "CHARITABLE_DONATION": { planningCategory: "charitable", subcategory: "donations", isEssential: false, budgetGroup: "discretionary" },
  "RELIGIOUS_TITHE": { planningCategory: "charitable", subcategory: "tithe", isEssential: false, budgetGroup: "discretionary" },

  // Income
  "INCOME_SALARY": { planningCategory: "income", subcategory: "salary", isEssential: false, budgetGroup: "income" },
  "INCOME_BONUS": { planningCategory: "income", subcategory: "bonus", isEssential: false, budgetGroup: "income" },
  "INCOME_DIVIDEND": { planningCategory: "income", subcategory: "dividends", isEssential: false, budgetGroup: "income" },
  "INCOME_INTEREST": { planningCategory: "income", subcategory: "interest", isEssential: false, budgetGroup: "income" },
  "INCOME_RENTAL": { planningCategory: "income", subcategory: "rental_income", isEssential: false, budgetGroup: "income" },
  "INCOME_SOCIAL_SECURITY": { planningCategory: "income", subcategory: "social_security", isEssential: false, budgetGroup: "income" },
  "INCOME_PENSION": { planningCategory: "income", subcategory: "pension", isEssential: false, budgetGroup: "income" },

  // Tax
  "TAX_FEDERAL": { planningCategory: "taxes", subcategory: "federal_income_tax", isEssential: true, budgetGroup: "fixed" },
  "TAX_STATE": { planningCategory: "taxes", subcategory: "state_income_tax", isEssential: true, budgetGroup: "fixed" },
  "TAX_PROPERTY": { planningCategory: "taxes", subcategory: "property_tax", isEssential: true, budgetGroup: "fixed" },
};

// ─── Transaction Categorization ──────────────────────────────────────────

export interface CategorizedTransaction {
  originalCategory: string;
  planningCategory: string;
  subcategory: string;
  isEssential: boolean;
  budgetGroup: string;
  amount: number;
  merchantName: string;
  date: string;
}

export function categorizeTransaction(
  plaidCategory: string | string[],
  amount: number,
  merchantName: string,
  date: string,
): CategorizedTransaction {
  // Normalize Plaid category to our mapping key
  const categoryKey = Array.isArray(plaidCategory)
    ? plaidCategory.join("_").toUpperCase().replace(/\s+/g, "_")
    : plaidCategory.toUpperCase().replace(/\s+/g, "_");

  // Direct match
  if (TRANSACTION_CATEGORIES[categoryKey]) {
    const cat = TRANSACTION_CATEGORIES[categoryKey];
    return {
      originalCategory: categoryKey,
      ...cat,
      amount,
      merchantName,
      date,
    };
  }

  // Fuzzy match by checking partial keys
  for (const [key, cat] of Object.entries(TRANSACTION_CATEGORIES)) {
    if (categoryKey.includes(key) || key.includes(categoryKey)) {
      return {
        originalCategory: categoryKey,
        ...cat,
        amount,
        merchantName,
        date,
      };
    }
  }

  // Merchant-based heuristic
  const merchantLower = merchantName.toLowerCase();
  if (merchantLower.includes("walmart") || merchantLower.includes("target") || merchantLower.includes("costco")) {
    return { originalCategory: categoryKey, planningCategory: "shopping", subcategory: "general", isEssential: false, budgetGroup: "variable", amount, merchantName, date };
  }
  if (merchantLower.includes("amazon")) {
    return { originalCategory: categoryKey, planningCategory: "shopping", subcategory: "online", isEssential: false, budgetGroup: "discretionary", amount, merchantName, date };
  }
  if (merchantLower.includes("starbucks") || merchantLower.includes("dunkin")) {
    return { originalCategory: categoryKey, planningCategory: "food", subcategory: "coffee_shops", isEssential: false, budgetGroup: "discretionary", amount, merchantName, date };
  }

  // Default uncategorized
  return {
    originalCategory: categoryKey,
    planningCategory: "uncategorized",
    subcategory: "other",
    isEssential: false,
    budgetGroup: "discretionary",
    amount,
    merchantName,
    date,
  };
}

export function categorizeTransactions(transactions: Array<{
  category: string | string[];
  amount: number;
  merchantName: string;
  date: string;
}>): {
  categorized: CategorizedTransaction[];
  summary: Record<string, { total: number; count: number; isEssential: boolean }>;
  budgetBreakdown: Record<string, number>;
  essentialVsDiscretionary: { essential: number; discretionary: number; savings: number };
} {
  const categorized = transactions.map(t =>
    categorizeTransaction(t.category, t.amount, t.merchantName, t.date)
  );

  const summary: Record<string, { total: number; count: number; isEssential: boolean }> = {};
  const budgetBreakdown: Record<string, number> = {};
  let essential = 0, discretionary = 0, savings = 0;

  for (const t of categorized) {
    if (!summary[t.planningCategory]) {
      summary[t.planningCategory] = { total: 0, count: 0, isEssential: t.isEssential };
    }
    summary[t.planningCategory].total += Math.abs(t.amount);
    summary[t.planningCategory].count++;

    budgetBreakdown[t.budgetGroup] = (budgetBreakdown[t.budgetGroup] || 0) + Math.abs(t.amount);

    if (t.budgetGroup === "savings") savings += Math.abs(t.amount);
    else if (t.isEssential) essential += Math.abs(t.amount);
    else discretionary += Math.abs(t.amount);
  }

  return { categorized, summary, budgetBreakdown, essentialVsDiscretionary: { essential, discretionary, savings } };
}

// ─── Plaid Webhook Handler ───────────────────────────────────────────────

export type PlaidWebhookType =
  | "TRANSACTIONS" | "INVESTMENTS_TRANSACTIONS" | "HOLDINGS"
  | "AUTH" | "IDENTITY" | "ASSETS" | "LIABILITIES"
  | "ITEM" | "INCOME" | "TRANSFER";

export type PlaidWebhookCode =
  | "INITIAL_UPDATE" | "HISTORICAL_UPDATE" | "DEFAULT_UPDATE" | "TRANSACTIONS_REMOVED"
  | "SYNC_UPDATES_AVAILABLE" | "RECURRING_TRANSACTIONS_UPDATE"
  | "WEBHOOK_UPDATE_ACKNOWLEDGED" | "PENDING_EXPIRATION" | "ERROR"
  | "LOGIN_REPAIRED" | "NEW_ACCOUNTS_AVAILABLE";

export interface PlaidWebhookEvent {
  webhook_type: PlaidWebhookType;
  webhook_code: PlaidWebhookCode;
  item_id: string;
  error?: { error_code: string; error_message: string };
  new_transactions?: number;
  removed_transactions?: string[];
  consent_expiration_time?: string;
}

export interface WebhookProcessResult {
  action: string;
  success: boolean;
  details: string;
  requiresUserAction: boolean;
}

export async function processPlaidWebhook(event: PlaidWebhookEvent): Promise<WebhookProcessResult> {
  const db = await getDb();

  // Log the webhook
  if (db) {
    try {
      await db.insert(plaidWebhookLog).values({
        itemId: event.item_id,
        webhookType: event.webhook_type,
        webhookCode: event.webhook_code,
        errorCode: event.error?.error_code ?? null,
        processedAt: Date.now(),
      });
    } catch (e) {
      console.error("[PlaidWebhook] Log error:", e);
    }
  }

  switch (event.webhook_type) {
    case "TRANSACTIONS":
      return handleTransactionWebhook(event);
    case "HOLDINGS":
      return handleHoldingsWebhook(event);
    case "ITEM":
      return handleItemWebhook(event);
    case "INVESTMENTS_TRANSACTIONS":
      return handleInvestmentTransactionWebhook(event);
    default:
      return {
        action: "logged",
        success: true,
        details: `Webhook type ${event.webhook_type}/${event.webhook_code} logged but no handler configured`,
        requiresUserAction: false,
      };
  }
}

function handleTransactionWebhook(event: PlaidWebhookEvent): WebhookProcessResult {
  switch (event.webhook_code) {
    case "SYNC_UPDATES_AVAILABLE":
      return {
        action: "sync_transactions",
        success: true,
        details: `Transaction sync available for item ${event.item_id}. Triggering incremental sync.`,
        requiresUserAction: false,
      };
    case "INITIAL_UPDATE":
      return {
        action: "initial_transaction_load",
        success: true,
        details: `Initial transaction data available for item ${event.item_id}. ${event.new_transactions ?? 0} new transactions.`,
        requiresUserAction: false,
      };
    case "HISTORICAL_UPDATE":
      return {
        action: "historical_transaction_load",
        success: true,
        details: `Historical transaction data available for item ${event.item_id}.`,
        requiresUserAction: false,
      };
    case "DEFAULT_UPDATE":
      return {
        action: "default_transaction_update",
        success: true,
        details: `New transactions available for item ${event.item_id}. ${event.new_transactions ?? 0} new transactions.`,
        requiresUserAction: false,
      };
    case "TRANSACTIONS_REMOVED":
      return {
        action: "remove_transactions",
        success: true,
        details: `${event.removed_transactions?.length ?? 0} transactions removed for item ${event.item_id}.`,
        requiresUserAction: false,
      };
    default:
      return {
        action: "unknown_transaction_event",
        success: true,
        details: `Unknown transaction webhook code: ${event.webhook_code}`,
        requiresUserAction: false,
      };
  }
}

function handleHoldingsWebhook(event: PlaidWebhookEvent): WebhookProcessResult {
  return {
    action: "sync_holdings",
    success: true,
    details: `Holdings update for item ${event.item_id}. Triggering holdings sync.`,
    requiresUserAction: false,
  };
}

function handleItemWebhook(event: PlaidWebhookEvent): WebhookProcessResult {
  switch (event.webhook_code) {
    case "ERROR":
      return {
        action: "item_error",
        success: false,
        details: `Item error for ${event.item_id}: ${event.error?.error_message ?? "Unknown error"}. User may need to re-authenticate.`,
        requiresUserAction: true,
      };
    case "PENDING_EXPIRATION":
      return {
        action: "consent_expiring",
        success: true,
        details: `Consent expiring for item ${event.item_id} at ${event.consent_expiration_time}. User must re-authenticate.`,
        requiresUserAction: true,
      };
    case "LOGIN_REPAIRED":
      return {
        action: "login_repaired",
        success: true,
        details: `Login repaired for item ${event.item_id}. Data sync will resume automatically.`,
        requiresUserAction: false,
      };
    case "NEW_ACCOUNTS_AVAILABLE":
      return {
        action: "new_accounts",
        success: true,
        details: `New accounts detected for item ${event.item_id}. User may want to link additional accounts.`,
        requiresUserAction: true,
      };
    default:
      return {
        action: "unknown_item_event",
        success: true,
        details: `Unknown item webhook code: ${event.webhook_code}`,
        requiresUserAction: false,
      };
  }
}

function handleInvestmentTransactionWebhook(event: PlaidWebhookEvent): WebhookProcessResult {
  return {
    action: "sync_investment_transactions",
    success: true,
    details: `Investment transaction update for item ${event.item_id}. Triggering investment sync.`,
    requiresUserAction: false,
  };
}

// ─── Holdings Sync ───────────────────────────────────────────────────────

export interface HoldingData {
  accountId: string;
  securityId: string;
  ticker: string;
  name: string;
  quantity: number;
  costBasis: number;
  currentValue: number;
}

export async function syncHoldings(userId: number, holdings: HoldingData[]): Promise<{
  synced: number;
  errors: number;
}> {
  const db = await getDb();
  if (!db) return { synced: 0, errors: 0 };

  let synced = 0, errors = 0;

  for (const h of holdings) {
    try {
      // Upsert: check if holding exists
      const existing = await db.select()
        .from(plaidHoldings)
        .where(and(
          eq(plaidHoldings.userId, userId),
          eq(plaidHoldings.accountId, h.accountId),
          eq(plaidHoldings.securityId, h.securityId),
        ))
        .limit(1);

      if (existing.length > 0) {
        await db.update(plaidHoldings)
          .set({
            ticker: h.ticker,
            name: h.name,
            quantity: h.quantity.toString(),
            costBasis: h.costBasis.toString(),
            currentValue: h.currentValue.toString(),
            lastSynced: Date.now(),
          })
          .where(eq(plaidHoldings.id, existing[0].id));
      } else {
        await db.insert(plaidHoldings).values({
          userId,
          accountId: h.accountId,
          securityId: h.securityId,
          ticker: h.ticker,
          name: h.name,
          quantity: h.quantity.toString(),
          costBasis: h.costBasis.toString(),
          currentValue: h.currentValue.toString(),
          lastSynced: Date.now(),
        });
      }
      synced++;
    } catch (e: any) {
      console.error("[Holdings] Sync error:", e?.message);
      errors++;
    }
  }

  return { synced, errors };
}

export async function getHoldingsForUser(userId: number): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(plaidHoldings).where(eq(plaidHoldings.userId, userId));
}

export async function getPortfolioSummary(userId: number): Promise<{
  totalValue: number;
  totalCostBasis: number;
  totalGainLoss: number;
  gainLossPercent: number;
  holdingsCount: number;
  assetAllocation: Record<string, number>;
}> {
  const holdings = await getHoldingsForUser(userId);

  let totalValue = 0, totalCostBasis = 0;
  const assetAllocation: Record<string, number> = {};

  for (const h of holdings) {
    const value = parseFloat(h.currentValue ?? "0");
    const cost = parseFloat(h.costBasis ?? "0");
    totalValue += value;
    totalCostBasis += cost;

    // Simple asset class heuristic based on ticker
    const ticker = (h.ticker ?? "").toUpperCase();
    let assetClass = "other";
    if (ticker.includes("AGG") || ticker.includes("BND") || ticker.includes("TLT")) assetClass = "bonds";
    else if (ticker.includes("VTI") || ticker.includes("SPY") || ticker.includes("QQQ")) assetClass = "us_equity";
    else if (ticker.includes("VXUS") || ticker.includes("EFA") || ticker.includes("EEM")) assetClass = "intl_equity";
    else if (ticker.includes("VNQ") || ticker.includes("REIT")) assetClass = "real_estate";
    else if (ticker.includes("GLD") || ticker.includes("SLV")) assetClass = "commodities";
    else assetClass = "us_equity"; // default

    assetAllocation[assetClass] = (assetAllocation[assetClass] || 0) + value;
  }

  const totalGainLoss = totalValue - totalCostBasis;
  const gainLossPercent = totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0;

  return {
    totalValue: parseFloat(totalValue.toFixed(2)),
    totalCostBasis: parseFloat(totalCostBasis.toFixed(2)),
    totalGainLoss: parseFloat(totalGainLoss.toFixed(2)),
    gainLossPercent: parseFloat(gainLossPercent.toFixed(2)),
    holdingsCount: holdings.length,
    assetAllocation,
  };
}

// ─── Webhook Log Queries ─────────────────────────────────────────────────

export async function getWebhookLog(itemId?: string, limit: number = 50): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions = itemId ? [eq(plaidWebhookLog.itemId, itemId)] : [];

  if (conditions.length > 0) {
    return db.select().from(plaidWebhookLog).where(and(...conditions)).limit(limit);
  }
  return db.select().from(plaidWebhookLog).limit(limit);
}
