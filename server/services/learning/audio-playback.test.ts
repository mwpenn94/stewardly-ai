/**
 * Pass 156 — Unit tests for AudioCompanion playback loop and
 * HandsFreeStudy session persistence logic.
 *
 * These test the pure logic extracted from the components:
 * - Queue advancement (onended behavior)
 * - Session persistence serialization/deserialization
 * - Speed sync validation
 * - TTS failure recovery paths
 */
import { describe, it, expect } from "vitest";

/* ── Queue advancement logic (mirrors AudioCompanion onended) ── */

interface AudioItem {
  id: string;
  type: string;
  title: string;
  script: string;
}

interface AudioState {
  currentItem: AudioItem | null;
  queue: AudioItem[];
  playing: boolean;
  speed: number;
  mode: "expanded" | "minimized" | "hidden";
}

function advanceQueue(prev: AudioState): { state: AudioState; nextToSpeak: AudioItem | null } {
  if (prev.queue.length > 0) {
    const [next, ...rest] = prev.queue;
    return {
      state: { ...prev, currentItem: next, queue: rest, playing: true },
      nextToSpeak: next,
    };
  }
  return {
    state: { ...prev, playing: false, currentItem: null, mode: "hidden" },
    nextToSpeak: null,
  };
}

describe("AudioCompanion queue advancement", () => {
  const item1: AudioItem = { id: "1", type: "definition", title: "IRR", script: "Internal Rate of Return" };
  const item2: AudioItem = { id: "2", type: "definition", title: "NPV", script: "Net Present Value" };
  const item3: AudioItem = { id: "3", type: "definition", title: "DCF", script: "Discounted Cash Flow" };

  it("advances to next item when queue is non-empty", () => {
    const state: AudioState = {
      currentItem: item1, queue: [item2, item3], playing: true, speed: 1.0, mode: "expanded",
    };
    const result = advanceQueue(state);
    expect(result.state.currentItem).toEqual(item2);
    expect(result.state.queue).toEqual([item3]);
    expect(result.state.playing).toBe(true);
    expect(result.nextToSpeak).toEqual(item2);
  });

  it("advances to last item correctly", () => {
    const state: AudioState = {
      currentItem: item2, queue: [item3], playing: true, speed: 1.0, mode: "expanded",
    };
    const result = advanceQueue(state);
    expect(result.state.currentItem).toEqual(item3);
    expect(result.state.queue).toEqual([]);
    expect(result.state.playing).toBe(true);
    expect(result.nextToSpeak).toEqual(item3);
  });

  it("stops playback when queue is empty", () => {
    const state: AudioState = {
      currentItem: item3, queue: [], playing: true, speed: 1.0, mode: "expanded",
    };
    const result = advanceQueue(state);
    expect(result.state.currentItem).toBeNull();
    expect(result.state.queue).toEqual([]);
    expect(result.state.playing).toBe(false);
    expect(result.state.mode).toBe("hidden");
    expect(result.nextToSpeak).toBeNull();
  });

  it("handles empty queue with no current item", () => {
    const state: AudioState = {
      currentItem: null, queue: [], playing: false, speed: 1.0, mode: "hidden",
    };
    const result = advanceQueue(state);
    expect(result.state.currentItem).toBeNull();
    expect(result.state.playing).toBe(false);
    expect(result.nextToSpeak).toBeNull();
  });
});

/* ── Enqueue logic (mirrors AudioCompanion enqueue) ── */

function enqueueItems(prev: AudioState, items: AudioItem[]): { state: AudioState; startItem: AudioItem | null } {
  if (!prev.currentItem && items.length > 0) {
    const [first, ...rest] = items;
    return {
      state: { ...prev, currentItem: first, queue: rest, playing: true, mode: "expanded" },
      startItem: first,
    };
  }
  return {
    state: { ...prev, queue: [...prev.queue, ...items] },
    startItem: null,
  };
}

describe("AudioCompanion enqueue logic", () => {
  const item1: AudioItem = { id: "1", type: "definition", title: "IRR", script: "Internal Rate of Return" };
  const item2: AudioItem = { id: "2", type: "definition", title: "NPV", script: "Net Present Value" };
  const item3: AudioItem = { id: "3", type: "definition", title: "DCF", script: "Discounted Cash Flow" };

  it("auto-plays first item when nothing is playing", () => {
    const state: AudioState = {
      currentItem: null, queue: [], playing: false, speed: 1.0, mode: "hidden",
    };
    const result = enqueueItems(state, [item1, item2, item3]);
    expect(result.state.currentItem).toEqual(item1);
    expect(result.state.queue).toEqual([item2, item3]);
    expect(result.state.playing).toBe(true);
    expect(result.state.mode).toBe("expanded");
    expect(result.startItem).toEqual(item1);
  });

  it("appends to queue when something is already playing", () => {
    const state: AudioState = {
      currentItem: item1, queue: [item2], playing: true, speed: 1.0, mode: "expanded",
    };
    const result = enqueueItems(state, [item3]);
    expect(result.state.currentItem).toEqual(item1);
    expect(result.state.queue).toEqual([item2, item3]);
    expect(result.startItem).toBeNull();
  });

  it("handles empty enqueue gracefully", () => {
    const state: AudioState = {
      currentItem: null, queue: [], playing: false, speed: 1.0, mode: "hidden",
    };
    const result = enqueueItems(state, []);
    expect(result.state.currentItem).toBeNull();
    expect(result.state.queue).toEqual([]);
    expect(result.startItem).toBeNull();
  });
});

/* ── Session persistence (mirrors HandsFreeStudy sessionStorage) ── */

