/**
 * Integration Hooks — wires integration sync events to suitability synthesis,
 * model execution, and cross-layer propagation.
 *
 * These hooks are called after integration data syncs complete, file uploads
 * are processed, or model runs finish. They form the "nervous system" that
 * connects data ingestion to intelligence generation.
 */

import { getOrCreateProfile, updateDimension, synthesizeProfile } from "./suitabilityEngine";
import { executeModel } from "./modelEngine";
import { createPropagationEvent, cascadeInsight, createCoachingMessage } from "./propagationEngine";
import { logger } from "../_core/logger";

// ─── Hook: After Integration Sync ──────────────────────────────────────────

export async function onIntegrationSyncComplete(params: {
  userId: number;
  connectionId: string;
  providerSlug: string;
  syncedDataType: string;
  recordCount: number;
  summary?: Record<string, unknown>;
}) {
  const { userId, providerSlug, syncedDataType, recordCount, summary } = params;

  try {
    // 1. Update suitability dimensions based on synced data
    const profile = await getOrCreateProfile(userId);

    if (syncedDataType === "accounts" || syncedDataType === "portfolio") {
      await updateDimension(
        profile.id,
        "financial_knowledge",
        { source: providerSlug, recordCount, lastSync: Date.now() },
        60, // score
        0.7, // confidence from integration data
        `integration:${providerSlug}`,
        userId,
      );
    }

    if (syncedDataType === "transactions" || syncedDataType === "income") {
      await updateDimension(
        profile.id,
        "income_stability" as any,
        { source: providerSlug, recordCount, lastSync: Date.now() },
        55,
        0.65,
        `integration:${providerSlug}`,
        userId,
      );
    }

    // 2. Re-synthesize profile
    await synthesizeProfile(profile.id);

    // 3. Run relevant models
    try {
      await executeModel("client-risk-score", {
        dimensions: [],
        portfolio: summary ?? {},
      }, "event", `sync:${providerSlug}`);
    } catch {
      // Model execution is best-effort
    }

    // 4. Propagate insight upward
    await cascadeInsight({
      originLayer: "user",
      originEntityId: userId,
      insight: `Integration sync completed: ${providerSlug} synced ${recordCount} ${syncedDataType} records`,
      insightType: "pattern",
      confidence: 0.8,
      direction: "up",
    });

    // 5. Coaching message for the user
    await createCoachingMessage({
      userId,
      messageType: "celebration",
      title: "Data Sync Complete",
      content: `Your ${providerSlug} integration has synced ${recordCount} ${syncedDataType} records. Your financial profile has been updated automatically.`,
      priority: "low",
      triggerEvent: `sync:${providerSlug}`,
    });

    return { success: true };
  } catch (error: any) {
    logger.error( { operation: "integrationHooks", err: error },"[IntegrationHooks] onIntegrationSyncComplete error:", error.message);
    return { success: false, error: error.message };
  }
}

// ─── Hook: After File Upload Processed ─────────────────────────────────────

export async function onFileProcessed(params: {
  userId: number;
  fileId: string;
  filename: string;
  category: string;
  enrichments: Array<{ type: string; value: unknown; confidence: number }>;
}) {
  const { userId, fileId, filename, category, enrichments } = params;

  try {
    // 1. Apply enrichments to suitability profile
    const profile = await getOrCreateProfile(userId);

    for (const enrichment of enrichments) {
      if (enrichment.type === "financial_metric") {
        const dimKey = mapEnrichmentToDimension(enrichment.type);
        if (dimKey) {
          await updateDimension(
            profile.id,
            dimKey as any,
            enrichment.value,
            50,
            enrichment.confidence,
            `file:${fileId}`,
            userId,
          );
        }
      }
    }

    // 2. Re-synthesize
    await synthesizeProfile(profile.id);

    // 3. Propagate
    await createPropagationEvent({
      sourceLayer: "user",
      targetLayer: "professional",
      eventType: "insight",
      sourceEntityId: userId,
      payload: {
        type: "file_processed",
        filename,
        category,
        enrichmentCount: enrichments.length,
      },
      priority: "low",
    });

    return { success: true };
  } catch (error: any) {
    logger.error( { operation: "integrationHooks", err: error },"[IntegrationHooks] onFileProcessed error:", error.message);
    return { success: false, error: error.message };
  }
}

// ─── Hook: After Model Run Completes ───────────────────────────────────────

export async function onModelRunComplete(params: {
  userId?: number;
  modelSlug: string;
  runId: string;
  output: Record<string, unknown>;
}) {
  const { userId, modelSlug, runId, output } = params;

  try {
    // Propagate model results
    if (modelSlug === "client-risk-score" && userId) {
      const riskScore = output.riskScore as number;
      const riskCategory = output.riskCategory as string;

      // Update suitability
      const profile = await getOrCreateProfile(userId);
      await updateDimension(
        profile.id,
        "risk_tolerance",
        { modelScore: riskScore, category: riskCategory },
        riskScore,
        0.85,
        `model:${modelSlug}`,
        userId,
      );

      // Alert if high risk
      if (riskScore > 80) {
        await cascadeInsight({
          originLayer: "user",
          originEntityId: userId,
          insight: `High risk score detected: ${riskScore} (${riskCategory})`,
          insightType: "risk",
          confidence: 0.85,
          direction: "up",
        });
      }

      // Coaching
      await createCoachingMessage({
        userId,
        messageType: "insight",
        title: "Risk Profile Updated",
        content: `Your risk score has been recalculated to ${riskScore} (${riskCategory}). This reflects your latest financial data and preferences.`,
        priority: riskScore > 75 ? "high" : "medium",
        triggerEvent: `model:${modelSlug}:${runId}`,
      });
    }

    if (modelSlug === "engagement-scoring" && userId) {
      const score = output.engagementScore as number;
      const atRisk = output.atRisk as boolean;

      if (atRisk) {
        await createCoachingMessage({
          userId,
          messageType: "nudge",
          title: "We miss you!",
          content: "It's been a while since your last visit. Check in to see what's new with your financial plan.",
          priority: "medium",
          triggerEvent: `model:${modelSlug}:${runId}`,
        });
      }
    }

    return { success: true };
  } catch (error: any) {
    logger.error( { operation: "integrationHooks", err: error },"[IntegrationHooks] onModelRunComplete error:", error.message);
    return { success: false, error: error.message };
  }
}

// ─── Helper: Map enrichment types to suitability dimensions ────────────────

function mapEnrichmentToDimension(enrichmentType: string): string | null {
  const mapping: Record<string, string> = {
    financial_metric: "liquidity_needs",
    income_data: "income_stability",
    tax_data: "tax_situation",
    insurance_data: "insurance_coverage",
    debt_data: "debt_profile",
    investment_data: "financial_knowledge",
    estate_data: "estate_planning",
    retirement_data: "goals_alignment",
  };
  return mapping[enrichmentType] ?? null;
}
