/**
 * VoiceOnboardingCoach.tsx — First-run voice features tour
 *
 * Build Loop Pass 11 (G47). A dismissible, one-time-per-browser
 * floating card that teaches users the 3 most-important voice
 * features:
 *   1. Shift+V — toggle hands-free mode
 *   2. Shift+R — read current page aloud
 *   3. "Hey Stewardly" / mic button — just say the command
 *
 * The coach only renders when:
 *   - STT capabilities include any voice support (mode !== "unsupported")
 *     — otherwise we're not telling users about features that don't work
 *   - The user hasn't already seen/dismissed it (localStorage)
 *   - Not on the SignIn / Landing / Terms / Privacy pages (don't
 *     interrupt authentication flows)
 *
 * Accessibility:
 *   - role="dialog" + aria-labelledby for the title
 *   - Escape closes
 *   - A "Dismiss" button with aria-label
 *   - The card itself is focusable (tabIndex={-1}) so SR users
 *     land on it after the announcement
 */

import { AudioLines, Mic, Keyboard, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { detectStt } from "@/lib/sttSupport";

const STORAGE_KEY = "stewardly-voice-coach-dismissed";
const SHOW_DELAY_MS = 2000; // Give the page a chance to settle first

/** Routes that should NOT show the coach (auth flows, marketing). */
const SUPPRESS_ROUTES = [
  "/signin",
  "/sign-in",
  "/signup",
  "/terms",
  "/privacy",
  "/welcome",
  "/welcome-landing",
];

function shouldSuppress(location: string): boolean {
  return SUPPRESS_ROUTES.some((r) => location === r || location.startsWith(`${r}/`));
}

export function VoiceOnboardingCoach() {
  const [location] = useLocation();
  const caps = useMemo(() => detectStt(), []);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Respect the suppress list + the capability probe + the
    // user's prior dismissal.
    if (shouldSuppress(location)) return;
    if (caps.mode === "unsupported") return;
    try {
      if (localStorage.getItem(STORAGE_KEY) === "true") return;
      // Don't overlap with the main onboarding tour — wait until it's done
      if (localStorage.getItem("onboarding_tour_completed") !== "true") return;
    } catch {
      return;
    }
    const t = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, [location, caps.mode]);

  const dismiss = (remember: boolean) => {
    setVisible(false);
    if (remember) {
      try {
        localStorage.setItem(STORAGE_KEY, "true");
      } catch {
        /* private mode — ignore */
      }
    }
  };

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible]);

  if (!visible) return null;

  const isPtt = caps.mode === "ptt_only";

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="voice-coach-title"
      tabIndex={-1}
      className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 max-w-sm rounded-2xl border border-accent/40 bg-card/95 shadow-[0_12px_48px_-12px_oklch(0.76_0.14_80_/_0.35)] backdrop-blur-md animate-message-in"
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center">
              <AudioLines className="w-5 h-5 text-accent" aria-hidden="true" />
            </div>
            <div>
              <h3
                id="voice-coach-title"
                className="text-sm font-semibold text-foreground font-heading"
              >
                Multisensory tour
              </h3>
              <p className="text-[10px] text-muted-foreground">
                {isPtt ? "Voice (push-to-talk)" : "Voice + keyboard + screen reader"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => dismiss(true)}
            aria-label="Dismiss voice tour"
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <ul className="mt-3 space-y-2.5">
          <li className="flex items-start gap-2.5 text-xs">
            <span className="mt-0.5 shrink-0 w-7 h-7 rounded-md bg-accent/10 border border-accent/20 flex items-center justify-center">
              <Keyboard className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
            </span>
            <div className="flex-1">
              <div className="font-medium text-foreground">Shift + V</div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                {isPtt
                  ? "Start push-to-talk. Hold the mic and speak."
                  : "Toggle hands-free mode from any page."}
              </p>
            </div>
          </li>

          <li className="flex items-start gap-2.5 text-xs">
            <span className="mt-0.5 shrink-0 w-7 h-7 rounded-md bg-accent/10 border border-accent/20 flex items-center justify-center">
              <Keyboard className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
            </span>
            <div className="flex-1">
              <div className="font-medium text-foreground">Shift + R</div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Read the current page aloud in any Stewardship voice.
              </p>
            </div>
          </li>

          <li className="flex items-start gap-2.5 text-xs">
            <span className="mt-0.5 shrink-0 w-7 h-7 rounded-md bg-accent/10 border border-accent/20 flex items-center justify-center">
              <Mic className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
            </span>
            <div className="flex-1">
              <div className="font-medium text-foreground">Say "send", "stop", or a page name</div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Once hands-free is on, talk to Steward like a colleague.
                "Stop" aborts the current response.
              </p>
            </div>
          </li>
        </ul>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => dismiss(false)}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            Maybe later
          </button>
          <button
            type="button"
            onClick={() => {
              dismiss(true);
              // Fire a hands-free toggle so the user experiences it.
              window.dispatchEvent(new CustomEvent("pil:toggle-handsfree"));
            }}
            className="text-[11px] font-medium px-3 py-1.5 rounded-md bg-accent text-accent-foreground hover:brightness-110 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            Try it now
          </button>
        </div>
      </div>
    </div>
  );
}