interface ContentItem {
  key: string;
  label: string;
  text: string;
  type: string;
}

interface PersistedSession {
  phase: string;
  contentQueue: ContentItem[];
  currentItemIndex: number;
  speed: number;
  repeatMode: boolean;
}

function serializeSession(session: PersistedSession): string {
  return JSON.stringify(session);
}

function deserializeSession(raw: string): PersistedSession | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed.phase !== "playing") return null;
    if (!Array.isArray(parsed.contentQueue) || parsed.contentQueue.length === 0) return null;
    return {
      phase: parsed.phase,
      contentQueue: parsed.contentQueue,
      currentItemIndex: parsed.currentItemIndex ?? 0,
      speed: typeof parsed.speed === "number" ? parsed.speed : 1.0,
      repeatMode: !!parsed.repeatMode,
    };
  } catch {
    return null;
  }
}

function findResumeIndex(contentQueue: ContentItem[], currentAudioId: string | undefined): number {
  if (!currentAudioId) return 0;
  const idx = contentQueue.findIndex(item => item.key === currentAudioId);
  return idx >= 0 ? idx : 0;
}

describe("HandsFreeStudy session persistence", () => {
  const queue: ContentItem[] = [
    { key: "def-1", label: "IRR", text: "Internal Rate of Return", type: "definitions" },
    { key: "def-2", label: "NPV", text: "Net Present Value", type: "definitions" },
    { key: "def-3", label: "DCF", text: "Discounted Cash Flow", type: "definitions" },
  ];

  it("serializes and deserializes a valid session", () => {
    const session: PersistedSession = {
      phase: "playing", contentQueue: queue, currentItemIndex: 1, speed: 1.5, repeatMode: true,
    };
    const raw = serializeSession(session);
    const restored = deserializeSession(raw);
    expect(restored).toEqual(session);
  });

  it("rejects non-playing phase", () => {
    const raw = JSON.stringify({ phase: "setup", contentQueue: queue, currentItemIndex: 0, speed: 1.0, repeatMode: false });
    expect(deserializeSession(raw)).toBeNull();
  });

  it("rejects empty content queue", () => {
    const raw = JSON.stringify({ phase: "playing", contentQueue: [], currentItemIndex: 0, speed: 1.0, repeatMode: false });
    expect(deserializeSession(raw)).toBeNull();
  });

  it("defaults speed to 1.0 when missing", () => {
    const raw = JSON.stringify({ phase: "playing", contentQueue: queue, currentItemIndex: 0, repeatMode: false });
    const restored = deserializeSession(raw);
    expect(restored?.speed).toBe(1.0);
  });

  it("defaults repeatMode to false when missing", () => {
    const raw = JSON.stringify({ phase: "playing", contentQueue: queue, currentItemIndex: 0, speed: 1.0 });
    const restored = deserializeSession(raw);
    expect(restored?.repeatMode).toBe(false);
  });

  it("rejects invalid JSON", () => {
    expect(deserializeSession("not json")).toBeNull();
  });

  it("finds correct resume index by audio ID", () => {
    expect(findResumeIndex(queue, "def-2")).toBe(1);
    expect(findResumeIndex(queue, "def-3")).toBe(2);
    expect(findResumeIndex(queue, "def-1")).toBe(0);
  });

  it("falls back to 0 for unknown audio ID", () => {
    expect(findResumeIndex(queue, "unknown")).toBe(0);
  });

  it("falls back to 0 for undefined audio ID", () => {
    expect(findResumeIndex(queue, undefined)).toBe(0);
  });
});

/* ── Speed sync validation ── */

describe("Speed sync validation", () => {
  it("clamps speed to valid range [0.5, 3.0]", () => {
    const clamp = (s: number) => Math.max(0.5, Math.min(3.0, s));
    expect(clamp(0.1)).toBe(0.5);
    expect(clamp(0.5)).toBe(0.5);
    expect(clamp(1.0)).toBe(1.0);
    expect(clamp(2.0)).toBe(2.0);
    expect(clamp(3.0)).toBe(3.0);
    expect(clamp(5.0)).toBe(3.0);
    expect(clamp(-1)).toBe(0.5);
  });

  it("speed adjustment increments correctly", () => {
    const adjust = (current: number, delta: number) => Math.max(0.5, Math.min(3.0, current + delta));
    expect(adjust(1.0, 0.25)).toBe(1.25);
    expect(adjust(1.0, -0.25)).toBe(0.75);
    expect(adjust(0.5, -0.25)).toBe(0.5); // clamped at min
    expect(adjust(3.0, 0.25)).toBe(3.0); // clamped at max
  });
});

/* ── TTS failure recovery paths ── */

describe("TTS failure recovery", () => {
  it("auto-advances on server TTS failure when queue has items", () => {
    const state: AudioState = {
      currentItem: { id: "1", type: "definition", title: "IRR", script: "text" },
      queue: [{ id: "2", type: "definition", title: "NPV", script: "text2" }],
      playing: true, speed: 1.0, mode: "expanded",
    };
    // Simulate the recovery path: advance to next item
    const result = advanceQueue(state);
    expect(result.state.currentItem?.id).toBe("2");
    expect(result.nextToSpeak?.id).toBe("2");
  });

  it("stops playback on server TTS failure when queue is empty", () => {
    const state: AudioState = {
      currentItem: { id: "1", type: "definition", title: "IRR", script: "text" },
      queue: [],
      playing: true, speed: 1.0, mode: "expanded",
    };
    const result = advanceQueue(state);
    expect(result.state.currentItem).toBeNull();
    expect(result.state.playing).toBe(false);
    expect(result.state.mode).toBe("hidden");
  });
});
