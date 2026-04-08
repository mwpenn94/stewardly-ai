/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Model Registry — Multi-Model Forge Integration
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Central registry of all available LLM models through the Forge API.
 * Each model entry includes:
 *   - Capabilities (web search, tool calling, vision, reasoning, streaming)
 *   - Cost tier (economy, standard, premium, reasoning)
 *   - Task routing hints (what each model is best at)
 *   - Context window and max output tokens
 *   - Provider family for grouping
 *
 * The 5-layer config system resolves which model(s) to use:
 *   L1 Platform → L2 Organization → L3 Manager → L4 Professional → L5 User
 *
 * Each layer can set:
 *   modelPreferences: { primary: "model-id", fallback: "model-id", synthesis: "model-id" }
 *   ensembleWeights: { "model-id": 0.6, "model-id": 0.4 }
 */

// ─── MODEL CAPABILITY FLAGS ─────────────────────────────────────────────────

export interface ModelCapabilities {
  /** Supports google_search grounding via Forge proxy */
  webSearch: boolean;
  /** Supports function/tool calling */
  toolCalling: boolean;
  /** Supports image/vision input */
  vision: boolean;
  /** Has extended reasoning/thinking capabilities */
  reasoning: boolean;
  /** Supports streaming responses */
  streaming: boolean;
  /** Supports structured JSON output (response_format) */
  structuredOutput: boolean;
  /** Supports file/document input */
  fileInput: boolean;
}

// ─── COST TIERS ─────────────────────────────────────────────────────────────

export type CostTier = "economy" | "standard" | "premium" | "reasoning";

// ─── TASK ROUTING ───────────────────────────────────────────────────────────

export type TaskType =
  | "chat"              // General conversation
  | "analysis"          // Financial analysis, data interpretation
  | "research"          // Web research, product comparison
  | "planning"          // Financial planning, goal setting
  | "compliance"        // Regulatory, compliance checks
  | "synthesis"         // Multi-model response merging
  | "quick"             // Fast responses, simple queries
  | "creative"          // Content generation, marketing
  | "code"              // Code generation, technical tasks
  | "reasoning"         // Complex multi-step reasoning
  | "guardrail";        // Input/output screening

// ─── MODEL ENTRY ────────────────────────────────────────────────────────────

export interface ModelEntry {
  /** Unique model identifier (matches Forge API model parameter) */
  id: string;
  /** Human-readable display name */
  displayName: string;
  /** Provider family */
  provider: "google" | "openai" | "anthropic" | "deepseek";
  /** Cost tier for budget management */
  costTier: CostTier;
  /** Capability flags */
  capabilities: ModelCapabilities;
  /** Context window in tokens */
  contextWindow: number;
  /** Max output tokens */
  maxOutputTokens: number;
  /** Tasks this model excels at (ordered by strength) */
  bestFor: TaskType[];
  /** Whether this model is enabled by default */
  enabledByDefault: boolean;
  /** Optional description for UI display */
  description?: string;
  // ─── Round C1: latency + speed + cost (additive, all optional) ──────────
  /** Estimated wall-clock response time in ms (TTFT + median completion).
   *  Used by selectModelsWithinTimeBudget to enforce client-facing SLAs. */
  estimatedResponseMs?: number;
  /** Coarse speed bucket used for UI color-coding */
  speedRating?: "fast" | "moderate" | "slow";
  /** Per-1M-token cost in USD ({input, output}) — used by the cost
   *  estimator for pre-flight budget warnings. */
  costPer1M?: { input: number; output: number };
  /** Median output tokens per completion (used by costEstimator) */
  medianOutputTokens?: number;
}

// ─── Round C1: synthesis overhead constant ─────────────────────────────────
// When running a multi-model consensus, the synthesis call after the
// parallel fan-out adds a fixed overhead. We bake this in as a single
// constant so the time-budget selector and cost estimator stay consistent.
// 4 seconds is the audit's recommended baseline (matches the synthesizer
// repo's `synthesisBaseOverheadMs`).
export const SYNTHESIS_OVERHEAD_MS = 4000;

// ─── Default speed rating heuristic ────────────────────────────────────────
// When a model entry doesn't ship an explicit speedRating, derive it from
// the cost tier as a sensible fallback.
export function defaultSpeedRating(tier: CostTier): "fast" | "moderate" | "slow" {
  switch (tier) {
    case "economy":
      return "fast";
    case "standard":
      return "moderate";
    case "premium":
    case "reasoning":
      return "slow";
    default:
      return "moderate";
  }
}

