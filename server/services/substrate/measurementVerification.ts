/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Substrate Primitive: Measurement & Verification (M&V) Engine
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Implements the three-property criterion for cost savings attribution:
 *   1. Defensible — causation, not correlation
 *   2. Measurable within attribution window — quantifiable before invoice
 *   3. No customer friction — transparent measurement
 *
 * Categories that pass (feed MeasuredSavings):
 *   - AI call cost optimization (sovereign routing)
 *   - Time savings (automated tasks)
 *   - Search efficiency (cascade)
 *   - Document processing (automated extraction)
 *   - Compliance automation (automated review)
 *   - Memory-assisted context (M8 token reduction)
 *
 * @substrate-primitive: measurement-verification
 * @spec-ref: plan/09-cost-measurement-and-spectrum.md
 */
import { logger } from "../../_core/logger";

const log = logger.child({ module: "substrate:mv" });

// ─── Types ───────────────────────────────────────────────────────────────────

export type SavingsCategory =
  | "ai_cost_optimization"
  | "time_savings"
  | "search_efficiency"
  | "document_processing"
  | "compliance_automation"
  | "memory_context_reduction";

export interface SavingsEvent {
  id: string;
  category: SavingsCategory;
  userId: number;
  timestamp: number;
  actualCost: number;       // What was actually spent (USD)
  baselineCost: number;     // What would have been spent without optimization (USD)
  savings: number;          // baselineCost - actualCost
  metadata: {
    operation: string;
    model?: string;
    tokensUsed?: number;
    tokensBaseline?: number;
    timeMs?: number;
    baselineTimeMs?: number;
  };
}

export interface PeriodSummary {
  userId: number;
  periodStart: number;
  periodEnd: number;
  totalSavings: number;
  byCategory: Record<SavingsCategory, number>;
  eventCount: number;
  customerSavingsShare: number; // Portion returned to customer
  creditAmount: number;         // totalSavings * customerSavingsShare
}

export interface CostPlusCeiling {
  directCost: number;
  infrastructureMargin: number;
  ceilingAmount: number;
  actualInvoice: number;
  ceilingHit: boolean;
}

// ─── Configuration ───────────────────────────────────────────────────────────

export interface MVConfig {
  customerSavingsShare: number;  // 0-1, portion of savings returned
  infrastructureMarginRate: number; // e.g., 0.15 for 15%
  baselineModels: Record<string, { inputPer1M: number; outputPer1M: number }>;
  benchmarks: {
    manualDocReviewMinutes: number;
    manualComplianceCheckMinutes: number;
    hourlyRate: number;
  };
}

const DEFAULT_CONFIG: MVConfig = {
  customerSavingsShare: 0.25, // 25% of savings returned to customer
  infrastructureMarginRate: 0.15,
  baselineModels: {
    "gpt-4": { inputPer1M: 30, outputPer1M: 60 },
    "gpt-4o": { inputPer1M: 5, outputPer1M: 15 },
    "claude-3.5-sonnet": { inputPer1M: 3, outputPer1M: 15 },
    "default": { inputPer1M: 10, outputPer1M: 30 },
  },
  benchmarks: {
    manualDocReviewMinutes: 30,
    manualComplianceCheckMinutes: 45,
    hourlyRate: 150, // $150/hr for financial professional
  },
};

let config: MVConfig = { ...DEFAULT_CONFIG };

export function updateMVConfig(partial: Partial<MVConfig>): void {
  config = { ...config, ...partial };
}

export function getMVConfig(): MVConfig {
  return { ...config };
}

// ─── In-Memory Event Store ───────────────────────────────────────────────────
// In production, these would be persisted to the database.
// For now, we maintain a rolling window in memory.

const savingsEvents: SavingsEvent[] = [];
const MAX_EVENTS = 10000;

let eventCounter = 0;

// ─── Recording Functions ─────────────────────────────────────────────────────

