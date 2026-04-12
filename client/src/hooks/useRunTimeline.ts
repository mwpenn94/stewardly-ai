/**
 * React binding for the run timeline store. Calculators call
 * `recordRun(...)` on successful mutations to append a breadcrumb
 * to the user's session timeline. Other components can call
 * `useRunTimeline()` to read the full timeline + stats.
 *
 * localStorage-backed, cross-tab synced via the storage event.
 * No backend round-trip.
 *
 * Pass 11 history: ships the React layer for gap G11.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  EMPTY_TIMELINE,
  RUN_TIMELINE_STORAGE_KEY,
  appendEntry,
  clearTimeline,
  parseTimeline,
  removeEntry,
  serializeTimeline,
  timelineStats,
  type RunTimeline,
  type TimelineEntry,
  type TimelineStats,
} from "@/stores/runTimeline";

function readFromStorage(): RunTimeline {
  if (typeof window === "undefined") return { ...EMPTY_TIMELINE };
  try {
    return parseTimeline(window.localStorage.getItem(RUN_TIMELINE_STORAGE_KEY));
  } catch {
    return { ...EMPTY_TIMELINE };
  }
}

function writeToStorage(t: RunTimeline) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RUN_TIMELINE_STORAGE_KEY, serializeTimeline(t));
  } catch {
    /* quota full — fall back to in-memory */
  }
}

export interface UseRunTimelineResult {
  timeline: RunTimeline;
  stats: TimelineStats;
  recordRun: (
    entry: Omit<TimelineEntry, "id" | "timestamp"> & {
      id?: string;
      timestamp?: string;
    },
  ) => void;
  removeRun: (id: string) => void;
  clearRuns: () => void;
}

export function useRunTimeline(): UseRunTimelineResult {
  const [timeline, setTimeline] = useState<RunTimeline>(() => readFromStorage());

  // Cross-tab sync
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: StorageEvent) => {
      if (e.key !== RUN_TIMELINE_STORAGE_KEY) return;
      setTimeline(readFromStorage());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const recordRun = useCallback<UseRunTimelineResult["recordRun"]>((entry) => {
    setTimeline((prev) => {
      const next = appendEntry(prev, entry);
      writeToStorage(next);
      return next;
    });
  }, []);

  const removeRun = useCallback((id: string) => {
    setTimeline((prev) => {
      const next = removeEntry(prev, id);
      writeToStorage(next);
      return next;
    });
  }, []);

  const clearRuns = useCallback(() => {
    setTimeline(() => {
      const next = clearTimeline();
      writeToStorage(next);
      return next;
    });
  }, []);

  const stats = useMemo(() => timelineStats(timeline), [timeline]);

  return { timeline, stats, recordRun, removeRun, clearRuns };
}