// ─── Default estimated response time heuristic ─────────────────────────────
// Used when a model entry doesn't ship an explicit estimatedResponseMs.
// These are conservative averages from the audit's reference benchmarks
// and should be overridden per-model when real telemetry is available.
export function defaultEstimatedResponseMs(tier: CostTier): number {
  switch (tier) {
    case "economy":
      return 1500;
    case "standard":
      return 3500;
    case "premium":
      return 6000;
    case "reasoning":
      return 12_000;
    default:
      return 4000;
  }
}

// ─── MODEL REGISTRY ─────────────────────────────────────────────────────────

const ALL_CAPABILITIES: ModelCapabilities = {
  webSearch: true,
  toolCalling: true,
  vision: true,
  reasoning: false,
  streaming: true,
  structuredOutput: true,
  fileInput: true,
};

export const MODEL_REGISTRY: ModelEntry[] = [
  // ── Google Gemini Family ──────────────────────────────────────────────────
  {
    id: "gemini-2.5-flash",
    displayName: "Gemini 2.5 Flash",
    provider: "google",
    costTier: "standard",
    capabilities: { ...ALL_CAPABILITIES, reasoning: true },
    contextWindow: 1_000_000,
    maxOutputTokens: 65_536,
    bestFor: ["chat", "analysis", "research", "planning", "quick"],
    enabledByDefault: true,
    description: "Fast, capable all-rounder with reasoning. Default model.",
  },
  {
    id: "gemini-2.5-pro",
    displayName: "Gemini 2.5 Pro",
    provider: "google",
    costTier: "premium",
    capabilities: { ...ALL_CAPABILITIES, reasoning: true },
    contextWindow: 1_000_000,
    maxOutputTokens: 65_536,
    bestFor: ["analysis", "reasoning", "planning", "compliance", "synthesis"],
    enabledByDefault: true,
    description: "Most capable Gemini model. Best for complex analysis and reasoning.",
  },
  {
    id: "gemini-2.0-flash",
    displayName: "Gemini 2.0 Flash",
    provider: "google",
    costTier: "economy",
    capabilities: { ...ALL_CAPABILITIES },
    contextWindow: 1_000_000,
    maxOutputTokens: 8_192,
    bestFor: ["quick", "chat", "guardrail"],
    enabledByDefault: true,
    description: "Ultra-fast economy model for simple tasks and guardrails.",
  },

  // ── OpenAI GPT Family ─────────────────────────────────────────────────────
  {
    id: "gpt-4o",
    displayName: "GPT-4o",
    provider: "openai",
    costTier: "premium",
    capabilities: { ...ALL_CAPABILITIES },
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    bestFor: ["analysis", "creative", "code", "synthesis", "planning"],
    enabledByDefault: true,
    description: "OpenAI's flagship multimodal model. Strong at analysis and creative tasks.",
  },
  {
    id: "gpt-4o-mini",
    displayName: "GPT-4o Mini",
    provider: "openai",
    costTier: "economy",
    capabilities: { ...ALL_CAPABILITIES },
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    bestFor: ["quick", "chat", "guardrail"],
    enabledByDefault: true,
    description: "Compact GPT-4o for fast, cost-effective responses.",
  },
  {
    id: "gpt-4.1",
    displayName: "GPT-4.1",
    provider: "openai",
    costTier: "premium",
    capabilities: { ...ALL_CAPABILITIES },
    contextWindow: 1_000_000,
    maxOutputTokens: 32_768,
    bestFor: ["code", "analysis", "planning", "compliance", "creative"],
    enabledByDefault: true,
    description: "Latest GPT with 1M context. Excellent for code and long-document analysis.",
  },
  {
    id: "gpt-4.1-mini",
    displayName: "GPT-4.1 Mini",
    provider: "openai",
    costTier: "standard",
    capabilities: { ...ALL_CAPABILITIES },
    contextWindow: 1_000_000,
    maxOutputTokens: 32_768,
    bestFor: ["chat", "research", "quick", "code"],
    enabledByDefault: true,
    description: "Balanced GPT-4.1 variant. Good all-rounder at standard cost.",
  },
  {
    id: "gpt-4.1-nano",
    displayName: "GPT-4.1 Nano",
    provider: "openai",
    costTier: "economy",
    capabilities: { ...ALL_CAPABILITIES },
    contextWindow: 1_000_000,
    maxOutputTokens: 32_768,
    bestFor: ["quick", "guardrail", "chat"],
    enabledByDefault: true,
    description: "Smallest GPT-4.1. Ultra-fast for simple tasks.",
  },

  // ── Anthropic Claude Family ───────────────────────────────────────────────
  {
    id: "claude-3.5-sonnet",
    displayName: "Claude 3.5 Sonnet",
    provider: "anthropic",
    costTier: "premium",
    capabilities: { ...ALL_CAPABILITIES },
    contextWindow: 200_000,
    maxOutputTokens: 8_192,
    bestFor: ["analysis", "compliance", "creative", "planning", "synthesis"],
    enabledByDefault: true,
    description: "Anthropic's balanced model. Excellent at nuanced analysis and compliance.",
  },
  {
    id: "claude-sonnet-4-20250514",
    displayName: "Claude Sonnet 4",
    provider: "anthropic",
    costTier: "premium",
    capabilities: { ...ALL_CAPABILITIES },
    contextWindow: 200_000,
    maxOutputTokens: 16_384,
    bestFor: ["analysis", "compliance", "reasoning", "planning", "synthesis"],
    enabledByDefault: true,
    description: "Latest Claude Sonnet. Strong reasoning and compliance capabilities.",
  },
  {
    id: "claude-3-haiku",
    displayName: "Claude 3 Haiku",
    provider: "anthropic",
    costTier: "economy",
    capabilities: { ...ALL_CAPABILITIES },
    contextWindow: 200_000,
    maxOutputTokens: 4_096,
    bestFor: ["quick", "chat", "guardrail"],
    enabledByDefault: true,
    description: "Fast, compact Claude for simple queries and guardrails.",
  },

  // ── OpenAI Reasoning Family ───────────────────────────────────────────────
  {
    id: "o4-mini",
    displayName: "o4 Mini",
    provider: "openai",
    costTier: "reasoning",
    capabilities: { ...ALL_CAPABILITIES, reasoning: true },
    contextWindow: 200_000,
    maxOutputTokens: 100_000,
    bestFor: ["reasoning", "analysis", "compliance", "planning"],
    enabledByDefault: true,
    description: "Compact reasoning model. Deep analysis at moderate cost.",
  },
  {
    id: "o3",
    displayName: "o3",
    provider: "openai",
    costTier: "reasoning",
    capabilities: { ...ALL_CAPABILITIES, reasoning: true },
    contextWindow: 200_000,
    maxOutputTokens: 100_000,
    bestFor: ["reasoning", "analysis", "compliance", "planning", "synthesis"],
    enabledByDefault: true,
    description: "Full reasoning model. Best for complex multi-step problems.",
  },
  {
    id: "o3-mini",
    displayName: "o3 Mini",
    provider: "openai",
    costTier: "standard",
    capabilities: { ...ALL_CAPABILITIES, reasoning: true },
    contextWindow: 200_000,
    maxOutputTokens: 65_536,
    bestFor: ["reasoning", "analysis", "quick"],
    enabledByDefault: true,
    description: "Budget reasoning model. Good for moderate complexity.",
  },

  // ── DeepSeek Family ───────────────────────────────────────────────────────
  {
    id: "deepseek-chat",
    displayName: "DeepSeek Chat",
    provider: "deepseek",
    costTier: "economy",
    capabilities: { ...ALL_CAPABILITIES },
    contextWindow: 128_000,
    maxOutputTokens: 8_192,
    bestFor: ["chat", "code", "quick", "research"],
    enabledByDefault: true,
    description: "Cost-effective open model. Strong at code and general chat.",
  },
  {
    id: "deepseek-reasoner",
    displayName: "DeepSeek Reasoner",
    provider: "deepseek",
    costTier: "standard",
    capabilities: { ...ALL_CAPABILITIES, reasoning: true },
    contextWindow: 128_000,
    maxOutputTokens: 8_192,
    bestFor: ["reasoning", "analysis", "code"],
    enabledByDefault: true,
    description: "DeepSeek with chain-of-thought reasoning. Strong at math and logic.",
  },
  // ─── Open Source Models (via Forge) ────────────────────────────────
  {
    id: "llama-3.3-70b",
    displayName: "Llama 3.3 70B",
    provider: "meta" as any,
    costTier: "economy" as CostTier,
    capabilities: { ...ALL_CAPABILITIES },
    contextWindow: 128_000,
    maxOutputTokens: 4_096,
    bestFor: ["chat", "code", "analysis"],
    enabledByDefault: true,
    description: "Meta's open model. Strong general-purpose performance.",
  },
  {
    id: "llama-4-scout",
    displayName: "Llama 4 Scout",
    provider: "meta" as any,
    costTier: "economy" as CostTier,
    capabilities: { ...ALL_CAPABILITIES },
    contextWindow: 128_000,
    maxOutputTokens: 4_096,
    bestFor: ["chat", "research", "quick"],
    enabledByDefault: true,
    description: "Llama 4 Scout — fast, efficient, good at retrieval tasks.",
  },
  {
    id: "mistral-large",
    displayName: "Mistral Large",
    provider: "mistral" as any,
    costTier: "standard" as CostTier,
    capabilities: { ...ALL_CAPABILITIES },
    contextWindow: 128_000,
    maxOutputTokens: 4_096,
    bestFor: ["chat", "code", "analysis", "creative"],
    enabledByDefault: true,
    description: "Mistral's flagship. Strong at code, reasoning, and multilingual.",
  },
  {
    id: "mixtral-8x22b",
    displayName: "Mixtral 8x22B",
    provider: "mistral" as any,
    costTier: "economy" as CostTier,
    capabilities: { ...ALL_CAPABILITIES },
    contextWindow: 64_000,
    maxOutputTokens: 4_096,
    bestFor: ["chat", "code", "quick"],
    enabledByDefault: true,
    description: "Mixtral MoE — fast inference with expert routing.",
  },
  {
    id: "qwen-2.5-72b",
    displayName: "Qwen 2.5 72B",
    provider: "alibaba" as any,
    costTier: "economy" as CostTier,
    capabilities: { ...ALL_CAPABILITIES },
    contextWindow: 128_000,
    maxOutputTokens: 8_192,
    bestFor: ["chat", "code", "creative", "analysis"],
    enabledByDefault: true,
    description: "Alibaba's Qwen — strong multilingual and coding performance.",
  },
  {
    id: "qwen-2.5-coder-32b",
    displayName: "Qwen 2.5 Coder 32B",
    provider: "alibaba" as any,
    costTier: "economy" as CostTier,
    capabilities: { ...ALL_CAPABILITIES },
    contextWindow: 128_000,
    maxOutputTokens: 8_192,
    bestFor: ["code", "analysis"],
    enabledByDefault: true,
    description: "Qwen Coder — specialized for code generation and analysis.",
  },
];