/**
 * Record an AI cost optimization event.
 * Called when sovereign routing chooses a cheaper provider.
 */
export function recordAICostSavings(params: {
  userId: number;
  actualModel: string;
  baselineModel: string;
  inputTokens: number;
  outputTokens: number;
  actualCost: number;
}): SavingsEvent {
  const baseline = config.baselineModels[params.baselineModel] ?? config.baselineModels["default"];
  const baselineCost = (params.inputTokens / 1_000_000) * baseline.inputPer1M +
    (params.outputTokens / 1_000_000) * baseline.outputPer1M;

  return recordEvent({
    category: "ai_cost_optimization",
    userId: params.userId,
    actualCost: params.actualCost,
    baselineCost,
    metadata: {
      operation: "sovereign_routing",
      model: params.actualModel,
      tokensUsed: params.inputTokens + params.outputTokens,
    },
  });
}

/**
 * Record a time savings event.
 * Called when a task is automated that would have required manual work.
 */
export function recordTimeSavings(params: {
  userId: number;
  operation: string;
  automatedTimeMs: number;
  manualBenchmarkMinutes: number;
}): SavingsEvent {
  const manualCost = (params.manualBenchmarkMinutes / 60) * config.benchmarks.hourlyRate;
  const automatedCost = 0; // Time cost is zero (AI cost tracked separately)

  return recordEvent({
    category: "time_savings",
    userId: params.userId,
    actualCost: automatedCost,
    baselineCost: manualCost,
    metadata: {
      operation: params.operation,
      timeMs: params.automatedTimeMs,
      baselineTimeMs: params.manualBenchmarkMinutes * 60 * 1000,
    },
  });
}

/**
 * Record a search efficiency event.
 * Called when the search cascade finds an answer faster than single-provider.
 */
export function recordSearchEfficiency(params: {
  userId: number;
  cascadeTimeMs: number;
  singleProviderTimeMs: number;
  cascadeCost: number;
  singleProviderCost: number;
}): SavingsEvent {
  return recordEvent({
    category: "search_efficiency",
    userId: params.userId,
    actualCost: params.cascadeCost,
    baselineCost: params.singleProviderCost,
    metadata: {
      operation: "search_cascade",
      timeMs: params.cascadeTimeMs,
      baselineTimeMs: params.singleProviderTimeMs,
    },
  });
}

/**
 * Record a document processing savings event.
 */
export function recordDocumentProcessingSavings(params: {
  userId: number;
  processingTimeMs: number;
  aiCost: number;
}): SavingsEvent {
  const manualCost = (config.benchmarks.manualDocReviewMinutes / 60) * config.benchmarks.hourlyRate;

  return recordEvent({
    category: "document_processing",
    userId: params.userId,
    actualCost: params.aiCost,
    baselineCost: manualCost,
    metadata: {
      operation: "document_analysis",
      timeMs: params.processingTimeMs,
      baselineTimeMs: config.benchmarks.manualDocReviewMinutes * 60 * 1000,
    },
  });
}

/**
 * Record a memory-assisted context reduction event.
 * Called when M8 reduces token usage.
 */
export function recordMemoryContextSavings(params: {
  userId: number;
  actualTokens: number;
  fullContextTokens: number;
  model: string;
}): SavingsEvent {
  const pricing = config.baselineModels[params.model] ?? config.baselineModels["default"];
  const actualCost = (params.actualTokens / 1_000_000) * pricing.inputPer1M;
  const baselineCost = (params.fullContextTokens / 1_000_000) * pricing.inputPer1M;

  return recordEvent({
    category: "memory_context_reduction",
    userId: params.userId,
    actualCost,
    baselineCost,
    metadata: {
      operation: "m8_prompt_assembly",
      model: params.model,
      tokensUsed: params.actualTokens,
      tokensBaseline: params.fullContextTokens,
    },
  });
}

// ─── Aggregation Functions ───────────────────────────────────────────────────

