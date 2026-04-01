/**
 * C5 — Knowledge Base Service
 * CRUD, search, freshness scoring, gap detection, feedback tracking
 */
import { getDb } from "../db";
import { knowledgeArticles, knowledgeArticleVersions, knowledgeArticleFeedback, knowledgeGaps } from "../../drizzle/schema";
import { eq, and, desc, like, or, sql } from "drizzle-orm";
import { contextualLLM } from "./contextualLLM";

// ─── CRUD ────────────────────────────────────────────────────────────────
export async function createArticle(data: {
  category: string; subcategory?: string; title: string; content: string;
  contentType?: "process"|"concept"|"reference"|"template"|"faq"|"policy"|"guide";
  metadata?: any; source?: "manual"|"ingested"|"ai_generated"|"conversation_mining";
  sourceUrl?: string; createdBy?: number; effectiveDate?: Date; expiryDate?: Date;
}) {
  const db = (await getDb())!;
  const [row] = await db.insert(knowledgeArticles).values({
    category: data.category,
    subcategory: data.subcategory ?? null,
    title: data.title,
    content: data.content,
    contentType: data.contentType ?? "concept",
    metadata: data.metadata ?? null,
    source: data.source ?? "manual",
    sourceUrl: data.sourceUrl ?? null,
    createdBy: data.createdBy ?? null,
    effectiveDate: data.effectiveDate ?? null,
    expiryDate: data.expiryDate ?? null,
  });
  return { id: row.insertId };
}

export async function getArticle(id: number) {
  const db = (await getDb())!;
  const [article] = await db.select().from(knowledgeArticles).where(eq(knowledgeArticles.id, id));
  return article ?? null;
}

export async function updateArticle(id: number, data: Partial<{
  title: string; content: string; category: string; subcategory: string;
  contentType: string; metadata: any; active: boolean;
}>, changedBy?: number, changeReason?: string) {
  const db = (await getDb())!;
  const existing = await getArticle(id);
  if (!existing) return null;

  // Save version history
  await db.insert(knowledgeArticleVersions).values({
    articleId: id,
    version: existing.version,
    content: existing.content,
    changedBy: changedBy ?? null,
    changeReason: changeReason ?? null,
  });

  const updateData: any = { ...data, version: existing.version + 1 };
  await db.update(knowledgeArticles).set(updateData).where(eq(knowledgeArticles.id, id));
  return getArticle(id);
}

export async function deleteArticle(id: number) {
  const db = (await getDb())!;
  await db.update(knowledgeArticles).set({ active: false } as any).where(eq(knowledgeArticles.id, id));
  return true;
}

// ─── Search ──────────────────────────────────────────────────────────────
export async function searchArticles(query: string, opts?: {
  category?: string; contentType?: string; limit?: number; offset?: number;
}) {
  const db = (await getDb())!;
  const conditions: any[] = [eq(knowledgeArticles.active, true)];
  if (opts?.category) conditions.push(eq(knowledgeArticles.category, opts.category));
  if (opts?.contentType) conditions.push(eq(knowledgeArticles.contentType, opts.contentType as any));

  // Use LIKE for search since TiDB doesn't support FULLTEXT
  if (query) {
    const pattern = `%${query}%`;
    conditions.push(or(
      like(knowledgeArticles.title, pattern),
      like(knowledgeArticles.content, pattern),
    ));
  }

  const results = await db.select().from(knowledgeArticles)
    .where(and(...conditions))
    .orderBy(desc(knowledgeArticles.usageCount))
    .limit(opts?.limit ?? 20)
    .offset(opts?.offset ?? 0);

  // Increment usage count for returned articles
  for (const r of results) {
    await db.update(knowledgeArticles).set({
      usageCount: r.usageCount + 1,
      lastUsedAt: new Date(),
    } as any).where(eq(knowledgeArticles.id, r.id));
  }

  return results;
}

export async function listArticles(opts?: {
  category?: string; limit?: number; offset?: number;
}) {
  const db = (await getDb())!;
  const conditions: any[] = [eq(knowledgeArticles.active, true)];
  if (opts?.category) conditions.push(eq(knowledgeArticles.category, opts.category));

  return db.select().from(knowledgeArticles)
    .where(and(...conditions))
    .orderBy(desc(knowledgeArticles.updatedAt))
    .limit(opts?.limit ?? 50)
    .offset(opts?.offset ?? 0);
}

export async function getCategories() {
  const db = (await getDb())!;
  const rows = await db.select({ category: knowledgeArticles.category })
    .from(knowledgeArticles)
    .where(eq(knowledgeArticles.active, true))
    .groupBy(knowledgeArticles.category);
  return rows.map(r => r.category);
}

