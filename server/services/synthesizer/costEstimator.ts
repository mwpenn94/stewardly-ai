/**
 * Pre-flight cost estimator — Round A7 enhancement.
 *
 * Pulled from the multi-model-ai-synthesizer pattern: estimate the
 * dollar cost of a multi-model query BEFORE running it so the agent
 * can either (a) warn the user, (b) downgrade to a cheaper model,
 * or (c) reject the call when over budget.
 *
 * Pure function with task-type multipliers per the synthesizer's
 * `costEstimator.ts`. Inputs are passed in so callers can swap
 * pricing tables without rebuilding the module.
 */

export type TaskType =
  | "chat"
  | "discovery"
  | "image"
  | "code"
  | "synthesis"
  | "embedding";

/**
 * Per-task multiplier on the base token estimate. Discovery queries
 * (web search synthesis) and image-bearing requests use far more
 * tokens than a vanilla chat turn, so we adjust the prompt-token
 * estimate up before pricing.
 */
export const TASK_MULTIPLIERS: Record<TaskType, number> = {
  chat: 1,
  synthesis: 2,
  code: 2.5,
  discovery: 5,
  embedding: 0.5,
  image: 10,
};

export interface ModelPricing {
  id: string;
  /** Cost per 1M input tokens (USD) */
  inputPer1M: number;
  /** Cost per 1M output tokens (USD) */
  outputPer1M: number;
  /** Median output tokens per call (used when caller doesn't supply expectedOutputTokens) */
  medianOutputTokens?: number;
}

export interface CostEstimateInput {
  models: ModelPricing[];
  promptTokens: number;
  taskType: TaskType;
  /** Estimated output tokens; defaults to each model's medianOutputTokens or 800 */
  expectedOutputTokens?: number;
}

export interface CostEstimateLine {
  modelId: string;
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

export interface CostEstimateResult {
  lines: CostEstimateLine[];
  totalUSD: number;
  promptTokensAdjusted: number;
  taskMultiplier: number;
  warnings: string[];
}

/**
 * Compute total estimated cost for running `models` with `promptTokens`
 * input tokens and an output budget. Adjusts the prompt token count
 * by the task type multiplier so discovery / image / code queries
 * are priced higher.
 */
export function estimateCost(input: CostEstimateInput): CostEstimateResult {
  const multiplier = TASK_MULTIPLIERS[input.taskType] ?? 1;
  const promptTokensAdjusted = Math.round(input.promptTokens * multiplier);
  const lines: CostEstimateLine[] = [];
  const warnings: string[] = [];

  for (const m of input.models) {
    const outputTokens = input.expectedOutputTokens ?? m.medianOutputTokens ?? 800;
    const inputCost = (promptTokensAdjusted / 1_000_000) * m.inputPer1M;
    const outputCost = (outputTokens / 1_000_000) * m.outputPer1M;
    const total = inputCost + outputCost;
    lines.push({
      modelId: m.id,
      inputCost,
      outputCost,
      totalCost: total,
    });
    if (total > 0.5) {
      warnings.push(`${m.id} estimated $${total.toFixed(3)} per call — high`);
    }
  }

  const totalUSD = lines.reduce((s, l) => s + l.totalCost, 0);
  if (totalUSD > 1.0) {
    warnings.push(`Total estimated $${totalUSD.toFixed(2)} for ${input.models.length} models`);
  }

  return {
    lines,
    totalUSD,
    promptTokensAdjusted,
    taskMultiplier: multiplier,
    warnings,
  };
}

/**
 * Convenience: enforce a hard cost ceiling. Returns the subset of
 * models whose cumulative cost stays under `ceilingUSD`. Sorts
 * cheapest-first.
 */
export function modelsUnderCostCeiling(
  input: CostEstimateInput & { ceilingUSD: number },
): ModelPricing[] {
  const baseEstimate = estimateCost(input);
  const sorted = [...input.models].sort((a, b) => {
    const la = baseEstimate.lines.find((l) => l.modelId === a.id)?.totalCost ?? 0;
    const lb = baseEstimate.lines.find((l) => l.modelId === b.id)?.totalCost ?? 0;
    return la - lb;
  });
  const out: ModelPricing[] = [];
  let running = 0;
  for (const m of sorted) {
    const cost =
      baseEstimate.lines.find((l) => l.modelId === m.id)?.totalCost ?? 0;
    if (running + cost > input.ceilingUSD) break;
    out.push(m);
    running += cost;
  }
  return out;
}

/**
 * Default Stewardly task-type guesser used when the caller doesn't
 * pass an explicit type. Inspects the prompt for signal words.
 */
export function guessTaskType(prompt: string): TaskType {
  const lower = prompt.toLowerCase();
  if (/\b(image|picture|photo|generate.*png|render)\b/.test(lower)) return "image";
  if (/\b(search|find online|look up|google|fetch.*url)\b/.test(lower)) return "discovery";
  if (/\b(code|function|class|typescript|javascript|python|debug|refactor)\b/.test(lower))
    return "code";
  if (/\b(synthesize|combine|merge.*responses|consensus)\b/.test(lower))
    return "synthesis";
  if (/\b(embed|embedding|vector)\b/.test(lower)) return "embedding";
  return "chat";
}
