/**
 * Passive Action Service — enables users to toggle automated background operations
 * for any and all data sources. Supports: auto-refresh, background sync, monitoring
 * alerts, scheduled reports, anomaly detection, and smart enrichment.
 */
import { getDb } from "../db";
import {
  passiveActionPreferences,
  passiveActionLog,
  type PassiveActionPreference,
  type InsertPassiveActionPreference,
} from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

// ─── Data Source Registry ────────────────────────────────────────────────
export type ActionType =
  | "auto_refresh"
  | "background_sync"
  | "monitoring_alerts"
  | "scheduled_reports"
  | "anomaly_detection"
  | "smart_enrichment";

export interface DataSourceDefinition {
  id: string;
  name: string;
  description: string;
  category: "government" | "market" | "personal" | "professional" | "crm" | "insurance" | "investment";
  tier: "platform" | "organization" | "advisor" | "client";
  supportedActions: ActionType[];
  defaultConfig: Record<string, unknown>;
  icon: string; // lucide icon name
}

export const DATA_SOURCES: DataSourceDefinition[] = [
  // Government / Economic Data
  {
    id: "bls",
    name: "Bureau of Labor Statistics",
    description: "Employment, inflation, CPI, and labor market data",
    category: "government",
    tier: "platform",
    supportedActions: ["auto_refresh", "monitoring_alerts", "scheduled_reports", "anomaly_detection"],
    defaultConfig: { refreshIntervalHours: 24, alertThreshold: 0.5 },
    icon: "Building2",
  },
  {
    id: "fred",
    name: "Federal Reserve (FRED)",
    description: "Interest rates, SOFR, Treasury yields, monetary policy data",
    category: "government",
    tier: "platform",
    supportedActions: ["auto_refresh", "monitoring_alerts", "scheduled_reports", "anomaly_detection"],
    defaultConfig: { refreshIntervalHours: 6, alertThreshold: 0.25 },
    icon: "Landmark",
  },
  {
    id: "bea",
    name: "Bureau of Economic Analysis",
    description: "GDP, personal income, regional economic data",
    category: "government",
    tier: "platform",
    supportedActions: ["auto_refresh", "monitoring_alerts", "scheduled_reports"],
    defaultConfig: { refreshIntervalHours: 24, alertThreshold: 1.0 },
    icon: "BarChart3",
  },
  {
    id: "census",
    name: "US Census Bureau",
    description: "Demographics, housing, business statistics",
    category: "government",
    tier: "platform",
    supportedActions: ["auto_refresh", "scheduled_reports"],
    defaultConfig: { refreshIntervalHours: 168 },
    icon: "Users",
  },
  {
    id: "sec_edgar",
    name: "SEC EDGAR",
    description: "Company filings, insider trading, financial statements",
    category: "government",
    tier: "platform",
    supportedActions: ["auto_refresh", "monitoring_alerts", "anomaly_detection"],
    defaultConfig: { refreshIntervalHours: 12, alertOnNewFilings: true },
    icon: "FileText",
  },
  {
    id: "finra",
    name: "FINRA BrokerCheck",
    description: "Broker/advisor verification and disciplinary records",
    category: "government",
    tier: "platform",
    supportedActions: ["auto_refresh", "monitoring_alerts"],
    defaultConfig: { refreshIntervalHours: 168 },
    icon: "Shield",
  },
  // Market & Investment Data
  {
    id: "snaptrade",
    name: "SnapTrade Brokerage",
    description: "Brokerage account holdings, positions, and transactions",
    category: "investment",
    tier: "client",
    supportedActions: ["auto_refresh", "background_sync", "monitoring_alerts", "anomaly_detection"],
    defaultConfig: { refreshIntervalHours: 1, syncOnLogin: true },
    icon: "TrendingUp",
  },
  {
    id: "compulife",
    name: "COMPULIFE Quoting",
    description: "Life insurance premium quotes and carrier comparisons",
    category: "insurance",
    tier: "organization",
    supportedActions: ["auto_refresh", "scheduled_reports"],
    defaultConfig: { refreshIntervalHours: 24 },
    icon: "Calculator",
  },
  {
    id: "sofr",
    name: "SOFR Rate Pipeline",
    description: "Secured Overnight Financing Rate for premium finance calculations",
    category: "market",
    tier: "platform",
    supportedActions: ["auto_refresh", "monitoring_alerts", "anomaly_detection"],
    defaultConfig: { refreshIntervalHours: 6, alertThresholdBps: 10 },
    icon: "Percent",
  },
  // Personal Financial Data
  {
    id: "plaid",
    name: "Plaid Financial",
    description: "Bank accounts, transactions, balances, and investments",
    category: "personal",
    tier: "client",
    supportedActions: ["auto_refresh", "background_sync", "monitoring_alerts", "anomaly_detection", "smart_enrichment"],
    defaultConfig: { refreshIntervalHours: 4, categorizeTransactions: true },
    icon: "CreditCard",
  },
  {
    id: "credit_bureau",
    name: "Credit Bureau (Soft Pull)",
    description: "Credit scores, reports, and DTI analysis",
    category: "personal",
    tier: "client",
    supportedActions: ["auto_refresh", "monitoring_alerts", "scheduled_reports"],
    defaultConfig: { refreshIntervalDays: 30, alertOnScoreChange: 10 },
    icon: "FileCheck",
  },
  // Professional / CRM
  {
    id: "gohighlevel",
    name: "GoHighLevel CRM",
    description: "Contacts, pipelines, conversations, and automation",
    category: "crm",
    tier: "organization",
    supportedActions: ["background_sync", "monitoring_alerts", "smart_enrichment"],
    defaultConfig: { syncIntervalMinutes: 30, enrichNewContacts: true },
    icon: "Zap",
  },
  {
    id: "smsit",
    name: "SMS-iT",
    description: "Contact management, campaigns, and messaging",
    category: "crm",
    tier: "organization",
    supportedActions: ["background_sync", "monitoring_alerts"],
    defaultConfig: { syncIntervalMinutes: 60 },
    icon: "MessageSquare",
  },
  {
    id: "bridgeft",
    name: "BridgeFT WealthTech",
    description: "Portfolio accounts, positions, performance, and transactions",
    category: "investment",
    tier: "organization",
    supportedActions: ["auto_refresh", "background_sync", "monitoring_alerts", "scheduled_reports", "anomaly_detection"],
    defaultConfig: { refreshIntervalHours: 2, performanceAlertPct: 5 },
    icon: "Briefcase",
  },
  {
    id: "wealthbox",
    name: "Wealthbox CRM",
    description: "Financial advisor CRM — contacts, tasks, opportunities",
    category: "crm",
    tier: "advisor",
    supportedActions: ["background_sync", "monitoring_alerts", "smart_enrichment"],
    defaultConfig: { syncIntervalMinutes: 30 },
    icon: "BookOpen",
  },
  {
    id: "redtail",
    name: "Redtail CRM",
    description: "Financial advisor CRM — contacts, activities, workflows",
    category: "crm",
    tier: "advisor",
    supportedActions: ["background_sync", "monitoring_alerts", "smart_enrichment"],
    defaultConfig: { syncIntervalMinutes: 30 },
    icon: "BookOpen",
  },
  {
    id: "pdl",
    name: "People Data Labs",
    description: "Contact enrichment — professional profiles, company data",
    category: "professional",
    tier: "advisor",
    supportedActions: ["smart_enrichment", "scheduled_reports"],
    defaultConfig: { enrichBatchSize: 10, monthlyBudget: 100 },
    icon: "UserSearch",
  },
  {
    id: "docusign",
    name: "DocuSign eSignature",
    description: "Electronic signature tracking and envelope management",
    category: "professional",
    tier: "organization",
    supportedActions: ["background_sync", "monitoring_alerts"],
    defaultConfig: { syncIntervalMinutes: 15, alertOnSigned: true },
    icon: "PenTool",
  },
  {
    id: "nitrogen",
    name: "Nitrogen Risk Scoring",
    description: "Client risk tolerance assessment and portfolio scoring",
    category: "professional",
    tier: "organization",
    supportedActions: ["auto_refresh", "monitoring_alerts"],
    defaultConfig: { refreshIntervalDays: 7 },
    icon: "Gauge",
  },
  {
    id: "canopy",
    name: "Canopy Connect",
    description: "Insurance policy data aggregation and verification",
    category: "insurance",
    tier: "client",
    supportedActions: ["auto_refresh", "background_sync", "monitoring_alerts"],
    defaultConfig: { refreshIntervalDays: 7 },
    icon: "Umbrella",
  },
];

