/**
 * Cost sheet calculator — Pass 269.
 *
 * Pure helpers for estimating and projecting Code Chat API costs.
 * Users enter a model, expected input/output token counts, and a
 * call frequency; the calculator produces daily / monthly cost
 * projections so users can plan budgets for a long-running task.
 *
 * Extends the Pass 210 MODEL_PRICING table with a set of derived
 * comparisons (cheapest / most expensive / recommended) so users
 * can pick a model rationally.
 */

export interface ModelPrice {
  id: string;
  name: string;
  /** USD per 1M input tokens */
  inputPerMillion: number;
  /** USD per 1M output tokens */
  outputPerMillion: number;
  /** Max context window in tokens */
  contextWindow: number;
  /** Tier label for sorting/grouping */
  tier: "haiku" | "sonnet" | "opus" | "gpt-mini" | "gpt" | "gemini" | "llama";
}

export const MODEL_PRICES: Readonly<ModelPrice[]> = [
  {
    id: "claude-haiku-4-5",
    name: "Claude Haiku 4.5",
    inputPerMillion: 0.8,
    outputPerMillion: 4.0,
    contextWindow: 200_000,
    tier: "haiku",
  },
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
    contextWindow: 200_000,
    tier: "sonnet",
  },
  {
    id: "claude-opus-4-6",
    name: "Claude Opus 4.6",
    inputPerMillion: 15.0,
    outputPerMillion: 75.0,
    contextWindow: 200_000,
    tier: "opus",
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    inputPerMillion: 0.15,
    outputPerMillion: 0.6,
    contextWindow: 128_000,
    tier: "gpt-mini",
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    inputPerMillion: 2.5,
    outputPerMillion: 10.0,
    contextWindow: 128_000,
    tier: "gpt",
  },
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    inputPerMillion: 0.075,
    outputPerMillion: 0.3,
    contextWindow: 1_000_000,
    tier: "gemini",
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    inputPerMillion: 1.25,
    outputPerMillion: 5.0,
    contextWindow: 1_000_000,
    tier: "gemini",
  },
  {
    id: "llama-3.3-70b",
    name: "Llama 3.3 70B",
    inputPerMillion: 0.35,
    outputPerMillion: 0.35,
    contextWindow: 128_000,
    tier: "llama",
  },
];

export interface CostEstimate {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  costPerCall: number;
}

export interface CostProjection {
  perCall: CostEstimate;
  daily: number;
  weekly: number;
  monthly: number;
  annualRate: number;
}

export function findModelPrice(id: string): ModelPrice | null {
  return MODEL_PRICES.find((m) => m.id === id) ?? null;
}

/**
 * Compute a single-call cost estimate. Token counts are multiplied
 * by the per-million rates and summed. Input and output are kept
 * separate so the UI can show the breakdown.
 */
export function estimateCallCost(
  model: ModelPrice,
  inputTokens: number,
  outputTokens: number,
): CostEstimate {
  const safeInput = Math.max(0, inputTokens);
  const safeOutput = Math.max(0, outputTokens);
  const inputCost = (safeInput / 1_000_000) * model.inputPerMillion;
  const outputCost = (safeOutput / 1_000_000) * model.outputPerMillion;
  const totalCost = inputCost + outputCost;
  return {
    inputCost,
    outputCost,
    totalCost,
    costPerCall: totalCost,
  };
}

/**
 * Project the cost of making N calls per day across daily / weekly /
 * monthly / annual windows. Uses calendar-typical constants
 * (30.4 days/month, 365 days/year) rather than raw multiplication.
 */
export function projectCost(
  model: ModelPrice,
  inputTokens: number,
  outputTokens: number,
  callsPerDay: number,
): CostProjection {
  const perCall = estimateCallCost(model, inputTokens, outputTokens);
  const daily = perCall.totalCost * Math.max(0, callsPerDay);
  return {
    perCall,
    daily,
    weekly: daily * 7,
    monthly: daily * 30.4,
    annualRate: daily * 365,
  };
}

/**
 * Compare the current model + usage profile against every other
 * model to produce a ranked list sorted by total monthly cost.
 * Used by the UI to say "you could save $X by switching to Y".
 */
export interface ModelComparison {
  model: ModelPrice;
  projection: CostProjection;
  relativeCost: number; // cost vs current model (1.0 = same)
  savings: number; // positive = cheaper than current
}

export function compareModels(
  currentId: string,
  inputTokens: number,
  outputTokens: number,
  callsPerDay: number,
): ModelComparison[] {
  const current = findModelPrice(currentId);
  const currentMonthly = current
    ? projectCost(current, inputTokens, outputTokens, callsPerDay).monthly
    : 0;
  const rows = MODEL_PRICES.map((model) => {
    const projection = projectCost(model, inputTokens, outputTokens, callsPerDay);
    return {
      model,
      projection,
      relativeCost: currentMonthly > 0 ? projection.monthly / currentMonthly : 1,
      savings: currentMonthly - projection.monthly,
    };
  });
  rows.sort((a, b) => a.projection.monthly - b.projection.monthly);
  return rows;
}

/**
 * Format a USD amount with sensible precision: tiny values go to
 * six decimals, large values get comma thousands separators.
 */
export function formatUsd(amount: number): string {
  if (!isFinite(amount) || isNaN(amount)) return "$0";
  if (amount === 0) return "$0.00";
  if (amount < 0.001) return `$${amount.toFixed(6)}`;
  if (amount < 1) return `$${amount.toFixed(4)}`;
  if (amount < 100) return `$${amount.toFixed(2)}`;
  return `$${Math.round(amount).toLocaleString()}`;
}

/**
 * Given a list of {model, projection} comparisons, find the
 * cheapest and most expensive options and produce a human summary.
 */
export function summarizeComparison(
  comparisons: ModelComparison[],
): {
  cheapest: ModelComparison | null;
  mostExpensive: ModelComparison | null;
  avgMonthly: number;
} {
  if (comparisons.length === 0) {
    return { cheapest: null, mostExpensive: null, avgMonthly: 0 };
  }
  const sorted = [...comparisons].sort(
    (a, b) => a.projection.monthly - b.projection.monthly,
  );
  const total = comparisons.reduce((acc, c) => acc + c.projection.monthly, 0);
  return {
    cheapest: sorted[0],
    mostExpensive: sorted[sorted.length - 1],
    avgMonthly: total / comparisons.length,
  };
}
