/**
 * Improvement Cycle Runner — hydrates real DB data into the 6 learning loops.
 *
 * This module bridges the gap between the pure-function improvement loops
 * (improvementLoops.ts) and the live database. It:
 *   1. Queries model_runs, feedback, ai_tool_calls for ComputationLog data
 *   2. Queries proactive_insights for AlertOutcome data
 *   3. Queries messages + conversations for UserActivity data
 *   4. Runs the full improvement cycle
 *   5. Generates hypotheses and persists them to improvement_hypotheses
 *   6. Optionally enriches top hypotheses with LLM descriptions
 *
 * Called by the scheduler every 6 hours alongside detectSignals.
 */

import { logger } from "../../_core/logger";
import {
  runImprovementCycle,
  generateHypotheses,
  enrichHypothesesWithLLM,
  type ComputationLog,
  type AlertOutcome,
  type UserActivity,
  type SensitivityInput,
  type CompetitorFeature,
  type ImprovementCycleResult,
  type Hypothesis,
} from "./improvementLoops";

/**
 * Hydrate ComputationLog[] from model_runs + feedback tables.
 * Looks back 90 days for calibration + recommendation quality loops.
 */
async function hydrateComputationLogs(db: any): Promise<ComputationLog[]> {
  const logs: ComputationLog[] = [];
  try {
    const { modelRuns, feedback } = await import("../../../drizzle/schema");
    const { desc, gte, sql } = await import("drizzle-orm");

    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // Fetch completed model runs from the last 90 days
    const runs = await db
      .select()
      .from(modelRuns)
      .where(gte(modelRuns.createdAt, cutoff))
      .orderBy(desc(modelRuns.createdAt))
      .limit(500);

    // Build a set of run IDs that have feedback
    const feedbackRows = await db
      .select()
      .from(feedback)
      .where(gte(feedback.createdAt, cutoff))
      .limit(1000);

    // Index feedback by messageId for lookup
    const feedbackByMessage = new Map<number, string>();
    for (const fb of feedbackRows) {
      feedbackByMessage.set(
        fb.messageId,
        fb.rating === "up" ? "accepted" : "rejected",
      );
    }

    for (const run of runs) {
      const inputData =
        typeof run.inputData === "string"
          ? JSON.parse(run.inputData)
          : run.inputData || {};
      const outputData =
        typeof run.outputData === "string"
          ? JSON.parse(run.outputData)
          : run.outputData || {};

      logs.push({
        id: run.id,
        timestamp: run.createdAt,
        toolName: run.modelId || "unknown",
        trigger: run.triggeredBy || "unknown",
        input: inputData,
        result: outputData,
        userAction: undefined, // model_runs don't have direct user feedback
        actualOutcome: outputData.actualOutcome || undefined,
      });
    }

    // Also hydrate from ai_tool_calls for richer tool-level data
    try {
      const { aiToolCalls } = await import("../../../drizzle/schema");
      const toolCalls = await db
        .select()
        .from(aiToolCalls)
        .where(gte(aiToolCalls.createdAt, cutoff))
        .orderBy(desc(aiToolCalls.createdAt))
        .limit(500);

      for (const tc of toolCalls) {
        const input =
          typeof tc.inputData === "string"
            ? JSON.parse(tc.inputData)
            : tc.inputData || {};
        const result =
          typeof tc.resultData === "string"
            ? JSON.parse(tc.resultData)
            : tc.resultData || {};

        logs.push({
          id: `tc-${tc.id}`,
          timestamp: tc.createdAt,
          toolName: tc.toolName || "unknown",
          trigger: "tool_call",
          input,
          result,
          userAction: feedbackByMessage.has(tc.messageId)
            ? (feedbackByMessage.get(tc.messageId) as "accepted" | "rejected")
            : undefined,
        });
      }
    } catch {
      // ai_tool_calls table may not exist in all envs
    }
  } catch (e) {
    logger.warn(
      { operation: "improvementCycleRunner" },
      `Failed to hydrate computation logs: ${e}`,
    );
  }
  return logs;
}

/**
 * Hydrate AlertOutcome[] from proactive_insights table.
 * Each insight that was dismissed = not acted upon; clicked = acted upon.
 */
async function hydrateAlertOutcomes(db: any): Promise<AlertOutcome[]> {
  const outcomes: AlertOutcome[] = [];
  try {
    const { proactiveInsights } = await import("../../../drizzle/schema");
    const { gte, desc } = await import("drizzle-orm");

    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const insights = await db
      .select()
      .from(proactiveInsights)
      .where(gte(proactiveInsights.createdAt, cutoff))
      .orderBy(desc(proactiveInsights.createdAt))
      .limit(500);

    for (const insight of insights) {
      outcomes.push({
        trigger: insight.insightType || insight.type || "general",
        actedUpon: insight.status === "acted" || insight.status === "clicked",
      });
    }
  } catch (e) {
    logger.warn(
      { operation: "improvementCycleRunner" },
      `Failed to hydrate alert outcomes: ${e}`,
    );
  }
  return outcomes;
}

/**
 * Hydrate UserActivity[] from messages + conversations tables.
 * Counts distinct conversations per user in the last quarter as "scenarios".
 */