// ─── Action Type Metadata ────────────────────────────────────────────────
export const ACTION_TYPE_META: Record<ActionType, { label: string; description: string; icon: string }> = {
  auto_refresh: {
    label: "Auto-Refresh",
    description: "Automatically fetch latest data on a schedule",
    icon: "RefreshCw",
  },
  background_sync: {
    label: "Background Sync",
    description: "Keep data synchronized in the background",
    icon: "ArrowLeftRight",
  },
  monitoring_alerts: {
    label: "Monitoring Alerts",
    description: "Get notified when significant changes occur",
    icon: "Bell",
  },
  scheduled_reports: {
    label: "Scheduled Reports",
    description: "Generate periodic summary reports automatically",
    icon: "FileBarChart",
  },
  anomaly_detection: {
    label: "Anomaly Detection",
    description: "Flag unusual patterns or outliers in data",
    icon: "AlertTriangle",
  },
  smart_enrichment: {
    label: "Smart Enrichment",
    description: "Auto-enrich records with additional data from other sources",
    icon: "Sparkles",
  },
};

// ─── Service Functions ───────────────────────────────────────────────────

/** Get all passive action preferences for a user */
export async function getUserPreferences(userId: number): Promise<PassiveActionPreference[]> {
  const db = (await getDb())!;
  return db.select().from(passiveActionPreferences).where(eq(passiveActionPreferences.userId, userId));
}

