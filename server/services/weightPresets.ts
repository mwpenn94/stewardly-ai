/**
 * Weight presets service — Round C4.
 *
 * Per-model weight profiles for multi-model consensus runs. The
 * synthesis merge prompt (built by `consensusStream.buildSynthesisPrompt`)
 * accepts an optional `weight: 1-100` per model — this module is the
 * canonical place to store, list, and apply those weights as named
 * presets.
 *
 * Layers:
 *  1. Pure helpers (`normalizeWeights`, `mergePresetWithSelection`,
 *     `validatePresetShape`) — testable without DB
 *  2. DB-backed CRUD (`listPresets`, `createPreset`, `updatePreset`,
 *     `deletePreset`) — uses the `weight_presets` table added in schema
 *  3. Built-in seed presets — domain-specific weight bundles like
 *     "Conservative Suitability" and "Tax Research"
 *
 * The DB layer degrades gracefully when the database is unavailable
 * (returns the seed presets) so the UI keeps working in unit-test
 * environments and during the cold-start window before db:push runs.
 */

import { getDb } from "../db";
import { weightPresets } from "../../drizzle/schema";
import { and, eq, isNull, or } from "drizzle-orm";
import { logger } from "../_core/logger";

const log = logger.child({ module: "weightPresets" });

// ─── Types ────────────────────────────────────────────────────────────────

export type ModelWeights = Record<string, number>;

export interface WeightPresetData {
  id?: number;
  userId?: number | null;
  name: string;
  description?: string;
  weights: ModelWeights;
  optimizedFor?: string[];
  isBuiltIn?: boolean;
}

// ─── Pure helpers ─────────────────────────────────────────────────────────

export const DEFAULT_WEIGHT = 50;
export const MIN_WEIGHT = 1;
export const MAX_WEIGHT = 100;

/**
 * Clamp every weight to [MIN_WEIGHT, MAX_WEIGHT] and round to integer.
 * Pure — no side effects. Used before persisting + before injecting
 * into the synthesis prompt.
 */
export function normalizeWeights(weights: ModelWeights): ModelWeights {
  const out: ModelWeights = {};
  for (const [modelId, weight] of Object.entries(weights)) {
    if (typeof weight !== "number" || !Number.isFinite(weight)) continue;
    out[modelId] = Math.round(
      Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, weight)),
    );
  }
  return out;
}

/**
 * Validate the shape of a preset. Returns an array of error strings,
 * empty when valid. Used by both the tRPC router and the seed loader.
 */
export function validatePresetShape(input: WeightPresetData): string[] {
  const errors: string[] = [];
  if (!input.name || input.name.trim().length === 0) {
    errors.push("name required");
  }
  if (input.name && input.name.length > 100) {
    errors.push("name max 100 chars");
  }
  if (!input.weights || typeof input.weights !== "object") {
    errors.push("weights object required");
    return errors;
  }
  if (Object.keys(input.weights).length === 0) {
    errors.push("at least one model weight required");
  }
  for (const [k, v] of Object.entries(input.weights)) {
    if (typeof v !== "number") errors.push(`${k}: weight must be a number`);
    else if (v < MIN_WEIGHT || v > MAX_WEIGHT) {
      errors.push(`${k}: weight ${v} outside [${MIN_WEIGHT}, ${MAX_WEIGHT}]`);
    }
  }
  return errors;
}

/**
 * Resolve a preset against the actual selected models for a run.
 * Returns a `weights` map with one entry per selected model, falling
 * back to DEFAULT_WEIGHT for any model the preset doesn't list. This
 * is what gets passed to `runConsensus(modelWeights: ...)`.
 */
export function mergePresetWithSelection(
  preset: WeightPresetData | null,
  selectedModels: string[],
): ModelWeights {
  const out: ModelWeights = {};
  for (const id of selectedModels) {
    if (preset && preset.weights[id] !== undefined) {
      out[id] = preset.weights[id];
    } else {
      out[id] = DEFAULT_WEIGHT;
    }
  }
  return normalizeWeights(out);
}

// ─── Built-in seed presets ────────────────────────────────────────────────
// Hard-coded so the UI works even before the DB has rows. Each is
// scoped to a financial-advisory domain and gets the WB-recommended
// weight bias.

export const BUILT_IN_PRESETS: WeightPresetData[] = [
  {
    name: "Balanced",
    description:
      "Equal weight across the default trio. Good starting point for general consensus.",
    weights: {
      "claude-sonnet-4-20250514": 50,
      "gpt-4o": 50,
      "gemini-2.5-pro": 50,
    },
    optimizedFor: ["general", "exploration"],
    isBuiltIn: true,
  },
  {
    name: "Conservative Suitability",
    description:
      "Bias toward Claude for nuanced suitability + risk wording. GPT contributes secondary perspective. Gemini omitted to avoid LLM-of-record drift.",
    weights: {
      "claude-sonnet-4-20250514": 90,
      "gpt-4o": 60,
    },
    optimizedFor: ["suitability", "compliance", "risk"],
    isBuiltIn: true,
  },
  {
    name: "Tax Research",
    description:
      "GPT-4 family leads for IRS code citation accuracy, Gemini secondary for cross-check, Claude minor for tone polish.",
    weights: {
      "gpt-4o": 80,
      "gemini-2.5-pro": 70,
      "claude-sonnet-4-20250514": 40,
    },
    optimizedFor: ["tax", "regulation", "research"],
    isBuiltIn: true,
  },
  {
    name: "Estate Planning",
    description:
      "Claude leads for plain-language explanation of complex trust structures; GPT adds federal/state tax expertise.",
    weights: {
      "claude-sonnet-4-20250514": 80,
      "gpt-4o": 70,
      "gemini-2.5-pro": 50,
    },
    optimizedFor: ["estate", "trust", "legacy"],
    isBuiltIn: true,
  },
  {
    name: "Speed-First",
    description:
      "Single fast model for sub-2-second responses when latency matters more than consensus depth.",
    weights: {
      "gemini-2.5-flash": 100,
    },
    optimizedFor: ["latency", "client-facing"],
    isBuiltIn: true,
  },
];

