/**
 * Route prefetch map — maps sidebar nav hrefs to their dynamic import
 * functions. When a user hovers a sidebar link, we call the import()
 * to start downloading the chunk before they click.
 *
 * Only includes lazy-loaded routes (eagerly loaded ones like Chat,
 * Landing, SignIn are already in the main bundle).
 */

type PrefetchFn = () => Promise<unknown>;

const ROUTE_PREFETCH_MAP: Record<string, PrefetchFn> = {
  "/operations":         () => import("@/pages/OperationsHub"),
  "/intelligence-hub":   () => import("@/pages/IntelligenceHub"),
  "/advisory":           () => import("@/pages/AnalyticsHub"),
  "/relationships":      () => import("@/pages/RelationshipsHub"),
  "/market-data":        () => import("@/pages/MarketData"),
  "/documents":          () => import("@/pages/Documents"),
  "/integrations":       () => import("@/pages/Integrations"),
  "/integration-health": () => import("@/pages/IntegrationHealth"),
  "/passive-actions":    () => import("@/pages/PassiveActions"),
  "/proficiency":        () => import("@/pages/ProficiencyDashboard"),
  "/portal":             () => import("@/pages/Portal"),
  "/organizations":      () => import("@/pages/Organizations"),
  "/manager":            () => import("@/pages/ManagerDashboard"),
  "/admin":              () => import("@/pages/GlobalAdmin"),
  "/improvement":        () => import("@/pages/ImprovementEngine"),
  "/help":               () => import("@/pages/Help"),
  "/settings/profile":   () => import("@/pages/SettingsHub"),
  "/calculators":        () => import("@/pages/Calculators"),
  "/products":           () => import("@/pages/Products"),
};

// Track which routes have already been prefetched to avoid duplicate fetches
const prefetched = new Set<string>();

/**
 * Prefetch the JS chunk for a given route path.
 * Safe to call multiple times — subsequent calls are no-ops.
 * Errors are silently caught (prefetch is best-effort).
 */
export function prefetchRoute(href: string): void {
  if (prefetched.has(href)) return;

  const fn = ROUTE_PREFETCH_MAP[href];
  if (!fn) return;

  prefetched.add(href);
  // Fire-and-forget — we don't need the module, just want the browser to cache the chunk
  fn().catch(() => {
    // If prefetch fails, allow retry next time
    prefetched.delete(href);
  });
}

/**
 * Returns an onMouseEnter handler that prefetches the route chunk.
 * Designed to be spread onto a button/link element.
 */
export function usePrefetchProps(href: string) {
  return {
    onMouseEnter: () => prefetchRoute(href),
    onFocus: () => prefetchRoute(href),
  };
}
