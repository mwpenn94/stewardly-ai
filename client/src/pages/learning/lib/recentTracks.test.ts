/**
 * recentTracks — unit tests for recently-visited tracks tracker.
 */

import { describe, it, expect } from "vitest";
import {
  parseRecentTracks,
  recordTrackVisit,
  removeTrack,
  getRecentTracks,
  summarizeRecentTracks,
  type RecentTracksState,
  type RecentTrack,
} from "./recentTracks";

const mkTrack = (slug: string, name = slug, ago = 0): RecentTrack => ({
  slug,
  name,
  emoji: "📘",
  lastVisited: Date.now() - ago,
});

describe("parseRecentTracks", () => {
  it("returns empty for null", () => {
    expect(parseRecentTracks(null)).toEqual({ tracks: [] });
  });

  it("returns empty for malformed JSON", () => {
    expect(parseRecentTracks("{bad")).toEqual({ tracks: [] });
  });

  it("returns empty for non-object", () => {
    expect(parseRecentTracks('"hello"')).toEqual({ tracks: [] });
  });

  it("filters out malformed entries", () => {
    const raw = JSON.stringify({
      tracks: [
        { slug: "ok", name: "OK", emoji: "📘", lastVisited: 123 },
        { slug: 42 }, // invalid — slug not string
        { name: "missing slug" },
      ],
    });
    const result = parseRecentTracks(raw);
    expect(result.tracks.length).toBe(1);
    expect(result.tracks[0].slug).toBe("ok");
  });

  it("caps at 8 entries", () => {
    const tracks = Array.from({ length: 20 }, (_, i) => ({
      slug: `t${i}`,
      name: `Track ${i}`,
      emoji: "📘",
      lastVisited: Date.now() - i * 1000,
    }));
    const raw = JSON.stringify({ tracks });
    expect(parseRecentTracks(raw).tracks.length).toBe(8);
  });
});

describe("recordTrackVisit", () => {
  it("adds a new track to front", () => {
    const state: RecentTracksState = { tracks: [mkTrack("old", "Old", 5000)] };
    const result = recordTrackVisit(state, mkTrack("new", "New"));
    expect(result.tracks.length).toBe(2);
    expect(result.tracks[0].slug).toBe("new");
  });

  it("dedupes by slug (moves existing to front)", () => {
    const state: RecentTracksState = {
      tracks: [mkTrack("a", "A", 5000), mkTrack("b", "B", 3000)],
    };
    const result = recordTrackVisit(state, mkTrack("b", "B updated"));
    expect(result.tracks.length).toBe(2);
    expect(result.tracks[0].slug).toBe("b");
    expect(result.tracks[0].name).toBe("B updated");
  });

  it("caps at 8 entries", () => {
    const tracks = Array.from({ length: 8 }, (_, i) => mkTrack(`t${i}`));
    const state: RecentTracksState = { tracks };
    const result = recordTrackVisit(state, mkTrack("overflow"));
    expect(result.tracks.length).toBe(8);
    expect(result.tracks[0].slug).toBe("overflow");
  });
});

describe("removeTrack", () => {
  it("removes by slug", () => {
    const state: RecentTracksState = {
      tracks: [mkTrack("a"), mkTrack("b")],
    };
    expect(removeTrack(state, "a").tracks.length).toBe(1);
    expect(removeTrack(state, "a").tracks[0].slug).toBe("b");
  });

  it("no-op for unknown slug", () => {
    const state: RecentTracksState = { tracks: [mkTrack("a")] };
    expect(removeTrack(state, "z").tracks.length).toBe(1);
  });
});

describe("getRecentTracks", () => {
  it("returns newest first", () => {
    const state: RecentTracksState = {
      tracks: [mkTrack("old", "Old", 10000), mkTrack("new", "New", 0)],
    };
    const recent = getRecentTracks(state, 2);
    expect(recent[0].slug).toBe("new");
  });

  it("respects limit", () => {
    const state: RecentTracksState = {
      tracks: [mkTrack("a"), mkTrack("b"), mkTrack("c")],
    };
    expect(getRecentTracks(state, 2).length).toBe(2);
  });
});

describe("summarizeRecentTracks", () => {
  it("returns count and most recent", () => {
    const state: RecentTracksState = {
      tracks: [mkTrack("a", "A", 5000), mkTrack("b", "B", 0)],
    };
    const summary = summarizeRecentTracks(state);
    expect(summary.count).toBe(2);
    expect(summary.mostRecent?.slug).toBe("b");
  });

  it("returns null mostRecent for empty state", () => {
    expect(summarizeRecentTracks({ tracks: [] }).mostRecent).toBeNull();
  });
});
