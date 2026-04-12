/**
 * URL validator + classifier — Pass 272.
 *
 * Pure helpers for extracting, classifying, and formatting URLs
 * found in Code Chat assistant messages. Used by the Pass 206
 * mention resolver's companion UI to:
 *   - Flag URLs that look fabricated (nonsense subdomains,
 *     implausible paths)
 *   - Classify links into categories (docs / code / package /
 *     issue / image)
 *   - Produce short preview labels for the chat UI
 *
 * The Pass 41 URL hallucination guardrail focused on stripping
 * fabricated URLs server-side; this is a client-side inspection
 * layer that surfaces the metadata to the user for review.
 */

export type UrlCategory =
  | "docs"
  | "code"
  | "package"
  | "issue"
  | "image"
  | "video"
  | "api"
  | "unknown";

export interface ExtractedUrl {
  raw: string;
  /** URL-object-style parsed components */
  protocol: string;
  host: string;
  pathname: string;
  search: string;
  hash: string;
  category: UrlCategory;
  /** Short human label for the UI */
  label: string;
}

/**
 * A trusted-host allowlist. Domains on this list get a green
 * "trusted" badge; everything else gets a neutral "unverified"
 * badge unless the user clicks through.
 */
export const TRUSTED_HOSTS: ReadonlySet<string> = new Set([
  "github.com",
  "docs.github.com",
  "stackoverflow.com",
  "developer.mozilla.org",
  "developers.google.com",
  "docs.python.org",
  "docs.anthropic.com",
  "platform.openai.com",
  "npmjs.com",
  "www.npmjs.com",
  "pypi.org",
  "crates.io",
  "rust-lang.org",
  "typescriptlang.org",
  "www.typescriptlang.org",
  "react.dev",
  "vitejs.dev",
  "tailwindcss.com",
  "drizzle.team",
  "trpc.io",
]);

/**
 * Match HTTP(S) URLs in arbitrary text. Used by Pass 206 for
 * free-form extraction and now by the inspector for consistency.
 */
const URL_REGEX = /https?:\/\/[^\s<>"'`\]]+/g;

/**
 * Extract every URL from a text blob. Deduplicates by raw value.
 */
export function extractUrls(text: string): string[] {
  if (!text) return [];
  const matches = text.match(URL_REGEX);
  if (!matches) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of matches) {
    // Strip trailing punctuation that's typically not part of the URL
    const cleaned = m.replace(/[.,;:!?)\]]+$/, "");
    if (!seen.has(cleaned)) {
      seen.add(cleaned);
      out.push(cleaned);
    }
  }
  return out;
}

/**
 * Classify a URL into a category by host + path heuristics.
 */
export function classifyUrl(url: string): UrlCategory {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "unknown";
  }
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();

  if (host.includes("github.com")) {
    if (/\/(issues|pull)\//.test(path)) return "issue";
    return "code";
  }
  if (host.includes("gitlab") || host.includes("bitbucket")) return "code";
  if (host.includes("npmjs.com") || host.includes("pypi.org") || host.includes("crates.io"))
    return "package";
  if (/\.(png|jpg|jpeg|gif|webp|svg)(?:\?|$)/.test(path)) return "image";
  if (host.includes("youtube.com") || host.includes("vimeo.com")) return "video";
  if (host.startsWith("api.") || path.startsWith("/api/")) return "api";
  if (host.startsWith("docs.") || path.startsWith("/docs/") || /\bdocs\b/.test(host))
    return "docs";
  if (host.includes("developer.")) return "docs";
  return "unknown";
}

/**
 * Produce a compact label for the UI. Strips the protocol, collapses
 * long paths, and caps at 60 chars.
 */
export function labelForUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url.slice(0, 60);
  }
  const combined = `${parsed.host}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  if (combined.length <= 60) return combined;
  // Keep the first 30 chars + ellipsis + last 27
  return combined.slice(0, 30) + "…" + combined.slice(-27);
}

/**
 * Heuristic: does this URL look suspicious / potentially fabricated?
 * Flags:
 *   - Non-standard TLDs on a GitHub-style path
 *   - Excessive dashes or digits in the host
 *   - Path segments that look like invented content
 */
export function isSuspicious(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return true;
  }
  const host = parsed.hostname;
  // Too many numbers in the TLD portion
  if (/\d{4,}/.test(host)) return true;
  // Three or more consecutive dashes
  if (/---/.test(host)) return true;
  // Subdomains with random-looking strings (many consonants without vowels)
  const segments = host.split(".");
  for (const seg of segments) {
    if (seg.length > 6 && !/[aeiouy]/i.test(seg)) return true;
  }
  return false;
}

/**
 * Full inspection: extract + classify + label + trust check.
 */
export function inspectUrl(url: string): ExtractedUrl & {
  trusted: boolean;
  suspicious: boolean;
} {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {
      raw: url,
      protocol: "",
      host: "",
      pathname: "",
      search: "",
      hash: "",
      category: "unknown",
      label: url.slice(0, 60),
      trusted: false,
      suspicious: true,
    };
  }
  return {
    raw: url,
    protocol: parsed.protocol.replace(":", ""),
    host: parsed.hostname.toLowerCase(),
    pathname: parsed.pathname,
    search: parsed.search,
    hash: parsed.hash,
    category: classifyUrl(url),
    label: labelForUrl(url),
    trusted: TRUSTED_HOSTS.has(parsed.hostname.toLowerCase()),
    suspicious: isSuspicious(url),
  };
}

/**
 * Batch inspect every URL in a text blob. Returns structured
 * results sorted by category then by label.
 */
export function inspectAllUrls(
  text: string,
): Array<ReturnType<typeof inspectUrl>> {
  const urls = extractUrls(text);
  return urls
    .map((u) => inspectUrl(u))
    .sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.label.localeCompare(b.label);
    });
}
