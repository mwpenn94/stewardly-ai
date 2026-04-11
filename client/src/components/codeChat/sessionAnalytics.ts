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

// ─── Top-level summary ─────────────────────────────────────────────────

export interface SessionAnalytics {
  byModel: ModelBucket[];
  topTurns: TurnCost[];
  tools: ToolUsageBucket[];
  bytes: BytesRatio;
  duration: DurationStats;
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
    totalMessages: messages.length,
    userTurns,
    assistantTurns,
  };
}
