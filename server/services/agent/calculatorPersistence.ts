/**
 * Calculator persistence helper — wraps computations in a `modelRun` +
 * `modelOutputRecord` insert so every tRPC invocation of a wealth engine
 * leaves an auditable trail. This is the Stewardly equivalent of the
 * spec's `calculatorPersistence` service: a thin layer over the existing
 * `analyticalModels` / `modelRuns` / `modelOutputRecords` tables.
 *
 * Why not invent a new table:
 *  - 318 tables already exist. Reusing the modelRuns infrastructure keeps
 *    wealth-engine computations in the same pane of glass as the 8
 *    statistical models already flowing through modelEngine.ts.
 *  - modelRuns already tracks trigger source, input/output JSON, duration,
 *    status, affected users. Exactly what the spec calls for.
 *  - modelOutputRecords gives us per-user versioning for "plan updated"
 *    subscription semantics.
 *
 * Missing fields from the spec that we carry in modelRuns.triggerSource
 * metadata: sessionId, triggeredBy, parentRunId (for tool chains).
 */

import { getDb } from "../../db";
import { randomUUID } from "crypto";
import { and, eq, desc } from "drizzle-orm";
import {
  analyticalModels,
  modelRuns,
  modelOutputRecords,
  type ModelRun,
} from "../../../drizzle/schema";

export type WealthEngineTool =
  | "uwe.simulate"
  | "uwe.monteCarloSimulate"
  | "uwe.buildStrategy"
  | "uwe.autoSelectProducts"
  | "uwe.generateBestOverall"
  | "bie.simulate"
  | "bie.backPlan"
  | "bie.rollUp"
  | "bie.rollDown"
  | "bie.calcEconomics"
  | "he.simulate"
  | "he.compareAt"
  | "he.findWinners"
  | "he.milestoneCompare"
  | "he.backPlanHolistic"
  | "montecarlo.simulate";

export type TriggerSource =
  | "user_ui"
  | "user_chat"
  | "agent_chain"
  | "scheduled"
  | "plaid_perception";

export interface PersistenceMeta {
  userId?: number;
  clientId?: string;
  sessionId?: string;
  trigger: TriggerSource;
  parentRunId?: string;
  affectedUserIds?: number[];
}

/**
 * Record a completed calculator run. Non-blocking: if the DB is not
 * available (e.g. during tests) the function resolves without throwing
 * so tRPC handlers can still return the engine result to the caller.
 *
 * Returns the `runId` for chaining (agent orchestration can use this as
 * `parentRunId` on subsequent tool calls).
 */
export async function persistComputation<TInput, TResult>(params: {
  tool: WealthEngineTool;
  input: TInput;
  result: TResult;
  durationMs: number;
  meta: PersistenceMeta;
  confidence?: number;
}): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  const runId = randomUUID();
  const now = new Date();

  // Ensure the "wealth_engine" analytical model row exists so modelRuns
  // has a valid FK target. Upsert on slug via a read-then-write because
  // drizzle's mysql dialect does not have a single-step upsert.
  const slug = `wealth-engine.${params.tool}`;
  const existing = await db
    .select({ id: analyticalModels.id })
    .from(analyticalModels)
    .where(eq(analyticalModels.slug, slug))
    .limit(1);
  let modelId = existing[0]?.id;
  if (!modelId) {
    modelId = randomUUID();
    await db.insert(analyticalModels).values({
      id: modelId,
      name: `Wealth Engine: ${params.tool}`,
      slug,
      description: `WealthBridge ${params.tool} engine run (Phase 1 port).`,
      layer: "user",
      category: "financial",
      executionType: "statistical",
      version: "1.0.0",
      isActive: true,
    });
  }

  // Encode triggerSource as a JSON string so we can carry structured
  // metadata in the existing varchar(128) column.
  const triggerSource = JSON.stringify({
    trigger: params.meta.trigger,
    sessionId: params.meta.sessionId ?? null,
    clientId: params.meta.clientId ?? null,
    parentRunId: params.meta.parentRunId ?? null,
  }).slice(0, 128);

  await db.insert(modelRuns).values({
    id: runId,
    modelId,
    triggeredBy:
      params.meta.trigger === "scheduled"
        ? "schedule"
        : params.meta.trigger === "agent_chain" ||
            params.meta.trigger === "plaid_perception"
          ? "dependency"
          : "manual",
    triggerSource,
    inputData: params.input as unknown as Record<string, unknown>,
    outputData: params.result as unknown as Record<string, unknown>,
    status: "completed",
    durationMs: params.durationMs,
    affectedUserIds: params.meta.affectedUserIds ?? null,
    completedAt: now,
  });

  // Record a per-user output so subscription queries can deliver
  // "plan updated" notifications tied to specific users.
  if (params.meta.userId) {
    await db.insert(modelOutputRecords).values({
      id: randomUUID(),
      runId,
      modelId,
      entityType: "user",
      entityId: params.meta.userId,
      outputType: params.tool,
      outputValue: params.result as unknown as Record<string, unknown>,
      confidence: params.confidence ?? null,
    });
  }

  return runId;
}

/**
 * Fetch the most recent run for a given tool + user. Used by the
 * subscription path and by agent orchestration to diff a fresh run
 * against the last stored result ("significant change detection").
 */
export async function getLatestRun(
  tool: WealthEngineTool,
  userId: number,
): Promise<ModelRun | null> {
  const db = await getDb();
  if (!db) return null;

  const slug = `wealth-engine.${tool}`;
  const modelRow = await db
    .select({ id: analyticalModels.id })
    .from(analyticalModels)
    .where(eq(analyticalModels.slug, slug))
    .limit(1);
  if (!modelRow[0]) return null;

  const latestOutput = await db
    .select({ runId: modelOutputRecords.runId })
    .from(modelOutputRecords)
    .where(
      and(
        eq(modelOutputRecords.modelId, modelRow[0].id),
        eq(modelOutputRecords.entityId, userId),
      ),
    )
    .orderBy(desc(modelOutputRecords.createdAt))
    .limit(1);
  if (!latestOutput[0]) return null;

  const run = await db
    .select()
    .from(modelRuns)
    .where(eq(modelRuns.id, latestOutput[0].runId))
    .limit(1);
  return run[0] ?? null;
}

/**
 * Diff two wealth-engine results to detect "significant change".
 * Currently thresholds on any numeric field that has shifted more than
 * 5%. Good enough as a proactive-alert trigger; the scheduler can
 * tighten this later via the recalibration loop.
 */
export function diffRuns<T extends Record<string, unknown>>(
  oldResult: T | null | undefined,
  newResult: T,
): { significantChange: boolean; summary: string[] } {
  if (!oldResult)
    return { significantChange: true, summary: ["first run — no baseline"] };
  const summary: string[] = [];
  const visit = (a: unknown, b: unknown, path: string) => {
    if (typeof a === "number" && typeof b === "number") {
      if (a === 0 && b === 0) return;
      const pct = Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1);
      if (pct > 0.05) {
        summary.push(
          `${path}: ${a.toLocaleString()} → ${b.toLocaleString()} (${(pct * 100).toFixed(1)}%)`,
        );
      }
    } else if (a && b && typeof a === "object" && typeof b === "object") {
      const keys = new Set([
        ...Object.keys(a as object),
        ...Object.keys(b as object),
      ]);
      keys.forEach((k) =>
        visit(
          (a as Record<string, unknown>)[k],
          (b as Record<string, unknown>)[k],
          path ? `${path}.${k}` : k,
        ),
      );
    }
  };
  visit(oldResult, newResult, "");
  return { significantChange: summary.length > 0, summary };
}
