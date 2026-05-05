/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Substrate Primitive: Search Cascade
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Tiered quality-first degradation for web search:
 *   Tier 0 (Built-in):     Forge google_search grounding (via LLM tool call)
 *   Tier 1 (Premium API):  Tavily (if configured)
 *   Tier 2 (Free):         DuckDuckGo HTML parsing
 *   Tier 3 (Reference):    Wikipedia + financial data APIs
 *   Tier U (User BYO):     User-configured search APIs
 *
 * The cascade tries highest quality first, degrades gracefully when
 * quotas exhaust or providers fail. Lower tiers still run for breadth.
 *
 * Integrates with:
 *   - Classifier (sensitivity check before external search)
 *   - Sovereign routing (provider health tracking)
 *   - Existing webSearchTool.ts (Tier 0 via google_search)
 *
 * @substrate-primitive: search-cascade
 * @absorbed-from: manus-next-app/server/services/searchEngine.ts
 */
import { logger } from "../../_core/logger";
import { classify } from "./classifier";
import { callDataApi } from "../../_core/dataApi";

const log = logger.child({ module: "substrate:searchCascade" });

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  publishedDate?: string;
  score?: number;
}

export interface SearchOptions {
  query: string;
  numResults?: number;
  dateRange?: "all" | "past_day" | "past_week" | "past_month" | "past_year";
  categories?: string[];
  /** User-configured API keys for BYO tiers */
  userKeys?: {
    tavilyApiKey?: string;
    braveApiKey?: string;
    serperApiKey?: string;
  };
}

export interface SearchResponse {
  results: SearchResult[];
  totalResults: number;
  tiersUsed: string[];
  latencyMs: number;
  degraded: boolean;
}

// ─── Tier Implementations ────────────────────────────────────────────────────

/**
 * Tier 0: Forge google_search (via Data API proxy)
 * Uses the built-in Forge grounding — highest quality, no quota limits.
 */
async function searchTier0(query: string, numResults: number): Promise<SearchResult[]> {
  try {
    const response = await callDataApi("google_search", { query, num_results: numResults });
    if (!response || !Array.isArray(response.results)) return [];

    return response.results.map((r: any) => ({
      title: r.title ?? "",
      url: r.url ?? r.link ?? "",
      snippet: r.snippet ?? r.description ?? "",
      source: "google_search",
      publishedDate: r.date,
      score: 95, // Highest quality tier
    }));
  } catch (err) {
    log.warn({ err: (err as Error).message }, "Tier 0 (google_search) failed");
    return [];
  }
}

/**
 * Tier 1: Tavily API (AI-optimized search, 1000 free credits/month)
 */
async function searchTier1(query: string, numResults: number, apiKey?: string): Promise<SearchResult[]> {
  if (!apiKey) return [];

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: numResults,
        search_depth: "basic",
      }),
    });

    if (!response.ok) return [];
    const data = await response.json();

    return (data.results ?? []).map((r: any) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      snippet: r.content ?? "",
      source: "tavily",
      publishedDate: r.published_date,
      score: 85,
    }));
  } catch (err) {
    log.warn({ err: (err as Error).message }, "Tier 1 (Tavily) failed");
    return [];
  }
}

/**
 * Tier 2: DuckDuckGo (free, unlimited, may get CAPTCHA from cloud IPs)
 */
async function searchTier2(query: string, numResults: number): Promise<SearchResult[]> {
  try {
    // Use DuckDuckGo instant answer API (limited but always available)
    const encoded = encodeURIComponent(query);
    const response = await fetch(
      `https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`,
      { headers: { "User-Agent": "StewardlyAI/1.0" } }
    );

    if (!response.ok) return [];
    const data = await response.json();

    const results: SearchResult[] = [];

    // Abstract (main answer)
    if (data.Abstract && data.AbstractURL) {
      results.push({
        title: data.Heading ?? query,
        url: data.AbstractURL,
        snippet: data.Abstract,
        source: "ddg",
        score: 70,
      });
    }

    // Related topics
    for (const topic of (data.RelatedTopics ?? []).slice(0, numResults - 1)) {
      if (topic.FirstURL && topic.Text) {
        results.push({
          title: topic.Text.slice(0, 80),
          url: topic.FirstURL,
          snippet: topic.Text,
          source: "ddg",
          score: 60,
        });
      }
    }

    return results.slice(0, numResults);
  } catch (err) {
    log.warn({ err: (err as Error).message }, "Tier 2 (DDG) failed");
    return [];
  }
}

