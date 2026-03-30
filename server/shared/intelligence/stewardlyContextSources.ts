/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Stewardly Context Sources — ContextSourceRegistry Implementation
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Registers all 15 existing Stewardly data sources into the platform-agnostic
 * ContextSourceRegistry interface. This file is the bridge between the
 * reusable @platform/intelligence layer and Stewardly's specific data model.
 *
 * Data Sources (matching original deepContextAssembler order):
 *   1.  documents             — Enhanced TF-IDF document chunk retrieval
 *   2.  knowledgeBase         — Knowledge base article search
 *   3.  userProfile           — User profile & demographics
 *   4.  suitability           — Suitability assessment data
 *   5.  memory                — 3-tier memory engine (facts, preferences, episodes)
 *   6.  graph                 — Knowledge graph entities & relationships
 *   7.  pipelineData          — Government data pipelines (FRED, BLS, SEC, etc.)
 *   8.  conversationHistory   — Cross-conversation context
 *   9.  integrations          — Plaid, SnapTrade financial data
 *   10. calculators           — Calculator scenarios & financial models
 *   11. insights              — Proactive insights & engagement scores
 *   12. clientRelationships   — Advisor-client relationship data
 *   13. activityLog           — Notifications & recent activity
 *   14. tags                  — Document tag organization
 *   15. gapFeedback           — Knowledge gap analysis feedback
 */

import type { ContextSourceRegistry } from "./types";

// ── Stewardly-specific imports (original service locations) ──────────────────

import { getDb } from "../../db";
import {
  documents,
  documentChunks,
  userProfiles,
  suitabilityAssessments,
  conversations,
  messages as messagesTable,
  notificationLog,
  calculatorScenarios,
  proactiveInsights,
  documentTags,
  documentTagMap,
  knowledgeGapFeedback,
  knowledgeArticles,
  plaidHoldings,
  snapTradePositions,
  clientAssociations,
  enrichmentCache,
} from "../../../drizzle/schema";
import { eq, desc, like, or, inArray, and } from "drizzle-orm";

// ── Memory and graph use dynamic imports (ESM-compatible) ───────────────────

async function loadMemoryAssembler(): Promise<(userId: number) => Promise<string>> {
  try {
    const mod = await import("../../memoryEngine");
    return mod.assembleMemoryContext;
  } catch {
    return async () => "";
  }
}

async function loadGraphAssembler(): Promise<(userId: number) => Promise<string>> {
  try {
    // Knowledge graph may export assembleGraphContext
    const mod = await import("../../services/deepContextAssembler");
    // The graph context is assembled inside deepContextAssembler; we use
    // the dynamic import of the knowledge graph service directly if available.
    const graphMod = await import("../../services/knowledgeGraphDynamic").catch(() => null);
    if (graphMod?.assembleGraphContext) return graphMod.assembleGraphContext;
    return async () => "";
  } catch {
    return async () => "";
  }
}

// Lazy-loaded singletons
let _memoryFn: ((userId: number) => Promise<string>) | null = null;
let _graphFn: ((userId: number) => Promise<string>) | null = null;

async function getMemoryFn() {
  if (!_memoryFn) _memoryFn = await loadMemoryAssembler();
  return _memoryFn;
}

async function getGraphFn() {
  if (!_graphFn) _graphFn = await loadGraphAssembler();
  return _graphFn;
}

// ─── SOURCE IMPLEMENTATIONS ─────────────────────────────────────────────────

async function fetchDocumentContext(userId: number, query: string): Promise<string> {
  const db = await getDb();
  if (!db || !query) return "";

  try {
    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2);
    if (terms.length === 0) return "";

    const userDocs = await db
      .select({ id: documents.id, filename: documents.filename, category: documents.category })
      .from(documents)
      .where(eq(documents.userId, userId));

    if (userDocs.length === 0) return "";

    const docIds = userDocs.map((d) => d.id);
    const chunks = await db
      .select()
      .from(documentChunks)
      .where(inArray(documentChunks.documentId, docIds));

    if (chunks.length === 0) return "";

    // Score chunks by term overlap (TF-IDF-lite)
    const scored = chunks
      .map((chunk) => {
        const content = (chunk.content || "").toLowerCase();
        const hits = terms.filter((t) => content.includes(t)).length;
        return { chunk, score: hits / terms.length };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);

    if (scored.length === 0) return "";

    const docMap = new Map(userDocs.map((d) => [d.id, d]));
    return scored
      .map((s) => {
        const doc = docMap.get(s.chunk.documentId);
        return `[Source: "${doc?.filename ?? "unknown"}" (${doc?.category ?? "general"}), relevance: ${s.score.toFixed(1)}]\n${s.chunk.content}`;
      })
      .join("\n\n---\n\n");
  } catch {
    return "";
  }
}

