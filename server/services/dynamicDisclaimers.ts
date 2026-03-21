/**
 * Task #34 — Dynamic Disclaimers + Tracking Service
 * Topic-aware disclaimer injection, interaction tracking,
 * multi-language support, and topic-change detection.
 */
import { getDb } from "../db";
import {
  disclaimerVersions, disclaimerInteractions, disclaimerTranslations,
  conversationTopics, disclaimerAudit,
} from "../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";

// ─── Topic Detection ─────────────────────────────────────────────────────
const TOPIC_PATTERNS: Record<string, RegExp[]> = {
  investment: [/\b(invest|portfolio|stock|bond|fund|etf|mutual fund|asset allocation)\b/i],
  retirement: [/\b(retire|401k|ira|pension|social security|rmd)\b/i],
  tax: [/\b(tax|deduction|capital gains|irs|w-?2|1099|filing)\b/i],
  insurance: [/\b(insurance|policy|premium|coverage|annuit|life insurance|term life)\b/i],
  estate: [/\b(estate|trust|will|beneficiar|inheritance|probate)\b/i],
  debt: [/\b(debt|loan|mortgage|credit|interest rate|refinanc)\b/i],
  crypto: [/\b(crypto|bitcoin|ethereum|blockchain|defi|nft)\b/i],
};

export function detectTopic(message: string): string {
  for (const [topic, patterns] of Object.entries(TOPIC_PATTERNS)) {
    if (patterns.some(p => p.test(message))) return topic;
  }
  return "general";
}

// ─── Topic Change Detection + Disclaimer Injection ───────────────────────
export async function handleTopicChange(
  conversationId: number,
  messageId: number,
  message: string
): Promise<{ topicChanged: boolean; newTopic: string; disclaimer: string | null }> {
  const db = (await getDb())!;
  const newTopic = detectTopic(message);

  // Get previous topic
  const [prev] = await db.select().from(conversationTopics)
    .where(eq(conversationTopics.conversationId, conversationId))
    .orderBy(desc(conversationTopics.detectedAt)).limit(1);

  const topicChanged = !prev || prev.topic !== newTopic;
  let disclaimer: string | null = null;

  if (topicChanged && newTopic !== "general") {
    // Get current disclaimer for this topic
    const [disc] = await db.select().from(disclaimerVersions)
      .where(and(eq(disclaimerVersions.topic, newTopic), sql`superseded_by IS NULL`))
      .orderBy(desc(disclaimerVersions.version)).limit(1);

    if (disc) {
      disclaimer = disc.disclaimerText;
      // Log disclaimer shown
      await db.insert(disclaimerAudit).values({
        conversationId,
        disclaimerId: disc.id,
        disclaimerVersion: disc.version ?? 1,
      });
    }
  }

  // Log topic
  await db.insert(conversationTopics).values({
    conversationId,
    messageId,
    topic: newTopic,
    previousTopic: prev?.topic,
    disclaimerInjected: disclaimer !== null,
  });

  return { topicChanged, newTopic, disclaimer };
}

// ─── Interaction Tracking ────────────────────────────────────────────────
export async function trackDisclaimerInteraction(
  disclaimerId: number,
  userId: number,
  action: "shown" | "scrolled" | "clicked" | "acknowledged"
): Promise<void> {
  const db = (await getDb())!;
  await db.insert(disclaimerInteractions).values({ disclaimerId, userId, action });
}

export async function getDisclaimerEngagement(disclaimerId: number) {
  const db = (await getDb())!;
  const interactions = await db.select().from(disclaimerInteractions)
    .where(eq(disclaimerInteractions.disclaimerId, disclaimerId));

  const counts = { shown: 0, scrolled: 0, clicked: 0, acknowledged: 0 };
  for (const i of interactions) {
    if (i.action) counts[i.action]++;
  }

  return {
    total: interactions.length,
    ...counts,
    acknowledgeRate: counts.shown > 0 ? (counts.acknowledged / counts.shown * 100).toFixed(1) + "%" : "N/A",
  };
}

// ─── Translation Support ─────────────────────────────────────────────────
export async function addTranslation(disclaimerId: number, language: string, translatedText: string): Promise<void> {
  const db = (await getDb())!;
  await db.insert(disclaimerTranslations).values({ disclaimerId, language, translatedText });
}

export async function getTranslation(disclaimerId: number, language: string): Promise<string | null> {
  const db = (await getDb())!;
  const [t] = await db.select().from(disclaimerTranslations)
    .where(and(eq(disclaimerTranslations.disclaimerId, disclaimerId), eq(disclaimerTranslations.language, language)))
    .limit(1);
  return t?.translatedText ?? null;
}

// ─── Query Helpers ───────────────────────────────────────────────────────
export async function getConversationTopicHistory(conversationId: number) {
  const db = (await getDb())!;
  return db.select().from(conversationTopics)
    .where(eq(conversationTopics.conversationId, conversationId))
    .orderBy(desc(conversationTopics.detectedAt));
}

export async function getAllDisclaimers() {
  const db = (await getDb())!;
  return db.select().from(disclaimerVersions)
    .where(sql`superseded_by IS NULL`)
    .orderBy(desc(disclaimerVersions.createdAt));
}