/**
 * Find a built-in preset by name. Pure — used as the cold-start fallback
 * for both the listing and the merge resolver.
 */
export function findBuiltInByName(name: string): WeightPresetData | null {
  return BUILT_IN_PRESETS.find((p) => p.name === name) ?? null;
}

// ─── DB-backed CRUD ───────────────────────────────────────────────────────

/**
 * List all presets visible to a user — both their own and the
 * platform built-ins. Falls back to built-ins only when the DB is
 * unavailable.
 */
export async function listPresets(
  userId: number,
): Promise<WeightPresetData[]> {
  const db = await getDb();
  if (!db) {
    return BUILT_IN_PRESETS.map((p) => ({ ...p }));
  }
  try {
    const rows = await db
      .select()
      .from(weightPresets)
      .where(or(eq(weightPresets.userId, userId), isNull(weightPresets.userId)));
    const fromDb = rows.map(rowToPreset);
    // If the table is empty, fall back to built-ins so the UI never
    // shows a blank preset picker
    return fromDb.length > 0 ? fromDb : BUILT_IN_PRESETS.map((p) => ({ ...p }));
  } catch (err) {
    log.warn({ err }, "listPresets failed; returning built-ins");
    return BUILT_IN_PRESETS.map((p) => ({ ...p }));
  }
}

export async function createPreset(
  userId: number,
  input: WeightPresetData,
): Promise<{ id: number | null; preset: WeightPresetData; errors: string[] }> {
  const errors = validatePresetShape(input);
  if (errors.length > 0) {
    return { id: null, preset: input, errors };
  }
  const normalized: WeightPresetData = {
    ...input,
    userId,
    weights: normalizeWeights(input.weights),
    isBuiltIn: false,
  };
  const db = await getDb();
  if (!db) {
    return { id: null, preset: normalized, errors: ["db_unavailable"] };
  }
  try {
    const result = await db.insert(weightPresets).values({
      userId,
      name: normalized.name,
      description: normalized.description ?? null,
      weights: normalized.weights as never,
      optimizedFor: (normalized.optimizedFor ?? null) as never,
      isBuiltIn: false,
    });
    const insertId = (result as unknown as { insertId?: number }).insertId ?? null;
    return { id: insertId, preset: { ...normalized, id: insertId ?? undefined }, errors: [] };
  } catch (err) {
    log.error({ err }, "createPreset failed");
    return { id: null, preset: normalized, errors: ["create_failed"] };
  }
}

export async function updatePreset(
  userId: number,
  id: number,
  patch: Partial<WeightPresetData>,
): Promise<{ ok: boolean; errors: string[] }> {
  const db = await getDb();
  if (!db) return { ok: false, errors: ["db_unavailable"] };
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.weights !== undefined) {
    const errors = validatePresetShape({
      name: patch.name ?? "placeholder",
      weights: patch.weights,
    });
    if (errors.filter((e) => !e.includes("name")).length > 0) {
      return { ok: false, errors };
    }
    update.weights = normalizeWeights(patch.weights);
  }
  if (patch.optimizedFor !== undefined) {
    update.optimizedFor = patch.optimizedFor;
  }
  try {
    await db
      .update(weightPresets)
      .set(update as never)
      .where(
        and(eq(weightPresets.id, id), eq(weightPresets.userId, userId)),
      );
    return { ok: true, errors: [] };
  } catch (err) {
    log.error({ err }, "updatePreset failed");
    return { ok: false, errors: ["update_failed"] };
  }
}

export async function deletePreset(
  userId: number,
  id: number,
): Promise<{ ok: boolean; errors: string[] }> {
  const db = await getDb();
  if (!db) return { ok: false, errors: ["db_unavailable"] };
  try {
    await db
      .delete(weightPresets)
      .where(
        and(eq(weightPresets.id, id), eq(weightPresets.userId, userId)),
      );
    return { ok: true, errors: [] };
  } catch (err) {
    log.error({ err }, "deletePreset failed");
    return { ok: false, errors: ["delete_failed"] };
  }
}

// ─── Internal: row → preset ──────────────────────────────────────────────

function rowToPreset(row: typeof weightPresets.$inferSelect): WeightPresetData {
  return {
    id: row.id,
    userId: row.userId ?? null,
    name: row.name,
    description: row.description ?? undefined,
    weights: (row.weights as ModelWeights) ?? {},
    optimizedFor: (row.optimizedFor as string[]) ?? undefined,
    isBuiltIn: Boolean(row.isBuiltIn),
  };
}
