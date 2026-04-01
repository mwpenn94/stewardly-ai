/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DEEP CONTEXT ASSEMBLER — Thin Adapter
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This file now delegates core context assembly to @platform/intelligence
 * via the Stewardly wiring. All callers continue to import from this path
 * with zero changes.
 *
 * What delegates to shared:
 *   - assembleDeepContext → stewardlyWiring.assembleDeepContext
 *   - getQuickContext → stewardlyWiring.getQuickContext
 *   - ContextRequest, AssembledContext, ContextType types
 *
 * What remains here (Stewardly-specific DB utilities):
 *   - enhancedSearchChunks (TF-IDF document chunk retrieval)
 *   - getStructuredIntegrationData (Plaid/SnapTrade financial snapshot)
 *   - getPipelineRates (FRED/BLS economic indicators)
 *   - getDocumentContext (convenience wrapper for document-only retrieval)
 */

import { getDb } from "../db";
import { logger } from "../_core/logger";
import {
  documents, documentChunks, plaidHoldings,
  snapTradeAccounts, snapTradePositions, enrichmentCache,
} from "../../drizzle/schema";
import { eq, like, or, inArray, and } from "drizzle-orm";

// ─── RE-EXPORTS FROM SHARED INTELLIGENCE ─────────────────────────────

// Core assembly functions — now powered by @platform/intelligence
export {
  assembleDeepContext,
  getQuickContext,
  getQuickContextWithMetadata,
} from "../shared/intelligence/stewardlyWiring";

// Types — re-export for backward compatibility
export type { ContextType } from "../shared/intelligence/types";

// Legacy types re-exported so callers like routers.ts and test files
// that import ContextRequest/AssembledContext from this path still work.
export type {
  LegacyContextRequest as ContextRequest,
  LegacyAssembledContext as AssembledContext,
} from "../shared/intelligence/stewardlyWiring";

// ─── ENHANCED SEARCH CHUNKS (TF-IDF Document Retrieval) ─────────────

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
): Promise<Array<{
  content: string;
  filename: string;
  category: string;
  score: number;
  docId: number;
  chunkIndex: number;
}>> {
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
  const docIds = Array.from(new Set(candidates.map(c => c.docId)));
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

// ─── STRUCTURED INTEGRATION DATA ────────────────────────────────────

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
  } catch (e) { logger.debug({ userId, source: "plaid_holdings_financial", error: String(e) }, "Financial data fetch failed silently"); }

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
  } catch (e) { logger.debug({ userId, source: "snaptrade_accounts", error: String(e) }, "Financial data fetch failed silently"); }

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
  } catch (e) { logger.debug({ source: "snaptrade_positions_financial", error: String(e) }, "Financial data fetch failed silently"); }

  result.lastSyncTimestamp = latestSync ? latestSync.toISOString() : null;
  return result;
}

// ─── PIPELINE RATES ─────────────────────────────────────────────────

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
  } catch (e) { logger.debug({ source: "pipeline_rates", error: String(e) }, "Pipeline rates fetch failed silently"); }
  return rates;
}

// ─── CONVENIENCE WRAPPERS ───────────────────────────────────────────

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
  return chunks.map((c, _i) =>
    `[Source: "${c.filename}" (${c.category})]\n${c.content}`
  ).join("\n\n---\n\n");
}