/**
 * Tier 3: Financial data APIs (FRED, BLS, Census) — always available for financial queries
 */
async function searchTier3Financial(query: string): Promise<SearchResult[]> {
  const lower = query.toLowerCase();
  const isFinancial = ["rate", "gdp", "inflation", "employment", "housing", "cpi", "fed", "treasury", "yield"].some(
    (kw) => lower.includes(kw)
  );

  if (!isFinancial) return [];

  try {
    // Use FRED API for economic data
    const response = await callDataApi("fred_search", { query, limit: 5 });
    if (!response || !Array.isArray(response.seriess)) return [];

    return response.seriess.map((s: any) => ({
      title: s.title ?? "",
      url: `https://fred.stlouisfed.org/series/${s.id}`,
      snippet: `${s.title} — ${s.notes?.slice(0, 200) ?? "Economic data series"}`,
      source: "fred",
      score: 80,
    }));
  } catch {
    return [];
  }
}

// ─── Cascade Orchestrator ────────────────────────────────────────────────────

/**
 * Execute the search cascade.
 * Tries tiers in order, stops when quality results are found.
 * Lower tiers still run for supplementary breadth.
 */
export async function searchCascade(options: SearchOptions): Promise<SearchResponse> {
  const startTime = Date.now();
  const { query, numResults = 10, userKeys } = options;
  const tiersUsed: string[] = [];
  let allResults: SearchResult[] = [];
  let degraded = false;

  // Sensitivity check — don't send sensitive queries to external search
  const classification = classify(query);
  if (classification.routingTier === "LOCAL") {
    log.info({ query: query.slice(0, 50) }, "Sensitive query — skipping external search");
    return {
      results: [],
      totalResults: 0,
      tiersUsed: ["blocked:sensitive"],
      latencyMs: Date.now() - startTime,
      degraded: true,
    };
  }

  // Tier 0: Forge google_search
  const tier0Results = await searchTier0(query, numResults);
  if (tier0Results.length > 0) {
    allResults.push(...tier0Results);
    tiersUsed.push("tier0:google_search");
  }

  // If Tier 0 gave enough results, we're done (but still check financial)
  if (allResults.length < numResults) {
    // Tier 1: Tavily (if user has key)
    const tier1Results = await searchTier1(query, numResults, userKeys?.tavilyApiKey);
    if (tier1Results.length > 0) {
      allResults.push(...tier1Results);
      tiersUsed.push("tier1:tavily");
    }
  }

  if (allResults.length < numResults) {
    // Tier 2: DuckDuckGo
    const tier2Results = await searchTier2(query, numResults);
    if (tier2Results.length > 0) {
      allResults.push(...tier2Results);
      tiersUsed.push("tier2:ddg");
      degraded = true;
    }
  }

  // Tier 3: Financial data (supplementary, always runs for financial queries)
  const tier3Results = await searchTier3Financial(query);
  if (tier3Results.length > 0) {
    allResults.push(...tier3Results);
    tiersUsed.push("tier3:financial");
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  allResults = allResults.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  // Sort by score
  allResults.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const latencyMs = Date.now() - startTime;
  log.info({ query: query.slice(0, 50), results: allResults.length, tiersUsed, latencyMs }, "Search cascade complete");

  return {
    results: allResults.slice(0, numResults),
    totalResults: allResults.length,
    tiersUsed,
    latencyMs,
    degraded,
  };
}
