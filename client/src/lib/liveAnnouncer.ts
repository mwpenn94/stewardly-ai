/**
 * liveAnnouncer.ts — Sentence-chunked aria-live announcement for streaming content
 *
 * Build Loop Pass 5 (G3). Prior to this module, the Chat aria-live region
 * just said "AI is responding…" during streaming. A blind user had no way
 * to consume the actual answer without manually finding the new message
 * once streaming ended. Meanwhile the TTS audio track played immediately
 * on the complete response, so there was a multi-second window where the
 * screen reader user heard nothing at all.
 *
 * Fix: an incremental chunker that accepts the growing streamed content
 * and emits newly-complete sentences to the live region as they arrive.
 * We chunk on sentence terminators (. ! ?) with a minimum length so we
 * don't spam short fragments, and we debounce so rapid-fire tokens don't
 * turn into a machine-gun live-region update that screen readers can't
 * keep up with.
 *
 * Pure-function helpers (extractNewSentences, shouldEmitChunk) are
 * exported for unit testing.
 */

/**
 * Pure function — given a prior emitted length and the current streamed
 * content, return the newly-complete sentences as a single string, or ""
 * if nothing new is ready.
 *
 * Strategy:
 * 1. Slice out the un-emitted tail.
 * 2. Look for a sentence terminator (. ! ?). If found, emit up through
 *    the terminator. If not, wait.
 * 3. Never emit a fragment shorter than `minChunkLength` characters —
 *    short runs of "Hi!" would flood the live region.
 * 4. Strip markdown formatting (basic — headings, code fences, asterisks)
 *    so SR users don't hear "asterisk asterisk bold asterisk asterisk".
 */
export function extractNewSentences(
  content: string,
  lastEmittedLength: number,
  minChunkLength: number = 24,
): { text: string; newLength: number } {
  const tail = content.slice(lastEmittedLength);
  if (!tail) return { text: "", newLength: lastEmittedLength };

  // Find the last sentence terminator in the tail — that's our emit point.
  // We want the LAST one so we emit as much as possible in one go.
  // Match: period/?/! optionally followed by whitespace or end-of-string.
  const terminators = /[.!?](?:\s|$)/g;
  let lastEnd = -1;
  let m: RegExpExecArray | null;
  while ((m = terminators.exec(tail)) !== null) {
    lastEnd = m.index + 1; // include the terminator char
  }
  if (lastEnd === -1) {
    return { text: "", newLength: lastEmittedLength };
  }

  const raw = tail.slice(0, lastEnd);
  if (raw.length < minChunkLength) {
    return { text: "", newLength: lastEmittedLength };
  }

  return {
    text: stripMarkdownForSpeech(raw).trim(),
    newLength: lastEmittedLength + lastEnd,
  };
}

/**
 * Pure function — strip markdown noise so screen readers hear clean text.
 * Not a full markdown parser — covers the 5 patterns that trigger the
 * worst SR experiences. We only care about content that appears inline
 * in a streamed AI response.
 */
export function stripMarkdownForSpeech(text: string): string {
  return text
    // Fenced code blocks → "(code)" placeholder
    .replace(/```[\s\S]*?```/g, " (code block) ")
    // Inline code — keep content, drop backticks
    .replace(/`([^`]+)`/g, "$1")
    // Bold / italic — drop the stars, keep content
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    // Headings — drop leading #s
    .replace(/^#+\s+/gm, "")
    // Links — keep text, drop URL
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    // Horizontal rules — drop
    .replace(/^-{3,}$/gm, "")
    // Collapse runs of whitespace/newlines
    .replace(/\s+/g, " ");
}

/**
 * Shared state for an in-flight announcement stream. Create one per
 * streaming session.
 */
export interface AnnouncerState {
  lastEmittedLength: number;
  lastAnnouncementAt: number;
}

export function createAnnouncerState(): AnnouncerState {
  return { lastEmittedLength: 0, lastAnnouncementAt: 0 };
}

/**
 * Pure decision function — given the current streamed content + elapsed
 * time since the last announcement, decide whether to emit now or wait.
 * Minimum 800ms between announcements so SR users aren't overwhelmed.
 */
export function shouldEmitChunk(
  content: string,
  state: AnnouncerState,
  now: number = Date.now(),
  minInterval: number = 800,
): { emit: boolean; text: string; nextState: AnnouncerState } {
  const { text, newLength } = extractNewSentences(content, state.lastEmittedLength);
  if (!text) {
    return { emit: false, text: "", nextState: state };
  }
  const elapsed = now - state.lastAnnouncementAt;
  if (elapsed < minInterval) {
    return { emit: false, text: "", nextState: state };
  }
  return {
    emit: true,
    text,
    nextState: { lastEmittedLength: newLength, lastAnnouncementAt: now },
  };
}

/**
 * Compose the final-message announcement — used on the "done" SSE event
 * to catch any trailing content that never hit a sentence terminator
 * (common with code-block-ending responses).
 */
export function finalChunk(
  content: string,
  state: AnnouncerState,
): string {
  const tail = content.slice(state.lastEmittedLength);
  if (!tail) return "";
  return stripMarkdownForSpeech(tail).trim();
}
