/**
 * Enhanced Search Service
 * - Search result caching to avoid redundant lookups
 * - Cited sources in AI responses
 * - Product research mode for proactive financial product comparison
 */
import { getDb } from "../db";
import { searchCache } from "../../drizzle/schema";
import { eq, and, gt, sql } from "drizzle-orm";
import { contextualLLM } from "../shared/intelligence/sovereignWiring"
import { contextualLLM } from "./contextualLLM";
import { callDataApi } from "../_core/dataApi";
import crypto from "crypto";

// ─── Cache TTL constants (ms) ──────────────────────────────────────────────
const CACHE_TTL = {
  stock_data: 5 * 60 * 1000,       // 5 min for real-time data
  product_research: 24 * 60 * 60 * 1000, // 24h for product research
  comparison: 12 * 60 * 60 * 1000, // 12h for comparisons
  general: 60 * 60 * 1000,         // 1h for general queries
};

function hashQuery(query: string): string {
  return crypto.createHash("sha256").update(query.toLowerCase().trim()).digest("hex").slice(0, 64);
}

// ─── Search Cache Service ──────────────────────────────────────────────────
export class SearchCacheService {
  async getCached(queryText: string, category?: string): Promise<{ result: any; citations: any[] } | null> {
    const db = await getDb();
    if (!db) return null;

    const hash = hashQuery(queryText);
    const now = Date.now();

    const [cached] = await db.select().from(searchCache)
      .where(and(
        eq(searchCache.queryHash, hash),
        gt(searchCache.expiresAt, now),
      ))
      .limit(1);

    if (cached) {
      // Increment hit count
      await db.update(searchCache).set({ hitCount: sql`hit_count + 1` })
        .where(eq(searchCache.id, cached.id));
      return {
        result: cached.resultJson,
        citations: (cached.sourceCitations as any[]) || [],
      };
    }
    return null;
  }

  async setCache(queryText: string, category: string, result: any, citations: any[]): Promise<void> {
    const db = await getDb();
    if (!db) return;

    const hash = hashQuery(queryText);
    const ttl = CACHE_TTL[category as keyof typeof CACHE_TTL] || CACHE_TTL.general;

    await db.insert(searchCache).values({
      queryHash: hash,
      queryText,
      category,
      resultJson: result,
      sourceCitations: citations,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now(),
    });
  }

  async getStats(): Promise<{ totalCached: number; hitRate: number; topQueries: any[] }> {
    const db = await getDb();
    if (!db) return { totalCached: 0, hitRate: 0, topQueries: [] };

    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(searchCache);
    const [hitResult] = await db.select({ totalHits: sql<number>`COALESCE(SUM(hit_count), 0)` }).from(searchCache);

    const topQueries = await db.select({
      queryText: searchCache.queryText,
      category: searchCache.category,
      hitCount: searchCache.hitCount,
    }).from(searchCache)
      .orderBy(sql`hit_count DESC`)
      .limit(10);

    const total = countResult?.count || 0;
    const totalHits = hitResult?.totalHits || 0;

    return {
      totalCached: total,
      hitRate: total > 0 ? totalHits / total : 0,
      topQueries,
    };
  }

  async cleanup(): Promise<number> {
    const db = await getDb();
    if (!db) return 0;
    const result = await db.delete(searchCache)
      .where(sql`expires_at < ${Date.now()}`);
    return result[0]?.affectedRows || 0;
  }
}

// ─── Citation Builder ──────────────────────────────────────────────────────
export interface Citation {
  id: number;
  source: string;
  title: string;
  url?: string;
  snippet: string;
  confidence: number;
  timestamp: number;
}

export class CitationBuilder {
  private citations: Citation[] = [];
  private nextId = 1;

  add(source: string, title: string, snippet: string, url?: string, confidence = 0.8): number {
    const id = this.nextId++;
    this.citations.push({ id, source, title, url, snippet, confidence, timestamp: Date.now() });
    return id;
  }

  getCitations(): Citation[] {
    return this.citations;
  }

  formatInline(citationId: number): string {
    return `[${citationId}]`;
  }

  formatFootnotes(): string {
    if (this.citations.length === 0) return "";
    return "\n\n---\n**Sources:**\n" +
      this.citations.map(c =>
        `[${c.id}] ${c.title} — ${c.source}${c.url ? ` (${c.url})` : ""}`
      ).join("\n");
  }
}

// ─── Product Research Mode ─────────────────────────────────────────────────
export class ProductResearchService {
  private cache = new SearchCacheService();

