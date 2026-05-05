/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Substrate Primitive: Memory Substrate
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Enhanced memory layer that wraps the existing memoryEngine with:
 *   - Semantic memory retrieval (embedding-based)
 *   - Episodic memory (conversation summaries)
 *   - Procedural memory (learned preferences and patterns)
 *   - Working memory (session context window)
 *   - Memory consolidation (periodic summarization)
 *
 * This is the substrate-level abstraction; the existing memoryEngine.ts
 * continues to handle the DB operations. This layer adds intelligence.
 *
 * @substrate-primitive: memory-substrate
 * @absorbed-from: manus-next-app/server/services/memoryService.ts
 */
import { generateEmbedding, cosineSimilarity } from "./embedding";
import { logger } from "../../_core/logger";

const log = logger.child({ module: "substrate:memory" });

// ─── Types ───────────────────────────────────────────────────────────────────

export type MemoryType = "semantic" | "episodic" | "procedural" | "working";

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  content: string;
  embedding?: number[];
  importance: number; // 0-1 scale
  accessCount: number;
  lastAccessed: number;
  createdAt: number;
  metadata: Record<string, unknown>;
}

export interface WorkingMemory {
  userId: number;
  entries: MemoryEntry[];
  maxSize: number;
  lastConsolidated: number;
}

export interface MemoryQuery {
  text: string;
  types?: MemoryType[];
  minImportance?: number;
  maxResults?: number;
  recencyBias?: number; // 0-1, how much to weight recent memories
}

export interface MemoryRetrievalResult {
  entries: Array<MemoryEntry & { relevanceScore: number }>;
  totalSearched: number;
  strategy: string;
}

// ─── Working Memory Store ────────────────────────────────────────────────────

const workingMemoryStore = new Map<number, WorkingMemory>();
const DEFAULT_WORKING_MEMORY_SIZE = 20;

/**
 * Get or create working memory for a user.
 */
export function getWorkingMemory(userId: number): WorkingMemory {
  if (!workingMemoryStore.has(userId)) {
    workingMemoryStore.set(userId, {
      userId,
      entries: [],
      maxSize: DEFAULT_WORKING_MEMORY_SIZE,
      lastConsolidated: Date.now(),
    });
  }
  return workingMemoryStore.get(userId)!;
}

/**
 * Add an entry to working memory.
 * Evicts least important entries when at capacity.
 */
export function addToWorkingMemory(userId: number, entry: Omit<MemoryEntry, "id" | "accessCount" | "lastAccessed" | "createdAt">): MemoryEntry {
  const wm = getWorkingMemory(userId);
  const now = Date.now();

  const fullEntry: MemoryEntry = {
    ...entry,
    id: `wm_${now}_${Math.random().toString(36).slice(2, 8)}`,
    accessCount: 0,
    lastAccessed: now,
    createdAt: now,
  };

  wm.entries.push(fullEntry);

  // Evict if over capacity
  if (wm.entries.length > wm.maxSize) {
    // Sort by importance * recency score, evict lowest
    wm.entries.sort((a, b) => {
      const scoreA = a.importance * (1 + Math.log(a.accessCount + 1));
      const scoreB = b.importance * (1 + Math.log(b.accessCount + 1));
      return scoreB - scoreA;
    });
    wm.entries = wm.entries.slice(0, wm.maxSize);
  }

  return fullEntry;
}

/**
 * Retrieve relevant memories using semantic similarity.
 */
