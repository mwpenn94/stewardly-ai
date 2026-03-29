/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DEEP CONTEXT ASSEMBLER — Unified Intelligence Layer
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Central nervous system for all AI context across the platform.
 * Every LLM invocation should pull context through this assembler
 * to ensure consistent, deep, data-rich intelligence.
 *
 * Data Sources:
 *   1. Document Chunks (enhanced TF-IDF retrieval)
 *   2. Knowledge Base Articles
 *   3. User Profile & Suitability
 *   4. Memory Engine (working + episodic + semantic)
 *   5. Knowledge Graph entities & relationships
 *   6. Pipeline Data (FRED, BLS, SEC, BEA, Census, FINRA)
 *   7. Conversation History (cross-conversation context)
 *   8. Integration Data (Plaid, SnapTrade, CRM)
 *   9. Calculator Scenarios & Financial Models
 *  10. Proactive Insights & Engagement Scores
 *  11. Document Tags & Categories
 *  12. Notifications & Activity Log
 *  13. Client Relationships (for advisors)
 *  14. Gap Analysis Feedback
 */

import { getDb } from "../db";
import {
  documents, documentChunks, userProfiles, suitabilityAssessments,
  conversations, messages, notificationLog, calculatorScenarios,
  proactiveInsights, documentTags, documentTagMap, knowledgeGapFeedback,
  knowledgeArticles, plaidHoldings, snapTradeAccounts, snapTradePositions,
  integrationConnections, integrationProviders, clientAssociations,
  enrichmentCache,
} from "../../drizzle/schema";
import { eq, and, desc, like, or, inArray, sql, gte } from "drizzle-orm";
import { assembleMemoryContext } from "../memoryEngine";
import { assembleGraphContext } from "../knowledgeGraph";

// ─── TYPES ────────────────────────────────────────────────────────────

export interface ContextRequest {
  userId: number;
  query: string;               // The user's message or the task description
  contextType: ContextType;    // What kind of context assembly is needed
  maxTokenBudget?: number;     // Approximate token budget for context (default 8000)
  includeFinancialData?: boolean;
  includeConversationHistory?: boolean;
  includePipelineData?: boolean;
  includeDocuments?: boolean;
  includeKnowledgeBase?: boolean;
  includeMemories?: boolean;
  includeIntegrations?: boolean;
  includeCalculators?: boolean;
  includeInsights?: boolean;
  includeClientData?: boolean;
  includeActivityLog?: boolean;
  conversationId?: number;     // Current conversation for history context
  specificDocIds?: number[];   // Force-include specific documents
  category?: string;           // Filter documents by category
}

export type ContextType =
  | "chat"                // Full context for conversational AI
  | "analysis"            // Deep analysis (improvement engine, insights)
  | "recommendation"      // Advisor matching, product recommendations
  | "compliance"          // Content review, bias detection
  | "meeting"             // Meeting prep and summary
  | "passive"             // Background intelligence (passive actions)
  | "gap_analysis"        // Knowledge gap detection
  | "suitability"         // Suitability assessment analysis
  | "discovery"           // Self-discovery / continuous learning
  | "agentic"             // Tool-use planning (agentic execution)
  | "anonymous"           // Pre-auth context (limited)
  | "ingestion";          // Data ingestion / processing

export interface AssembledContext {
  documentContext: string;
  knowledgeBaseContext: string;
  userProfileContext: string;
  suitabilityContext: string;
  memoryContext: string;
  graphContext: string;
  pipelineDataContext: string;
  conversationContext: string;
  integrationContext: string;
  calculatorContext: string;
  insightContext: string;
  clientContext: string;
  activityContext: string;
  tagContext: string;
  gapFeedbackContext: string;

  // Merged prompt fragment ready for injection
  fullContextPrompt: string;

  // Metadata for confidence scoring
  sourcesUsed: string[];
  totalChunksRetrieved: number;
  retrievalQuality: "high" | "medium" | "low";
}

// ─── ENHANCED DOCUMENT RETRIEVAL (TF-IDF style) ──────────────────────

/**
 * Enhanced document chunk retrieval with TF-IDF-inspired scoring.
 * Scores each chunk based on:
 *   - Term frequency (how many query terms appear)
 *   - Inverse document frequency (rarer terms score higher)
 *   - Proximity bonus (terms appearing close together)
 *   - Exact phrase match bonus
 *   - Category relevance bonus
 */
