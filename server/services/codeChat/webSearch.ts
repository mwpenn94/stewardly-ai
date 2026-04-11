/**
 * webSearch — Code Chat wrapper around the platform's cascading
 * web search infrastructure (Pass 251).
 *
 * Claude Code has a built-in WebSearch tool that returns ranked
 * results the agent can reason over. Stewardly already has a
 * cascading search pipeline (Tavily → Brave → Manus Google →
 * LLM fallback) in server/services/webSearchTool.ts, but it
 * returns a pre-formatted markdown blob that's great for chat
 * injection but doesn't carry per-result URLs, so the agent
 * couldn't follow up with web_fetch on specific hits.
 *
 * This wrapper:
 *   - Reuses the cascading provider chain so we don't duplicate
 *     API wiring.
 *   - Exposes a structured {title, url, snippet}[] shape so the
 *     LLM can cite individual results and chain them into web_fetch.
 *   - Clamps query length (256 chars) and result count (10 max).
 *   - Trims long snippets to keep the SSE payload bounded.
 */

import { logger } from "../../_core/logger";

export interface WebSearchHit {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchCodeResult {
  provider: "tavily" | "brave" | "manus-google" | "llm-fallback";
  query: string;
  results: WebSearchHit[];
  /** Whether the underlying provider returned a formatted blob
   *  that we had to parse out (llm-fallback) rather than real
   *  structured results. */
  fromFallback: boolean;
}

export const MAX_QUERY_LENGTH = 256;
export const MAX_SNIPPET_LENGTH = 500;
export const MAX_RESULTS = 10;

export class WebSearchError extends Error {
  constructor(
    message: string,
    public code: "BAD_QUERY" | "PROVIDER_FAILED" | "NO_RESULTS",
  ) {
    super(message);
    this.name = "WebSearchError";
  }
}

/**
 * Parse a pre-formatted web search blob from the platform's
 * `executeWebSearch` helper into a structured list. The blob
 * format looks like:
 *
 *   **Title**
 *   https://example.com/page
 *   snippet text spanning
 *   one or more lines
 *
 * (blank line)
 *
 *   **Next title**
 *   https://example.com/next
 *   ...
 *
 * The parser is forgiving — it handles extra whitespace, missing
 * URLs (returns an empty URL), and entries without a snippet.
 */
export function parseWebSearchBlob(raw: string): WebSearchHit[] {
  if (!raw || typeof raw !== "string") return [];
  const out: WebSearchHit[] = [];
  const blocks = raw
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim());
    // Expected: first line is **title**, second is URL, rest is snippet.
    let title = "";
    let url = "";
    const snippetLines: string[] = [];
    for (const line of lines) {
      if (!title) {
        const titleMatch = /^\*\*(.+?)\*\*\s*$/.exec(line);
        if (titleMatch) {
          title = titleMatch[1].trim();
          continue;
        }
        // Some providers skip the bold markers — take the first
        // non-URL line as title.
        if (!/^https?:\/\//i.test(line)) {
          title = line;
          continue;
        }
      }
      if (!url && /^https?:\/\//i.test(line)) {
        url = line;
        continue;
      }
      snippetLines.push(line);
    }
    if (!title && !url) continue;
    out.push({
      title: title || "(no title)",
      url,
      snippet: clampSnippet(snippetLines.join(" ").trim()),
    });
  }
  return out;
}

export function clampSnippet(s: string): string {
  if (!s) return "";
  if (s.length <= MAX_SNIPPET_LENGTH) return s;
  return `${s.slice(0, MAX_SNIPPET_LENGTH - 1)}…`;
}

/**
 * Normalize a user-supplied query: strip control chars, trim, cap
 * length. Returns null for empty / invalid input so the caller can
 * raise a typed error.
 */
export function normalizeQuery(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  // Replace control chars (except tab / newline which we still drop
  // below) with spaces so the downstream providers get a clean query.
  const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.slice(0, MAX_QUERY_LENGTH);
}

/**
 * Run a web search through the platform's cascading provider chain
 * and return a structured result set. The `executeSearchBlob`
 * parameter is the raw-string search function — in production it's
 * `executeWebSearch` from webSearchTool.ts, but the dependency is
 * injected so this module stays testable without the whole platform.
 */
export async function runWebSearchForCodeChat(
  query: unknown,
  deps: {
    executeSearchBlob: (
      q: string,
      opts?: { maxResults?: number; maxChars?: number },
    ) => Promise<string>;
    getSearchProvider?: () =>
      | "tavily"
      | "brave"
      | "manus-google"
      | "llm-fallback";
  },
  opts: { maxResults?: number } = {},
): Promise<WebSearchCodeResult> {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    throw new WebSearchError("query must be a non-empty string", "BAD_QUERY");
  }
  const maxResults = Math.min(Math.max(opts.maxResults ?? 5, 1), MAX_RESULTS);
  let blob: string;
  try {
    blob = await deps.executeSearchBlob(normalized, {
      maxResults,
      // Bump the char budget slightly so we don't lose results to
      // truncation — we'll re-clamp at the snippet level below.
      maxChars: Math.max(4000, maxResults * 600),
    });
  } catch (err: any) {
    throw new WebSearchError(
      err?.message ? `search failed: ${err.message}` : "search failed",
      "PROVIDER_FAILED",
    );
  }

  const provider = deps.getSearchProvider
    ? deps.getSearchProvider()
    : "llm-fallback";
  const fromFallback = provider === "llm-fallback";
  const results = parseWebSearchBlob(blob).slice(0, maxResults);
  logger.info(
    { provider, query: normalized, resultCount: results.length, fromFallback },
    "codeChat web search completed",
  );
  if (results.length === 0 && !fromFallback) {
    // Fallback: wrap the whole blob as a single hit so the agent
    // still sees the provider's response, even if we couldn't parse
    // it. This is defensive — real Tavily/Brave/Google responses
    // always parse clean.
    return {
      provider,
      query: normalized,
      results: [
        {
          title: "Search response",
          url: "",
          snippet: clampSnippet(blob.trim()),
        },
      ],
      fromFallback: true,
    };
  }
  return { provider, query: normalized, results, fromFallback };
}