  async researchProduct(query: string, category: string): Promise<{
    analysis: string;
    citations: Citation[];
    cached: boolean;
  }> {
    // Check cache first
    const cached = await this.cache.getCached(query, "product_research");
    if (cached) {
      return { analysis: cached.result as string, citations: cached.citations as Citation[], cached: true };
    }

    const citationBuilder = new CitationBuilder();

    // Try to get real market data if it's a ticker
    let marketContext = "";
    const tickerMatch = query.match(/\b([A-Z]{1,5})\b/);
    if (tickerMatch) {
      try {
        const data = await callDataApi("yahoo_finance", {
          query: { symbol: tickerMatch[1], range: "1mo", interval: "1d" },
        });
        if (data) {
          const cId = citationBuilder.add("Yahoo Finance", `${tickerMatch[1]} Market Data`, `Real-time market data for ${tickerMatch[1]}`);
          marketContext = `\n\nReal-time market data ${citationBuilder.formatInline(cId)}:\n${JSON.stringify(data).slice(0, 2000)}`;
        }
      } catch { /* ignore */ }
    }

    // Use LLM for comprehensive research
    const result = await contextualLLM({ userId: null, contextType: "analysis",
      messages: [
        {
          role: "system",
          content: `You are a financial product research analyst. Provide comprehensive, objective analysis with specific numbers, fees, and comparisons. Always note regulatory considerations. Format with clear sections. When citing information, note the source type (e.g., "According to SEC filings...", "Industry data shows...").`,
        },
        {
          role: "user",
          content: `Research this financial product/topic thoroughly: "${query}" (Category: ${category})${marketContext}\n\nProvide:\n1. Overview & key features\n2. Fee structure\n3. Pros and cons\n4. Suitability analysis\n5. Competitive alternatives\n6. Regulatory considerations\n7. Key metrics and performance data`,
        },
      ],
    });

    const analysis = String(result.choices[0]?.message?.content || "Research unavailable");

    // Add LLM as a citation source
    citationBuilder.add("AI Research Analysis", `${category} Research: ${query}`, "AI-generated analysis based on training data and available market information");

    const citations = citationBuilder.getCitations();

    // Cache the result
    await this.cache.setCache(query, "product_research", analysis, citations);

    return { analysis, citations, cached: false };
  }

  async compareProducts(products: string[], criteria?: string[]): Promise<{
    comparison: string;
    citations: Citation[];
    cached: boolean;
  }> {
    const cacheKey = `compare:${products.sort().join("|")}:${(criteria || []).join(",")}`;
    const cached = await this.cache.getCached(cacheKey, "comparison");
    if (cached) {
      return { comparison: cached.result as string, citations: cached.citations as Citation[], cached: true };
    }

    const citationBuilder = new CitationBuilder();
    const criteriaStr = criteria?.length
      ? `Focus on: ${criteria.join(", ")}`
      : "Compare on fees, features, performance, suitability, and overall value";

    const result = await contextualLLM({ userId: null, contextType: "analysis",
      messages: [
        {
          role: "system",
          content: `You are a financial product comparison analyst. Create detailed, objective side-by-side comparisons. Be specific with numbers. Include a clear recommendation with caveats. ${criteriaStr}`,
        },
        {
          role: "user",
          content: `Compare these products/options: ${products.join(" vs ")}\n\nProvide a structured comparison with a summary table.`,
        },
      ],
    });

    const comparison = String(result.choices[0]?.message?.content || "Comparison unavailable");
    citationBuilder.add("AI Comparison Analysis", `Product Comparison: ${products.join(" vs ")}`, "AI-generated comparison based on available data");

    const citations = citationBuilder.getCitations();
    await this.cache.setCache(cacheKey, "comparison", comparison, citations);

    return { comparison, citations, cached: false };
  }

  async proactiveResearch(userContext: string): Promise<{
    suggestions: Array<{ query: string; reason: string; category: string }>;
  }> {
    const result = await contextualLLM({ userId: null, contextType: "analysis",
      messages: [
        {
          role: "system",
          content: "Based on the user's financial context, suggest 3-5 specific financial products or topics they should research. Return JSON.",
        },
        { role: "user", content: userContext },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "research_suggestions",
          strict: true,
          schema: {
            type: "object",
            properties: {
              suggestions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    query: { type: "string", description: "Specific product/topic to research" },
                    reason: { type: "string", description: "Why this is relevant to the user" },
                    category: { type: "string", description: "Product category" },
                  },
                  required: ["query", "reason", "category"],
                  additionalProperties: false,
                },
              },
            },
            required: ["suggestions"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = String(result.choices[0]?.message?.content || "");
    try {
      return JSON.parse(content || '{"suggestions":[]}');
    } catch {
      return { suggestions: [] };
    }
  }
}

export const searchCacheService = new SearchCacheService();
export const productResearchService = new ProductResearchService();