export async function enhancedSearchChunks(
  userId: number,
  query: string,
  opts?: { category?: string; limit?: number; specificDocIds?: number[] }
): Promise<Array<{ content: string; filename: string; category: string; score: number; docId: number; chunkIndex: number }>> {
  const db = await getDb();
  if (!db) return [];

  const limit = opts?.limit ?? 15;

  // Tokenize query: remove stop words, extract meaningful terms
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "must", "ought",
    "i", "me", "my", "we", "our", "you", "your", "he", "she", "it",
    "they", "them", "their", "this", "that", "these", "those", "what",
    "which", "who", "whom", "where", "when", "how", "why", "if", "then",
    "and", "but", "or", "nor", "not", "no", "so", "for", "to", "from",
    "in", "on", "at", "by", "with", "about", "of", "up", "out", "off",
    "into", "over", "after", "before", "between", "under", "above",
    "just", "also", "very", "too", "quite", "really", "only", "even",
  ]);

  const queryTerms = query.toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  if (queryTerms.length === 0) return [];

  // Build conditions
  const conditions: any[] = [eq(documentChunks.userId, userId)];
  if (opts?.category) {
    conditions.push(eq(documentChunks.category, opts.category as any));
  }

  // If specific doc IDs requested, include them
  if (opts?.specificDocIds && opts.specificDocIds.length > 0) {
    conditions.push(
      or(
        ...queryTerms.slice(0, 5).map(t => like(documentChunks.content, `%${t}%`)),
        inArray(documentChunks.documentId, opts.specificDocIds)
      )
    );
  } else {
    // Pre-filter: at least one query term must appear (SQL-level filtering)
    conditions.push(
      or(...queryTerms.slice(0, 8).map(t => like(documentChunks.content, `%${t}%`)))
    );
  }

  // Fetch candidate chunks (wider net for better scoring)
  const candidates = await db.select({
    content: documentChunks.content,
    category: documentChunks.category,
    docId: documentChunks.documentId,
    chunkIndex: documentChunks.chunkIndex,
  }).from(documentChunks)
    .where(and(...conditions))
    .limit(200);

  // Get document filenames for citation
  const docIds = [...new Set(candidates.map(c => c.docId))];
  let docMap: Record<number, string> = {};
  if (docIds.length > 0) {
    const docs = await db.select({ id: documents.id, filename: documents.filename })
      .from(documents)
      .where(inArray(documents.id, docIds));
    docMap = Object.fromEntries(docs.map(d => [d.id, d.filename]));
  }

  // Count total chunks for IDF calculation
  const totalChunks = candidates.length || 1;

  // Calculate IDF for each term
  const termDocFreq: Record<string, number> = {};
  for (const term of queryTerms) {
    termDocFreq[term] = candidates.filter(c =>
      c.content.toLowerCase().includes(term)
    ).length;
  }

  // Score each chunk
  const queryLower = query.toLowerCase();
  const scored = candidates.map(chunk => {
    const textLower = chunk.content.toLowerCase();
    let score = 0;

    // 1. TF-IDF scoring
    for (const term of queryTerms) {
      if (textLower.includes(term)) {
        const tf = (textLower.split(term).length - 1) / (textLower.split(/\s+/).length || 1);
        const idf = Math.log(totalChunks / (termDocFreq[term] || 1));
        score += tf * idf;
      }
    }

    // 2. Term coverage bonus (what % of query terms appear)
    const matchedTerms = queryTerms.filter(t => textLower.includes(t));
    const coverage = matchedTerms.length / queryTerms.length;
    score += coverage * 3;

    // 3. Exact phrase match bonus (huge boost)
    if (textLower.includes(queryLower)) {
      score += 10;
    }

    // 4. Bigram match bonus (consecutive query terms)
    for (let i = 0; i < queryTerms.length - 1; i++) {
      const bigram = `${queryTerms[i]} ${queryTerms[i + 1]}`;
      if (textLower.includes(bigram)) {
        score += 2;
      }
    }

    // 5. Proximity bonus: terms appearing within 50 chars of each other
    if (matchedTerms.length >= 2) {
      const positions = matchedTerms.map(t => textLower.indexOf(t));
      const sorted = positions.sort((a, b) => a - b);
      const maxGap = sorted[sorted.length - 1] - sorted[0];
      if (maxGap < 100) score += 2;
      if (maxGap < 50) score += 2;
    }

    // 6. Specific doc ID boost
    if (opts?.specificDocIds?.includes(chunk.docId)) {
      score += 5;
    }

    return {
      content: chunk.content,
      filename: docMap[chunk.docId] || "Unknown",
      category: chunk.category || "unknown",
      score,
      docId: chunk.docId,
      chunkIndex: chunk.chunkIndex,
    };
  });

  // Sort by score, deduplicate by content similarity, take top N
  return scored
    .filter(c => c.score > 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ─── CONTEXT ASSEMBLY PRESETS ─────────────────────────────────────────

const CONTEXT_PRESETS: Record<ContextType, Partial<ContextRequest>> = {
  chat: {
    includeDocuments: true,
    includeKnowledgeBase: true,
    includeMemories: true,
    includeFinancialData: true,
    includeConversationHistory: true,
    includePipelineData: true,
    includeIntegrations: true,
    includeCalculators: true,
    includeInsights: true,
    includeClientData: true,
    includeActivityLog: true,
    maxTokenBudget: 10000,
  },
  analysis: {
    includeDocuments: true,
    includeKnowledgeBase: true,
    includeMemories: true,
    includeFinancialData: true,
    includePipelineData: true,
    includeIntegrations: true,
    includeInsights: true,
    includeClientData: true,
    maxTokenBudget: 8000,
  },
  recommendation: {
    includeDocuments: true,
    includeKnowledgeBase: true,
    includeFinancialData: true,
    includeInsights: true,
    includeClientData: true,
    maxTokenBudget: 6000,
  },
  compliance: {
    includeDocuments: true,
    includeKnowledgeBase: true,
    includeFinancialData: false,
    maxTokenBudget: 4000,
  },
  meeting: {
    includeDocuments: true,
    includeMemories: true,
    includeConversationHistory: true,
    includeClientData: true,
    includeInsights: true,
    maxTokenBudget: 6000,
  },
  passive: {
    includeDocuments: true,
    includeKnowledgeBase: true,
    includeMemories: true,
    includeFinancialData: true,
    includePipelineData: true,
    includeInsights: true,
    maxTokenBudget: 6000,
  },
  gap_analysis: {
    includeDocuments: true,
    includeKnowledgeBase: true,
    includeMemories: true,
    maxTokenBudget: 5000,
  },
  suitability: {
    includeDocuments: true,
    includeFinancialData: true,
    includeMemories: true,
    includeIntegrations: true,
    maxTokenBudget: 6000,
  },
  discovery: {
    includeDocuments: true,
    includeKnowledgeBase: true,
    includeMemories: true,
    includeConversationHistory: true,
    includeInsights: true,
    maxTokenBudget: 6000,
  },
  agentic: {
    includeDocuments: true,
    includeKnowledgeBase: true,
    includeFinancialData: true,
    includeIntegrations: true,
    includeCalculators: true,
    maxTokenBudget: 8000,
  },
  anonymous: {
    includeKnowledgeBase: true,
    includePipelineData: true,
    maxTokenBudget: 3000,
  },
  ingestion: {
    includeKnowledgeBase: true,
    maxTokenBudget: 2000,
  },
};

// ─── MAIN ASSEMBLER ──────────────────────────────────────────────────

export async function assembleDeepContext(request: ContextRequest): Promise<AssembledContext> {
  const preset = CONTEXT_PRESETS[request.contextType] || {};
  const config = { ...preset, ...request };
  const sourcesUsed: string[] = [];
  let totalChunksRetrieved = 0;

  // Run all context retrievals in parallel for speed
  const [
    docResult,
    kbResult,
    profileResult,
    suitabilityResult,
    memoryResult,
    graphResult,
    pipelineResult,
    conversationResult,
    integrationResult,
    calculatorResult,
    insightResult,
    clientResult,
    activityResult,
    tagResult,
    gapResult,
  ] = await Promise.allSettled([
    // 1. Document chunks (enhanced retrieval)
    config.includeDocuments !== false
      ? enhancedSearchChunks(config.userId, config.query, {
          category: config.category,
          limit: 15,
          specificDocIds: config.specificDocIds,
        })
      : Promise.resolve([]),

    // 2. Knowledge base articles
    config.includeKnowledgeBase !== false
      ? searchKBArticles(config.query, 5)
      : Promise.resolve(""),

    // 3. User profile
    config.includeFinancialData !== false
      ? getUserProfileContext(config.userId)
      : Promise.resolve(""),

    // 4. Suitability assessment
    config.includeFinancialData !== false
      ? getSuitabilityContext(config.userId)
      : Promise.resolve(""),

    // 5. Memory engine
    config.includeMemories !== false
      ? assembleMemoryContext(config.userId).catch(() => "")
      : Promise.resolve(""),

    // 6. Knowledge graph
    config.includeMemories !== false
      ? assembleGraphContext(config.userId).catch(() => "")
      : Promise.resolve(""),

    // 7. Pipeline data (economic indicators)
    config.includePipelineData !== false
      ? getPipelineDataContext()
      : Promise.resolve(""),

    // 8. Conversation history (cross-conversation)
    config.includeConversationHistory !== false
      ? getRecentConversationContext(config.userId, config.conversationId)
      : Promise.resolve(""),

    // 9. Integration data (Plaid, SnapTrade, etc.)
    config.includeIntegrations !== false
      ? getIntegrationDataContext(config.userId)
      : Promise.resolve(""),

    // 10. Calculator scenarios
    config.includeCalculators !== false
      ? getCalculatorContext(config.userId)
      : Promise.resolve(""),

    // 11. Proactive insights
    config.includeInsights !== false
      ? getProactiveInsightContext(config.userId)
      : Promise.resolve(""),

    // 12. Client relationships (for advisors)
    config.includeClientData !== false
      ? getClientRelationshipContext(config.userId)
      : Promise.resolve(""),

    // 13. Activity log
    config.includeActivityLog !== false
      ? getRecentActivityContext(config.userId)
      : Promise.resolve(""),

    // 14. Document tags
    config.includeDocuments !== false
      ? getDocumentTagContext(config.userId)
      : Promise.resolve(""),

    // 15. Gap analysis feedback
    config.includeDocuments !== false
      ? getGapFeedbackContext(config.userId)
      : Promise.resolve(""),
  ]);

  // Extract results with fallbacks
  const docChunks = docResult.status === "fulfilled" ? docResult.value : [];
  const documentContext = docChunks.length > 0
    ? docChunks.map((c, i) =>
        `[Source: "${c.filename}" (${c.category}), relevance: ${c.score.toFixed(1)}]\n${c.content}`
      ).join("\n\n---\n\n")
    : "";
  if (documentContext) { sourcesUsed.push("documents"); totalChunksRetrieved += docChunks.length; }

  const knowledgeBaseContext = kbResult.status === "fulfilled" ? kbResult.value as string : "";
  if (knowledgeBaseContext) sourcesUsed.push("knowledge_base");

  const userProfileContext = profileResult.status === "fulfilled" ? profileResult.value as string : "";
  if (userProfileContext) sourcesUsed.push("user_profile");

  const suitabilityContext = suitabilityResult.status === "fulfilled" ? suitabilityResult.value as string : "";
  if (suitabilityContext) sourcesUsed.push("suitability");

  const memoryContext = memoryResult.status === "fulfilled" ? memoryResult.value as string : "";
  if (memoryContext) sourcesUsed.push("memories");

  const graphContext = graphResult.status === "fulfilled" ? graphResult.value as string : "";
  if (graphContext) sourcesUsed.push("knowledge_graph");

  const pipelineDataContext = pipelineResult.status === "fulfilled" ? pipelineResult.value as string : "";
  if (pipelineDataContext) sourcesUsed.push("pipeline_data");

  const conversationContext = conversationResult.status === "fulfilled" ? conversationResult.value as string : "";
  if (conversationContext) sourcesUsed.push("conversation_history");

  const integrationContext = integrationResult.status === "fulfilled" ? integrationResult.value as string : "";
  if (integrationContext) sourcesUsed.push("integrations");

  const calculatorContext = calculatorResult.status === "fulfilled" ? calculatorResult.value as string : "";
  if (calculatorContext) sourcesUsed.push("calculators");

  const insightContext = insightResult.status === "fulfilled" ? insightResult.value as string : "";
  if (insightContext) sourcesUsed.push("insights");

  const clientContext = clientResult.status === "fulfilled" ? clientResult.value as string : "";
  if (clientContext) sourcesUsed.push("client_data");

  const activityContext = activityResult.status === "fulfilled" ? activityResult.value as string : "";
  if (activityContext) sourcesUsed.push("activity_log");

  const tagContext = tagResult.status === "fulfilled" ? tagResult.value as string : "";
  if (tagContext) sourcesUsed.push("document_tags");

  const gapFeedbackContext = gapResult.status === "fulfilled" ? gapResult.value as string : "";
  if (gapFeedbackContext) sourcesUsed.push("gap_feedback");

  // ── BUILD FULL CONTEXT PROMPT ────────────────────────────────────
  const sections: string[] = [];

  if (documentContext) {
    sections.push(`<document_knowledge>
IMPORTANT: The following are ACTUAL EXCERPTS from documents in the user's knowledge base. You MUST reference, quote, and cite these documents when answering. Always attribute information to the specific source document by name.

${documentContext}

When using this information:
- Quote specific passages when relevant
- Cite the source document by name (e.g., "According to your 'Client Strategy Guide'...")
- If multiple documents are relevant, synthesize across them
- If the documents don't contain relevant information for the question, say so honestly
</document_knowledge>`);
  }

  if (knowledgeBaseContext) {
    sections.push(`<knowledge_base_articles>
Platform knowledge articles relevant to this query:
${knowledgeBaseContext}
</knowledge_base_articles>`);
  }

  if (userProfileContext) {
    sections.push(`<user_profile>
${userProfileContext}
</user_profile>`);
  }

  if (suitabilityContext) {
    sections.push(`<suitability_data>
${suitabilityContext}
</suitability_data>`);
  }

  if (memoryContext) {
    sections.push(`<memories>
Key facts and learned context about this user:
${memoryContext}
</memories>`);
  }

  if (graphContext) {
    sections.push(`<knowledge_graph>
Entity relationships and connections:
${graphContext}
</knowledge_graph>`);
  }

  if (integrationContext) {
    sections.push(`<financial_accounts>
Real-time data from connected financial accounts:
${integrationContext}

Use this data to provide specific, personalized insights. Reference actual numbers and account details.
</financial_accounts>`);
  }

  if (calculatorContext) {
    sections.push(`<financial_models>
User's saved financial calculations and scenarios:
${calculatorContext}

Reference these when discussing financial planning. Note any assumptions that may need updating.
</financial_models>`);
  }

  if (pipelineDataContext) {
    sections.push(`<economic_data>
Current economic indicators and market data:
${pipelineDataContext}
</economic_data>`);
  }

  if (conversationContext) {
    sections.push(`<conversation_history>
Context from recent conversations (for continuity):
${conversationContext}
</conversation_history>`);
  }

  if (insightContext) {
    sections.push(`<proactive_insights>
AI-generated insights about this user:
${insightContext}
</proactive_insights>`);
  }

  if (clientContext) {
    sections.push(`<client_relationships>
${clientContext}
</client_relationships>`);
  }

  if (activityContext) {
    sections.push(`<recent_activity>
${activityContext}
</recent_activity>`);
  }

  if (tagContext) {
    sections.push(`<document_organization>
${tagContext}
</document_organization>`);
  }

  if (gapFeedbackContext) {
    sections.push(`<knowledge_gaps>
${gapFeedbackContext}
</knowledge_gaps>`);
  }

  // Citation instruction
  if (sourcesUsed.length > 0) {
    sections.push(`<citation_instructions>
You have access to ${sourcesUsed.length} data sources: ${sourcesUsed.join(", ")}.
${totalChunksRetrieved > 0 ? `${totalChunksRetrieved} document chunks were retrieved.` : ""}

CITATION RULES:
1. When referencing document content, ALWAYS cite the source: "According to [Document Name]..."
2. When referencing financial data, specify the source: "Based on your Plaid/SnapTrade data..."
3. When referencing economic data, cite the indicator: "The current SOFR rate from FRED is..."
4. When referencing memories or past conversations, acknowledge continuity: "As we discussed previously..."
5. If you cannot find relevant information in the provided context, say so clearly rather than making assumptions.
6. Distinguish between data from the user's own documents vs. general knowledge.
</citation_instructions>`);
  }

  const fullContextPrompt = sections.join("\n\n");

  // Calculate retrieval quality
  const retrievalQuality: "high" | "medium" | "low" =
    sourcesUsed.length >= 5 && totalChunksRetrieved >= 5 ? "high" :
    sourcesUsed.length >= 3 || totalChunksRetrieved >= 3 ? "medium" : "low";

  return {
    documentContext,
    knowledgeBaseContext,
    userProfileContext,
    suitabilityContext,
    memoryContext,
    graphContext,
    pipelineDataContext,
    conversationContext,
    integrationContext,
    calculatorContext,
    insightContext,
    clientContext,
    activityContext,
    tagContext,
    gapFeedbackContext,
    fullContextPrompt,
    sourcesUsed,
    totalChunksRetrieved,
    retrievalQuality,
  };
}

// ─── INDIVIDUAL CONTEXT RETRIEVERS ───────────────────────────────────

async function searchKBArticles(query: string, limit: number): Promise<string> {
  try {
    const { searchArticles } = await import("./knowledgeBase");
    const articles = await searchArticles(query, { limit });
    if (articles.length === 0) return "";
    return articles.map(a =>
      `[KB Article: "${a.title}" (${a.category}/${a.contentType})]\n${a.content.slice(0, 800)}`
    ).join("\n\n");
  } catch { return ""; }
}

async function getUserProfileContext(userId: number): Promise<string> {
  const db = await getDb();
  if (!db) return "";
  const [profile] = await db.select().from(userProfiles)
    .where(eq(userProfiles.userId, userId)).limit(1);
  if (!profile) return "";

  const parts: string[] = [`User Profile:`];
  if (profile.age) parts.push(`- Age: ${profile.age}`);
  if (profile.jobTitle) parts.push(`- Job: ${profile.jobTitle}`);
  if (profile.incomeRange) parts.push(`- Income range: ${profile.incomeRange}`);
  if (profile.savingsRange) parts.push(`- Savings range: ${profile.savingsRange}`);
  if (profile.familySituation) parts.push(`- Family: ${profile.familySituation}`);
  if (profile.lifeStage) parts.push(`- Life stage: ${profile.lifeStage}`);
  if (profile.businessOwner) parts.push(`- Business owner: Yes`);
  if (profile.goals) parts.push(`- Goals: ${JSON.stringify(profile.goals)}`);
  if (profile.insuranceSummary) parts.push(`- Insurance: ${JSON.stringify(profile.insuranceSummary)}`);
  if (profile.investmentSummary) parts.push(`- Investments: ${JSON.stringify(profile.investmentSummary)}`);
  if (profile.estateExposure) parts.push(`- Estate exposure: ${JSON.stringify(profile.estateExposure)}`);
  return parts.join("\n");
}

async function getSuitabilityContext(userId: number): Promise<string> {
  const db = await getDb();
  if (!db) return "";
  const [assessment] = await db.select().from(suitabilityAssessments)
    .where(eq(suitabilityAssessments.userId, userId))
    .orderBy(desc(suitabilityAssessments.createdAt)).limit(1);
  if (!assessment) return "";

  const parts: string[] = [`Suitability Assessment (completed ${assessment.completedAt ? new Date(assessment.completedAt).toLocaleDateString() : "unknown"}):`];
  if (assessment.riskTolerance) parts.push(`- Risk tolerance: ${assessment.riskTolerance}`);
  if (assessment.investmentHorizon) parts.push(`- Investment horizon: ${assessment.investmentHorizon}`);
  if (assessment.annualIncome) parts.push(`- Annual income: ${assessment.annualIncome}`);
  if (assessment.netWorth) parts.push(`- Net worth: ${assessment.netWorth}`);
  if (assessment.investmentExperience) parts.push(`- Experience: ${assessment.investmentExperience}`);
  if (assessment.financialGoals) parts.push(`- Financial goals: ${JSON.stringify(assessment.financialGoals)}`);
  if (assessment.insuranceNeeds) parts.push(`- Insurance needs: ${JSON.stringify(assessment.insuranceNeeds)}`);
  return parts.join("\n");
}

async function getPipelineDataContext(): Promise<string> {
  try {
    const { getEconomicDataSummary } = await import("./governmentDataPipelines");
    return await getEconomicDataSummary();
  } catch { return ""; }
}

async function getRecentConversationContext(userId: number, currentConvId?: number): Promise<string> {
  const db = await getDb();
  if (!db) return "";

  // Get last 3 conversations (excluding current) for cross-conversation context
  const recentConvs = await db.select({
    id: conversations.id,
    title: conversations.title,
    mode: conversations.mode,
    updatedAt: conversations.updatedAt,
  }).from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt))
    .limit(5);

  const filtered = recentConvs.filter(c => c.id !== currentConvId).slice(0, 3);
  if (filtered.length === 0) return "";

  const summaries: string[] = [];
  for (const conv of filtered) {
    const recentMsgs = await db.select({
      role: messages.role,
      content: messages.content,
    }).from(messages)
      .where(eq(messages.conversationId, conv.id))
      .orderBy(desc(messages.createdAt))
      .limit(3);

    if (recentMsgs.length > 0) {
      const msgSummary = recentMsgs.reverse().map(m =>
        `${m.role}: ${(m.content || "").slice(0, 150)}`
      ).join("\n");
      summaries.push(`[Conv: "${conv.title || "Untitled"}" (${conv.mode}, ${conv.updatedAt ? new Date(conv.updatedAt).toLocaleDateString() : "unknown"})]\n${msgSummary}`);
    }
  }

  return summaries.length > 0
    ? `Recent conversations for context continuity:\n${summaries.join("\n\n")}`
    : "";
}

