/**
 * useFocusTrap — confines Tab navigation to inside a container
 * while the container is mounted/open. Restores focus to the
 * previously active element on unmount/close. Drop-in for any
 * modal component.
 *
 * Pure React — no dependencies outside of the browser DOM + the
 * `@/lib/a11y` tabbable helpers.
 *
 * Usage:
 *
 *   const ref = useFocusTrap<HTMLDivElement>(open);
 *   <div ref={ref} role="dialog" ...>
 *
 * Pass 16 history: ships the a11y layer for gap G20.
 */

import { useEffect, useRef } from "react";
import {
  focusFirstInteractive,
  getTabbableElements,
} from "@/lib/a11y";

export function useFocusTrap<T extends HTMLElement = HTMLElement>(
  enabled: boolean,
) {
  const containerRef = useRef<T | null>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);

  // On enable, remember the previously focused element and move
  // focus into the container. On disable, restore focus.
  useEffect(() => {
    if (!enabled) return;
    if (typeof document === "undefined") return;
    previousActiveRef.current = document.activeElement as HTMLElement | null;
    // Defer one microtask so the container's children have mounted.
    const id = setTimeout(() => {
      focusFirstInteractive(containerRef.current);
    }, 0);
    return () => {
      clearTimeout(id);
      // Restore focus to the previously active element
      const prev = previousActiveRef.current;
      if (prev && typeof prev.focus === "function") {
        try {
          prev.focus();
        } catch {
          /* element may have unmounted — ignore */
        }
      }
    };
  }, [enabled]);

  // Wrap-around Tab handling
  useEffect(() => {
    if (!enabled) return;
    if (typeof document === "undefined") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const container = containerRef.current;
      if (!container) return;
      const tabbables = getTabbableElements(container);
      if (tabbables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = tabbables[0];
      const last = tabbables[tabbables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!active || !container.contains(active)) {
        first.focus();
        e.preventDefault();
        return;
      }
      if (e.shiftKey && active === first) {
        last.focus();
        e.preventDefault();
      } else if (!e.shiftKey && active === last) {
        first.focus();
        e.preventDefault();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [enabled]);

  return containerRef;
}