// ─── LOOKUP HELPERS ─────────────────────────────────────────────────────────

const registryMap = new Map(MODEL_REGISTRY.map(m => [m.id, m]));

/** Get a model entry by ID. Returns undefined if not found. */
export function getModel(modelId: string): ModelEntry | undefined {
  return registryMap.get(modelId);
}

/** Get all models that support a specific capability. */
export function getModelsWithCapability(cap: keyof ModelCapabilities): ModelEntry[] {
  return MODEL_REGISTRY.filter(m => m.capabilities[cap]);
}

/** Get all models in a specific cost tier. */
export function getModelsByCostTier(tier: CostTier): ModelEntry[] {
  return MODEL_REGISTRY.filter(m => m.costTier === tier);
}

/** Get all models from a specific provider. */
export function getModelsByProvider(provider: ModelEntry["provider"]): ModelEntry[] {
  return MODEL_REGISTRY.filter(m => m.provider === provider);
}

/** Get the best model for a specific task type, optionally filtered by cost tier. */
export function getBestModelForTask(task: TaskType, maxCostTier?: CostTier): ModelEntry | undefined {
  const tierOrder: CostTier[] = ["economy", "standard", "premium", "reasoning"];
  const maxTierIndex = maxCostTier ? tierOrder.indexOf(maxCostTier) : tierOrder.length - 1;

  const candidates = MODEL_REGISTRY
    .filter(m => m.enabledByDefault && m.bestFor.includes(task))
    .filter(m => tierOrder.indexOf(m.costTier) <= maxTierIndex);

  // Sort by how early the task appears in bestFor (lower index = better fit)
  candidates.sort((a, b) => {
    const aIdx = a.bestFor.indexOf(task);
    const bIdx = b.bestFor.indexOf(task);
    return aIdx - bIdx;
  });

  return candidates[0];
}

