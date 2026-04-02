/**
 * Provider Service Classes
 * 
 * Abstract base + concrete implementations for each integration provider tier.
 * Each provider handles: authentication, data fetching, normalization, and error handling.
 * 
 * Provider Tiers:
 * - Platform: FRED, BLS, Census, SEC, BEA, FINRA (handled in platformPipelines.ts)
 * - Organization: Salesforce, Redtail, Wealthbox, RIA Compliance
 * - Professional: Riskalyze, MoneyGuidePro, eMoney, Morningstar, Orion
 * - Client: Plaid, Yodlee, MX, manual upload, carrier import
 */

import { getDb } from "../db";
import { integrationConnections, integrationSyncLogs, enrichmentCache } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt } from "./encryption";
import crypto from "crypto";

const uuid = () => crypto.randomUUID();

// ─── Abstract Provider Base ────────────────────────────────────────────
export interface ProviderConfig {
  connectionId: string;
  credentials: Record<string, unknown>;
  config?: Record<string, unknown>;
  userId: number;
}

export interface SyncResult {
  success: boolean;
  records: number;
  errors: string[];
  data?: Record<string, unknown>[];
}

export abstract class BaseProvider {
  abstract slug: string;
  abstract tier: "platform" | "organization" | "professional" | "client";
  
  abstract validateCredentials(credentials: Record<string, unknown>): Promise<boolean>;
  abstract fetchData(config: ProviderConfig): Promise<SyncResult>;
  abstract normalizeData(rawData: unknown[]): Record<string, unknown>[];

  async sync(config: ProviderConfig): Promise<SyncResult> {
    const db = await getDb(); if (!db) return null as any;
    const startedAt = new Date();
    const syncId = uuid();

    try {
      // Log sync start
      await db.insert(integrationSyncLogs).values({
        id: syncId,
        connectionId: config.connectionId,
        syncType: "incremental" as const,
        direction: "inbound" as const,
        status: "running" as const,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsFailed: 0,
        triggeredBy: "manual" as const,
        startedAt,
      });

      const result = await this.fetchData(config);

      // Update sync log
      await db.update(integrationSyncLogs)
        .set({
          status: result.success ? ("success" as const) : ("partial" as const),
          recordsCreated: result.records,
          errorDetails: result.errors.length > 0 ? result.errors : null,
          completedAt: new Date(),
        })
        .where(eq(integrationSyncLogs.id, syncId));

      // Update connection last sync
      await db.update(integrationConnections)
        .set({
          lastSyncAt: new Date(),
          status: result.success ? ("connected" as const) : ("error" as const),
          lastSyncError: result.errors[0] || null,
        })
        .where(eq(integrationConnections.id, config.connectionId));

      return result;
    } catch (e: any) {
      await db.update(integrationSyncLogs)
        .set({
          status: "failed" as const,
          errorDetails: [e.message],
          completedAt: new Date(),
        })
        .where(eq(integrationSyncLogs.id, syncId));

      await db.update(integrationConnections)
        .set({
          status: "error" as const,
          lastSyncError: e.message,
        })
        .where(eq(integrationConnections.id, config.connectionId));

      return { success: false, records: 0, errors: [e.message] };
    }
  }
}

// ─── Plaid Provider (Client Tier) ──────────────────────────────────────
// Bank accounts, transactions, investments, liabilities
export class PlaidProvider extends BaseProvider {
  slug = "plaid";
  tier = "client" as const;

  async validateCredentials(credentials: Record<string, unknown>): Promise<boolean> {
    const clientId = credentials.client_id as string;
    const secret = credentials.secret as string;
    return !!(clientId && secret);
  }

