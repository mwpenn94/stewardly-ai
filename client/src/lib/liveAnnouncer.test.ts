import { describe, it, expect } from "vitest";
import {
  extractNewSentences,
  stripMarkdownForSpeech,
  shouldEmitChunk,
  createAnnouncerState,
  finalChunk,
} from "./liveAnnouncer";

describe("extractNewSentences", () => {
  it("returns empty when no new content", () => {
    const r = extractNewSentences("Hello world.", 12);
    expect(r.text).toBe("");
    expect(r.newLength).toBe(12);
  });

  it("extracts a complete sentence when terminated and long enough", () => {
    const input = "This is a long enough sentence to emit.";
    const r = extractNewSentences(input, 0);
    expect(r.text).toBe(input);
    expect(r.newLength).toBe(input.length);
  });

  it("extracts up to the last terminator, leaving an in-progress tail", () => {
    const r = extractNewSentences("First sentence. Second sentence. Mid fragment", 0);
    expect(r.text).toBe("First sentence. Second sentence.");
    expect(r.newLength).toBe("First sentence. Second sentence.".length);
  });

  it("skips fragments shorter than minChunkLength", () => {
    // "Hi!" is below the default minChunk of 24.
    const r = extractNewSentences("Hi!", 0);
    expect(r.text).toBe("");
    expect(r.newLength).toBe(0);
  });

  it("respects explicit minChunkLength", () => {
    const r = extractNewSentences("Hi!", 0, 2);
    expect(r.text).toBe("Hi!");
  });

  it("handles questions and exclamations", () => {
    const r = extractNewSentences("This is a long question with enough length?", 0);
    expect(r.text).toBe("This is a long question with enough length?");
  });

  it("returns empty when tail has no terminator", () => {
    const r = extractNewSentences("This is a sentence without a terminator yet", 0);
    expect(r.text).toBe("");
  });

  it("strips markdown formatting", () => {
    const r = extractNewSentences("**Bold** text and `code` and [link](url) here.", 0);
    expect(r.text).toBe("Bold text and code and link here.");
  });
});

describe("stripMarkdownForSpeech", () => {
  it("strips code fences", () => {
    expect(stripMarkdownForSpeech("before\n```js\ncode\n```\nafter")).toContain(
      "(code block)",
    );
  });
  it("removes bold/italic markers", () => {
    expect(stripMarkdownForSpeech("**hi** *there*")).toBe("hi there");
  });
  it("keeps link text, drops the URL", () => {
    expect(stripMarkdownForSpeech("See [docs](https://example.com) here")).toBe(
      "See docs here",
    );
  });
  it("drops heading #s", () => {
    expect(stripMarkdownForSpeech("# Heading\n## Sub\nbody")).toBe("Heading Sub body");
  });
  it("drops horizontal rules", () => {
    expect(stripMarkdownForSpeech("before\n---\nafter").trim()).toBe("before after");
  });
  it("collapses runs of whitespace", () => {
    expect(stripMarkdownForSpeech("lots    of\n\n\nwhitespace")).toBe(
      "lots of whitespace",
    );
  });
});

describe("shouldEmitChunk", () => {
  it("emits when there is new terminated content and enough time has passed", () => {
    const state = createAnnouncerState();
    const input = "First long sentence with enough length.";
    const r = shouldEmitChunk(input, state, 10000, 800);
    expect(r.emit).toBe(true);
    expect(r.text).toBe(input);
    expect(r.nextState.lastEmittedLength).toBe(input.length);
    expect(r.nextState.lastAnnouncementAt).toBe(10000);
  });

  it("does not emit before minInterval has elapsed", () => {
    const state = { lastEmittedLength: 0, lastAnnouncementAt: 9500 };
    const r = shouldEmitChunk("First long sentence with enough length.", state, 10000, 800);
    expect(r.emit).toBe(false);
    expect(r.nextState).toBe(state);
  });

  it("does not emit when there are no new sentences", () => {
    const state = { lastEmittedLength: 5, lastAnnouncementAt: 0 };
    const r = shouldEmitChunk("Hello", state, 10000);
    expect(r.emit).toBe(false);
  });

  it("advances state by the terminated prefix length only", () => {
    const state = createAnnouncerState();
    const r = shouldEmitChunk(
      "Complete sentence one is long enough. Mid fragment",
      state,
      1000,
    );
    expect(r.emit).toBe(true);
    expect(r.text).toBe("Complete sentence one is long enough.");
    expect(r.nextState.lastEmittedLength).toBe(
      "Complete sentence one is long enough.".length,
    );
  });
});

describe("finalChunk", () => {
  it("returns the un-emitted tail", () => {
    const state = { lastEmittedLength: 5, lastAnnouncementAt: 0 };
    expect(finalChunk("Hello world without terminator", state)).toBe(
      "world without terminator",
    );
  });

  it("returns empty when nothing remains", () => {
    const state = { lastEmittedLength: 30, lastAnnouncementAt: 0 };
    expect(finalChunk("Hello world without terminator", state)).toBe("");
  });

  it("strips markdown on the trailing tail", () => {
    const state = { lastEmittedLength: 0, lastAnnouncementAt: 0 };
    expect(finalChunk("**bold** then some text", state)).toBe("bold then some text");
  });
});
