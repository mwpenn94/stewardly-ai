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
