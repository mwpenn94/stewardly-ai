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

let _navigator: WebNavigator | null = null;

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
  return {
    allowHosts: parseList(env.WEB_TOOL_ALLOW_HOSTS),
    denyHosts: parseList(env.WEB_TOOL_DENY_HOSTS),
    rateLimitPerMin: parseInt0(env.WEB_TOOL_RATE_LIMIT_PER_MIN, 30),
    maxBytes: parseInt0(env.WEB_TOOL_MAX_BYTES, 2_000_000),
  };
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
}
