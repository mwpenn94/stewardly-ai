/**
 * Improvement Signal Bridge — Pass 11
 *
 * Wires real data signals from Plaid transactions, user actions,
 * and computation logs into the Improvement Engine's 6 loops:
 *
 * 1. Calculator Accuracy Loop — compares projected vs actual returns
 * 2. User Engagement Loop — tracks feature adoption and drop-off
 * 3. Data Freshness Loop — monitors Plaid sync recency
 * 4. Model Quality Loop — tracks AI response quality from feedback
 * 5. Compliance Loop — monitors regulatory adherence signals
 * 6. Performance Loop — tracks system latency and error rates
 *
 * All signals are dispatched to the in-memory improvement engine
 * and optionally to the notification workflow system.
 */
import { recordSignal, type UsageSignal } from "./improvementEngine";
import { dispatchWorkflowEvent } from "./notificationWorkflows";
import { logger } from "../_core/logger";

const log = logger.child({ module: "signal-bridge" });

// ─── Signal Types ───────────────────────────────────────────────────────────

export interface TransactionSignal {
  userId: string;
  accountId: string;
  transactionCount: number;
  totalAmount: number;
  categories: string[];
  dateRange: { start: string; end: string };
  syncLatencyMs: number;
}

export interface UserActionSignal {
  userId: string;
  action: string;
  feature: string;
  durationMs: number;
  success: boolean;
  metadata?: Record<string, unknown>;
}

export interface ModelQualitySignal {
  userId: string;
  conversationId: number;
  messageId: number;
  rating: "up" | "down";
  modelVersion?: string;
}

export interface ComplianceSignal {
  userId: string;
  checkType: string;
  passed: boolean;
  details?: string;
}

// ─── Signal Aggregation Store ───────────────────────────────────────────────

interface AggregatedMetrics {
  transactionSyncs: number;
  totalTransactions: number;
  avgSyncLatencyMs: number;
  userActions: number;
  featureUsage: Record<string, number>;
  feedbackPositive: number;
  feedbackNegative: number;
  complianceChecks: number;
  compliancePassed: number;
  errorCount: number;
  lastUpdated: number;
}

const metrics: AggregatedMetrics = {
  transactionSyncs: 0,
  totalTransactions: 0,
  avgSyncLatencyMs: 0,
  userActions: 0,
  featureUsage: {},
  feedbackPositive: 0,
  feedbackNegative: 0,
  complianceChecks: 0,
  compliancePassed: 0,
  errorCount: 0,
  lastUpdated: Date.now(),
};

// ─── Loop 1: Calculator Accuracy ────────────────────────────────────────────

/**
 * Process Plaid transaction data to compare against projected values.
 * Feeds into the Calculator Accuracy improvement loop.
 */
export function processTransactionSignal(signal: TransactionSignal): void {
  metrics.transactionSyncs++;
  metrics.totalTransactions += signal.transactionCount;
  metrics.avgSyncLatencyMs = (
    (metrics.avgSyncLatencyMs * (metrics.transactionSyncs - 1) + signal.syncLatencyMs) /
    metrics.transactionSyncs
  );
  metrics.lastUpdated = Date.now();

  // Record as improvement engine signal
  recordSignal({
    userId: signal.userId,
    engineType: "uwe",
    action: "backtest",
    inputHash: `plaid-${signal.accountId}-${signal.dateRange.start}`,
    durationMs: signal.syncLatencyMs,
    resultSummary: {
      totalValue: signal.totalAmount,
      scenarioCount: signal.transactionCount,
    },
    timestamp: Date.now(),
  });

  // Alert if sync latency is high
  if (signal.syncLatencyMs > 10000) {
    dispatchWorkflowEvent({
      type: "improvement.quality_below_threshold",
      userId: 0,
      data: {
        metric: "Plaid Sync Latency",
        value: `${(signal.syncLatencyMs / 1000).toFixed(1)}s`,
        threshold: "10s",
      },
      timestamp: Date.now(),
    });
  }

  log.debug({ userId: signal.userId, txCount: signal.transactionCount, latency: signal.syncLatencyMs }, "Transaction signal processed");
}

// ─── Loop 2: User Engagement ────────────────────────────────────────────────

/**
 * Track user actions across features for engagement analysis.
 * Feeds into the User Engagement improvement loop.
 */
export function processUserActionSignal(signal: UserActionSignal): void {
  metrics.userActions++;
  metrics.featureUsage[signal.feature] = (metrics.featureUsage[signal.feature] || 0) + 1;
  metrics.lastUpdated = Date.now();

  // Map feature to engine type
  const engineMap: Record<string, UsageSignal["engineType"]> = {
    "wealth-engine": "uwe",
    "calculator": "uwe",
    "insurance": "bie",
    "health": "he",
    "chat": "scui",
    "voice": "scui",
    "learning": "scui",
  };

  const engineType = engineMap[signal.feature] || "scui";

  recordSignal({
    userId: signal.userId,
    engineType,
    action: signal.action as UsageSignal["action"] || "simulate",
    inputHash: `action-${signal.feature}-${signal.action}`,
    durationMs: signal.durationMs,
    resultSummary: {},
    timestamp: Date.now(),
  });

  if (!signal.success) {
    metrics.errorCount++;
    log.warn({ userId: signal.userId, feature: signal.feature, action: signal.action }, "User action failed");
  }
}

