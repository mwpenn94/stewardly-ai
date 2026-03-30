/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Stewardly Memory Store — MemoryStore Implementation
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Connects the platform-agnostic memory engine to Stewardly's Drizzle ORM
 * schema. Implements the MemoryStore interface from @platform/intelligence.
 */

import type { MemoryStore, StoredMemory, StoredEpisode, EpisodeSummary } from "./memoryEngine";
import { getDb } from "../../db";
import { memories, memoryEpisodes } from "../../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

export const stewardlyMemoryStore: MemoryStore = {
  async getMemories(userId: number, limit = 30): Promise<StoredMemory[]> {
    const db = await getDb();
    if (!db) return [];

    const rows = await db
      .select()
      .from(memories)
      .where(eq(memories.userId, userId))
      .orderBy(desc(memories.updatedAt))
      .limit(limit);

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      category: r.category || "fact",
      content: r.content,
      source: r.source || "unknown",
      confidence: r.confidence ?? 0.5,
      updatedAt: r.updatedAt,
    }));
  },

  async insertMemories(
    userId: number,
    newMemories: Array<{
      category: string;
      content: string;
      source: string;
      confidence: number;
    }>,
  ): Promise<void> {
    const db = await getDb();
    if (!db || newMemories.length === 0) return;

    await db.insert(memories).values(
      newMemories.map((m) => ({
        userId,
        category: m.category,
        content: m.content,
        source: m.source,
        confidence: m.confidence,
      })),
    );
  },

  async getEpisodes(userId: number, limit = 5): Promise<StoredEpisode[]> {
    const db = await getDb();
    if (!db) return [];

    const rows = await db
      .select()
      .from(memoryEpisodes)
      .where(eq(memoryEpisodes.userId, userId))
      .orderBy(desc(memoryEpisodes.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      conversationId: r.conversationId,
      summary: r.summary,
      keyTopics: r.keyTopics as string[],
      emotionalTone: r.emotionalTone,
      createdAt: r.createdAt,
    }));
  },

  async insertEpisode(
    userId: number,
    conversationId: number,
    episode: EpisodeSummary,
  ): Promise<void> {
    const db = await getDb();
    if (!db) return;

    await db.insert(memoryEpisodes).values({
      userId,
      conversationId,
      summary: episode.summary,
      keyTopics: episode.keyTopics,
      emotionalTone: episode.emotionalTone,
    });
  },
};

export default stewardlyMemoryStore;
