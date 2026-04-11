/**
 * Keyboard chord shortcuts for Code Chat (Pass 227).
 *
 * Vim-style two-key sequences: press `g` then another key within
 * `timeoutMs` to trigger a chord action. Matches the GitHub-style
 * "g c / g p / g i" convention that power users already know.
 *
 * Supported chords:
 *   g c → go to Chat tab
 *   g f → go to Files tab
 *   g r → go to Roadmap tab
 *   g d → go to Diff tab
 *   g h → go to GitHub (read) tab
 *   g w → go to Git Write tab
 *   g j → go to Jobs tab
 *   g s → go to Find anywhere (workspace search) — Pass 249
 *
 * Pure state-machine functions so the logic is unit-testable
 * without DOM or React hooks.
 */

export interface ChordState {
  /** The key pressed first in a chord, or null if no chord is pending */
  pending: string | null;
  /** Epoch ms when `pending` was set; for timeout checks */
  pendingAt: number;
}

export interface ChordMatch {
  /** The chord's target tab value (passed to setActiveTab) */
  tab: string;
  /** Human-readable label for a toast */
  label: string;
}

export const DEFAULT_CHORD_TIMEOUT_MS = 1500;

const CHORD_MAP: Record<string, Record<string, ChordMatch>> = {
  g: {
    c: { tab: "chat", label: "Chat" },
    f: { tab: "files", label: "Files" },
    r: { tab: "roadmap", label: "Roadmap" },
    d: { tab: "diff", label: "Diff" },
    h: { tab: "github", label: "GitHub" },
    w: { tab: "write", label: "Git Write" },
    j: { tab: "jobs", label: "Jobs" },
    s: { tab: "search", label: "Find" },
    p: { tab: "replace", label: "Replace" },
    k: { tab: "checkpoints", label: "Checkpoints" },
    x: { tab: "diagnostics", label: "Problems" },
    u: { tab: "prdraft", label: "PR Draft" },
  },
};

export function emptyChordState(): ChordState {
  return { pending: null, pendingAt: 0 };
}

/**
 * Check if `key` starts a recognized chord. Used to decide whether
 * to set the pending state.
 */
export function isChordPrefix(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(CHORD_MAP, key);
}

/**
 * Advance the chord state machine on each keypress.
 *
 * Returns:
 *   - {kind: "ignore"}  — key doesn't start or complete a chord
 *   - {kind: "pending"} — key starts a chord; state is updated
 *   - {kind: "match", match} — chord completed; state resets
 *   - {kind: "reset"}   — pending timed out or was cancelled
 */
export type ChordStep =
  | { kind: "ignore" }
  | { kind: "pending"; next: ChordState }
  | { kind: "match"; match: ChordMatch; next: ChordState }
  | { kind: "reset"; next: ChordState };

export function stepChord(
  state: ChordState,
  key: string,
  now: number,
  timeoutMs: number = DEFAULT_CHORD_TIMEOUT_MS,
): ChordStep {
  // Cancel pending if the timeout elapsed
  const pending =
    state.pending && now - state.pendingAt > timeoutMs ? null : state.pending;

  if (pending === null) {
    if (isChordPrefix(key)) {
      return {
        kind: "pending",
        next: { pending: key, pendingAt: now },
      };
    }
    return { kind: "ignore" };
  }

  const chord = CHORD_MAP[pending]?.[key];
  if (chord) {
    return { kind: "match", match: chord, next: emptyChordState() };
  }
  // Wrong second key — reset
  return { kind: "reset", next: emptyChordState() };
}

/** Return every available chord as a label list — used by the shortcuts overlay. */
export function allChordLabels(): Array<{ keys: [string, string]; label: string }> {
  const out: Array<{ keys: [string, string]; label: string }> = [];
  for (const [first, rest] of Object.entries(CHORD_MAP)) {
    for (const [second, match] of Object.entries(rest)) {
      out.push({ keys: [first, second], label: `Go to ${match.label}` });
    }
  }
  return out;
}