/** Get all enabled models for display in UI. */
export function getEnabledModels(): ModelEntry[] {
  return MODEL_REGISTRY.filter(m => m.enabledByDefault);
}

/** Validate a model ID exists in the registry. */
export function isValidModel(modelId: string): boolean {
  return registryMap.has(modelId);
}

/** Get the default model ID. */
export function getDefaultModelId(): string {
  return "gemini-2.5-flash";
}

// ─── TASK ROUTER ────────────────────────────────────────────────────────────

/**
 * Route a task to the optimal model based on:
 * 1. Resolved 5-layer config modelPreferences (if set)
 * 2. Task type routing (best model for the task)
 * 3. Cost tier constraints
 * 4. Fallback chain
 */
export interface ModelRoutingResult {
  /** Primary model to use */
  primary: string;
  /** Fallback model if primary fails */
  fallback: string;
  /** Synthesis model for multi-model verification */
  synthesis: string;
  /** Whether to run multi-model ensemble */
  useEnsemble: boolean;
  /** Ensemble weights if useEnsemble is true */
  ensembleModels: Array<{ modelId: string; weight: number }>;
  /** Source of the routing decision */
  source: "config" | "task_routing" | "default";
}

export function routeModel(
  taskType: TaskType,
  modelPreferences?: Record<string, string>,
  ensembleWeights?: Record<string, number>,
  crossModelVerify?: boolean,
): ModelRoutingResult {
  const defaultResult: ModelRoutingResult = {
    primary: getDefaultModelId(),
    fallback: "gpt-4.1-mini",
    synthesis: "claude-sonnet-4-20250514",
    useEnsemble: false,
    ensembleModels: [],
    source: "default",
  };

  // Layer 1: Check if 5-layer config specifies model preferences
  if (modelPreferences && Object.keys(modelPreferences).length > 0) {
    const primary = modelPreferences.primary || modelPreferences[taskType];
    const fallback = modelPreferences.fallback;
    const synthesis = modelPreferences.synthesis;

    if (primary && isValidModel(primary)) {
      defaultResult.primary = primary;
      defaultResult.source = "config";
    }
    if (fallback && isValidModel(fallback)) {
      defaultResult.fallback = fallback;
    }
    if (synthesis && isValidModel(synthesis)) {
      defaultResult.synthesis = synthesis;
    }
  } else {
    // Layer 2: Task-based routing
    const bestModel = getBestModelForTask(taskType);
    if (bestModel) {
      defaultResult.primary = bestModel.id;
      defaultResult.source = "task_routing";
    }

    // Set intelligent fallback based on task type
    const fallbackModel = getBestModelForTask(taskType, "standard");
    if (fallbackModel && fallbackModel.id !== defaultResult.primary) {
      defaultResult.fallback = fallbackModel.id;
    }
  }

  // Layer 3: Ensemble weights
  if (ensembleWeights && Object.keys(ensembleWeights).length > 1) {
    const validModels = Object.entries(ensembleWeights)
      .filter(([id]) => isValidModel(id))
      .map(([modelId, weight]) => ({ modelId, weight }));

    if (validModels.length > 1) {
      defaultResult.useEnsemble = true;
      defaultResult.ensembleModels = validModels;
    }
  }

  // Layer 4: Cross-model verification
  if (crossModelVerify && !defaultResult.useEnsemble) {
    // Auto-create a 2-model ensemble with the primary and a different-provider model
    const primaryModel = getModel(defaultResult.primary);
    const verifyModel = MODEL_REGISTRY.find(
      m => m.enabledByDefault
        && m.provider !== primaryModel?.provider
        && m.bestFor.includes(taskType)
        && m.costTier !== "reasoning"
    );
    if (verifyModel) {
      defaultResult.useEnsemble = true;
      defaultResult.ensembleModels = [
        { modelId: defaultResult.primary, weight: 0.6 },
        { modelId: verifyModel.id, weight: 0.4 },
      ];
    }
  }

  return defaultResult;
}

