/**
 * EMBA Learning — pure track + chapter progress builder (pass 5).
 *
 * Before this pass, `LearningTrackDetail.tsx` showed flashcard +
 * question + chapter counts but no sense of how much of the
 * material the learner had actually covered or mastered. The
 * mastery data lives in `learning_mastery_progress` rows and is
 * already exposed via `learning.mastery.getMine`, but no UI
 * combined it with the per-track content listing to compute a
 * chapter-by-chapter breakdown.
 *
 * This module is the pure-function chapter rollup. It accepts:
 *   - the chapters for a track
 *   - the flashcards + questions for that track (each may carry an
 *     optional chapterId)
 *   - a `mastery` lookup keyed by itemKey (matching the existing
 *     `flashcard:<id>` / `question:<id>` convention)
 *
 * It returns a per-chapter rollup with mastered / in-progress /
 * unseen counts plus completion + attempted percentages, plus
 * track-level totals so the UI can render a single header bar.
 *
 * Items with `chapterId === null` are counted toward the track
 * total but not attributed to any specific chapter (a
 * known-unchaptered bucket is returned separately so the UI can
 * still surface them).
 *
 * Pure, no DOM, no React, fully testable.
 */

// ─── Types ────────────────────────────────────────────────────────────────

export interface ChapterRef {
  id: number;
  title: string;
}

export interface ItemWithChapter {
  id: number;
  chapterId?: number | null;
}

export interface MasteryLite {
  confidence: number | null;
  mastered: boolean;
}

export type MasteryLookup = Map<string, MasteryLite>;

export interface ChapterProgress {
  chapterId: number;
  title: string;
  /** flashcards + questions in this chapter */
  total: number;
  mastered: number;
  /** seen at least once but not yet mastered */
  inProgress: number;
  /** never attempted */
  unseen: number;
  /** mastered / total — 0..1 rounded to 2 decimals */
  completionPct: number;
  /** (mastered + inProgress) / total — 0..1 */
  attemptedPct: number;
}

export interface TrackProgress {
  trackTotal: number;
  trackMastered: number;
  trackInProgress: number;
  trackUnseen: number;
  /** mastered / trackTotal */
  trackCompletionPct: number;
  /** (mastered + inProgress) / trackTotal */
  trackAttemptedPct: number;
  /** Per-chapter breakdown in input order (not sorted). */
  chapters: ChapterProgress[];
  /** Items with chapterId === null. */
  unchaptered: {
    total: number;
    mastered: number;
    inProgress: number;
    unseen: number;
  };
}

// ─── Pure helpers ─────────────────────────────────────────────────────────

/**
 * Pure. Build a `itemKey → mastery` lookup from raw rows. The
 * shape matches the wider `learning.mastery.getMine` return.
 */
export function buildMasteryLookup(
  rows: ReadonlyArray<{ itemKey: string; confidence: number | null; mastered: boolean | null }>,
): MasteryLookup {
  const out: MasteryLookup = new Map();
  for (const r of rows) {
    if (!r.itemKey) continue;
    out.set(r.itemKey, {
      confidence: r.confidence ?? 0,
      mastered: r.mastered === true,
    });
  }
  return out;
}

function classifyOne(
  itemKey: string,
  lookup: MasteryLookup,
): "mastered" | "inProgress" | "unseen" {
  const m = lookup.get(itemKey);
  if (!m) return "unseen";
  if (m.mastered) return "mastered";
  // Anything seen but not yet mastered (any confidence > 0 OR a row
  // exists with confidence=0 from a wrong-first-try).
  return "inProgress";
}

function makeBucket() {
  return { total: 0, mastered: 0, inProgress: 0, unseen: 0 };
}

function addToBucket(
  bucket: ReturnType<typeof makeBucket>,
  status: "mastered" | "inProgress" | "unseen",
) {
  bucket.total += 1;
  bucket[status] += 1;
}

function ratio(num: number, denom: number): number {
  if (denom <= 0) return 0;
  return Math.round((num / denom) * 100) / 100;
}

/**
 * Pure. Build the full track + chapter progress rollup.
 *
 * Per-chapter completion is computed only from items that carry the
 * matching `chapterId`. Items without a `chapterId` are aggregated
 * into the `unchaptered` bucket so the track total still reflects
 * everything.
 *
 * Determined: same input → same output. No randomness, no Date.
 */
export function buildTrackProgress(
  chapters: ReadonlyArray<ChapterRef>,
  flashcards: ReadonlyArray<ItemWithChapter>,
  questions: ReadonlyArray<ItemWithChapter>,
  mastery: MasteryLookup,
): TrackProgress {
  // Per-chapter buckets keyed by chapterId
  const byChapter = new Map<number, ReturnType<typeof makeBucket>>();
  for (const c of chapters) byChapter.set(c.id, makeBucket());
  const unchaptered = makeBucket();
  const trackTotals = makeBucket();

  // Helper to dispatch one item by chapterId.
  const handleItem = (kind: "flashcard" | "question", item: ItemWithChapter) => {
    const itemKey = `${kind}:${item.id}`;
    const status = classifyOne(itemKey, mastery);
    addToBucket(trackTotals, status);
    const chId = item.chapterId ?? null;
    if (chId == null) {
      addToBucket(unchaptered, status);
      return;
    }
    const bucket = byChapter.get(chId);
    if (bucket) {
      addToBucket(bucket, status);
    } else {
      // Chapter id present on item but not in chapter list — treat as unchaptered.
      addToBucket(unchaptered, status);
    }
  };

  for (const f of flashcards) handleItem("flashcard", f);
  for (const q of questions) handleItem("question", q);

  const chapterProgress: ChapterProgress[] = chapters.map((c) => {
    const b = byChapter.get(c.id) ?? makeBucket();
    return {
      chapterId: c.id,
      title: c.title,
      total: b.total,
      mastered: b.mastered,
      inProgress: b.inProgress,
      unseen: b.unseen,
      completionPct: ratio(b.mastered, b.total),
      attemptedPct: ratio(b.mastered + b.inProgress, b.total),
    };
  });

  return {
    trackTotal: trackTotals.total,
    trackMastered: trackTotals.mastered,
    trackInProgress: trackTotals.inProgress,
    trackUnseen: trackTotals.unseen,
    trackCompletionPct: ratio(trackTotals.mastered, trackTotals.total),
    trackAttemptedPct: ratio(trackTotals.mastered + trackTotals.inProgress, trackTotals.total),
    chapters: chapterProgress,
    unchaptered: {
      total: unchaptered.total,
      mastered: unchaptered.mastered,
      inProgress: unchaptered.inProgress,
      unseen: unchaptered.unseen,
    },
  };
}

/**
 * Pure. Pretty-format a 0..1 completion ratio as an integer percent
 * string for the UI.
 */
export function formatProgressPct(pct: number): string {
  if (!Number.isFinite(pct) || pct <= 0) return "0%";
  return `${Math.round(pct * 100)}%`;
}

/**
 * Pure. Map a 0..1 completion ratio to a status word for badges.
 * Useful for tinting per-chapter rows so learners can scan progress.
 */
export type CompletionStatus =
  | "unstarted"
  | "started"
  | "in-progress"
  | "near-mastery"
  | "mastered";

export function completionStatus(pct: number): CompletionStatus {
  if (pct <= 0) return "unstarted";
  if (pct < 0.25) return "started";
  if (pct < 0.6) return "in-progress";
  if (pct < 1) return "near-mastery";
  return "mastered";
}
