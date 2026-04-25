/**
 * Streak milestone detection — pure unit tests.
 * Tests the detectStreakMilestone function which determines
 * if a streak count crosses a milestone boundary.
 */
import { describe, it, expect } from "vitest";
import { detectStreakMilestone } from "./streaks";

describe("learning/streaks — detectStreakMilestone", () => {
  it("returns null when no milestone boundary is crossed", () => {
    expect(detectStreakMilestone(2, 1)).toBeNull();
    expect(detectStreakMilestone(5, 4)).toBeNull();
    expect(detectStreakMilestone(10, 9)).toBeNull();
  });

  it("detects 3-day streak milestone", () => {
    const m = detectStreakMilestone(3, 2);
    expect(m).not.toBeNull();
    expect(m!.days).toBe(3);
    expect(m!.label).toBe("3-Day Streak");
    expect(m!.icon).toBe("🔥");
  });

  it("detects 7-day (Week Warrior) milestone", () => {
    const m = detectStreakMilestone(7, 6);
    expect(m).not.toBeNull();
    expect(m!.days).toBe(7);
    expect(m!.label).toBe("Week Warrior");
  });

  it("detects 21-day (Habit Formed) milestone", () => {
    const m = detectStreakMilestone(21, 20);
    expect(m).not.toBeNull();
    expect(m!.days).toBe(21);
    expect(m!.label).toBe("Habit Formed");
  });

  it("detects 30-day (Monthly Master) milestone", () => {
    const m = detectStreakMilestone(30, 29);
    expect(m).not.toBeNull();
    expect(m!.days).toBe(30);
    expect(m!.label).toBe("Monthly Master");
  });

  it("detects 100-day (Century Club) milestone", () => {
    const m = detectStreakMilestone(100, 99);
    expect(m).not.toBeNull();
    expect(m!.days).toBe(100);
    expect(m!.label).toBe("Century Club");
  });

  it("returns null when streak hasn't changed", () => {
    expect(detectStreakMilestone(7, 7)).toBeNull();
    expect(detectStreakMilestone(30, 30)).toBeNull();
  });

  it("returns first crossed milestone when jumping over multiple", () => {
    // Jump from 2 to 8 — should detect 3-day first
    const m = detectStreakMilestone(8, 2);
    expect(m).not.toBeNull();
    expect(m!.days).toBe(3);
  });

  it("returns null when going backwards (streak broken)", () => {
    expect(detectStreakMilestone(1, 30)).toBeNull();
  });

  it("detects 365-day milestone", () => {
    const m = detectStreakMilestone(365, 364);
    expect(m).not.toBeNull();
    expect(m!.days).toBe(365);
    expect(m!.label).toBe("Year of Growth");
  });

  it("all milestones have required fields", () => {
    const milestones = [3, 7, 14, 21, 30, 50, 100, 365];
    for (const days of milestones) {
      const m = detectStreakMilestone(days, days - 1);
      expect(m).not.toBeNull();
      expect(m!.days).toBe(days);
      expect(m!.label).toBeTruthy();
      expect(m!.icon).toBeTruthy();
      expect(m!.description).toBeTruthy();
    }
  });
});