  async fetchData(config: ProviderConfig): Promise<SyncResult> {
    const { credentials } = config;
    const clientId = credentials.client_id as string;
    const secret = credentials.secret as string;
    const accessToken = credentials.access_token as string;
    const environment = (credentials.environment as string) || "sandbox";

    const baseUrl = environment === "production"
      ? "https://production.plaid.com"
      : environment === "development"
        ? "https://development.plaid.com"
        : "https://sandbox.plaid.com";

    const records: Record<string, unknown>[] = [];
    const errors: string[] = [];

    if (!accessToken) {
      return { success: false, records: 0, errors: ["No access token. User must complete Plaid Link flow first."] };
    }

    // Fetch accounts
    try {
      const resp = await fetch(`${baseUrl}/accounts/get`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, secret, access_token: accessToken }),
        signal: AbortSignal.timeout(15000),
      });
      if (resp.ok) {
        const data = await resp.json();
        for (const acct of (data.accounts || [])) {
          records.push(this.normalizeAccount(acct));
        }
      } else {
        const err = await resp.json().catch(() => ({}));
        errors.push(`Accounts: ${(err as any).error_message || resp.status}`);
      }
    } catch (e: any) {
      errors.push(`Accounts: ${e.message}`);
    }

    // Fetch recent transactions (last 30 days)
    try {
      const endDate = new Date().toISOString().split("T")[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      
      const resp = await fetch(`${baseUrl}/transactions/get`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId, secret, access_token: accessToken,
          start_date: startDate, end_date: endDate,
          options: { count: 100, offset: 0 },
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (resp.ok) {
        const data = await resp.json();
        for (const txn of (data.transactions || [])) {
          records.push(this.normalizeTransaction(txn));
        }
      }
    } catch (e: any) {
      errors.push(`Transactions: ${e.message}`);
    }

    // Fetch investment holdings
    try {
      const resp = await fetch(`${baseUrl}/investments/holdings/get`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, secret, access_token: accessToken }),
        signal: AbortSignal.timeout(15000),
      });
      if (resp.ok) {
        const data = await resp.json();
        for (const holding of (data.holdings || [])) {
          records.push(this.normalizeHolding(holding, data.securities || []));
        }
      }
    } catch (e: any) {
      // Investment data is optional (not all accounts have it)
    }

    // Fetch liabilities
    try {
      const resp = await fetch(`${baseUrl}/liabilities/get`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, secret, access_token: accessToken }),
        signal: AbortSignal.timeout(15000),
      });
      if (resp.ok) {
        const data = await resp.json();
        const liabilities = data.liabilities || {};
        for (const mortgage of (liabilities.mortgage || [])) {
          records.push({ type: "liability", subtype: "mortgage", ...mortgage });
        }
        for (const student of (liabilities.student || [])) {
          records.push({ type: "liability", subtype: "student_loan", ...student });
        }
        for (const credit of (liabilities.credit || [])) {
          records.push({ type: "liability", subtype: "credit_card", ...credit });
        }
      }
    } catch (e: any) {
      // Liabilities are optional
    }

    // Cache normalized data
    const db = await getDb(); if (!db) return null as any;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 4);

    await db.insert(enrichmentCache).values({
      id: uuid(),
      providerSlug: "plaid",
      lookupKey: `user:${config.userId}`,
      lookupType: "financial_data",
      resultJson: { accounts: records.filter(r => r.type === "account"), transactions: records.filter(r => r.type === "transaction"), holdings: records.filter(r => r.type === "holding"), liabilities: records.filter(r => r.type === "liability") },
      fetchedAt: new Date(),
      expiresAt,
    }).onDuplicateKeyUpdate({
      set: { resultJson: { accounts: records.filter(r => r.type === "account"), transactions: records.filter(r => r.type === "transaction") }, fetchedAt: new Date(), expiresAt },
    });

    return { success: errors.length === 0, records: records.length, errors, data: records };
  }

  normalizeData(rawData: unknown[]): Record<string, unknown>[] {
    return rawData as Record<string, unknown>[];
  }

  private normalizeAccount(acct: any): Record<string, unknown> {
    return {
      type: "account",
      accountId: acct.account_id,
      name: acct.name,
      officialName: acct.official_name,
      accountType: acct.type,
      subtype: acct.subtype,
      currentBalance: acct.balances?.current,
      availableBalance: acct.balances?.available,
      currency: acct.balances?.iso_currency_code || "USD",
      mask: acct.mask,
    };
  }

  private normalizeTransaction(txn: any): Record<string, unknown> {
    return {
      type: "transaction",
      transactionId: txn.transaction_id,
      accountId: txn.account_id,
      amount: txn.amount,
      date: txn.date,
      name: txn.name,
      merchantName: txn.merchant_name,
      category: txn.category,
      pending: txn.pending,
      currency: txn.iso_currency_code || "USD",
    };
  }

  private normalizeHolding(holding: any, securities: any[]): Record<string, unknown> {
    const security = securities.find((s: any) => s.security_id === holding.security_id);
    return {
      type: "holding",
      accountId: holding.account_id,
      securityId: holding.security_id,
      ticker: security?.ticker_symbol,
      name: security?.name,
      quantity: holding.quantity,
      costBasis: holding.cost_basis,
      currentValue: holding.institution_value,
      price: holding.institution_price,
      priceDate: holding.institution_price_as_of,
      securityType: security?.type,
    };
  }
}

