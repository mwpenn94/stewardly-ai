/**
 * safeStorage.ts — Safe localStorage wrappers that handle Safari Private Browsing,
 * quota exceeded, and other storage exceptions gracefully.
 *
 * All localStorage access across the app should use these helpers instead of
 * calling localStorage directly, to prevent crashes in restricted environments.
 */

/** Safely read a string from localStorage. Returns fallback on any error. */
export function safeGetItem(key: string, fallback: string | null = null): string | null {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

/** Safely write a string to localStorage. Silently fails on quota/access errors. */
export function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* quota exceeded or access denied — ignore */
  }
}

/** Safely remove an item from localStorage. Silently fails on access errors. */
export function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* access denied — ignore */
  }
}

/** Safely read and parse JSON from localStorage. Returns fallback on any error. */
export function safeGetJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/** Safely stringify and write JSON to localStorage. */
export function safeSetJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded or access denied — ignore */
  }
}
