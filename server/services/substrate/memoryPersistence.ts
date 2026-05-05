/**
 * memoryPersistence.ts — Bridges in-memory working memory to the database.
 *
 * Uses the existing `memories` table (schema.ts line 816) and `memory_episodes`
 * table to persist consolidated working memory entries. This ensures that
 * user context survives server restarts and is available across sessions.
 *
 * Flow:
 * 1. On consolidation (triggered by memory substrate), high-confidence entries
 *    are persisted to the `memories` table.
 * 2. On session start, persisted memories are loaded back into working memory.
 * 3. Memory episodes capture conversation-level summaries.
 */
import { requireDb } from "../../db";
import { memories, memoryEpisodes } from "../../../drizzle/schema";
import { eq, desc, and, gte } from "drizzle-orm";
import type { MemoryEntry, WorkingMemory } from "./memorySubstrate";
import { getWorkingMemory, addToWorkingMemory } from "./memorySubstrate";

/**
 * Map substrate memory types to the database category enum.
 */
function mapTypeToCategory(type: string): "fact" | "preference" | "goal" | "relationship" | "financial" | "temporal" {
  switch (type) {
    case "semantic": return "fact";
    case "procedural": return "preference";
    case "episodic": return "temporal";
    case "working": return "goal";
    default: return "fact";
  }
}

/**
 * Persist high-confidence working memory entries to the database.
 * Called after consolidateWorkingMemory() runs.
 */
export async function persistConsolidatedMemories(
  userId: number,
  entries: MemoryEntry[],
  minConfidence: number = 0.6
): Promise<number> {
  const db = await requireDb();
  const toPersist = entries.filter(e => e.confidence >= minConfidence);

  if (toPersist.length === 0) return 0;

  let persisted = 0;
  for (const entry of toPersist) {
    try {
      await db.insert(memories).values({
        userId,
        category: mapTypeToCategory(entry.type),
        content: entry.content,
        source: `substrate:${entry.type}`,
        confidence: entry.confidence,
      });
      persisted++;
    } catch (err) {
      // Skip duplicates or constraint violations
      console.warn(`[MemoryPersistence] Failed to persist entry: ${(err as Error).message}`);
    }
  }

  return persisted;
}

/**
 * Load persisted memories back into working memory on session start.
 * Only loads recent, high-confidence memories to avoid overloading context.
 */
export async function hydrateWorkingMemory(
  userId: number,
  maxEntries: number = 50
): Promise<number> {
  const db = await requireDb();

  // Load recent memories from the last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const persisted = await db
    .select()
    .from(memories)
    .where(
      and(
        eq(memories.userId, userId),
        gte(memories.createdAt, thirtyDaysAgo)
      )
    )
    .orderBy(desc(memories.updatedAt))
    .limit(maxEntries);

  let hydrated = 0;
  const wm = getWorkingMemory(userId);

  for (const mem of persisted) {
    // Skip if already in working memory (by content match)
    const exists = wm.entries.some(e => e.content === mem.content);
    if (exists) continue;

    addToWorkingMemory(userId, {
      content: mem.content,
      type: mem.category === "preference" ? "procedural" : mem.category === "temporal" ? "episodic" : "semantic",
      confidence: mem.confidence ?? 0.8,
      metadata: { source: "persisted", dbId: mem.id },
    });
    hydrated++;
  }

  return hydrated;
}

/**
 * Save a conversation episode summary for long-term memory.
 */
export async function saveEpisode(
  userId: number,
  conversationId: number,
  summary: string,
  keyTopics: string[],
  emotionalTone?: string
): Promise<void> {
  const db = await requireDb();

  await db.insert(memoryEpisodes).values({
    userId,
    conversationId,
    summary,
    keyTopics: JSON.stringify(keyTopics),
    emotionalTone: emotionalTone ?? "neutral",
  });
}

/**
 * Get memory statistics for a user (for the M&V dashboard).
 */
export async function getPersistedMemoryStats(userId: number): Promise<{
  totalMemories: number;
  recentMemories: number;
  episodes: number;
  categories: Record<string, number>;
}> {
  const db = await requireDb();

  const allMemories = await db
    .select()
    .from(memories)
    .where(eq(memories.userId, userId));

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentMemories = allMemories.filter(m => m.createdAt >= thirtyDaysAgo);

  const episodes = await db
    .select()
    .from(memoryEpisodes)
    .where(eq(memoryEpisodes.userId, userId));

  const categories: Record<string, number> = {};
  for (const m of allMemories) {
    categories[m.category] = (categories[m.category] || 0) + 1;
  }

  return {
    totalMemories: allMemories.length,
    recentMemories: recentMemories.length,
    episodes: episodes.length,
    categories,
  };
}
