/**
 * Robots.txt Checker — Fetch and parse robots.txt before any scrape
 */
import { logger } from "../../_core/logger";

const log = logger.child({ module: "robotsChecker" });
const cache = new Map<string, { rules: string; fetchedAt: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

export async function isAllowed(url: string, userAgent = "*"): Promise<boolean> {
  try {
    const origin = new URL(url).origin;
    let robots = cache.get(origin);

    if (!robots || Date.now() - robots.fetchedAt > CACHE_TTL) {
      const res = await fetch(`${origin}/robots.txt`, { signal: AbortSignal.timeout(5000) });
      const text = res.ok ? await res.text() : "";
      robots = { rules: text, fetchedAt: Date.now() };
      cache.set(origin, robots);
    }

    // Simple parser: check Disallow rules for matching user-agent
    const lines = robots.rules.split("\n");
    let inBlock = false;
    const path = new URL(url).pathname;

    for (const line of lines) {
      const trimmed = line.trim().toLowerCase();
      if (trimmed.startsWith("user-agent:")) {
        const agent = trimmed.replace("user-agent:", "").trim();
        inBlock = agent === "*" || agent === userAgent.toLowerCase();
      }
      if (inBlock && trimmed.startsWith("disallow:")) {
        const disallowed = trimmed.replace("disallow:", "").trim();
        if (disallowed && path.startsWith(disallowed)) return false;
      }
    }
    return true;
  } catch (e: any) {
    log.warn({ url, error: e.message }, "robots.txt check failed — allowing by default");
    return true;
  }
}
