/**
 * ═══════════════════════════════════════════════════════════════════════════
 * @platform/intelligence — Memory Engine
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 3-Tier Persistent Memory System (platform-agnostic):
 *   Tier 1: Structured Facts (key-value with timestamps, source, change history)
 *   Tier 2: Behavioral Preferences (response length, chart vs text, topic interests)
 *   Tier 3: Episodic Summaries (2-3 sentence conversation summaries)
 *
 * Key design decisions:
 *   - Memory categories are parameterized: the base set (fact, preference,
 *     goal, relationship, financial, temporal) is extended with project-specific
 *     categories like amp_engagement and ho_domain_trajectory.
 *   - Database operations are injected via a MemoryStore interface, decoupling
 *     the engine from any specific ORM or schema.
 *   - LLM calls are injected via a function reference, not imported directly.
 *   - Quality scores are normalized before storage.
 */

import type { MemoryCategory } from "./types";
import { normalizeQualityScore, EXTENDED_MEMORY_CATEGORIES } from "./types";

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface ExtractedMemory {
  category: MemoryCategory;
  content: string;
  confidence: number;
}

export interface EpisodeSummary {
  summary: string;
  keyTopics: string[];
  emotionalTone: string;
}

export interface StoredMemory {
  id: number;
  userId: number;
  category: string;
  content: string;
  source: string;
  confidence: number;
  updatedAt: Date | string;
}

export interface StoredEpisode {
  id: number;
  userId: number;
  conversationId: number;
  summary: string;
  keyTopics: string[];
  emotionalTone: string;
  createdAt: Date | string;
}

// ─── MEMORY STORE INTERFACE ──────────────────────────────────────────────────
//
// Projects implement this to connect the memory engine to their database.

export interface MemoryStore {
  /** Retrieve recent memories for a user, ordered by recency. */
  getMemories(userId: number, limit?: number): Promise<StoredMemory[]>;
  /** Insert new memories. */
  insertMemories(
    userId: number,
    memories: Array<{
      category: string;
      content: string;
      source: string;
      confidence: number;
    }>,
  ): Promise<void>;
  /** Retrieve recent episode summaries for a user. */
  getEpisodes(userId: number, limit?: number): Promise<StoredEpisode[]>;
  /** Insert a new episode summary. */
  insertEpisode(
    userId: number,
    conversationId: number,
    episode: EpisodeSummary,
  ): Promise<void>;
}

// ─── LLM FUNCTION TYPE ──────────────────────────────────────────────────────

export type MemoryLLMFunction = (params: {
  userId: number;
  contextType: string;
  messages: Array<{ role: string; content: string }>;
}) => Promise<{
  choices: Array<{ message: { content: string | null } }>;
}>;

// ─── MEMORY ENGINE FACTORY ───────────────────────────────────────────────────

