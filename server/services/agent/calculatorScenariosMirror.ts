/**
 * calculatorScenarios mirror — Round A2.
 *
 * Mirrors major wealth-engine runs into the existing
 * `calculatorScenarios` table so the existing UI's "saved scenarios"
 * lists pick them up. The wealth-engine itself still persists via
 * model_runs (via calculatorPersistence in services/agent), but for
 * the user-facing scenario library we want a uniform shape across all
 * Stewardly calculators.
 *
 * Mirroring rule: only "headline" runs get mirrored. We define
 * headline as:
 *   - he.simulate (the user's full plan)
 *   - he.compareAt (multi-strategy comparison)
 *   - bie.simulate (full BIE projection)
 *   - uwe.simulate (single UWE strategy)
 * Helper / sub-tool runs (interpRate, getBracketRate, etc.) are not
 * mirrored to avoid noise.
 */

import { saveScenario } from "../calculatorPersistence";
import { logger } from "../../_core/logger";

const HEADLINE_TOOLS: Set<string> = new Set([
  "he.simulate",
  "he.compareAt",
  "bie.simulate",
  "uwe.simulate",
  "montecarlo.simulate",
]);

export interface MirrorParams {
  userId: number;
  tool: string;
  scenarioName: string;
  input: Record<string, unknown>;
  result: unknown;
}

/**
 * Pure helper: should this tool run be mirrored?
 */
export function shouldMirror(tool: string): boolean {
  return HEADLINE_TOOLS.has(tool);
}

/**
 * Map a wealth-engine tool name to the calculatorScenarios.calculatorType
 * column. The existing UI groups scenarios by this key, so we want
 * stable, descriptive identifiers.
 */
export function calculatorTypeForTool(tool: string): string {
  switch (tool) {
    case "he.simulate":
      return "wealth_engine_holistic";
    case "he.compareAt":
      return "wealth_engine_comparison";
    case "bie.simulate":
      return "wealth_engine_business_income";
    case "uwe.simulate":
      return "wealth_engine_unified_wealth";
    case "montecarlo.simulate":
      return "wealth_engine_monte_carlo";
    default:
      return "wealth_engine_other";
  }
}

/**
 * Compact a result for storage in calculatorScenarios.resultsJson.
 * Wealth-engine outputs can be large arrays of yearly snapshots; we
 * keep the first + last + every 5th snapshot so the row stays under
 * the JSON column's practical limit.
 */
export function compactResult(result: unknown): unknown {
  if (!Array.isArray(result)) return result;
  if (result.length <= 12) return result;
  const compacted: unknown[] = [];
  for (let i = 0; i < result.length; i++) {
    if (i === 0 || i === result.length - 1 || i % 5 === 0) {
      compacted.push(result[i]);
    }
  }
  return compacted;
}

/**
 * Mirror a tool run into calculatorScenarios. Non-blocking: logs and
 * returns null on any error so callers can use this in a fire-and-
 * forget pattern.
 */
export async function mirrorEngineRun(
  params: MirrorParams,
): Promise<number | null> {
  if (!shouldMirror(params.tool)) return null;
  try {
    const id = await saveScenario(
      params.userId,
      calculatorTypeForTool(params.tool),
      params.scenarioName,
      params.input,
      compactResult(params.result) as Record<string, unknown>,
    );
    return id;
  } catch (err) {
    logger.warn(
      { err, tool: params.tool },
      "calculatorScenarios mirror failed (non-blocking)",
    );
    return null;
  }
}

/**
 * Compose-friendly wrapper: takes the same shape that `runAndPersist`
 * in the wealthEngine router uses, and writes the mirror in the
 * background. Designed to be called from a tRPC mutation without
 * adding latency to the user-facing response.
 */
export function fireAndForgetMirror(params: MirrorParams): void {
  mirrorEngineRun(params).catch((err) => {
    logger.warn({ err }, "fireAndForgetMirror failed");
  });
}
