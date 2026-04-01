/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ATLAS Context Sources — ContextSourceRegistry Implementation
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Registers all context data sources for the ATLAS AI kernel into the
 * platform-agnostic ContextSourceRegistry interface. This file bridges
 * the reusable @platform/intelligence layer to ATLAS's specific data model.
 *
 * Sources include the AEGIS baseline (matching Stewardly's 15 sources)
 * PLUS ATLAS-specific sources:
 *
 *   AEGIS Baseline (15 sources):
 *     1.  documents             — Enhanced TF-IDF document chunk retrieval
 *     2.  knowledgeBase         — Knowledge base article search
 *     3.  userProfile           — User profile & demographics
 *     4.  suitability           — Suitability assessment data
 *     5.  memory                — 3-tier memory engine (facts, preferences, episodes)
 *     6.  graph                 — Knowledge graph entities & relationships
 *     7.  pipelineData          — Government data pipelines (FRED, BLS, SEC, etc.)
 *     8.  conversationHistory   — Cross-conversation context
 *     9.  integrations          — Plaid, SnapTrade financial data
 *     10. calculators           — Calculator scenarios & financial models
 *     11. insights              — Proactive insights & engagement scores
 *     12. clientRelationships   — Advisor-client relationship data
 *     13. activityLog           — Notifications & recent activity
 *     14. tags                  — Document tag organization
 *     15. gapFeedback           — Knowledge gap analysis feedback
 *
 *   ATLAS Kernel Sources (8 additional):
 *     16. goalsAndPlans         — Goals + plans + tasks (ATLAS kernel)
 *     17. scheduledGoals        — Recurring goal definitions & schedules
 *     18. playgroundRuns        — Experimentation history (agent runs)
 *     19. playgroundPresets     — Saved experimentation presets/templates
 *     20. webhookLogs           — External event ingestion logs
 *     21. passiveActionLogs     — Background automation execution history
 *     22. autonomyProfile       — Graduated autonomy state & trust scores
 *     23. responseQuality       — AI response quality metrics & trends
 *
 * TiDB Coercion (Training System P-02):
 *   All numeric fields from aggregate queries and decimal columns are
 *   coerced at the DB boundary via coerceNumericFields/coerceNumeric
 *   from ./dbCoercion.ts — never ad-hoc in business logic.
 */

import type { ContextSourceRegistry, SourceFetchOptions } from "./types";
import { coerceNumeric, coerceNumericFields, coerceNumericFieldsBatch } from "./dbCoercion";

// ── Database & Schema imports ─────────────────────────────────────────────────

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
  // ATLAS Kernel tables
  tasks,
  planAdherence,
  integrationWebhookEvents,
  passiveActionLog,
  agentAutonomyLevels,
  agentTemplates,
  agentPerformance,
  aiResponseQuality,
} from "../../../drizzle/schema";
import { eq, desc, like, or, inArray, and, gte, sql } from "drizzle-orm";

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

// ═══════════════════════════════════════════════════════════════════════════════
// AEGIS BASELINE SOURCES (1–15)
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchDocumentContext(userId: number, query: string, opts?: SourceFetchOptions): Promise<string> {
  if (!userId || userId <= 0) return "";
  const db = await getDb();
  if (!db || !query) return "";

  try {
    const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    if (terms.length === 0) return "";

    const conditions = [eq(documents.userId, userId)];
    if (opts?.category) {
      conditions.push(eq(documents.category, opts.category));
    }

    const userDocs = await db
      .select({ id: documents.id, filename: documents.filename, category: documents.category })
      .from(documents)
      .where(conditions.length > 1 ? and(...conditions) : conditions[0]);

    if (userDocs.length === 0) return "";

    let docIds = userDocs.map((d) => d.id);
    if (opts?.specificDocIds && opts.specificDocIds.length > 0) {
      const specificSet = new Set(opts.specificDocIds);
      docIds = [
        ...docIds.filter((id) => specificSet.has(id)),
        ...docIds.filter((id) => !specificSet.has(id)),
      ];
    }

    const chunks = await db
      .select()
      .from(documentChunks)
      .where(inArray(documentChunks.documentId, docIds));

    if (chunks.length === 0) return "";

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
  const db = await getDb();
  if (!db || !query) return "";

  try {
    const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2).slice(0, 5);
    if (terms.length === 0) return "";

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
    const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2).slice(0, 3);
    if (terms.length === 0) return "";

    const conditions = terms.map((t) =>
      or(
        like(enrichmentCache.providerSlug, `%${t}%`),
        like(enrichmentCache.lookupKey, `%${t}%`),
      ),
    );

    const results = await db
      .select()
      .from(enrichmentCache)
      .where(or(...conditions.flat().filter(Boolean) as any[]))
      .limit(5);

    if (results.length === 0) return "";

    return results
      .map((r) => {
        // P-02: coerce qualityScore at DB boundary
        const qs = coerceNumeric(r.qualityScore, 0);
        const data = typeof r.resultJson === "string" ? r.resultJson : JSON.stringify(r.resultJson);
        return `[Pipeline: ${r.providerSlug}/${r.lookupType} (quality: ${qs.toFixed(2)})]\n${data.slice(0, 500)}`;
      })
      .join("\n\n");
  } catch {
    return "";
  }
}

