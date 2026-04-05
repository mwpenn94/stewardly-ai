/**
 * Web Search Tool — Cascading search provider
 * 
 * Priority: 1) Tavily (TAVILY_API_KEY) → 2) Brave (BRAVE_SEARCH_API_KEY) → 3) graceful fallback
 * Default includeDomains: irs.gov, sec.gov, finra.org, ssa.gov, treasury.gov, investopedia.com, kitces.com
 * Returns formatted search results as string (max 2000 chars)
 */
import { logger } from "../_core/logger";

const log = logger.child({ module: "webSearchTool" });

const DEFAULT_DOMAINS = [
  "irs.gov", "sec.gov", "finra.org", "ssa.gov",
  "treasury.gov", "investopedia.com", "kitces.com",
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

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      include_domains: options.includeDomains ?? DEFAULT_DOMAINS,
      max_results: options.maxResults ?? 5,
      search_depth: "basic",
    }),
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

  const domains = (options.includeDomains ?? DEFAULT_DOMAINS);
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
    includeDomains: options?.includeDomains ?? DEFAULT_DOMAINS,
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

  // Graceful fallback
  log.info({ query }, "Web search unavailable — no API keys configured");
  return "Web search unavailable — using training data only";
}

/** Check which search provider is available */
export function getSearchProvider(): "tavily" | "brave" | "none" {
  if (process.env.TAVILY_API_KEY) return "tavily";
  if (process.env.BRAVE_SEARCH_API_KEY) return "brave";
  return "none";
}