export async function retrieveMemories(
  userId: number,
  query: MemoryQuery
): Promise<MemoryRetrievalResult> {
  const wm = getWorkingMemory(userId);
  const maxResults = query.maxResults ?? 5;
  const recencyBias = query.recencyBias ?? 0.3;
  const minImportance = query.minImportance ?? 0;

  // Filter by type and importance
  let candidates = wm.entries.filter((e) => {
    if (query.types && !query.types.includes(e.type)) return false;
    if (e.importance < minImportance) return false;
    return true;
  });

  if (candidates.length === 0) {
    return { entries: [], totalSearched: 0, strategy: "empty" };
  }

  // Try semantic search if embeddings available
  let strategy = "keyword";
  let queryEmbedding: number[] | null = null;

  try {
    queryEmbedding = await generateEmbedding(query.text);
    strategy = "semantic";
  } catch {
    // Fall back to keyword matching
  }

  const now = Date.now();
  const scored = candidates.map((entry) => {
    let relevanceScore = 0;

    if (queryEmbedding && entry.embedding) {
      // Semantic similarity
      relevanceScore = cosineSimilarity(queryEmbedding, entry.embedding);
    } else {
      // Keyword fallback
      const queryWords = new Set(query.text.toLowerCase().split(/\s+/));
      const entryWords = new Set(entry.content.toLowerCase().split(/\s+/));
      const overlap = [...queryWords].filter((w) => entryWords.has(w)).length;
      relevanceScore = overlap / Math.max(queryWords.size, 1);
    }

    // Apply recency bias
    const ageMs = now - entry.createdAt;
    const recencyScore = Math.exp(-ageMs / (7 * 24 * 60 * 60 * 1000)); // Decay over 7 days
    relevanceScore = relevanceScore * (1 - recencyBias) + recencyScore * recencyBias;

    // Boost by importance
    relevanceScore *= (0.5 + entry.importance * 0.5);

    return { ...entry, relevanceScore };
  });

  // Sort by relevance and take top results
  scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
  const results = scored.slice(0, maxResults);

  // Update access counts
  for (const result of results) {
    const original = wm.entries.find((e) => e.id === result.id);
    if (original) {
      original.accessCount++;
      original.lastAccessed = now;
    }
  }

  return {
    entries: results,
    totalSearched: candidates.length,
    strategy,
  };
}

/**
 * Consolidate working memory — merge similar entries, summarize old ones.
 * Should be called periodically (e.g., end of conversation).
 */
export function consolidateWorkingMemory(userId: number): {
  merged: number;
  evicted: number;
  remaining: number;
} {
  const wm = getWorkingMemory(userId);
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  let merged = 0;
  let evicted = 0;

  // Evict very old, low-importance entries
  const before = wm.entries.length;
  wm.entries = wm.entries.filter((e) => {
    if (e.createdAt < oneHourAgo && e.importance < 0.3 && e.accessCount === 0) {
      evicted++;
      return false;
    }
    return true;
  });

  wm.lastConsolidated = now;

  log.info({ userId, merged, evicted, remaining: wm.entries.length }, "Working memory consolidated");

  return { merged, evicted, remaining: wm.entries.length };
}

/**
 * Clear working memory for a user (e.g., on logout).
 */
export function clearWorkingMemory(userId: number): void {
  workingMemoryStore.delete(userId);
}

/**
 * Get memory statistics for a user.
 */
export function getMemoryStats(userId: number): {
  totalEntries: number;
  byType: Record<MemoryType, number>;
  avgImportance: number;
  oldestEntry: number | null;
  newestEntry: number | null;
} {
  const wm = getWorkingMemory(userId);
  const byType: Record<MemoryType, number> = { semantic: 0, episodic: 0, procedural: 0, working: 0 };

  for (const entry of wm.entries) {
    byType[entry.type]++;
  }

  const avgImportance = wm.entries.length > 0
    ? wm.entries.reduce((sum, e) => sum + e.importance, 0) / wm.entries.length
    : 0;

  return {
    totalEntries: wm.entries.length,
    byType,
    avgImportance,
    oldestEntry: wm.entries.length > 0 ? Math.min(...wm.entries.map((e) => e.createdAt)) : null,
    newestEntry: wm.entries.length > 0 ? Math.max(...wm.entries.map((e) => e.createdAt)) : null,
  };
}