/**
 * Get savings summary for a user over a billing period.
 */
export function getPeriodSummary(userId: number, periodStart: number, periodEnd: number): PeriodSummary {
  const periodEvents = savingsEvents.filter(
    (e) => e.userId === userId && e.timestamp >= periodStart && e.timestamp <= periodEnd
  );

  const byCategory: Record<SavingsCategory, number> = {
    ai_cost_optimization: 0,
    time_savings: 0,
    search_efficiency: 0,
    document_processing: 0,
    compliance_automation: 0,
    memory_context_reduction: 0,
  };

  let totalSavings = 0;
  for (const event of periodEvents) {
    byCategory[event.category] += event.savings;
    totalSavings += event.savings;
  }

  const creditAmount = totalSavings * config.customerSavingsShare;

  return {
    userId,
    periodStart,
    periodEnd,
    totalSavings,
    byCategory,
    eventCount: periodEvents.length,
    customerSavingsShare: config.customerSavingsShare,
    creditAmount,
  };
}

/**
 * Calculate the cost-plus ceiling for a billing period.
 * The customer is never invoiced above this amount.
 */
export function calculateCeiling(params: {
  directCost: number;
  platformFee: number;
  measuredSavings: number;
}): CostPlusCeiling {
  const infrastructureMargin = params.directCost * config.infrastructureMarginRate;
  const ceilingAmount = params.directCost + infrastructureMargin;
  const actualInvoice = params.platformFee + params.directCost - (params.measuredSavings * config.customerSavingsShare);

  return {
    directCost: params.directCost,
    infrastructureMargin,
    ceilingAmount,
    actualInvoice: Math.min(actualInvoice, ceilingAmount),
    ceilingHit: actualInvoice > ceilingAmount,
  };
}

/**
 * Get all savings events for a user (for display in dashboard).
 */
export function getUserSavingsEvents(userId: number, limit: number = 50): SavingsEvent[] {
  return savingsEvents
    .filter((e) => e.userId === userId)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

/**
 * Get aggregate savings across all users (admin view).
 */
export function getGlobalSavingsSummary(): {
  totalSavings: number;
  totalEvents: number;
  byCategory: Record<SavingsCategory, number>;
  uniqueUsers: number;
} {
  const byCategory: Record<SavingsCategory, number> = {
    ai_cost_optimization: 0,
    time_savings: 0,
    search_efficiency: 0,
    document_processing: 0,
    compliance_automation: 0,
    memory_context_reduction: 0,
  };

  let totalSavings = 0;
  const userSet = new Set<number>();

  for (const event of savingsEvents) {
    byCategory[event.category] += event.savings;
    totalSavings += event.savings;
    userSet.add(event.userId);
  }

  return {
    totalSavings,
    totalEvents: savingsEvents.length,
    byCategory,
    uniqueUsers: userSet.size,
  };
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

function recordEvent(params: {
  category: SavingsCategory;
  userId: number;
  actualCost: number;
  baselineCost: number;
  metadata: SavingsEvent["metadata"];
}): SavingsEvent {
  const event: SavingsEvent = {
    id: `sv_${Date.now()}_${++eventCounter}`,
    category: params.category,
    userId: params.userId,
    timestamp: Date.now(),
    actualCost: params.actualCost,
    baselineCost: params.baselineCost,
    savings: Math.max(0, params.baselineCost - params.actualCost),
    metadata: params.metadata,
  };

  savingsEvents.push(event);

  // Trim if over capacity
  if (savingsEvents.length > MAX_EVENTS) {
    savingsEvents.splice(0, savingsEvents.length - MAX_EVENTS);
  }

  log.info({ eventId: event.id, category: event.category, savings: event.savings }, "Savings event recorded");

  return event;
}

/**
 * Clear all events (for testing).
 */
export function clearAllEvents(): void {
  savingsEvents.length = 0;
}
