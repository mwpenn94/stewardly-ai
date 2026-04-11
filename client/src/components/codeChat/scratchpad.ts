/**
 * Scratchpad — persistent per-device notes for Code Chat (Pass 240).
 *
 * A long-lived free-form notepad that lives outside any individual
 * conversation. Useful for:
 *   - Capturing commands, file paths, or one-liners while chatting
 *     that you want to revisit later in a different session
 *   - Dumping exploratory prompts before polishing them
 *   - Keeping a running to-do separate from any agent todos
 *   - Pasting multi-step instructions you'll feed to the agent
 *     piece by piece
 *
 * The scratchpad is a SINGLE shared document — if you want reusable
 * named blurbs, use the Prompt Templates library (Pass 214). This
 * module is deliberately minimal: content + timestamp + a handful of
 * pure helpers for common mutations. UI lives in ScratchpadPanel.tsx.
 */

export interface ScratchpadState {
  content: string;
  updatedAt: number;
}

export const STORAGE_KEY = "stewardly-codechat-scratchpad";
export const MAX_CONTENT_BYTES = 200_000; // 200KB cap — generous but bounded

export function emptyScratchpad(): ScratchpadState {
  return { content: "", updatedAt: 0 };
}

// ─── Pure mutations ────────────────────────────────────────────────────

/**
 * Set the full contents, trimming to MAX_CONTENT_BYTES if needed.
 */
export function setContent(_state: ScratchpadState, content: string): ScratchpadState {
  const trimmed =
    content.length > MAX_CONTENT_BYTES
      ? content.slice(0, MAX_CONTENT_BYTES)
      : content;
  return { content: trimmed, updatedAt: Date.now() };
}

/**
 * Append text to the end of the scratchpad with smart spacing. If
 * the existing content doesn't end with a newline, inserts one.
 * Empty input is a no-op.
 */
export function append(state: ScratchpadState, text: string): ScratchpadState {
  if (!text) return state;
  if (!state.content) {
    return setContent(state, text);
  }
  const sep = state.content.endsWith("\n") ? "" : "\n";
  return setContent(state, `${state.content}${sep}${text}`);
}

/**
 * Prepend text to the beginning of the scratchpad with smart spacing.
 */
export function prepend(state: ScratchpadState, text: string): ScratchpadState {
  if (!text) return state;
  if (!state.content) {
    return setContent(state, text);
  }
  return setContent(state, `${text}\n${state.content}`);
}

/**
 * Insert text at a specific cursor position. Used by the "inject here"
 * button once the user places their cursor in the scratchpad textarea.
 */
export function insertAt(
  state: ScratchpadState,
  position: number,
  text: string,
): ScratchpadState {
  if (!text) return state;
  const clamped = Math.max(0, Math.min(position, state.content.length));
  const before = state.content.slice(0, clamped);
  const after = state.content.slice(clamped);
  return setContent(state, `${before}${text}${after}`);
}

export function clear(): ScratchpadState {
  return emptyScratchpad();
}

// ─── Derivations ───────────────────────────────────────────────────────

export interface ScratchpadStats {
  chars: number;
  words: number;
  lines: number;
  pct: number; // fraction of MAX_CONTENT_BYTES used
}

export function scratchpadStats(state: ScratchpadState): ScratchpadStats {
  const chars = state.content.length;
  // Count non-empty tokens separated by whitespace
  const words = state.content.trim() ? state.content.trim().split(/\s+/).length : 0;
  const lines = state.content === "" ? 0 : state.content.split("\n").length;
  const pct = chars / MAX_CONTENT_BYTES;
  return { chars, words, lines, pct };
}

/**
 * Extract a "selection" of content by line range (1-indexed, inclusive).
 * Used by the "send selection to chat" button when the user wants to
 * inject just a subset of their scratchpad into the prompt.
 */
export function extractLines(
  state: ScratchpadState,
  startLine: number,
  endLine: number,
): string {
  const lines = state.content.split("\n");
  const s = Math.max(1, startLine);
  const e = Math.min(lines.length, endLine);
  if (s > e) return "";
  return lines.slice(s - 1, e).join("\n");
}

// ─── Persistence ───────────────────────────────────────────────────────

export function parseScratchpad(raw: string | null): ScratchpadState {
  if (!raw) return emptyScratchpad();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return emptyScratchpad();
    const rec = parsed as Record<string, unknown>;
    const content = typeof rec.content === "string" ? rec.content : "";
    const updatedAt = typeof rec.updatedAt === "number" ? rec.updatedAt : 0;
    return {
      content: content.slice(0, MAX_CONTENT_BYTES),
      updatedAt,
    };
  } catch {
    return emptyScratchpad();
  }
}

export function loadScratchpad(): ScratchpadState {
  try {
    return parseScratchpad(localStorage.getItem(STORAGE_KEY));
  } catch {
    return emptyScratchpad();
  }
}

export function saveScratchpad(state: ScratchpadState): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        content: state.content,
        updatedAt: state.updatedAt,
        version: 1,
      }),
    );
  } catch {
    /* quota */
  }
}
