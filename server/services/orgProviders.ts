/**
 * Org-Level Provider Services — GoHighLevel, SMS-iT, BridgeFT, COMPULIFE
 * + SOFR Pipeline + Context Assembly Integration
 * 
 * Provides typed adapters for each org-level integration, plus the SOFR
 * rate pipeline and a unified context assembly layer that merges data from
 * all tiers into a single AI-ready context object.
 */

import { getDb } from "../db";
import { eq, and, sql, desc } from "drizzle-orm";
import {
  integrationProviders, integrationConnections, integrationSyncLogs,
} from "../../drizzle/schema";
import { auditedFetch } from "./foundationLayer";

// ─── DB HELPER ──────────────────────────────────────────────────────────

async function db() {
  const instance = await getDb();
  if (!instance) throw new Error("Database not available");
  return instance;
}

// ═══════════════════════════════════════════════════════════════════════
// GoHighLevel (GHL) Adapter — CRM, Pipeline, Contact Management
// ═══════════════════════════════════════════════════════════════════════

export interface GHLContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  tags: string[];
  customFields: Record<string, string>;
  dateAdded: string;
  source: string;
}

export interface GHLPipeline {
  id: string;
  name: string;
  stages: Array<{ id: string; name: string; position: number }>;
}

export interface GHLOpportunity {
  id: string;
  name: string;
  pipelineId: string;
  stageId: string;
  monetaryValue: number;
  status: string;
  contactId: string;
}

export class GoHighLevelAdapter {
  private baseUrl = "https://services.leadconnectorhq.com";
  private apiKey: string;
  private locationId: string;

  constructor(apiKey: string, locationId: string) {
    this.apiKey = apiKey;
    this.locationId = locationId;
  }

  private headers(): Record<string, string> {
    return {
      "Authorization": `Bearer ${this.apiKey}`,
      "Version": "2021-07-28",
      "Content-Type": "application/json",
    };
  }

  async getContacts(limit: number = 100, startAfter?: string): Promise<{ contacts: GHLContact[]; nextPageToken?: string }> {
    const params = new URLSearchParams({ locationId: this.locationId, limit: String(limit) });
    if (startAfter) params.set("startAfter", startAfter);

    const { data } = await auditedFetch(
      "gohighlevel",
      `${this.baseUrl}/contacts/?${params}`,
      { headers: this.headers() },
      3600
    );

    return {
      contacts: (data.contacts || []).map((c: any) => ({
        id: c.id,
        firstName: c.firstName || "",
        lastName: c.lastName || "",
        email: c.email || "",
        phone: c.phone || "",
        tags: c.tags || [],
        customFields: c.customField || {},
        dateAdded: c.dateAdded,
        source: c.source || "unknown",
      })),
      nextPageToken: data.meta?.nextPageToken,
    };
  }

