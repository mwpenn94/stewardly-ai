import { describe, it, expect } from "vitest";
import {
  computeWindow,
  segmentWindow,
  countRendered,
} from "./messageVirtualization";

function makeIds(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `m${i + 1}`);
}

describe("computeWindow", () => {
  it("returns full list when total <= threshold", () => {
    const ids = makeIds(50);
    const win = computeWindow(ids);
    expect(win.active).toBe(false);
    expect(win.visibleIndices).toHaveLength(50);
    expect(win.hiddenBefore).toBe(0);
    expect(win.hiddenAfter).toBe(0);
  });

  it("activates virtualization when total > threshold", () => {
    const ids = makeIds(150);
    const win = computeWindow(ids);
    expect(win.active).toBe(true);
    expect(win.visibleIndices.length).toBeLessThan(150);
  });

  it("renders the first headCount + last tailCount messages by default", () => {
    const ids = makeIds(200);
    const win = computeWindow(ids);
    // Default: head=5, tail=30
    // Expect indices 0..4 (head) and 170..199 (tail)
    expect(win.visibleIndices).toContain(0);
    expect(win.visibleIndices).toContain(4);
    expect(win.visibleIndices).toContain(170);
    expect(win.visibleIndices).toContain(199);
    // Mid-range should NOT be in
    expect(win.visibleIndices).not.toContain(100);
  });

  it("renders an anchor window around anchorId", () => {
    const ids = makeIds(200);
    const win = computeWindow(ids, { anchorId: "m100" });
    // Default anchorWindow = 10 → indices 89..109 around index 99
    expect(win.visibleIndices).toContain(99);
    expect(win.visibleIndices).toContain(89);
    expect(win.visibleIndices).toContain(109);
    // 80 should NOT be in
    expect(win.visibleIndices).not.toContain(80);
  });

  it("ignores unknown anchorId silently", () => {
    const ids = makeIds(200);
    const win = computeWindow(ids, { anchorId: "doesnt-exist" });
    expect(win.active).toBe(true);
    // Should still have head + tail
    expect(win.visibleIndices.length).toBeGreaterThanOrEqual(35);
  });

  it("includes pinned message ids regardless of position", () => {
    const ids = makeIds(200);
    const win = computeWindow(ids, { pinnedIds: ["m50", "m100"] });
    expect(win.visibleIndices).toContain(49); // m50 → index 49
    expect(win.visibleIndices).toContain(99); // m100 → index 99
  });

  it("dedupes overlapping head/anchor/pinned/tail regions", () => {
    const ids = makeIds(200);
    const win = computeWindow(ids, {
      anchorId: "m4", // overlaps with head
      pinnedIds: ["m200"], // overlaps with tail
    });
    // No duplicates allowed
    expect(new Set(win.visibleIndices).size).toBe(win.visibleIndices.length);
  });

  it("handles tiny tail+head settings without underflow", () => {
    const ids = makeIds(200);
    const win = computeWindow(ids, { headCount: 0, tailCount: 0 });
    // No anchor, no pinned → empty visible set
    expect(win.visibleIndices).toEqual([]);
    expect(win.hiddenBefore).toBe(200);
  });

  it("respects custom threshold", () => {
    const ids = makeIds(50);
    const win = computeWindow(ids, { threshold: 10 });
    expect(win.active).toBe(true);
  });

  it("computes hiddenBefore + hiddenAfter correctly", () => {
    const ids = makeIds(200);
    const win = computeWindow(ids, { headCount: 5, tailCount: 5 });
    // Visible: 0..4 + 195..199
    // hiddenBefore = first visible = 0
    // hiddenAfter = total - 1 - last visible = 200 - 1 - 199 = 0
    expect(win.hiddenBefore).toBe(0);
    expect(win.hiddenAfter).toBe(0);
  });
});

describe("segmentWindow", () => {
  it("returns a single visible segment when virtualization is off", () => {
    const ids = makeIds(50);
    const win = computeWindow(ids);
    const segs = segmentWindow(win);
    expect(segs).toHaveLength(1);
    expect(segs[0].kind).toBe("visible");
  });

  it("inserts a hidden segment between non-contiguous visible runs", () => {
    const ids = makeIds(200);
    const win = computeWindow(ids); // default head=5, tail=30 → gap 5..169
    const segs = segmentWindow(win);
    // Expect visible(0..4), hidden(5..169), visible(170..199)
    expect(segs).toHaveLength(3);
    expect(segs[0].kind).toBe("visible");
    expect(segs[1].kind).toBe("hidden");
    if (segs[1].kind === "hidden") {
      expect(segs[1].count).toBe(165);
      expect(segs[1].from).toBe(5);
      expect(segs[1].to).toBe(169);
    }
    expect(segs[2].kind).toBe("visible");
  });

  it("handles a leading hidden gap when head=0 and there's an anchor", () => {
    const ids = makeIds(200);
    const win = computeWindow(ids, {
      headCount: 0,
      tailCount: 5,
      anchorId: "m100", // visible 89..109
    });
    const segs = segmentWindow(win);
    // First segment should be hidden(0..88)
    expect(segs[0].kind).toBe("hidden");
    if (segs[0].kind === "hidden") expect(segs[0].from).toBe(0);
  });

  it("handles a trailing hidden gap when tail=0", () => {
    const ids = makeIds(200);
    const win = computeWindow(ids, {
      headCount: 5,
      tailCount: 0,
      anchorId: "m50", // visible 39..59
    });
    const segs = segmentWindow(win);
    // Last segment should be a hidden gap to the end
    expect(segs[segs.length - 1].kind).toBe("hidden");
    if (segs[segs.length - 1].kind === "hidden") {
      const seg = segs[segs.length - 1] as { kind: "hidden"; count: number; from: number; to: number };
      expect(seg.to).toBe(199);
    }
  });

  it("handles 3+ visible runs correctly", () => {
    const ids = makeIds(200);
    const win = computeWindow(ids, {
      anchorId: "m100",
      pinnedIds: ["m50"],
    });
    const segs = segmentWindow(win);
    // visible runs around: head(0..4), pinned(49..49), anchor(89..109), tail(170..199)
    const visibleRuns = segs.filter((s) => s.kind === "visible");
    expect(visibleRuns.length).toBeGreaterThanOrEqual(3);
  });

  it("returns a single hidden segment when no visible indices", () => {
    const ids = makeIds(200);
    const win = computeWindow(ids, { headCount: 0, tailCount: 0 });
    const segs = segmentWindow(win);
    expect(segs).toHaveLength(1);
    expect(segs[0].kind).toBe("hidden");
  });
});

describe("countRendered", () => {
  it("returns 0 for an all-hidden window", () => {
    const ids = makeIds(200);
    const win = computeWindow(ids, { headCount: 0, tailCount: 0 });
    const segs = segmentWindow(win);
    expect(countRendered(segs)).toBe(0);
  });

  it("returns the sum of visible-segment lengths", () => {
    const ids = makeIds(200);
    const win = computeWindow(ids); // default head=5, tail=30 = 35 visible
    const segs = segmentWindow(win);
    expect(countRendered(segs)).toBe(35);
  });

  it("returns total for non-virtualized lists", () => {
    const ids = makeIds(50);
    const win = computeWindow(ids);
    const segs = segmentWindow(win);
    expect(countRendered(segs)).toBe(50);
  });
});
