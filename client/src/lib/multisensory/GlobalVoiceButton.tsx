/**
 * GlobalVoiceButton — a prominent, persistent, keyboard-accessible mic
 * toggle for hands-free mode.
 *
 * Before Pass 1 the only way to enter hands-free was a small button buried
 * inside the AudioCompanion pill player, invisible until a user expanded it.
 * This button lives in the top-right of every page as a floating pill with
 * full ARIA wiring, a visible listening indicator, and the Alt+H global
 * shortcut hint.
 *
 * Design rules:
 *   - Never rendered inside AppShell specifically — it must exist on Chat,
 *     Login, Onboarding, and any standalone page too.
 *   - Respects `prefers-reduced-motion` (no pulse animation).
 *   - 44x44px minimum touch target.
 *   - aria-pressed reflects listening state.
 *   - Keyboard-accessible via both Alt+H global shortcut and direct Tab.
 *   - Stays out of the way: top-right, fixed, z-50, below toasters.
 */

import { useEffect, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { usePlatformIntelligence } from "@/components/PlatformIntelligence";
import { announce } from "./LiveAnnouncer";
import { cn } from "@/lib/utils";

export function GlobalVoiceButton() {
  const pil = usePlatformIntelligence();
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasSR =
      !!(window as any).SpeechRecognition ||
      !!(window as any).webkitSpeechRecognition;
    setSupported(hasSR);
  }, []);

  // If Web Speech is missing (Firefox, some mobile browsers) hide the button
  // entirely — we don't want to promise a feature we can't deliver.
  if (!supported) return null;

  const active = pil.handsFreeActive;
  const listening = pil.voiceListening;

  const toggle = () => {
    if (active) {
      pil.exitHandsFree();
      announce("Hands-free mode off", "assertive");
    } else {
      pil.enterHandsFree();
      announce(
        "Hands-free mode on. Say go to, followed by a page name.",
        "assertive",
      );
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={active}
      aria-label={
        active
          ? "Exit hands-free voice mode (Alt+H)"
          : "Enter hands-free voice mode (Alt+H)"
      }
      title={
        active
          ? "Hands-free on — click or press Alt+H to exit"
          : "Enter hands-free voice mode (Alt+H)"
      }
      data-testid="global-voice-button"
      className={cn(
        // Positioning — fixed bottom-left on mobile (above the bottom tab bar),
        // upper-left on desktop (below any top-level offline banners and
        // clear of the top-right NotificationBell / ChangelogBell cluster
        // that Chat.tsx already owns). Pass 3: moved from top-right to
        // avoid colliding with OfflineBanner (z-100) and NotificationBell.
        "fixed z-[60]",
        "bottom-20 left-3 lg:bottom-auto lg:top-16 lg:left-3",
        // Touch target baseline (WCAG 2.5.5 Target Size Level AAA)
        "min-w-[44px] min-h-[44px] rounded-full",
        // Visuals
        "flex items-center justify-center",
        "border border-border/60 shadow-lg shadow-black/20",
        "backdrop-blur-sm transition-colors",
        // State styling
        active
          ? "bg-accent text-accent-foreground border-accent/80"
          : "bg-card/90 text-foreground hover:bg-accent/10",
        // Focus ring matches the rest of the app's stewardship-gold style
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      {active ? (
        <Mic className={cn("w-5 h-5", listening && "mic-pulse-a11y")} aria-hidden />
      ) : (
        <MicOff className="w-5 h-5" aria-hidden />
      )}
      <span className="sr-only">
        {active
          ? listening
            ? "Listening for command"
            : "Hands-free ready"
          : "Hands-free off"}
      </span>
    </button>
  );
}
