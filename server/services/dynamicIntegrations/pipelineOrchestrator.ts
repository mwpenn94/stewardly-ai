/**
 * Drift-Aware Pipeline Orchestrator
 *
 * Ties Passes 1-10 together into a single runnable pipeline. Given an
 * AdapterSpec + credentials + (optional) baseline schema, runs:
 *
 *   1. FETCH — list records from the source via adapterRuntime.listRecords
 *   2. INFER — rebuild the schema from the fresh records
 *   3. DRIFT — compare fresh schema against baseline; abort on breaking
 *   4. UPSERT — idempotent upsert per record (GET→404→POST / GET→200→PATCH)
 *   5. HINTS — extract personalization hints from the ingested batch
 *   6. TELEMETRY — report counts, durations, drift status, retries
 *
 * Each step is optional and the orchestrator honors an abort signal so
 * long-running pipelines can be cancelled mid-run. The orchestrator does
 * NOT own database state — it returns a structured result that the tRPC
 * / scheduled-job layer can persist.
 *
 * Pure orchestration + dependency injection for fetchImpl. No I/O outside
 * the injected fetchImpl. Every test runs offline.
 */

import type { AdapterSpec } from "./adapterGenerator";
import type { InferredSchema } from "./schemaInference";
import type { DriftReport } from "./schemaDrift";
import type { PersonalizationHintResult } from "./personalizationHints";
import type {
  AdapterCredentials,
  FetchImpl,
  ListResult,
} from "./adapterRuntime";

// ─── Types ─────────────────────────────────────────────────────────────────

export type StopReason =
  | "completed"
  | "breaking_drift"
  | "aborted"
  | "upsert_error_threshold"
  | "fetch_error";

export interface OrchestratorOptions {
  fetchImpl?: FetchImpl;
  credentials: AdapterCredentials;
  baselineSchema?: InferredSchema;          // for drift comparison
  abortOnBreakingDrift?: boolean;           // default true
  runUpsert?: boolean;                      // default true
  extractHints?: boolean;                   // default true
  maxUpsertErrors?: number;                 // default 5 before abort
  pageLimit?: number;                       // passthrough to listRecords
  onProgress?: (progress: PipelineProgress) => void;
  signal?: AbortSignal;                     // cancellation
}

export interface PipelineProgress {
  phase: "fetch" | "infer" | "drift" | "upsert" | "hints" | "complete";
  recordsSeen: number;
  recordsUpserted: number;
  upsertErrors: number;
  message?: string;
}

export interface PipelineResult {
  stopReason: StopReason;
  stoppedAt: "fetch" | "infer" | "drift" | "upsert" | "hints" | "complete";
  durationMs: number;
  recordsFetched: number;
  recordsUpserted: number;
  recordsCreated: number;
  recordsUpdated: number;
  upsertErrors: number;
  fetchRetries: number;
  schema: InferredSchema | null;
  drift: DriftReport | null;
  personalizationHints: PersonalizationHintResult | null;
  errorMessage?: string;
}

// ─── Main orchestrator ───────────────────────────────────────────────────

