import { describe, it, expect, beforeEach, afterEach } from "vitest";

// Tests run in the node env (vitest.config.ts), so we shim a `window`
// global before importing the module under test. The module uses
// `typeof window === "undefined"` for SSR safety + accesses
// `window.SpeechRecognition` / `window.webkitSpeechRecognition` so
// the shim only needs those two properties.
const g = globalThis as unknown as Record<string, unknown>;
if (g.window === undefined) g.window = g;

import {
  isVoiceInputSupported,
  createVoiceRecognizer,
  spliceTranscript,
} from "./voiceInput";

const w = g.window as Record<string, unknown>;

describe("isVoiceInputSupported", () => {
  let originalSpeech: unknown;
  let originalWebkit: unknown;

  beforeEach(() => {
    originalSpeech = w.SpeechRecognition;
    originalWebkit = w.webkitSpeechRecognition;
  });

  afterEach(() => {
    w.SpeechRecognition = originalSpeech;
    w.webkitSpeechRecognition = originalWebkit;
  });

  it("returns false when neither global is set", () => {
    delete w.SpeechRecognition;
    delete w.webkitSpeechRecognition;
    expect(isVoiceInputSupported()).toBe(false);
  });

  it("returns true when standard SpeechRecognition is set", () => {
    w.SpeechRecognition = function () {} as unknown;
    delete w.webkitSpeechRecognition;
    expect(isVoiceInputSupported()).toBe(true);
  });

  it("returns true when webkit prefix is set", () => {
    delete w.SpeechRecognition;
    w.webkitSpeechRecognition = function () {} as unknown;
    expect(isVoiceInputSupported()).toBe(true);
  });
});

describe("createVoiceRecognizer", () => {
  it("returns null when no SpeechRecognition is available", () => {
    delete w.SpeechRecognition;
    delete w.webkitSpeechRecognition;
    expect(createVoiceRecognizer()).toBeNull();
  });

  it("constructs a recognizer when the API is available", () => {
    class FakeRecognition {
      continuous = false;
      interimResults = false;
      lang = "";
      maxAlternatives = 1;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((ev: { error: string }) => void) | null = null;
      onresult: ((ev: any) => void) | null = null;
      start() {
        this.onstart?.();
      }
      stop() {
        this.onend?.();
      }
      abort() {}
    }
    w.SpeechRecognition = FakeRecognition;
    const states: string[] = [];
    const finals: string[] = [];
    const interims: string[] = [];
    const rec = createVoiceRecognizer({
      onStateChange: (s) => states.push(s),
      onFinal: (t) => finals.push(t),
      onTranscript: (t, isFinal) => {
        if (!isFinal) interims.push(t);
      },
    });
    expect(rec).not.toBeNull();
    rec!.start();
    // start() flips through "starting" → onstart fires → "listening"
    expect(states).toContain("starting");
    expect(states).toContain("listening");
  });

  it("forwards interim + final transcripts to the callbacks", () => {
    class FakeRecognition {
      continuous = false;
      interimResults = false;
      lang = "";
      maxAlternatives = 1;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((ev: { error: string }) => void) | null = null;
      onresult: ((ev: any) => void) | null = null;
      start() {
        this.onstart?.();
      }
      stop() {
        this.onend?.();
      }
      abort() {}
      // Test helper
      fire(transcript: string, isFinal: boolean) {
        this.onresult?.({
          resultIndex: 0,
          results: [
            {
              isFinal,
              0: { transcript, confidence: 0.9 },
              length: 1,
            },
          ],
        });
      }
    }
    w.SpeechRecognition = FakeRecognition;
    let lastTranscript = "";
    let lastFinal = "";
    const interimSpy: string[] = [];
    const rec = createVoiceRecognizer({
      onTranscript: (t, isFinal) => {
        lastTranscript = t;
        if (!isFinal) interimSpy.push(t);
      },
      onFinal: (t) => {
        lastFinal = t;
      },
    });
    rec!.start();
    // We need to grab the underlying instance to fire test events
    // Re-create the recognizer to capture the instance via a fresh
    // Ctor that captures `this`.
    let captured: FakeRecognition | null = null;
    class CapturingFake extends FakeRecognition {
      constructor() {
        super();
        captured = this;
      }
    }
    w.SpeechRecognition = CapturingFake;
    const rec2 = createVoiceRecognizer({
      onTranscript: (t, isFinal) => {
        lastTranscript = t;
        if (!isFinal) interimSpy.push(t);
      },
      onFinal: (t) => {
        lastFinal = t;
      },
    });
    rec2!.start();
    captured!.fire("hello", false);
    expect(lastTranscript).toBe("hello");
    expect(interimSpy).toContain("hello");
    captured!.fire("hello world.", true);
    expect(lastFinal).toBe("hello world.");
  });

  it("propagates errors to onError + flips state to error", () => {
    class FakeRecognition {
      continuous = false;
      interimResults = false;
      lang = "";
      maxAlternatives = 1;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((ev: { error: string }) => void) | null = null;
      onresult: ((ev: any) => void) | null = null;
      start() {
        this.onstart?.();
      }
      stop() {}
      abort() {}
    }
    w.SpeechRecognition = FakeRecognition;
    let captured: FakeRecognition | null = null;
    class CapturingFake extends FakeRecognition {
      constructor() {
        super();
        captured = this;
      }
    }
    w.SpeechRecognition = CapturingFake;
    let err = "";
    let state = "";
    const rec = createVoiceRecognizer({
      onError: (e) => {
        err = e;
      },
      onStateChange: (s) => {
        state = s;
      },
    });
    rec!.start();
    captured!.onerror?.({ error: "no-speech" });
    expect(err).toBe("no-speech");
    expect(state).toBe("error");
  });
});

describe("spliceTranscript", () => {
  it("inserts at the cursor with no leading space when input is empty", () => {
    const out = spliceTranscript("", 0, "hello");
    expect(out.next).toBe("hello");
    expect(out.cursor).toBe(5);
  });

  it("adds a leading space when joining to a non-whitespace tail", () => {
    const out = spliceTranscript("hi", 2, "world");
    expect(out.next).toBe("hi world");
    expect(out.cursor).toBe(out.next.length);
  });

  it("does not double-space when input already ends with whitespace", () => {
    const out = spliceTranscript("hi ", 3, "world");
    expect(out.next).toBe("hi world");
  });

  it("does not double-space when chunk starts with whitespace", () => {
    const out = spliceTranscript("hi", 2, " world");
    expect(out.next).toBe("hi world");
  });

  it("inserts in the middle and adds trailing space when followed by non-space", () => {
    const out = spliceTranscript("hi end", 3, "middle");
    // Cursor at 3 → before="hi ", after="end"
    // Leading space NOT needed (before ends with space). Trailing
    // space NEEDED (after starts with non-space).
    expect(out.next).toBe("hi middle end");
  });

  it("returns input unchanged when chunk is empty", () => {
    const out = spliceTranscript("hi", 1, "");
    expect(out.next).toBe("hi");
    expect(out.cursor).toBe(1);
  });

  it("places cursor at the end of the spliced chunk", () => {
    const out = spliceTranscript("foo bar", 4, "baz");
    expect(out.cursor).toBe(out.next.indexOf("baz") + "baz".length + 1); // +1 for trailing space
  });
});
