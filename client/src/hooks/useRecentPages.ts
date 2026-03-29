/**
 * useRecentPages — Tracks recently visited pages for the command palette.
 *
 * Stores up to 5 recent pages in localStorage, deduplicates by route,
 * and orders most-recent-first. Follows the "Recent-first palette" pattern
 * recommended by uxpatterns.dev, VS Code, Superhuman, and Linear.
 */
import { useEffect, useCallback, useSyncExternalStore } from "react";

const LS_KEY = "stewardly-recent-pages";
const MAX_ENTRIES = 5;

export interface RecentPage {
  route: string;
  label: string;
  visitedAt: number; // Unix timestamp ms
}

// ─── External store for cross-component reactivity ─────────────────
let listeners: Array<() => void> = [];
let snapshot: RecentPage[] = loadFromStorage();

function loadFromStorage(): RecentPage[] {
  try {
    const stored = localStorage.getItem(LS_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (p: any) =>
          typeof p.route === "string" &&
          typeof p.label === "string" &&
          typeof p.visitedAt === "number"
      )
      .slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

function persist(pages: RecentPage[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(pages));
  } catch {}
  snapshot = pages;
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot() {
  return snapshot;
}

// ─── Route → label mapping ─────────────────────────────────────────
const ROUTE_LABELS: Record<string, string> = {
  "/chat": "Chat",
  "/operations": "Operations Hub",
  "/intelligence-hub": "Intelligence Hub",
  "/advisory": "Advisory Hub",
  "/relationships": "Relationships",
  "/market-data": "Market Data",
  "/documents": "Documents",
  "/integrations": "Integrations",
  "/settings/profile": "Settings",
  "/help": "Help & Support",
  "/calculators": "Calculators",
  "/products": "Products",
  "/integration-health": "Integration Health",
  "/passive-actions": "Passive Actions",
  "/proficiency": "My Progress",
  "/portal": "Portal",
  "/organizations": "Organizations",
  "/manager": "Manager Dashboard",
  "/admin": "Global Admin",
  "/improvement": "Improvement Engine",
  "/changelog": "Changelog",
  "/analytics": "Analytics Hub",
};

function labelForRoute(route: string): string {
  // Exact match first
  if (ROUTE_LABELS[route]) return ROUTE_LABELS[route];
  // Try prefix match (e.g. /settings/shortcuts → Settings)
  const prefix = Object.keys(ROUTE_LABELS).find((k) => route.startsWith(k));
  if (prefix) return ROUTE_LABELS[prefix];
  // Fallback: capitalize the last segment
  const segments = route.split("/").filter(Boolean);
  const last = segments[segments.length - 1] || "Page";
  return last.charAt(0).toUpperCase() + last.slice(1).replace(/-/g, " ");
}

// ─── Public API ────────────────────────────────────────────────────

/** Record a page visit. Call from AppShell or a route change listener. */
export function recordPageVisit(route: string) {
  // Skip non-page routes and auth callbacks
  if (!route || route === "/" || route.includes("/oauth") || route.includes("/callback")) return;

  const label = labelForRoute(route);
  const now = Date.now();

  const current = loadFromStorage();
  // Remove existing entry for this route (dedup)
  const filtered = current.filter((p) => p.route !== route);
  // Prepend new entry
  const next = [{ route, label, visitedAt: now }, ...filtered].slice(0, MAX_ENTRIES);
  persist(next);
}

/** Clear all recent pages */
export function clearRecentPages() {
  persist([]);
  try {
    localStorage.removeItem(LS_KEY);
  } catch {}
}

/** React hook that subscribes to recent pages changes */
export function useRecentPages() {
  const recentPages = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const record = useCallback((route: string) => {
    recordPageVisit(route);
  }, []);

  const clear = useCallback(() => {
    clearRecentPages();
  }, []);

  return { recentPages, record, clear };
}
