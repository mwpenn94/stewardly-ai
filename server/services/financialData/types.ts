/**
 * Financial Data Adapter Types
 *
 * Pass 121: Core type definitions for the financial data adapter registry.
 * Each adapter implements a common interface for health checks, data queries,
 * and audit trail integration.
 */

// ─── ADAPTER INTERFACE ────────────────────────────────────────────

export type AdapterTier = "free_keyless" | "free_with_key" | "freemium" | "paid";

export interface AdapterHealth {
  adapterId: string;
  name: string;
  status: "healthy" | "degraded" | "unavailable" | "not_configured";
  lastChecked: number;
  latencyMs?: number;
  message?: string;
  tier: AdapterTier;
  requiresKey: boolean;
  keyConfigured: boolean;
}

export interface AdapterQueryResult<T = unknown> {
  data: T;
  source: string;
  adapterId: string;
  cachedAt?: number;
  expiresAt?: number;
  metadata?: Record<string, unknown>;
}

export interface FinancialDataAdapter {
  id: string;
  name: string;
  description: string;
  tier: AdapterTier;
  requiresKey: boolean;
  supportedActions: string[];

  /** Check adapter health and connectivity */
  healthCheck(): Promise<AdapterHealth>;

  /** Query the adapter for data */
  query(action: string, params: Record<string, unknown>): Promise<AdapterQueryResult>;
}

// ─── MARKET DATA TYPES ────────────────────────────────────────────

export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  name?: string;
  exchange?: string;
  timestamp: number;
}

export interface HistoricalPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjustedClose?: number;
}

export interface EconomicSeries {
  seriesId: string;
  title: string;
  frequency: string;
  units: string;
  observations: Array<{ date: string; value: number | null }>;
  lastUpdated: string;
  source: string;
}

// ─── SEC EDGAR TYPES ──────────────────────────────────────────────

export interface EdgarFiling {
  accessionNumber: string;
  filingDate: string;
  form: string;
  companyName: string;
  cik: string;
  fileUrl: string;
  description?: string;
}

export interface EdgarCompanyInfo {
  cik: string;
  name: string;
  ticker?: string;
  sic?: string;
  sicDescription?: string;
  stateOfIncorporation?: string;
  filings: EdgarFiling[];
}

// ─── TREASURY TYPES ───────────────────────────────────────────────

export interface TreasuryYield {
  date: string;
  "1mo"?: number;
  "2mo"?: number;
  "3mo"?: number;
  "6mo"?: number;
  "1yr"?: number;
  "2yr"?: number;
  "3yr"?: number;
  "5yr"?: number;
  "7yr"?: number;
  "10yr"?: number;
  "20yr"?: number;
  "30yr"?: number;
}

// ─── IDENTIFIER TYPES ─────────────────────────────────────────────

export interface FigiResult {
  figi: string;
  name: string;
  ticker: string;
  exchCode: string;
  compositeFIGI?: string;
  securityType?: string;
  marketSector?: string;
}

export interface LeiResult {
  lei: string;
  legalName: string;
  jurisdiction: string;
  status: string;
  registrationDate: string;
  lastUpdate: string;
  headquarters?: {
    city: string;
    country: string;
    postalCode: string;
  };
}

// ─── PFM TYPES ────────────────────────────────────────────────────

export type PfmSource = "mint" | "empower" | "monarch" | "everydollar" | "ynab" | "quicken" | "other";

export interface PfmTransaction {
  date: string;
  description: string;
  amount: number;
  category?: string;
  subcategory?: string;
  account?: string;
  type: "income" | "expense" | "transfer";
  notes?: string;
  originalRow?: Record<string, string>;
}

export interface PfmColumnMapping {
  sourceColumn: string;
  targetField: keyof PfmTransaction;
  confidence: number;
  transform?: string;
}

export interface PfmImportResult {
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  dateRange: { start: string; end: string };
  categoryBreakdown: Record<string, number>;
  unmappedColumns: string[];
  warnings: string[];
}

// ─── COMPLIANCE TYPES ─────────────────────────────────────────────

export interface DataAuthorization {
  id: number;
  clientId: number;
  advisorId: number;
  dataScope: string;
  consentLanguage: string;
  stateJurisdiction: string;
  grantedAt: number;
  expiresAt?: number;
  revokedAt?: number;
  status: "active" | "expired" | "revoked";
}

export interface DataAccessAuditEntry {
  id: number;
  adapterId: string;
  action: string;
  userId: number;
  clientId?: number;
  requestParams: Record<string, unknown>;
  responseStatus: "success" | "error" | "rate_limited";
  latencyMs: number;
  timestamp: number;
}
