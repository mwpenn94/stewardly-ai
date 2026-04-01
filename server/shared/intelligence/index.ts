/**
 * ═══════════════════════════════════════════════════════════════════════════
 * @platform/intelligence — Public API
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Reusable intelligence layer for any project.
 *
 * Usage:
 *   import {
 *     createContextualLLM,
 *     assembleDeepContext,
 *     createMemoryEngine,
 *     normalizeQualityScore,
 *   } from "@platform/intelligence";
 */

// ── Types ────────────────────────────────────────────────────────────────────
export type {
  ContextSourceRegistry,
  ContextSourceFetcher,
  SourceFetchOptions,
  ContextType,
  ContextRequest,
  AssembledContext,
  AssemblyMetadata,
  ContextualLLMRequest,
  ContextualLLMResponse,
  MemoryCategory,
  BaseMemoryCategory,
  ExtendedMemoryCategory,
} from "./types";

export {
  normalizeQualityScore,
  BASE_MEMORY_CATEGORIES,
  EXTENDED_MEMORY_CATEGORIES,
} from "./types";

// ── Contextual LLM ──────────────────────────────────────────────────────────
export {
  createContextualLLM,
  extractQuery,
  injectContext,
} from "./contextualLLM";
export type { ContextualLLMDependencies } from "./contextualLLM";

// ── Deep Context Assembler ───────────────────────────────────────────────────
export {
  assembleDeepContext,
  assembleQuickContext,
} from "./deepContextAssembler";
export type { QuickContextOptions } from "./deepContextAssembler";

// ── ReAct Loop ──────────────────────────────────────────────────────────────
export { executeReActLoop } from "./reactLoop";
export type {
  ReActConfig,
  ReActTrace,
  ReActResult,
  ReActMessage,
  ReActLLMResponse,
} from "./reactLoop";

// ── Memory Engine ────────────────────────────────────────────────────────────
export { createMemoryEngine } from "./memoryEngine";
export type {
  ExtractedMemory,
  EpisodeSummary,
  StoredMemory,
  StoredEpisode,
  MemoryStore,
  MemoryLLMFunction,
  MemoryEngineConfig,
} from "./memoryEngine";
