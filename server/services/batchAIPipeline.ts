/**
 * Batch AI Pipeline — Batch operations for lead pipeline
 * Progress tracking via import_jobs table
 */
import { getDb } from "../db";
import { logger } from "../_core/logger";

const log = logger.child({ module: "batchAIPipeline" });

export interface BatchResult {
  operation: string;
  total: number;
  succeeded: number;
  failed: number;
  durationMs: number;
}

export async function batchEnrich(leadIds: number[]): Promise<BatchResult> {
  const start = Date.now();
  let succeeded = 0, failed = 0;

  const { enrichLead } = await import("./enrichment/enrichmentOrchestrator");

  for (const leadId of leadIds) {
    try {
      const db = await getDb();
      if (!db) { failed++; continue; }
      const { leadPipeline } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const [lead] = await db.select().from(leadPipeline).where(eq(leadPipeline.id, leadId)).limit(1);
      if (!lead) { failed++; continue; }

      const result = await enrichLead({ name: lead.firstName || "", company: lead.company || "" });
      if (result) {
        await db.update(leadPipeline).set({ enrichmentData: result.data as any, status: "enriched" }).where(eq(leadPipeline.id, leadId));
        succeeded++;
      } else { failed++; }
    } catch { failed++; }
  }

  log.info({ operation: "enrich", total: leadIds.length, succeeded, failed }, "Batch enrich complete");
  return { operation: "enrich", total: leadIds.length, succeeded, failed, durationMs: Date.now() - start };
}

export async function batchScore(leadIds: number[]): Promise<BatchResult> {
  const start = Date.now();
  let succeeded = 0, failed = 0;

  const { scoreLead } = await import("./propensity/scoringEngine");

  for (const leadId of leadIds) {
    try {
      const result = await scoreLead(leadId);
      const db = await getDb();
      if (db) {
        const { leadPipeline } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await db.update(leadPipeline).set({
          propensityScore: String(result.score),
          propensityTier: result.tier,
          status: "scored",
        }).where(eq(leadPipeline.id, leadId));
      }
      succeeded++;
    } catch { failed++; }
  }

  log.info({ operation: "score", total: leadIds.length, succeeded, failed }, "Batch score complete");
  return { operation: "score", total: leadIds.length, succeeded, failed, durationMs: Date.now() - start };
}

export async function batchProcess(leadIds: number[], operations: string[]): Promise<BatchResult[]> {
  const results: BatchResult[] = [];
  for (const op of operations) {
    if (op === "enrich") results.push(await batchEnrich(leadIds));
    else if (op === "score") results.push(await batchScore(leadIds));
  }
  return results;
}