async function getIntegrationDataContext(userId: number): Promise<string> {
  const db = await getDb();
  if (!db) return "";
  const parts: string[] = [];

  // Plaid holdings
  try {
    const holdings = await db.select().from(plaidHoldings)
      .where(eq(plaidHoldings.userId, userId)).limit(30);
    if (holdings.length > 0) {
      let totalValue = 0;
      const holdingSummary = holdings.slice(0, 15).map(h => {
        const val = parseFloat(h.currentValue ?? "0");
        totalValue += val;
        return `  - ${h.ticker || h.securityName || "Unknown"}: $${val.toLocaleString()} (${h.quantity} shares)`;
      });
      parts.push(`Plaid Investment Holdings (${holdings.length} positions, total ~$${totalValue.toLocaleString()}):\n${holdingSummary.join("\n")}`);
    }
  } catch {}

  // SnapTrade accounts and positions
  try {
    const accounts = await db.select().from(snapTradeAccounts)
      .where(eq(snapTradeAccounts.userId, userId)).limit(10);
    if (accounts.length > 0) {
      const acctSummary = accounts.map(a =>
        `  - ${a.accountName || a.brokerageName || "Account"}: ${a.accountType || "unknown"} (${a.currency || "USD"})`
      );
      parts.push(`SnapTrade Brokerage Accounts (${accounts.length}):\n${acctSummary.join("\n")}`);
    }

    const positions = await db.select().from(snapTradePositions)
      .where(eq(snapTradePositions.userId, userId)).limit(30);
    if (positions.length > 0) {
      const posSummary = positions.slice(0, 15).map(p =>
        `  - ${p.symbol || "Unknown"}: ${p.units} units @ $${p.price || "?"} (avg cost: $${p.averagePurchasePrice || "?"})`
      );
      parts.push(`SnapTrade Positions (${positions.length}):\n${posSummary.join("\n")}`);
    }
  } catch {}

  // Connected integrations summary
  try {
    const connections = await db.select({
      status: integrationConnections.status,
      lastSyncAt: integrationConnections.lastSyncAt,
      recordsSynced: integrationConnections.recordsSynced,
      providerId: integrationConnections.providerId,
    }).from(integrationConnections)
      .where(and(
        eq(integrationConnections.ownerId, String(userId)),
        eq(integrationConnections.status, "connected")
      ));
    if (connections.length > 0) {
      const providerIds = connections.map(c => c.providerId);
      const providers = await db.select({ id: integrationProviders.id, name: integrationProviders.name })
        .from(integrationProviders)
        .where(inArray(integrationProviders.id, providerIds));
      const provMap = Object.fromEntries(providers.map(p => [p.id, p.name]));
      const connSummary = connections.map(c =>
        `  - ${provMap[c.providerId] || "Unknown"}: ${c.recordsSynced || 0} records, last sync ${c.lastSyncAt ? new Date(c.lastSyncAt).toLocaleDateString() : "never"}`
      );
      parts.push(`Connected Integrations (${connections.length}):\n${connSummary.join("\n")}`);
    }
  } catch {}

  return parts.join("\n\n");
}

