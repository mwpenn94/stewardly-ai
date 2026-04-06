/**
 * Autonomous Training Budget — Uses excess free capacity to improve the app
 * Tracks daily/monthly usage, identifies spare capacity, runs improvement tasks
 * during off-peak hours using the cheapest available models.
 */
import { getDb } from "../db";
import { logger } from "../_core/logger";

const log = logger.child({ module: "autonomousTraining" });

export interface TrainingBudget {
  dailyQueryLimit: number;
  dailyQueriesUsed: number;
  dailyRemaining: number;
  monthlyBudget: number;
  monthlyUsed: number;
  monthlyRemaining: number;
  canRunAutonomous: boolean;
  recommendedModel: string;
}

/** Check how much free capacity is available for autonomous improvement */
export async function getTrainingBudget(scopeId?: number): Promise<TrainingBudget> {
  const db = await getDb();
  const defaults: TrainingBudget = {
    dailyQueryLimit: 50, dailyQueriesUsed: 0, dailyRemaining: 50,
    monthlyBudget: 10, monthlyUsed: 0, monthlyRemaining: 10,
    canRunAutonomous: true, recommendedModel: "gemini-2.0-flash", // cheapest
  };

  if (!db) return defaults;

  try {
    const { usageBudgets } = await import("../../drizzle/schema");
    const { eq, and } = await import("drizzle-orm");

    const [budget] = await db.select().from(usageBudgets)
      .where(and(eq(usageBudgets.scopeType, "platform"), eq(usageBudgets.scopeId, scopeId || 1)))
      .limit(1);

    if (!budget) return defaults;

    const used = budget.currentPeriodQueries || 0;
    const limit = budget.dailyQueryLimit || 50;
    const costUsed = Number(budget.currentPeriodCost) || 0;
    const costLimit = Number(budget.monthlyCostCeiling) || 10;
    const remaining = Math.max(0, limit - used);
    const costRemaining = Math.max(0, costLimit - costUsed);

    // Use excess capacity: only run autonomous tasks when >30% daily budget remains
    const canRun = remaining > limit * 0.3 && costRemaining > 0.50;

    // Pick cheapest model for autonomous work
    const recommendedModel = costRemaining > 2 ? "gemini-2.5-flash" : "gemini-2.0-flash";

    return {
      dailyQueryLimit: limit, dailyQueriesUsed: used, dailyRemaining: remaining,
      monthlyBudget: costLimit, monthlyUsed: costUsed, monthlyRemaining: costRemaining,
      canRunAutonomous: canRun, recommendedModel,
    };
  } catch {
    return defaults;
  }
}

/** Run autonomous improvement tasks using spare capacity */
export async function runAutonomousImprovements(): Promise<{ tasksRun: number; totalCost: number }> {
  const budget = await getTrainingBudget();
  if (!budget.canRunAutonomous) {
    log.info({ remaining: budget.dailyRemaining }, "No spare capacity for autonomous training");
    return { tasksRun: 0, totalCost: 0 };
  }

  let tasksRun = 0;
  let totalCost = 0;
  const maxTasks = Math.min(5, Math.floor(budget.dailyRemaining * 0.2)); // Use max 20% of remaining

  // Task 1: Aggregate episodic memories
  if (maxTasks > 0) {
    try {
      const { aggregateEpisodicSummaries } = await import("./ragTrainer");
      await aggregateEpisodicSummaries(0); // Platform-level aggregation
      tasksRun++;
      totalCost += 0.01;
    } catch { /* non-critical */ }
  }

  // Task 2: Run template optimization on cheapest model
  if (tasksRun < maxTasks) {
    try {
      const { optimizeTemplates } = await import("./templateOptimizer");
      await optimizeTemplates();
      tasksRun++;
      totalCost += 0.05;
    } catch { /* non-critical */ }
  }

  // Task 3: Check selection bias
  if (tasksRun < maxTasks) {
    try {
      const { checkSelectionBias } = await import("./propensity/selectionBiasMonitor");
      await checkSelectionBias();
      tasksRun++;
      totalCost += 0.01;
    } catch { /* non-critical */ }
  }

  log.info({ tasksRun, totalCost, model: budget.recommendedModel }, "Autonomous improvements completed");
  return { tasksRun, totalCost };
}
