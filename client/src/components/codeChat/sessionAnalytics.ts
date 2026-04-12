/**
 * Session analytics for Code Chat (Pass 243).
 *
 * Pure reducers over the message log that derive a bill-of-materials
 * for the current session:
 *
 *   - Aggregate tokens + cost by model
 *   - Top N most expensive prompts
 *   - Per-tool invocation counts + total duration
 *   - Bytes read vs bytes written ratio
 *   - Duration + rate stats
 *
 * All functions take the existing `CodeChatMessage[]` from the hook
 * and the `estimateMessageUsage` helper from `tokenEstimator.ts`.
 * Keeps the analytics UI completely separate from the rendering state.
 */

import type { CodeChatMessage, ToolEvent } from "@/hooks/useCodeChatStream";
import {
  estimateMessageUsage,
  type TokenUsage,
} from "./tokenEstimator";

// ─── By-model aggregation ──────────────────────────────────────────────

export interface ModelBucket {
  model: string;
  turns: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUSD: number;
  unpricedTurns: number;
}

/**
 * Group every assistant message by its routed model and sum the
 * estimated usage. Messages with no `model` field fall into an
 * "unknown" bucket.
 */
export function aggregateByModel(messages: CodeChatMessage[]): ModelBucket[] {
  const buckets = new Map<string, ModelBucket>();
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    const model = msg.model ?? "unknown";
    // Input = most recent user turn before this assistant message
    let input = "";
    for (let j = i - 1; j >= 0; j--) {
      if (messages[j].role === "user") {
        input = messages[j].content;
        break;
      }
    }
    const usage = estimateMessageUsage(input, msg.content, msg.model);
    if (!buckets.has(model)) {
      buckets.set(model, {
        model,
        turns: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        costUSD: 0,
        unpricedTurns: 0,
      });
    }
    const bucket = buckets.get(model)!;
    bucket.turns++;
    bucket.inputTokens += usage.inputTokens;
    bucket.outputTokens += usage.outputTokens;
    bucket.totalTokens += usage.totalTokens;
    if (usage.costUSD === null) {
      bucket.unpricedTurns++;
    } else {
      bucket.costUSD += usage.costUSD;
    }
  }
  return Array.from(buckets.values()).sort((a, b) => b.costUSD - a.costUSD);
}

// ─── Top expensive turns ────────────────────────────────────────────────

export interface TurnCost {
  messageId: string;
  index: number;
  promptPreview: string;
  model: string;
  usage: TokenUsage;
}

export function topExpensiveTurns(
  messages: CodeChatMessage[],
  n = 5,
): TurnCost[] {
  const turns: TurnCost[] = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    let input = "";
    for (let j = i - 1; j >= 0; j--) {
      if (messages[j].role === "user") {
        input = messages[j].content;
        break;
      }
    }
    const usage = estimateMessageUsage(input, msg.content, msg.model);
    if (usage.costUSD === null || usage.costUSD === 0) continue;
    turns.push({
      messageId: msg.id,
      index: i,
      promptPreview: input.slice(0, 120),
      model: msg.model ?? "unknown",
      usage,
    });
  }
  return turns
    .sort((a, b) => (b.usage.costUSD ?? 0) - (a.usage.costUSD ?? 0))
    .slice(0, n);
}

// ─── Tool usage ────────────────────────────────────────────────────────

export interface ToolUsageBucket {
  toolName: string;
  count: number;
  totalDurationMs: number;
  errorCount: number;
  avgDurationMs: number;
}

export function toolUsageStats(messages: CodeChatMessage[]): ToolUsageBucket[] {
  const buckets = new Map<string, ToolUsageBucket>();
  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    if (!msg.toolEvents) continue;
    for (const ev of msg.toolEvents) {
      const name = ev.toolName ?? "unknown";
      if (!buckets.has(name)) {
        buckets.set(name, {
          toolName: name,
          count: 0,
          totalDurationMs: 0,
          errorCount: 0,
          avgDurationMs: 0,
        });
      }
      const bucket = buckets.get(name)!;
      bucket.count++;
      if (typeof ev.durationMs === "number") {
        bucket.totalDurationMs += ev.durationMs;
      }
      if (ev.kind === "error" || ev.status === "error") {
        bucket.errorCount++;
      }
    }
  }
  // Fill avg
  const list = Array.from(buckets.values());
  for (const bucket of list) {
    bucket.avgDurationMs = bucket.count > 0 ? bucket.totalDurationMs / bucket.count : 0;
  }
  return list.sort((a, b) => b.totalDurationMs - a.totalDurationMs);
}

