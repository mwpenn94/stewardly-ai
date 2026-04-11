/**
 * Diagnostics cache (Pass 252).
 *
 * Running `tsc --noEmit` against the full project takes ~10-20s so we
 * cache the parsed diagnostics for 45 seconds by default. Concurrent
 * callers that arrive during a run share the single in-flight promise.
 */

import type { Diagnostic } from "./diagnostics";

export interface DiagnosticsSnapshot {
  diagnostics: Diagnostic[];
  /** ISO string when the run started */
  startedAt: string;
  /** ISO string when the run finished */
  finishedAt: string;
  /** Total ms the compiler took */
  durationMs: number;
  /** Exit code from the compiler process */
  exitCode: number;
  /** Stderr tail for display when the run explodes */
  stderrTail: string;
  /** True if the cache is currently being refreshed */
  stale?: boolean;
}

interface CacheEntry {
  value: DiagnosticsSnapshot;
  insertedAt: number;
}

const CACHE_TTL_MS = 45_000;
let _cache: CacheEntry | null = null;
let _inflight: Promise<DiagnosticsSnapshot> | null = null;

export function getCachedDiagnostics(): DiagnosticsSnapshot | null {
  if (!_cache) return null;
  const age = Date.now() - _cache.insertedAt;
  if (age > CACHE_TTL_MS) return null;
  return _cache.value;
}

export function setCachedDiagnostics(snap: DiagnosticsSnapshot): void {
  _cache = { value: snap, insertedAt: Date.now() };
}

export function clearDiagnosticsCache(): void {
  _cache = null;
}

export async function withInflight<T extends DiagnosticsSnapshot>(
  factory: () => Promise<T>,
): Promise<T> {
  if (_inflight) {
    return _inflight as Promise<T>;
  }
  _inflight = factory();
  try {
    const result = await _inflight;
    return result as T;
  } finally {
    _inflight = null;
  }
}
