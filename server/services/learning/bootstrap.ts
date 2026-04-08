/**
 * EMBA Learning — server-side bootstrap (Task 2B wiring).
 *
 * Single entry point the main server startup can call to:
 *   1. Seed the initial content catalog (idempotent)
 *   2. Register all learning-specific ReAct agent tools
 *
 * Graceful: if the DB is unavailable, both calls become no-ops and
 * bootstrap returns an empty-result summary so the server keeps
 * booting. This matches how weightPresets and other existing
 * services degrade.
 */

import { seedLearningContent } from "./seed";
import { registerLearningAgentTools } from "./agentTools";
import { logger } from "../../_core/logger";

const log = logger.child({ module: "learning/bootstrap" });

export async function bootstrapLearning(opts: { skipSeed?: boolean; skipTools?: boolean } = {}): Promise<{
  seeded: { disciplines: number; tracks: number; skipped: number };
  tools: { registered: number; skipped: number };
}> {
  let seeded = { disciplines: 0, tracks: 0, skipped: 0 };
  let tools = { registered: 0, skipped: 0 };

  if (!opts.skipSeed) {
    try {
      seeded = await seedLearningContent();
    } catch (err) {
      log.warn({ err: String(err) }, "bootstrapLearning: seed failed");
    }
  }

  if (!opts.skipTools) {
    try {
      tools = await registerLearningAgentTools();
    } catch (err) {
      log.warn({ err: String(err) }, "bootstrapLearning: tool registration failed");
    }
  }

  log.info({ seeded, tools }, "bootstrapLearning complete");
  return { seeded, tools };
}
