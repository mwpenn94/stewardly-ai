/**
 * webTool — thin server-side wrapper around the shared WebNavigator
 * primitive from `server/shared/automation/webNavigator.ts`. Holds a
 * singleton instance so the per-domain rate limiter survives across
 * code-chat tool dispatches in the same process.
 *
 * Configuration is driven by environment variables so ops can tighten
 * the allow/deny list without redeploying code:
 *   - WEB_TOOL_ALLOW_HOSTS       comma-separated allow-list (optional)
 *   - WEB_TOOL_DENY_HOSTS        comma-separated deny-list (optional)
 *   - WEB_TOOL_RATE_LIMIT_PER_MIN  integer (default 30)
 *   - WEB_TOOL_MAX_BYTES         integer bytes (default 2_000_000)
 *
 * The defaults are intentionally permissive for public hosts since this
 * is meant to power generic research + research-augmented chat; rely on
 * the hard private-IP filter in webNavigator to stop SSRF attempts.
 */

import { WebNavigator, type NavigationConfig } from "../../shared/automation/webNavigator";
import { RobotsChecker } from "../../shared/automation/robotsPolicy";
import { ResponseCache } from "../../shared/automation/responseCache";

let _navigator: WebNavigator | null = null;
let _robotsChecker: RobotsChecker | null = null;
let _cache: ResponseCache | null = null;

function parseList(v: string | undefined): string[] | undefined {
  if (!v) return undefined;
  const list = v
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  return list.length > 0 ? list : undefined;
}

function parseInt0(v: string | undefined, fallback: number): number {
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function buildNavigatorConfigFromEnv(env: NodeJS.ProcessEnv = process.env): NavigationConfig {
  const honorRobots = env.WEB_TOOL_HONOR_ROBOTS !== "false"; // default: true
  const checker = honorRobots ? getOrCreateRobotsChecker() : undefined;
  const cacheEnabled = env.WEB_TOOL_CACHE !== "false"; // default: true
  const cache = cacheEnabled ? getOrCreateCache(env) : undefined;
  return {
    allowHosts: parseList(env.WEB_TOOL_ALLOW_HOSTS),
    denyHosts: parseList(env.WEB_TOOL_DENY_HOSTS),
    rateLimitPerMin: parseInt0(env.WEB_TOOL_RATE_LIMIT_PER_MIN, 30),
    maxBytes: parseInt0(env.WEB_TOOL_MAX_BYTES, 2_000_000),
    robotsChecker: checker,
    honorRobots,
    cache,
  };
}

function getOrCreateRobotsChecker(): RobotsChecker {
  if (!_robotsChecker) {
    _robotsChecker = new RobotsChecker();
  }
  return _robotsChecker;
}

function getOrCreateCache(env: NodeJS.ProcessEnv): ResponseCache {
  if (!_cache) {
    _cache = new ResponseCache({
      maxEntries: parseInt0(env.WEB_TOOL_CACHE_MAX_ENTRIES, 256),
      defaultMaxAgeMs: parseInt0(env.WEB_TOOL_CACHE_MAX_AGE_MS, 5 * 60 * 1000),
      defaultStaleMs: parseInt0(env.WEB_TOOL_CACHE_STALE_MS, 10 * 60 * 1000),
    });
  }
  return _cache;
}

export function getWebResponseCache(): ResponseCache | null {
  return _cache;
}

/**
 * Lazy singleton. Tests can reset via `__resetWebNavigator()` below
 * to exercise fresh state / supply a stub adapter.
 */
export function getWebNavigator(): WebNavigator {
  if (!_navigator) {
    _navigator = new WebNavigator(buildNavigatorConfigFromEnv());
  }
  return _navigator;
}

export function __setWebNavigator(nav: WebNavigator | null): void {
  _navigator = nav;
}

export function __resetWebNavigator(): void {
  _navigator = null;
  _robotsChecker = null;
  _cache = null;
}
