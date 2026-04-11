/**
 * Per-track read state ring buffer (Pass 2 — learning experience).
 *
 * Remembers which chapters in a track a learner has read (and when),
 * so revisiting a track can:
 *   1. Auto-expand the most-recently-read chapter as a "Resume here"
 *      affordance instead of starting from chapter 1 every time,
 *   2. Render a per-track progress indicator (chapters read / total)
 *      on the Learning Home track grid,
 *   3. Render a green checkmark next to chapters the learner has
 *      already visited in TrackDetail.
 *
 * State is kept in localStorage under a single key (not per-track) so
 * the entire progress map serializes/deserializes in one round trip.
 * The shape is `{ [trackId]: { chapterIds: number[]; lastChapterId:
 * number | null; updatedAt: number } }`.
 *
 * Progress is DEVICE-scoped, not account-scoped, because the signal
 * it powers (resume / checkmarks) is ephemeral and best-effort — we
 * don't want to burn a DB round trip per chapter click. The SRS
 * mastery table remains the system of record for actual retention.
 *
 * Pure helpers are exported for unit testing. Only the wrapper
 * functions touch `window.localStorage`, and every touch is behind a
 * try/catch for private-mode + SSR + disabled-storage safety.
 */

const STORAGE_KEY = "stewardly.learning.trackReadState";
const MAX_CHAPTERS_PER_TRACK = 200; // sanity cap — no track should have 200+ chapters

export interface TrackReadEntry {
  chapterIds: number[]; // read chapter ids, newest first
  lastChapterId: number | null;
  updatedAt: number; // epoch ms
}

export type TrackReadState = Record<string, TrackReadEntry>;

// ─── Pure helpers ─────────────────────────────────────────────────────────

/**
 * Pure: parse an unknown localStorage payload into a valid
 * TrackReadState. Tolerates malformed JSON, non-object payloads, and
 * missing / wrong-typed fields inside each entry — all of which return
 * an empty state rather than throwing.
 */
export function parseTrackReadState(raw: unknown): TrackReadState {
  if (typeof raw !== "string" || raw.length === 0) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: TrackReadState = {};
    for (const [trackKey, entry] of Object.entries(parsed)) {
      if (!entry || typeof entry !== "object") continue;
      const e = entry as Partial<TrackReadEntry>;
      const chapterIds = Array.isArray(e.chapterIds)
        ? e.chapterIds
            .filter((n): n is number => typeof n === "number" && Number.isFinite(n))
            .slice(0, MAX_CHAPTERS_PER_TRACK)
        : [];
      const lastChapterId =
        typeof e.lastChapterId === "number" && Number.isFinite(e.lastChapterId)
          ? e.lastChapterId
          : null;
      const updatedAt =
        typeof e.updatedAt === "number" && Number.isFinite(e.updatedAt) ? e.updatedAt : 0;
      out[trackKey] = { chapterIds, lastChapterId, updatedAt };
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Pure: mark a chapter as read. Moves the chapter to the front of the
 * track's `chapterIds` list (dedupes prior entries), sets
 * `lastChapterId`, and bumps `updatedAt`. Returns a NEW state — does
 * not mutate the input.
 */
export function markChapterRead(
  state: TrackReadState,
  trackKey: string | number,
  chapterId: number,
  now = Date.now(),
): TrackReadState {
  if (!Number.isFinite(chapterId)) return state;
  const key = String(trackKey);
  const prior = state[key];
  const priorChapters = prior?.chapterIds ?? [];
  const nextChapters = [chapterId, ...priorChapters.filter((id) => id !== chapterId)];
  if (nextChapters.length > MAX_CHAPTERS_PER_TRACK) {
    nextChapters.length = MAX_CHAPTERS_PER_TRACK;
  }
  return {
    ...state,
    [key]: {
      chapterIds: nextChapters,
      lastChapterId: chapterId,
      updatedAt: now,
    },
  };
}

/** Pure: has the given chapter been read for the given track? */
export function isChapterRead(
  state: TrackReadState,
  trackKey: string | number,
  chapterId: number,
): boolean {
  const entry = state[String(trackKey)];
  return !!entry && entry.chapterIds.includes(chapterId);
}

/** Pure: count of chapters read for a given track. */
export function chaptersReadCount(state: TrackReadState, trackKey: string | number): number {
  return state[String(trackKey)]?.chapterIds.length ?? 0;
}

/** Pure: the last chapter id read for a track, or null if none. */
export function lastReadChapter(state: TrackReadState, trackKey: string | number): number | null {
  return state[String(trackKey)]?.lastChapterId ?? null;
}

/**
 * Pure: given a total chapter count, return a 0-100 percentage. Clamps
 * to 100 so an over-count (possible if chapters were deleted) can't
 * render a percentage > 100.
 */
export function trackProgressPct(
  state: TrackReadState,
  trackKey: string | number,
  totalChapters: number,
): number {
  if (totalChapters <= 0) return 0;
  const read = chaptersReadCount(state, trackKey);
  return Math.min(100, Math.round((read / totalChapters) * 100));
}

/** Pure: remove a track's entry entirely. */
export function clearTrack(state: TrackReadState, trackKey: string | number): TrackReadState {
  const key = String(trackKey);
  if (!(key in state)) return state;
  const { [key]: _removed, ...rest } = state;
  return rest;
}

// ─── Browser wrappers ─────────────────────────────────────────────────────

function safeLoad(): TrackReadState {
  if (typeof window === "undefined") return {};
  try {
    return parseTrackReadState(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return {};
  }
}

function safeSave(state: TrackReadState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota / privacy mode / disabled storage — silently ignore
  }
}

/** Returns the current read state (defensive parse). */
export function getTrackReadState(): TrackReadState {
  return safeLoad();
}

/** Records that the user just opened a specific chapter. */
export function recordChapterRead(trackKey: string | number, chapterId: number): void {
  const current = safeLoad();
  const next = markChapterRead(current, trackKey, chapterId);
  safeSave(next);
}

/** Wipes the entire read state (e.g. on logout). */
export function clearAllTrackReadState(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
