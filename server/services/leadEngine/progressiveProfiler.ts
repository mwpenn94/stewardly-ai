/**
 * Progressive Profiler — Accumulate data points across sessions
 * Confidence hierarchy: form 0.95, chat 0.90, document 0.80, calculator 0.70,
 * AI inference 0.60, enrichment 0.50
 */
import { getDb } from "../../db";
import { logger } from "../../_core/logger";

const log = logger.child({ module: "progressiveProfiler" });

const CONFIDENCE: Record<string, number> = {
  form_field: 0.95, chat: 0.90, document: 0.80, calculator: 0.70,
  ai_inference: 0.60, enrichment: 0.50,
};

export async function addDataPoint(params: {
  identifierType: "email_hash" | "session_id" | "user_id";
  identifierValue: string;
  name: string;
  value: string;
  source: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const confidence = CONFIDENCE[params.source] ?? 0.50;

  try {
    const { leadProfileAccumulator } = await import("../../../drizzle/schema");
    const { eq, and } = await import("drizzle-orm");

    // Check for conflict
    const existing = await db.select().from(leadProfileAccumulator).where(
      and(
        eq(leadProfileAccumulator.identifierType, params.identifierType),
        eq(leadProfileAccumulator.identifierValue, params.identifierValue),
        eq(leadProfileAccumulator.dataPointName, params.name),
      )
    ).limit(1);

    if (existing.length > 0) {
      const prev = existing[0];
      if (Number(prev.confidence) >= confidence && prev.dataPointValue !== params.value) {
        // Lower confidence — mark conflicted, don't overwrite
        await db.insert(leadProfileAccumulator).values({
          identifierType: params.identifierType,
          identifierValue: params.identifierValue,
          dataPointName: params.name,
          dataPointValue: params.value,
          dataPointSource: params.source,
          confidence: String(confidence),
          conflicted: true,
        });
        return;
      }
      // Higher confidence — supersede
      await db.insert(leadProfileAccumulator).values({
        identifierType: params.identifierType,
        identifierValue: params.identifierValue,
        dataPointName: params.name,
        dataPointValue: params.value,
        dataPointSource: params.source,
        confidence: String(confidence),
      });
      return;
    }

    await db.insert(leadProfileAccumulator).values({
      identifierType: params.identifierType,
      identifierValue: params.identifierValue,
      dataPointName: params.name,
      dataPointValue: params.value,
      dataPointSource: params.source,
      confidence: String(confidence),
    });
  } catch (e: any) {
    log.warn({ error: e.message }, "Failed to add data point");
  }
}

export async function getProfile(identifierType: string, identifierValue: string): Promise<Record<string, { value: string; confidence: number; source: string }>> {
  const db = await getDb();
  if (!db) return {};

  try {
    const { leadProfileAccumulator } = await import("../../../drizzle/schema");
    const { eq, and } = await import("drizzle-orm");

    const points = await db.select().from(leadProfileAccumulator).where(
      and(
        eq(leadProfileAccumulator.identifierType, identifierType as any),
        eq(leadProfileAccumulator.identifierValue, identifierValue),
        eq(leadProfileAccumulator.conflicted, false),
      )
    );

    const profile: Record<string, { value: string; confidence: number; source: string }> = {};
    for (const p of points) {
      const existing = profile[p.dataPointName];
      const conf = Number(p.confidence) || 0;
      if (!existing || conf > existing.confidence) {
        profile[p.dataPointName] = { value: p.dataPointValue || "", confidence: conf, source: p.dataPointSource || "" };
      }
    }
    return profile;
  } catch {
    return {};
  }
}
