/**
 * Run Timeline — a rolling log of every calculator run in the
 * current session, surfaced as a unified timeline across
 * calculators. Purely client-side (localStorage-backed) so the
 * user sees their run history without additional backend load.
 *
 * Force-multiplier intent: before this store, every calculator
 * lived in isolation. Users forgot which scenarios they had
 * already tried and couldn't recall why a particular input set
 * produced an outcome. The timeline:
 *
 *   1. Auto-records every meaningful run with tool / input
 *      summary / top-line output / timestamp.
 *   2. Surfaces a session breadcrumb panel that can reopen any
 *      prior run by emitting a custom window event with the
 *      saved inputs — individual calculators subscribe and
 *      rehydrate their local state.
 *   3. Accumulates stats (total runs, tools used, avg
 *      confidence) that the session analytics dashboard can
 *      consume.
 *
 * Pass 11 history: ships gap G11 from docs/PARITY.md.
 */

export interface TimelineEntry {
  /** Stable id for deduping + reopen-by-id lookups. */
  id: string;
  /** Canonical tool name — matches the persistComputation tool enum. */
  tool: string;
  /** Human-readable tool label for the UI ("BIE Quick Quote", etc.). */
  label: string;
  /** Short text summary of the key inputs ("Director, $250k GDC, 30y"). */
  inputSummary: string;
  /** One-line summary of the top-line output ("$1.2M final wealth"). */
  outputSummary: string;
  /** ISO timestamp. */
  timestamp: string;
  /** 0..1 confidence score from CompletenessGate if the caller passes it. */
  confidence?: number;
  /** Optional navigation route the "reopen" button should navigate to. */
  route?: string;
  /** Optional calculator-owned inputs blob for rehydration. */
  inputs?: Record<string, unknown>;
}

export interface RunTimeline {
  version: number;
  entries: TimelineEntry[];
}

export const RUN_TIMELINE_STORAGE_KEY = "stewardly_run_timeline";
export const RUN_TIMELINE_VERSION = 1;
export const RUN_TIMELINE_MAX_ENTRIES = 200;

export const EMPTY_TIMELINE: RunTimeline = Object.freeze({
  version: RUN_TIMELINE_VERSION,
  entries: [],
});

// ─── Parse / serialize ───────────────────────────────────────────────────

/**
 * Defensive parse. Tolerates malformed JSON and non-object wrappers.
 * Drops invalid entries (missing id / tool / timestamp).
 */
export function parseTimeline(raw: string | null): RunTimeline {
  if (!raw || typeof raw !== "string") return { ...EMPTY_TIMELINE };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...EMPTY_TIMELINE };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ...EMPTY_TIMELINE };
  }
  const obj = parsed as Record<string, unknown>;
  const rawEntries = Array.isArray(obj.entries) ? obj.entries : [];
  const entries: TimelineEntry[] = [];
  for (const e of rawEntries) {
    if (!e || typeof e !== "object") continue;
    const entry = e as Record<string, unknown>;
    if (typeof entry.id !== "string") continue;
    if (typeof entry.tool !== "string") continue;
    if (typeof entry.timestamp !== "string") continue;
    entries.push({
      id: entry.id,
      tool: entry.tool,
      label: typeof entry.label === "string" ? entry.label.slice(0, 200) : entry.tool,
      inputSummary:
        typeof entry.inputSummary === "string"
          ? entry.inputSummary.slice(0, 500)
          : "",
      outputSummary:
        typeof entry.outputSummary === "string"
          ? entry.outputSummary.slice(0, 500)
          : "",
      timestamp: entry.timestamp,
      confidence:
        typeof entry.confidence === "number" &&
        Number.isFinite(entry.confidence)
          ? Math.max(0, Math.min(1, entry.confidence))
          : undefined,
      route: typeof entry.route === "string" ? entry.route : undefined,
      inputs:
        entry.inputs && typeof entry.inputs === "object" && !Array.isArray(entry.inputs)
          ? (entry.inputs as Record<string, unknown>)
          : undefined,
    });
  }
  return { version: RUN_TIMELINE_VERSION, entries };
}

export function serializeTimeline(t: RunTimeline): string {
  return JSON.stringify({
    version: RUN_TIMELINE_VERSION,
    entries: t.entries,
  });
}

// ─── Mutations (pure) ────────────────────────────────────────────────

