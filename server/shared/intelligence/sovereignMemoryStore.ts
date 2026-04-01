/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Sovereign Memory Store — MemoryStore Implementation
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Extends the Stewardly memory store with Sovereign-specific memory
 * categories and persistence for:
 *   - Routing decision memories (which providers worked well for which tasks)
 *   - Budget awareness memories (spending patterns, cost optimization insights)
 *   - Autonomy progression memories (trust score changes, level transitions)
 *   - Reflection memories (goal completion quality, improvement areas)
 *
 * Delegates base memory operations to stewardlyMemoryStore while adding
 * Sovereign-specific enrichment and categorization.
 */

import type { MemoryStore, StoredMemory, StoredEpisode } from "./memoryEngine";
import { stewardlyMemoryStore } from "./stewardlyMemoryStore";
import { normalizeQualityScore } from "./types";

// ── Sovereign-specific memory categories ────────────────────────────────────

export const SOVEREIGN_MEMORY_CATEGORIES = [
  "fact",
  "preference",
  "goal",
  "relationship",
  "financial",
  "temporal",
  "amp_engagement",
  "ho_domain_trajectory",
  // Sovereign-specific categories
  "routing_decision",
  "provider_performance",
  "budget_awareness",
  "autonomy_progression",
  "reflection",
  "goal_completion",
] as const;

export type SovereignMemoryCategory = (typeof SOVEREIGN_MEMORY_CATEGORIES)[number];

// ── Sovereign Memory Store ──────────────────────────────────────────────────

export const sovereignMemoryStore: MemoryStore = {
  /**
   * Get memories with Sovereign-enriched metadata.
   * Delegates to stewardlyMemoryStore and normalizes confidence scores.
   */
  async getMemories(userId: number, limit = 30): Promise<StoredMemory[]> {
    const memories = await stewardlyMemoryStore.getMemories(userId, limit);

    // Normalize all confidence scores to [0, 1]
    return memories.map((m) => ({
      ...m,
      confidence: normalizeQualityScore(m.confidence),
    }));
  },

  /**
   * Insert memories with Sovereign-specific validation.
   * Ensures all memories have normalized confidence scores and valid categories.
   */
  async insertMemories(
    userId: number,
    newMemories: Array<{
      category: string;
      content: string;
      source: string;
      confidence: number;
    }>,
  ): Promise<void> {
    // Normalize confidence scores before insertion
    const normalizedMemories = newMemories.map((m) => ({
      ...m,
      confidence: normalizeQualityScore(m.confidence),
      // Ensure category is valid; default to "fact" if unknown
      category: SOVEREIGN_MEMORY_CATEGORIES.includes(m.category as SovereignMemoryCategory)
        ? m.category
        : "fact",
    }));

    await stewardlyMemoryStore.insertMemories(userId, normalizedMemories);
  },

  /**
   * Get episodes (conversation summaries) for reflection analysis.
   */
  async getEpisodes(userId: number, limit = 5): Promise<StoredEpisode[]> {
    return stewardlyMemoryStore.getEpisodes(userId, limit);
  },

  /**
   * Insert episode with Sovereign-enriched metadata.
   */
  async insertEpisode(
    userId: number,
    episode: {
      conversationId: number;
      summary: string;
      keyTopics: string[];
      emotionalTone: string;
    },
  ): Promise<void> {
    await stewardlyMemoryStore.insertEpisode(userId, episode);
  },
};

// ── Sovereign-specific memory helpers ───────────────────────────────────────

/**
 * Record a routing decision as a memory for future reference.
 * This allows the Sovereign layer to learn from past routing choices.
 */
export async function recordRoutingMemory(
  userId: number,
  taskType: string,
  provider: string,
  qualityScore: number,
  latencyMs: number,
): Promise<void> {
  const normalizedQuality = normalizeQualityScore(qualityScore);
  const content = `Routing: ${taskType} → ${provider} (quality: ${normalizedQuality.toFixed(2)}, latency: ${latencyMs}ms)`;

  await sovereignMemoryStore.insertMemories(userId, [
    {
      category: "routing_decision",
      content,
      source: "sovereign_router",
      confidence: normalizedQuality,
    },
  ]);
}

/**
 * Record a budget-related memory (spending pattern, cost alert, etc.).
 */
export async function recordBudgetMemory(
  userId: number,
  event: string,
  details: string,
): Promise<void> {
  await sovereignMemoryStore.insertMemories(userId, [
    {
      category: "budget_awareness",
      content: `Budget event: ${event} — ${details}`,
      source: "sovereign_budget",
      confidence: 1.0,
    },
  ]);
}

/**
 * Record an autonomy level transition as a memory.
 */
export async function recordAutonomyTransition(
  userId: number,
  fromLevel: string,
  toLevel: string,
  reason: string,
): Promise<void> {
  await sovereignMemoryStore.insertMemories(userId, [
    {
      category: "autonomy_progression",
      content: `Autonomy transition: ${fromLevel} → ${toLevel}. Reason: ${reason}`,
      source: "sovereign_autonomy",
      confidence: 1.0,
    },
  ]);
}

/**
 * Record a goal completion reflection.
 */
export async function recordReflection(
  userId: number,
  goalDescription: string,
  completionQuality: number,
  lessonsLearned: string,
): Promise<void> {
  const normalizedQuality = normalizeQualityScore(completionQuality);
  await sovereignMemoryStore.insertMemories(userId, [
    {
      category: "reflection",
      content: `Goal: ${goalDescription} | Quality: ${normalizedQuality.toFixed(2)} | Lessons: ${lessonsLearned}`,
      source: "sovereign_reflection",
      confidence: normalizedQuality,
    },
  ]);
}

export default sovereignMemoryStore;
