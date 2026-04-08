/**
 * Unit tests for the pure SRS scheduler (scheduleNextReview).
 */
import { describe, it, expect } from "vitest";
import { scheduleNextReview } from "./mastery";

describe("learning/mastery — scheduleNextReview", () => {
  const now = new Date("2026-04-08T12:00:00Z");

  it("boots to confidence=1 and due tomorrow on first correct", () => {
    const r = scheduleNextReview(0, true, now);
    expect(r.confidence).toBe(1);
    expect(r.mastered).toBe(false);
    expect(r.nextDue.getTime() - now.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("advances through the interval ladder on consecutive correct", () => {
    let conf = 0;
    for (let i = 0; i < 5; i++) {
      const r = scheduleNextReview(conf, true, now);
      conf = r.confidence;
    }
    expect(conf).toBe(5);
    expect(scheduleNextReview(conf, true, now).mastered).toBe(true);
  });

  it("marks mastered once confidence reaches 4", () => {
    expect(scheduleNextReview(3, true, now).mastered).toBe(true);
    expect(scheduleNextReview(2, true, now).mastered).toBe(false);
  });

  it("halves confidence on incorrect", () => {
    expect(scheduleNextReview(4, false, now).confidence).toBe(2);
    expect(scheduleNextReview(2, false, now).confidence).toBe(1);
    expect(scheduleNextReview(1, false, now).confidence).toBe(0);
  });

  it("clamps confidence to 0..5", () => {
    expect(scheduleNextReview(-1, true, now).confidence).toBe(1);
    expect(scheduleNextReview(10, true, now).confidence).toBe(5);
  });

  it("schedules 30d out at confidence=5", () => {
    const r = scheduleNextReview(4, true, now);
    expect(r.confidence).toBe(5);
    expect(r.nextDue.getTime() - now.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
  });
});
