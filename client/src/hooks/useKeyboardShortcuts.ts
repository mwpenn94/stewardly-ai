/**
 * useKeyboardShortcuts — Global keyboard shortcut handler
 * Shortcuts: ? (help), g+h (home), g+s (settings), g+c (chat), / (search)
 */
import { useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";

interface ShortcutDef {
  key: string;
  chord?: string; // For g+h style shortcuts
  label: string;
  action: () => void;
}

export function useKeyboardShortcuts() {
  const [, navigate] = useLocation();
  const pendingChord = useRef<string | null>(null);
  const chordTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shortcuts: ShortcutDef[] = [
    { key: "?", label: "Show help", action: () => { /* toggle help modal via event */ document.dispatchEvent(new CustomEvent("toggle-help")); } },
    { key: "/", label: "Focus search", action: () => { document.dispatchEvent(new CustomEvent("focus-search")); } },
    { key: "h", chord: "g", label: "Go to Home", action: () => navigate("/") },
    { key: "s", chord: "g", label: "Go to Settings", action: () => navigate("/settings") },
    { key: "c", chord: "g", label: "Go to Chat", action: () => navigate("/chat") },
    { key: "d", chord: "g", label: "Go to Dashboard", action: () => navigate("/dashboard") },
    { key: "l", chord: "g", label: "Go to Lead Pipeline", action: () => navigate("/leads") },
    { key: "o", chord: "g", label: "Go to Operations", action: () => navigate("/operations") },
  ];

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Skip if typing in an input
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    const key = e.key.toLowerCase();

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
    const match = shortcuts.find(s => !s.chord && s.key === key);
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
