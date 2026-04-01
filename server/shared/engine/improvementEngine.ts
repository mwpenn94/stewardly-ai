/**
 * Recursive Improvement Engine
 *
 * Detects quality signals, generates improvement hypotheses,
 * checks convergence, and prevents regressions.
 */
import { eq, sql, and, gte, lte, count, avg, isNull } from "drizzle-orm";
import {
  improvementSignals,
  improvementHypotheses,
  hypothesisTestResults,
  messages,
  aiTools,
  aiToolCalls,
  qualityRatings,
  aiResponseQuality,
} from "../../../drizzle/schema";
import { logger } from "../../_core/logger";

// ── Types ────────────────────────────────────────────────────────────────────

export interface Signal {
  signalType: string;
  severity: "critical" | "high" | "medium" | "low";
  sourceMetric: string;
  sourceValue: string;
  threshold: string;
}

export interface ConvergenceResult {
  status: "CONVERGED" | "ACTIVE";
  currentRate?: number;
  windows?: { start: Date; end: Date; rate: number }[];
}

export interface QualityDimensions {
  accuracy: number;
  latency: number;
  user_satisfaction: number;
  cost_efficiency: number;
  reliability: number;
}

export interface RegressionResult {
  regressed: boolean;
  dimension?: string;
  zScore?: number;
}

const DIMENSION_WEIGHTS: Record<keyof QualityDimensions, number> = {
  accuracy: 0.25,
  latency: 0.25,
  user_satisfaction: 0.20,
  cost_efficiency: 0.15,
  reliability: 0.15,
};

// ── Circuit Breaker for DB-heavy signal detection ───────────────────────────
// Prevents cascading failures if the DB is slow or unresponsive.
const QUERY_TIMEOUT_MS = 10_000;

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`[ImprovementEngine] Query timeout: ${label} exceeded ${QUERY_TIMEOUT_MS}ms`)), QUERY_TIMEOUT_MS),
    ),
  ]);
}

// ── Signal Detection ─────────────────────────────────────────────────────────