async function getCalculatorContext(userId: number): Promise<string> {
  const db = await getDb();
  if (!db) return "";

  const scenarios = await db.select().from(calculatorScenarios)
    .where(eq(calculatorScenarios.userId, userId))
    .orderBy(desc(calculatorScenarios.updatedAt))
    .limit(10);

  if (scenarios.length === 0) return "";

  const summaries = scenarios.map(s => {
    const inputs = typeof s.inputs === "string" ? JSON.parse(s.inputs) : s.inputs;
    const results = typeof s.results === "string" ? JSON.parse(s.results) : s.results;
    return `  - "${s.name}" (${s.calculatorType}): ${JSON.stringify(inputs).slice(0, 200)} → ${JSON.stringify(results).slice(0, 200)}`;
  });

  return `Saved Financial Scenarios (${scenarios.length}):\n${summaries.join("\n")}`;
}

async function getProactiveInsightContext(userId: number): Promise<string> {
  const db = await getDb();
  if (!db) return "";

  const insights = await db.select().from(proactiveInsights)
    .where(eq(proactiveInsights.userId, userId))
    .orderBy(desc(proactiveInsights.createdAt))
    .limit(8);

  if (insights.length === 0) return "";

  const summaries = insights.map(i =>
    `  - [${i.category}/${i.urgency}] ${i.title}: ${(i.content || "").slice(0, 200)}`
  );

  return `Recent AI Insights (${insights.length}):\n${summaries.join("\n")}`;
}

