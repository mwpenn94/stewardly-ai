/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Stewardly Intelligence Wiring
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Bridges Stewardly's existing contextualLLM and deepContextAssembler
 * services to the shared @platform/intelligence interface.
 *
 * Stewardly already has a mature contextualLLM implementation in
 * server/services/contextualLLM.ts. This wiring file re-exports it
 * through the standard shared interface so that new code and cross-project
 * tooling can use the same import path.
 *
 * @shared-source: stewardly-ai
 * @shared-hash: auto
 */

// ── Re-export existing Stewardly contextualLLM ────────────────────────────
export { contextualLLM, extractQuery, injectContext, MAX_CONTEXT_CHARS } from "../services/contextualLLM";
export { getQuickContext } from "../services/deepContextAssembler";
export type { ContextType } from "../services/deepContextAssembler";

// ── Raw invokeLLM access ──────────────────────────────────────────────────
export { invokeLLM as rawInvokeLLM } from "../_core/llm";

// ── ReAct multi-turn tool calling loop ─────────────────────────────────
export { executeReActLoop } from "./intelligence/reactLoop";
export type { ReActConfig, ReActTrace, ReActResult, ReActMessage, ReActLLMResponse } from "./intelligence/reactLoop";

// ── Quality score normalization from shared types ─────────────────
export { normalizeQualityScore } from "./intelligence/types";

// ── Recursive Improvement Engine ──────────────────────────────────
export { detectSignals, checkConvergence, antiRegressionCheck } from "./engine/improvementEngine";
export type { Signal, ConvergenceResult, QualityDimensions, RegressionResult } from "./engine/improvementEngine";

// ── SSE Streaming ─────────────────────────────────────────────────
export { createSSEStreamHandler } from "./streaming/sseStreamHandler";
export type { SSEStreamConfig, SSEEvent } from "./streaming/sseStreamHandler";

// ── AI Config Resolution (5-layer system) ──────────────────────
export {
  resolveAIConfig as resolveSharedAIConfig,
  buildLayerOverlayPrompt as buildSharedLayerOverlayPrompt,
  validateInheritance,
  DEFAULT_CONFIG,
  createLayerHandlers,
  createAllLayerHandlers,
  hasMinRole,
  LAYER_NAMES,
  FIELD_MERGE_STRATEGIES,
} from "./config";
export type {
  ResolvedAIConfig,
  LayerLevel,
  ConfigStore,
  LayerSettings,
  LayerStore,
  AuthContext,
  LayerHandlers,
} from "./config";
