/**
 * usePanelAnalytics — Track panel visits and surface recently used / most visited panels.
 * 
 * Stores visit counts and timestamps in localStorage.
 * Provides:
 * - recordVisit(panelId) — call when user navigates to a panel
 * - recentPanels — last 5 unique panels visited (by timestamp)
 * - topPanels — top 5 most-visited panels (by count)
 * - getVisitCount(panelId) — get visit count for a specific panel
 * - clearAnalytics() — reset all tracking data
 * 
 * v8 Pass 5
 */
import { useState, useCallback, useRef, useEffect } from 'react';

const STORAGE_KEY = 'wb-panel-analytics';
const MAX_RECENT = 5;
const MAX_TOP = 5;

interface PanelVisit {
  count: number;
  lastVisited: number; // timestamp
  firstVisited: number;
}

type AnalyticsStore = Record<string, PanelVisit>;

function loadStore(): AnalyticsStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStore(store: AnalyticsStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // localStorage full — silently fail
  }
}

export function usePanelAnalytics() {
  const [store, setStore] = useState<AnalyticsStore>(() => loadStore());
  const storeRef = useRef(store);
  storeRef.current = store;

  // Sync to localStorage whenever store changes
  useEffect(() => {
    saveStore(store);
  }, [store]);

  const recordVisit = useCallback((panelId: string) => {
    setStore(prev => {
      const existing = prev[panelId];
      const now = Date.now();
      return {
        ...prev,
        [panelId]: {
          count: (existing?.count || 0) + 1,
          lastVisited: now,
          firstVisited: existing?.firstVisited || now,
        },
      };
    });
  }, []);

  // Recently visited panels (sorted by lastVisited desc, top 5)
  const recentPanels = Object.entries(store)
    .sort(([, a], [, b]) => b.lastVisited - a.lastVisited)
    .slice(0, MAX_RECENT)
    .map(([id, data]) => ({ id, ...data }));

  // Most visited panels (sorted by count desc, top 5)
  const topPanels = Object.entries(store)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, MAX_TOP)
    .map(([id, data]) => ({ id, ...data }));

  const getVisitCount = useCallback((panelId: string) => {
    return storeRef.current[panelId]?.count || 0;
  }, []);

  const clearAnalytics = useCallback(() => {
    setStore({});
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

  const totalVisits = Object.values(store).reduce((sum, v) => sum + v.count, 0);
  const uniquePanels = Object.keys(store).length;

  return {
    recordVisit,
    recentPanels,
    topPanels,
    getVisitCount,
    clearAnalytics,
    totalVisits,
    uniquePanels,
  };
}
