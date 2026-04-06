/**
 * RAG Trainer — Learn from LLM responses to improve future context
 * After every response: extract facts → store in user_memories
 * After tool calls: store result patterns → knowledge base
 * Nightly: aggregate into episodic summaries
 * Fire-and-forget from contextualLLM (non-blocking)
 */
import { getDb } from "../db";
import { logger } from "../_core/logger";

const log = logger.child({ module: "ragTrainer" });

export async function learn(params: {
  userId: number;
  query: string;
  response: string;
  model?: string;
  toolCalls?: Array<{ name: string; result: string }>;
}): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    const { userMemories } = await import("../../drizzle/schema");

    // Extract key facts from response
    const facts = extractFacts(params.response);
    if (facts.length > 0) {
      for (const fact of facts.slice(0, 5)) {
        try {
          await db.insert(userMemories).values({
            userId: params.userId,
            category: "fact",
            content: fact,
            confidence: "0.70",
            source: `rag_trainer:${params.model || "unknown"}`,
          });
        } catch { /* duplicate or constraint — skip */ }
      }
      log.debug({ userId: params.userId, facts: facts.length }, "RAG trainer: stored facts from response");
    }

    // Store tool call patterns
    if (params.toolCalls && params.toolCalls.length > 0) {
      for (const tc of params.toolCalls) {
        try {
          await db.insert(userMemories).values({
            userId: params.userId,
            category: "episodic",
            content: `Tool ${tc.name} was used for query "${params.query.slice(0, 100)}". Result summary: ${tc.result.slice(0, 200)}`,
            confidence: "0.80",
            source: "rag_trainer:tool_pattern",
          });
        } catch { /* skip */ }
      }
    }
  } catch (e: any) {
    // Non-critical — never block the main response
    log.warn({ error: e.message }, "RAG trainer learning failed");
  }
}

function extractFacts(text: string): string[] {
  // Extract sentences that contain factual assertions
  const sentences = text.split(/[.!?]\s+/).filter(s => s.length > 20 && s.length < 300);
  const facts: string[] = [];

  for (const sentence of sentences) {
    // Look for factual patterns: numbers, dates, names, comparisons
    if (/\$[\d,]+|\d+%|\d{4}|according to|currently|as of|typically|average/.test(sentence)) {
      facts.push(sentence.trim());
    }
  }

  return facts.slice(0, 10); // Cap at 10 facts per response
}

export async function aggregateEpisodicSummaries(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    const { userMemories } = await import("../../drizzle/schema");
    const { eq, and, count } = await import("drizzle-orm");

    // Count episodic memories
    const [result] = await db.select({ count: count() }).from(userMemories)
      .where(and(eq(userMemories.userId, userId), eq(userMemories.category, "episodic")));

    if ((result?.count || 0) > 20) {
      // TODO: In production, use contextualLLM to summarize the episodic memories
      // into a concise summary, then replace the individual memories
      log.info({ userId, episodicCount: result?.count }, "Episodic memories ready for aggregation");
    }
  } catch (e: any) {
    log.warn({ userId, error: e.message }, "Episodic aggregation check failed");
  }
}
