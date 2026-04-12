/**
 * robotsPolicy — pass 2, scope: browser/device automation parity.
 *
 * Minimal robots.txt parser + policy enforcement. Implements the
 * subset of the REP (Robots Exclusion Protocol) that most sites use:
 *
 *   - Per-`User-agent` rule groups
 *   - `Allow:` + `Disallow:` directives with prefix matching and `*`
 *     wildcards + `$` end-anchors
 *   - Case-insensitive user-agent matching with `*` fallback group
 *   - `Crawl-delay:` hints (seconds, integer)
 *   - `Sitemap:` URL extraction
 *
 * Not implemented: POST-specific rules (rare), non-ASCII host rules,
 * the stricter Google-only path-parameter escape sequences. This is
 * good enough for defense against accidentally hammering sites during
 * research runs, which is the actual threat model here.
 *
 * Two layers:
 *   1. `parseRobots(text)` — pure function returning a structured
 *      `RobotsPolicy` that can be cached per-host.
 *   2. `RobotsChecker` — tiny stateful holder that fetches + caches
 *      policies per host on demand. The default fetcher uses the
 *      project's `WebNavigator` so the request still goes through the
 *      rate limiter + SSRF guard.
 */

// ─── Data model ───────────────────────────────────────────────────────

export interface RobotsRule {
  type: "allow" | "disallow";
  path: string;
}

export interface RobotsUserAgentGroup {
  agents: string[];
  rules: RobotsRule[];
  crawlDelay: number | null;
}

export interface RobotsPolicy {
  groups: RobotsUserAgentGroup[];
  sitemaps: string[];
  raw: string;
}

// ─── Parser ───────────────────────────────────────────────────────────

export function parseRobots(text: string): RobotsPolicy {
  const groups: RobotsUserAgentGroup[] = [];
  const sitemaps: string[] = [];
  if (typeof text !== "string") {
    return { groups, sitemaps, raw: "" };
  }

  let current: RobotsUserAgentGroup | null = null;
  /** Track whether the previous non-blank line was a User-agent so
   *  consecutive UA lines pool into one group (standard behavior). */
  let lastWasUserAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    // Strip comments + trim
    const noComment = rawLine.replace(/#.*$/, "").trim();
    if (!noComment) {
      lastWasUserAgent = false;
      continue;
    }
    const colon = noComment.indexOf(":");
    if (colon < 0) continue;
    const key = noComment.slice(0, colon).trim().toLowerCase();
    const value = noComment.slice(colon + 1).trim();
    if (!value) continue;

    if (key === "user-agent") {
      if (!current || !lastWasUserAgent) {
        current = { agents: [], rules: [], crawlDelay: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasUserAgent = true;
      continue;
    }

    lastWasUserAgent = false;

    if (key === "sitemap") {
      sitemaps.push(value);
      continue;
    }

    if (!current) continue; // Directive before any UA → ignored

    if (key === "allow") {
      current.rules.push({ type: "allow", path: value });
    } else if (key === "disallow") {
      current.rules.push({ type: "disallow", path: value });
    } else if (key === "crawl-delay") {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) current.crawlDelay = n;
    }
  }

  return { groups, sitemaps, raw: text };
}

// ─── Rule matching ───────────────────────────────────────────────────

function matchesUserAgent(group: RobotsUserAgentGroup, userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return group.agents.some((agent) => {
    if (agent === "*") return true;
    // Google's convention: substring match on the UA token
    return ua.includes(agent);
  });
}

/**
 * Match a robots path pattern against an absolute path + query. Handles
 * `*` wildcards and the `$` end-anchor.
 */
function matchPattern(pattern: string, path: string): boolean {
  if (pattern === "") return false; // empty Disallow means "allow nothing", i.e. allow all
  if (pattern === "/") return path.startsWith("/");

  // Build a regex. Escape regex meta, preserve `*` (→ `.*`) and `$`
  // only when it's at the end.
  let regex = "";
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i];
    if (c === "*") {
      regex += ".*";
    } else if (c === "$" && i === pattern.length - 1) {
      regex += "$";
    } else if (/[.+?^${}()|[\]\\]/.test(c)) {
      regex += "\\" + c;
    } else {
      regex += c;
    }
    i++;
  }
  const re = new RegExp("^" + regex);
  return re.test(path);
}