async function fetchConversationHistoryContext(userId: number, _query: string, opts?: SourceFetchOptions): Promise<string> {
  const db = await getDb();
  if (!db) return "";

  try {
    const convConditions = [eq(conversations.userId, userId)];

    const recentConvs = await db
      .select({ id: conversations.id, mode: conversations.mode })
      .from(conversations)
      .where(convConditions.length > 1 ? and(...convConditions) : convConditions[0])
      .orderBy(desc(conversations.updatedAt))
      .limit(5);

    if (recentConvs.length === 0) return "";

    // Exclude current conversation if provided
    const convIds = recentConvs
      .map((c) => c.id)
      .filter((id) => !opts?.conversationId || id !== opts.conversationId);

    if (convIds.length === 0) return "";

    const msgs = await db
      .select()
      .from(messagesTable)
      .where(inArray(messagesTable.conversationId, convIds))
      .orderBy(desc(messagesTable.createdAt))
      .limit(20);

    if (msgs.length === 0) return "";

    return "Recent conversation context:\n" +
      msgs
        .map((m) => `[${m.role}]: ${(m.content || "").slice(0, 200)}`)
        .join("\n");
  } catch {
    return "";
  }
}

async function fetchIntegrationContext(userId: number, _query: string): Promise<string> {
  const db = await getDb();
  if (!db) return "";

  try {
    const parts: string[] = [];

    const holdings = await db
      .select()
      .from(plaidHoldings)
      .where(eq(plaidHoldings.userId, userId))
      .limit(20);

    if (holdings.length > 0) {
      parts.push("Plaid Holdings:");
      for (const h of holdings) {
        // P-02: coerce numeric fields at DB boundary
        const qty = coerceNumeric(h.quantity, 0);
        const price = coerceNumeric(h.currentPrice, 0);
        const value = coerceNumeric(h.value, 0);
        parts.push(`  ${h.securityName || h.tickerSymbol || "Unknown"}: ${qty} shares @ $${price.toFixed(2)} = $${value.toFixed(2)}`);
      }
    }

    const positions = await db
      .select()
      .from(snapTradePositions)
      .where(eq(snapTradePositions.userId, userId))
      .limit(20);

    if (positions.length > 0) {
      parts.push("SnapTrade Positions:");
      for (const p of positions) {
        const qty = coerceNumeric(p.units, 0);
        const price = coerceNumeric(p.price, 0);
        parts.push(`  ${p.symbolDescription || p.symbol || "Unknown"}: ${qty} units @ $${price.toFixed(2)}`);
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

    return "Calculator Scenarios:\n" +
      scenarios
        .map((s) => {
          const inputs = typeof s.inputs === "string" ? s.inputs : JSON.stringify(s.inputs);
          const results = typeof s.results === "string" ? s.results : JSON.stringify(s.results);
          return `  [${s.calculatorType}] ${s.name || "Unnamed"}: inputs=${inputs.slice(0, 200)}, results=${results.slice(0, 200)}`;
        })
        .join("\n");
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
      .limit(10);

    if (insights.length === 0) return "";

    return "Proactive Insights:\n" +
      insights
        .map((i) => {
          // P-02: coerce confidence at DB boundary
          const confidence = coerceNumeric(i.confidence, 0);
          return `  [${i.category}/${i.priority}] ${i.title}: ${(i.description || "").slice(0, 200)} (confidence: ${confidence.toFixed(2)})`;
        })
        .join("\n");
  } catch {
    return "";
  }
}

async function fetchClientRelationshipContext(userId: number, _query: string): Promise<string> {
  const db = await getDb();
  if (!db) return "";

  try {
    const clients = await db
      .select()
      .from(clientAssociations)
      .where(eq(clientAssociations.professionalId, userId))
      .limit(20);

    if (clients.length === 0) return "";

    return "Client Relationships:\n" +
      clients
        .map((c) => `  Client #${c.clientId}: status=${c.status}, type=${c.relationshipType || "standard"}`)
        .join("\n");
  } catch {
    return "";
  }
}

async function fetchActivityLogContext(userId: number, _query: string): Promise<string> {
  const db = await getDb();
  if (!db) return "";

  try {
    const notifications = await db
      .select()
      .from(notificationLog)
      .where(eq(notificationLog.userId, userId))
      .orderBy(desc(notificationLog.createdAt))
      .limit(10);

    if (notifications.length === 0) return "";

    const parts: string[] = ["Recent Activity:"];
    for (const n of notifications) {
      parts.push(`  [${n.type}] ${n.title}: ${(n.message || "").slice(0, 150)}`);
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

// ═══════════════════════════════════════════════════════════════════════════════
// ATLAS KERNEL SOURCES (16–23)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Source 16: Goals + Plans + Tasks (ATLAS Kernel)
 * Combines tasks, plan adherence, and user profile goals into a unified
 * goals/plans/tasks context for the intelligence layer.
 */
async function fetchGoalsAndPlansContext(userId: number, _query: string): Promise<string> {
  if (!userId || userId <= 0) return "";
  const db = await getDb();
  if (!db) return "";

  try {
    const parts: string[] = [];

    // Active tasks
    const activeTasks = await db
      .select()
      .from(tasks)
      .where(and(
        eq(tasks.userId, userId),
        inArray(tasks.status, ["pending", "in_progress"]),
      ))
      .orderBy(desc(tasks.createdAt))
      .limit(15);

    if (activeTasks.length > 0) {
      parts.push("Active Tasks:");
      for (const t of activeTasks) {
        const due = t.dueDate ? ` (due: ${new Date(t.dueDate).toLocaleDateString()})` : "";
        parts.push(`  [${t.priority}/${t.category}] ${t.title}${due} — ${t.status}`);
      }
    }

    // Plan adherence scores
    const adherence = await db
      .select()
      .from(planAdherence)
      .where(eq(planAdherence.userId, userId))
      .orderBy(desc(planAdherence.updatedAt))
      .limit(10);

    if (adherence.length > 0) {
      parts.push("\nPlan Adherence:");
      for (const a of adherence) {
        // P-02: coerce decimal fields at DB boundary
        const coerced = coerceNumericFields(a, ["targetValue", "actualValue", "adherenceScore"]);
        parts.push(`  [${coerced.category}] target: ${coerced.targetValue}, actual: ${coerced.actualValue}, score: ${coerced.adherenceScore}/100, trend: ${coerced.trend}`);
      }
    }

    return parts.length > 0 ? parts.join("\n") : "";
  } catch {
    return "";
  }
}

/**
 * Source 17: Scheduled Goals (Recurring Definitions)
 * Surfaces recurring tasks as scheduled goal definitions.
 */
async function fetchScheduledGoalsContext(userId: number, _query: string): Promise<string> {
  if (!userId || userId <= 0) return "";
  const db = await getDb();
  if (!db) return "";

  try {
    const recurring = await db
      .select()
      .from(tasks)
      .where(and(
        eq(tasks.userId, userId),
        eq(tasks.recurring, true),
      ))
      .orderBy(desc(tasks.createdAt))
      .limit(10);

    if (recurring.length === 0) return "";

    const parts: string[] = ["Scheduled/Recurring Goals:"];
    for (const t of recurring) {
      parts.push(`  [${t.recurringInterval || "custom"}] ${t.title} — ${t.category}, priority: ${t.priority}`);
    }

    return parts.join("\n");
  } catch {
    return "";
  }
}

/**
 * Source 18: Playground Runs (Experimentation History)
 * Surfaces agent template execution history and performance metrics.
 */
async function fetchPlaygroundRunsContext(userId: number, _query: string): Promise<string> {
  const db = await getDb();
  if (!db) return "";

  try {
    // Agent performance records linked to templates
    const templates = await db
      .select({
        templateId: agentTemplates.id,
        templateName: agentTemplates.name,
        category: agentTemplates.category,
        runs: agentPerformance.runs,
        successes: agentPerformance.successes,
        avgDurationMs: agentPerformance.avgDurationMs,
        avgCostUsd: agentPerformance.avgCostUsd,
        avgSatisfactionScore: agentPerformance.avgSatisfactionScore,
      })
      .from(agentPerformance)
      .innerJoin(agentTemplates, eq(agentPerformance.agentTemplateId, agentTemplates.id))
      .limit(10);

    if (templates.length === 0) return "";

    const parts: string[] = ["Experimentation History (Agent Runs):"];
    for (const t of templates) {
      // P-02: coerce float aggregates at DB boundary
      const runs = coerceNumeric(t.runs, 0);
      const successes = coerceNumeric(t.successes, 0);
      const avgCost = coerceNumeric(t.avgCostUsd, 0);
      const avgSat = coerceNumeric(t.avgSatisfactionScore, 0);
      const successRate = runs > 0 ? ((successes / runs) * 100).toFixed(1) : "0.0";
      parts.push(`  [${t.category || "general"}] ${t.templateName}: ${runs} runs, ${successRate}% success, avg cost: $${avgCost.toFixed(3)}, satisfaction: ${avgSat.toFixed(2)}`);
    }

    return parts.join("\n");
  } catch {
    return "";
  }
}

/**
 * Source 19: Playground Presets (Saved Experimentation Templates)
 * Surfaces available agent templates as experimentation presets.
 */
async function fetchPlaygroundPresetsContext(_userId: number, query: string): Promise<string> {
  const db = await getDb();
  if (!db) return "";

  try {
    const allTemplates = await db
      .select()
      .from(agentTemplates)
      .limit(15);

    if (allTemplates.length === 0) return "";

    const parts: string[] = ["Available Experimentation Presets:"];
    for (const t of allTemplates) {
      const steps = t.stepsJson ? (Array.isArray(t.stepsJson) ? t.stepsJson.length : 0) : 0;
      parts.push(`  [${t.category || "general"}] ${t.name}: ${(t.description || "").slice(0, 100)} (${steps} steps${t.isBuiltIn ? ", built-in" : ""})`);
    }

    return parts.join("\n");
  } catch {
    return "";
  }
}

/**
 * Source 20: Webhook Logs (External Events)
 * Surfaces recent external webhook events for context.
 */
async function fetchWebhookLogsContext(_userId: number, _query: string): Promise<string> {
  const db = await getDb();
  if (!db) return "";

  try {
    const events = await db
      .select()
      .from(integrationWebhookEvents)
      .orderBy(desc(integrationWebhookEvents.receivedAt))
      .limit(10);

    if (events.length === 0) return "";

    const parts: string[] = ["Recent Webhook Events:"];
    for (const e of events) {
      parts.push(`  [${e.providerSlug}/${e.eventType}] status: ${e.processingStatus}, valid: ${e.signatureValid}${e.processingError ? ` — error: ${e.processingError.slice(0, 80)}` : ""}`);
    }

    return parts.join("\n");
  } catch {
    return "";
  }
}

/**
 * Source 21: Passive Action Logs (Background Automation)
 * Surfaces recent passive/background automation execution results.
 */
async function fetchPassiveActionLogsContext(userId: number, _query: string): Promise<string> {
  if (!userId || userId <= 0) return "";
  const db = await getDb();
  if (!db) return "";

  try {
    const logs = await db
      .select()
      .from(passiveActionLog)
      .where(eq(passiveActionLog.userId, userId))
      .orderBy(desc(passiveActionLog.executedAt))
      .limit(15);

    if (logs.length === 0) return "";

    const parts: string[] = ["Passive Action History:"];
    for (const l of logs) {
      // P-02: coerce numeric fields at DB boundary
      const records = coerceNumeric(l.recordsAffected, 0);
      const duration = coerceNumeric(l.durationMs, 0);
      parts.push(`  [${l.source}/${l.actionType}] ${l.status}: ${records} records, ${duration}ms${l.errorMessage ? ` — ${l.errorMessage.slice(0, 80)}` : ""}`);
    }

    return parts.join("\n");
  } catch {
    return "";
  }
}

/**
 * Source 22: Autonomy Profile (Graduated Autonomy State)
 * Surfaces the user's graduated autonomy level and trust metrics.
 */
async function fetchAutonomyProfileContext(userId: number, _query: string): Promise<string> {
  if (!userId || userId <= 0) return "";
  const db = await getDb();
  if (!db) return "";

  try {
    // Get autonomy levels for agent templates
    const levels = await db
      .select({
        templateName: agentTemplates.name,
        currentLevel: agentAutonomyLevels.currentLevel,
        level1Runs: agentAutonomyLevels.level1Runs,
        level2Runs: agentAutonomyLevels.level2Runs,
        promotedAt: agentAutonomyLevels.promotedAt,
      })
      .from(agentAutonomyLevels)
      .innerJoin(agentTemplates, eq(agentAutonomyLevels.agentTemplateId, agentTemplates.id))
      .limit(10);

    if (levels.length === 0) return "";

    const parts: string[] = ["Graduated Autonomy Profile:"];
    for (const l of levels) {
      const level = coerceNumeric(l.currentLevel, 1);
      const l1 = coerceNumeric(l.level1Runs, 0);
      const l2 = coerceNumeric(l.level2Runs, 0);
      const promoted = l.promotedAt ? ` (promoted: ${new Date(l.promotedAt).toLocaleDateString()})` : "";
      parts.push(`  ${l.templateName}: level ${level}, L1 runs: ${l1}, L2 runs: ${l2}${promoted}`);
    }

    return parts.join("\n");
  } catch {
    return "";
  }
}

/**
 * Source 23: Response Quality (AI Response Quality Metrics)
 * Surfaces recent AI response quality trends for self-improvement context.
 */
async function fetchResponseQualityContext(userId: number, _query: string): Promise<string> {
  if (!userId || userId <= 0) return "";
  const db = await getDb();
  if (!db) return "";

  try {
    const quality = await db
      .select()
      .from(aiResponseQuality)
      .where(eq(aiResponseQuality.userId, userId))
      .orderBy(desc(aiResponseQuality.createdAt))
      .limit(20);

    if (quality.length === 0) return "";

    // P-02: coerce all numeric fields at DB boundary
    const coerced = coerceNumericFieldsBatch(quality as any[], [
      "disclaimerCount", "toolCallsAttempted", "toolCallsCompleted",
      "retryCount", "latencyMs",
    ]);

    // Compute aggregate stats
    const totalResponses = coerced.length;
    const emptyCount = coerced.filter((q: any) => q.responseEmpty).length;
    const avgLatency = coerced.reduce((sum: number, q: any) => sum + (q.latencyMs || 0), 0) / totalResponses;
    const avgRetries = coerced.reduce((sum: number, q: any) => sum + (q.retryCount || 0), 0) / totalResponses;
    const toolSuccessRate = (() => {
      const attempted = coerced.reduce((sum: number, q: any) => sum + (q.toolCallsAttempted || 0), 0);
      const completed = coerced.reduce((sum: number, q: any) => sum + (q.toolCallsCompleted || 0), 0);
      return attempted > 0 ? ((completed / attempted) * 100).toFixed(1) : "N/A";
    })();

    return [
      "AI Response Quality (recent trend):",
      `  Responses analyzed: ${totalResponses}`,
      `  Empty response rate: ${((emptyCount / totalResponses) * 100).toFixed(1)}%`,
      `  Avg latency: ${avgLatency.toFixed(0)}ms`,
      `  Avg retries: ${avgRetries.toFixed(2)}`,
      `  Tool call success rate: ${toolSuccessRate}%`,
    ].join("\n");
  } catch {
    return "";
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGISTRY ASSEMBLY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * The complete ATLAS context source registry.
 * 23 sources: 15 AEGIS baseline + 8 ATLAS kernel.
 */
export const atlasContextSources: ContextSourceRegistry = {
  // AEGIS Baseline (1–15)
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
  // ATLAS Kernel (16–23)
  goalsAndPlans: fetchGoalsAndPlansContext,
  scheduledGoals: fetchScheduledGoalsContext,
  playgroundRuns: fetchPlaygroundRunsContext,
  playgroundPresets: fetchPlaygroundPresetsContext,
  webhookLogs: fetchWebhookLogsContext,
  passiveActionLogs: fetchPassiveActionLogsContext,
  autonomyProfile: fetchAutonomyProfileContext,
  responseQuality: fetchResponseQualityContext,
};

export default atlasContextSources;
