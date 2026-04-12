/**
 * LiveAnnouncer — a global aria-live="polite" and aria-live="assertive" pair.
 *
 * Mounted once at the PILProvider level. Any component can dispatch an
 * `announce` event (or import `announce()` directly) to have a message
 * spoken by the user's screen reader without disrupting focus.
 *
 * Two regions:
 *   - polite: queued, no interruption — used for "Navigated to X",
 *     "Message sent", "Streaming complete"
 *   - assertive: interrupts — used for errors and hands-free mode transitions
 *
 * Implementation notes:
 *   - Each announcement is written for 5 seconds then cleared, so repeated
 *     identical messages still announce (screen readers debounce otherwise).
 *   - The regions are visually hidden via `sr-only` but remain in the a11y
 *     tree (we do NOT use `display:none`, which would remove them entirely).
 *   - We listen for a `multisensory-announce` CustomEvent so any module can
 *     emit without importing this file.
 */

import { useEffect, useRef, useState } from "react";

export type AnnouncePriority = "polite" | "assertive";

export interface AnnounceDetail {
  message: string;
  priority?: AnnouncePriority;
}

export function announce(message: string, priority: AnnouncePriority = "polite") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<AnnounceDetail>("multisensory-announce", {
      detail: { message, priority },
    }),
  );
}

export function LiveAnnouncer() {
  const [polite, setPolite] = useState("");
  const [assertive, setAssertive] = useState("");
  const politeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assertiveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<AnnounceDetail>).detail;
      if (!detail?.message) return;

      if (detail.priority === "assertive") {
        // Force a re-announcement by clearing first, then setting after a tick
        setAssertive("");
        if (assertiveTimer.current) clearTimeout(assertiveTimer.current);
        requestAnimationFrame(() => setAssertive(detail.message));
        assertiveTimer.current = setTimeout(() => setAssertive(""), 5000);
      } else {
        setPolite("");
        if (politeTimer.current) clearTimeout(politeTimer.current);
        requestAnimationFrame(() => setPolite(detail.message));
        politeTimer.current = setTimeout(() => setPolite(""), 5000);
      }
    };

    window.addEventListener("multisensory-announce", handler);
    return () => {
      window.removeEventListener("multisensory-announce", handler);
      if (politeTimer.current) clearTimeout(politeTimer.current);
      if (assertiveTimer.current) clearTimeout(assertiveTimer.current);
    };
  }, []);

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="multisensory-live-polite"
      >
        {polite}
      </div>
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
        data-testid="multisensory-live-assertive"
      >
        {assertive}
      </div>
    </>
  );
}