async function fetchKnowledgeBaseContext(_userId: number, query: string): Promise<string> {
  // Knowledge base is global (not per-user), so userId is unused
  const db = await getDb();
  if (!db || !query) return "";

  try {
    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2)
      .slice(0, 5);

    if (terms.length === 0) return "";

    // Build OR conditions for title/content matching
    const conditions = terms.flatMap((t) => [
      like(knowledgeArticles.title, `%${t}%`),
      like(knowledgeArticles.content, `%${t}%`),
    ]);

    const articles = await db
      .select()
      .from(knowledgeArticles)
      .where(and(eq(knowledgeArticles.active, true), or(...conditions)))
      .limit(5);

    if (articles.length === 0) return "";

    return articles
      .map((a) => `[KB Article: "${a.title}" (${a.category}/${a.contentType})]\n${(a.content || "").slice(0, 800)}`)
      .join("\n\n");
  } catch {
    return "";
  }
}

async function fetchUserProfileContext(userId: number, _query: string): Promise<string> {
  const db = await getDb();
  if (!db) return "";

  try {
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    if (!profile) return "";

    // Match original deepContextAssembler's getUserProfileContext format
    const parts: string[] = ["User Profile:"];
    if (profile.age) parts.push(`- Age: ${profile.age}`);
    if (profile.jobTitle) parts.push(`- Job: ${profile.jobTitle}`);
    if (profile.incomeRange) parts.push(`- Income range: ${profile.incomeRange}`);
    if (profile.savingsRange) parts.push(`- Savings range: ${profile.savingsRange}`);
    if (profile.familySituation) parts.push(`- Family: ${profile.familySituation}`);
    if (profile.lifeStage) parts.push(`- Life stage: ${profile.lifeStage}`);
    if (profile.businessOwner) parts.push(`- Business owner: yes`);
    if (profile.goals) {
      const goals = Array.isArray(profile.goals) ? profile.goals : [];
      if (goals.length > 0) parts.push(`- Goals: ${goals.join(", ")}`);
    }

    return parts.length > 1 ? parts.join("\n") : "";
  } catch {
    return "";
  }
}

async function fetchSuitabilityContext(userId: number, _query: string): Promise<string> {
  const db = await getDb();
  if (!db) return "";

  try {
    const [assessment] = await db
      .select()
      .from(suitabilityAssessments)
      .where(eq(suitabilityAssessments.userId, userId))
      .orderBy(desc(suitabilityAssessments.createdAt))
      .limit(1);

    if (!assessment) return "";

    const parts: string[] = ["Suitability Profile:"];
    if (assessment.riskTolerance) parts.push(`- Risk tolerance: ${assessment.riskTolerance}`);
    if (assessment.investmentHorizon) parts.push(`- Investment horizon: ${assessment.investmentHorizon}`);
    if (assessment.annualIncome) parts.push(`- Annual income: ${assessment.annualIncome}`);
    if (assessment.netWorth) parts.push(`- Net worth: ${assessment.netWorth}`);
    if (assessment.investmentExperience) parts.push(`- Experience: ${assessment.investmentExperience}`);
    if (assessment.financialGoals) {
      const goals = Array.isArray(assessment.financialGoals) ? assessment.financialGoals : [];
      if (goals.length > 0) parts.push(`- Goals: ${goals.join(", ")}`);
    }

    return parts.length > 1 ? parts.join("\n") : "";
  } catch {
    return "";
  }
}

async function fetchMemoryContext(userId: number, _query: string): Promise<string> {
  try {
    const fn = await getMemoryFn();
    return await fn(userId);
  } catch {
    return "";
  }
}

async function fetchGraphContext(userId: number, _query: string): Promise<string> {
  try {
    const fn = await getGraphFn();
    return await fn(userId);
  } catch {
    return "";
  }
}

