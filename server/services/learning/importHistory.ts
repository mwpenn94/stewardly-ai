/**
 * EMBA Learning — import-run history persistence (pass 4, build loop).
 *
 * Problem this module solves: `importEMBAFromGitHub()` returns a
 * detailed `EMBAImportResult` (counts, skipped, errors, durationMs)
 * but throws the result away the moment the tRPC response sends.
 * Admins have no way to answer:
 *
 *   - "When was the last successful import?"
 *   - "What did the last run add or skip?"
 *   - "Did anything fail recently?"
 *   - "How does the latest emba_modules pull compare to the prior one?"
 *
 * The Content Studio UI fired a one-shot toast and that was that.
 *
 * This module persists every import run to a JSON file under
 * `.stewardly/learning_import_history.json` (matching the existing
 * `.stewardly/roadmap.json` precedent in `server/routers/codeChat.ts`).
 * The path is overridable via `LEARNING_IMPORT_HISTORY_PATH` for
 * tests + alternative deployments. The file is gitignored so it can
 * be written from any deployment without polluting the tree.
 *
 * Design notes:
 *
 *   - Pure helpers (`appendRunToHistory`, `summarizeHistory`,
 *     `parseHistory`, `serializeHistory`) live at module top so the
 *     ring-buffer + summary logic can be unit-tested without touching
 *     disk.
 *   - File I/O is best-effort: a failed read returns empty history,
 *     a failed write logs and continues. The import itself never
 *     fails because the history couldn't be persisted.
 *   - Ring-buffer caps at 50 runs so a noisy ops cycle can't grow
 *     the file unboundedly.
 *   - Each run carries a deterministic `id` (ISO timestamp) so the
 *     UI can stable-key list rows.
 */

import { promises as fs } from "node:fs";
import * as path from "node:path";
import { logger } from "../../_core/logger";
import type { EMBAImportResult } from "./embaImport";

const log = logger.child({ module: "learning/importHistory" });

// ─── Constants + paths ────────────────────────────────────────────────────

const HISTORY_DIR_NAME = ".stewardly";
const HISTORY_FILE_NAME = "learning_import_history.json";

/** Hard cap on retained runs. Newest first. */
export const MAX_HISTORY_ENTRIES = 50;

function defaultHistoryPath(): string {
  if (process.env.LEARNING_IMPORT_HISTORY_PATH) {
    return process.env.LEARNING_IMPORT_HISTORY_PATH;
  }
  // Workspace-rooted resolution mirrors codeChat.ts so a server
  // started from `pnpm dev` writes next to the project, not next to
  // node_modules.
  const cwd = process.cwd();
  return path.join(cwd, HISTORY_DIR_NAME, HISTORY_FILE_NAME);
}

// ─── Types ───────────────────────────────────────────────────────────────

export interface ImportRunEntry {
  /** ISO-8601 timestamp; also used as the stable list key. */
  id: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  ok: boolean;
  source: { embaDataUrl: string; tracksDataUrl: string };
  counts: EMBAImportResult["counts"];
  skipped: EMBAImportResult["skipped"];
  errorCount: number;
  /** First 5 error messages so a noisy run doesn't bloat the history file. */
  errorSamples: string[];
  /** Total inserted (sum of counts) — convenience field for the UI summary strip. */
  totalInserted: number;
}

export interface ImportHistoryFile {
  version: 1;
  runs: ImportRunEntry[];
}

export interface ImportHistorySummary {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastInsertedTotal: number;
  /** Aggregate insert counts across the entire retained window. */
  totals: {
    disciplines: number;
    definitions: number;
    tracks: number;
    chapters: number;
    subsections: number;
    questions: number;
    flashcards: number;
  };
}

// ─── Pure helpers ─────────────────────────────────────────────────────────

/** Pure. Default-shaped empty history. */
export function emptyHistory(): ImportHistoryFile {
  return { version: 1, runs: [] };
}

