/**
 * useGlobalShortcuts — the NEW multisensory keyboard layer.
 *
 * This hook is ADDITIVE: it only handles the Alt+X family of accessibility
 * shortcuts that did not exist before Pass 1. It deliberately does NOT
 * handle:
 *   - Ctrl+K (owned by `CommandPalette.tsx`)
 *   - `?` (owned by `KeyboardShortcuts.tsx`)
 *   - `/` (owned by page-level chat focus handlers)
 *   - G-then-X (owned by `useCustomShortcuts.ts` + Chat.tsx / AppShell.tsx
 *     inline handlers)
 *   - Ctrl+Shift+N, Ctrl+Shift+S (owned by Chat.tsx inline handlers)
 *
 * What it DOES handle:
 *   - Alt+H → toggle hands-free voice mode
 *   - Alt+V → listen for one voice command
 *   - Alt+R → read current page aloud
 *   - Alt+X → stop all speech immediately
 *   - Alt+M → focus #main-content landmark
 *   - Alt+N → focus primary nav landmark
 *
 * Every handler emits a `multisensory-intent` CustomEvent so other modules
 * (tests, macro recording, analytics) can observe without coupling to this
 * file. The `IntentRouter` component listens on that event and dispatches
 * the real side effects.
 */

import { useEffect, useRef } from "react";
import { GLOBAL_SHORTCUTS } from "./shortcuts";
import type { ShortcutIntent, ShortcutDef } from "./shortcuts";

export interface IntentDetail {
  intent: ShortcutIntent;
  data?: Record<string, unknown>;
  source: "keyboard" | "chord" | "voice" | "chat" | "click" | "api";
  shortcutId?: string;
}

/**
 * The subset of shortcut IDs that this hook actively handles. Keep in sync
 * with the registry so drift is impossible — any new Alt+X multisensory
 * shortcut added to shortcuts.ts should be added here too.
 *
 * Pass 6: the `.fallback` variants are ALSO handled because they share
 * intent IDs with their primary — users on browsers where Alt+H is the
 * History menu key can still fire the intent via Ctrl+Shift+H.
 */
const HANDLED_IDS = new Set<string>([
  "voice.toggle_hands_free",
  "voice.toggle_hands_free.fallback",
  "voice.toggle_listening",
  "voice.toggle_listening.fallback",
  "audio.read_page",
  "audio.read_page.fallback",
  "audio.stop_speech",
  "audio.stop_speech.fallback",
  "a11y.focus_main",
  "a11y.focus_main.fallback",
  "a11y.focus_nav",
  "a11y.next_heading",
  "a11y.prev_heading",
]);

export function dispatchIntent(detail: IntentDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<IntentDetail>("multisensory-intent", { detail }),
  );
}

/** True iff a keyboard event is targeting an editable element. */
function isEditingTarget(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  if (t.tagName === "INPUT" || t.tagName === "TEXTAREA") return true;
  if (t.isContentEditable) return true;
  return false;
}

/** Match a KeyboardEvent against a shortcut's mods + key. */
function matches(e: KeyboardEvent, s: ShortcutDef): boolean {
  if (s.chord) return false;
  const key = e.key.toLowerCase();
  if (key !== s.key.toLowerCase()) return false;
  const mods = s.mods ?? [];
  const wantsCtrl = mods.includes("ctrl");
  const wantsShift = mods.includes("shift");
  const wantsAlt = mods.includes("alt");
  const hasCtrl = e.ctrlKey || e.metaKey;
  if (wantsCtrl !== hasCtrl) return false;
  if (wantsShift !== e.shiftKey) return false;
  if (wantsAlt !== e.altKey) return false;
  return true;
}

export function useGlobalShortcuts() {
  const handledShortcuts = useRef<ShortcutDef[]>(
    GLOBAL_SHORTCUTS.filter((s) => HANDLED_IDS.has(s.id)),
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // All handled shortcuts are Alt-prefixed; they can fire inside editable
      // surfaces because Alt+letter isn't a typing keystroke.
      // But we still safely no-op inside contenteditable if it's NOT alt-prefixed.
      if (!e.altKey && isEditingTarget(e)) return;

      for (const s of handledShortcuts.current) {
        if (matches(e, s)) {
          e.preventDefault();
          dispatchIntent({
            intent: s.intent,
            source: "keyboard",
            shortcutId: s.id,
          });
          return;
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

export { GLOBAL_SHORTCUTS };
export type { ShortcutDef };
