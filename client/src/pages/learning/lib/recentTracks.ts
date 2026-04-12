/**
 * recentTracks — Track which learning tracks the user has visited recently.
 *
 * Pure functions with localStorage persistence. No React hooks, no side effects
 * beyond localStorage reads/writes. Designed for unit testing.
 */

const STORAGE_KEY = "stewardly-recent-tracks";
const MAX_ENTRIES = 8;

export interface RecentTrack {
  slug: string;
  name: string;
  emoji: string;
  lastVisited: number; // epoch ms
}

export interface RecentTracksState {
  tracks: RecentTrack[];
}

/** Parse stored state from localStorage. Defensive against corruption. */
export function parseRecentTracks(raw: string | null): RecentTracksState {
  if (!raw) return { tracks: [] };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.tracks)) {
      return { tracks: [] };
    }
    const valid = parsed.tracks.filter(
      (t: any) =>
        t &&
        typeof t === "object" &&
        typeof t.slug === "string" &&
        typeof t.name === "string" &&
        typeof t.lastVisited === "number",
    );
    return { tracks: valid.slice(0, MAX_ENTRIES) };
  } catch {
    return { tracks: [] };
  }
}

/** Record a track visit. Moves existing entry to front, dedupes by slug. */
export function recordTrackVisit(
  state: RecentTracksState,
  track: RecentTrack,
): RecentTracksState {
  const filtered = state.tracks.filter((t) => t.slug !== track.slug);
  return {
    tracks: [track, ...filtered].slice(0, MAX_ENTRIES),
  };
}

/** Remove a track from the list. */
export function removeTrack(
  state: RecentTracksState,
  slug: string,
): RecentTracksState {
  return { tracks: state.tracks.filter((t) => t.slug !== slug) };
}

/** Get the N most recently visited tracks. */
export function getRecentTracks(
  state: RecentTracksState,
  limit = 4,
): RecentTrack[] {
  return state.tracks
    .sort((a, b) => b.lastVisited - a.lastVisited)
    .slice(0, limit);
}

/** Summarize for badges. */
export function summarizeRecentTracks(state: RecentTracksState): {
  count: number;
  mostRecent: RecentTrack | null;
} {
  return {
    count: state.tracks.length,
    mostRecent: state.tracks.length > 0
      ? state.tracks.reduce((a, b) => (a.lastVisited > b.lastVisited ? a : b))
      : null,
  };
}

// ─── localStorage Helpers ──────────────────────────────────────────

export function loadRecentTracks(): RecentTracksState {
  try {
    return parseRecentTracks(localStorage.getItem(STORAGE_KEY));
  } catch {
    return { tracks: [] };
  }
}

export function saveRecentTracks(state: RecentTracksState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full — fail silently
  }
}

/** Record a track visit and persist in one call. */
export function persistTrackVisit(slug: string, name: string, emoji = "📘"): void {
  const current = loadRecentTracks();
  const updated = recordTrackVisit(current, {
    slug,
    name,
    emoji,
    lastVisited: Date.now(),
  });
  saveRecentTracks(updated);
}