// ─── GOOGLE SEARCH TOOL DEFINITION ──────────────────────────────────────────
//
// All 16 Forge models support web search grounding via the google_search
// function tool. When passed, the Forge proxy intercepts the tool call and
// performs a real Google Search, injecting results into the model's context.

// ═══════════════════════════════════════════════════════════════════════════
// Round C1 — Latency-aware model selection helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get the effective response time for a model, falling back to the
 * cost-tier heuristic when the entry doesn't ship explicit telemetry.
 */
export function getModelEstimatedResponseMs(modelId: string): number {
  const m = MODEL_REGISTRY.find((e) => e.id === modelId);
  if (!m) return 4000;
  if (m.estimatedResponseMs !== undefined) return m.estimatedResponseMs;
  return defaultEstimatedResponseMs(m.costTier);
}

/**
 * Get the effective speed rating for a model, falling back to the
 * cost-tier heuristic.
 */
export function getModelSpeedRating(
  modelId: string,
): "fast" | "moderate" | "slow" {
  const m = MODEL_REGISTRY.find((e) => e.id === modelId);
  if (!m) return "moderate";
  if (m.speedRating) return m.speedRating;
  return defaultSpeedRating(m.costTier);
}

/**
 * Select the largest set of models from a candidate list whose summed
 * estimated response time + SYNTHESIS_OVERHEAD_MS fits within budgetMs.
 *
 * Greedy fastest-first because consensus quality scales with model
 * COUNT before it scales with individual model quality (per the audit
 * findings). Tie-breaks favor models with higher costTier rank
 * (premium > reasoning > standard > economy) so we get a diverse mix.
 *
 * Returns an array of model IDs sorted in execution order plus the
 * computed total estimated time + per-model exclusion reasons.
 */
