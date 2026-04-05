/**
 * Feature Gatherer — Collect features from lead_pipeline, enrichment, calculator, ZIP demographics
 */
import { getDb } from "../../db";

export async function gatherFeatures(leadId: number): Promise<Record<string, number>> {
  const features: Record<string, number> = {};
  const db = await getDb();
  if (!db) return features;

  try {
    const { leadPipeline, leadProfileAccumulator, calculatorResultCache, zipCodeDemographics } = await import("../../../drizzle/schema");
    const { eq } = await import("drizzle-orm");

    // Lead pipeline data
    const [lead] = await db.select().from(leadPipeline).where(eq(leadPipeline.id, leadId)).limit(1);
    if (!lead) return features;

    features.has_email = lead.emailHash ? 1 : 0;
    features.has_phone = lead.phoneHash ? 1 : 0;
    features.has_linkedin = lead.linkedinUrl ? 1 : 0;
    features.has_company = lead.company ? 1 : 0;

    // Enrichment data
    if (lead.enrichmentData) {
      const enrichment = typeof lead.enrichmentData === "string" ? JSON.parse(lead.enrichmentData) : lead.enrichmentData;
      features.income_indicator = enrichment.estimatedIncome ? Math.min(1, (enrichment.estimatedIncome as number) / 250000) : 0;
      features.has_title = enrichment.title ? 1 : 0;
    }

    // Progressive profile data points
    const profilePoints = await db.select().from(leadProfileAccumulator)
      .where(eq(leadProfileAccumulator.identifierValue, String(leadId)))
      .limit(50);
    features.profile_completeness = Math.min(1, profilePoints.length / 15);

    // Calculator usage
    const calcResults = await db.select().from(calculatorResultCache)
      .where(eq(calculatorResultCache.userId, leadId))
      .limit(10);
    features.calculator_usage = Math.min(1, calcResults.length / 5);

    // ZIP demographics
    if (lead.zip) {
      const [zipData] = await db.select().from(zipCodeDemographics)
        .where(eq(zipCodeDemographics.zip, lead.zip))
        .limit(1);
      if (zipData) {
        features.zip_wealth = Number(zipData.wealthIndex) || 0;
        features.zip_income = zipData.medianHouseholdIncome ? Math.min(1, Number(zipData.medianHouseholdIncome) / 150000) : 0;
      }
    }
  } catch {
    // Graceful — return partial features
  }

  return features;
}