async function fetchPipelineDataContext(_userId: number, query: string): Promise<string> {
  const db = await getDb();
  if (!db) return "";

  try {
    // enrichmentCache stores government data pipeline results
    // Columns: providerSlug, lookupKey, lookupType, resultJson
    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2)
      .slice(0, 3);

    if (terms.length === 0) return "";

    const conditions = terms.map((t) =>
      or(
        like(enrichmentCache.providerSlug, `%${t}%`),
        like(enrichmentCache.lookupKey, `%${t}%`),
      ),
    );

    const cached = await db
      .select()
      .from(enrichmentCache)
      .where(or(...conditions))
      .limit(5);

    if (cached.length === 0) return "";

    return cached
      .map((c) => `[${c.providerSlug}/${c.lookupType}] ${JSON.stringify(c.resultJson).substring(0, 300)}`)
      .join("\n\n");
  } catch {
    return "";
  }
}

async function fetchConversationHistoryContext(userId: number, _query: string): Promise<string> {
  const db = await getDb();
  if (!db) return "";

  try {
    const recentConvos = await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.updatedAt))
      .limit(3);

    if (recentConvos.length === 0) return "";

    const parts: string[] = ["Recent conversations:"];
    for (const convo of recentConvos) {
      const msgs = await db
        .select()
        .from(messagesTable)
        .where(eq(messagesTable.conversationId, convo.id))
        .orderBy(desc(messagesTable.createdAt))
        .limit(4);

      if (msgs.length > 0) {
        parts.push(`  [${convo.title || "Untitled"}]:`);
        for (const msg of msgs.reverse()) {
          const role = msg.role === "user" ? "User" : "Steward";
          parts.push(`    ${role}: ${(msg.content || "").substring(0, 200)}`);
        }
      }
    }

    return parts.length > 1 ? parts.join("\n") : "";
  } catch {
    return "";
  }
}

async function fetchIntegrationContext(userId: number, _query: string): Promise<string> {
  const db = await getDb();
  if (!db) return "";

  try {
    const holdings = await db
      .select()
      .from(plaidHoldings)
      .where(eq(plaidHoldings.userId, userId))
      .limit(20);

    const positions = await db
      .select()
      .from(snapTradePositions)
      .where(eq(snapTradePositions.userId, userId))
      .limit(20);

    const parts: string[] = [];

    if (holdings.length > 0) {
      parts.push("Plaid Holdings:");
      for (const h of holdings.slice(0, 10)) {
        parts.push(`  ${h.securityName || h.tickerSymbol || "Unknown"}: ${h.quantity} units @ $${h.currentPrice}`);
      }
    }

    if (positions.length > 0) {
      parts.push("Brokerage Positions:");
      for (const p of positions.slice(0, 10)) {
        parts.push(`  ${p.symbol || "Unknown"}: ${p.units} units`);
      }
    }

    return parts.join("\n");
  } catch {
    return "";
  }
}

async function fetchCalculatorContext(userId: number, _query: string): Promise<string> {
  const db = await getDb();
  if (!db) return "";

  try {
    const scenarios = await db
      .select()
      .from(calculatorScenarios)
      .where(eq(calculatorScenarios.userId, userId))
      .orderBy(desc(calculatorScenarios.createdAt))
      .limit(5);

    if (scenarios.length === 0) return "";

    const parts: string[] = ["Saved calculator scenarios:"];
    for (const s of scenarios) {
      // Schema uses inputsJson and resultsJson (not inputs/results)
      parts.push(`  [${s.calculatorType}] ${s.name || "Unnamed"}: ${JSON.stringify(s.inputsJson).substring(0, 200)}`);
    }

    return parts.join("\n");
  } catch {
    return "";
  }
}

async function fetchInsightContext(userId: number, _query: string): Promise<string> {
  const db = await getDb();
  if (!db) return "";

  try {
    const insights = await db
      .select()
      .from(proactiveInsights)
      .where(eq(proactiveInsights.userId, userId))
      .orderBy(desc(proactiveInsights.createdAt))
      .limit(5);

    if (insights.length === 0) return "";

    const parts: string[] = ["Proactive insights:"];
    for (const i of insights) {
      parts.push(`  [${i.category}] ${i.title}: ${(i.description || "").substring(0, 200)}`);
    }

    return parts.join("\n");
  } catch {
    return "";
  }
}