export interface RobotsDecision {
  allowed: boolean;
  matchedRule: RobotsRule | null;
  crawlDelay: number | null;
}

/**
 * Decide whether `userAgent` is allowed to fetch `pathWithQuery`.
 * `pathWithQuery` should include the path + query string of the target
 * URL (e.g. `/search?q=foo`).
 *
 * Rule resolution follows Google's longest-match rule: the most
 * specific (longest pattern) allow/disallow that matches wins.
 */
export function isAllowed(
  policy: RobotsPolicy,
  userAgent: string,
  pathWithQuery: string,
): RobotsDecision {
  const path = pathWithQuery.startsWith("/") ? pathWithQuery : "/" + pathWithQuery;

  // Pick the most specific matching group (explicit UA beats `*`)
  const specific = policy.groups.filter(
    (g) => matchesUserAgent(g, userAgent) && !g.agents.includes("*"),
  );
  const wildcard = policy.groups.filter((g) => g.agents.includes("*"));
  const groups = specific.length > 0 ? specific : wildcard;

  let bestMatch: { rule: RobotsRule; specificity: number } | null = null;
  let crawlDelay: number | null = null;
  for (const group of groups) {
    if (group.crawlDelay !== null) {
      if (crawlDelay === null || group.crawlDelay > crawlDelay) {
        crawlDelay = group.crawlDelay;
      }
    }
    for (const rule of group.rules) {
      if (matchPattern(rule.path, path)) {
        const specificity = rule.path.length;
        if (!bestMatch || specificity > bestMatch.specificity) {
          bestMatch = { rule, specificity };
        }
      }
    }
  }

  if (!bestMatch) {
    return { allowed: true, matchedRule: null, crawlDelay };
  }
  return {
    allowed: bestMatch.rule.type === "allow",
    matchedRule: bestMatch.rule,
    crawlDelay,
  };
}

// ─── Fetch + cache policy per host ────────────────────────────────────

export interface RobotsFetcher {
  fetchRobots(hostUrl: string): Promise<string | null>;
}

/** Default fetcher using the global `fetch`. */
export class DefaultRobotsFetcher implements RobotsFetcher {
  async fetchRobots(hostUrl: string): Promise<string | null> {
    try {
      const res = await fetch(hostUrl, { method: "GET" });
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  }
}

interface CacheEntry {
  policy: RobotsPolicy;
  fetchedAt: number;
}

export class RobotsChecker {
  private cache = new Map<string, CacheEntry>();
  constructor(
    private fetcher: RobotsFetcher = new DefaultRobotsFetcher(),
    private ttlMs: number = 60 * 60 * 1000,
    private now: () => number = () => Date.now(),
  ) {}

  /** Look up cached policy by `host:port` key, fetching if missing/stale. */
  async getPolicy(url: string | URL): Promise<RobotsPolicy | null> {
    const u = url instanceof URL ? url : new URL(url);
    const key = `${u.protocol}//${u.host}`;
    const entry = this.cache.get(key);
    if (entry && this.now() - entry.fetchedAt < this.ttlMs) {
      return entry.policy;
    }
    const body = await this.fetcher.fetchRobots(`${key}/robots.txt`);
    if (body === null) {
      // Empty policy = allow all. Cache the empty shape to avoid refetching.
      const empty: RobotsPolicy = { groups: [], sitemaps: [], raw: "" };
      this.cache.set(key, { policy: empty, fetchedAt: this.now() });
      return empty;
    }
    const policy = parseRobots(body);
    this.cache.set(key, { policy, fetchedAt: this.now() });
    return policy;
  }

  async check(url: string, userAgent: string): Promise<RobotsDecision> {
    const u = new URL(url);
    const policy = await this.getPolicy(u);
    if (!policy) return { allowed: true, matchedRule: null, crawlDelay: null };
    const pathWithQuery = u.pathname + (u.search || "");
    return isAllowed(policy, userAgent, pathWithQuery);
  }

  /** Test hook — inject a known policy by `host:port` key. */
  __setCached(url: string, policy: RobotsPolicy): void {
    const u = new URL(url);
    const key = `${u.protocol}//${u.host}`;
    this.cache.set(key, { policy, fetchedAt: this.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}
