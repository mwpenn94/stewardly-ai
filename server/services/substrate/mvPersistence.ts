/**
 * ═══════════════════════════════════════════════════════════════════════════
 * M&V Persistence Layer
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Bridges the in-memory M&V engine to the database for durable storage.
 * Provides:
 *   - Event persistence (write-through from in-memory to DB)
 *   - Period summary materialization (for billing)
 *   - Query helpers for dashboard and invoice generation
 *
 * @substrate-primitive: mv-persistence
 */
import { requireDb } from "../../db";
import { mvSavingsEvents, mvPeriodSummaries } from "../../../drizzle/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { logger } from "../../_core/logger";
import type { SavingsEvent, PeriodSummary, SavingsCategory } from "./measurementVerification";

const log = logger.child({ module: "substrate:mv-persistence" });
// ─── Persist a single savings event ──────────────────────────────────────────────────
export async function persistSavingsEvent(event: SavingsEvent): Promise<void> {
  try {
    const db = await requireDb();
    await db.insert(mvSavingsEvents).values({eventId: event.id,
      userId: event.userId,
      category: event.category,
      actualCost: String(event.actualCost),
      baselineCost: String(event.baselineCost),
      savings: String(event.savings),
      operation: event.metadata.operation,
      model: event.metadata.model || null,
      tokensUsed: event.metadata.tokensUsed || null,
      tokensBaseline: event.metadata.tokensBaseline || null,
      timeMs: event.metadata.timeMs || null,
      baselineTimeMs: event.metadata.baselineTimeMs || null,
      metadata: event.metadata,
    });
    log.debug({ eventId: event.id, category: event.category }, "M&V event persisted");
  } catch (err: any) {
    log.error({ err: err.message, eventId: event.id }, "Failed to persist M&V event");
  }
}

// ─── Batch persist events ────────────────────────────────────────────────────
export async function persistSavingsEventsBatch(events: SavingsEvent[]): Promise<number> {
  if (events.length === 0) return 0;
  const db = await requireDb();
  let persisted = 0;
  // Batch in chunks of 100
  const chunkSize = 100;
  for (let i = 0; i < events.length; i += chunkSize) {
    const chunk = events.slice(i, i + chunkSize);
    try {
      await db.insert(mvSavingsEvents).values(
        chunk.map(event => ({
          eventId: event.id,
          userId: event.userId,
          category: event.category,
          actualCost: String(event.actualCost),
          baselineCost: String(event.baselineCost),
          savings: String(event.savings),
          operation: event.metadata.operation,
          model: event.metadata.model || null,
          tokensUsed: event.metadata.tokensUsed || null,
          tokensBaseline: event.metadata.tokensBaseline || null,
          timeMs: event.metadata.timeMs || null,
          baselineTimeMs: event.metadata.baselineTimeMs || null,
          metadata: event.metadata,
        }))
      );
      persisted += chunk.length;
    } catch (err: any) {
      log.error({ err: err.message, chunkStart: i }, "Failed to persist M&V event batch");
    }
  }
  return persisted;
}

// ─── Query events for a user in a period ─────────────────────────────────────
export async function queryUserEvents(
  userId: number,
  periodStart: Date,
  periodEnd: Date,
  category?: SavingsCategory,
  limit = 100
): Promise<typeof mvSavingsEvents.$inferSelect[]> {
  const conditions = [
    eq(mvSavingsEvents.userId, userId),
    gte(mvSavingsEvents.createdAt, periodStart),
    lte(mvSavingsEvents.createdAt, periodEnd),
  ];
  if (category) {
    conditions.push(eq(mvSavingsEvents.category, category));
  }
  const db = await requireDb();
  return db
    .select()
    .from(mvSavingsEvents)
    .where(and(...conditions))
    .orderBy(desc(mvSavingsEvents.createdAt))
    .limit(limit);
}

// ─── Materialize a period summary ────────────────────────────────────────────
export async function materializePeriodSummary(
  userId: number,
  periodStart: Date,
  periodEnd: Date,
  customerSavingsShare = 0.3
): Promise<PeriodSummary> {
  // Aggregate from DB
  const db = await requireDb();
  const rows = await db
    .select({
      category: mvSavingsEvents.category,
      totalSavings: sql<string>`SUM(${mvSavingsEvents.savings})`,
      eventCount: sql<number>`COUNT(*)`,
    })
    .from(mvSavingsEvents)
    .where(
      and(
        eq(mvSavingsEvents.userId, userId),
        gte(mvSavingsEvents.createdAt, periodStart),
        lte(mvSavingsEvents.createdAt, periodEnd)
      )
    )
    .groupBy(mvSavingsEvents.category);

  const byCategory: Record<SavingsCategory, number> = {
    ai_cost_optimization: 0,
    time_savings: 0,
    search_efficiency: 0,
    document_processing: 0,
    compliance_automation: 0,
    memory_context_reduction: 0,
  };
  let totalSavings = 0;
  let eventCount = 0;

  for (const row of rows) {
    const amt = parseFloat(row.totalSavings || "0");
    byCategory[row.category as SavingsCategory] = amt;
    totalSavings += amt;
    eventCount += row.eventCount;
  }

  const creditAmount = totalSavings * customerSavingsShare;

  // Upsert the summary
  await db.insert(mvPeriodSummaries).values({
    userId,
    periodStart,
    periodEnd,
    totalSavings: String(totalSavings),
    aiCostOptimization: String(byCategory.ai_cost_optimization),
    timeSavings: String(byCategory.time_savings),
    searchEfficiency: String(byCategory.search_efficiency),
    documentProcessing: String(byCategory.document_processing),
    complianceAutomation: String(byCategory.compliance_automation),
    memoryContextReduction: String(byCategory.memory_context_reduction),
    eventCount,
    customerSavingsShare: String(customerSavingsShare),
    creditAmount: String(creditAmount),
  });

  log.info({ userId, totalSavings, creditAmount, eventCount }, "Period summary materialized");

  return {
    userId,
    periodStart: periodStart.getTime(),
    periodEnd: periodEnd.getTime(),
    totalSavings,
    byCategory,
    eventCount,
    customerSavingsShare,
    creditAmount,
  };
}

// ─── Get latest period summary for a user ────────────────────────────────────
export async function getLatestPeriodSummary(userId: number) {
  const db = await requireDb();
  const [row] = await db
    .select()
    .from(mvPeriodSummaries)
    .where(eq(mvPeriodSummaries.userId, userId))
    .orderBy(desc(mvPeriodSummaries.periodEnd))
    .limit(1);
  return row || null;
}

// ─── Get all summaries for a user (for billing history) ──────────────────────
export async function getUserPeriodSummaries(userId: number, limit = 12) {
  const db = await requireDb();
  return db
    .select()
    .from(mvPeriodSummaries)
    .where(eq(mvPeriodSummaries.userId, userId))
    .orderBy(desc(mvPeriodSummaries.periodEnd))
    .limit(limit);
}

// ─── Get total savings across all users (platform metrics) ───────────────────
export async function getPlatformSavingsMetrics() {
  const db = await requireDb();
  const [result] = await db
    .select({
      totalSavings: sql<string>`SUM(${mvSavingsEvents.savings})`,
      totalEvents: sql<number>`COUNT(*)`,
      uniqueUsers: sql<number>`COUNT(DISTINCT ${mvSavingsEvents.userId})`,
    })
    .from(mvSavingsEvents);

  return {
    totalSavings: parseFloat(result?.totalSavings || "0"),
    totalEvents: result?.totalEvents || 0,
    uniqueUsers: result?.uniqueUsers || 0,
  };
}
