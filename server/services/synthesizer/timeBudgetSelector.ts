/**
 * Time-budget model selector — Round A7 enhancement.
 *
 * Pulled from the multi-model-ai-synthesizer pattern: given a hard
 * latency budget (e.g. "give me the best answer in under 6 seconds"),
 * select the largest set of models whose summed estimated response
 * time fits the budget. Used by the consensus path in client-facing
 * workflows where wall-clock latency is a fiduciary concern.
 *
 * Pure function — no LLM, no DB, fully unit-testable. The model
 * registry is passed in so callers can compose this with whatever
 * registry shape Stewardly is using at the time.
 */

export interface ModelLatencyEntry {
  id: string;
  /** Display name */
  name: string;
  /** Estimated time-to-first-token + median completion time, ms */
  estimatedResponseMs: number;
  /** Coarse rating used by the UI for color coding */
  speedRating: "fast" | "moderate" | "slow";
  /** Optional quality score 0-1 (used as a tiebreaker when multiple
   *  candidate sets fit the budget) */
  qualityScore?: number;
  /** Optional cost per call (used for cost-aware tiebreak) */
  costPerCall?: number;
}

export interface TimeBudgetSelection {
  selected: ModelLatencyEntry[];
  totalEstimatedMs: number;
  budgetMs: number;
  /** True when at least one model fits */
  fits: boolean;
  /** Sum of qualityScore for the selected set */
  qualitySum: number;
  /** Reason a candidate model was excluded, keyed by id */
  exclusions: Record<string, string>;
}

const DEFAULT_SYNTHESIS_OVERHEAD_MS = 4000;

/**
 * Select the largest set of models whose total estimated time + a
 * fixed synthesis overhead fits within `budgetMs`. We greedily pick
 * fastest-first because consensus quality scales with model COUNT
 * before it scales with model QUALITY (per the audit findings).
 *
 * Tie-breaks (when multiple models could be added at the same step):
 *   1. Higher quality score
 *   2. Lower cost per call
 */
export function selectModelsWithinTimeBudget(
  available: ModelLatencyEntry[],
  budgetMs: number,
  options: {
    minModels?: number;
    maxModels?: number;
    synthesisOverheadMs?: number;
  } = {},
): TimeBudgetSelection {
  const synthesisOverhead = options.synthesisOverheadMs ?? DEFAULT_SYNTHESIS_OVERHEAD_MS;
  const maxModels = options.maxModels ?? 5;
  const minModels = options.minModels ?? 1;

  const sorted = [...available].sort((a, b) => {
    if (a.estimatedResponseMs !== b.estimatedResponseMs) {
      return a.estimatedResponseMs - b.estimatedResponseMs;
    }
    // Same speed → higher quality wins
    const qa = a.qualityScore ?? 0;
    const qb = b.qualityScore ?? 0;
    if (qa !== qb) return qb - qa;
    // Same quality → cheaper wins
    return (a.costPerCall ?? 0) - (b.costPerCall ?? 0);
  });

  const selected: ModelLatencyEntry[] = [];
  const exclusions: Record<string, string> = {};
  let runningTotal = synthesisOverhead;

  for (const m of sorted) {
    if (selected.length >= maxModels) {
      exclusions[m.id] = "max_models_reached";
      continue;
    }
    if (runningTotal + m.estimatedResponseMs > budgetMs) {
      exclusions[m.id] = `exceeds_budget (would be ${runningTotal + m.estimatedResponseMs}ms > ${budgetMs}ms)`;
      continue;
    }
    selected.push(m);
    runningTotal += m.estimatedResponseMs;
  }

  // If we couldn't even fit `minModels`, return the cheapest set
  // we can with the fits=false flag so the caller knows the budget
  // was too tight.
  if (selected.length < minModels) {
    return {
      selected: sorted.slice(0, minModels),
      totalEstimatedMs:
        sorted.slice(0, minModels).reduce((s, m) => s + m.estimatedResponseMs, 0) +
        synthesisOverhead,
      budgetMs,
      fits: false,
      qualitySum: sorted
        .slice(0, minModels)
        .reduce((s, m) => s + (m.qualityScore ?? 0), 0),
      exclusions,
    };
  }

  return {
    selected,
    totalEstimatedMs: runningTotal,
    budgetMs,
    fits: true,
    qualitySum: selected.reduce((s, m) => s + (m.qualityScore ?? 0), 0),
    exclusions,
  };
}

/**
 * Helper: classify a numeric latency into the speedRating buckets the
 * UI uses for color coding. Used by the model registry seed when
 * adding `speedRating` fields.
 */
export function classifyLatency(ms: number): "fast" | "moderate" | "slow" {
  if (ms < 2000) return "fast";
  if (ms < 6000) return "moderate";
  return "slow";
}