/** Get preferences for a specific source */
export async function getSourcePreferences(userId: number, source: string): Promise<PassiveActionPreference[]> {
  const db = (await getDb())!;
  return db
    .select()
    .from(passiveActionPreferences)
    .where(and(eq(passiveActionPreferences.userId, userId), eq(passiveActionPreferences.source, source)));
}

/** Toggle a specific action for a source */
export async function toggleAction(
  userId: number,
  source: string,
  actionType: ActionType,
  enabled: boolean,
  config?: Record<string, unknown>
): Promise<PassiveActionPreference> {
  const db = (await getDb())!;

  // Check if preference exists
  const existing = await db
    .select()
    .from(passiveActionPreferences)
    .where(
      and(
        eq(passiveActionPreferences.userId, userId),
        eq(passiveActionPreferences.source, source),
        eq(passiveActionPreferences.actionType, actionType)
      )
    );

  if (existing.length > 0) {
    // Update existing
    await db
      .update(passiveActionPreferences)
      .set({ enabled, ...(config ? { configJson: config } : {}) })
      .where(eq(passiveActionPreferences.id, existing[0].id));
    return { ...existing[0], enabled, ...(config ? { configJson: config } : {}) };
  } else {
    // Create new
    const sourceDef = DATA_SOURCES.find((s) => s.id === source);
    const defaultConf = sourceDef?.defaultConfig || {};
    const result = await db.insert(passiveActionPreferences).values({
      userId,
      source,
      actionType,
      enabled,
      configJson: config || defaultConf,
    });
    const insertId = result[0].insertId;
    const [created] = await db.select().from(passiveActionPreferences).where(eq(passiveActionPreferences.id, insertId));
    return created;
  }
}

