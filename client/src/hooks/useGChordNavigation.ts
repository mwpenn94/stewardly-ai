/**
 * useGChordNavigation — Consolidated G-then-X chord handler.
 *
 * v8.2 Pass 2 (G55): Both AppShell.tsx and Chat.tsx had identical
 * copy-pasted g-chord handlers (~35 lines each). This hook replaces
 * both with a single source of truth.
 *
 * Usage: call `useGChordNavigation()` once in any component that
 * needs g-chord navigation. The hook reads the customizable shortcut
 * map from `useCustomShortcuts` and attaches a single window keydown
 * listener.
 */
import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useCustomShortcuts } from "./useCustomShortcuts";

export function useGChordNavigation() {
  const [, navigate] = useLocation();
  const { shortcutMap } = useCustomShortcuts();
  const gPressedRef = useRef(false);
  const gTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if another handler already consumed the event
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
      const isMod = e.metaKey || e.ctrlKey;

      if (!isInput && !isMod && !e.shiftKey) {
        if (e.key.toLowerCase() === "g") {
          gPressedRef.current = true;
          if (gTimerRef.current) clearTimeout(gTimerRef.current);
          gTimerRef.current = setTimeout(() => {
            gPressedRef.current = false;
          }, 800);
          return;
        }
        if (gPressedRef.current) {
          gPressedRef.current = false;
          if (gTimerRef.current) clearTimeout(gTimerRef.current);
          const route = shortcutMap.get(e.key.toLowerCase());
          if (route) {
            e.preventDefault();
            navigate(route);
          }
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      if (gTimerRef.current) clearTimeout(gTimerRef.current);
    };
  }, [navigate, shortcutMap]);
}