async function getClientRelationshipContext(userId: number): Promise<string> {
  const db = await getDb();
  if (!db) return "";

  const clients = await db.select().from(clientAssociations)
    .where(eq(clientAssociations.professionalId, userId))
    .limit(20);

  if (clients.length === 0) return "";

  return `Client Book: ${clients.length} associated clients. This user is a financial professional with an active client practice.`;
}

async function getRecentActivityContext(userId: number): Promise<string> {
  const db = await getDb();
  if (!db) return "";

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const notifications = await db.select({
    type: notificationLog.type,
    title: notificationLog.title,
    content: notificationLog.content,
    createdAt: notificationLog.createdAt,
  }).from(notificationLog)
    .where(and(
      eq(notificationLog.userId, userId),
      gte(notificationLog.createdAt, sevenDaysAgo)
    ))
    .orderBy(desc(notificationLog.createdAt))
    .limit(10);

  if (notifications.length === 0) return "";

  const summaries = notifications.map(n =>
    `  - [${n.type}] ${n.title || ""}: ${(n.content || "").slice(0, 100)} (${n.createdAt ? new Date(n.createdAt).toLocaleDateString() : ""})`
  );

  return `Recent Activity (last 7 days, ${notifications.length} events):\n${summaries.join("\n")}`;
}