export async function detectSignals(db: any): Promise<Signal[]> {
  const signals: Signal[] = [];
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // ── FUNDAMENTAL: sessions without contextualLLM metadata in last 24h ──
  try {
    const [totalRecent] = await db
      .select({ cnt: count() })
      .from(messages)
      .where(
        and(
          gte(messages.createdAt, oneDayAgo),
          eq(messages.role, "assistant"),
        ),
      );

    const [bypassRecent] = await db
      .select({ cnt: count() })
      .from(messages)
      .where(
        and(
          gte(messages.createdAt, oneDayAgo),
          eq(messages.role, "assistant"),
          sql`JSON_EXTRACT(${messages.metadata}, '$.contextualLLM') IS NULL`,
        ),
      );

    const total = totalRecent?.cnt ?? 0;
    const bypass = bypassRecent?.cnt ?? 0;

    if (total > 0) {
      const bypassRate = bypass / total;
      if (bypassRate > 0.20) {
        signals.push({
          signalType: "FUNDAMENTAL",
          severity: "critical",
          sourceMetric: "contextualLLM_bypass_rate",
          sourceValue: `${bypass}/${total} = ${(bypassRate * 100).toFixed(1)}%`,
          threshold: ">20%",
        });
      }
    }
  } catch (err) {
    logger.debug({ err }, "[ImprovementEngine] FUNDAMENTAL signal check skipped");
  }

  // ── LANDSCAPE: active tools with no calls in 7 days ──
  try {
    const unusedTools = await db
      .select({ toolName: aiTools.toolName, toolId: aiTools.id })
      .from(aiTools)
      .where(eq(aiTools.active, true))
      .then(async (tools: any[]) => {
        const unused: string[] = [];
        for (const tool of tools) {
          const [callCount] = await db
            .select({ cnt: count() })
            .from(aiToolCalls)
            .where(
              and(
                eq(aiToolCalls.toolId, tool.toolId),
                gte(aiToolCalls.createdAt, sevenDaysAgo),
              ),
            );
          if ((callCount?.cnt ?? 0) === 0) {
            unused.push(tool.toolName);
          }
        }
        return unused;
      });

    if (unusedTools.length > 0) {
      signals.push({
        signalType: "LANDSCAPE",
        severity: "medium",
        sourceMetric: "unused_active_tools",
        sourceValue: unusedTools.join(", "),
        threshold: "0 calls in 7 days",
      });
    }
  } catch (err) {
    logger.debug({ err }, "[ImprovementEngine] LANDSCAPE signal check skipped");
  }

  // ── DEPTH: quality score clustering (top bucket >60%) ──
  try {
    const recentScores = await db
      .select({ score: qualityRatings.score })
      .from(qualityRatings)
      .where(gte(qualityRatings.createdAt, sevenDaysAgo));

    if (recentScores.length > 10) {
      const scores = recentScores.map((r: any) => r.score);
      const maxScore = Math.max(...scores);
      const topBucketThreshold = maxScore * 0.9;
      const topBucketCount = scores.filter((s: number) => s >= topBucketThreshold).length;
      const topBucketRate = topBucketCount / scores.length;

      if (topBucketRate > 0.60) {
        signals.push({
          signalType: "DEPTH",
          severity: "medium",
          sourceMetric: "quality_score_clustering",
          sourceValue: `${(topBucketRate * 100).toFixed(1)}% in top bucket`,
          threshold: ">60% clustered",
        });
      }
    }
  } catch (err) {
    logger.debug({ err }, "[ImprovementEngine] DEPTH quality clustering check skipped");
  }

  // ── ADVERSARIAL: retry-after-cache events (user re-asked within 60s) ──
  try {
    const retryEvents = await db.execute(
      sql`SELECT COUNT(*) as cnt FROM ${messages} m1
          WHERE m1.role = 'user'
          AND m1.created_at >= ${oneDayAgo}
          AND EXISTS (
            SELECT 1 FROM ${messages} m2
            WHERE m2.conversation_id = m1.conversation_id
            AND m2.role = 'user'
            AND m2.id < m1.id
            AND TIMESTAMPDIFF(SECOND, m2.created_at, m1.created_at) < 60
            AND m2.content = m1.content
          )`,
    );

    const retryCount = retryEvents?.[0]?.[0]?.cnt ?? retryEvents?.[0]?.cnt ?? 0;
    if (retryCount > 5) {
      signals.push({
        signalType: "ADVERSARIAL",
        severity: "high",
        sourceMetric: "retry_after_cache",
        sourceValue: `${retryCount} events in 24h`,
        threshold: ">5 events",
      });
    }
  } catch (err) {
    logger.debug({ err }, "[ImprovementEngine] ADVERSARIAL retry check skipped");
  }

  // ── ADVERSARIAL: promoted hypotheses with no quality improvement ──
  try {
    const promotedWithResults = await db
      .select({
        hypothesisId: improvementHypotheses.id,
        qualityBefore: hypothesisTestResults.qualityBefore,
        qualityAfter: hypothesisTestResults.qualityAfter,
      })
      .from(improvementHypotheses)
      .innerJoin(
        hypothesisTestResults,
        eq(hypothesisTestResults.hypothesisId, improvementHypotheses.id),
      )
      .where(eq(improvementHypotheses.status, "promoted"));

    for (const row of promotedWithResults) {
      const before = row.qualityBefore as QualityDimensions | null;
      const after = row.qualityAfter as QualityDimensions | null;
      if (before && after) {
        const beforeAvg = Object.values(before).reduce((a: number, b: number) => a + b, 0) / Object.keys(before).length;
        const afterAvg = Object.values(after).reduce((a: number, b: number) => a + b, 0) / Object.keys(after).length;
        if (afterAvg <= beforeAvg) {
          signals.push({
            signalType: "ADVERSARIAL",
            severity: "high",
            sourceMetric: "promoted_no_improvement",
            sourceValue: `hypothesis ${row.hypothesisId}: before=${beforeAvg.toFixed(2)}, after=${afterAvg.toFixed(2)}`,
            threshold: "post-promotion quality <= pre-promotion",
          });
        }
      }
    }
  } catch (err) {
    logger.debug({ err }, "[ImprovementEngine] ADVERSARIAL promotion check skipped");
  }

  // ── FUTURE_STATE: new LLM provider with no calibration data ──
  try {
    const recentModels = await db
      .select({ model: messages.modelVersion })
      .from(messages)
      .where(
        and(
          gte(messages.createdAt, oneDayAgo),
          sql`${messages.modelVersion} IS NOT NULL`,
        ),
      )
      .groupBy(messages.modelVersion);

    const recentModelSet = new Set<string>(recentModels.map((r: any) => r.model as string));

    for (const model of Array.from(recentModelSet)) {
      // Check if this model has fewer than 10 total messages (new/uncalibrated)
      const [modelCount] = await db
        .select({ cnt: count() })
        .from(messages)
        .where(
          and(
            eq(messages.modelVersion, model as string),
            lte(messages.createdAt, oneDayAgo),
          ),
        );

      if ((modelCount?.cnt ?? 0) < 10) {
        signals.push({
          signalType: "FUTURE_STATE",
          severity: "low",
          sourceMetric: "uncalibrated_model",
          sourceValue: model,
          threshold: "<10 historical messages",
        });
      }
    }
  } catch (err) {
    logger.debug({ err }, "[ImprovementEngine] FUTURE_STATE signal check skipped");
  }

  return signals;
}