export interface MemoryEngineConfig {
  /** The memory store implementation. */
  store: MemoryStore;
  /** LLM function for extraction and summarization. */
  llm: MemoryLLMFunction;
  /** Allowed memory categories. Defaults to EXTENDED_MEMORY_CATEGORIES. */
  categories?: readonly string[];
  /** Maximum extractions per message. Default: 5. */
  maxExtractionsPerMessage?: number;
  /** Optional logger. */
  logger?: {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
}

export function createMemoryEngine(config: MemoryEngineConfig) {
  const {
    store,
    llm,
    categories = EXTENDED_MEMORY_CATEGORIES,
    maxExtractionsPerMessage = 5,
    logger: log = console,
  } = config;

  const categorySet = new Set<string>(categories);

  // ── Extraction Prompt ──────────────────────────────────────────────────
  const EXTRACTION_PROMPT = buildExtractionPrompt(categories);
  const EPISODE_PROMPT = buildEpisodePrompt();

  // ── Public API ─────────────────────────────────────────────────────────

  async function extractMemoriesFromMessage(
    userId: number,
    userMessage: string,
    aiResponse: string,
  ): Promise<ExtractedMemory[]> {
    try {
      const resp = await llm({
        userId,
        contextType: "chat",
        messages: [
          { role: "system", content: EXTRACTION_PROMPT },
          {
            role: "user",
            content: `User said: "${userMessage.substring(0, 2000)}"\n\nAI responded: "${aiResponse.substring(0, 1000)}"`,
          },
        ],
      });

      const raw =
        typeof resp.choices[0]?.message?.content === "string"
          ? resp.choices[0].message.content.trim()
          : "[]";

      const jsonStr = raw.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
      const parsed = JSON.parse(jsonStr);

      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter(
          (m: any) =>
            m.category &&
            categorySet.has(m.category) &&
            m.content &&
            typeof m.confidence === "number",
        )
        .map((m: any) => ({
          category: m.category as MemoryCategory,
          content: m.content,
          confidence: normalizeQualityScore(m.confidence),
        }))
        .slice(0, maxExtractionsPerMessage);
    } catch {
      return [];
    }
  }

  async function saveExtractedMemories(
    userId: number,
    extracted: ExtractedMemory[],
  ): Promise<void> {
    if (extracted.length === 0) return;

    try {
      const existing = await store.getMemories(userId, 500);
      const existingContents = new Set(
        existing.map((m) => m.content.toLowerCase().trim()),
      );

      const newMemories = extracted.filter(
        (m) => !existingContents.has(m.content.toLowerCase().trim()),
      );

      if (newMemories.length === 0) return;

      await store.insertMemories(
        userId,
        newMemories.map((m) => ({
          category: m.category,
          content: m.content,
          source: "auto_extracted",
          confidence: m.confidence,
        })),
      );
    } catch (err) {
      log.error("[memoryEngine] Failed to save memories:", err);
    }
  }

  async function generateEpisodeSummary(
    messages: Array<{ role: string; content: string }>,
  ): Promise<EpisodeSummary | null> {
    if (messages.length < 4) return null;

    try {
      const transcript = messages
        .slice(-20)
        .map(
          (m) =>
            `${m.role === "user" ? "User" : "Assistant"}: ${m.content.substring(0, 500)}`,
        )
        .join("\n");

      const resp = await llm({
        userId: 0,
        contextType: "chat",
        messages: [
          { role: "system", content: EPISODE_PROMPT },
          { role: "user", content: transcript },
        ],
      });

      const raw =
        typeof resp.choices[0]?.message?.content === "string"
          ? resp.choices[0].message.content.trim()
          : "{}";

      const jsonStr = raw.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
      return JSON.parse(jsonStr);
    } catch {
      return null;
    }
  }

  async function saveEpisodeSummary(
    userId: number,
    conversationId: number,
    episode: EpisodeSummary,
  ): Promise<void> {
    try {
      await store.insertEpisode(userId, conversationId, episode);
    } catch (err) {
      log.error("[memoryEngine] Failed to save episode:", err);
    }
  }

  async function assembleMemoryContext(userId: number): Promise<string> {
    try {
      const mems = await store.getMemories(userId, 30);
      const episodes = await store.getEpisodes(userId, 5);

      const parts: string[] = [];

      if (mems.length > 0) {
        const grouped: Record<string, string[]> = {};
        for (const m of mems) {
          const cat = m.category || "fact";
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push(m.content);
        }
        parts.push("KNOWN ABOUT THIS USER:");
        for (const [cat, items] of Object.entries(grouped)) {
          parts.push(`  ${cat.toUpperCase()}: ${items.join("; ")}`);
        }
      }

      if (episodes.length > 0) {
        parts.push("\nRECENT CONVERSATION HISTORY:");
        for (const ep of episodes) {
          parts.push(`  - ${ep.summary}`);
        }
      }

      return parts.join("\n");
    } catch (err) {
      log.error("[memoryEngine] Failed to assemble memory context:", err);
      return "";
    }
  }

  async function getEpisodes(userId: number, limit = 20): Promise<StoredEpisode[]> {
    return store.getEpisodes(userId, limit);
  }

  return {
    extractMemoriesFromMessage,
    saveExtractedMemories,
    generateEpisodeSummary,
    saveEpisodeSummary,
    assembleMemoryContext,
    getEpisodes,
    /** Expose the configured categories for introspection. */
    categories: [...categories],
  };
}

// ─── PROMPT BUILDERS ─────────────────────────────────────────────────────────

function buildExtractionPrompt(categories: readonly string[]): string {
  const categoryList = categories.join(", ");
  return `You are a memory extraction system for an AI assistant.
Analyze the user's message and extract any new facts, preferences, goals, relationships, financial data, temporal events, engagement patterns, or domain trajectory signals.
Rules:
- Only extract CONCRETE, SPECIFIC information (not vague statements)
- Categorize each as one of: ${categoryList}
- Assign confidence 0.0-1.0 (higher = more explicit/certain)
- Skip greetings, questions, and meta-conversation
- Maximum 5 extractions per message
- For financial data, include specific numbers when mentioned
- For preferences, note communication style, topics of interest, etc.
- For amp_engagement, note engagement patterns, phase transitions, and momentum signals
- For ho_domain_trajectory, note growth patterns across human output domains
Return ONLY valid JSON array (no markdown, no explanation):
[{"category":"fact","content":"User is 35 years old","confidence":0.95}]
If nothing to extract, return: []`;
}

function buildEpisodePrompt(): string {
  return `Summarize this conversation in 2-3 sentences. Focus on:
- Key topics discussed
- Decisions made or advice given
- Action items or next steps
Also identify:
- keyTopics: array of 2-5 topic tags
- emotionalTone: one word (e.g., "curious", "concerned", "confident", "neutral")
Return ONLY valid JSON:
{"summary":"...","keyTopics":["..."],"emotionalTone":"..."}`;
}
