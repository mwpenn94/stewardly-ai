/**
 * useFocusOnRouteChange.ts — WCAG 2.4.3 focus-after-nav hook
 *
 * Build Loop Pass 3 (G60). Prior to this, navigating via a g-chord (g+c, g+h)
 * or a sidebar click would update the URL and render the new page, but the
 * focus ring stayed on the sidebar item. For a screen reader user this means
 * they're still "on" the nav item; when they press Tab they move deeper into
 * the sidebar instead of into the page content they just opened. This is a
 * Level A WCAG 2.4.3 Focus Order failure — the de facto ship blocker for
 * any accessibility claim.
 *
 * Fix: after every route change, focus the element with `id="main-content"`
 * (or a caller-provided id). The main container is already `tabIndex={-1}`
 * in AppShell + Chat, so programmatic focus works without making it a tab
 * stop. The hook also injects a live region announcement so screen readers
 * get a spoken "Clients" / "Chat" / "Compliance Audit" marker on arrival.
 *
 * Pure-function helpers (focusMainRegion, describePath) are exported for
 * unit testing. The hook wires them to wouter's location.
 */

import { useEffect } from "react";
import { useLocation } from "wouter";

/** Default mapping from path prefix → human-readable name for SR announcements. */
const DEFAULT_PATH_NAMES: Array<{ prefix: string; name: string }> = [
  { prefix: "/chat", name: "Chat" },
  { prefix: "/relationships", name: "Clients" },
  { prefix: "/my-work", name: "My Work" },
  { prefix: "/compliance-audit", name: "Compliance Audit" },
  { prefix: "/market-data", name: "Market Data" },
  { prefix: "/wealth-engine", name: "Calculators" },
  { prefix: "/calculators", name: "Calculators" },
  { prefix: "/learning", name: "Learning Center" },
  { prefix: "/settings/audio", name: "Audio Preferences" },
  { prefix: "/settings/knowledge", name: "Knowledge & Documents" },
  { prefix: "/settings", name: "Settings" },
  { prefix: "/help", name: "Help" },
  { prefix: "/documents", name: "Documents" },
  { prefix: "/progress", name: "Progress" },
  { prefix: "/proficiency", name: "Proficiency" },
  { prefix: "/manager", name: "Team Dashboard" },
  { prefix: "/admin", name: "Platform Admin" },
  { prefix: "/financial-twin", name: "Financial Twin" },
  { prefix: "/suitability", name: "Suitability" },
  { prefix: "/recommendations", name: "Recommendations" },
  { prefix: "/insights", name: "Insights" },
  { prefix: "/intelligence-hub", name: "Intelligence Hub" },
  { prefix: "/workflows", name: "Workflows" },
  { prefix: "/consensus", name: "Consensus" },
  { prefix: "/achievements", name: "Achievements" },
  { prefix: "/code-chat", name: "Code Chat" },
  { prefix: "/welcome", name: "Welcome" },
  { prefix: "/", name: "Home" },
];

/**
 * Pure function — given a path, return a human-readable page name.
 * Longest prefix wins (so /settings/audio beats /settings).
 * Exported for tests.
 */
export function describePath(
  path: string,
  overrides?: Record<string, string>,
): string {
  if (!path) return "page";
  const sorted = [...DEFAULT_PATH_NAMES].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const { prefix, name } of sorted) {
    if (path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`)) {
      return overrides?.[prefix] || name;
    }
  }
  // Fall back to the last segment with title-case
  const seg = path.split("/").filter(Boolean).pop() || "page";
  return seg.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Pure function — focus an element by id, re-reading the DOM each call so
 * late-mounted pages still get focus. Returns true if focus landed, false
 * otherwise. Exported for tests (with a DOM mock).
 */
export function focusMainRegion(
  id: string = "main-content",
  doc: Document = typeof document !== "undefined" ? document : (undefined as any),
): boolean {
  if (!doc) return false;
  const el = doc.getElementById(id);
  if (!el) return false;
  // Don't steal focus if the user is mid-typing in an input or textarea;
  // this can happen during HMR or when a mutation changes the route.
  const active = doc.activeElement as HTMLElement | null;
  if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)) {
    return false;
  }
  // Scroll the element into view before focusing — otherwise Safari won't
  // visually follow focus when the target is off-screen.
  try {
    el.scrollIntoView({ block: "start" });
  } catch {
    /* ignore */
  }
  // `preventScroll` on focus: the explicit scrollIntoView above already
  // positioned us; calling focus() here without preventScroll would
  // re-trigger a duplicate jump in some browsers.
  try {
    el.focus({ preventScroll: true });
  } catch {
    el.focus();
  }
  return doc.activeElement === el;
}

/**
 * Announce a string to the aria-live region. Creates the region on first
 * call, reuses it afterwards. Exported for tests.
 */
export function announceRoute(
  text: string,
  doc: Document = typeof document !== "undefined" ? document : (undefined as any),
): void {
  if (!doc) return;
  const LIVE_REGION_ID = "stewardly-route-announcer";
  let region = doc.getElementById(LIVE_REGION_ID);
  if (!region) {
    region = doc.createElement("div");
    region.id = LIVE_REGION_ID;
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", "polite");
    region.setAttribute("aria-atomic", "true");
    // Visually hidden but still read by SR.
    region.style.cssText =
      "position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);";
    doc.body.appendChild(region);
  }
  // Clearing before setting forces SR to re-read identical text.
  region.textContent = "";
  // Small timeout lets the DOM mutation settle before the update.
  setTimeout(() => {
    if (region) region.textContent = text;
  }, 20);
}

/**
 * React hook — wires focusMainRegion + announceRoute to wouter's location.
 * Call once inside a layout shell (AppShell, Chat) and every route change
 * will (a) focus main content and (b) announce the new page to SR users.
 */
export function useFocusOnRouteChange(options?: {
  mainId?: string;
  overrides?: Record<string, string>;
  /** If false, skip the aria-live announcement (useful for pages with their own live region). */
  announce?: boolean;
}): void {
  const [location] = useLocation();
  useEffect(() => {
    const id = options?.mainId || "main-content";
    // Defer until the next frame so the new page has a chance to mount.
    const handle = window.requestAnimationFrame(() => {
      focusMainRegion(id);
      if (options?.announce !== false) {
        announceRoute(describePath(location, options?.overrides));
      }
    });
    return () => window.cancelAnimationFrame(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);
}