async function getDocumentTagContext(userId: number): Promise<string> {
  const db = await getDb();
  if (!db) return "";

  const tags = await db.select().from(documentTags)
    .where(eq(documentTags.userId, userId));

  if (tags.length === 0) return "";

  // Count docs per tag
  const tagCounts: string[] = [];
  for (const tag of tags.slice(0, 20)) {
    const [count] = await db.select({ count: sql<number>`count(*)` })
      .from(documentTagMap)
      .where(eq(documentTagMap.tagId, tag.id));
    tagCounts.push(`  - "${tag.name}": ${count?.count || 0} documents${tag.isAiGenerated ? " (AI-generated)" : ""}`);
  }

  return `Document Tags (${tags.length}):\n${tagCounts.join("\n")}`;
}

async function getGapFeedbackContext(userId: number): Promise<string> {
  const db = await getDb();
  if (!db) return "";

  const feedback = await db.select().from(knowledgeGapFeedback)
    .where(eq(knowledgeGapFeedback.userId, userId))
    .orderBy(desc(knowledgeGapFeedback.createdAt))
    .limit(10);

  if (feedback.length === 0) return "";

  const summaries = feedback.map(f =>
    `  - Gap "${f.gapTitle}": ${f.action}${f.notes ? ` — "${f.notes}"` : ""}`
  );

  return `Knowledge Gap Feedback (${feedback.length} items):\n${summaries.join("\n")}\n\nUse this feedback to improve gap analysis accuracy. Dismissed gaps should not be re-raised. Acknowledged gaps are being addressed.`;
}

