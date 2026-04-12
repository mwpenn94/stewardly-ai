/**
 * Profile Library — a named-profile store for advisors who need to
 * switch between client profiles without losing the current working
 * set. Sits alongside the personal (unnamed) profile in localStorage
 * so the advisor can:
 *
 *   1. Save the current profile as a named entry (e.g., "Client:
 *      Jane Doe", "Prospect: Acme Industries MD").
 *   2. Browse the library, see completeness per entry.
 *   3. Switch to any saved entry — that becomes the active profile.
 *   4. Delete entries.
 *
 * Pure — no React imports. The React-side UI lives in
 * `client/src/components/financial-profile/ProfileLibraryPanel.tsx`.
 *
 * Force-multiplier intent: an advisor with 30 clients can now
 * demo the full wealth-engine suite across every client without
 * re-entering profile data. The library stays on-device so there's
 * no new privacy surface until G9's server sync is extended.
 *
 * Pass 10 history: ships gap G8 from docs/PARITY.md.
 */

import {
  type FinancialProfile,
  profileCompleteness,
  sanitizeProfile,
} from "@shared/financialProfile";

export interface LibraryEntry {
  id: string;
  label: string;
  profile: FinancialProfile;
  savedAt: string;
  /** Optional free-form notes the advisor can attach. */
  notes?: string;
}

export interface ProfileLibrary {
  version: number;
  entries: LibraryEntry[];
}

export const PROFILE_LIBRARY_STORAGE_KEY = "stewardly_profile_library";
export const PROFILE_LIBRARY_VERSION = 1;
export const PROFILE_LIBRARY_MAX_ENTRIES = 100;

export const EMPTY_LIBRARY: ProfileLibrary = Object.freeze({
  version: PROFILE_LIBRARY_VERSION,
  entries: [],
});

// ─── Parse / serialize ───────────────────────────────────────────────────

/**
 * Defensive parse. Tolerates malformed JSON + non-object wrappers,
 * returns an empty library on any failure. Re-sanitizes each entry's
 * profile through the shared sanitizer so a corrupted blob from an
 * older schema can't crash the library view.
 */
export function parseLibrary(raw: string | null): ProfileLibrary {
  if (!raw || typeof raw !== "string") return { ...EMPTY_LIBRARY };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...EMPTY_LIBRARY };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ...EMPTY_LIBRARY };
  }
  const obj = parsed as Record<string, unknown>;
  const rawEntries = Array.isArray(obj.entries) ? obj.entries : [];
  const entries: LibraryEntry[] = [];
  for (const e of rawEntries) {
    if (!e || typeof e !== "object") continue;
    const entry = e as Record<string, unknown>;
    if (typeof entry.id !== "string" || typeof entry.label !== "string") continue;
    if (!entry.profile || typeof entry.profile !== "object") continue;
    const profile = sanitizeProfile(entry.profile as Record<string, unknown>);
    entries.push({
      id: entry.id,
      label: entry.label.slice(0, 200),
      profile,
      savedAt:
        typeof entry.savedAt === "string"
          ? entry.savedAt
          : new Date().toISOString(),
      notes: typeof entry.notes === "string" ? entry.notes.slice(0, 2000) : undefined,
    });
  }
  return {
    version: PROFILE_LIBRARY_VERSION,
    entries,
  };
}

export function serializeLibrary(lib: ProfileLibrary): string {
  return JSON.stringify({
    version: PROFILE_LIBRARY_VERSION,
    entries: lib.entries,
  });
}

// ─── Mutations (pure, return new library objects) ──────────────────────

/**
 * Save the current profile as a new named entry. Capped at
 * PROFILE_LIBRARY_MAX_ENTRIES — oldest entries drop off when
 * the cap is reached.
 */
export function saveEntry(
  lib: ProfileLibrary,
  opts: {
    label: string;
    profile: FinancialProfile;
    notes?: string;
    /** Override the auto-generated id — useful for deterministic tests. */
    id?: string;
  },
): ProfileLibrary {
  const label = opts.label.trim().slice(0, 200);
  if (!label) return lib;
  const id = opts.id ?? `entry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const next: LibraryEntry = {
    id,
    label,
    profile: sanitizeProfile(opts.profile as Record<string, unknown>),
    savedAt: new Date().toISOString(),
    notes: opts.notes?.slice(0, 2000),
  };
  // Newest first, drop oldest when over the cap.
  const entries = [next, ...lib.entries.filter((e) => e.id !== id)].slice(
    0,
    PROFILE_LIBRARY_MAX_ENTRIES,
  );
  return {
    version: PROFILE_LIBRARY_VERSION,
    entries,
  };
}

/** Update the label + notes of an existing entry. No-op if not found. */
export function renameEntry(
  lib: ProfileLibrary,
  id: string,
  patch: { label?: string; notes?: string },
): ProfileLibrary {
  const entries = lib.entries.map((e) => {
    if (e.id !== id) return e;
    return {
      ...e,
      label: patch.label !== undefined ? patch.label.trim().slice(0, 200) || e.label : e.label,
      notes: patch.notes !== undefined ? patch.notes.slice(0, 2000) : e.notes,
    };
  });
  return { version: PROFILE_LIBRARY_VERSION, entries };
}

/** Delete an entry by id. */
export function deleteEntry(lib: ProfileLibrary, id: string): ProfileLibrary {
  return {
    version: PROFILE_LIBRARY_VERSION,
    entries: lib.entries.filter((e) => e.id !== id),
  };
}

/** Clear the entire library. */
export function clearLibrary(): ProfileLibrary {
  return { ...EMPTY_LIBRARY };
}

// ─── Lookup / queries ──────────────────────────────────────────────────

export function findEntry(lib: ProfileLibrary, id: string): LibraryEntry | undefined {
  return lib.entries.find((e) => e.id === id);
}

/**
 * Filter entries by a case-insensitive substring match on label + notes.
 */
export function filterEntries(lib: ProfileLibrary, query: string): LibraryEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return lib.entries;
  return lib.entries.filter((e) => {
    const hay = `${e.label} ${e.notes ?? ""}`.toLowerCase();
    return hay.includes(q);
  });
}

/**
 * Aggregate library stats — total entries, average completeness,
 * newest/oldest timestamps. Used by the advisor hub to show a
 * "You have 12 saved profiles (avg 64% complete)" header.
 */
export function libraryStats(lib: ProfileLibrary): {
  count: number;
  avgCompleteness: number;
  newest: string | null;
  oldest: string | null;
  fullCount: number;
  emptyCount: number;
} {
  if (lib.entries.length === 0) {
    return {
      count: 0,
      avgCompleteness: 0,
      newest: null,
      oldest: null,
      fullCount: 0,
      emptyCount: 0,
    };
  }
  let totalCompleteness = 0;
  let fullCount = 0;
  let emptyCount = 0;
  let newest = lib.entries[0].savedAt;
  let oldest = lib.entries[0].savedAt;
  for (const e of lib.entries) {
    const c = profileCompleteness(e.profile);
    totalCompleteness += c;
    if (c >= 0.85) fullCount++;
    if (c === 0) emptyCount++;
    if (e.savedAt > newest) newest = e.savedAt;
    if (e.savedAt < oldest) oldest = e.savedAt;
  }
  return {
    count: lib.entries.length,
    avgCompleteness: totalCompleteness / lib.entries.length,
    newest,
    oldest,
    fullCount,
    emptyCount,
  };
}