/** Bulk toggle all supported actions for a source */
export async function bulkToggleSource(
  userId: number,
  source: string,
  enabled: boolean
): Promise<{ source: string; toggled: number }> {
  const sourceDef = DATA_SOURCES.find((s) => s.id === source);
  if (!sourceDef) return { source, toggled: 0 };

  let count = 0;
  for (const action of sourceDef.supportedActions) {
    await toggleAction(userId, source, action, enabled);
    count++;
  }
  return { source, toggled: count };
}

/** Bulk toggle all sources and all actions */
export async function bulkToggleAll(
  userId: number,
  enabled: boolean
): Promise<{ totalSources: number; totalActions: number }> {
  let totalActions = 0;
  for (const source of DATA_SOURCES) {
    const result = await bulkToggleSource(userId, source.id, enabled);
    totalActions += result.toggled;
  }
  return { totalSources: DATA_SOURCES.length, totalActions };
}

/** Get summary stats for a user's passive actions */
export async function getPassiveActionStats(userId: number) {
  const db = (await getDb())!;
  const prefs = await getUserPreferences(userId);
  const enabledCount = prefs.filter((p) => p.enabled).length;
  const totalPossible = DATA_SOURCES.reduce((sum, s) => sum + s.supportedActions.length, 0);

  // Get recent execution log
  const recentLogs = await db
    .select()
    .from(passiveActionLog)
    .where(eq(passiveActionLog.userId, userId))
    .orderBy(sql`${passiveActionLog.executedAt} DESC`)
    .limit(20);

  const successCount = recentLogs.filter((l) => l.status === "success").length;
  const failedCount = recentLogs.filter((l) => l.status === "failed").length;

  // Group enabled by category
  const byCategory: Record<string, number> = {};
  for (const pref of prefs.filter((p) => p.enabled)) {
    const src = DATA_SOURCES.find((s) => s.id === pref.source);
    if (src) {
      byCategory[src.category] = (byCategory[src.category] || 0) + 1;
    }
  }

  return {
    enabled: enabledCount,
    disabled: prefs.length - enabledCount,
    totalPossible,
    coverage: totalPossible > 0 ? Math.round((enabledCount / totalPossible) * 100) : 0,
    recentExecutions: recentLogs.length,
    recentSuccesses: successCount,
    recentFailures: failedCount,
    byCategory,
    lastExecution: recentLogs[0]?.executedAt || null,
  };
}

/** Log a passive action execution */
export async function logPassiveExecution(entry: {
  userId: number;
  preferenceId: number;
  source: string;
  actionType: string;
  status: "success" | "failed" | "skipped" | "partial";
  resultSummary?: string;
  recordsAffected?: number;
  durationMs?: number;
  errorMessage?: string;
}) {
  const db = (await getDb())!;
  await db.insert(passiveActionLog).values(entry);

  // Update trigger count on the preference
  if (entry.status === "success" || entry.status === "partial") {
    await db
      .update(passiveActionPreferences)
      .set({
        triggerCount: sql`${passiveActionPreferences.triggerCount} + 1`,
        lastTriggeredAt: sql`NOW()`,
      })
      .where(eq(passiveActionPreferences.id, entry.preferenceId));
  }
}

/** Get execution history for a user */
export async function getExecutionHistory(userId: number, limit = 50) {
  const db = (await getDb())!;
  return db
    .select()
    .from(passiveActionLog)
    .where(eq(passiveActionLog.userId, userId))
    .orderBy(sql`${passiveActionLog.executedAt} DESC`)
    .limit(limit);
}

/** Get all data source definitions */
export function getDataSources(): DataSourceDefinition[] {
  return DATA_SOURCES;
}

/** Get action type metadata */
export function getActionTypeMeta() {
  return ACTION_TYPE_META;
}
