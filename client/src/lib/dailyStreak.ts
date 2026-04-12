/**
 * Daily learning streak tracker (Pass 5 — learning experience).
 *
 * Persists a per-device "consecutive days studied" counter so the
 * Learning Home can surface a streak indicator that's sticky across
 * sessions. Without this, the in-session streak UI (Passes 1-2) only
 * showed for the duration of a single review and reset as soon as
 * the user navigated away.
 *
 * Rules (standard streak semantics, no timezone heroics):
 *   - The first time a user finishes an item on day N → streak = 1
 *   - Another item on the same day N → streak unchanged
 *   - An item on day N+1 → streak increments to N+1 (continuation)
 *   - An item on day N+2 (skipped a day) → streak resets to 1 (broken)
 *   - A backfill from an older day → IGNORED (can't rewrite history)
 *
 * The "day" is defined by the learner's local calendar date in
 * `YYYY-MM-DD` format so the streak corresponds to what a human
 * actually experiences. No UTC math required — the browser already
 * knows the local offset.
 *
 * Pure helpers are exported for unit testing. Only `getDailyStreak` /
 * `recordStudyEvent` / `clearDailyStreak` touch localStorage.
 */

const STORAGE_KEY = "stewardly.learning.dailyStreak";

export interface DailyStreakState {
  /** Current consecutive-day count. 0 means no streak yet. */
  current: number;
  /** The highest streak the learner has ever achieved. */
  best: number;
  /** Last date a study event was recorded, in YYYY-MM-DD local time. */
  lastStudyDate: string | null;
  /** Cumulative number of study events — a lifetime counter. */
  totalStudyEvents: number;
}

const EMPTY_STATE: DailyStreakState = {
  current: 0,
  best: 0,
  lastStudyDate: null,
  totalStudyEvents: 0,
};

// ─── Pure helpers ─────────────────────────────────────────────────────────

/**
 * Pure: format a Date as a local-calendar YYYY-MM-DD string. No
 * timezone conversion — uses the browser's resolved offset.
 */
export function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Pure: return the number of whole calendar days between two
 * YYYY-MM-DD keys, or null if either is malformed.
 */
export function daysBetween(a: string | null, b: string): number | null {
  if (a == null) return null;
  const parseKey = (k: string): Date | null => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k);
    if (!m) return null;
    // Use a noon UTC anchor so DST transitions don't flip the day count.
    return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  };
  const da = parseKey(a);
  const db = parseKey(b);
  if (!da || !db) return null;
  const ms = db.getTime() - da.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

/**
 * Pure: given the current streak state and today's date key, return
 * the new state after recording a study event. Contract:
 *   - Same day as lastStudyDate → totalStudyEvents increments, streak unchanged
 *   - Next day (delta=1) → streak + 1, best updated if needed
 *   - Gap > 1 day → streak resets to 1 (broken)
 *   - No prior streak → streak = 1
 *   - Backfill (delta < 0) → state unchanged (ignored)
 */
export function recordStudyEventPure(
  state: DailyStreakState,
  todayKey: string,
): DailyStreakState {
  const delta = daysBetween(state.lastStudyDate, todayKey);

  // Same day — only bump the lifetime counter.
  if (delta === 0) {
    return {
      ...state,
      totalStudyEvents: state.totalStudyEvents + 1,
    };
  }

  // Next calendar day — extend streak.
  if (delta === 1) {
    const next = state.current + 1;
    return {
      current: next,
      best: Math.max(state.best, next),
      lastStudyDate: todayKey,
      totalStudyEvents: state.totalStudyEvents + 1,
    };
  }

  // Backfill (negative delta) — ignore entirely; history is immutable.
  if (delta !== null && delta < 0) {
    return state;
  }

  // Gap > 1 day (or first-ever event) — reset to 1.
  return {
    current: 1,
    best: Math.max(state.best, 1),
    lastStudyDate: todayKey,
    totalStudyEvents: state.totalStudyEvents + 1,
  };
}

/**
 * Pure: parse an unknown localStorage payload. Tolerates malformed
 * JSON and missing / wrong-typed fields without throwing.
 */
export function parseDailyStreak(raw: unknown): DailyStreakState {
  if (typeof raw !== "string" || raw.length === 0) return { ...EMPTY_STATE };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { ...EMPTY_STATE };
    const p = parsed as Partial<DailyStreakState>;
    return {
      current: typeof p.current === "number" && Number.isFinite(p.current) && p.current >= 0
        ? Math.floor(p.current)
        : 0,
      best: typeof p.best === "number" && Number.isFinite(p.best) && p.best >= 0
        ? Math.floor(p.best)
        : 0,
      lastStudyDate: typeof p.lastStudyDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.lastStudyDate)
        ? p.lastStudyDate
        : null,
      totalStudyEvents: typeof p.totalStudyEvents === "number" && Number.isFinite(p.totalStudyEvents) && p.totalStudyEvents >= 0
        ? Math.floor(p.totalStudyEvents)
        : 0,
    };
  } catch {
    return { ...EMPTY_STATE };
  }
}

/**
 * Pure: is the current streak "live" as of today? A streak is live
 * if the user studied today OR yesterday (so yesterday's streak is
 * still savable by studying today).
 */
export function isStreakLive(state: DailyStreakState, todayKey: string): boolean {
  if (state.lastStudyDate == null) return false;
  const delta = daysBetween(state.lastStudyDate, todayKey);
  return delta !== null && delta >= 0 && delta <= 1;
}

// ─── Browser wrappers ─────────────────────────────────────────────────────

function safeLoad(): DailyStreakState {
  if (typeof window === "undefined") return { ...EMPTY_STATE };
  try {
    return parseDailyStreak(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return { ...EMPTY_STATE };
  }
}

function safeSave(state: DailyStreakState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota / privacy / disabled — silently ignore
  }
}

/** Returns the current persistent streak state. */
export function getDailyStreak(): DailyStreakState {
  return safeLoad();
}

/**
 * Records that the user just finished a study event. Call this after
 * a successful flashcard flip+mark, quiz answer submit, or exam
 * question submit. Cheap, idempotent, won't throw.
 *
 * Returns the NEW state so callers can surface a celebration when
 * the streak increments or breaks — the difference between the
 * pre-call and post-call `current` tells you what happened.
 */
export function recordStudyEvent(now = new Date()): DailyStreakState {
  const current = safeLoad();
  const next = recordStudyEventPure(current, toLocalDateKey(now));
  safeSave(next);
  return next;
}

/** Wipes the streak (e.g. on logout). */
export function clearDailyStreak(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
