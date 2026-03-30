/**
 * ═══════════════════════════════════════════════════════════════════════════
 * @platform/intelligence — Shared Type Definitions
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Core interfaces for the platform-agnostic intelligence layer.
 * Any project using @platform/intelligence implements these contracts.
 */

// ─── CONTEXT SOURCE REGISTRY ─────────────────────────────────────────────────
//
// The registry is the central abstraction that decouples the intelligence layer
// from any specific project's data sources. Each project registers its own
// async fetch functions keyed by source name. The assembler calls these
// functions without knowing where the data comes from.
//
// Usage:
//   const registry: ContextSourceRegistry = {
//     documents: async (userId, query) => "...",
//     knowledgeBase: async (userId, query) => "...",
//     userProfile: async (userId, query) => "...",
//   };

/**
 * A single context source fetch function.
 * Returns a string of assembled context (empty string = no data available).
 */
export type ContextSourceFetcher = (
  userId: number,
  query: string,
) => Promise<string>;

/**
 * Registry of named context sources. Each project populates this with
 * its own data-fetching implementations. The assembler iterates over
 * all registered sources and merges their outputs.
 *
 * Standard source names (projects may add custom ones):
 *   documents, knowledgeBase, userProfile, suitability, memory, graph,
 *   pipelineData, conversationHistory, integrations, calculators,
 *   insights, clientRelationships, activityLog, tags, gapFeedback
 */
export interface ContextSourceRegistry {
  [sourceName: string]: ContextSourceFetcher;
}

// ─── CONTEXT REQUEST ─────────────────────────────────────────────────────────

export type ContextType =
  | "chat"
  | "analysis"
  | "recommendation"
  | "compliance"
  | "meeting"
  | "passive"
  | "gap_analysis"
  | "suitability"
  | "discovery"
  | "agentic"
  | "anonymous"
  | "ingestion";

export interface ContextRequest {
  userId: number;
  query: string;
  contextType: ContextType;
  maxTokenBudget?: number;
  /** Explicit list of source names to include. If omitted, all registered sources are used. */
  includeSources?: string[];
  /** Explicit list of source names to exclude. */
  excludeSources?: string[];
  /** Additional options passed through to individual source fetchers. */
  sourceOptions?: Record<string, unknown>;
  conversationId?: number;
  specificDocIds?: number[];
  category?: string;
}

// ─── ASSEMBLED CONTEXT ───────────────────────────────────────────────────────

export interface AssembledContext {
  /** Per-source context strings keyed by source name. */
  sourceContexts: Record<string, string>;

  /** Merged prompt fragment ready for injection into LLM messages. */
  fullContextPrompt: string;

  /** Metadata for observability and quality scoring. */
  metadata: AssemblyMetadata;
}

export interface AssemblyMetadata {
  /** Names of sources that were queried. */
  sourcesQueried: string[];
  /** Names of sources that returned non-empty context. */
  sourcesHit: string[];
  /** Ratio of sources that returned data vs. total queried (0–1). */
  contextSourceHitRate: number;
  /** Total approximate token count of the assembled context. */
  approximateTokenCount: number;
  /** Qualitative retrieval quality assessment. */
  retrievalQuality: "high" | "medium" | "low";
  /** Assembly duration in milliseconds. */
  assemblyDurationMs: number;
}

// ─── QUALITY SCORE NORMALIZATION ─────────────────────────────────────────────

/**
 * Normalize a raw quality score to the [0, 1] range.
 *
 * Handles two common input conventions:
 *   - Scores already in [0, 1] (e.g., 0.85) are passed through.
 *   - Scores on a 0–100 scale (e.g., 85) are divided by 100.
 *
 * The result is clamped to [0, 1] to guarantee downstream consumers
 * never receive out-of-range values.
 */
export function normalizeQualityScore(rawScore: number): number {
  const normalized = rawScore > 1 ? rawScore / 100 : rawScore;
  return Math.max(0, Math.min(1, normalized));
}

// ─── MEMORY CATEGORIES ───────────────────────────────────────────────────────

/**
 * Base memory categories shared across all projects.
 */
export const BASE_MEMORY_CATEGORIES = [
  "fact",
  "preference",
  "goal",
  "relationship",
  "financial",
  "temporal",
] as const;

/**
 * Extended memory categories for platform-specific tracking.
 * Projects can register additional categories beyond the base set.
 */
export const EXTENDED_MEMORY_CATEGORIES = [
  ...BASE_MEMORY_CATEGORIES,
  "amp_engagement",
  "ho_domain_trajectory",
] as const;

export type BaseMemoryCategory = (typeof BASE_MEMORY_CATEGORIES)[number];
export type ExtendedMemoryCategory = (typeof EXTENDED_MEMORY_CATEGORIES)[number];
export type MemoryCategory = BaseMemoryCategory | ExtendedMemoryCategory | string;

// ─── LLM INVOCATION TYPES ───────────────────────────────────────────────────

export interface ContextualLLMRequest {
  userId: number;
  contextType: ContextType;
  messages: Array<{ role: string; content: string }>;
  /** Override model selection. */
  model?: string;
  /** Override temperature. */
  temperature?: number;
  /** Override max tokens. */
  maxTokens?: number;
  /** Skip context injection (for internal/extraction calls). */
  skipContext?: boolean;
}

export interface ContextualLLMResponse {
  choices: Array<{
    message: {
      content: string | null;
      role: string;
    };
    finish_reason: string;
  }>;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  metadata?: {
    contextSourceHitRate?: number;
    qualityScore?: number;
    [key: string]: unknown;
  };
}
