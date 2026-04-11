/**
 * shortcuts.ts — single source of truth for every keyboard shortcut
 * registered in the app.
 *
 * Before Pass 1, the shortcut list lived in TWO places:
 *   - `KeyboardShortcuts.tsx` (a display-only modal that LISTED shortcuts)
 *   - `hooks/useKeyboardShortcuts.ts` (a global hook that HANDLED a small
 *     subset of them)
 * The two drifted — the modal documented G-then-X chords and Ctrl+Shift+N
 * that were never actually handled anywhere.
 *
 * Pass 1 unifies them: this module exports `GLOBAL_SHORTCUTS`, and both
 * `useGlobalShortcuts` (the handler) and `KeyboardShortcuts` (the display
 * modal) consume it. A shortcut added here automatically:
 *   - gets handled by the global listener
 *   - appears in the help modal
 *   - is covered by the chord tests in `shortcuts.test.ts`
 *
 * Contract: pure data + pure chord state machine. Zero DOM access. Side
 * effects happen in the consuming hook.
 */

export type ShortcutCategory =
  | "Navigation"
  | "Chat"
  | "Audio & Voice"
  | "Accessibility"
  | "General";

/**
 * A shortcut binding. Two shapes are supported:
 *
 *   { mods: ["ctrl","shift"], key: "n", ... }   // modifier-only single key
 *   { chord: "g", key: "l", ... }               // press-then-press chord
 *
 * A shortcut with `chord` is triggered by pressing the chord key, releasing,
 * then pressing `key` within 1.5 seconds (no modifiers on either press).
 *
 * A shortcut with `mods` is triggered by holding those modifiers + key
 * together. Modifiers: "ctrl" matches both Ctrl and Cmd (macOS). "shift"
 * and "alt" are literal.
 */
export interface ShortcutDef {
  id: string;
  label: string;
  category: ShortcutCategory;

  // One of these two must be set.
  chord?: string;
  mods?: Array<"ctrl" | "shift" | "alt">;
  key: string;

  /** Intent id dispatched via the `multisensory-intent` custom event. */
  intent: ShortcutIntent;
  /** Extra data passed with the intent. */
  data?: Record<string, unknown>;

  /** Display-only — a pretty key label like ["⌘", "K"] or ["G", "then", "L"]. */
  display: string[];
  /** Short plain-English description (used by screen readers). */
  description: string;
  /** Screen-reader hint — defaults to description. */
  ariaLabel?: string;
  /** Pass 6: a secondary binding for the SAME intent. Hidden from the
   *  primary display modal but still active in the hook. Used to paper
   *  over browser menu conflicts (Firefox Alt+H = History menu, etc.). */
  fallback?: boolean;
}

export type ShortcutIntent =
  // Navigation
  | "nav.chat"
  | "nav.operations"
  | "nav.intelligence"
  | "nav.advisory"
  | "nav.relationships"
  | "nav.market_data"
  | "nav.documents"
  | "nav.integrations"
  | "nav.settings"
  | "nav.help"
  | "nav.learning"
  | "nav.wealth_engine"
  | "nav.leads"
  | "nav.audio_settings"
  // Chat
  | "chat.new"
  | "chat.focus_input"
  | "chat.toggle_sidebar"
  // Audio / voice
  | "audio.toggle_tts"
  | "audio.read_page"
  | "audio.stop_speech"
  | "voice.toggle_listening"
  | "voice.toggle_hands_free"
  // Accessibility
  | "a11y.show_shortcuts"
  | "a11y.focus_main"
  | "a11y.focus_nav"
  // General
  | "palette.open";

/**
 * Full global shortcut registry. Keep this alphabetically grouped by category
 * so the display modal has a predictable order.
 */