/**
 * Pure. Convert an `EMBAImportResult` (output of `importEMBAFromGitHub`)
 * into a compact ImportRunEntry that's safe to store and tail.
 *
 * `startedAt` is reconstructed by subtracting the result's
 * `durationMs` from `finishedAt` so the entry's window is preserved
 * even when the importer returns the result async.
 */
export function entryFromResult(
  result: EMBAImportResult,
  finishedAt: Date = new Date(),
): ImportRunEntry {
  const finishedAtIso = finishedAt.toISOString();
  const startedAtMs = finishedAt.getTime() - Math.max(0, result.durationMs);
  const startedAtIso = new Date(startedAtMs).toISOString();
  const totalInserted = sumCounts(result.counts);
  return {
    id: finishedAtIso,
    startedAt: startedAtIso,
    finishedAt: finishedAtIso,
    durationMs: result.durationMs,
    ok: result.ok,
    source: result.source,
    counts: { ...result.counts },
    skipped: { ...result.skipped },
    errorCount: result.errors.length,
    errorSamples: result.errors.slice(0, 5),
    totalInserted,
  };
}

function sumCounts(c: EMBAImportResult["counts"]): number {
  return (
    c.disciplines +
    c.definitions +
    c.tracks +
    c.chapters +
    c.subsections +
    c.questions +
    c.flashcards
  );
}

/**
 * Pure. Append a run to the history, newest-first, capped at
 * `MAX_HISTORY_ENTRIES`. Does NOT mutate the input.
 */
export function appendRunToHistory(
  history: ImportHistoryFile,
  entry: ImportRunEntry,
): ImportHistoryFile {
  const next: ImportRunEntry[] = [entry, ...history.runs];
  if (next.length > MAX_HISTORY_ENTRIES) next.length = MAX_HISTORY_ENTRIES;
  return { version: 1, runs: next };
}

/**
 * Pure. Defensive parser. Accepts a raw string (file contents) and
 * returns a valid ImportHistoryFile. Drops malformed entries
 * silently rather than throwing — a corrupted file should never take
 * the import path down.
 */
export function parseHistory(raw: string | null | undefined): ImportHistoryFile {
  if (!raw || typeof raw !== "string") return emptyHistory();
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyHistory();
  }
  if (!parsed || typeof parsed !== "object") return emptyHistory();
  if (!Array.isArray(parsed.runs)) return emptyHistory();
  const runs: ImportRunEntry[] = [];
  for (const r of parsed.runs) {
    const e = sanitizeEntry(r);
    if (e) runs.push(e);
    if (runs.length >= MAX_HISTORY_ENTRIES) break;
  }
  return { version: 1, runs };
}

function sanitizeEntry(raw: any): ImportRunEntry | null {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.id !== "string") return null;
  const counts = sanitizeCounts(raw.counts);
  const skipped = sanitizeSkipped(raw.skipped);
  if (!counts || !skipped) return null;
  return {
    id: raw.id,
    startedAt: typeof raw.startedAt === "string" ? raw.startedAt : raw.id,
    finishedAt: typeof raw.finishedAt === "string" ? raw.finishedAt : raw.id,
    durationMs: typeof raw.durationMs === "number" ? raw.durationMs : 0,
    ok: typeof raw.ok === "boolean" ? raw.ok : true,
    source:
      raw.source && typeof raw.source === "object"
        ? {
            embaDataUrl: String(raw.source.embaDataUrl ?? ""),
            tracksDataUrl: String(raw.source.tracksDataUrl ?? ""),
          }
        : { embaDataUrl: "", tracksDataUrl: "" },
    counts,
    skipped,
    errorCount: typeof raw.errorCount === "number" ? raw.errorCount : 0,
    errorSamples: Array.isArray(raw.errorSamples)
      ? raw.errorSamples.filter((s: any) => typeof s === "string").slice(0, 5)
      : [],
    totalInserted:
      typeof raw.totalInserted === "number" ? raw.totalInserted : sumCounts(counts),
  };
}

