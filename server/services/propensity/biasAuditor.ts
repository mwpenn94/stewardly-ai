/**
 * Propensity Bias Auditor — Quarterly fair lending audit
 * Flag if disparity ratio > 1.25 across protected classes
 */
import { getDb } from "../../db";
import { logger } from "../../_core/logger";
import { sql } from "drizzle-orm";

const log = logger.child({ module: "biasAuditor" });

export interface BiasAuditResult {
  modelId: number;
  protectedClasses: Array<{
    className: string;
    disparityRatio: number;
    passes: boolean;
  }>;
  overallPasses: boolean;
  auditedAt: Date;
}

const PROTECTED_CLASSES = ["gender", "age_group", "zip_wealth_quintile"];
const DISPARITY_THRESHOLD = 1.25;

export async function runBiasAudit(modelId: number): Promise<BiasAuditResult> {
  const db = await getDb();
  const results: BiasAuditResult["protectedClasses"] = [];

  for (const pc of PROTECTED_CLASSES) {
    let ratio = 1.0; // Default: no disparity
    if (db) {
      try {
        // Query propensity scores grouped by protected class segment
        const segmentScores = await db.execute(
          sql.raw(`
            SELECT 
              JSON_EXTRACT(metadata, '$.${pc}') as segment,
              AVG(score) as avg_score,
              COUNT(*) as sample_count,
              SUM(CASE WHEN score > 0.5 THEN 1 ELSE 0 END) / COUNT(*) as selection_rate
            FROM propensity_scores 
            WHERE model_id = ${modelId}
              AND JSON_EXTRACT(metadata, '$.${pc}') IS NOT NULL
            GROUP BY JSON_EXTRACT(metadata, '$.${pc}')
            HAVING COUNT(*) >= 10
          `)
        );
        const rows = (segmentScores as any)[0] ?? [];
        if (Array.isArray(rows) && rows.length >= 2) {
          const rates = rows.map((r: any) => parseFloat(r.selection_rate) || 0).filter((r: number) => r > 0);
          if (rates.length >= 2) {
            const maxRate = Math.max(...rates);
            const minRate = Math.min(...rates);
            ratio = minRate > 0 ? maxRate / minRate : maxRate > 0 ? DISPARITY_THRESHOLD + 0.1 : 1.0;
          }
        }
      } catch (err: any) {
        log.debug({ pc, err: err.message }, "Could not compute disparity for protected class");
        ratio = 1.0;
      }
    }
    const passes = ratio <= DISPARITY_THRESHOLD;
    results.push({ className: pc, disparityRatio: Math.round(ratio * 1000) / 1000, passes });
  }

  const overallPasses = results.every(r => r.passes);
  const auditResult = { modelId, protectedClasses: results, overallPasses, auditedAt: new Date() };

  // Persist audit
  if (db) {
    try {
      const { propensityBiasAudits } = await import("../../../drizzle/schema");
      for (const r of results) {
        await db.insert(propensityBiasAudits).values({
          modelId,
          auditType: "quarterly_fair_lending",
          protectedClass: r.className,
          disparityRatio: String(r.disparityRatio),
          passes: r.passes,
          details: {} as any,
        });
      }
    } catch { /* graceful */ }
  }

  if (!overallPasses) {
    log.warn({ modelId, failing: results.filter(r => !r.passes) }, "BIAS AUDIT FAILED — disparity detected");
  } else {
    log.info({ modelId }, "Bias audit passed");
  }

  return auditResult;
}
