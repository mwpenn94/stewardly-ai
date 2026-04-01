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
export { contextualLLM } from "../services/contextualLLM";
export { getQuickContext } from "../services/deepContextAssembler";
export type { ContextType } from "../services/deepContextAssembler";

// ── Raw invokeLLM access ──────────────────────────────────────────────────
export { invokeLLM as rawInvokeLLM } from "../_core/llm";

// ── ReAct multi-turn tool calling loop ─────────────────────────────────
export { executeReActLoop } from "./intelligence/reactLoop";
export type { ReActConfig, ReActTrace, ReActResult } from "./intelligence/reactLoop";

// ── Quality score normalization from shared types ─────────────────
export { normalizeQualityScore } from "./intelligence/types";
