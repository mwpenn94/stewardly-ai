/**
 * Client-side token + cost estimator for Code Chat (Pass 210).
 *
 * Pure functions that produce a rough token count from a character
 * length (GPT-4 / Claude tokenizers average ~3.8 chars/token for
 * English; we round up to ~4 for conservative estimates).
 *
 * For accurate counts we'd ship `tiktoken` or `@anthropic-ai/tokenizer`
 * to the browser bundle, but both are 500KB+ WASM and the inaccuracy
 * at this scale (displayed to the nearest 100 tokens) isn't worth the
 * weight. If a future pass wants exact counts, a server-side
 * `codeChat.estimateTokens` tRPC query would plug in cleanly behind
 * the same `estimateTokens()` call site.
 */

/** Estimate tokens in a string. Conservative: chars/3.8 rounded up. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3.8);
}

/**
 * Coarse pricing table. Values are $/1M tokens for input/output
 * respectively. Numbers are approximate public list prices; callers
 * that need precision should pull from the server-side model registry.
 */
export const MODEL_PRICING: Record<
  string,
  { inPer1M: number; outPer1M: number } | undefined
> = {
  "claude-opus-4-6": { inPer1M: 15, outPer1M: 75 },
  "claude-sonnet-4-6": { inPer1M: 3, outPer1M: 15 },
  "claude-haiku-4-5": { inPer1M: 0.8, outPer1M: 4 },
  "gpt-5": { inPer1M: 5, outPer1M: 20 },
  "gpt-4o": { inPer1M: 5, outPer1M: 15 },
  "gpt-4o-mini": { inPer1M: 0.15, outPer1M: 0.6 },
  "gemini-2.5-pro": { inPer1M: 3.5, outPer1M: 10.5 },
  "gemini-2.5-flash": { inPer1M: 0.3, outPer1M: 1.2 },
};

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUSD: number | null;
}

export function estimateMessageUsage(
  input: string,
  output: string,
  model: string | undefined,
): TokenUsage {
  const inputTokens = estimateTokens(input);
  const outputTokens = estimateTokens(output);
  const totalTokens = inputTokens + outputTokens;
  const pricing = model ? MODEL_PRICING[model] : undefined;
  const costUSD = pricing
    ? (inputTokens * pricing.inPer1M + outputTokens * pricing.outPer1M) /
      1_000_000
    : null;
  return { inputTokens, outputTokens, totalTokens, costUSD };
}

/** Sum multiple `TokenUsage` entries into a running total. */
export function sumUsage(usages: TokenUsage[]): TokenUsage {
  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;
  let costUSD: number | null = 0;
  let anyPriced = false;
  for (const u of usages) {
    inputTokens += u.inputTokens;
    outputTokens += u.outputTokens;
    totalTokens += u.totalTokens;
    if (u.costUSD !== null) {
      costUSD = (costUSD ?? 0) + u.costUSD;
      anyPriced = true;
    }
  }
  return {
    inputTokens,
    outputTokens,
    totalTokens,
    costUSD: anyPriced ? costUSD : null,
  };
}

export function formatTokens(n: number): string {
  if (n < 1000) return `${n}t`;
  if (n < 10_000) return `${(n / 1000).toFixed(1)}kt`;
  return `${Math.round(n / 1000)}kt`;
}

export function formatCost(cost: number | null): string {
  if (cost === null) return "—";
  if (cost < 0.001) return "<$0.001";
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

// ─── Budget guardrail (Pass 222) ─────────────────────────────────────────

export type BudgetStatus = "ok" | "warning" | "blocked";

export interface BudgetState {
  /** USD limit; null means no cap */
  limitUSD: number | null;
  /** Fraction 0..1 at which the "warning" state kicks in (default 0.5) */
  warnAt: number;
}

export const DEFAULT_BUDGET_STATE: BudgetState = {
  limitUSD: null,
  warnAt: 0.5,
};

export function evaluateBudget(
  totalCostUSD: number | null,
  state: BudgetState,
): { status: BudgetStatus; pct: number; remainingUSD: number | null } {
  if (state.limitUSD === null || state.limitUSD <= 0) {
    return { status: "ok", pct: 0, remainingUSD: null };
  }
  if (totalCostUSD === null) {
    // Session uses an unpriced model — we can't evaluate, stay neutral
    return { status: "ok", pct: 0, remainingUSD: state.limitUSD };
  }
  const pct = totalCostUSD / state.limitUSD;
  const remainingUSD = Math.max(0, state.limitUSD - totalCostUSD);
  if (pct >= 1) return { status: "blocked", pct, remainingUSD };
  if (pct >= state.warnAt) return { status: "warning", pct, remainingUSD };
  return { status: "ok", pct, remainingUSD };
}

// ─── Context window meter (Pass 230) ─────────────────────────────────────

/**
 * Context window limits by model (in tokens). Conservative defaults
 * — actual limits may be higher on newer revisions but these are
 * the publicly documented floors we can rely on.
 */
export const MODEL_CONTEXT_LIMITS: Record<string, number | undefined> = {
  "claude-opus-4-6": 1_000_000,
  "claude-sonnet-4-6": 1_000_000,
  "claude-haiku-4-5": 200_000,
  "gpt-5": 400_000,
  "gpt-4o": 128_000,
  "gpt-4o-mini": 128_000,
  "gemini-2.5-pro": 2_000_000,
  "gemini-2.5-flash": 1_000_000,
};

/** Fallback when the model isn't in the table — matches GPT-4o's 128K. */
export const DEFAULT_CONTEXT_LIMIT = 128_000;

export type ContextStatus = "ok" | "warning" | "critical";

export interface ContextWindowEval {
  /** Estimated tokens used so far */
  used: number;
  /** Context window for the active model */
  limit: number;
  /** Fraction used (0..1) */
  pct: number;
  /** Bucket: ok (<60%), warning (60-80%), critical (>80%) */
  status: ContextStatus;
  /** True when we had to fall back to the default limit */
  modelKnown: boolean;
}

/**
 * Evaluate token usage against the active model's context window.
 *
 * Thresholds:
 *   - ok       — under 60% of the limit
 *   - warning  — between 60% and 80%
 *   - critical — at or above 80% (user should clear/fork/compact)
 */
export function evaluateContextWindow(
  totalTokens: number,
  model: string | undefined,
): ContextWindowEval {
  const configured = model ? MODEL_CONTEXT_LIMITS[model] : undefined;
  const limit = configured ?? DEFAULT_CONTEXT_LIMIT;
  const pct = limit > 0 ? totalTokens / limit : 0;
  let status: ContextStatus = "ok";
  if (pct >= 0.8) status = "critical";
  else if (pct >= 0.6) status = "warning";
  return {
    used: totalTokens,
    limit,
    pct,
    status,
    modelKnown: configured !== undefined,
  };
}

/** Format a large token count as a compact M/K suffix for display. */
export function formatContextSize(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return String(n);
}