// ─── STRUCTURED INTEGRATION DATA (Fix 1) ────────────────────────────

export interface UserFinancialSnapshot {
  holdings: Array<{ symbol: string; shares: number; value: number; accountName: string }>;
  accounts: Array<{ name: string; type: string; balance: number; institution: string }>;
  totalInvestedAssets: number;
  totalLiquidAssets: number;
  lastSyncTimestamp: string | null;
}

/**
 * Returns structured financial data from Plaid/SnapTrade integrations.
 * Used to auto-populate tool call arguments with real user data.
 */
export async function getStructuredIntegrationData(userId: number): Promise<UserFinancialSnapshot> {
  const db = await getDb();
  const empty: UserFinancialSnapshot = {
    holdings: [], accounts: [], totalInvestedAssets: 0, totalLiquidAssets: 0, lastSyncTimestamp: null,
  };
  if (!db) return empty;

  const result: UserFinancialSnapshot = { ...empty, holdings: [], accounts: [] };
  let latestSync: Date | null = null;

  // Plaid holdings
  try {
    const holdings = await db.select().from(plaidHoldings)
      .where(eq(plaidHoldings.userId, userId)).limit(50);
    for (const h of holdings) {
      const val = parseFloat(h.currentValue ?? "0");
      const qty = parseFloat(h.quantity ?? "0");
      result.holdings.push({
        symbol: h.ticker || h.name || "Unknown",
        shares: qty,
        value: val,
        accountName: h.accountId || "Plaid",
      });
      result.totalInvestedAssets += val;
      if (h.lastSynced) {
        const syncDate = new Date(h.lastSynced);
        if (!latestSync || syncDate > latestSync) latestSync = syncDate;
      }
    }
  } catch {}

  // SnapTrade accounts
  try {
    const accounts = await db.select().from(snapTradeAccounts)
      .where(eq(snapTradeAccounts.userId, userId)).limit(20);
    for (const a of accounts) {
      const totalVal = parseFloat(String(a.totalValue ?? a.marketValue ?? "0"));
      const cashBal = parseFloat(String(a.cashBalance ?? "0"));
      result.accounts.push({
        name: a.accountName || "SnapTrade Account",
        type: a.accountType || "brokerage",
        balance: totalVal,
        institution: a.institutionName || "Unknown",
      });
      result.totalLiquidAssets += cashBal;
      if (a.lastSyncAt) {
        const syncDate = new Date(a.lastSyncAt);
        if (!latestSync || syncDate > latestSync) latestSync = syncDate;
      }
    }
  } catch {}

  // SnapTrade positions
  try {
    const positions = await db.select().from(snapTradePositions)
      .where(eq(snapTradePositions.userId, userId)).limit(50);
    for (const p of positions) {
      const val = parseFloat(String(p.marketValue ?? "0"));
      const qty = parseFloat(String(p.units ?? "0"));
      result.holdings.push({
        symbol: p.symbolTicker || p.symbolName || "Unknown",
        shares: qty,
        value: val,
        accountName: p.accountId || "SnapTrade",
      });
      result.totalInvestedAssets += val;
    }
  } catch {}

  result.lastSyncTimestamp = latestSync ? latestSync.toISOString() : null;
  return result;
}