// ─── Freshness Scoring ───────────────────────────────────────────────────
export async function recalculateFreshness() {
  const db = (await getDb())!;
  const articles = await db.select().from(knowledgeArticles).where(eq(knowledgeArticles.active, true));
  const now = Date.now();
  let updated = 0;

  for (const a of articles) {
    const ageMs = now - (a.updatedAt?.getTime() ?? now);
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    // Decay: 100 → ~50 at 180 days, ~25 at 360 days
    const freshness = Math.max(0, 100 * Math.exp(-ageDays / 260));
    // Boost from recent usage
    const usageBoost = a.lastUsedAt ? Math.max(0, 20 * Math.exp(-(now - a.lastUsedAt.getTime()) / (1000 * 60 * 60 * 24 * 30))) : 0;
    const finalScore = Math.min(100, freshness + usageBoost);

    await db.update(knowledgeArticles).set({ freshnessScore: Math.round(finalScore * 10) / 10 } as any)
      .where(eq(knowledgeArticles.id, a.id));
    updated++;
  }
  return { updated };
}

// ─── Feedback ────────────────────────────────────────────────────────────
export async function submitFeedback(articleId: number, userId: number | null, helpful: boolean, feedbackText?: string, context?: string) {
  const db = (await getDb())!;
  await db.insert(knowledgeArticleFeedback).values({
    articleId,
    userId: userId ?? null,
    helpful,
    feedbackText: feedbackText ?? null,
    context: context ?? null,
  });

  // Recalculate avg helpfulness
  const feedbacks = await db.select().from(knowledgeArticleFeedback).where(eq(knowledgeArticleFeedback.articleId, articleId));
  const helpfulCount = feedbacks.filter(f => f.helpful).length;
  const avg = feedbacks.length > 0 ? helpfulCount / feedbacks.length : 0;
  await db.update(knowledgeArticles).set({ avgHelpfulnessScore: Math.round(avg * 100) / 100 } as any)
    .where(eq(knowledgeArticles.id, articleId));

  return { success: true };
}

// ─── Gap Detection ───────────────────────────────────────────────────────
export async function detectGaps(recentQueries: string[]) {
  if (recentQueries.length === 0) return { gaps: [] };

  const resp = await contextualLLM({ userId: 0, contextType: "gap_analysis",
    messages: [
      { role: "system", content: "You are a knowledge base gap analyzer. Given a list of user queries that returned no or poor results, identify topic clusters that need new articles. Return JSON array of {topicCluster, suggestedTitle, suggestedOutline}." },
      { role: "user", content: JSON.stringify(recentQueries) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "gap_analysis",
        strict: true,
        schema: {
          type: "object",
          properties: {
            gaps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  topicCluster: { type: "string" },
                  suggestedTitle: { type: "string" },
                  suggestedOutline: { type: "string" },
                },
                required: ["topicCluster", "suggestedTitle", "suggestedOutline"],
                additionalProperties: false,
              },
            },
          },
          required: ["gaps"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = typeof resp.choices?.[0]?.message?.content === "string"
    ? resp.choices[0].message.content : "{}";
  const parsed = JSON.parse(content);
  const db = (await getDb())!;

  for (const gap of parsed.gaps ?? []) {
    await db.insert(knowledgeGaps).values({
      topicCluster: gap.topicCluster,
      queryCount: recentQueries.length,
      sampleQueries: JSON.stringify(recentQueries.slice(0, 10)),
      suggestedArticleDraft: `# ${gap.suggestedTitle}\n\n${gap.suggestedOutline}`,
    });
  }

  return parsed;
}

export async function listGaps(status?: string) {
  const db = (await getDb())!;
  const conditions: any[] = [];
  if (status) conditions.push(eq(knowledgeGaps.status, status as any));
  return db.select().from(knowledgeGaps)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(knowledgeGaps.queryCount));
}

// ─── Context Injection ───────────────────────────────────────────────────
export async function getRelevantArticlesForContext(query: string, categories?: string[], limit = 5) {
  const db = (await getDb())!;
  const conditions: any[] = [eq(knowledgeArticles.active, true)];
  const pattern = `%${query.split(" ").slice(0, 5).join("%")}%`;
  conditions.push(or(
    like(knowledgeArticles.title, pattern),
    like(knowledgeArticles.content, pattern),
  ));

  const results = await db.select().from(knowledgeArticles)
    .where(and(...conditions))
    .orderBy(desc(knowledgeArticles.freshnessScore))
    .limit(limit);

  return results.map(a => ({
    id: a.id,
    title: a.title,
    content: a.content.substring(0, 2000), // Truncate for context window
    category: a.category,
    freshness: a.freshnessScore,
  }));
}