export async function runPipeline(
  spec: AdapterSpec,
  options: OrchestratorOptions,
): Promise<PipelineResult> {
  const started = Date.now();
  const runUpsert = options.runUpsert ?? true;
  const extractHints = options.extractHints ?? true;
  const abortOnBreakingDrift = options.abortOnBreakingDrift ?? true;
  const maxUpsertErrors = options.maxUpsertErrors ?? 5;

  const result: PipelineResult = {
    stopReason: "completed",
    stoppedAt: "complete",
    durationMs: 0,
    recordsFetched: 0,
    recordsUpserted: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
    upsertErrors: 0,
    fetchRetries: 0,
    schema: null,
    drift: null,
    personalizationHints: null,
  };

  const abortCheck = (): boolean => {
    if (options.signal?.aborted) {
      result.stopReason = "aborted";
      return true;
    }
    return false;
  };

  // ─── 1. FETCH ──────────────────────────────────────────────────
  options.onProgress?.({ phase: "fetch", recordsSeen: 0, recordsUpserted: 0, upsertErrors: 0 });
  let listResult: ListResult;
  try {
    const runtime = await import("./adapterRuntime");
    listResult = await runtime.listRecords(spec, {
      fetchImpl: options.fetchImpl,
      credentials: options.credentials,
      pageLimit: options.pageLimit,
      // Get raw records so newly-appeared source fields show up in the
      // freshly inferred schema and drift detection can catch them.
      skipTransforms: true,
    });
  } catch (err) {
    result.stopReason = "fetch_error";
    result.stoppedAt = "fetch";
    result.errorMessage = err instanceof Error ? err.message : String(err);
    result.durationMs = Date.now() - started;
    return result;
  }
  if (abortCheck()) {
    result.stoppedAt = "fetch";
    result.durationMs = Date.now() - started;
    return result;
  }
  result.recordsFetched = listResult.records.length;
  result.fetchRetries = listResult.retries;

  // ─── 2. INFER ──────────────────────────────────────────────────
  options.onProgress?.({
    phase: "infer",
    recordsSeen: result.recordsFetched,
    recordsUpserted: 0,
    upsertErrors: 0,
  });
  const { inferSchema } = await import("./schemaInference");
  const freshSchema = inferSchema(
    listResult.records.filter((r): r is Record<string, unknown> => r !== null && typeof r === "object"),
  );
  result.schema = freshSchema;

  if (abortCheck()) {
    result.stoppedAt = "infer";
    result.durationMs = Date.now() - started;
    return result;
  }

  // ─── 3. DRIFT ──────────────────────────────────────────────────
  if (options.baselineSchema) {
    options.onProgress?.({
      phase: "drift",
      recordsSeen: result.recordsFetched,
      recordsUpserted: 0,
      upsertErrors: 0,
    });
    const { diffSchemas } = await import("./schemaDrift");
    const drift = diffSchemas(options.baselineSchema, freshSchema);
    result.drift = drift;
    if (!drift.compatible && abortOnBreakingDrift) {
      result.stopReason = "breaking_drift";
      result.stoppedAt = "drift";
      result.errorMessage = `Aborted on ${drift.summary.breaking} breaking drift change(s)`;
      result.durationMs = Date.now() - started;
      return result;
    }
  }

  if (abortCheck()) {
    result.stoppedAt = "drift";
    result.durationMs = Date.now() - started;
    return result;
  }

  // ─── 4. UPSERT ─────────────────────────────────────────────────
  if (runUpsert && spec.primaryKey) {
    const runtime = await import("./adapterRuntime");
    for (const record of listResult.records) {
      if (abortCheck()) {
        result.stoppedAt = "upsert";
        break;
      }
      if (!record || typeof record !== "object") continue;
      try {
        const upsertResult = await runtime.upsertRecord(spec, {
          fetchImpl: options.fetchImpl,
          credentials: options.credentials,
        }, record as Record<string, unknown>);
        result.recordsUpserted++;
        if (upsertResult.result === "created") result.recordsCreated++;
        else result.recordsUpdated++;
        options.onProgress?.({
          phase: "upsert",
          recordsSeen: result.recordsFetched,
          recordsUpserted: result.recordsUpserted,
          upsertErrors: result.upsertErrors,
        });
      } catch {
        result.upsertErrors++;
        if (result.upsertErrors >= maxUpsertErrors) {
          result.stopReason = "upsert_error_threshold";
          result.stoppedAt = "upsert";
          result.errorMessage = `Hit upsert error threshold (${maxUpsertErrors})`;
          result.durationMs = Date.now() - started;
          return result;
        }
      }
    }
  }

  if (abortCheck()) {
    if (result.stoppedAt === "complete") result.stoppedAt = "upsert";
    result.durationMs = Date.now() - started;
    return result;
  }

  // ─── 5. HINTS ──────────────────────────────────────────────────
  if (extractHints) {
    options.onProgress?.({
      phase: "hints",
      recordsSeen: result.recordsFetched,
      recordsUpserted: result.recordsUpserted,
      upsertErrors: result.upsertErrors,
    });
    const { extractPersonalizationHints } = await import("./personalizationHints");
    result.personalizationHints = extractPersonalizationHints(freshSchema);
  }

  // ─── 6. COMPLETE ───────────────────────────────────────────────
  result.durationMs = Date.now() - started;
  options.onProgress?.({
    phase: "complete",
    recordsSeen: result.recordsFetched,
    recordsUpserted: result.recordsUpserted,
    upsertErrors: result.upsertErrors,
  });
  return result;
}

/**
 * One-line summary of a pipeline run for logs / UI.
 */
export function summarizePipelineResult(result: PipelineResult): string {
  const parts: string[] = [];
  parts.push(`${result.stopReason}`);
  parts.push(`${result.recordsFetched} fetched`);
  if (result.recordsUpserted > 0) {
    parts.push(`${result.recordsCreated}c/${result.recordsUpdated}u`);
  }
  if (result.upsertErrors > 0) parts.push(`${result.upsertErrors} errs`);
  if (result.fetchRetries > 0) parts.push(`${result.fetchRetries} retries`);
  if (result.drift) {
    const d = result.drift.summary;
    if (d.breaking + d.warning + d.info > 0) {
      parts.push(`drift=${d.breaking}b/${d.warning}w/${d.info}i`);
    }
  }
  parts.push(`${result.durationMs}ms`);
  return parts.join(" · ");
}
