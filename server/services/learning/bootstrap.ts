/**
 * EMBA Learning — server-side bootstrap (Task 2B wiring).
 *
 * Single entry point the main server startup can call to:
 *   1. Seed the structural catalog (disciplines + tracks, idempotent)
 *   2. Optionally import full content from mwpenn94/emba_modules
 *      (gated by EMBA_IMPORT_ON_BOOT=true so tests + offline starts
 *      don't hit the network)
 *   3. Register all learning-specific ReAct agent tools
 *
 * Graceful: if the DB is unavailable, all calls become no-ops and
 * bootstrap returns an empty-result summary so the server keeps
 * booting. This matches how weightPresets and other existing
 * services degrade.
 */

import { seedLearningContent } from "./seed";
import { importEMBAFromGitHub, type EMBAImportResult } from "./embaImport";
import { registerLearningAgentTools } from "./agentTools";
import { logger } from "../../_core/logger";

const log = logger.child({ module: "learning/bootstrap" });

export async function bootstrapLearning(opts: {
  skipSeed?: boolean;
  skipTools?: boolean;
  /** If true, also pull full content from the emba_modules GitHub repo. */
  importFromGitHub?: boolean;
} = {}): Promise<{
  seeded: { disciplines: number; tracks: number; skipped: number };
  tools: { registered: number; skipped: number };
  imported: EMBAImportResult | null;
}> {
  let seeded = { disciplines: 0, tracks: 0, skipped: 0 };
  let tools = { registered: 0, skipped: 0 };
  let imported: EMBAImportResult | null = null;

  if (!opts.skipSeed) {
    try {
      seeded = await seedLearningContent();
    } catch (err) {
      log.warn({ err: String(err) }, "bootstrapLearning: seed failed");
    }
  }

  // Full GitHub import — gated behind an explicit flag OR env var so
  // unit tests and air-gapped installs don't fetch at startup.
  const shouldImport =
    opts.importFromGitHub ?? process.env.EMBA_IMPORT_ON_BOOT === "true";
  if (shouldImport) {
    try {
      imported = await importEMBAFromGitHub();
    } catch (err) {
      log.warn({ err: String(err) }, "bootstrapLearning: github import failed");
    }
  }

  if (!opts.skipTools) {
    try {
      tools = await registerLearningAgentTools();
    } catch (err) {
      log.warn({ err: String(err) }, "bootstrapLearning: tool registration failed");
    }
  }

  log.info({ seeded, imported, tools }, "bootstrapLearning complete");
  return { seeded, tools, imported };
}