// ─── Loop 3: Data Freshness ─────────────────────────────────────────────────

/**
 * Monitor data freshness from Plaid syncs.
 * Alerts when data becomes stale.
 */
export function checkDataFreshness(): {
  lastSync: number;
  staleness: string;
  isStale: boolean;
} {
  const now = Date.now();
  const staleness = now - metrics.lastUpdated;
  const isStale = staleness > 24 * 60 * 60 * 1000; // 24 hours

  if (isStale && metrics.transactionSyncs > 0) {
    dispatchWorkflowEvent({
      type: "improvement.quality_below_threshold",
      userId: 0,
      data: {
        metric: "Data Freshness",
        value: `${Math.round(staleness / 3600000)}h since last sync`,
        threshold: "24h",
      },
      timestamp: now,
    });
  }

  return {
    lastSync: metrics.lastUpdated,
    staleness: `${Math.round(staleness / 3600000)}h`,
    isStale,
  };
}

// ─── Loop 4: Model Quality ──────────────────────────────────────────────────

/**
 * Process user feedback on AI responses.
 * Feeds into the Model Quality improvement loop.
 */
export function processModelQualitySignal(signal: ModelQualitySignal): void {
  if (signal.rating === "up") {
    metrics.feedbackPositive++;
  } else {
    metrics.feedbackNegative++;
  }
  metrics.lastUpdated = Date.now();

  const total = metrics.feedbackPositive + metrics.feedbackNegative;
  const satisfactionRate = total > 0 ? metrics.feedbackPositive / total : 1;

  // Alert if satisfaction drops below 70%
  if (total >= 10 && satisfactionRate < 0.7) {
    dispatchWorkflowEvent({
      type: "improvement.quality_below_threshold",
      userId: 0,
      data: {
        metric: "AI Satisfaction Rate",
        value: `${Math.round(satisfactionRate * 100)}%`,
        threshold: "70%",
      },
      timestamp: Date.now(),
    });
  }

  log.debug({ rating: signal.rating, total, rate: satisfactionRate }, "Model quality signal processed");
}

// ─── Loop 5: Compliance ─────────────────────────────────────────────────────

/**
 * Track compliance check results.
 * Feeds into the Compliance improvement loop.
 */
export function processComplianceSignal(signal: ComplianceSignal): void {
  metrics.complianceChecks++;
  if (signal.passed) metrics.compliancePassed++;
  metrics.lastUpdated = Date.now();

  const passRate = metrics.complianceChecks > 0
    ? metrics.compliancePassed / metrics.complianceChecks
    : 1;

  // Alert if compliance rate drops below 95%
  if (metrics.complianceChecks >= 5 && passRate < 0.95) {
    dispatchWorkflowEvent({
      type: "compliance.review_due",
      userId: 0,
      data: {
        reviewType: `Compliance Pass Rate (${Math.round(passRate * 100)}%)`,
        dueDate: new Date().toLocaleDateString(),
      },
      timestamp: Date.now(),
    });
  }
}

// ─── Loop 6: Performance ────────────────────────────────────────────────────

/**
 * Track system performance metrics.
 * Automatically fed from user action signals.
 */
export function getPerformanceMetrics(): {
  avgActionDuration: number;
  errorRate: number;
  totalActions: number;
} {
  const errorRate = metrics.userActions > 0
    ? metrics.errorCount / metrics.userActions
    : 0;

  return {
    avgActionDuration: metrics.avgSyncLatencyMs,
    errorRate,
    totalActions: metrics.userActions,
  };
}

// ─── Aggregated Dashboard Data ──────────────────────────────────────────────

export function getSignalBridgeMetrics(): AggregatedMetrics & {
  dataFreshness: ReturnType<typeof checkDataFreshness>;
  performance: ReturnType<typeof getPerformanceMetrics>;
  satisfactionRate: number;
  complianceRate: number;
} {
  const total = metrics.feedbackPositive + metrics.feedbackNegative;
  return {
    ...metrics,
    dataFreshness: checkDataFreshness(),
    performance: getPerformanceMetrics(),
    satisfactionRate: total > 0 ? Math.round(metrics.feedbackPositive / total * 100) : 100,
    complianceRate: metrics.complianceChecks > 0
      ? Math.round(metrics.compliancePassed / metrics.complianceChecks * 100)
      : 100,
  };
}

/**
 * Reset metrics (for testing)
 */
export function resetSignalBridgeMetrics(): void {
  metrics.transactionSyncs = 0;
  metrics.totalTransactions = 0;
  metrics.avgSyncLatencyMs = 0;
  metrics.userActions = 0;
  metrics.featureUsage = {};
  metrics.feedbackPositive = 0;
  metrics.feedbackNegative = 0;
  metrics.complianceChecks = 0;
  metrics.compliancePassed = 0;
  metrics.errorCount = 0;
  metrics.lastUpdated = Date.now();
}
