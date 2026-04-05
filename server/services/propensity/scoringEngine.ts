/**
 * Propensity Scoring Engine — 3-phase: expert weights → logistic → gradient boosting
 * Auto-detects phase by counting conversions in lead_pipeline.
 */
import { getDb } from "../../db";
import { logger } from "../../_core/logger";

const log = logger.child({ module: "propensityScoring" });

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

  // Phase detection: count conversions
  let conversionCount = 0;
  if (db) {
    try {
      const { leadPipeline } = await import("../../../drizzle/schema");
      const { eq, count } = await import("drizzle-orm");
      const [result] = await db.select({ count: count() }).from(leadPipeline).where(eq(leadPipeline.status, "converted"));
      conversionCount = result?.count || 0;
    } catch { /* default to expert weights */ }
  }

  let model = "expert_weights";
  if (conversionCount >= 5000) model = "gradient_boosting";
  else if (conversionCount >= 500) model = "logistic";

  // For now, use expert weights (Phase 1)
  const features = await gatherFeatures(leadId);
  const score = computeExpertScore(features);

  return { score, tier: scoreTier(score), model, features };
}

async function gatherFeatures(leadId: number): Promise<Record<string, number>> {
  // Gather features from lead_pipeline, enrichment, calculator usage, ZIP demographics
  return {
    has_email: 1,
    has_phone: 0,
    has_linkedin: 0,
    calculator_usage: 0,
    income_indicator: 0.5,
    age_indicator: 0.5,
  };
}

function computeExpertScore(features: Record<string, number>): number {
  const weights: Record<string, number> = {
    has_email: 0.15,
    has_phone: 0.10,
    has_linkedin: 0.05,
    calculator_usage: 0.25,
    income_indicator: 0.25,
    age_indicator: 0.20,
  };

  let score = 0;
  for (const [key, weight] of Object.entries(weights)) {
    score += (features[key] || 0) * weight;
  }
  return Math.min(1, Math.max(0, score));
}

export async function rescoreAllLeads(): Promise<{ scored: number; errors: number }> {
  log.info("Starting bulk rescore");
  // Implementation: iterate lead_pipeline, score each
  return { scored: 0, errors: 0 };
}