async function hydrateUserActivity(db: any): Promise<UserActivity[]> {
  const activities: UserActivity[] = [];
  try {
    const { messages, feedback } = await import("../../../drizzle/schema");
    const { sql, gte } = await import("drizzle-orm");

    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // Count distinct conversations per user as "scenariosThisQuarter"
    const userScenarios = await db
      .select({
        userId: messages.userId,
        scenarioCount: sql<number>`COUNT(DISTINCT ${messages.conversationId})`,
      })
      .from(messages)
      .where(gte(messages.createdAt, cutoff))
      .groupBy(messages.userId)
      .limit(200);

    // Get feedback acceptance rates per user
    const userFeedback = await db
      .select({
        userId: feedback.userId,
        totalFeedback: sql<number>`COUNT(*)`,
        upCount: sql<number>`SUM(CASE WHEN ${feedback.rating} = 'up' THEN 1 ELSE 0 END)`,
      })
      .from(feedback)
      .where(gte(feedback.createdAt, cutoff))
      .groupBy(feedback.userId)
      .limit(200);

    const feedbackMap = new Map<number, number>();
    for (const uf of userFeedback) {
      const total = Number(uf.totalFeedback) || 1;
      const ups = Number(uf.upCount) || 0;
      feedbackMap.set(uf.userId, ups / total);
    }

    for (const us of userScenarios) {
      activities.push({
        userId: us.userId,
        scenariosThisQuarter: Number(us.scenarioCount) || 0,
        agentInitiatedAcceptanceRate: feedbackMap.get(us.userId) ?? 0.5,
      });
    }
  } catch (e) {
    logger.warn(
      { operation: "improvementCycleRunner" },
      `Failed to hydrate user activity: ${e}`,
    );
  }
  return activities;
}

/**
 * Persist generated hypotheses to the improvement_hypotheses table.
 */
async function persistHypotheses(
  db: any,
  hypotheses: Hypothesis[],
): Promise<number> {
  let persisted = 0;
  try {
    const { improvementHypotheses } = await import("../../../drizzle/schema");

    for (const h of hypotheses.slice(0, 20)) {
      // Cap at 20 per cycle
      try {
        await db.insert(improvementHypotheses).values({
          signalId: 0, // No specific signal — generated from cycle
          passType: h.source,
          scope: JSON.stringify({
            title: h.title,
            proposedChange: h.proposedChange,
            measurableOutcome: h.measurableOutcome,
            successThreshold: h.successThreshold,
            priority: h.priority,
            autoTestable: h.autoTestable,
          }),
          hypothesisText: h.description,
          expectedDelta: h.successThreshold,
          creditBudget: h.estimatedEffortHours,
          status: "pending",
        });
        persisted++;
      } catch {
        // Silently skip insertion errors (e.g., duplicates)
      }
    }
  } catch (e) {
    logger.warn(
      { operation: "improvementCycleRunner" },
      `Failed to persist hypotheses: ${e}`,
    );
  }
  return persisted;
}

/**
 * Run the full improvement cycle with real DB data.
 * This is the top-level function called by the scheduler.
 */
export async function executeImprovementCycle(db: any): Promise<{
  cycleResult: ImprovementCycleResult;
  hypothesesGenerated: number;
  hypothesesPersisted: number;
  dataStats: {
    computationLogs: number;
    alertOutcomes: number;
    userActivity: number;
  };
}> {
  // 1. Hydrate all input data from DB
  const [computationLogs, alertOutcomes, userActivity] = await Promise.all([
    hydrateComputationLogs(db),
    hydrateAlertOutcomes(db),
    hydrateUserActivity(db),
  ]);

  logger.info(
    { operation: "improvementCycleRunner" },
    `Hydrated improvement data: ${computationLogs.length} logs, ${alertOutcomes.length} alerts, ${userActivity.length} users`,
  );

  // 2. Run the pure improvement cycle
  const cycleResult = runImprovementCycle({
    computationLogs,
    alertOutcomes,
    userActivity,
    // Sensitivity inputs require pre-computed variations — use empty for now
    // (the sensitivity loop will produce 0 rankings with empty input, which is correct)
    sensitivityInputs: [],
    // Competitive features are manually managed — empty for automated runs
    competitorFeatures: [],
  });

  // 3. Generate hypotheses from the cycle results
  let hypotheses = generateHypotheses(cycleResult);

  // 4. Optionally enrich top hypotheses with LLM (non-critical)
  if (hypotheses.length > 0) {
    try {
      const { contextualLLM } = await import("../contextualLLM");
      hypotheses = await enrichHypothesesWithLLM(
        hypotheses,
        async (prompt: string) => {
          const result = await contextualLLM({
            messages: [{ role: "user", content: prompt }],
            taskType: "analysis",
            contextType: "analysis",
          });
          return result.choices?.[0]?.message?.content || "";
        },
      );
    } catch {
      // LLM enrichment is non-critical — hypotheses remain with original text
    }
  }

  // 5. Persist hypotheses to DB
  const hypothesesPersisted = await persistHypotheses(db, hypotheses);

  logger.info(
    { operation: "improvementCycleRunner" },
    `Improvement cycle complete: ${hypotheses.length} hypotheses generated, ${hypothesesPersisted} persisted. ` +
      `Calibration: ${cycleResult.defaultCalibration.proposedAdjustments.length} adjustments. ` +
      `Recommendation quality: acceptance=${(cycleResult.recommendationQuality.metrics.acceptanceRate * 100).toFixed(0)}%. ` +
      `Trigger tuning: ${cycleResult.triggerTuning.proposedAdjustments.length} adjustments. ` +
      `User clusters: ${Object.entries(cycleResult.userClusters).map(([k, v]) => `${k}=${(v as number[]).length}`).join(", ")}.`,
  );

  return {
    cycleResult,
    hypothesesGenerated: hypotheses.length,
    hypothesesPersisted,
    dataStats: {
      computationLogs: computationLogs.length,
      alertOutcomes: alertOutcomes.length,
      userActivity: userActivity.length,
    },
  };
}