// ─── MX Provider (Client Tier) ─────────────────────────────────────────
// Alternative aggregator — accounts, transactions, holdings
export class MXProvider extends BaseProvider {
  slug = "mx";
  tier = "client" as const;

  async validateCredentials(credentials: Record<string, unknown>): Promise<boolean> {
    return !!(credentials.api_key && credentials.client_id);
  }

  async fetchData(config: ProviderConfig): Promise<SyncResult> {
    const { credentials } = config;
    const apiKey = credentials.api_key as string;
    const clientId = credentials.client_id as string;
    const memberGuid = credentials.member_guid as string;
    const userGuid = credentials.user_guid as string;
    const environment = (credentials.environment as string) || "sandbox";

    const baseUrl = environment === "production"
      ? "https://api.mx.com"
      : "https://int-api.mx.com";

    const headers = {
      "Accept": "application/vnd.mx.api.v1+json",
      "Content-Type": "application/json",
      "Authorization": `Basic ${Buffer.from(`${clientId}:${apiKey}`).toString("base64")}`,
    };

    const records: Record<string, unknown>[] = [];
    const errors: string[] = [];

    if (!userGuid) {
      return { success: false, records: 0, errors: ["No user GUID. User must complete MX Connect widget flow first."] };
    }

    // Fetch accounts
    try {
      const resp = await fetch(`${baseUrl}/users/${userGuid}/accounts`, {
        headers,
        signal: AbortSignal.timeout(15000),
      });
      if (resp.ok) {
        const data = await resp.json();
        for (const acct of (data.accounts || [])) {
          records.push({
            type: "account",
            accountId: acct.guid,
            name: acct.name,
            accountType: acct.type,
            subtype: acct.subtype,
            currentBalance: acct.balance,
            availableBalance: acct.available_balance,
            currency: acct.currency_code || "USD",
            institution: acct.institution_code,
          });
        }
      } else {
        errors.push(`MX Accounts: HTTP ${resp.status}`);
      }
    } catch (e: any) {
      errors.push(`MX Accounts: ${e.message}`);
    }

    // Fetch transactions
    try {
      const resp = await fetch(`${baseUrl}/users/${userGuid}/transactions?page=1&records_per_page=100`, {
        headers,
        signal: AbortSignal.timeout(30000),
      });
      if (resp.ok) {
        const data = await resp.json();
        for (const txn of (data.transactions || [])) {
          records.push({
            type: "transaction",
            transactionId: txn.guid,
            accountId: txn.account_guid,
            amount: txn.amount,
            date: txn.transacted_at || txn.posted_at,
            name: txn.description,
            merchantName: txn.merchant_name,
            category: txn.category,
            status: txn.status,
          });
        }
      }
    } catch (e: any) {
      errors.push(`MX Transactions: ${e.message}`);
    }

    return { success: errors.length === 0, records: records.length, errors, data: records };
  }