export const GLOBAL_SHORTCUTS: ShortcutDef[] = [
  // ── Navigation (G-then-X chord family) ──────────────────────────────
  {
    id: "nav.chat",
    label: "Go to Chat",
    category: "Navigation",
    chord: "g",
    key: "c",
    intent: "nav.chat",
    display: ["G", "then", "C"],
    description: "Open the Chat page",
  },
  {
    id: "nav.relationships",
    label: "Go to Relationships",
    category: "Navigation",
    chord: "g",
    key: "r",
    intent: "nav.relationships",
    display: ["G", "then", "R"],
    description: "Open the Relationships page",
  },
  {
    id: "nav.learning",
    label: "Go to Learning",
    category: "Navigation",
    chord: "g",
    key: "l",
    intent: "nav.learning",
    display: ["G", "then", "L"],
    description: "Open the Learning Center",
  },
  {
    id: "nav.operations",
    label: "Go to Operations",
    category: "Navigation",
    chord: "g",
    key: "o",
    intent: "nav.operations",
    display: ["G", "then", "O"],
    description: "Open the Operations Hub",
  },
  {
    id: "nav.intelligence",
    label: "Go to Intelligence Hub",
    category: "Navigation",
    chord: "g",
    key: "i",
    intent: "nav.intelligence",
    display: ["G", "then", "I"],
    description: "Open the Intelligence Hub",
  },
  {
    id: "nav.market_data",
    label: "Go to Market Data",
    category: "Navigation",
    chord: "g",
    key: "m",
    intent: "nav.market_data",
    display: ["G", "then", "M"],
    description: "Open the Market Data page",
  },
  {
    id: "nav.documents",
    label: "Go to Documents",
    category: "Navigation",
    chord: "g",
    key: "d",
    intent: "nav.documents",
    display: ["G", "then", "D"],
    description: "Open the Documents page",
  },
  {
    id: "nav.wealth_engine",
    label: "Go to Calculators",
    category: "Navigation",
    chord: "g",
    key: "w",
    intent: "nav.wealth_engine",
    display: ["G", "then", "W"],
    description: "Open the Wealth Engine calculators",
  },
  {
    id: "nav.settings",
    label: "Go to Settings",
    category: "Navigation",
    chord: "g",
    key: "s",
    intent: "nav.settings",
    display: ["G", "then", "S"],
    description: "Open the Settings page",
  },
  {
    id: "nav.help",
    label: "Go to Help",
    category: "Navigation",
    chord: "g",
    key: "h",
    intent: "nav.help",
    display: ["G", "then", "H"],
    description: "Open the Help & Support page",
  },
  {
    id: "nav.audio_settings",
    label: "Go to Audio Settings",
    category: "Navigation",
    chord: "g",
    key: "a",
    intent: "nav.audio_settings",
    display: ["G", "then", "A"],
    description: "Open the Audio Preferences page",
  },

  // ── Chat ────────────────────────────────────────────────────────────
  {
    id: "chat.new",
    label: "New conversation",
    category: "Chat",
    mods: ["ctrl", "shift"],
    key: "n",
    intent: "chat.new",
    display: ["Ctrl", "Shift", "N"],
    description: "Start a new conversation",
  },
  {
    id: "chat.focus_input",
    label: "Focus chat input",
    category: "Chat",
    key: "/",
    intent: "chat.focus_input",
    display: ["/"],
    description: "Place the cursor in the chat input",
  },
  {
    id: "chat.toggle_sidebar",
    label: "Toggle sidebar",
    category: "Chat",
    mods: ["ctrl", "shift"],
    key: "s",
    intent: "chat.toggle_sidebar",
    display: ["Ctrl", "Shift", "S"],
    description: "Show or hide the Chat sidebar",
  },

  // ── Audio & Voice ──────────────────────────────────────────────────
  // Pass 6: every Alt+X multisensory shortcut ALSO has a Ctrl+Shift+X
  // fallback registered so users on browsers where Alt+letter is bound
  // to a menu (Firefox on Windows: Alt+H = History) still have a path.
  // The fallback shortcuts share the same intent id but are hidden from
  // the display modal via a `fallback: true` flag on the shortcut def.
  {
    id: "voice.toggle_hands_free",
    label: "Toggle hands-free mode",
    category: "Audio & Voice",
    mods: ["alt"],
    key: "h",
    intent: "voice.toggle_hands_free",
    display: ["Alt", "H"],
    description: "Enter or exit hands-free voice mode",
    ariaLabel: "Toggle hands-free voice mode",
  },
  {
    id: "voice.toggle_hands_free.fallback",
    label: "Toggle hands-free mode (fallback)",
    category: "Audio & Voice",
    mods: ["ctrl", "shift"],
    key: "h",
    intent: "voice.toggle_hands_free",
    display: ["Ctrl", "Shift", "H"],
    description: "Fallback for browsers where Alt+H is reserved",
    fallback: true,
  },
  {
    id: "voice.toggle_listening",
    label: "Listen for one voice command",
    category: "Audio & Voice",
    mods: ["alt"],
    key: "v",
    intent: "voice.toggle_listening",
    display: ["Alt", "V"],
    description: "Listen for a single voice command without entering hands-free",
  },
  {
    id: "voice.toggle_listening.fallback",
    label: "Listen for one voice command (fallback)",
    category: "Audio & Voice",
    mods: ["ctrl", "shift"],
    key: "v",
    intent: "voice.toggle_listening",
    display: ["Ctrl", "Shift", "V"],
    description: "Fallback for browsers where Alt+V is reserved",
    fallback: true,
  },
  {
    id: "audio.read_page",
    label: "Read current page aloud",
    category: "Audio & Voice",
    mods: ["alt"],
    key: "r",
    intent: "audio.read_page",
    display: ["Alt", "R"],
    description: "Narrate the visible content of the current page",
  },
  {
    id: "audio.read_page.fallback",
    label: "Read current page aloud (fallback)",
    category: "Audio & Voice",
    mods: ["ctrl", "shift"],
    key: "r",
    intent: "audio.read_page",
    display: ["Ctrl", "Shift", "R"],
    description: "Fallback for browsers where Alt+R is reserved",
    fallback: true,
  },
  {
    id: "audio.stop_speech",
    label: "Stop all speech",
    category: "Audio & Voice",
    mods: ["alt"],
    key: "x",
    intent: "audio.stop_speech",
    display: ["Alt", "X"],
    description: "Immediately stop any TTS playback",
  },
  {
    id: "audio.stop_speech.fallback",
    label: "Stop all speech (fallback)",
    category: "Audio & Voice",
    mods: ["ctrl", "shift"],
    key: "x",
    intent: "audio.stop_speech",
    display: ["Ctrl", "Shift", "X"],
    description: "Fallback for browsers where Alt+X is reserved",
    fallback: true,
  },

  // ── Accessibility ──────────────────────────────────────────────────
  {
    id: "a11y.focus_main",
    label: "Jump to main content",
    category: "Accessibility",
    mods: ["alt"],
    key: "m",
    intent: "a11y.focus_main",
    display: ["Alt", "M"],
    description: "Move focus to the #main-content landmark",
  },
  {
    id: "a11y.focus_main.fallback",
    label: "Jump to main content (fallback)",
    category: "Accessibility",
    mods: ["ctrl", "shift"],
    key: "m",
    intent: "a11y.focus_main",
    display: ["Ctrl", "Shift", "M"],
    description: "Fallback for browsers where Alt+M is reserved",
    fallback: true,
  },
  {
    id: "a11y.focus_nav",
    label: "Jump to navigation",
    category: "Accessibility",
    mods: ["alt"],
    key: "n",
    intent: "a11y.focus_nav",
    display: ["Alt", "N"],
    description: "Move focus to the primary navigation landmark",
  },
  {
    id: "a11y.show_shortcuts",
    label: "Show keyboard shortcuts",
    category: "Accessibility",
    key: "?",
    intent: "a11y.show_shortcuts",
    display: ["?"],
    description: "Open the keyboard shortcuts reference",
  },

  // ── General ────────────────────────────────────────────────────────
  {
    id: "palette.open",
    label: "Open command palette",
    category: "General",
    mods: ["ctrl"],
    key: "k",
    intent: "palette.open",
    display: ["Ctrl", "K"],
    description: "Open the global command palette (Cmd+K on macOS)",
  },
];

