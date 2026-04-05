/**
 * Selection Bias Monitor — 10% control group validation
 * Compare conversion rates between scored and control leads monthly
 */
import { getDb } from "../../db";
import { logger } from "../../_core/logger";

const log = logger.child({ module: "selectionBiasMonitor" });

export interface BiasMonitorResult {
  controlConversionRate: number;
  scoredConversionRate: number;
  delta: number;
  modelIsHelping: boolean;
  sampleSize: { control: number; scored: number };
}

export async function checkSelectionBias(): Promise<BiasMonitorResult | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const { leadPipeline } = await import("../../../drizzle/schema");
    const { eq, and, count } = await import("drizzle-orm");

    // Control group: is_control_group = true
    const [controlTotal] = await db.select({ count: count() }).from(leadPipeline)
      .where(eq(leadPipeline.isControlGroup, true));
    const [controlConverted] = await db.select({ count: count() }).from(leadPipeline)
      .where(and(eq(leadPipeline.isControlGroup, true), eq(leadPipeline.status, "converted")));

    // Scored group: is_control_group = false
    const [scoredTotal] = await db.select({ count: count() }).from(leadPipeline)
      .where(eq(leadPipeline.isControlGroup, false));
    const [scoredConverted] = await db.select({ count: count() }).from(leadPipeline)
      .where(and(eq(leadPipeline.isControlGroup, false), eq(leadPipeline.status, "converted")));

    const controlRate = controlTotal.count > 0 ? controlConverted.count / controlTotal.count : 0;
    const scoredRate = scoredTotal.count > 0 ? scoredConverted.count / scoredTotal.count : 0;
    const delta = scoredRate - controlRate;
    const modelIsHelping = delta > 0.02; // Model must improve by >2%

    const result = {
      controlConversionRate: Math.round(controlRate * 10000) / 100,
      scoredConversionRate: Math.round(scoredRate * 10000) / 100,
      delta: Math.round(delta * 10000) / 100,
      modelIsHelping,
      sampleSize: { control: controlTotal.count, scored: scoredTotal.count },
    };

    if (!modelIsHelping && controlTotal.count >= 50) {
      log.warn(result, "SELECTION BIAS: Propensity model not outperforming control group");
    }

    return result;
  } catch (e: any) {
    log.error({ error: e.message }, "Selection bias check failed");
    return null;
  }
}