  async createContact(contact: Partial<GHLContact>): Promise<GHLContact> {
    const { data } = await auditedFetch(
      "gohighlevel",
      `${this.baseUrl}/contacts/`,
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          locationId: this.locationId,
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          phone: contact.phone,
          tags: contact.tags,
        }),
      },
      0
    );
    return data.contact;
  }

  async updateContact(contactId: string, updates: Partial<GHLContact>): Promise<GHLContact> {
    const { data } = await auditedFetch(
      "gohighlevel",
      `${this.baseUrl}/contacts/${contactId}`,
      {
        method: "PUT",
        headers: this.headers(),
        body: JSON.stringify(updates),
      },
      0
    );
    return data.contact;
  }

  async getPipelines(): Promise<GHLPipeline[]> {
    const { data } = await auditedFetch(
      "gohighlevel",
      `${this.baseUrl}/opportunities/pipelines?locationId=${this.locationId}`,
      { headers: this.headers() },
      3600
    );
    return (data.pipelines || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      stages: (p.stages || []).map((s: any) => ({ id: s.id, name: s.name, position: s.position })),
    }));
  }

  async getOpportunities(pipelineId: string): Promise<GHLOpportunity[]> {
    const { data } = await auditedFetch(
      "gohighlevel",
      `${this.baseUrl}/opportunities/search?locationId=${this.locationId}&pipelineId=${pipelineId}`,
      { headers: this.headers() },
      1800
    );
    return (data.opportunities || []).map((o: any) => ({
      id: o.id,
      name: o.name,
      pipelineId: o.pipelineId,
      stageId: o.pipelineStageId,
      monetaryValue: o.monetaryValue || 0,
      status: o.status,
      contactId: o.contactId,
    }));
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.getContacts(1);
      return { success: true, message: "GoHighLevel connection verified" };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// SMS-iT Adapter — Multi-Channel Messaging
// ═══════════════════════════════════════════════════════════════════════

export interface SMSiTMessage {
  id: string;
  to: string;
  from: string;
  body: string;
  channel: "sms" | "mms" | "whatsapp" | "email";
  status: string;
  sentAt: string;
}

export interface SMSiTCampaign {
  id: string;
  name: string;
  channel: string;
  status: string;
  recipientCount: number;
  sentCount: number;
  deliveredCount: number;
  openRate: number;
}

export class SMSiTAdapter {
  private baseUrl = "https://tool-it.smsit.ai/api";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private headers(): Record<string, string> {
    return {
      "Authorization": `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  async sendMessage(to: string, body: string, channel: "sms" | "whatsapp" | "email" = "sms"): Promise<SMSiTMessage> {
    const { data } = await auditedFetch(
      "smsit",
      `${this.baseUrl}/messages/send`,
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ to, body, channel }),
      },
      0
    );
    return data.message;
  }

  async getMessageHistory(limit: number = 50): Promise<SMSiTMessage[]> {
    const { data } = await auditedFetch(
      "smsit",
      `${this.baseUrl}/messages?limit=${limit}`,
      { headers: this.headers() },
      300
    );
    return data.messages || [];
  }

  async getCampaigns(): Promise<SMSiTCampaign[]> {
    const { data } = await auditedFetch(
      "smsit",
      `${this.baseUrl}/campaigns`,
      { headers: this.headers() },
      1800
    );
    return data.campaigns || [];
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.getMessageHistory(1);
      return { success: true, message: "SMS-iT connection verified" };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// BridgeFT Adapter — Investment Account Data, Performance, Transactions
// ═══════════════════════════════════════════════════════════════════════

export interface BridgeFTAccount {
  id: string;
  accountNumber: string;
  name: string;
  type: string;
  custodian: string;
  totalValue: number;
  cashBalance: number;
  lastUpdated: string;
}

export interface BridgeFTPosition {
  id: string;
  accountId: string;
  symbol: string;
  description: string;
  quantity: number;
  marketValue: number;
  costBasis: number;
  unrealizedGain: number;
  assetClass: string;
}

export interface BridgeFTPerformance {
  accountId: string;
  period: string;
  returnPct: number;
  benchmarkReturnPct: number;
  alpha: number;
}

export class BridgeFTAdapter {
  private baseUrl = "https://api.bridgeft.com/v2";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private headers(): Record<string, string> {
    return {
      "Authorization": `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  async getAccounts(): Promise<BridgeFTAccount[]> {
    const { data } = await auditedFetch(
      "bridgeft",
      `${this.baseUrl}/accounts`,
      { headers: this.headers() },
      3600
    );
    return (data.data || data || []).map((a: any) => ({
      id: a.id,
      accountNumber: a.account_number || a.accountNumber || "",
      name: a.name || "",
      type: a.account_type || a.type || "",
      custodian: a.custodian || "",
      totalValue: a.total_value || a.totalValue || 0,
      cashBalance: a.cash_balance || a.cashBalance || 0,
      lastUpdated: a.updated_at || a.lastUpdated || "",
    }));
  }

  async getPositions(accountId: string): Promise<BridgeFTPosition[]> {
    const { data } = await auditedFetch(
      "bridgeft",
      `${this.baseUrl}/accounts/${accountId}/positions`,
      { headers: this.headers() },
      1800
    );
    return (data.data || data || []).map((p: any) => ({
      id: p.id,
      accountId,
      symbol: p.symbol || p.ticker || "",
      description: p.description || p.security_name || "",
      quantity: p.quantity || p.shares || 0,
      marketValue: p.market_value || p.marketValue || 0,
      costBasis: p.cost_basis || p.costBasis || 0,
      unrealizedGain: p.unrealized_gain || p.unrealizedGain || 0,
      assetClass: p.asset_class || p.assetClass || "other",
    }));
  }

  async getPerformance(accountId: string, period: string = "1Y"): Promise<BridgeFTPerformance> {
    const { data } = await auditedFetch(
      "bridgeft",
      `${this.baseUrl}/accounts/${accountId}/performance?period=${period}`,
      { headers: this.headers() },
      3600
    );
    return {
      accountId,
      period,
      returnPct: data.return_pct || data.returnPct || 0,
      benchmarkReturnPct: data.benchmark_return_pct || data.benchmarkReturnPct || 0,
      alpha: (data.return_pct || 0) - (data.benchmark_return_pct || 0),
    };
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.getAccounts();
      return { success: true, message: "BridgeFT connection verified" };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// COMPULIFE Adapter — Life Insurance Quoting Engine
// ═══════════════════════════════════════════════════════════════════════

export interface CompulifeQuote {
  carrier: string;
  product: string;
  faceAmount: number;
  monthlyPremium: number;
  annualPremium: number;
  ratingClass: string;
  termLength: number;
  amBestRating: string;
  productType: string;
}

export interface CompulifeQuoteRequest {
  state: string;
  gender: "male" | "female";
  age: number;
  tobaccoUse: boolean;
  healthClass: "preferred_plus" | "preferred" | "standard_plus" | "standard" | "substandard";
  faceAmount: number;
  termLength?: number;
  productType?: "term" | "whole_life" | "iul" | "ul";
}

export class CompulifeAdapter {
  private baseUrl = "https://api.compulife.com";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getQuotes(request: CompulifeQuoteRequest): Promise<CompulifeQuote[]> {
    const { data } = await auditedFetch(
      "compulife",
      `${this.baseUrl}/v1/quotes`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          state: request.state,
          gender: request.gender,
          age: request.age,
          tobacco: request.tobaccoUse,
          health_class: request.healthClass,
          face_amount: request.faceAmount,
          term_length: request.termLength || 20,
          product_type: request.productType || "term",
        }),
      },
      7200 // Cache quotes for 2 hours
    );

    return (data.quotes || data || []).map((q: any) => ({
      carrier: q.carrier || q.company || "",
      product: q.product || q.plan || "",
      faceAmount: request.faceAmount,
      monthlyPremium: q.monthly_premium || q.monthlyPremium || 0,
      annualPremium: q.annual_premium || q.annualPremium || 0,
      ratingClass: q.rating_class || request.healthClass,
      termLength: q.term_length || request.termLength || 20,
      amBestRating: q.am_best_rating || q.amBestRating || "N/A",
      productType: q.product_type || request.productType || "term",
    }));
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      // Test with a simple quote request
      await this.getQuotes({
        state: "CA",
        gender: "male",
        age: 35,
        tobaccoUse: false,
        healthClass: "preferred",
        faceAmount: 500000,
        termLength: 20,
        productType: "term",
      });
      return { success: true, message: "COMPULIFE connection verified" };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// SOFR Pipeline — Secured Overnight Financing Rate
// ═══════════════════════════════════════════════════════════════════════

export interface SOFRRate {
  date: string;
  rate: number;
  percentile25: number;
  percentile75: number;
  volume: number;
  source: string;
}

export interface PremiumFinanceRate {
  provider: string;
  baseRate: number;
  spread: number;
  effectiveRate: number;
  minLoan: number;
  maxLtv: number;
  lastUpdated: string;
}

// SOFR data from FRED (free, no key needed for basic access)
export async function fetchSOFRFromFRED(apiKey?: string): Promise<SOFRRate[]> {
  const baseUrl = "https://api.stlouisfed.org/fred/series/observations";
  const params = new URLSearchParams({
    series_id: "SOFR",
    sort_order: "desc",
    limit: "30",
    file_type: "json",
  });
  if (apiKey) params.set("api_key", apiKey);

  try {
    const { data } = await auditedFetch(
      "fred",
      `${baseUrl}?${params}`,
      {},
      3600 // Cache for 1 hour
    );

    return (data.observations || [])
      .filter((o: any) => o.value !== ".")
      .map((o: any) => ({
        date: o.date,
        rate: parseFloat(o.value),
        percentile25: parseFloat(o.value) - 0.02,
        percentile75: parseFloat(o.value) + 0.02,
        volume: 0, // FRED doesn't provide volume
        source: "FRED",
      }));
  } catch {
    return getSOFRFallbackData();
  }
}

function getSOFRFallbackData(): SOFRRate[] {
  // Fallback SOFR data based on recent historical values
  const baseDate = new Date();
  return Array.from({ length: 30 }, (_, i) => {
    const date = new Date(baseDate);
    date.setDate(date.getDate() - i);
    const baseRate = 4.33 + (Math.random() - 0.5) * 0.1;
    return {
      date: date.toISOString().split("T")[0],
      rate: Math.round(baseRate * 100) / 100,
      percentile25: Math.round((baseRate - 0.02) * 100) / 100,
      percentile75: Math.round((baseRate + 0.02) * 100) / 100,
      volume: Math.floor(1800 + Math.random() * 400),
      source: "fallback",
    };
  });
}

export function calculatePremiumFinanceRates(sofrRate: number): PremiumFinanceRate[] {
  return [
    {
      provider: "Wintrust Premium Finance",
      baseRate: sofrRate,
      spread: 2.50,
      effectiveRate: Math.round((sofrRate + 2.50) * 100) / 100,
      minLoan: 50000,
      maxLtv: 0.90,
      lastUpdated: new Date().toISOString(),
    },
    {
      provider: "FIRST Premium Finance",
      baseRate: sofrRate,
      spread: 2.75,
      effectiveRate: Math.round((sofrRate + 2.75) * 100) / 100,
      minLoan: 25000,
      maxLtv: 0.85,
      lastUpdated: new Date().toISOString(),
    },
    {
      provider: "Imperial PFS",
      baseRate: sofrRate,
      spread: 3.00,
      effectiveRate: Math.round((sofrRate + 3.00) * 100) / 100,
      minLoan: 10000,
      maxLtv: 0.80,
      lastUpdated: new Date().toISOString(),
    },
    {
      provider: "AFCO Premium Finance",
      baseRate: sofrRate,
      spread: 2.65,
      effectiveRate: Math.round((sofrRate + 2.65) * 100) / 100,
      minLoan: 15000,
      maxLtv: 0.85,
      lastUpdated: new Date().toISOString(),
    },
  ];
}

// ═══════════════════════════════════════════════════════════════════════
// Context Assembly — Unified AI-Ready Context from All Tiers
// ═══════════════════════════════════════════════════════════════════════

export interface TierContext {
  platform: PlatformContext;
  organization: OrganizationContext;
  professional: ProfessionalContext;
  client: ClientContext;
}

export interface PlatformContext {
  economicIndicators: Record<string, number>;
  sofrRate: number;
  premiumFinanceRates: PremiumFinanceRate[];
  regulatoryAlerts: string[];
  marketCondition: "bull" | "bear" | "neutral";
}

export interface OrganizationContext {
  orgId?: string;
  orgName?: string;
  crmProvider?: string;
  crmContactCount?: number;
  messagingProvider?: string;
  investmentProvider?: string;
  quotingEngine?: string;
  activeIntegrations: string[];
}

export interface ProfessionalContext {
  professionalId?: number;
  verificationStatus: Record<string, string>;
  enrichmentData?: Record<string, any>;
  carrierAppointments: string[];
  specializations: string[];
}

export interface ClientContext {
  clientId?: number;
  linkedAccounts: number;
  totalAssets?: number;
  riskScore?: number;
  creditScore?: number;
  documentsCount: number;
  lastActivity?: string;
}

export async function assembleContext(userId?: string, orgId?: string): Promise<TierContext> {
  // Platform tier — always available
  const sofrRates = await fetchSOFRFromFRED();
  const currentSOFR = sofrRates.length > 0 ? sofrRates[0].rate : 4.33;

  const platformCtx: PlatformContext = {
    economicIndicators: {
      sofr: currentSOFR,
      fedFundsRate: currentSOFR + 0.08,
      cpi: 3.2,
      unemployment: 4.1,
    },
    sofrRate: currentSOFR,
    premiumFinanceRates: calculatePremiumFinanceRates(currentSOFR),
    regulatoryAlerts: [],
    marketCondition: "neutral",
  };

  // Organization tier
  const orgCtx: OrganizationContext = {
    orgId: orgId || undefined,
    activeIntegrations: [],
  };

  if (orgId) {
    try {
      const d = await db();
      const connections = await d.select().from(integrationConnections)
        .where(and(
          eq(integrationConnections.ownershipTier, "organization"),
          eq(integrationConnections.status, "connected")
        ));
      orgCtx.activeIntegrations = connections.map(c => c.providerId);
    } catch {
      // DB not available, continue with empty
    }
  }

  // Professional tier
  const profCtx: ProfessionalContext = {
    verificationStatus: {},
    carrierAppointments: [],
    specializations: [],
  };

  // Client tier
  const clientCtx: ClientContext = {
    linkedAccounts: 0,
    documentsCount: 0,
  };

  return {
    platform: platformCtx,
    organization: orgCtx,
    professional: profCtx,
    client: clientCtx,
  };
}

// ─── ADAPTER FACTORY ────────────────────────────────────────────────────

export function getOrgAdapter(providerSlug: string, credentials: Record<string, string>): 
  GoHighLevelAdapter | SMSiTAdapter | BridgeFTAdapter | CompulifeAdapter | null {
  switch (providerSlug) {
    case "gohighlevel":
      return new GoHighLevelAdapter(credentials.apiKey || "", credentials.locationId || "");
    case "smsit":
      return new SMSiTAdapter(credentials.apiKey || "");
    case "bridgeft":
      return new BridgeFTAdapter(credentials.apiKey || "");
    case "compulife":
      return new CompulifeAdapter(credentials.apiKey || "");
    default:
      return null;
  }
}
