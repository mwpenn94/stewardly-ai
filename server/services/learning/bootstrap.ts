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
import { getDb } from "../../db";
import { learningChapters } from "../../../drizzle/schema";

const log = logger.child({ module: "learning/bootstrap" });

/**
 * Probe the DB to decide whether the GitHub content import should
 * run on this boot. Returns one of:
 *   - "no_db"     — DB unavailable, skip import (offline / test env)
 *   - "already"   — `learning_chapters` already has rows, skip import
 *   - "needed"    — DB present and chapters table empty, run import
 */
async function importNeeded(): Promise<"no_db" | "already" | "needed"> {
  const db = await getDb();
  if (!db) return "no_db";
  try {
    const rows = await db.select({ id: learningChapters.id }).from(learningChapters).limit(1);
    return rows.length > 0 ? "already" : "needed";
  } catch {
    // Table missing or query failed — treat as "no_db" so we don't
    // fetch from GitHub against a broken schema.
    return "no_db";
  }
}

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

  // Full GitHub import — opt-out (not opt-in) so a fresh deploy lands
  // with real content instead of an empty Learning page. Skipped if:
  //   - explicit `importFromGitHub: false` is passed (tests),
  //   - `EMBA_IMPORT_ON_BOOT=false` env var (air-gapped installs),
  //   - DB is unavailable (offline / test env — never hit network),
  //   - or a previous import already populated `learning_chapters`
  //     (cheap "is it already done?" probe — keeps restarts fast).
  const explicitOptOut =
    opts.importFromGitHub === false || process.env.EMBA_IMPORT_ON_BOOT === "false";
  if (!explicitOptOut) {
    const state = await importNeeded();
    if (state === "needed") {
      try {
        imported = await importEMBAFromGitHub();
        log.info(
          { counts: imported.counts, errors: imported.errors.length },
          "bootstrapLearning: auto-imported EMBA content",
        );
      } catch (err) {
        log.warn({ err: String(err) }, "bootstrapLearning: github import failed");
      }
    } else {
      log.info({ state }, "bootstrapLearning: github import skipped");
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
