/**
 * VisualAnnouncer — the visible sibling of LiveAnnouncer.
 *
 * LiveAnnouncer pushes every `announce(msg, priority)` call into the
 * screen reader's aria-live region. For sighted users, that's invisible.
 * VisualAnnouncer subscribes to the same `multisensory-announce` custom
 * event and renders a subtle centered toast at the top of the viewport
 * with the announcement text, a matching icon, and a 2.5-second fade.
 *
 * Design rules:
 *   - Does NOT duplicate the aria-live output — this component is
 *     `aria-hidden="true"` so screen readers ignore it entirely. Only
 *     LiveAnnouncer's sr-only regions announce.
 *   - Respects `prefers-reduced-motion` via existing CSS override.
 *   - Polite toasts fade in/out softly. Assertive toasts snap in with a
 *     mild stewardship-gold pulse.
 *   - Only the MOST RECENT announcement is shown — a quick succession
 *     replaces each other, no stacking, no list overflow.
 *   - Auto-clears 2.5s (polite) or 3.5s (assertive) after display.
 *   - Safe-area aware on mobile (uses env(safe-area-inset-top)).
 */

import { useEffect, useRef, useState } from "react";
import { Info, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnnouncePriority } from "./LiveAnnouncer";

interface VisualToast {
  id: number;
  message: string;
  priority: AnnouncePriority;
}

let toastId = 0;

export function VisualAnnouncer() {
  const [toast, setToast] = useState<VisualToast | null>(null);
  const clearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ message: string; priority?: AnnouncePriority }>)
        .detail;
      if (!detail?.message) return;
      const priority = detail.priority ?? "polite";
      const id = ++toastId;
      setToast({ id, message: detail.message, priority });
      if (clearRef.current) clearTimeout(clearRef.current);
      clearRef.current = setTimeout(
        () => setToast((prev) => (prev?.id === id ? null : prev)),
        priority === "assertive" ? 3500 : 2500,
      );
    };

    window.addEventListener("multisensory-announce", handler);
    return () => {
      window.removeEventListener("multisensory-announce", handler);
      if (clearRef.current) clearTimeout(clearRef.current);
    };
  }, []);

  if (!toast) return null;

  const isAssertive = toast.priority === "assertive";

  return (
    <div
      aria-hidden="true"
      data-testid="multisensory-visual-toast"
      className={cn(
        "pointer-events-none fixed left-1/2 -translate-x-1/2 z-[70]",
        // Top-of-viewport with safe-area awareness for iOS notches
        "top-[calc(env(safe-area-inset-top,0px)+12px)]",
        // Entry animation
        "animate-in fade-in-0 slide-in-from-top-2 duration-200",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 rounded-full",
          "px-4 py-2 text-sm font-medium",
          "border shadow-lg backdrop-blur-md",
          isAssertive
            ? "bg-accent/95 text-accent-foreground border-accent/60 shadow-accent/20"
            : "bg-card/95 text-foreground border-border/60 shadow-black/20",
        )}
      >
        {isAssertive ? (
          <Volume2 className="w-4 h-4 shrink-0" aria-hidden />
        ) : (
          <Info className="w-4 h-4 shrink-0 text-accent" aria-hidden />
        )}
        <span className="truncate max-w-[60vw]">{toast.message}</span>
      </div>
    </div>
  );
}
