/**
 * Web Search Tool — Cascading search provider
 * 
 * Priority: 1) Tavily (TAVILY_API_KEY) → 2) Brave (BRAVE_SEARCH_API_KEY) → 3) Manus Data API (Google) → 4) LLM-powered fallback
 * Default includeDomains: empty (search all domains for general queries)
 * Returns formatted search results as string (max 2000 chars)
 */
import { logger } from "../_core/logger";
import { callDataApi } from "../_core/dataApi";
import { contextualLLM } from "../shared/stewardlyWiring";

const log = logger.child({ module: "webSearchTool" });

// Financial-specific domains used when the query is clearly financial
const FINANCIAL_DOMAINS = [
  "irs.gov", "sec.gov", "finra.org", "ssa.gov",
  "treasury.gov", "investopedia.com", "kitces.com",
  "bankrate.com", "nerdwallet.com",
];

interface SearchOptions {
  includeDomains?: string[];
  maxResults?: number;
  maxChars?: number;
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

// ─── Tavily Search ──────────────────────────────────────────────────
async function searchTavily(query: string, options: SearchOptions): Promise<SearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error("TAVILY_API_KEY not set");

  const body: Record<string, unknown> = {
    api_key: apiKey,
    query,
    max_results: options.maxResults ?? 5,
    search_depth: "basic",
  };

  // Only include domain filter if explicitly provided
  if (options.includeDomains && options.includeDomains.length > 0) {
    body.include_domains = options.includeDomains;
  }

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Tavily HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.results ?? []).map((r: any) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    snippet: r.content ?? "",
  }));
}

// ─── Brave Search ───────────────────────────────────────────────────
async function searchBrave(query: string, options: SearchOptions): Promise<SearchResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) throw new Error("BRAVE_SEARCH_API_KEY not set");

  const domains = options.includeDomains ?? [];
  const siteQuery = domains.length > 0
    ? `${query} (${domains.map(d => `site:${d}`).join(" OR ")})`
    : query;

  const params = new URLSearchParams({
    q: siteQuery,
    count: String(options.maxResults ?? 5),
  });

  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": apiKey,
    },
  });

  if (!res.ok) throw new Error(`Brave HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.web?.results ?? []).map((r: any) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    snippet: r.description ?? "",
  }));
}

// ─── Manus Data API (Google Search) ─────────────────────────────────
async function searchManusDataApi(query: string, options: SearchOptions): Promise<SearchResult[]> {
  try {
    const data: any = await callDataApi("GoogleSearch/search", {
      query: {
        q: query,
        num: options.maxResults ?? 5,
      },
    });

    // Google Search API returns items array
    const items = data?.items ?? data?.organic_results ?? data?.results ?? [];
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("No results from Google Search API");
    }

    return items.map((r: any) => ({
      title: r.title ?? r.name ?? "",
      url: r.link ?? r.url ?? "",
      snippet: r.snippet ?? r.description ?? r.content ?? "",
    }));
  } catch (err: any) {
    throw new Error(`Manus Data API search failed: ${err.message}`);
  }
}

// ─── LLM-Powered Fallback Search ────────────────────────────────────
async function searchWithLLM(query: string): Promise<string> {
  try {
    const result = await contextualLLM({
      userId: null,
      contextType: "chat",
      messages: [
        {
          role: "system",
          content: `You are a research assistant. The user needs current information that may be beyond your training data. Do your best to provide accurate, helpful information based on what you know. Be transparent about the limitations of your knowledge and clearly state when information may be outdated. Include specific details, numbers, and comparisons where possible.`,
        },
        {
          role: "user",
          content: `Research the following topic and provide detailed, factual information:\n\n${query}\n\nProvide specific details including names, rates, features, comparisons, and any relevant programs or alternatives. If you're not certain about current details, note that and provide the most recent information you have.`,
        },
      ],
    });

    const content = result.choices?.[0]?.message?.content;
    return typeof content === "string" ? content : "No information available.";
  } catch (err: any) {
    return `Research unavailable: ${err.message}`;
  }
}

// ─── Format Results ─────────────────────────────────────────────────
function formatResults(results: SearchResult[], maxChars: number): string {
  if (results.length === 0) return "No results found.";

  let output = "";
  for (const r of results) {
    const entry = `**${r.title}**\n${r.url}\n${r.snippet}\n\n`;
    if (output.length + entry.length > maxChars) break;
    output += entry;
  }
  return output.trim() || "No results found.";
}