/**
 * Append a new entry to the timeline. Newest first, dropping the
 * oldest when over the cap. Dedupes by identical tool +
 * inputSummary within a 10-second window so double-clicks don't
 * spam the timeline.
 */
export function appendEntry(
  timeline: RunTimeline,
  entry: Omit<TimelineEntry, "id" | "timestamp"> & { id?: string; timestamp?: string },
): RunTimeline {
  const now = new Date().toISOString();
  const normalized: TimelineEntry = {
    id:
      entry.id ??
      `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    tool: entry.tool,
    label: entry.label.slice(0, 200),
    inputSummary: entry.inputSummary.slice(0, 500),
    outputSummary: entry.outputSummary.slice(0, 500),
    timestamp: entry.timestamp ?? now,
    confidence: entry.confidence,
    route: entry.route,
    inputs: entry.inputs,
  };

  // Dedupe: same tool + same inputSummary within 10s → replace the
  // older entry so only the latest run sticks.
  const dedupeWindowMs = 10_000;
  const nowMs = Date.parse(normalized.timestamp);
  const filtered = timeline.entries.filter((e) => {
    if (e.tool !== normalized.tool) return true;
    if (e.inputSummary !== normalized.inputSummary) return true;
    const diff = nowMs - Date.parse(e.timestamp);
    return !(diff >= 0 && diff < dedupeWindowMs);
  });

  const entries = [normalized, ...filtered].slice(0, RUN_TIMELINE_MAX_ENTRIES);
  return { version: RUN_TIMELINE_VERSION, entries };
}

export function removeEntry(timeline: RunTimeline, id: string): RunTimeline {
  return {
    version: RUN_TIMELINE_VERSION,
    entries: timeline.entries.filter((e) => e.id !== id),
  };
}

export function clearTimeline(): RunTimeline {
  return { ...EMPTY_TIMELINE };
}

// ─── Queries ──────────────────────────────────────────────────────────

export function findEntry(timeline: RunTimeline, id: string): TimelineEntry | undefined {
  return timeline.entries.find((e) => e.id === id);
}

export function filterByTool(
  timeline: RunTimeline,
  tool: string,
): TimelineEntry[] {
  return timeline.entries.filter((e) => e.tool === tool);
}

/** Group entries by tool name for the "tools used" breakdown. */
export function groupByTool(
  timeline: RunTimeline,
): Record<string, { count: number; latestAt: string; latestLabel: string }> {
  const out: Record<
    string,
    { count: number; latestAt: string; latestLabel: string }
  > = {};
  for (const e of timeline.entries) {
    if (!out[e.tool]) {
      out[e.tool] = { count: 0, latestAt: e.timestamp, latestLabel: e.label };
    }
    out[e.tool].count++;
    if (e.timestamp > out[e.tool].latestAt) {
      out[e.tool].latestAt = e.timestamp;
      out[e.tool].latestLabel = e.label;
    }
  }
  return out;
}

export interface TimelineStats {
  totalRuns: number;
  uniqueTools: number;
  avgConfidence: number;
  /** Run count per calendar day (YYYY-MM-DD). */
  runsPerDay: Record<string, number>;
  /** Most-recent run (first entry) for the "last computed" chip. */
  newest: TimelineEntry | null;
}

export function timelineStats(timeline: RunTimeline): TimelineStats {
  if (timeline.entries.length === 0) {
    return {
      totalRuns: 0,
      uniqueTools: 0,
      avgConfidence: 0,
      runsPerDay: {},
      newest: null,
    };
  }
  const uniqueTools = new Set<string>();
  let confidenceSum = 0;
  let confidenceCount = 0;
  const runsPerDay: Record<string, number> = {};
  for (const e of timeline.entries) {
    uniqueTools.add(e.tool);
    if (typeof e.confidence === "number") {
      confidenceSum += e.confidence;
      confidenceCount++;
    }
    const day = e.timestamp.slice(0, 10);
    runsPerDay[day] = (runsPerDay[day] ?? 0) + 1;
  }
  return {
    totalRuns: timeline.entries.length,
    uniqueTools: uniqueTools.size,
    avgConfidence: confidenceCount > 0 ? confidenceSum / confidenceCount : 0,
    runsPerDay,
    newest: timeline.entries[0],
  };
}
