/**
 * G28: TTSHighlighter — Renders text with the currently spoken word highlighted.
 *
 * Shows a compact, animated karaoke-style display during TTS playback.
 * The current word gets a primary-colored background highlight that
 * smoothly transitions between words.
 */
import { memo } from "react";
import type { TTSWordHighlight } from "@/hooks/useTTS";

interface TTSHighlighterProps {
  /** Current word highlight data from useTTS */
  highlight: TTSWordHighlight;
  /** Max characters to show (truncates with ellipsis). Default 120 */
  maxChars?: number;
  className?: string;
}

/**
 * Renders a window of text around the currently spoken word,
 * with the active word highlighted.
 */
export const TTSHighlighter = memo(function TTSHighlighter({
  highlight,
  maxChars = 120,
  className = "",
}: TTSHighlighterProps) {
  const { text, charIndex, charLength } = highlight;

  // Calculate a window around the current word
  const halfWindow = Math.floor(maxChars / 2);
  let windowStart = Math.max(0, charIndex - halfWindow);
  let windowEnd = Math.min(text.length, charIndex + charLength + halfWindow);

  // Adjust to not cut words
  if (windowStart > 0) {
    const spaceIdx = text.indexOf(" ", windowStart);
    if (spaceIdx > 0 && spaceIdx < charIndex) windowStart = spaceIdx + 1;
  }
  if (windowEnd < text.length) {
    const spaceIdx = text.lastIndexOf(" ", windowEnd);
    if (spaceIdx > charIndex + charLength) windowEnd = spaceIdx;
  }

  const before = text.slice(windowStart, charIndex);
  const word = text.slice(charIndex, charIndex + charLength);
  const after = text.slice(charIndex + charLength, windowEnd);

  return (
    <div
      className={`text-xs text-muted-foreground/70 leading-relaxed overflow-hidden ${className}`}
      aria-live="polite"
      aria-label={`Currently speaking: ${word}`}
    >
      {windowStart > 0 && <span className="text-muted-foreground/30">…</span>}
      <span>{before}</span>
      <span
        className="bg-primary/20 text-primary font-medium rounded px-0.5 transition-all duration-150"
      >
        {word}
      </span>
      <span>{after}</span>
      {windowEnd < text.length && <span className="text-muted-foreground/30">…</span>}
    </div>
  );
});
