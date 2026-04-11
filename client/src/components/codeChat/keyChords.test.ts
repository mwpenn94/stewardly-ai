/**
 * Tests for keyChords.ts (Pass 227).
 */

import { describe, it, expect } from "vitest";
import {
  emptyChordState,
  stepChord,
  isChordPrefix,
  allChordLabels,
} from "./keyChords";

describe("isChordPrefix", () => {
  it("returns true for known prefixes", () => {
    expect(isChordPrefix("g")).toBe(true);
  });
  it("returns false for unknown keys", () => {
    expect(isChordPrefix("z")).toBe(false);
    expect(isChordPrefix("")).toBe(false);
  });
});

describe("stepChord", () => {
  it("ignores unrelated keys from empty state", () => {
    const r = stepChord(emptyChordState(), "z", 0);
    expect(r.kind).toBe("ignore");
  });

  it("moves to pending on a chord prefix", () => {
    const r = stepChord(emptyChordState(), "g", 1000);
    expect(r.kind).toBe("pending");
    if (r.kind === "pending") {
      expect(r.next.pending).toBe("g");
      expect(r.next.pendingAt).toBe(1000);
    }
  });

  it("matches a completed chord", () => {
    const r = stepChord({ pending: "g", pendingAt: 100 }, "f", 200);
    expect(r.kind).toBe("match");
    if (r.kind === "match") {
      expect(r.match.tab).toBe("files");
      expect(r.match.label).toBe("Files");
      expect(r.next).toEqual(emptyChordState());
    }
  });

  it("matches every built-in g-chord", () => {
    const cases: Array<[string, string]> = [
      ["c", "chat"],
      ["f", "files"],
      ["r", "roadmap"],
      ["d", "diff"],
      ["h", "github"],
      ["w", "write"],
      ["j", "jobs"],
    ];
    for (const [key, tab] of cases) {
      const r = stepChord({ pending: "g", pendingAt: 0 }, key, 100);
      expect(r.kind).toBe("match");
      if (r.kind === "match") expect(r.match.tab).toBe(tab);
    }
  });

  it("resets on a wrong second key", () => {
    const r = stepChord({ pending: "g", pendingAt: 100 }, "z", 200);
    expect(r.kind).toBe("reset");
    if (r.kind === "reset") expect(r.next).toEqual(emptyChordState());
  });

  it("times out after timeoutMs and starts fresh", () => {
    // Pending was set at t=100, now is t=5000, timeout is 1500
    const r = stepChord({ pending: "g", pendingAt: 100 }, "f", 5000, 1500);
    // The timeout cleared the pending state, so "f" is treated as a fresh key
    // and since "f" isn't a chord prefix, the step is ignored
    expect(r.kind).toBe("ignore");
  });

  it("times out and accepts a new chord prefix fresh", () => {
    // After timeout, pressing "g" should start a new chord
    const r = stepChord({ pending: "g", pendingAt: 100 }, "g", 5000, 1500);
    expect(r.kind).toBe("pending");
  });
});

describe("allChordLabels", () => {
  it("returns every chord with its label", () => {
    const labels = allChordLabels();
    expect(labels.length).toBeGreaterThanOrEqual(7);
    expect(labels.every((l) => l.keys[0] === "g")).toBe(true);
    expect(labels.some((l) => l.label.includes("Files"))).toBe(true);
  });

  it("includes the g+s Find chord added in Pass 249", () => {
    const labels = allChordLabels();
    const findChord = labels.find((l) => l.keys[1] === "s");
    expect(findChord).toBeDefined();
    expect(findChord!.label).toContain("Find");
  });

  it("includes the g+p Replace chord added in Pass 250", () => {
    const labels = allChordLabels();
    const replaceChord = labels.find((l) => l.keys[1] === "p");
    expect(replaceChord).toBeDefined();
    expect(replaceChord!.label).toContain("Replace");
  });

  it("includes the g+k Checkpoints chord added in Pass 251", () => {
    const labels = allChordLabels();
    const cpChord = labels.find((l) => l.keys[1] === "k");
    expect(cpChord).toBeDefined();
    expect(cpChord!.label).toContain("Checkpoints");
  });

  it("includes the g+x Problems chord added in Pass 252", () => {
    const labels = allChordLabels();
    const xChord = labels.find((l) => l.keys[1] === "x");
    expect(xChord).toBeDefined();
    expect(xChord!.label).toContain("Problems");
  });

  it("includes the g+u PR Draft chord added in Pass 253", () => {
    const labels = allChordLabels();
    const uChord = labels.find((l) => l.keys[1] === "u");
    expect(uChord).toBeDefined();
    expect(uChord!.label).toContain("PR");
  });

  it("includes the g+t Tests chord added in Pass 255", () => {
    const labels = allChordLabels();
    const tChord = labels.find((l) => l.keys[1] === "t");
    expect(tChord).toBeDefined();
    expect(tChord!.label).toContain("Tests");
  });
});
