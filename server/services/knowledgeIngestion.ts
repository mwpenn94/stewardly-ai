/**
 * C8 — Knowledge Ingestion Pipeline Service
 * Document upload, URL scrape, conversation mining, bulk import
 */
import { getDb } from "../db";
import { knowledgeIngestionJobs, knowledgeArticles } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { contextualLLM as invokeLLM } from "../shared/stewardlyWiring"
import { contextualLLM } from "./contextualLLM";

// ─── Job Management ──────────────────────────────────────────────────────
export async function createIngestionJob(data: {
  sourceType: "document"|"url"|"conversation"|"api"|"template"|"bulk";
  sourceUrl?: string; sourceFilename?: string;
}) {
  const db = (await getDb())!;
  const [row] = await db.insert(knowledgeIngestionJobs).values({
    sourceType: data.sourceType,
    sourceUrl: data.sourceUrl ?? null,
    sourceFilename: data.sourceFilename ?? null,
  });
  return { id: row.insertId };
}

export async function getJob(id: number) {
  const db = (await getDb())!;
  const [job] = await db.select().from(knowledgeIngestionJobs).where(eq(knowledgeIngestionJobs.id, id));
  return job ?? null;
}

export async function listJobs(limit = 50) {
  const db = (await getDb())!;
  return db.select().from(knowledgeIngestionJobs).orderBy(desc(knowledgeIngestionJobs.createdAt)).limit(limit);
}

async function updateJob(id: number, data: Partial<{
  status: string; articlesCreated: number; articlesUpdated: number;
  startedAt: Date; completedAt: Date; error: string;
}>) {
  const db = (await getDb())!;
  await db.update(knowledgeIngestionJobs).set(data as any).where(eq(knowledgeIngestionJobs.id, id));
}

// ─── Document Ingestion ──────────────────────────────────────────────────
export async function ingestDocument(jobId: number, content: string, filename: string) {
  await updateJob(jobId, { status: "processing" as any, startedAt: new Date() });

  try {
    const resp = await contextualLLM({ userId: null, contextType: "ingestion",
      messages: [
        {
          role: "system",
          content: `You are a knowledge base article extractor. Given a document, extract distinct knowledge articles from it. Each article should be self-contained and cover one concept, process, or reference. Return JSON with an array of articles.`,
        },
        {
          role: "user",
          content: `Extract knowledge articles from this document (filename: ${filename}):\n\n${content.substring(0, 15000)}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "extracted_articles",
          strict: true,
          schema: {
            type: "object",
            properties: {
              articles: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    category: { type: "string" },
                    subcategory: { type: "string" },
                    content: { type: "string" },
                    contentType: { type: "string", enum: ["process", "concept", "reference", "template", "faq", "policy", "guide"] },
                  },
                  required: ["title", "category", "content", "contentType", "subcategory"],
                  additionalProperties: false,
                },
              },
            },
            required: ["articles"],
            additionalProperties: false,
          },
        },
      },
    });

    const parsed = JSON.parse(typeof resp.choices?.[0]?.message?.content === "string" ? resp.choices[0].message.content : "{}");
    const db = (await getDb())!;
    let created = 0;

    for (const article of parsed.articles ?? []) {
      await db.insert(knowledgeArticles).values({
        category: article.category,
        subcategory: article.subcategory || null,
        title: article.title,
        content: article.content,
        contentType: article.contentType || "concept",
        source: "ingested",
        sourceUrl: null,
      });
      created++;
    }

    await updateJob(jobId, { status: "completed" as any, articlesCreated: created, completedAt: new Date() });
    return { success: true, articlesCreated: created };
  } catch (err: any) {
    await updateJob(jobId, { status: "failed" as any, error: err.message, completedAt: new Date() });
    return { success: false, error: err.message };
  }
}

// ─── Conversation Mining ─────────────────────────────────────────────────
export async function mineConversation(jobId: number, messages: Array<{ role: string; content: string }>) {
  await updateJob(jobId, { status: "processing" as any, startedAt: new Date() });

  try {
    const conversationText = messages.map(m => `${m.role}: ${m.content}`).join("\n");

    const resp = await contextualLLM({ userId: null, contextType: "ingestion",
      messages: [
        {
          role: "system",
          content: `You are a knowledge extractor. Given a conversation, identify any reusable knowledge, insights, or patterns that should be saved as knowledge articles. Only extract genuinely useful information, not trivial exchanges. Return JSON.`,
        },
        {
          role: "user",
          content: `Extract knowledge from this conversation:\n\n${conversationText.substring(0, 10000)}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "mined_knowledge",
          strict: true,
          schema: {
            type: "object",
            properties: {
              articles: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    category: { type: "string" },
                    content: { type: "string" },
                    contentType: { type: "string", enum: ["concept", "faq", "process", "reference", "template", "policy", "guide"] },
                  },
                  required: ["title", "category", "content", "contentType"],
                  additionalProperties: false,
                },
              },
              shouldSave: { type: "boolean" },
            },
            required: ["articles", "shouldSave"],
            additionalProperties: false,
          },
        },
      },
    });

    const parsed = JSON.parse(typeof resp.choices?.[0]?.message?.content === "string" ? resp.choices[0].message.content : "{}");

    if (!parsed.shouldSave || !parsed.articles?.length) {
      await updateJob(jobId, { status: "completed" as any, articlesCreated: 0, completedAt: new Date() });
      return { success: true, articlesCreated: 0, reason: "No significant knowledge found" };
    }

    const db = (await getDb())!;
    let created = 0;
    for (const article of parsed.articles) {
      await db.insert(knowledgeArticles).values({
        category: article.category,
        subcategory: null,
        title: article.title,
        content: article.content,
        contentType: article.contentType || "concept",
        source: "conversation_mining",
      });
      created++;
    }

    await updateJob(jobId, { status: "completed" as any, articlesCreated: created, completedAt: new Date() });
    return { success: true, articlesCreated: created };
  } catch (err: any) {
    await updateJob(jobId, { status: "failed" as any, error: err.message, completedAt: new Date() });
    return { success: false, error: err.message };
  }
}

// ─── Template Seeding ────────────────────────────────────────────────────
export async function seedFromTemplate(articles: Array<{
  category: string; subcategory?: string; title: string; content: string;
  contentType: "process"|"concept"|"reference"|"template"|"faq"|"policy"|"guide";
}>) {
  const db = (await getDb())!;
  let created = 0;
  for (const a of articles) {
    await db.insert(knowledgeArticles).values({
      category: a.category,
      subcategory: a.subcategory ?? null,
      title: a.title,
      content: a.content,
      contentType: a.contentType,
      source: "manual",
    });
    created++;
  }
  return { created };
}

// ─── Ingestion Stats ─────────────────────────────────────────────────────
export async function getIngestionStats() {
  const db = (await getDb())!;
  const jobs = await db.select().from(knowledgeIngestionJobs);
  return {
    totalJobs: jobs.length,
    completed: jobs.filter(j => j.status === "completed").length,
    failed: jobs.filter(j => j.status === "failed").length,
    pending: jobs.filter(j => j.status === "pending").length,
    processing: jobs.filter(j => j.status === "processing").length,
    totalArticlesCreated: jobs.reduce((s, j) => s + j.articlesCreated, 0),
    totalArticlesUpdated: jobs.reduce((s, j) => s + j.articlesUpdated, 0),
  };
}
