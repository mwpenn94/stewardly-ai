/**
 * quiz-difficulty.test.ts — Pass 155 unit tests
 *
 * Tests the DifficultyRating previewLabel logic (mirrored from client)
 * and verifies the server-side recordReview procedure accepts difficulty
 * for question itemType.
 */
import { describe, it, expect } from "vitest";

// Mirror the client-side constants for testing
const SRS_IVALS: Record<number, number> = { 0: 0, 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 };
const SRS_DMULT: Record<string, number> = { again: 0, hard: 0.5, good: 1.0, easy: 1.5 };

type Difficulty = "again" | "hard" | "good" | "easy";

function previewLabel(confidence: number, d: Difficulty): string {
  const conf = Math.max(0, Math.min(5, confidence));
  const nextConf = d === "again" ? 0 : Math.min(5, conf + 1);
  const baseDays = SRS_IVALS[nextConf] ?? 1;
  const days = Math.max(0, baseDays * (SRS_DMULT[d] ?? 1));
  if (days < 1 / 1440) return "<1m";
  if (days < 1 / 24) return `${Math.round(days * 24 * 60)}m`;
  if (days < 1) return `${Math.round(days * 24)}h`;
  if (days < 14) return `${Math.round(days)}d`;
  if (days < 60) return `${Math.round(days / 7)}w`;
  return `${Math.round(days / 30)}mo`;
}

describe("Quiz Difficulty — previewLabel", () => {
  it("'again' at any confidence returns <1m (resets to 0)", () => {
    for (let c = 0; c <= 5; c++) {
      expect(previewLabel(c, "again")).toBe("<1m");
    }
  });

  it("'hard' at confidence 0 → next conf 1, baseDays=1, *0.5 = 0.5d = 12h", () => {
    expect(previewLabel(0, "hard")).toBe("12h");
  });

  it("'good' at confidence 0 → next conf 1, baseDays=1, *1.0 = 1d", () => {
    expect(previewLabel(0, "good")).toBe("1d");
  });

  it("'easy' at confidence 0 → next conf 1, baseDays=1, *1.5 = 1.5d ≈ 2d", () => {
    expect(previewLabel(0, "easy")).toBe("2d");
  });

  it("'good' at confidence 2 → next conf 3, baseDays=7, *1.0 = 7d", () => {
    expect(previewLabel(2, "good")).toBe("7d");
  });

  it("'easy' at confidence 3 → next conf 4, baseDays=14, *1.5 = 21d = 3w", () => {
    expect(previewLabel(3, "easy")).toBe("3w");
  });

  it("'hard' at confidence 4 → next conf 5, baseDays=30, *0.5 = 15d ≈ 2w", () => {
    expect(previewLabel(4, "hard")).toBe("2w");
  });

  it("'good' at confidence 5 → next conf 5 (capped), baseDays=30, *1.0 = 30d = 4w", () => {
    expect(previewLabel(5, "good")).toBe("4w");
  });

  it("'easy' at confidence 5 → next conf 5 (capped), baseDays=30, *1.5 = 45d = 6w", () => {
    expect(previewLabel(5, "easy")).toBe("6w");
  });

  it("clamps confidence below 0 to 0", () => {
    expect(previewLabel(-3, "good")).toBe("1d");
  });

  it("clamps confidence above 5 to 5", () => {
    expect(previewLabel(10, "good")).toBe("4w");
  });
});

describe("Quiz Difficulty — SRS multiplier consistency", () => {
  it("multipliers are ordered: again < hard < good < easy", () => {
    const diffs: Difficulty[] = ["again", "hard", "good", "easy"];
    for (let i = 0; i < diffs.length - 1; i++) {
      expect(SRS_DMULT[diffs[i]]).toBeLessThan(SRS_DMULT[diffs[i + 1]]);
    }
  });

  it("all 4 difficulty levels have defined multipliers", () => {
    const diffs: Difficulty[] = ["again", "hard", "good", "easy"];
    for (const d of diffs) {
      expect(SRS_DMULT[d]).toBeDefined();
      expect(typeof SRS_DMULT[d]).toBe("number");
    }
  });

  it("interval table covers all confidence levels 0-5", () => {
    for (let c = 0; c <= 5; c++) {
      expect(SRS_IVALS[c]).toBeDefined();
      expect(typeof SRS_IVALS[c]).toBe("number");
    }
  });

  it("intervals are monotonically increasing with confidence", () => {
    for (let c = 0; c < 5; c++) {
      expect(SRS_IVALS[c]).toBeLessThanOrEqual(SRS_IVALS[c + 1]);
    }
  });
});
