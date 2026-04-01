/**
 * Memory Engine (A1) — 3-Tier Persistent Memory System
 * 
 * Tier 1: Structured Facts (key-value with timestamps, source, change history)
 * Tier 2: Behavioral Preferences (response length, chart vs text, topic interests)
 * Tier 3: Episodic Summaries (2-3 sentence conversation summaries)
 * 
 * Auto-extracts facts and preferences from every conversation turn.
 */
import { contextualLLM } from "./shared/stewardlyWiring";
import { getDb } from "./db";
import { memories, memoryEpisodes } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

// ─── TYPES ──────────────────────────────────────────────────────
interface ExtractedMemory {
  category: "fact" | "preference" | "goal" | "relationship" | "financial" | "temporal";
  content: string;
  confidence: number;
}

interface EpisodeSummary {
  summary: string;
  keyTopics: string[];
  emotionalTone: string;
}

// ─── MEMORY EXTRACTION (runs after every AI response) ───────────
const EXTRACTION_PROMPT = `You are a memory extraction system for a financial planning AI called Steward.
Analyze the user's message and extract any new facts, preferences, goals, relationships, financial data, or temporal events.

Rules:
- Only extract CONCRETE, SPECIFIC information (not vague statements)
- Categorize each as: fact, preference, goal, relationship, financial, temporal
- Assign confidence 0.5-1.0 (higher = more explicit/certain)
- Skip greetings, questions, and meta-conversation
- Maximum 5 extractions per message
- For financial data, include specific numbers when mentioned
- For preferences, note communication style, topics of interest, etc.

Return ONLY valid JSON array (no markdown, no explanation):
[{"category":"fact","content":"User is 35 years old","confidence":0.95}]

If nothing to extract, return: []`;

export async function extractMemoriesFromMessage(
  userId: number,
  userMessage: string,
  aiResponse: string,
): Promise<ExtractedMemory[]> {
  try {
    const resp = await contextualLLM({ userId: userId, contextType: "chat",
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: `User said: "${userMessage.substring(0, 2000)}"\n\nAI responded: "${aiResponse.substring(0, 1000)}"` },
      ],
    });
    const raw = typeof resp.choices[0]?.message?.content === "string"
      ? resp.choices[0].message.content.trim()
      : "[]";
    // Parse JSON, handling potential markdown wrapping
    const jsonStr = raw.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m: any) => m.category && m.content && typeof m.confidence === "number"
    ).slice(0, 5);
  } catch {
    return [];
  }
}

export async function saveExtractedMemories(
  userId: number,
  extracted: ExtractedMemory[],
): Promise<void> {
  const db = await getDb();
  if (!db || extracted.length === 0) return;
  // Check for duplicates by content similarity (simple substring match)
  const existing = await db.select().from(memories).where(eq(memories.userId, userId));
  const existingContents = new Set(existing.map(m => m.content.toLowerCase().trim()));
  const newMemories = extracted.filter(
    m => !existingContents.has(m.content.toLowerCase().trim())
  );
  if (newMemories.length === 0) return;
  await db.insert(memories).values(
    newMemories.map(m => ({
      userId,
      category: m.category,
      content: m.content,
      source: "auto_extracted",
      confidence: m.confidence,
    }))
  );
}

// ─── EPISODIC SUMMARIES (Tier 3) ────────────────────────────────
const EPISODE_PROMPT = `Summarize this conversation in 2-3 sentences. Focus on:
- Key topics discussed
- Decisions made or advice given
- Action items or next steps

Also identify:
- keyTopics: array of 2-5 topic tags (e.g., "retirement", "tax planning")
- emotionalTone: one word (e.g., "curious", "concerned", "confident", "neutral")

Return ONLY valid JSON:
{"summary":"...","keyTopics":["..."],"emotionalTone":"..."}`;

export async function generateEpisodeSummary(
  messages: Array<{ role: string; content: string }>,
): Promise<EpisodeSummary | null> {
  if (messages.length < 4) return null; // Need at least 2 exchanges
  try {
    const transcript = messages
      .slice(-20) // Last 20 messages
      .map(m => `${m.role === "user" ? "User" : "Steward"}: ${m.content.substring(0, 500)}`)
      .join("\n");
    const resp = await contextualLLM({ userId: 0, contextType: "chat",
      messages: [
        { role: "system", content: EPISODE_PROMPT },
        { role: "user", content: transcript },
      ],
    });
    const raw = typeof resp.choices[0]?.message?.content === "string"
      ? resp.choices[0].message.content.trim()
      : "{}";
    const jsonStr = raw.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

export async function saveEpisodeSummary(
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
}

// ─── MEMORY CONTEXT ASSEMBLY (for prompt injection) ─────────────
export async function assembleMemoryContext(userId: number): Promise<string> {
  const db = await getDb();
  if (!db) return "";
  // Get recent facts and preferences (Tier 1 + 2)
  const mems = await db.select().from(memories)
    .where(eq(memories.userId, userId))
    .orderBy(desc(memories.updatedAt))
    .limit(30);
  // Get recent episodes (Tier 3)
  const episodes = await db.select().from(memoryEpisodes)
    .where(eq(memoryEpisodes.userId, userId))
    .orderBy(desc(memoryEpisodes.createdAt))
    .limit(5);
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
}

// ─── EPISODE HELPERS ────────────────────────────────────────────
export async function getEpisodes(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(memoryEpisodes)
    .where(eq(memoryEpisodes.userId, userId))
    .orderBy(desc(memoryEpisodes.createdAt))
    .limit(limit);
}