// ─── Main Export ────────────────────────────────────────────────────
export async function executeWebSearch(
  query: string,
  options?: SearchOptions,
): Promise<string> {
  const opts: SearchOptions = {
    // Don't default to financial domains — let the LLM's query be the filter
    includeDomains: options?.includeDomains,
    maxResults: options?.maxResults ?? 5,
    maxChars: options?.maxChars ?? 2000,
  };

  // Try Tavily first
  if (process.env.TAVILY_API_KEY) {
    try {
      const results = await searchTavily(query, opts);
      log.info({ provider: "tavily", query, resultCount: results.length }, "Web search completed");
      return formatResults(results, opts.maxChars!);
    } catch (err: any) {
      log.warn({ provider: "tavily", error: err.message }, "Tavily search failed, falling back");
    }
  }

  // Try Brave second
  if (process.env.BRAVE_SEARCH_API_KEY) {
    try {
      const results = await searchBrave(query, opts);
      log.info({ provider: "brave", query, resultCount: results.length }, "Web search completed");
      return formatResults(results, opts.maxChars!);
    } catch (err: any) {
      log.warn({ provider: "brave", error: err.message }, "Brave search failed, falling back");
    }
  }

  // Try Manus Data API (Google Search) third
  try {
    const results = await searchManusDataApi(query, opts);
    log.info({ provider: "manus-google", query, resultCount: results.length }, "Web search completed via Manus Data API");
    return formatResults(results, opts.maxChars!);
  } catch (err: any) {
    log.warn({ provider: "manus-google", error: err.message }, "Manus Data API search failed, falling back to LLM");
  }

  // Final fallback: use the LLM itself to provide the best answer it can
  log.info({ query }, "All search providers unavailable — using LLM-powered research fallback");
  return await searchWithLLM(query);
}

/** Check which search provider is available */
export function getSearchProvider(): "tavily" | "brave" | "manus-google" | "llm-fallback" {
  if (process.env.TAVILY_API_KEY) return "tavily";
  if (process.env.BRAVE_SEARCH_API_KEY) return "brave";
  // Manus Data API is always available if BUILT_IN_FORGE_API_KEY is set
  if (process.env.BUILT_IN_FORGE_API_KEY) return "manus-google";
  return "llm-fallback";
}

// ─── Structured search (Build-loop Pass 5) ───────────────────────────
//
// `executeWebSearch` returns a single formatted string (intended for
// the chat ReAct loop's tool result). The Code Chat agent benefits
// from a richer shape — title, url, snippet — so it can decide which
// links to follow up on with `web_fetch`. This wrapper returns the
// raw `SearchResult[]` plus the provider that handled the request.
//
// The provider cascade matches `executeWebSearch` exactly so the two
// stay in sync. Falls back through the same Tavily → Brave → Google
// → LLM path. The LLM fallback returns a single synthesized result so
// the structured shape always has at least one entry.

export interface StructuredSearchResult {
  provider: "tavily" | "brave" | "manus-google" | "llm-fallback";
  query: string;
  results: SearchResult[];
  truncated: boolean;
  error?: string;
}

export async function executeWebSearchStructured(
  query: string,
  options: SearchOptions = {},
): Promise<StructuredSearchResult> {
  const opts: SearchOptions = {
    includeDomains: options.includeDomains,
    maxResults: Math.min(Math.max(1, options.maxResults ?? 5), 20),
    maxChars: options.maxChars ?? 2000,
  };

  // Try Tavily first
  if (process.env.TAVILY_API_KEY) {
    try {
      const raw = await searchTavily(query, opts);
      return {
        provider: "tavily",
        query,
        results: raw.slice(0, opts.maxResults!),
        truncated: raw.length > (opts.maxResults ?? 5),
      };
    } catch (err) {
      log.warn(
        { provider: "tavily", error: (err as Error).message },
        "tavily structured search failed",
      );
    }
  }

  // Brave next
  if (process.env.BRAVE_SEARCH_API_KEY) {
    try {
      const raw = await searchBrave(query, opts);
      return {
        provider: "brave",
        query,
        results: raw.slice(0, opts.maxResults!),
        truncated: raw.length > (opts.maxResults ?? 5),
      };
    } catch (err) {
      log.warn(
        { provider: "brave", error: (err as Error).message },
        "brave structured search failed",
      );
    }
  }

  // Manus Data API (Google) third
  try {
    const raw = await searchManusDataApi(query, opts);
    return {
      provider: "manus-google",
      query,
      results: raw.slice(0, opts.maxResults!),
      truncated: raw.length > (opts.maxResults ?? 5),
    };
  } catch (err) {
    log.warn(
      { provider: "manus-google", error: (err as Error).message },
      "manus-google structured search failed",
    );
  }

  // LLM fallback — always returns a single synthesized result so the
  // shape stays consistent. Caller can detect via `provider === "llm-fallback"`.
  try {
    const text = await searchWithLLM(query);
    return {
      provider: "llm-fallback",
      query,
      results: [
        {
          title: `Synthesized answer for "${query.slice(0, 80)}"`,
          url: "",
          snippet: text.slice(0, 1500),
        },
      ],
      truncated: text.length > 1500,
    };
  } catch (err) {
    return {
      provider: "llm-fallback",
      query,
      results: [],
      truncated: false,
      error: (err as Error).message,
    };
  }
}

// ─── Test seam (Build-loop Pass 5) ───────────────────────────────────
//
// Pure-function helper so `web_search` dispatcher tests can drive
// branch coverage without an env var or live HTTP call. NOT exported
// from the public surface — the production callers go through
// `executeWebSearchStructured`.
export function _formatWebSearchEmptyResult(
  query: string,
  reason: string,
): StructuredSearchResult {
  return {
    provider: "llm-fallback",
    query,
    results: [],
    truncated: false,
    error: reason,
  };
}
