/**
 * Nav reachability regression test — pass 54.
 *
 * Motivation: a user flagged that several features documented in
 * CLAUDE.md (AI Agents, Code Chat, autonomous coding loop, etc.) were
 * routable in App.tsx but NOT in the sidebar, so a regular user could
 * not discover or verify them. This was the same failure mode that
 * bit pass 46 (webhook routers mounted in code but never merged into
 * appRouter).
 *
 * This test reads both files directly (no TS eval — pure regex) and
 * enforces two invariants:
 *
 *   1. Every nav href points at a registered route in App.tsx (so
 *      navigation never shows a dead link).
 *   2. Every "user-facing" route in App.tsx that isn't a system page,
 *      detail page, redirect, or settings sub-route must exist in
 *      some nav array — so no shipped page is completely hidden.
 *
 * Known exempt routes are allowlisted explicitly below. Adding a new
 * user-facing page without either a nav entry or an allowlist entry
 * will break this test, forcing the author to make a deliberate
 * discoverability decision.
 */
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");

function readFile(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf-8");
}

/** Extract every `path="/foo"` or `path={"/foo"}` from App.tsx. */
function extractAppRoutes(src: string): string[] {
  const out = new Set<string>();
  const re = /\bpath\s*=\s*\{?\s*"([^"]+)"\s*\}?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    out.add(m[1]);
  }
  return Array.from(out);
}

/** Extract every `href: "/foo"` from navigation.ts. */
function extractNavHrefs(src: string): string[] {
  const out = new Set<string>();
  const re = /href:\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    out.add(m[1]);
  }
  return Array.from(out);
}

/**
 * Known-exempt routes. These are reachable, but they're either:
 *  - deep links / detail pages (`/leads/:id`, `/chat/:id`)
 *  - public / pre-auth pages (`/signin`, `/terms`, `/privacy`)
 *  - settings sub-routes driven by `/settings`
 *  - redirect shims from legacy URLs (handled by wouter <Redirect>)
 *  - wrapper routes whose parent is in nav (learning subpages)
 *
 * Everything else must show up in nav.
 */
const EXEMPT_ROUTES = new Set<string>([
  // Public / auth
  "/",
  "/signin",
  "/org/:slug",
  "/welcome",
  "/terms",
  "/privacy",
  "/unsubscribe",
  "/404",
  // Deep-linked detail / id routes
  "/chat/:id",
  "/leads/:id",
  "/advisor/:id",
  "/settings/:tab",
  "/learning/studio/:tab",
  "/learning/tracks/:slug",
  // Feature sub-pages whose parent IS in nav (learning track detail + its
  // flashcard / quiz sub-routes are reached by clicking a track on
  // /learning, so they don't need their own sidebar entries)
  "/calculators",
  "/consensus",
  "/products",
  "/insurance-applications",
  "/advisory-execution",
  "/carrier-connector",
  "/my-integrations",
  "/suitability-panel",
  "/admin/bcp",
  "/admin/fairness",
  "/admin/knowledge",
  "/admin/integrations",
  "/admin/intelligence",
  "/admin/team",
  "/admin/billing",
  "/admin/api-keys",
  "/admin/webhooks",
  "/product-intelligence",
  "/passive-actions",
  "/org-branding",
  "/wealth-engine/strategy-comparison",
  "/wealth-engine/retirement",
  "/wealth-engine/practice-to-wealth",
  "/wealth-engine/quick-quote",
  // Public / embed / calculator widgets
  "/public-calculators",
  "/embed",
  // Lead / import flow (accessed from /relationships hub)
  "/import",
  "/leads",
  "/crm-sync",
  "/compliance-audit",
  "/tax-planning",
  "/insurance-analysis",
  "/estate",
  "/social-security",
  "/medicare",
  "/risk-assessment",
  "/income-projection",
  "/client-onboarding",
  // Wrappers / drawers
  "/ai-settings",
  "/suitability",
  "/changelog",
  // Legacy → hub redirects (handled by wouter <Redirect>)
  "/study",
  "/education",
  "/meetings",
  "/coach",
  "/planning",
  "/insights",
  "/student-loans",
  "/equity-comp",
  "/digital-assets",
  "/agentic",
  "/agent-operations",
  "/licensed-review",
  "/compliance",
  "/data-intelligence",
  "/analytics-hub",
  "/model-results",
  "/intelligence",
  "/insurance-quotes",
  "/estate-planning",
  "/premium-finance",
  "/marketplace",
  "/coi-network",
  "/email-campaigns",
  "/professionals",
]);

describe("Navigation reachability", () => {
  const appSrc = readFile("client/src/App.tsx");
  const navSrc = readFile("client/src/lib/navigation.ts");
  const appRoutes = extractAppRoutes(appSrc);
  const navHrefs = extractNavHrefs(navSrc);

  it("extracts a sane number of routes from App.tsx", () => {
    expect(appRoutes.length).toBeGreaterThan(50);
  });

  it("extracts a sane number of nav hrefs", () => {
    // Tools + Admin + Utility ≳ 25 items
    expect(navHrefs.length).toBeGreaterThan(25);
  });

  it("every nav href is a registered app route", () => {
    // Compile each app route into a regex. Convert `:param` to `[^/]+`
    // so parameterized routes like `/settings/:tab` match concrete hrefs
    // like `/settings/profile`.
    const routePatterns = appRoutes.map((r) => ({
      raw: r,
      re: new RegExp(
        "^" + r.replace(/\//g, "\\/").replace(/:[a-zA-Z]+/g, "[^/]+") + "$",
      ),
    }));
    const missing = navHrefs.filter(
      (h) => !routePatterns.some((p) => p.re.test(h)),
    );
    expect(missing).toEqual([]);
  });

  it("every non-exempt app route is surfaced in some nav array", () => {
    const navSet = new Set(navHrefs);
    const orphans = appRoutes.filter(
      (r) =>
        !navSet.has(r) &&
        !EXEMPT_ROUTES.has(r) &&
        // Skip parameterized routes entirely
        !r.includes(":") &&
        // Skip base /settings (covered by /settings/profile in nav)
        r !== "/settings",
    );
    expect(orphans).toEqual([]);
  });

  it("Code Chat is reachable via nav (admin)", () => {
    expect(navHrefs).toContain("/code-chat");
    expect(navSrc).toMatch(/href:\s*"\/code-chat".*minRole:\s*"admin"/s);
  });

  it("AI Agents is reachable via nav (advisor+)", () => {
    expect(navHrefs).toContain("/agents");
    expect(navSrc).toMatch(/href:\s*"\/agents".*minRole:\s*"advisor"/s);
  });
});