/** True iff a KeyboardEvent matches a single-key shortcut's modifiers + key. */
export function matchesShortcut(e: KeyboardEvent, s: ShortcutDef): boolean {
  if (s.chord) return false; // chord shortcuts are matched via chord machine
  const key = e.key.toLowerCase();
  if (key !== s.key.toLowerCase()) return false;
  const mods = s.mods ?? [];
  const wantsCtrl = mods.includes("ctrl");
  const wantsShift = mods.includes("shift");
  const wantsAlt = mods.includes("alt");
  // "ctrl" matches both Ctrl and the macOS Cmd key (metaKey)
  const hasCtrl = e.ctrlKey || e.metaKey;
  if (wantsCtrl !== hasCtrl) return false;
  if (wantsShift !== e.shiftKey) return false;
  if (wantsAlt !== e.altKey) return false;
  return true;
}

/**
 * Chord state machine. The `pending` field tracks the first press of a
 * chord sequence (e.g. "g"). When a second key comes in within the timeout,
 * we attempt to match it against every registered chord shortcut.
 *
 * This is extracted as a pure function so it's directly unit-testable
 * without mocking timers or KeyboardEvents.
 */
export interface ChordState {
  pending: string | null;
  /** Milliseconds since epoch the pending chord key was pressed. */
  pendingAt: number;
}

