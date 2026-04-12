/**
 * VoiceSupportBanner.tsx — User-visible banner when the browser can't do
 * full continuous STT.
 *
 * Build Loop Pass 2 (G59). Prior to this, Firefox / Safari iOS users saw a
 * mic button that did nothing when pressed — the worst kind of silent fail.
 * This banner appears inline above the chat input (or in a compact variant
 * next to the mic button) when `sttSupport.detectStt()` reports anything
 * other than "full".
 *
 * Accessibility:
 * - `role="status"` + `aria-live="polite"` so SR users hear the fallback
 *   instructions once.
 * - The dismiss button is a real `<button>` with `aria-label`.
 * - Text is not color-alone — the icon + bolded label convey meaning for
 *   users on hostile color palettes.
 */

import { AlertTriangle, MicOff, Info, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { type SttCapabilities } from "@/lib/sttSupport";

interface Props {
  caps: SttCapabilities;
  /** Optional: hide after dismiss. Uses localStorage so "dismissed" persists. */
  dismissible?: boolean;
  /** Class name override for layout placement. */
  className?: string;
  /** Compact variant — small inline pill next to the mic button. */
  compact?: boolean;
}

const DISMISS_KEY = "stewardly-voice-banner-dismissed";

export function VoiceSupportBanner({
  caps,
  dismissible = true,
  className,
  compact = false,
}: Props) {
  const initiallyDismissed = (() => {
    try {
      return typeof localStorage !== "undefined" && localStorage.getItem(DISMISS_KEY) === caps.browserFamily;
    } catch {
      return false;
    }
  })();
  const [dismissed, setDismissed] = useState(initiallyDismissed);

  // Full support → nothing to show.
  if (caps.mode === "full") return null;
  if (dismissed) return null;

  const isBlocker = caps.mode === "unsupported";
  const Icon = isBlocker ? MicOff : caps.mode === "ptt_only" ? Info : AlertTriangle;

  const onDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, caps.browserFamily);
    } catch {
      /* ignore — private mode, etc. */
    }
  };

  if (compact) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
          isBlocker
            ? "border-destructive/40 bg-destructive/10 text-destructive"
            : "border-chart-3/40 bg-chart-3/10 text-chart-3",
          className,
        )}
        title={caps.recoveryHint}
      >
        <Icon className="h-3 w-3" aria-hidden="true" />
        <span className="font-medium">{caps.userMessage}</span>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 text-sm",
        isBlocker
          ? "border-destructive/40 bg-destructive/5 text-destructive-foreground"
          : "border-chart-3/40 bg-chart-3/5 text-foreground",
        className,
      )}
    >
      <Icon
        className={cn("h-5 w-5 shrink-0", isBlocker ? "text-destructive" : "text-chart-3")}
        aria-hidden="true"
      />
      <div className="flex-1">
        <div className="font-semibold">{caps.userMessage}</div>
        <div className="mt-1 text-xs text-muted-foreground">{caps.recoveryHint}</div>
      </div>
      {dismissible && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-secondary/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Dismiss voice support notice"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