  normalizeData(rawData: unknown[]): Record<string, unknown>[] {
    return rawData as Record<string, unknown>[];
  }
}

// ─── Morningstar Provider (Professional Tier) ──────────────────────────
// Investment research, fund analysis, portfolio analytics
export class MorningstarProvider extends BaseProvider {
  slug = "morningstar";
  tier = "professional" as const;

  async validateCredentials(credentials: Record<string, unknown>): Promise<boolean> {
    return !!(credentials.api_key);
  }

  async fetchData(config: ProviderConfig): Promise<SyncResult> {
    const { credentials } = config;
    const apiKey = credentials.api_key as string;
    const tickers = (config.config?.tickers as string[]) || [];
    
    const records: Record<string, unknown>[] = [];
    const errors: string[] = [];

    // Fetch fund/ETF data for each ticker
    for (const ticker of tickers.slice(0, 20)) {
      try {
        // Morningstar API endpoint (simplified — real API requires OAuth)
        const resp = await fetch(`https://api.morningstar.com/v2/search/securities?q=${ticker}`, {
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Accept": "application/json",
          },
          signal: AbortSignal.timeout(10000),
        });

        if (resp.ok) {
          const data = await resp.json();
          const results = data.results || data.securities || [];
          for (const sec of results.slice(0, 3)) {
            records.push({
              type: "security_research",
              ticker,
              name: sec.name,
              morningstarRating: sec.starRating,
              category: sec.category,
              expenseRatio: sec.expenseRatio,
              ytdReturn: sec.ytdReturn,
              riskLevel: sec.riskLevel,
              analystRating: sec.analystRating,
            });
          }
        }
      } catch (e: any) {
        errors.push(`Morningstar ${ticker}: ${e.message}`);
      }
    }

    return { success: errors.length === 0, records: records.length, errors, data: records };
  }

  normalizeData(rawData: unknown[]): Record<string, unknown>[] {
    return rawData as Record<string, unknown>[];
  }
}

// ─── Redtail CRM Provider (Organization Tier) ─────────────────────────
// CRM data: contacts, activities, workflows
export class RedtailProvider extends BaseProvider {
  slug = "redtail";
  tier = "organization" as const;

  async validateCredentials(credentials: Record<string, unknown>): Promise<boolean> {
    return !!(credentials.api_key && credentials.user_key);
  }

  async fetchData(config: ProviderConfig): Promise<SyncResult> {
    const { credentials } = config;
    const apiKey = credentials.api_key as string;
    const userKey = credentials.user_key as string;

    const headers = {
      "Authorization": `Userkeyauth ${userKey}`,
      "Content-Type": "application/json",
    };

    const records: Record<string, unknown>[] = [];
    const errors: string[] = [];

    // Fetch contacts
    try {
      const resp = await fetch("https://smf.crm3.redtailtechnology.com/api/public/v1/contacts", {
        headers,
        signal: AbortSignal.timeout(15000),
      });
      if (resp.ok) {
        const data = await resp.json();
        for (const contact of (data.contacts || data || []).slice(0, 100)) {
          records.push({
            type: "crm_contact",
            contactId: contact.id,
            name: `${contact.first_name} ${contact.last_name}`,
            email: contact.email,
            phone: contact.phone,
            status: contact.status,
            category: contact.category_id,
            lastActivity: contact.last_activity_date,
          });
        }
      } else {
        errors.push(`Redtail Contacts: HTTP ${resp.status}`);
      }
    } catch (e: any) {
      errors.push(`Redtail: ${e.message}`);
    }

    return { success: errors.length === 0, records: records.length, errors, data: records };
  }

  normalizeData(rawData: unknown[]): Record<string, unknown>[] {
    return rawData as Record<string, unknown>[];
  }
}

// ─── Manual Upload Provider (Client Tier) ──────────────────────────────
// CSV/Excel statement uploads, carrier data imports
export class ManualUploadProvider extends BaseProvider {
  slug = "manual-upload";
  tier = "client" as const;

