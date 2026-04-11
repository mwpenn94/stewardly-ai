/**
 * useKeyboardShortcuts — Global keyboard shortcut handler
 *
 * Build Loop Pass 6 (G15 / G25 / G26 / G58): add discoverable keyboard
 * shortcuts for the multisensory features:
 *   - Shift+V — toggle hands-free voice mode (G25)
 *   - Shift+R — read current page aloud (G15, G26)
 *   - Ctrl/Cmd+K — open command palette (G58 — existing but not documented)
 *
 * Keeps the existing g-chord vocabulary. All single-letter + chord
 * shortcuts skip when the user is typing in an input so they don't
 * shadow ordinary typing.
 *
 * Dispatches `pil:*` window events instead of calling into PIL directly
 * — this keeps the hook dependency-free and lets any page subscribe to
 * the same events the voice command bus uses (so "toggle hands-free"
 * has a single consumer pattern whether it comes from voice or keyboard).
 */
import { useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";

interface ShortcutDef {
  key: string;
  chord?: string; // For g+h style shortcuts
  label: string;
  action: () => void;
  shift?: boolean;
  meta?: boolean;
}

export function useKeyboardShortcuts() {
  const [, navigate] = useLocation();
  const pendingChord = useRef<string | null>(null);
  const chordTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shortcuts: ShortcutDef[] = [
    { key: "?", label: "Show help", action: () => { document.dispatchEvent(new CustomEvent("toggle-help")); } },
    { key: "/", label: "Focus search", action: () => { document.dispatchEvent(new CustomEvent("focus-search")); } },
    { key: "h", chord: "g", label: "Go to Home (Chat)", action: () => navigate("/chat") },
    { key: "s", chord: "g", label: "Go to Settings", action: () => navigate("/settings") },
    { key: "c", chord: "g", label: "Go to Chat", action: () => navigate("/chat") },
    // Pass 98: dropped `g+d → /dashboard` (Dashboard.tsx was deleted
    // in pass 85 per v10.0). `g+i` → Intelligence Hub is the closest
    // substitute for the dashboard-style "overview" page.
    { key: "i", chord: "g", label: "Go to Intelligence Hub", action: () => navigate("/intelligence-hub") },
    { key: "l", chord: "g", label: "Go to Lead Pipeline", action: () => navigate("/leads") },
    { key: "o", chord: "g", label: "Go to Operations", action: () => navigate("/operations") },
    // Pass 6 (G15 / G26): Shift+R reads the current page aloud by
    // dispatching `pil:read-page`. AudioCompanion / PIL consumers
    // handle the actual TTS. If no consumer is mounted the event is
    // a no-op (safe default).
    {
      key: "r",
      shift: true,
      label: "Read page aloud",
      action: () => window.dispatchEvent(new CustomEvent("pil:read-page")),
    },
    // Pass 6 (G25): Shift+V toggles hands-free voice mode. Routes to
    // Chat's own voice mode when the user is on a chat page (Chat's
    // voice uses the transcript → handleSend path, which is
    // Chat-specific), otherwise falls through to PIL's navigation-
    // oriented voice mode. We dispatch both event names to keep the
    // wire tiny — each consumer guards on its own mount state.
    {
      key: "v",
      shift: true,
      label: "Toggle hands-free voice",
      action: () => {
        const onChat = typeof window !== "undefined" && window.location?.pathname?.startsWith("/chat");
        window.dispatchEvent(
          new CustomEvent(onChat ? "chat:toggle-handsfree" : "pil:toggle-handsfree"),
        );
      },
    },
  ];

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Skip if typing in an input
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

    const key = e.key.toLowerCase();

    // Pass 6 (G58): Ctrl/Cmd+K for command palette — let this pass
    // through even when the cmd/ctrl guard below would block it,
    // because the palette is the primary keyboard entry point and
    // users expect it in every app.
    if ((e.metaKey || e.ctrlKey) && key === "k") {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("toggle-command-palette"));
      return;
    }

    // Pass 6: explicit Shift+letter shortcuts (voice, read page).
    // These DO use a modifier so we check for shift before falling
    // through to the no-modifier branch.
    if (e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const match = shortcuts.find(
        (s) => s.shift && !s.chord && s.key === key,
      );
      if (match) {
        e.preventDefault();
        match.action();
        return;
      }
      // Fall through so Shift+Enter (native newline) and Shift+Tab
      // (native focus traverse) aren't swallowed.
      return;
    }

    // For the rest: block when any modifier is held
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    // Handle chord sequences (g + x)
    if (pendingChord.current) {
      const chord = pendingChord.current;
      pendingChord.current = null;
      if (chordTimeout.current) clearTimeout(chordTimeout.current);

      const match = shortcuts.find(s => s.chord === chord && s.key === key);
      if (match) {
        e.preventDefault();
        match.action();
        return;
      }
    }

    // Start a chord
    if (key === "g") {
      pendingChord.current = "g";
      chordTimeout.current = setTimeout(() => { pendingChord.current = null; }, 500);
      return;
    }

    // Single-key shortcuts
    const match = shortcuts.find(s => !s.chord && !s.shift && s.key === key);
    if (match) {
      e.preventDefault();
      match.action();
    }
  }, [navigate]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return { shortcuts };
}