async function fetchClientRelationshipContext(userId: number, _query: string): Promise<string> {
  const db = await getDb();
  if (!db) return "";

  try {
    const associations = await db
      .select()
      .from(clientAssociations)
      .where(
        or(
          eq(clientAssociations.professionalId, userId),
          eq(clientAssociations.clientId, userId),
        ),
      )
      .limit(20);

    if (associations.length === 0) return "";

    const parts: string[] = ["Client relationships:"];
    for (const a of associations) {
      const role = a.professionalId === userId ? "Client" : "Advisor";
      parts.push(`  ${role} #${a.professionalId === userId ? a.clientId : a.professionalId} (${a.status || "active"})`);
    }

    return parts.join("\n");
  } catch {
    return "";
  }
}

async function fetchActivityLogContext(userId: number, _query: string): Promise<string> {
  const db = await getDb();
  if (!db) return "";

  try {
    const recent = await db
      .select()
      .from(notificationLog)
      .where(eq(notificationLog.userId, userId))
      .orderBy(desc(notificationLog.createdAt))
      .limit(10);

    if (recent.length === 0) return "";

    const parts: string[] = ["Recent activity:"];
    for (const n of recent) {
      parts.push(`  [${n.type}] ${n.title || "Activity"}`);
    }

    return parts.join("\n");
  } catch {
    return "";
  }
}

async function fetchTagContext(userId: number, _query: string): Promise<string> {
  const db = await getDb();
  if (!db) return "";

  try {
    // Get user's document tags and their document associations
    const tags = await db
      .select()
      .from(documentTags)
      .where(eq(documentTags.userId, userId));

    if (tags.length === 0) return "";

    const tagIds = tags.map((t) => t.id);
    const tagMaps = await db
      .select()
      .from(documentTagMap)
      .where(inArray(documentTagMap.tagId, tagIds));

    // Count documents per tag
    const tagDocCounts = new Map<number, number>();
    for (const tm of tagMaps) {
      tagDocCounts.set(tm.tagId, (tagDocCounts.get(tm.tagId) || 0) + 1);
    }

    const parts: string[] = ["Document organization:"];
    for (const tag of tags) {
      const count = tagDocCounts.get(tag.id) || 0;
      parts.push(`  ${tag.name}: ${count} document(s)${tag.isAiGenerated ? " (AI-generated)" : ""}`);
    }

    return parts.length > 1 ? parts.join("\n") : "";
  } catch {
    return "";
  }
}

async function fetchGapFeedbackContext(userId: number, _query: string): Promise<string> {
  const db = await getDb();
  if (!db) return "";

  try {
    const gaps = await db
      .select()
      .from(knowledgeGapFeedback)
      .where(eq(knowledgeGapFeedback.userId, userId))
      .orderBy(desc(knowledgeGapFeedback.createdAt))
      .limit(10);

    if (gaps.length === 0) return "";

    const parts: string[] = ["Knowledge gaps identified:"];
    for (const g of gaps) {
      parts.push(`  [${g.gapCategory || "general"}] ${g.gapTitle}: ${g.action}${g.userNote ? ` — ${g.userNote}` : ""}`);
    }

    return parts.join("\n");
  } catch {
    return "";
  }
}

// ─── REGISTRY ASSEMBLY ──────────────────────────────────────────────────────

/**
 * The complete Stewardly context source registry.
 * All 15 sources registered with the platform-agnostic interface.
 *
 * The 15 sources map to the original deepContextAssembler's data sources:
 *   1. documents, 2. knowledgeBase, 3. userProfile, 4. suitability,
 *   5. memory, 6. graph, 7. pipelineData, 8. conversationHistory,
 *   9. integrations, 10. calculators, 11. insights,
 *   12. clientRelationships, 13. activityLog, 14. tags, 15. gapFeedback
 */
export const stewardlyContextSources: ContextSourceRegistry = {
  documents: fetchDocumentContext,
  knowledgeBase: fetchKnowledgeBaseContext,
  userProfile: fetchUserProfileContext,
  suitability: fetchSuitabilityContext,
  memory: fetchMemoryContext,
  graph: fetchGraphContext,
  pipelineData: fetchPipelineDataContext,
  conversationHistory: fetchConversationHistoryContext,
  integrations: fetchIntegrationContext,
  calculators: fetchCalculatorContext,
  insights: fetchInsightContext,
  clientRelationships: fetchClientRelationshipContext,
  activityLog: fetchActivityLogContext,
  tags: fetchTagContext,
  gapFeedback: fetchGapFeedbackContext,
};

export default stewardlyContextSources;