/**
 * Get key rates from pipeline data (FRED, BLS) for tool auto-population.
 * Returns named rates like Treasury yield, SOFR, CPI, etc.
 */
export async function getPipelineRates(): Promise<Record<string, number>> {
  const db = await getDb();
  if (!db) return {};
  const rates: Record<string, number> = {};
  try {
    const fredData = await db.select().from(enrichmentCache)
      .where(eq(enrichmentCache.providerSlug, "fred"));
    for (const entry of fredData) {
      const d = entry.resultJson as any;
      if (d?.label && d?.value) {
        const val = parseFloat(d.value);
        if (!isNaN(val)) {
          // Normalize key names
          const label = String(d.label).toLowerCase();
          if (label.includes("10-year") || label.includes("10 year")) rates["treasury10y"] = val;
          if (label.includes("sofr")) rates["sofr"] = val;
          if (label.includes("fed funds") || label.includes("federal funds")) rates["fedFunds"] = val;
          if (label.includes("30-year") || label.includes("30 year")) rates["treasury30y"] = val;
          if (label.includes("mortgage")) rates["mortgage30y"] = val;
          rates[d.label] = val;
        }
      }
    }
  } catch {}
  return rates;
}

// ─── CONVENIENCE WRAPPERS ────────────────────────────────────────────

/**
 * Quick context for any LLM call — just pass userId, query, and type.
 * Returns the fullContextPrompt string ready for injection.
 */
export async function getQuickContext(
  userId: number,
  query: string,
  contextType: ContextType,
  overrides?: Partial<ContextRequest>
): Promise<string> {
  const result = await assembleDeepContext({
    userId,
    query,
    contextType,
    ...overrides,
  });
  return result.fullContextPrompt;
}

/**
 * Get just the document context for a specific query (for services
 * that only need document retrieval, not the full assembly).
 */
export async function getDocumentContext(
  userId: number,
  query: string,
  limit = 10
): Promise<string> {
  const chunks = await enhancedSearchChunks(userId, query, { limit });
  if (chunks.length === 0) return "";
  return chunks.map((c, i) =>
    `[Source: "${c.filename}" (${c.category})]\n${c.content}`
  ).join("\n\n---\n\n");
}
