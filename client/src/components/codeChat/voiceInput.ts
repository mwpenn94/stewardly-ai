/**
 * Voice input adapter for the Code Chat prompt bar — Build-loop Pass 16 (G13).
 *
 * Wraps the browser SpeechRecognition API into a small reactive
 * helper so the chat input can offer push-to-talk dictation. Pure
 * state machine + adapter — no React, no DOM. The popover/button
 * lives in CodeChat.tsx and consumes `createVoiceRecognizer`.
 *
 * Design:
 *
 *   - **Feature-detected.** SpeechRecognition is non-standard and
 *     vendor-prefixed (`webkitSpeechRecognition` on Safari/Chrome).
 *     `isVoiceInputSupported()` returns false on Firefox/older
 *     browsers so the UI can hide the button entirely instead of
 *     rendering a broken control.
 *
 *   - **Continuous + interim transcripts.** Continuous mode keeps
 *     the recognizer alive for multi-sentence dictation; interim
 *     results stream the in-progress transcription so the user
 *     sees their words appear live.
 *
 *   - **Token-debounced state machine.** A typed `VoiceRecognizer`
 *     object exposes start/stop/abort + an event stream for
 *     `transcript`/`final`/`error`/`end` callbacks.
 *
 *   - **No third-party deps.** Web Speech API only — Apple
 *     Dictation, Chrome's cloud STT, and Edge's neural STT all
 *     plug in transparently.
 */

// The Web Speech API is non-standard so we declare the types we need.
interface NativeSpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: { transcript: string; confidence: number };
}

interface NativeSpeechRecognitionResultList {
  length: number;
  [index: number]: NativeSpeechRecognitionResult;
}

interface NativeSpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: NativeSpeechRecognitionResultList;
}

interface NativeSpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface NativeSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: NativeSpeechRecognitionEvent) => void) | null;
  onerror: ((ev: NativeSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

interface NativeSpeechRecognitionCtor {
  new (): NativeSpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: NativeSpeechRecognitionCtor;
    webkitSpeechRecognition?: NativeSpeechRecognitionCtor;
  }
}

/**
 * Returns true when the current browser exposes a SpeechRecognition
 * implementation we can drive. Safe to call from SSR — guards on
 * `typeof window`.
 */
export function isVoiceInputSupported(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function getRecognitionCtor(): NativeSpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export type VoiceRecognizerState =
  | "idle"
  | "starting"
  | "listening"
  | "stopping"
  | "ended"
  | "error";

export interface VoiceRecognizerEvents {
  /** Fired on every interim or final transcript chunk. */
  onTranscript?: (text: string, isFinal: boolean) => void;
  /** Fired only on final transcripts (committed text). */
  onFinal?: (text: string) => void;
  /** Fired on recognition errors (no permission, network, no-speech). */
  onError?: (error: string) => void;
  /** Fired when recognition naturally ends (user stops talking). */
  onEnd?: () => void;
  /** Fired when state changes — use to drive a UI indicator. */
  onStateChange?: (state: VoiceRecognizerState) => void;
}

export interface VoiceRecognizerOptions extends VoiceRecognizerEvents {
  /** BCP-47 language tag. Defaults to the browser's locale. */
  lang?: string;
  /** Whether to keep listening past silence. Default true. */
  continuous?: boolean;
  /** Whether to emit interim transcripts as the user speaks. Default true. */
  interimResults?: boolean;
}

export interface VoiceRecognizer {
  readonly state: VoiceRecognizerState;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

/**
 * Build a recognizer adapter. Returns null when the browser doesn't
 * support Web Speech (SSR-safe). The returned object is a tiny
 * imperative wrapper — there's no React state inside, so the caller
 * is responsible for forcing a re-render when `onStateChange` fires.
 */
export function createVoiceRecognizer(
  opts: VoiceRecognizerOptions = {},
): VoiceRecognizer | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) return null;

  const recognition = new Ctor();
  recognition.continuous = opts.continuous ?? true;
  recognition.interimResults = opts.interimResults ?? true;
  recognition.lang =
    opts.lang ?? (typeof navigator !== "undefined" ? navigator.language : "en-US");
  recognition.maxAlternatives = 1;

  let state: VoiceRecognizerState = "idle";
  const setState = (next: VoiceRecognizerState) => {
    if (state === next) return;
    state = next;
    opts.onStateChange?.(next);
  };

  recognition.onstart = () => setState("listening");
  recognition.onend = () => {
    setState("ended");
    opts.onEnd?.();
  };
  recognition.onerror = (ev) => {
    setState("error");
    opts.onError?.(ev.error || "unknown");
  };
  recognition.onresult = (ev) => {
    let interim = "";
    let final = "";
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const result = ev.results[i];
      const transcript = result[0]?.transcript ?? "";
      if (result.isFinal) {
        final += transcript;
      } else {
        interim += transcript;
      }
    }
    if (interim) opts.onTranscript?.(interim, false);
    if (final) {
      opts.onTranscript?.(final, true);
      opts.onFinal?.(final);
    }
  };

  return {
    get state() {
      return state;
    },
    start: () => {
      if (state === "starting" || state === "listening") return;
      setState("starting");
      try {
        recognition.start();
      } catch (err) {
        setState("error");
        opts.onError?.(err instanceof Error ? err.message : "start failed");
      }
    },
    stop: () => {
      if (state !== "listening" && state !== "starting") return;
      setState("stopping");
      try {
        recognition.stop();
      } catch {
        /* swallow — recognition.stop is best-effort */
      }
    },
    abort: () => {
      try {
        recognition.abort();
      } catch {
        /* swallow */
      }
      setState("idle");
    },
  };
}

/**
 * Splice a transcribed chunk into the existing input string at the
 * given cursor position. Used by the prompt bar so dictation merges
 * with whatever the user has already typed.
 *
 * Smart spacing: adds a single space between the existing tail and
 * the new chunk if the join would otherwise produce two adjacent
 * non-whitespace characters; never produces double spaces.
 */
export function spliceTranscript(
  input: string,
  cursor: number,
  chunk: string,
): { next: string; cursor: number } {
  if (!chunk) return { next: input, cursor };
  const before = input.slice(0, cursor);
  const after = input.slice(cursor);
  const needsLeadingSpace =
    before.length > 0 && !/\s$/.test(before) && !/^\s/.test(chunk);
  const needsTrailingSpace =
    after.length > 0 && !/^\s/.test(after) && !/\s$/.test(chunk);
  const insert = `${needsLeadingSpace ? " " : ""}${chunk}${
    needsTrailingSpace ? " " : ""
  }`;
  const next = `${before}${insert}${after}`;
  return {
    next,
    cursor: before.length + insert.length,
  };
}
