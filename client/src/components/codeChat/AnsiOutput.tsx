/**
 * AnsiOutput — Pass 250.
 *
 * Renders ANSI-colored text from bash command output. Uses the
 * `parseAnsi` + `styleToCss` helpers to convert escape sequences
 * into styled <span> elements inside a monospace <pre>.
 *
 * When the input has no ANSI codes, the component short-circuits to
 * a plain text render to avoid the segmentation overhead.
 */

import { useMemo } from "react";
import { parseAnsi, hasAnsi, styleToCss, stripAnsi } from "./ansiParser";

interface AnsiOutputProps {
  text: string;
  /** Max number of characters to render. Default 10000. */
  maxChars?: number;
  className?: string;
}

export default function AnsiOutput({
  text,
  maxChars = 10000,
  className = "",
}: AnsiOutputProps) {
  const { segments, stripped, truncated } = useMemo(() => {
    const raw = text ?? "";
    // Even when truncating we operate on the ANSI-stripped length so
    // we don't accidentally cut a sequence mid-escape, which would
    // leak unrendered codes into the output.
    const plain = stripAnsi(raw);
    const over = plain.length > maxChars;
    const workText = over ? raw.slice(0, maxChars * 1.5) : raw; // loose upper bound; parser handles trailing junk
    const segs = hasAnsi(workText) ? parseAnsi(workText) : null;
    return { segments: segs, stripped: plain, truncated: over };
  }, [text, maxChars]);

  if (!text) {
    return (
      <pre className={`text-[11px] font-mono text-muted-foreground italic ${className}`}>
        (no output)
      </pre>
    );
  }

  if (!segments) {
    // No ANSI at all — fast path
    return (
      <pre className={`text-[11px] font-mono whitespace-pre-wrap break-all ${className}`}>
        {truncated ? stripped.slice(0, maxChars) + "\n... (truncated)" : stripped}
      </pre>
    );
  }

  return (
    <pre
      className={`text-[11px] font-mono whitespace-pre-wrap break-all ${className}`}
    >
      {segments.map((seg, i) => (
        <span key={i} style={styleToCss(seg.style)}>
          {seg.text}
        </span>
      ))}
      {truncated && (
        <span className="italic text-muted-foreground">
          {"\n... (truncated)"}
        </span>
      )}
    </pre>
  );
}