function sanitizeCounts(raw: any): EMBAImportResult["counts"] | null {
  if (!raw || typeof raw !== "object") return null;
  return {
    disciplines: numOr0(raw.disciplines),
    definitions: numOr0(raw.definitions),
    tracks: numOr0(raw.tracks),
    chapters: numOr0(raw.chapters),
    subsections: numOr0(raw.subsections),
    questions: numOr0(raw.questions),
    flashcards: numOr0(raw.flashcards),
  };
}

function sanitizeSkipped(raw: any): EMBAImportResult["skipped"] | null {
  if (!raw || typeof raw !== "object") return null;
  return {
    disciplines: numOr0(raw.disciplines),
    definitions: numOr0(raw.definitions),
    tracks: numOr0(raw.tracks),
    chapters: numOr0(raw.chapters),
    questions: numOr0(raw.questions),
    flashcards: numOr0(raw.flashcards),
  };
}

function numOr0(v: any): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0;
}

/** Pure. Stable JSON serialization for the persistence file. */
export function serializeHistory(history: ImportHistoryFile): string {
  return JSON.stringify(history, null, 2);
}

/**
 * Pure. Aggregate stats over the retained history window. Powers
 * the Content Studio summary strip.
 */
export function summarizeHistory(history: ImportHistoryFile): ImportHistorySummary {
  const runs = history.runs;
  const successfulRuns = runs.filter((r) => r.ok && r.errorCount === 0).length;
  const failedRuns = runs.length - successfulRuns;
  const lastRun = runs[0] ?? null;
  const lastSuccess = runs.find((r) => r.ok && r.errorCount === 0) ?? null;

  const totals = {
    disciplines: 0,
    definitions: 0,
    tracks: 0,
    chapters: 0,
    subsections: 0,
    questions: 0,
    flashcards: 0,
  };
  for (const r of runs) {
    totals.disciplines += r.counts.disciplines;
    totals.definitions += r.counts.definitions;
    totals.tracks += r.counts.tracks;
    totals.chapters += r.counts.chapters;
    totals.subsections += r.counts.subsections;
    totals.questions += r.counts.questions;
    totals.flashcards += r.counts.flashcards;
  }

  return {
    totalRuns: runs.length,
    successfulRuns,
    failedRuns,
    lastRunAt: lastRun?.finishedAt ?? null,
    lastSuccessAt: lastSuccess?.finishedAt ?? null,
    lastInsertedTotal: lastRun?.totalInserted ?? 0,
    totals,
  };
}

// ─── File I/O (best-effort, never throws) ────────────────────────────────

export async function loadImportHistory(): Promise<ImportHistoryFile> {
  const filePath = defaultHistoryPath();
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return parseHistory(raw);
  } catch (err) {
    // ENOENT is the common case (no runs yet); silently empty.
    if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") {
      log.warn({ err: String(err), filePath }, "loadImportHistory read failed");
    }
    return emptyHistory();
  }
}

async function ensureDir(filePath: string): Promise<void> {
  const dir = path.dirname(filePath);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    log.warn({ err: String(err), dir }, "ensureDir failed");
  }
}

export async function persistImportHistory(history: ImportHistoryFile): Promise<void> {
  const filePath = defaultHistoryPath();
  try {
    await ensureDir(filePath);
    await fs.writeFile(filePath, serializeHistory(history), "utf-8");
  } catch (err) {
    log.warn({ err: String(err), filePath }, "persistImportHistory write failed");
  }
}

/**
 * Top-level entry point — load, append, persist. Best-effort: a
 * failed persist still returns the new history so callers can show
 * the in-memory state to the user.
 */
export async function recordImportRun(
  result: EMBAImportResult,
  now: Date = new Date(),
): Promise<{ history: ImportHistoryFile; entry: ImportRunEntry }> {
  const entry = entryFromResult(result, now);
  const current = await loadImportHistory();
  const next = appendRunToHistory(current, entry);
  await persistImportHistory(next);
  return { history: next, entry };
}
