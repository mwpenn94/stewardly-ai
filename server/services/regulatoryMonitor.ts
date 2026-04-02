/**
 * Task #31 — Regulatory Change Monitor Service
 * Ingests regulatory updates, auto-generates impact analyses,
 * manages versioned disclaimers, and produces weekly compliance briefs.
 */
import { getDb } from "../db";
import {
  regulatoryUpdates, disclaimerVersions, disclaimerAudit,
  regulatoryAlerts, regulatoryImpactAnalyses, complianceWeeklyBriefs,
} from "../../drizzle/schema";
import { eq, desc, sql, and, gte } from "drizzle-orm";
import { contextualLLM } from "../shared/stewardlyWiring";

// ─── Ingest Regulatory Update ────────────────────────────────────────────
export async function ingestRegulatoryUpdate(params: {
  source: string;
  title: string;
  summary?: string;
  categories?: string[];
  publishedAt?: Date;
}): Promise<{ id: number; relevanceScore: number; actionRequired: boolean }> {
  // Score relevance using keywords
  const relevanceKeywords = ["fiduciary", "suitability", "disclosure", "privacy", "ai", "robo-advisor", "finra", "sec", "cfpb", "dol"];
  const text = `${params.title} ${params.summary ?? ""}`.toLowerCase();
  const matchCount = relevanceKeywords.filter(k => text.includes(k)).length;
  const relevanceScore = Math.min(1.0, matchCount * 0.15 + 0.1);
  const actionRequired = relevanceScore >= 0.5;

  const db = await getDb(); if (!db) return null as any;
  const [result] = await db.insert(regulatoryUpdates).values({
    source: params.source,
    title: params.title,
    summary: params.summary,
    relevanceScore,
    categories: params.categories ?? [],
    actionRequired,
    publishedAt: params.publishedAt ?? new Date(),
  }).$returningId();

  // Auto-generate impact analysis for high-relevance updates
  if (relevanceScore >= 0.5) {
    await generateImpactAnalysis(result.id, params.title, params.summary ?? "");
  }

  return { id: result.id, relevanceScore, actionRequired };
}

// ─── Impact Analysis ─────────────────────────────────────────────────────
async function generateImpactAnalysis(updateId: number, title: string, summary: string): Promise<void> {
  try {
    const response = await contextualLLM({ userId: null, contextType: "compliance",
      messages: [
        {
          role: "system",
          content: `Analyze the regulatory update and return JSON with:
{"impactLevel": "high|medium|low", "affectedAreas": ["..."], "recommendedActions": ["..."]}`,
        },
        { role: "user", content: `Title: ${title}\nSummary: ${summary}` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "impact_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              impactLevel: { type: "string", enum: ["high", "medium", "low"] },
              affectedAreas: { type: "array", items: { type: "string" } },
              recommendedActions: { type: "array", items: { type: "string" } },
            },
            required: ["impactLevel", "affectedAreas", "recommendedActions"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    if (typeof content === "string") {
      const analysis = JSON.parse(content);
      const db = await getDb(); if (!db) return null as any;
      await db.insert(regulatoryImpactAnalyses).values({
        updateId,
        impactLevel: analysis.impactLevel,
        affectedAreas: analysis.affectedAreas,
        recommendedActions: analysis.recommendedActions,
      });
    }
  } catch {
    // Silently fail — impact analysis is best-effort
  }
}

// ─── Disclaimer Management ───────────────────────────────────────────────
export async function createDisclaimerVersion(topic: string, text: string): Promise<number> {
  const db = await getDb(); if (!db) return null as any;
  // Supersede previous version
  const [prev] = await db.select().from(disclaimerVersions)
    .where(eq(disclaimerVersions.topic, topic))
    .orderBy(desc(disclaimerVersions.version)).limit(1);

  const newVersion = (prev?.version ?? 0) + 1;
  const [result] = await db.insert(disclaimerVersions).values({
    topic,
    disclaimerText: text,
    version: newVersion,
  }).$returningId();

  if (prev) {
    await db.update(disclaimerVersions).set({ supersededBy: result.id }).where(eq(disclaimerVersions.id, prev.id));
  }

  return result.id;
}

export async function getCurrentDisclaimer(topic: string) {
  const db = await getDb(); if (!db) return null as any;
  const [disclaimer] = await db.select().from(disclaimerVersions)
    .where(and(eq(disclaimerVersions.topic, topic), sql`superseded_by IS NULL`))
    .orderBy(desc(disclaimerVersions.version)).limit(1);
  return disclaimer;
}

export async function logDisclaimerShown(conversationId: number, disclaimerId: number, version: number): Promise<void> {
  const db = await getDb(); if (!db) return null as any;
  await db.insert(disclaimerAudit).values({ conversationId, disclaimerId, disclaimerVersion: version });
}

// ─── Weekly Brief ────────────────────────────────────────────────────────
export async function generateWeeklyBrief(): Promise<number> {
  const db = await getDb(); if (!db) return null as any;
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const updates = await db.select().from(regulatoryUpdates)
    .where(gte(regulatoryUpdates.ingestedAt, weekAgo))
    .orderBy(desc(regulatoryUpdates.relevanceScore));

  const briefJson = {
    period: { start: weekAgo.toISOString(), end: new Date().toISOString() },
    totalUpdates: updates.length,
    highRelevance: updates.filter(u => (u.relevanceScore ?? 0) >= 0.5).length,
    actionRequired: updates.filter(u => u.actionRequired).length,
    topUpdates: updates.slice(0, 10).map(u => ({
      title: u.title,
      source: u.source,
      relevance: u.relevanceScore,
      actionRequired: u.actionRequired,
    })),
  };

  const [result] = await db.insert(complianceWeeklyBriefs).values({
    weekStart: weekAgo,
    briefJson,
  }).$returningId();

  return result.id;
}

// ─── Query Helpers ───────────────────────────────────────────────────────
export async function getRecentUpdates(limit = 20) {
  const db = await getDb(); if (!db) return null as any;
  return db.select().from(regulatoryUpdates).orderBy(desc(regulatoryUpdates.ingestedAt)).limit(limit);
}

export async function getImpactAnalyses(limit = 20) {
  const db = await getDb(); if (!db) return null as any;
  return db.select().from(regulatoryImpactAnalyses).orderBy(desc(regulatoryImpactAnalyses.generatedAt)).limit(limit);
}

export async function getWeeklyBriefs(limit = 10) {
  const db = await getDb(); if (!db) return null as any;
  return db.select().from(complianceWeeklyBriefs).orderBy(desc(complianceWeeklyBriefs.createdAt)).limit(limit);
}

export async function getAlerts(limit = 20) {
  const db = await getDb(); if (!db) return null as any;
  return db.select().from(regulatoryAlerts).orderBy(desc(regulatoryAlerts.createdAt)).limit(limit);
}
