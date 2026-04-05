/**
 * Web Search Tool — Cascade: Tavily → Brave → graceful fallback
 */
import { logger } from "../_core/logger";

const log = logger.child({ module: "webSearch" });

const DEFAULT_DOMAINS = ["irs.gov", "sec.gov", "finra.org", "ssa.gov", "treasury.gov", "investopedia.com", "kitces.com"];

export async function executeWebSearch(query: string, options?: { includeDomains?: string[] }): Promise<string> {
  const domains = options?.includeDomains || DEFAULT_DOMAINS;

  // Try Tavily
  if (process.env.TAVILY_API_KEY) {
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: process.env.TAVILY_API_KEY,
          query,
          include_domains: domains,
          max_results: 5,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = await res.json();
        const results = (data.results || []).slice(0, 5)
          .map((r: any) => `[${r.title}](${r.url})\n${r.content?.slice(0, 300) || ""}`)
          .join("\n\n");
        return results.slice(0, 2000) || "No results found.";
      }
    } catch (e: any) {
      log.warn({ error: e.message }, "Tavily search failed");
    }
  }

  // Try Brave
  if (process.env.BRAVE_SEARCH_API_KEY) {
    try {
      const params = new URLSearchParams({ q: query, count: "5" });
      const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
        headers: { "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY, Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = await res.json();
        const results = (data.web?.results || []).slice(0, 5)
          .map((r: any) => `[${r.title}](${r.url})\n${r.description?.slice(0, 300) || ""}`)
          .join("\n\n");
        return results.slice(0, 2000) || "No results found.";
      }
    } catch (e: any) {
      log.warn({ error: e.message }, "Brave search failed");
    }
  }

  return "Web search unavailable — using training data only. For current financial data, please verify with authoritative sources (irs.gov, ssa.gov, sec.gov).";
}
