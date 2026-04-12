/**
 * EMBA Learning — study streak tracker (pass 7, build loop).
 *
 * `LearningHome.tsx`'s docstring has promised a mastery + streak
 * summary since pass 58, but only the mastery half was ever shipped.
 * Learners opening the app day after day have no visible signal that
 * their consistency is being rewarded — which, per every piece of
 * habit-formation research we care about, is precisely the signal
 * that keeps people studying.
 *
 * This module is the pure-function streak engine. It persists a
 * compact record of "days on which the learner studied" to
 * localStorage, computes the current and longest consecutive-day
 * streaks, and classifies the streak status so the UI can paint
 * the right tone (active / at-risk / broken).
 *
 * Design:
 *
 *   1. Pure helpers are the primary surface — every behavior
 *      (`markStudyDay`, `currentStreak`, `longestStreak`,
 *      `streakStatus`, `parseStreak`, `serializeStreak`) takes
 *      explicit inputs and returns new state. The localStorage
 *      reader/writer sits on top of them.
 *
 *   2. The stored shape is minimal — a sorted array of
 *      `YYYY-MM-DD` strings (UTC-anchored to avoid tz drift) plus
 *      a `longest` counter derived at write time so the UI doesn't
 *      recompute on every render.
 *
 *   3. 90-day retention cap. Older days are dropped on write so
 *      the localStorage blob stays well under 1KB even for a daily
 *      user who never stops.
 *
 *   4. `currentStreak` handles the "studied today OR yesterday"
 *      window — a learner who studies every day and opens the app
 *      at 23:59 → reopens at 00:01 the next day does not see their
 *      streak reset just because the clock ticked over.
 *
 *   5. `streakStatus` returns a 3-tier classification so the UI
 *      can paint amber "at risk" when today's session is missing
 *      and emerald "active" when it's done.
 */

// ─── Types ────────────────────────────────────────────────────────────────

/** Persisted streak state. Compact and forward-compatible. */
export interface StreakState {
  version: 1;
  /** Sorted ascending, deduped. Format: YYYY-MM-DD. */
  days: string[];
  /** Highest consecutive-day count ever observed (computed on write). */
  longest: number;
}

export type StreakStatusKind = "none" | "active" | "at-risk" | "broken";

export interface StreakSummary {
  current: number;
  longest: number;
  lastDay: string | null;
  status: StreakStatusKind;
}

// ─── Constants ────────────────────────────────────────────────────────────

/** Max retained days in localStorage. Ring-buffer semantics. */
export const MAX_STREAK_DAYS = 90;

// ─── Date helpers (pure + UTC-anchored) ──────────────────────────────────

/**
 * Pure. Convert a Date to a YYYY-MM-DD string in UTC. Anchoring to
 * UTC means a learner who travels across time zones doesn't get
 * credited with an extra day (or robbed of one).
 */
export function toDayKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Pure. Parse a `YYYY-MM-DD` key back to a UTC Date at midnight. */
export function parseDayKey(key: string): Date {
  // Forgiving — matches 4-2-2 digit shape or returns epoch 0.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return new Date(0);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/** Pure. Day delta between two keys (positive = b is later). */
export function dayDelta(a: string, b: string): number {
  const da = parseDayKey(a);
  const db = parseDayKey(b);
  return Math.round((db.getTime() - da.getTime()) / (24 * 60 * 60 * 1000));
}

// ─── Empty state / factory ───────────────────────────────────────────────

export function emptyStreak(): StreakState {
  return { version: 1, days: [], longest: 0 };
}

// ─── Core state transitions ─────────────────────────────────────────────

/**
 * Pure. Record that the learner studied on `now`. Returns the new
 * state AND a `changed` flag so the caller can decide whether to
 * persist. Same-day calls are idempotent.
 *
 * Also recomputes `longest` by walking the (small, capped) day list
 * after insertion.
 */
export function markStudyDay(
  state: StreakState,
  now: Date,
): { state: StreakState; changed: boolean } {
  const key = toDayKey(now);
  if (state.days.includes(key)) {
    return { state, changed: false };
  }
  // Insert sorted (days is already sorted asc).
  const next = [...state.days, key].sort();
  // Ring-buffer cap — drop oldest entries until <= MAX_STREAK_DAYS.
  while (next.length > MAX_STREAK_DAYS) next.shift();
  const longest = Math.max(state.longest, longestStreakFromDays(next));
  return {
    state: { version: 1, days: next, longest },
    changed: true,
  };
}

/**
 * Pure. Walk a sorted day list and return the longest consecutive
 * run length. O(n).
 */
export function longestStreakFromDays(days: readonly string[]): number {
  if (days.length === 0) return 0;
  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    const delta = dayDelta(days[i - 1]!, days[i]!);
    if (delta === 1) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 1;
    }
  }
  return best;
}