// ─── Bytes read/write ratio ────────────────────────────────────────────

export interface BytesRatio {
  bytesRead: number;
  bytesWritten: number;
  filesRead: number;
  filesWritten: number;
  /** Ratio of write bytes to total bytes. 0 = read-only, 1 = all writes */
  writeRatio: number;
}

function extractResultInner(ev: ToolEvent): Record<string, unknown> | null {
  if (typeof ev.preview !== "string") return null;
  try {
    const parsed = JSON.parse(ev.preview) as Record<string, unknown>;
    const inner = parsed?.result;
    if (!inner || typeof inner !== "object") return null;
    return inner as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function bytesRatio(messages: CodeChatMessage[]): BytesRatio {
  let bytesRead = 0;
  let bytesWritten = 0;
  const filesRead = new Set<string>();
  const filesWritten = new Set<string>();

  for (const msg of messages) {
    if (msg.role !== "assistant" || !msg.toolEvents) continue;
    for (const ev of msg.toolEvents) {
      const inner = extractResultInner(ev);
      if (!inner) continue;
      if (ev.toolName === "read_file") {
        if (typeof inner.byteLength === "number") bytesRead += inner.byteLength;
        if (typeof inner.path === "string") filesRead.add(inner.path);
      } else if (ev.toolName === "write_file" || ev.toolName === "edit_file") {
        if (typeof inner.byteLength === "number") {
          bytesWritten += inner.byteLength;
        } else if (typeof inner.after === "string") {
          bytesWritten += inner.after.length;
        }
        if (typeof inner.path === "string") filesWritten.add(inner.path);
      }
    }
  }

  const total = bytesRead + bytesWritten;
  const writeRatio = total === 0 ? 0 : bytesWritten / total;
  return {
    bytesRead,
    bytesWritten,
    filesRead: filesRead.size,
    filesWritten: filesWritten.size,
    writeRatio,
  };
}

// ─── Duration + throughput ─────────────────────────────────────────────

export interface DurationStats {
  totalMs: number;
  avgMs: number;
  turns: number;
  firstMessageAt: number | null;
  lastMessageAt: number | null;
  spanMs: number;
}

export function durationStats(messages: CodeChatMessage[]): DurationStats {
  let totalMs = 0;
  let turns = 0;
  let firstMessageAt: number | null = null;
  let lastMessageAt: number | null = null;
  for (const msg of messages) {
    const ts = msg.timestamp instanceof Date ? msg.timestamp.getTime() : 0;
    if (firstMessageAt === null || ts < firstMessageAt) firstMessageAt = ts;
    if (lastMessageAt === null || ts > lastMessageAt) lastMessageAt = ts;
    if (msg.role === "assistant" && typeof msg.totalDurationMs === "number") {
      totalMs += msg.totalDurationMs;
      turns++;
    }
  }
  return {
    totalMs,
    avgMs: turns === 0 ? 0 : totalMs / turns,
    turns,
    firstMessageAt,
    lastMessageAt,
    spanMs: firstMessageAt !== null && lastMessageAt !== null ? lastMessageAt - firstMessageAt : 0,
  };
}

// ─── Latency histogram (Build-loop Pass 6 — G14) ──────────────────────
//
// p50/p95/p99 over the assistant turn durations + a logarithmic
// histogram so users can spot tail-latency outliers in the session
// analytics popover. Bucketing is fixed (≤100ms, ≤250ms, ≤500ms,
// ≤1s, ≤2.5s, ≤5s, ≤10s, ≤30s, >30s) to keep the UI deterministic
// regardless of sample size.

export interface LatencyHistogramBucket {
  /** Inclusive upper bound in ms (Infinity for the overflow bucket). */
  upperBoundMs: number;
  /** Human-readable label (e.g. "≤500ms" or ">30s"). */
  label: string;
  /** How many turns landed in this bucket. */
  count: number;
}

export interface LatencyHistogram {
  /** Total turns sampled (sum of bucket counts). */
  count: number;
  /** Lowest observed latency. */
  minMs: number;
  /** Highest observed latency. */
  maxMs: number;
  /** Mean. */
  meanMs: number;
  /** 50th percentile (median). */
  p50Ms: number;
  /** 95th percentile. */
  p95Ms: number;
  /** 99th percentile. */
  p99Ms: number;
  /** Sorted bucket counts (always 9 buckets). */
  buckets: LatencyHistogramBucket[];
}

const HISTOGRAM_BOUNDS_MS: Array<{ upperBoundMs: number; label: string }> = [
  { upperBoundMs: 100, label: "≤100ms" },
  { upperBoundMs: 250, label: "≤250ms" },
  { upperBoundMs: 500, label: "≤500ms" },
  { upperBoundMs: 1_000, label: "≤1s" },
  { upperBoundMs: 2_500, label: "≤2.5s" },
  { upperBoundMs: 5_000, label: "≤5s" },
  { upperBoundMs: 10_000, label: "≤10s" },
  { upperBoundMs: 30_000, label: "≤30s" },
  { upperBoundMs: Infinity, label: ">30s" },
];

const EMPTY_HISTOGRAM: LatencyHistogram = {
  count: 0,
  minMs: 0,
  maxMs: 0,
  meanMs: 0,
  p50Ms: 0,
  p95Ms: 0,
  p99Ms: 0,
  buckets: HISTOGRAM_BOUNDS_MS.map(({ upperBoundMs, label }) => ({
    upperBoundMs,
    label,
    count: 0,
  })),
};

/**
 * Pure percentile calculator using "nearest-rank" interpolation.
 * `samples` must be sorted ascending; `p` is in [0, 100]. Returns 0
 * for an empty sample set rather than NaN so the UI can render
 * unconditionally.
 *
 * Exported for direct testing.
 */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const clamped = Math.min(100, Math.max(0, p));
  // Linear interpolation between the two ranks straddling the percentile.
  const rank = (clamped / 100) * (sorted.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return sorted[lower];
  const frac = rank - lower;
  return sorted[lower] * (1 - frac) + sorted[upper] * frac;
}

/**
 * Build a latency histogram + percentile summary from the assistant
 * `totalDurationMs` field on every assistant message that has one.
 *
 * Skips messages without `totalDurationMs` (for example, the streaming
 * placeholder turn during execution) and silently drops negative or
 * non-finite values so a corrupted message can't poison the math.
 */
export function latencyHistogram(messages: CodeChatMessage[]): LatencyHistogram {
  const samples: number[] = [];
  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    const dur = msg.totalDurationMs;
    if (typeof dur !== "number" || !Number.isFinite(dur) || dur < 0) continue;
    samples.push(dur);
  }
  if (samples.length === 0) {
    // Return a fresh copy so callers can safely mutate.
    return {
      ...EMPTY_HISTOGRAM,
      buckets: EMPTY_HISTOGRAM.buckets.map((b) => ({ ...b })),
    };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const buckets = HISTOGRAM_BOUNDS_MS.map(({ upperBoundMs, label }) => ({
    upperBoundMs,
    label,
    count: 0,
  }));
  for (const sample of sorted) {
    for (const bucket of buckets) {
      if (sample <= bucket.upperBoundMs) {
        bucket.count++;
        break;
      }
    }
  }
  const sum = sorted.reduce((acc, n) => acc + n, 0);
  return {
    count: sorted.length,
    minMs: sorted[0],
    maxMs: sorted[sorted.length - 1],
    meanMs: sum / sorted.length,
    p50Ms: percentile(sorted, 50),
    p95Ms: percentile(sorted, 95),
    p99Ms: percentile(sorted, 99),
    buckets,
  };
}

// ─── Top-level summary ─────────────────────────────────────────────────

export interface SessionAnalytics {
  byModel: ModelBucket[];
  topTurns: TurnCost[];
  tools: ToolUsageBucket[];
  bytes: BytesRatio;
  duration: DurationStats;
  /** Build-loop Pass 6: per-turn latency histogram + percentiles. */
  latency: LatencyHistogram;
  totalMessages: number;
  userTurns: number;
  assistantTurns: number;
}

export function analyzeSession(messages: CodeChatMessage[]): SessionAnalytics {
  let userTurns = 0;
  let assistantTurns = 0;
  for (const msg of messages) {
    if (msg.role === "user") userTurns++;
    else if (msg.role === "assistant") assistantTurns++;
  }
  return {
    byModel: aggregateByModel(messages),
    topTurns: topExpensiveTurns(messages, 5),
    tools: toolUsageStats(messages),
    bytes: bytesRatio(messages),
    duration: durationStats(messages),
    latency: latencyHistogram(messages),
    totalMessages: messages.length,
    userTurns,
    assistantTurns,
  };
}
