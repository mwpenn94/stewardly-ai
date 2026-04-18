/**
 * Propensity Scoring Engine — Reads scores written by Python pipeline
 * =====================================================================
 * REPLACES the stub version that returned hardcoded features.
 * 
 * The Python pipeline (running as a sidecar on port 8100) does the actual
 * scoring — 8-segment feature engineering, contact completeness modifier,
 * geo-tier weighting. It writes results to propensity_scores table.
 * 
 * This TypeScript module:
 *   1. Reads the latest score for a given lead
 *   2. Triggers the Python pipeline for bulk rescoring
 *   3. Provides tier classification consistent with pipeline output
 * 
 * Tier mapping: Pipeline A/B/C/D → Stewardly hot/warm/cool/cold
 */
import { getDb } from "../../db";
import { logger } from "../../_core/logger";

const log = logger.child({ module: "propensityScoring" });

const PIPELINE_URL = process.env.PIPELINE_URL || "http://localhost:8100";

export interface PropensityResult {
  score: number; // 0-1
  tier: "hot" | "warm" | "cool" | "cold";
  model: string;
  features: Record<string, number>;
}

function scoreTier(score: number): "hot" | "warm" | "cool" | "cold" {
  if (score >= 0.75) return "hot";
  if (score >= 0.50) return "warm";
  if (score >= 0.25) return "cool";
  return "cold";
}

export async function scoreLead(leadId: number): Promise<PropensityResult> {
  const db = await getDb();
  if (!db) {
    return { score: 0, tier: "cold", model: "unavailable", features: {} };
  }

  try {
    // Read latest score from propensity_scores (written by Python pipeline)
    const { propensityScores } = await import("../../../drizzle/schema");
    const { eq, desc } = await import("drizzle-orm");

    const [latest] = await db
      .select()
      .from(propensityScores)
      .where(eq(propensityScores.leadId, leadId))
      .orderBy(desc(propensityScores.scoredAt))
      .limit(1);

    if (!latest) {
      // No score yet — try triggering pipeline for this lead
      log.info({ leadId }, "No score found — triggering pipeline");
      try {
        await fetch(`${PIPELINE_URL}/api/v1/pipeline/score`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lead_id: leadId }),
        });
      } catch {
        // Pipeline may not be running — return default
      }
      return { score: 0, tier: "cold", model: "not_scored", features: {} };
    }

    const score = Number(latest.score);
    return {
      score,
      tier: scoreTier(score),
      model: "pipeline_phase0",
      features: (latest.featuresUsed as Record<string, number>) ?? {},
    };
  } catch (e: any) {
    log.error({ error: e.message, leadId }, "Score read failed");
    return { score: 0, tier: "cold", model: "error", features: {} };
  }
}

export async function rescoreAllLeads(): Promise<{
  scored: number;
  errors: number;
}> {
  log.info("Triggering bulk rescore via Python pipeline");

  try {
    const res = await fetch(`${PIPELINE_URL}/api/v1/pipeline/score`, {
      method: "POST",
    });
    if (!res.ok) {
      const body = await res.text();
      log.error({ status: res.status, body }, "Pipeline rescore failed");
      return { scored: 0, errors: 1 };
    }
    const result = await res.json();
    log.info({ result }, "Bulk rescore triggered");
    return { scored: result.scored || 0, errors: 0 };
  } catch (e: any) {
    log.error({ error: e.message }, "Pipeline unreachable for rescore");
    return { scored: 0, errors: 1 };
  }
}

/**
 * Get score history for a lead (for charts in LeadDetail page)
 */
export async function getScoreHistory(
  leadId: number,
): Promise<Array<{ score: number; model: string; scoredAt: Date }>> {
  const db = await getDb();
  if (!db) return [];

  try {
    const { propensityScores } = await import("../../../drizzle/schema");
    const { eq, desc } = await import("drizzle-orm");

    const rows = await db
      .select()
      .from(propensityScores)
      .where(eq(propensityScores.leadId, leadId))
      .orderBy(desc(propensityScores.scoredAt))
      .limit(20);

    return rows.map((r) => ({
      score: Number(r.score),
      model: `model_${r.modelId}`,
      scoredAt: r.scoredAt ? new Date(r.scoredAt) : new Date(),
    }));
  } catch {
    return [];
  }
}
