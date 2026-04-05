/**
 * Usage Tracker — Track LLM usage per user with budget enforcement
 * Free tier: 50 queries/day, 1000/month, $10/month cost ceiling
 */
import { getDb } from "../db";
import { logger } from "../_core/logger";

const log = logger.child({ module: "usageTracker" });

export interface BudgetCheck {
  allowed: boolean;
  remaining: { queries: number; cost: number };
  warning: boolean;
  message?: string;
}

export async function trackUsage(params: {
  userId: number;
  operationType: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    const { usageTracking, usageBudgets } = await import("../../drizzle/schema");
    const { eq, and } = await import("drizzle-orm");

    await db.insert(usageTracking).values({
      userId: params.userId,
      operationType: params.operationType,
      model: params.model,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      estimatedCost: String(params.estimatedCost),
    });

    // Increment budget counters
    const { sql } = await import("drizzle-orm");
    await db.update(usageBudgets)
      .set({
        currentPeriodQueries: sql`${usageBudgets.currentPeriodQueries} + 1`,
        currentPeriodCost: sql`${usageBudgets.currentPeriodCost} + ${params.estimatedCost}`,
      })
      .where(and(eq(usageBudgets.scopeType, "user"), eq(usageBudgets.scopeId, params.userId)));
  } catch (e: any) {
    log.warn({ error: e.message }, "Usage tracking failed");
  }
}

export async function checkBudget(userId: number): Promise<BudgetCheck> {
  const db = await getDb();
  if (!db) return { allowed: true, remaining: { queries: 999, cost: 999 }, warning: false };

  try {
    const { usageBudgets } = await import("../../drizzle/schema");
    const { eq, and } = await import("drizzle-orm");

    const [budget] = await db.select().from(usageBudgets)
      .where(and(eq(usageBudgets.scopeType, "user"), eq(usageBudgets.scopeId, userId)))
      .limit(1);

    if (!budget) return { allowed: true, remaining: { queries: 50, cost: 10 }, warning: false };

    const queriesUsed = budget.currentPeriodQueries || 0;
    const costUsed = Number(budget.currentPeriodCost) || 0;
    const queryLimit = budget.dailyQueryLimit || 50;
    const costLimit = Number(budget.monthlyCostCeiling) || 10;
    const alertPct = (budget.alertThresholdPct || 80) / 100;

    const queriesRemaining = Math.max(0, queryLimit - queriesUsed);
    const costRemaining = Math.max(0, costLimit - costUsed);
    const exceeded = queriesRemaining === 0 || costRemaining <= 0;
    const warning = (queriesUsed / queryLimit >= alertPct) || (costUsed / costLimit >= alertPct);

    return {
      allowed: !exceeded,
      remaining: { queries: queriesRemaining, cost: Math.round(costRemaining * 100) / 100 },
      warning,
      message: exceeded ? "You've reached your usage limit. Resets at midnight." : undefined,
    };
  } catch {
    return { allowed: true, remaining: { queries: 999, cost: 999 }, warning: false };
  }
}
