/**
 * Streaming response rate meter — Pass 273.
 *
 * Pure sliding-window telemetry for tracking how fast the assistant
 * is streaming tokens. The client feeds the meter raw chunk bytes
 * as they arrive, and the meter produces a rolling tokens-per-second
 * + bytes-per-second estimate that can drive a live gauge in the UI.
 *
 * Uses the Pass 210 chars-per-token heuristic (≈3.8) for the token
 * estimate so there's no dependency on a tokenizer library.
 */

export interface RateMeterState {
  /** Sample points as {timestamp, cumulativeBytes} */
  samples: Array<{ t: number; bytes: number }>;
  /** Total bytes observed since start */
  totalBytes: number;
  /** Unix ms when the first sample landed */
  startedAt: number | null;
  /** Most recent sample timestamp */
  updatedAt: number | null;
}

export interface RateSnapshot {
  totalBytes: number;
  totalTokens: number;
  elapsedMs: number;
  /** Average tokens per second over the full session */
  avgTokensPerSecond: number;
  /** Recent tokens-per-second using the sliding window */
  windowTokensPerSecond: number;
  /** Recent bytes-per-second */
  windowBytesPerSecond: number;
  /** Number of samples in the sliding window */
  windowSize: number;
}

export const WINDOW_MS = 3_000;
export const MAX_SAMPLES = 300;
const CHARS_PER_TOKEN = 3.8;

export function emptyRateMeter(): RateMeterState {
  return { samples: [], totalBytes: 0, startedAt: null, updatedAt: null };
}

/**
 * Record an incoming chunk. Appends a new sample and trims any
 * samples older than WINDOW_MS so the sliding window stays bounded.
 */
export function recordChunk(
  state: RateMeterState,
  chunkBytes: number,
  now: number = Date.now(),
): RateMeterState {
  if (chunkBytes <= 0) return state;
  const nextTotal = state.totalBytes + chunkBytes;
  const sample = { t: now, bytes: nextTotal };
  const pruned = state.samples.filter((s) => now - s.t <= WINDOW_MS);
  const combined = [...pruned, sample];
  // Secondary cap: never keep more than MAX_SAMPLES regardless of
  // window (protects against very high burst rates)
  const capped =
    combined.length > MAX_SAMPLES ? combined.slice(-MAX_SAMPLES) : combined;
  return {
    samples: capped,
    totalBytes: nextTotal,
    startedAt: state.startedAt ?? now,
    updatedAt: now,
  };
}

/**
 * Snapshot the current state into human-readable rates. Returns
 * zeros when the meter has no samples yet so callers don't have
 * to null-check.
 */
export function snapshot(
  state: RateMeterState,
  now: number = Date.now(),
): RateSnapshot {
  const totalBytes = state.totalBytes;
  const totalTokens = Math.round(totalBytes / CHARS_PER_TOKEN);
  const elapsedMs =
    state.startedAt !== null ? Math.max(1, now - state.startedAt) : 0;
  const avgTokensPerSecond =
    elapsedMs > 0 ? (totalTokens / elapsedMs) * 1000 : 0;

  if (state.samples.length === 0) {
    return {
      totalBytes,
      totalTokens,
      elapsedMs,
      avgTokensPerSecond,
      windowTokensPerSecond: 0,
      windowBytesPerSecond: 0,
      windowSize: 0,
    };
  }

  const oldest = state.samples[0];
  const newest = state.samples[state.samples.length - 1];
  const windowMs = Math.max(1, newest.t - oldest.t);
  // Byte delta from oldest to newest in the window
  const bytesDelta = newest.bytes - oldest.bytes + 1; // +1 avoids div-by-zero rounding
  const windowBytesPerSecond = (bytesDelta / windowMs) * 1000;
  const windowTokensPerSecond = windowBytesPerSecond / CHARS_PER_TOKEN;

  return {
    totalBytes,
    totalTokens,
    elapsedMs,
    avgTokensPerSecond,
    windowTokensPerSecond,
    windowBytesPerSecond,
    windowSize: state.samples.length,
  };
}

/**
 * Format a tokens-per-second rate with sensible precision. Picks
 * decimals based on magnitude.
 */
export function formatTps(rate: number): string {
  if (!isFinite(rate) || isNaN(rate) || rate === 0) return "0 tok/s";
  if (rate < 10) return `${rate.toFixed(1)} tok/s`;
  return `${Math.round(rate)} tok/s`;
}

/**
 * Classify the current rate into a qualitative band for the UI.
 * Used to color the rate badge: slow (<20), normal (20-80),
 * fast (>80).
 */
export type RateBand = "idle" | "slow" | "normal" | "fast";

export function classifyRate(tps: number): RateBand {
  if (tps <= 0) return "idle";
  if (tps < 20) return "slow";
  if (tps < 80) return "normal";
  return "fast";
}

export function resetRateMeter(): RateMeterState {
  return emptyRateMeter();
}