// ── Convergence Check ────────────────────────────────────────────────────────

export async function checkConvergence(db: any): Promise<ConvergenceResult> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  try {
    // Get total hypotheses in last 30 days
    const [totalResult] = await db
      .select({ cnt: count() })
      .from(improvementHypotheses)
      .where(gte(improvementHypotheses.createdAt, thirtyDaysAgo));

    const totalHypotheses = totalResult?.cnt ?? 0;

    if (totalHypotheses === 0) {
      return { status: "ACTIVE", currentRate: 0 };
    }

    // Get promoted hypotheses in last 30 days
    const [promotedResult] = await db
      .select({ cnt: count() })
      .from(improvementHypotheses)
      .where(
        and(
          gte(improvementHypotheses.createdAt, thirtyDaysAgo),
          eq(improvementHypotheses.status, "promoted"),
        ),
      );

    const promotedCount = promotedResult?.cnt ?? 0;
    const currentRate = promotedCount / totalHypotheses;

    // Check 3 consecutive 10-day windows
    const windows: { start: Date; end: Date; rate: number }[] = [];

    for (let i = 0; i < 3; i++) {
      const windowEnd = new Date(now.getTime() - i * 10 * 24 * 60 * 60 * 1000);
      const windowStart = new Date(windowEnd.getTime() - 10 * 24 * 60 * 60 * 1000);

      const [windowTotal] = await db
        .select({ cnt: count() })
        .from(improvementHypotheses)
        .where(
          and(
            gte(improvementHypotheses.createdAt, windowStart),
            lte(improvementHypotheses.createdAt, windowEnd),
          ),
        );

      const [windowPromoted] = await db
        .select({ cnt: count() })
        .from(improvementHypotheses)
        .where(
          and(
            gte(improvementHypotheses.createdAt, windowStart),
            lte(improvementHypotheses.createdAt, windowEnd),
            eq(improvementHypotheses.status, "promoted"),
          ),
        );

      const wTotal = windowTotal?.cnt ?? 0;
      const wPromoted = windowPromoted?.cnt ?? 0;
      const rate = wTotal > 0 ? wPromoted / wTotal : 0;

      windows.push({ start: windowStart, end: windowEnd, rate });
    }

    // All 3 windows must have rate < 0.10 for convergence
    const allBelowThreshold = windows.every((w) => w.rate < 0.10);

    if (allBelowThreshold && totalHypotheses >= 3) {
      return { status: "CONVERGED", currentRate, windows };
    }

    return { status: "ACTIVE", currentRate, windows };
  } catch (err) {
    logger.debug({ err }, "[ImprovementEngine] Convergence check failed");
    return { status: "ACTIVE", currentRate: 0 };
  }
}

// ── Anti-Regression Check ────────────────────────────────────────────────────

export function antiRegressionCheck(
  qualityBefore: QualityDimensions,
  qualityAfter: QualityDimensions,
  historicalScores: QualityDimensions[],
): RegressionResult {
  const dimensions = Object.keys(DIMENSION_WEIGHTS) as (keyof QualityDimensions)[];

  // Fallback: if fewer than 10 historical data points, use simple percentage check
  if (historicalScores.length < 10) {
    for (const dim of dimensions) {
      const before = qualityBefore[dim];
      const after = qualityAfter[dim];
      if (before > 0) {
        const decline = (before - after) / before;
        if (decline > 0.05) {
          return { regressed: true, dimension: dim, zScore: -decline * 10 };
        }
      }
    }
    return { regressed: false };
  }

  // Full z-score check with historical standard deviation
  for (const dim of dimensions) {
    const historicalValues = historicalScores.map((s) => s[dim]);
    const mean = historicalValues.reduce((a, b) => a + b, 0) / historicalValues.length;
    const variance =
      historicalValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) /
      historicalValues.length;
    const stddev = Math.sqrt(variance);

    if (stddev === 0) continue; // No variation — skip

    const z = (qualityAfter[dim] - qualityBefore[dim]) / stddev;

    if (z < -1.5) {
      return { regressed: true, dimension: dim, zScore: z };
    }
  }

  return { regressed: false };
}
