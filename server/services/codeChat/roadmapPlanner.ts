/**
 * Roadmap planner — Round B4.
 *
 * Maintains a rolling optimization roadmap that the autonomous coding
 * loop can iterate on across multiple sessions. The roadmap is a
 * scored list of items with WSJF-style prioritization (Weighted
 * Shortest Job First):
 *
 *   priority = (businessValue + timeCriticality + riskReduction) / effort
 *
 * Each iteration:
 *  1. Loads the current roadmap from `model_runs` (slug = "roadmap")
 *  2. Asks the planner to score new items + reprioritize existing ones
 *  3. Picks the top N items
 *  4. Hands them off to `runAutonomousCoding` as subtasks
 *  5. After execution, marks done items + appends new items the
 *     planner suggested mid-flight
 *  6. Persists the updated roadmap back to `model_runs`
 *
 * The roadmap is intentionally simple: pure data + pure scoring
 * functions. The LLM only writes ITEMS, never priorities or
 * dependencies — the math is deterministic so the recursive
 * optimization toolkit can verify it.
 */

import { logger } from "../../_core/logger";

// ─── Types ────────────────────────────────────────────────────────────────

export type RoadmapStatus = "backlog" | "ready" | "in_progress" | "done" | "blocked" | "rejected";

export interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  status: RoadmapStatus;
  /** WSJF score components, 1-13 each (Fibonacci) */
  businessValue: number;
  timeCriticality: number;
  riskReduction: number;
  effort: number;
  /** Computed priority — derived, not user-supplied */
  priority?: number;
  /** Item IDs that must be done first */
  dependencies: string[];
  /** Optional tag for grouping in the UI */
  tag?: string;
  /** ISO timestamp of last update */
  updatedAt: string;
  /** Optional source — which iteration / pass added this item */
  addedBy?: string;
  /** Optional notes from the planner / executor */
  notes?: string;
}

export interface Roadmap {
  version: number;
  items: RoadmapItem[];
  lastIteration: number;
  lastUpdatedAt: string;
}

// ─── Pure scoring ─────────────────────────────────────────────────────────

/**
 * WSJF priority. Higher is more urgent.
 *   priority = (BV + TC + RR) / effort
 *
 * Effort is clamped to a minimum of 1 to avoid divide-by-zero.
 * Returns the computed value so callers can persist it as a
 * derived field on each item.
 */
export function computePriority(item: Pick<RoadmapItem, "businessValue" | "timeCriticality" | "riskReduction" | "effort">): number {
  const numerator = item.businessValue + item.timeCriticality + item.riskReduction;
  const denominator = Math.max(1, item.effort);
  return Math.round((numerator / denominator) * 100) / 100;
}

/**
 * Recompute priorities for every item in the roadmap. Pure — does
 * not mutate; returns a new array.
 */
export function rescoreRoadmap(items: RoadmapItem[]): RoadmapItem[] {
  return items.map((item) => ({
    ...item,
    priority: computePriority(item),
  }));
}

/**
 * Resolve the dependency graph and return items in execution order.
 * Items with unmet dependencies stay in the input but aren't returned
 * as ready. Cycle detection: any item involved in a cycle is reported
 * as `blocked` in the result.
 */
export function nextReadyItems(roadmap: Roadmap, n = 5): RoadmapItem[] {
  const byId = new Map(roadmap.items.map((i) => [i.id, i]));
  const doneIds = new Set(
    roadmap.items.filter((i) => i.status === "done").map((i) => i.id),
  );

  const ready: RoadmapItem[] = [];
  for (const item of roadmap.items) {
    if (item.status !== "backlog" && item.status !== "ready") continue;
    const unmet = item.dependencies.filter((d) => !doneIds.has(d));
    if (unmet.length > 0) continue;
    // Skip items whose dependencies don't exist in the roadmap at all
    const ghostDeps = item.dependencies.filter((d) => !byId.has(d));
    if (ghostDeps.length > 0) continue;
    ready.push(item);
  }
  // Sort by priority descending, falling back on insertion order
  return ready
    .map((item) => ({ ...item, priority: computePriority(item) }))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    .slice(0, n);
}

// ─── Roadmap mutations ────────────────────────────────────────────────────

export interface AddItemInput {
  title: string;
  description: string;
  businessValue: number;
  timeCriticality: number;
  riskReduction: number;
  effort: number;
  dependencies?: string[];
  tag?: string;
  addedBy?: string;
}