/**
 * Pure. Current streak = length of the consecutive-day run ending
 * at the most recent day IF that day is today or yesterday.
 *
 * Rationale: a learner who studied through yesterday but hasn't
 * opened the app yet today is still "on an active streak that could
 * break by midnight" — we return the run length so the UI can
 * paint an "at-risk" warning. A run ending two or more days ago
 * returns 0 (broken).
 */
export function currentStreak(state: StreakState, now: Date): number {
  const days = state.days;
  if (days.length === 0) return 0;
  const todayKey = toDayKey(now);
  const last = days[days.length - 1]!;
  const lastToNowDelta = dayDelta(last, todayKey);
  if (lastToNowDelta > 1) return 0;
  // Walk backward from the end counting consecutive days.
  let run = 1;
  for (let i = days.length - 2; i >= 0; i--) {
    const delta = dayDelta(days[i]!, days[i + 1]!);
    if (delta === 1) run += 1;
    else break;
  }
  return run;
}

/**
 * Pure. Classify streak status so the UI can paint the right tone:
 *
 *   - "none"     — user has never studied
 *   - "active"   — last studied day IS today
 *   - "at-risk"  — last studied day is yesterday (clock hasn't
 *                  forced a reset yet, but the window is closing)
 *   - "broken"   — last studied day is 2+ days ago
 */
export function streakStatus(state: StreakState, now: Date): StreakStatusKind {
  if (state.days.length === 0) return "none";
  const last = state.days[state.days.length - 1]!;
  const delta = dayDelta(last, toDayKey(now));
  if (delta <= 0) return "active";
  if (delta === 1) return "at-risk";
  return "broken";
}

/** Pure. Top-level summary read by the UI. */
export function summarizeStreak(state: StreakState, now: Date): StreakSummary {
  return {
    current: currentStreak(state, now),
    longest: state.longest,
    lastDay: state.days[state.days.length - 1] ?? null,
    status: streakStatus(state, now),
  };
}

// ─── (De)serialization ───────────────────────────────────────────────────

/**
 * Pure. Stringify for localStorage. Stable JSON so tests can assert
 * on exact output if they want to.
 */
export function serializeStreak(state: StreakState): string {
  return JSON.stringify(state);
}

/**
 * Pure. Defensive parser. A malformed file should NEVER take the
 * runner down — returns an empty streak.
 */
export function parseStreak(raw: string | null | undefined): StreakState {
  if (!raw || typeof raw !== "string") return emptyStreak();
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyStreak();
  }
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.days)) {
    return emptyStreak();
  }
  // Filter to valid day keys, dedupe, sort, cap.
  const validDays: string[] = [];
  const seen = new Set<string>();
  for (const d of parsed.days) {
    if (typeof d !== "string") continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    if (seen.has(d)) continue;
    seen.add(d);
    validDays.push(d);
  }
  validDays.sort();
  while (validDays.length > MAX_STREAK_DAYS) validDays.shift();
  const longest = Math.max(
    typeof parsed.longest === "number" && parsed.longest >= 0 ? parsed.longest : 0,
    longestStreakFromDays(validDays),
  );
  return { version: 1, days: validDays, longest };
}

// ─── localStorage I/O (no-op in SSR) ─────────────────────────────────────

const STORAGE_KEY = "stewardly-learning-streak";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadStreakFromStorage(): StreakState {
  if (!canUseStorage()) return emptyStreak();
  try {
    return parseStreak(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return emptyStreak();
  }
}

export function saveStreakToStorage(state: StreakState): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, serializeStreak(state));
  } catch {
    /* quota exceeded / disabled — best-effort */
  }
}

/**
 * Top-level "mark studied now" helper. Pure path is unchanged;
 * this wrapper loads current state, applies `markStudyDay`,
 * persists on change, and returns the updated summary.
 *
 * Safe to call on every review — same-day calls are idempotent.
 */
export function recordStudyNow(now: Date = new Date()): StreakSummary {
  const current = loadStreakFromStorage();
  const { state, changed } = markStudyDay(current, now);
  if (changed) saveStreakToStorage(state);
  return summarizeStreak(state, now);
}
