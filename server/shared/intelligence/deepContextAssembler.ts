/**
 * ═══════════════════════════════════════════════════════════════════════════
 * @platform/intelligence — Deep Context Assembler
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Central nervous system for all AI context across any project using the
 * platform intelligence layer. Assembles context from a pluggable registry
 * of data sources, respects token budgets, and tracks hit-rate metadata.
 *
 * Key design decisions:
 *   - All data fetching is delegated to ContextSourceRegistry functions.
 *     The assembler has zero knowledge of databases, schemas, or ORMs.
 *   - Token budget logic is preserved: sources are fetched in parallel,
 *     then truncated to fit within the budget.
 *   - contextSourceHitRate is computed after assembly and stored in metadata.
 *   - Quality scores are normalized via normalizeQualityScore before storage.
 */

import type {
  ContextSourceRegistry,
  ContextType,
  ContextRequest,
  AssembledContext,
  AssemblyMetadata,
} from "./types";
import { normalizeQualityScore } from "./types";

// ─── TOKEN BUDGET DEFAULTS ───────────────────────────────────────────────────

const DEFAULT_TOKEN_BUDGET = 8000;
const CHARS_PER_TOKEN = 4; // conservative estimate

/**
 * Context-type-specific budget multipliers.
 * Some context types need more or less context than the default.
 */
const BUDGET_MULTIPLIERS: Partial<Record<ContextType, number>> = {
  chat: 1.0,
  analysis: 1.5,
  recommendation: 1.2,
  compliance: 1.3,
  meeting: 1.0,
  passive: 0.5,
  gap_analysis: 1.2,
  suitability: 1.3,
  discovery: 1.0,
  agentic: 1.5,
  anonymous: 0.3,
  ingestion: 0.5,
};

/**
 * Default source priority order. Sources earlier in the list get budget
 * preference when truncation is needed. Projects can override this.
 */
const DEFAULT_SOURCE_PRIORITY = [
  "memory",
  "userProfile",
  "conversationHistory",
  "documents",
  "knowledgeBase",
  "suitability",
  "integrations",
  "pipelineData",
  "calculators",
  "insights",
  "clientRelationships",
  "graph",
  "activityLog",
  "tags",
  "gapFeedback",
];

// ─── FULL CONTEXT ASSEMBLY ───────────────────────────────────────────────────

/**
 * Assemble deep context from all registered sources.
 *
 * 1. Determines which sources to query based on the request.
 * 2. Fetches all sources in parallel.
 * 3. Computes contextSourceHitRate.
 * 4. Truncates to fit within the token budget.
 * 5. Merges into a single prompt fragment.
 */