export function addItem(roadmap: Roadmap, input: AddItemInput): Roadmap {
  const id = `r${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  const now = new Date().toISOString();
  const newItem: RoadmapItem = {
    id,
    title: input.title,
    description: input.description,
    status: "backlog",
    businessValue: input.businessValue,
    timeCriticality: input.timeCriticality,
    riskReduction: input.riskReduction,
    effort: input.effort,
    dependencies: input.dependencies ?? [],
    tag: input.tag,
    updatedAt: now,
    addedBy: input.addedBy,
  };
  return {
    ...roadmap,
    version: roadmap.version + 1,
    items: rescoreRoadmap([...roadmap.items, newItem]),
    lastUpdatedAt: now,
  };
}

export function updateStatus(
  roadmap: Roadmap,
  itemId: string,
  status: RoadmapStatus,
  note?: string,
): Roadmap {
  const now = new Date().toISOString();
  const items = roadmap.items.map((i) =>
    i.id === itemId
      ? {
          ...i,
          status,
          updatedAt: now,
          notes: note ? `${i.notes ? i.notes + "\n" : ""}${now}: ${note}` : i.notes,
        }
      : i,
  );
  return {
    ...roadmap,
    version: roadmap.version + 1,
    items,
    lastUpdatedAt: now,
  };
}

export function rescoreItem(
  roadmap: Roadmap,
  itemId: string,
  newScores: Partial<Pick<RoadmapItem, "businessValue" | "timeCriticality" | "riskReduction" | "effort">>,
): Roadmap {
  const now = new Date().toISOString();
  const items = roadmap.items.map((i) =>
    i.id === itemId
      ? {
          ...i,
          ...newScores,
          updatedAt: now,
          priority: computePriority({ ...i, ...newScores }),
        }
      : i,
  );
  return {
    ...roadmap,
    version: roadmap.version + 1,
    items,
    lastUpdatedAt: now,
  };
}

// ─── Health metrics ───────────────────────────────────────────────────────

export interface RoadmapHealth {
  totalItems: number;
  byStatus: Record<RoadmapStatus, number>;
  averagePriority: number;
  highestPriority: { id: string; title: string; priority: number } | null;
  blockedCount: number;
  staleness: {
    averageDaysSinceUpdate: number;
    stalestId: string | null;
  };
}

export function computeHealth(roadmap: Roadmap): RoadmapHealth {
  const byStatus: Record<RoadmapStatus, number> = {
    backlog: 0,
    ready: 0,
    in_progress: 0,
    done: 0,
    blocked: 0,
    rejected: 0,
  };
  let prioSum = 0;
  let highest: RoadmapHealth["highestPriority"] = null;
  let stalestId: string | null = null;
  let stalestMs = -Infinity;
  const now = Date.now();
  let totalDays = 0;

  for (const item of roadmap.items) {
    byStatus[item.status]++;
    const p = computePriority(item);
    prioSum += p;
    if (!highest || p > highest.priority) {
      highest = { id: item.id, title: item.title, priority: p };
    }
    const updatedMs = Date.parse(item.updatedAt);
    if (Number.isFinite(updatedMs)) {
      const sinceMs = now - updatedMs;
      totalDays += sinceMs / (24 * 60 * 60 * 1000);
      if (sinceMs > stalestMs) {
        stalestMs = sinceMs;
        stalestId = item.id;
      }
    }
  }

  const totalItems = roadmap.items.length;
  return {
    totalItems,
    byStatus,
    averagePriority: totalItems > 0 ? prioSum / totalItems : 0,
    highestPriority: highest,
    blockedCount: byStatus.blocked,
    staleness: {
      averageDaysSinceUpdate: totalItems > 0 ? totalDays / totalItems : 0,
      stalestId,
    },
  };
}

// ─── Iteration helper ─────────────────────────────────────────────────────
// Single iteration of the planner loop: rescore, pick top N, ready them.

export interface IterationResult {
  iterationNumber: number;
  rescoredCount: number;
  promoted: RoadmapItem[];
  newRoadmap: Roadmap;
}

export function iterateRoadmap(
  roadmap: Roadmap,
  topN = 5,
): IterationResult {
  const rescored = rescoreRoadmap(roadmap.items);
  const ready = nextReadyItems({ ...roadmap, items: rescored }, topN);

  // Promote the picked items from `backlog` → `ready`
  const promotedIds = new Set(ready.map((i) => i.id));
  const now = new Date().toISOString();
  const items = rescored.map((i) =>
    promotedIds.has(i.id) && i.status === "backlog"
      ? { ...i, status: "ready" as RoadmapStatus, updatedAt: now }
      : i,
  );

  const newRoadmap: Roadmap = {
    version: roadmap.version + 1,
    items,
    lastIteration: roadmap.lastIteration + 1,
    lastUpdatedAt: now,
  };

  logger.info(
    {
      iteration: newRoadmap.lastIteration,
      promoted: ready.length,
      total: items.length,
    },
    "roadmap iteration complete",
  );

  return {
    iterationNumber: newRoadmap.lastIteration,
    rescoredCount: rescored.length,
    promoted: ready,
    newRoadmap,
  };
}

// ─── Empty roadmap factory ────────────────────────────────────────────────

export function emptyRoadmap(): Roadmap {
  return {
    version: 1,
    items: [],
    lastIteration: 0,
    lastUpdatedAt: new Date().toISOString(),
  };
}