export const CHORD_TIMEOUT_MS = 1500;

export function initialChordState(): ChordState {
  return { pending: null, pendingAt: 0 };
}

/** Result of stepping the chord machine one key press forward. */
export type ChordStep =
  | { kind: "match"; shortcut: ShortcutDef; next: ChordState }
  | { kind: "start"; next: ChordState }
  | { kind: "expired_start"; next: ChordState }
  | { kind: "reset"; next: ChordState }
  | { kind: "ignore" };

/**
 * Advance the chord state machine one key press.
 *
 * @param state — current chord state
 * @param key — lowercase key pressed (no modifiers)
 * @param now — Date.now() (pass a fake for tests)
 * @param shortcuts — the registry to match against
 */
export function stepChord(
  state: ChordState,
  key: string,
  now: number,
  shortcuts: ShortcutDef[] = GLOBAL_SHORTCUTS,
): ChordStep {
  const k = key.toLowerCase();

  // If there is a pending chord, try to match key against its second position
  if (state.pending && now - state.pendingAt <= CHORD_TIMEOUT_MS) {
    const match = shortcuts.find(
      (s) => s.chord === state.pending && s.key.toLowerCase() === k,
    );
    const cleared: ChordState = { pending: null, pendingAt: 0 };
    if (match) return { kind: "match", shortcut: match, next: cleared };
    return { kind: "reset", next: cleared };
  }

  // No pending (or pending expired): is THIS key a chord starter?
  const starter = shortcuts.find((s) => s.chord === k);
  if (starter) {
    return {
      kind: state.pending ? "expired_start" : "start",
      next: { pending: k, pendingAt: now },
    };
  }

  return { kind: "ignore" };
}

/** Group shortcuts by category for the display modal.
 *
 *  Pass 6: hides `fallback: true` shortcuts by default so the display
 *  modal shows ONE canonical binding per intent. Pass `{ includeFallbacks: true }`
 *  to see every binding (useful for admin debug views). */
export function groupShortcutsByCategory(
  shortcuts: ShortcutDef[] = GLOBAL_SHORTCUTS,
  opts: { includeFallbacks?: boolean } = {},
): Record<ShortcutCategory, ShortcutDef[]> {
  const groups: Record<ShortcutCategory, ShortcutDef[]> = {
    Navigation: [],
    Chat: [],
    "Audio & Voice": [],
    Accessibility: [],
    General: [],
  };
  for (const s of shortcuts) {
    if (s.fallback && !opts.includeFallbacks) continue;
    groups[s.category].push(s);
  }
  return groups;
}