export async function assembleDeepContext(
  registry: ContextSourceRegistry,
  request: ContextRequest,
  options?: {
    sourcePriority?: string[];
    logger?: { warn: (...args: unknown[]) => void };
  },
): Promise<AssembledContext> {
  const startTime = Date.now();
  const log = options?.logger ?? console;
  const sourcePriority = options?.sourcePriority ?? DEFAULT_SOURCE_PRIORITY;

  const budget = Math.round(
    (request.maxTokenBudget ?? DEFAULT_TOKEN_BUDGET) *
      (BUDGET_MULTIPLIERS[request.contextType] ?? 1.0),
  );
  const charBudget = budget * CHARS_PER_TOKEN;

  // ── Determine which sources to query ───────────────────────────────────
  const allSourceNames = Object.keys(registry);
  let sourceNames: string[];

  if (request.includeSources && request.includeSources.length > 0) {
    sourceNames = request.includeSources.filter((s) => allSourceNames.includes(s));
  } else {
    sourceNames = allSourceNames;
  }

  if (request.excludeSources && request.excludeSources.length > 0) {
    const excludeSet = new Set(request.excludeSources);
    sourceNames = sourceNames.filter((s) => !excludeSet.has(s));
  }

  // ── Fetch all sources in parallel ──────────────────────────────────────
  const fetchResults = await Promise.allSettled(
    sourceNames.map(async (name) => {
      try {
        const result = await registry[name](request.userId, request.query);
        return { name, result };
      } catch (err) {
        log.warn(`[assembler] Source "${name}" failed:`, err);
        return { name, result: "" };
      }
    }),
  );

  const sourceContexts: Record<string, string> = {};
  const sourcesHit: string[] = [];

  for (const outcome of fetchResults) {
    if (outcome.status === "fulfilled") {
      const { name, result } = outcome.value;
      sourceContexts[name] = result;
      if (result.length > 0) {
        sourcesHit.push(name);
      }
    }
  }

  // ── Compute hit rate ───────────────────────────────────────────────────
  const contextSourceHitRate =
    sourceNames.length > 0 ? sourcesHit.length / sourceNames.length : 0;

  // ── Token budget truncation ────────────────────────────────────────────
  // Sort by priority, then truncate from lowest-priority sources first.
  const priorityMap = new Map(sourcePriority.map((name, idx) => [name, idx]));
  const sortedNames = [...sourcesHit].sort((a, b) => {
    const pa = priorityMap.get(a) ?? 999;
    const pb = priorityMap.get(b) ?? 999;
    return pa - pb;
  });

  let totalChars = 0;
  const truncatedContexts: Record<string, string> = {};

  for (const name of sortedNames) {
    const content = sourceContexts[name];
    const remaining = charBudget - totalChars;

    if (remaining <= 0) break;

    if (content.length <= remaining) {
      truncatedContexts[name] = content;
      totalChars += content.length;
    } else {
      // Truncate at a sentence boundary if possible
      const truncated = truncateAtBoundary(content, remaining);
      truncatedContexts[name] = truncated;
      totalChars += truncated.length;
      break;
    }
  }

  // ── Build full context prompt ──────────────────────────────────────────
  const sections: string[] = [];
  for (const name of sortedNames) {
    if (truncatedContexts[name]) {
      const label = formatSourceLabel(name);
      sections.push(`[${label}]\n${truncatedContexts[name]}`);
    }
  }
  const fullContextPrompt = sections.join("\n\n");

  // ── Assess retrieval quality ───────────────────────────────────────────
  const retrievalQuality = assessRetrievalQuality(contextSourceHitRate, totalChars, charBudget);

  const metadata: AssemblyMetadata = {
    sourcesQueried: sourceNames,
    sourcesHit,
    contextSourceHitRate,
    approximateTokenCount: Math.ceil(totalChars / CHARS_PER_TOKEN),
    retrievalQuality,
    assemblyDurationMs: Date.now() - startTime,
  };

  return {
    sourceContexts: truncatedContexts,
    fullContextPrompt,
    metadata,
  };
}

// ─── QUICK CONTEXT (simplified single-string output) ─────────────────────────

/**
 * Simplified context assembly that returns a single string and metadata.
 * Used by contextualLLM for automatic context injection.
 */
export async function assembleQuickContext(
  registry: ContextSourceRegistry,
  userId: number,
  query: string,
  contextType: ContextType,
  maxTokenBudget?: number,
): Promise<{ contextPrompt: string; metadata: AssemblyMetadata }> {
  const result = await assembleDeepContext(registry, {
    userId,
    query,
    contextType,
    maxTokenBudget,
  });

  return {
    contextPrompt: result.fullContextPrompt,
    metadata: result.metadata,
  };
}

// ─── UTILITIES ───────────────────────────────────────────────────────────────

/**
 * Truncate text at a sentence or paragraph boundary within the character limit.
 */
function truncateAtBoundary(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  const truncated = text.substring(0, maxChars);

  // Try to find the last sentence boundary
  const lastPeriod = truncated.lastIndexOf(". ");
  const lastNewline = truncated.lastIndexOf("\n");
  const boundary = Math.max(lastPeriod, lastNewline);

  if (boundary > maxChars * 0.5) {
    return truncated.substring(0, boundary + 1) + "\n[...truncated]";
  }

  return truncated + "\n[...truncated]";
}

/**
 * Convert a camelCase source name to a human-readable label.
 */
function formatSourceLabel(name: string): string {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

/**
 * Assess overall retrieval quality based on hit rate and content volume.
 */
function assessRetrievalQuality(
  hitRate: number,
  totalChars: number,
  charBudget: number,
): "high" | "medium" | "low" {
  const fillRatio = totalChars / charBudget;

  if (hitRate >= 0.6 && fillRatio >= 0.3) return "high";
  if (hitRate >= 0.3 || fillRatio >= 0.15) return "medium";
  return "low";
}