  async validateCredentials(_credentials: Record<string, unknown>): Promise<boolean> {
    return true; // No credentials needed for manual upload
  }

  async fetchData(config: ProviderConfig): Promise<SyncResult> {
    // Manual uploads are handled by the data ingestion router
    // This provider just normalizes uploaded data
    const data = config.config?.uploadedData as Record<string, unknown>[] || [];
    const normalized = this.normalizeData(data);
    return { success: true, records: normalized.length, errors: [], data: normalized };
  }

  normalizeData(rawData: unknown[]): Record<string, unknown>[] {
    return (rawData as Record<string, unknown>[]).map(row => ({
      type: "manual_entry",
      ...row,
      importedAt: new Date().toISOString(),
    }));
  }
}

// ─── Carrier Import Provider (Client Tier) ─────────────────────────────
// Insurance carrier statement parsing
export class CarrierImportProvider extends BaseProvider {
  slug = "carrier-import";
  tier = "client" as const;

  // Supported carrier templates
  static CARRIERS = {
    "nationwide": { name: "Nationwide", fields: ["policy_number", "type", "premium", "death_benefit", "cash_value", "surrender_value", "loan_balance"] },
    "pacific-life": { name: "Pacific Life", fields: ["contract_number", "product", "account_value", "surrender_value", "death_benefit", "premium_paid"] },
    "lincoln-financial": { name: "Lincoln Financial", fields: ["policy_id", "product_name", "face_amount", "cash_value", "premium", "status"] },
    "transamerica": { name: "Transamerica", fields: ["policy_number", "plan", "face_amount", "cash_value", "annual_premium", "status"] },
    "john-hancock": { name: "John Hancock", fields: ["policy_number", "product", "death_benefit", "cash_value", "premium", "loan_outstanding"] },
    "prudential": { name: "Prudential", fields: ["contract_number", "product_type", "face_amount", "account_value", "premium", "status"] },
    "metlife": { name: "MetLife", fields: ["policy_number", "coverage_type", "face_amount", "cash_value", "premium", "beneficiary"] },
  };

  async validateCredentials(_credentials: Record<string, unknown>): Promise<boolean> {
    return true;
  }

  async fetchData(config: ProviderConfig): Promise<SyncResult> {
    const carrierSlug = config.config?.carrier as string;
    const uploadedData = config.config?.uploadedData as Record<string, unknown>[] || [];
    
    if (!carrierSlug || !CarrierImportProvider.CARRIERS[carrierSlug as keyof typeof CarrierImportProvider.CARRIERS]) {
      return { success: false, records: 0, errors: [`Unknown carrier: ${carrierSlug}`] };
    }

    const carrier = CarrierImportProvider.CARRIERS[carrierSlug as keyof typeof CarrierImportProvider.CARRIERS];
    const normalized = uploadedData.map(row => ({
      type: "insurance_policy",
      carrier: carrier.name,
      carrierSlug,
      ...row,
      importedAt: new Date().toISOString(),
    }));

    return { success: true, records: normalized.length, errors: [], data: normalized };
  }

  normalizeData(rawData: unknown[]): Record<string, unknown>[] {
    return rawData as Record<string, unknown>[];
  }
}

// ─── Provider Registry ─────────────────────────────────────────────────
const providerRegistry: Map<string, BaseProvider> = new Map();

export function getProvider(slug: string): BaseProvider | undefined {
  return providerRegistry.get(slug);
}

export function getAllProviders(): Map<string, BaseProvider> {
  return providerRegistry;
}

// Register all providers
function initProviders() {
  const providers: BaseProvider[] = [
    new PlaidProvider(),
    new MXProvider(),
    new MorningstarProvider(),
    new RedtailProvider(),
    new ManualUploadProvider(),
    new CarrierImportProvider(),
  ];

  for (const p of providers) {
    providerRegistry.set(p.slug, p);
  }
}

initProviders();
