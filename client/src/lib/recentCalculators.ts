/**
 * Recent calculators ring buffer (Pass 1 — learning experience).
 *
 * Browser-only helper that remembers which calculator pages a user has
 * most recently interacted with. The server's learning recommendations
 * engine reads this list to surface calculator-informed study
 * suggestions — e.g. "you recently used rothExplorer, brush up on CFP
 * tax-deferred concepts" — but before this pass no client code was
 * writing to it, so the `recentCalculators` input on
 * `learning.recommendations.forMe` was always an empty array.
 *
 * The list is kept as a lowest-common-denominator JSON array so it can
 * be serialized/deserialized defensively without pulling in a real
 * store. It lives in localStorage because the signal it powers is
 * per-device, not per-account — a fresh device should start fresh.
 *
 * Pure helpers are exported for unit testing. Only the wrapper
 * functions touch `window.localStorage`, and every touch is behind a
 * try/catch so private-mode + SSR + disabled-storage users still get
 * sensible defaults.
 */

const STORAGE_KEY = "stewardly.learning.recentCalculators";
export const MAX_RECENT_CALCULATORS = 10;

/** Known calculator keys the server's CALCULATOR_TRACK_MAP understands. */
export type CalculatorKey =
  | "rothExplorer"
  | "calculateGuardrails"
  | "projectBizIncome"
  | "stressTest"
  | "backtest"
  | "autoSelectProducts"
  | "holisticSimulate"
  | "uweSimulate"
  | "bieSimulate"
  | "heSimulate"
  | string; // open set — any string is accepted, unknown keys are ignored server-side

/**
 * Pure: normalize an incoming calculator key. Trims whitespace, drops
 * empty strings, caps length at 64 chars (defensive — the server-side
 * Zod schema caps at 64 too).
 */
export function normalizeCalculatorKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().slice(0, 64);
  if (!trimmed) return null;
  return trimmed;
}

/**
 * Pure: add a calculator key to the front of the list, dedupe any
 * existing occurrence, and clamp the list to MAX_RECENT_CALCULATORS.
 * Returns a NEW array — does not mutate the input.
 */
export function pushCalculator(existing: string[], raw: unknown): string[] {
  const key = normalizeCalculatorKey(raw);
  if (!key) return existing.slice();
  const next = [key, ...existing.filter((k) => k !== key)];
  if (next.length > MAX_RECENT_CALCULATORS) {
    next.length = MAX_RECENT_CALCULATORS;
  }
  return next;
}

/**
 * Pure: parse an unknown localStorage payload into a valid string[].
 * Tolerates malformed JSON, non-array payloads, and non-string
 * entries — all of which return an empty list rather than throwing.
 */
export function parseStorageValue(raw: unknown): string[] {
  if (typeof raw !== "string" || raw.length === 0) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: string[] = [];
    for (const entry of parsed) {
      const k = normalizeCalculatorKey(entry);
      if (k) out.push(k);
      if (out.length >= MAX_RECENT_CALCULATORS) break;
    }
    return out;
  } catch {
    return [];
  }
}

// ─── Browser wrappers ─────────────────────────────────────────────────────

function safeLoad(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return parseStorageValue(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

function safeSave(list: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // quota / privacy mode / disabled storage — silently ignore
  }
}

/** Returns the current recent-calculators list (defensive parse). */
export function getRecentCalculators(): string[] {
  return safeLoad();
}

/**
 * Records that the user just used a calculator. Call this from the
 * calculator page's `onMount` or `onRun` handler — cheap, idempotent,
 * won't throw.
 */
export function recordCalculatorUse(key: CalculatorKey): void {
  const current = safeLoad();
  const next = pushCalculator(current, key);
  safeSave(next);
}

/** Wipes the recent-calculators list (e.g. on logout). */
export function clearRecentCalculators(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
