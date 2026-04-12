/**
 * routeMap.test.ts — asserts every destination in ROUTE_MAP corresponds
 * to a real <Route path=...> in `client/src/App.tsx`. Without this check,
 * a user saying "go to connection map" ends up on a 404 page.
 *
 * This is a source-text test because:
 *   - we can't import App.tsx (React + pages + lazy imports blow up node env)
 *   - wouter route strings are string literals in the JSX — grep-able
 *   - we want the test to fail LOUDLY if someone refactors routes without
 *     updating the map
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { ROUTE_MAP, routeMapDestinations } from "./intentParser";

const APP_TSX = path.resolve(
  __dirname,
  "../../..",
  "src",
  "App.tsx",
);
const source = fs.readFileSync(APP_TSX, "utf-8");

/**
 * Collect every `<Route path={"..."}>` / `<Route path="...">` target and
 * every `<Redirect to="..."/>` target. If ROUTE_MAP lands on either, it's
 * reachable (redirects are a valid resolution).
 */
function collectRoutePaths(src: string): Set<string> {
  const routes = new Set<string>();

  // <Route path={"/foo"} ...>  AND  <Route path="/foo" ...>
  const routeRegex = /<Route\s+path=(?:\{)?["'`]([^"'`]+)["'`]\}?/g;
  let m: RegExpExecArray | null;
  while ((m = routeRegex.exec(src)) !== null) {
    routes.add(normalize(m[1]));
  }

  // <Redirect to="/foo"/>  (destinations reachable via redirects)
  const redirectRegex = /<Redirect\s+to=["']([^"']+)["']/g;
  while ((m = redirectRegex.exec(src)) !== null) {
    routes.add(normalize(m[1]));
  }

  return routes;
}

/**
 * Normalize a wouter route string down to a prefix we can match ROUTE_MAP
 * entries against. `/settings/:tab` → `/settings`. `/leads/:id` → `/leads`.
 * `/learning/tracks/:slug/study` → `/learning/tracks`.
 */
function normalize(p: string): string {
  // Strip wouter route params but keep their parent
  return p.replace(/\/:[^/]+.*/, "");
}

/**
 * True iff the destination is reachable. A destination matches if the
 * normalized App.tsx route set contains it OR any of its prefix segments
 * corresponds to a parametric parent route.
 */
function isReachable(destination: string, appRoutes: Set<string>): boolean {
  const target = destination.replace(/\/+$/, ""); // strip trailing slash
  if (appRoutes.has(target)) return true;

  // Try prefix walk: /settings/audio → /settings/audio present as
  // explicit route, or /settings is (which handles /settings/:tab).
  const parts = target.split("/").filter(Boolean);
  for (let i = parts.length; i > 0; i--) {
    const prefix = "/" + parts.slice(0, i).join("/");
    if (appRoutes.has(prefix)) return true;
  }
  return false;
}

describe("ROUTE_MAP reachability vs App.tsx", () => {
  const appRoutes = collectRoutePaths(source);

  it("collects a non-empty set of routes from App.tsx", () => {
    expect(appRoutes.size).toBeGreaterThan(50);
    expect(appRoutes.has("/chat")).toBe(true);
    expect(appRoutes.has("/learning")).toBe(true);
    expect(appRoutes.has("/settings")).toBe(true);
  });

  it("every ROUTE_MAP destination resolves to a real route", () => {
    const unreachable: string[] = [];
    for (const dest of routeMapDestinations()) {
      if (!isReachable(dest, appRoutes)) {
        unreachable.push(dest);
      }
    }
    expect(
      unreachable,
      `Unreachable ROUTE_MAP destinations (no matching <Route path=> or parent):\n  ${unreachable.join("\n  ")}`,
    ).toEqual([]);
  });

  it("every phrasing in ROUTE_MAP points to a reachable destination", () => {
    const broken: Array<{ phrase: string; dest: string }> = [];
    for (const [phrase, dest] of Object.entries(ROUTE_MAP)) {
      if (!isReachable(dest, appRoutes)) {
        broken.push({ phrase, dest });
      }
    }
    expect(
      broken,
      `Phrases that would produce 404s:\n  ${broken.map((b) => `"${b.phrase}" → ${b.dest}`).join("\n  ")}`,
    ).toEqual([]);
  });
});
