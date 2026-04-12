/**
 * PushToTalkButton.tsx — Hold-to-dictate mic button
 *
 * Build Loop Pass 10 (G7). A button that starts STT capture on
 * mousedown / touchstart / keydown-space-or-enter, and ends on the
 * matching release event. On release, the transcript is passed to
 * the parent via `onTranscript`.
 *
 * UX:
 * - Visual: emerald "listening" state when active + interim transcript
 *   rendered next to the button so the user sees what's being captured.
 * - Audio: PIL earcon on start + on release (via window dispatch —
 *   the parent PIL provider catches it).
 * - Haptic: light vibration on start + medium on release (mobile only).
 * - Accessibility:
 *   - `role="button"` with aria-pressed reflecting isActive
 *   - aria-label describes current state
 *   - Space/Enter keyboard hold-and-release works identically to touch
 *   - aria-live="polite" for the interim transcript
 *   - Respects the pointercancel / pointerleave events so dragging off
 *     the button cancels (doesn't accidentally commit).
 *
 * Pass 10 (G66): touch target is 44×44 minimum per WCAG 2.5.5.
 * Also uses `touch-action: manipulation` to eliminate the 300ms tap
 * delay on mobile.
 */

import { Mic, MicOff } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { usePushToTalk } from "@/hooks/usePushToTalk";
import { cn } from "@/lib/utils";

interface Props {
  /** Called with the final captured transcript on release. */
  onTranscript: (text: string) => void;
  /** Called on every interim token if the browser supports it. */
  onInterim?: (text: string) => void;
  /** When true, the button is disabled and renders a muted mic-off icon. */
  disabled?: boolean;
  /** Optional className override for container layout. */
  className?: string;
  /** Optional custom label for SR users. Defaults to "Hold to speak". */
  ariaLabel?: string;
}

export function PushToTalkButton({
  onTranscript,
  onInterim,
  disabled = false,
  className,
  ariaLabel = "Hold to speak",
}: Props) {
  const ptt = usePushToTalk({
    onTranscript: (text) => {
      // Dispatch the designed "chat.sent" earcon — this is a voice
      // capture that will become a chat message.
      window.dispatchEvent(new CustomEvent("pil:send-feedback", { detail: { key: "chat.sent" } }));
      onTranscript(text);
    },
    onInterim,
  });

  const pointerDownRef = useRef(false);

  const beginCapture = useCallback(() => {
    if (disabled || !ptt.isAvailable) return;
    pointerDownRef.current = true;
    ptt.start();
    // Haptic: light vibration on press (mobile only).
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try { navigator.vibrate(10); } catch { /* ignore */ }
    }
    // Fire the designed "voice.listening_started" feedback spec via
    // the PIL dispatcher through the existing window event.
    window.dispatchEvent(new CustomEvent("pil:send-feedback", { detail: { key: "voice.listening_started" } }));
  }, [disabled, ptt]);

  const endCapture = useCallback(
    (shouldCommit: boolean) => {
      if (!pointerDownRef.current) return;
      pointerDownRef.current = false;
      if (shouldCommit) {
        ptt.release();
      } else {
        ptt.cancel();
      }
      // Medium haptic on release.
      if (shouldCommit && typeof navigator !== "undefined" && navigator.vibrate) {
        try { navigator.vibrate(20); } catch { /* ignore */ }
      }
      window.dispatchEvent(
        new CustomEvent("pil:send-feedback", { detail: { key: "voice.listening_stopped" } }),
      );
    },
    [ptt],
  );

  // Listen for global mouseup / touchend / pointercancel so the user
  // can drag off the button to cancel. This mirrors native push-to-talk
  // behavior in apps like WhatsApp / Slack.
  useEffect(() => {
    if (!ptt.isActive) return;
    const handleUp = () => {
      if (pointerDownRef.current) endCapture(true);
    };
    const handleCancel = () => {
      if (pointerDownRef.current) endCapture(false);
    };
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchend", handleUp);
    window.addEventListener("touchcancel", handleCancel);
    window.addEventListener("pointercancel", handleCancel);
    return () => {
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchend", handleUp);
      window.removeEventListener("touchcancel", handleCancel);
      window.removeEventListener("pointercancel", handleCancel);
    };
  }, [ptt.isActive, endCapture]);

  // Keyboard hold — Space/Enter start on keydown, commit on keyup.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.key === " " || e.key === "Enter") && !e.repeat && !ptt.isActive) {
        e.preventDefault();
        beginCapture();
      }
      if (e.key === "Escape" && ptt.isActive) {
        e.preventDefault();
        endCapture(false);
      }
    },
    [beginCapture, endCapture, ptt.isActive],
  );

  const handleKeyUp = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.key === " " || e.key === "Enter") && ptt.isActive) {
        e.preventDefault();
        endCapture(true);
      }
    },
    [endCapture, ptt.isActive],
  );

  const effectiveDisabled = disabled || !ptt.isAvailable;

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <button
        type="button"
        role="button"
        aria-pressed={ptt.isActive}
        aria-label={
          effectiveDisabled
            ? "Voice input unavailable"
            : ptt.isActive
              ? "Release to send"
              : ariaLabel
        }
        disabled={effectiveDisabled}
        onMouseDown={(e) => { e.preventDefault(); beginCapture(); }}
        onTouchStart={(e) => { e.preventDefault(); beginCapture(); }}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onMouseLeave={() => ptt.isActive && endCapture(false)}
        style={{ touchAction: "manipulation" }}
        className={cn(
          // Pass 10 (G66): 44×44 minimum touch target per WCAG 2.5.5.
          // Disabled state uses both opacity AND a distinct stroke so
          // color-blind users still see the disabled distinction.
          "relative inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-full border transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          effectiveDisabled
            ? "border-border/40 bg-secondary/30 text-muted-foreground/50 cursor-not-allowed"
            : ptt.isActive
              ? "border-accent bg-accent/20 text-accent animate-pulse-glow shadow-[0_0_0_4px_oklch(0.76_0.14_80_/_0.15)]"
              : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground hover:border-accent/50",
        )}
      >
        {effectiveDisabled ? (
          <MicOff className="w-4 h-4" aria-hidden="true" />
        ) : (
          <Mic className={cn("w-4 h-4", ptt.isActive && "text-accent")} aria-hidden="true" />
        )}
      </button>
      {ptt.isActive && ptt.interimText && (
        <div
          role="status"
          aria-live="polite"
          className="text-xs text-muted-foreground italic truncate max-w-[260px]"
        >
          "{ptt.interimText}"
        </div>
      )}
    </div>
  );
}