export interface ModelTimeBudgetResult {
  selected: string[];
  excluded: Record<string, string>;
  totalEstimatedMs: number;
  budgetMs: number;
  fits: boolean;
}

export function selectModelsWithinTimeBudget(
  candidateIds: string[],
  budgetMs: number,
  options?: { maxModels?: number; minModels?: number },
): ModelTimeBudgetResult {
  const maxModels = options?.maxModels ?? 5;
  const minModels = options?.minModels ?? 1;

  // Hydrate + sort fastest-first; unknown ids fall to the back
  const candidates = candidateIds
    .map((id) => ({
      id,
      ms: getModelEstimatedResponseMs(id),
      entry: MODEL_REGISTRY.find((e) => e.id === id),
    }))
    .sort((a, b) => {
      if (a.ms !== b.ms) return a.ms - b.ms;
      // Same speed → premium > reasoning > standard > economy
      const tierRank = (t?: CostTier): number =>
        t === "premium" ? 3 : t === "reasoning" ? 2 : t === "standard" ? 1 : 0;
      return tierRank(b.entry?.costTier) - tierRank(a.entry?.costTier);
    });

  const selected: string[] = [];
  const excluded: Record<string, string> = {};
  let runningTotal = SYNTHESIS_OVERHEAD_MS;

  for (const c of candidates) {
    if (selected.length >= maxModels) {
      excluded[c.id] = "max_models_reached";
      continue;
    }
    if (runningTotal + c.ms > budgetMs) {
      excluded[c.id] = `exceeds_budget (would be ${runningTotal + c.ms}ms > ${budgetMs}ms)`;
      continue;
    }
    selected.push(c.id);
    runningTotal += c.ms;
  }

  if (selected.length < minModels) {
    return {
      selected: candidates.slice(0, minModels).map((c) => c.id),
      excluded,
      totalEstimatedMs:
        candidates.slice(0, minModels).reduce((s, c) => s + c.ms, 0) +
        SYNTHESIS_OVERHEAD_MS,
      budgetMs,
      fits: false,
    };
  }

  return {
    selected,
    excluded,
    totalEstimatedMs: runningTotal,
    budgetMs,
    fits: true,
  };
}

export const GOOGLE_SEARCH_TOOL = {
  type: "function" as const,
  function: {
    name: "google_search",
    description: "Search the web for current, real-time information on ANY topic. Use this tool whenever the user asks about specific products, companies, services, programs, rates, comparisons, local information, or anything that requires up-to-date knowledge beyond your training data.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query — be specific and include key details",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
};
