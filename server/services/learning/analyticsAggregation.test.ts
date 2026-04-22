import { describe, it, expect } from "vitest";
import {
  computeSessionStats,
  analyzeTrends,
  buildTopicMastery,
  generateEfficiencyReport,
  type StudySessionRecord,
} from "./analyticsAggregation";

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<StudySessionRecord> = {}): StudySessionRecord {
  return {
    id: "sess-1",
    userId: 1,
    startedAt: Date.now() - 3600_000,
    durationSec: 1800, // 30 min
    questionsAttempted: 20,
    questionsCorrect: 16,
    topic: "tax-planning",
    difficulty: 3,
    ...overrides,
  };
}

function makeSessions(count: number, daySpread = 30): StudySessionRecord[] {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => makeSession({
    id: `sess-${i}`,
    startedAt: now - (daySpread - i) * 86_400_000,
    questionsAttempted: 15 + Math.floor(Math.random() * 10),
    questionsCorrect: 10 + Math.floor(Math.random() * 10),
    topic: ["tax-planning", "estate-planning", "retirement", "insurance"][i % 4],
    difficulty: 1 + (i % 5),
  }));
}

// ─── computeSessionStats ───────────────────────────────────────────────────

describe("computeSessionStats", () => {
  it("computes accuracy correctly", () => {
    const stats = computeSessionStats(makeSession({ questionsAttempted: 20, questionsCorrect: 15 }));
    expect(stats.accuracy).toBe(0.75);
  });

  it("handles zero questions attempted", () => {
    const stats = computeSessionStats(makeSession({ questionsAttempted: 0, questionsCorrect: 0 }));
    expect(stats.accuracy).toBe(0);
    expect(stats.pace).toBe(0);
  });

  it("computes pace in questions per minute", () => {
    const stats = computeSessionStats(makeSession({ durationSec: 600, questionsAttempted: 30 }));
    // 30 questions / 10 minutes = 3 q/min
    expect(stats.pace).toBe(3);
  });

  it("computes efficiency score combining accuracy and pace", () => {
    const stats = computeSessionStats(makeSession({
      questionsAttempted: 20,
      questionsCorrect: 20, // 100% accuracy
      durationSec: 240, // 4 min → 5 q/min → 100% pace
    }));
    // 100% accuracy * 0.7 + 100% pace * 0.3 = 100
    expect(stats.efficiencyScore).toBe(100);
  });

  it("caps pace score at 100%", () => {
    const stats = computeSessionStats(makeSession({
      questionsAttempted: 100,
      questionsCorrect: 100,
      durationSec: 60, // 100 q/min — way above 5 q/min cap
    }));
    expect(stats.efficiencyScore).toBe(100);
  });

  it("converts duration to minutes", () => {
    const stats = computeSessionStats(makeSession({ durationSec: 1800 }));
    expect(stats.durationMin).toBe(30);
  });
});

// ─── analyzeTrends ─────────────────────────────────────────────────────────

describe("analyzeTrends", () => {
  it("returns zeros for empty sessions", () => {
    const trends = analyzeTrends([]);
    expect(trends.totalSessions).toBe(0);
    expect(trends.totalStudyMinutes).toBe(0);
    expect(trends.overallAccuracy).toBe(0);
    expect(trends.strongestTopic).toBeNull();
  });

  it("computes total study minutes", () => {
    const sessions = [
      makeSession({ durationSec: 1800 }), // 30 min
      makeSession({ id: "s2", durationSec: 900 }), // 15 min
    ];
    const trends = analyzeTrends(sessions);
    expect(trends.totalStudyMinutes).toBe(45);
  });

  it("computes overall accuracy", () => {
    const sessions = [
      makeSession({ questionsAttempted: 10, questionsCorrect: 8 }),
      makeSession({ id: "s2", questionsAttempted: 10, questionsCorrect: 6 }),
    ];
    const trends = analyzeTrends(sessions);
    expect(trends.overallAccuracy).toBe(0.7); // 14/20
  });

  it("identifies strongest and weakest topics", () => {
    const sessions = [
      makeSession({ topic: "tax", questionsAttempted: 10, questionsCorrect: 9 }),
      makeSession({ id: "s2", topic: "tax", questionsAttempted: 10, questionsCorrect: 9 }),
      makeSession({ id: "s3", topic: "estate", questionsAttempted: 10, questionsCorrect: 4 }),
      makeSession({ id: "s4", topic: "estate", questionsAttempted: 10, questionsCorrect: 4 }),
    ];
    const trends = analyzeTrends(sessions);
    expect(trends.strongestTopic).toBe("tax");
    expect(trends.weakestTopic).toBe("estate");
  });

  it("computes sessions per week", () => {
    const now = Date.now();
    const sessions = Array.from({ length: 14 }, (_, i) => makeSession({
      id: `s${i}`,
      startedAt: now - i * 86_400_000,
    }));
    const trends = analyzeTrends(sessions);
    expect(trends.sessionsPerWeek).toBeGreaterThan(5);
  });

  it("computes improvement rate between first and last quartile", () => {
    // Create sessions with improving accuracy
    const sessions = Array.from({ length: 20 }, (_, i) => makeSession({
      id: `s${i}`,
      startedAt: Date.now() - (20 - i) * 86_400_000,
      questionsAttempted: 20,
      questionsCorrect: 10 + Math.floor(i / 2), // gradually improving
    }));
    const trends = analyzeTrends(sessions);
    expect(trends.improvementRate).toBeGreaterThan(0);
  });

  it("computes accuracy trend slope", () => {
    const sessions = makeSessions(20);
    const trends = analyzeTrends(sessions);
    expect(typeof trends.accuracyTrend).toBe("number");
  });
});

// ─── buildTopicMastery ─────────────────────────────────────────────────────

describe("buildTopicMastery", () => {
  it("returns empty for no sessions", () => {
    expect(buildTopicMastery([])).toEqual([]);
  });

  it("groups sessions by topic", () => {
    const sessions = [
      makeSession({ topic: "tax" }),
      makeSession({ id: "s2", topic: "tax" }),
      makeSession({ id: "s3", topic: "estate" }),
    ];
    const mastery = buildTopicMastery(sessions);
    expect(mastery).toHaveLength(2);
    const taxEntry = mastery.find((m) => m.topic === "tax");
    expect(taxEntry?.sessionsCount).toBe(2);
  });

  it("assigns correct mastery levels", () => {
    const sessions = [
      makeSession({ topic: "mastered", questionsAttempted: 100, questionsCorrect: 95 }),
      makeSession({ id: "s2", topic: "advanced", questionsAttempted: 100, questionsCorrect: 80 }),
      makeSession({ id: "s3", topic: "intermediate", questionsAttempted: 100, questionsCorrect: 60 }),
      makeSession({ id: "s4", topic: "beginner", questionsAttempted: 100, questionsCorrect: 30 }),
    ];
    const mastery = buildTopicMastery(sessions);
    expect(mastery.find((m) => m.topic === "mastered")?.masteryLevel).toBe("mastered");
    expect(mastery.find((m) => m.topic === "advanced")?.masteryLevel).toBe("advanced");
    expect(mastery.find((m) => m.topic === "intermediate")?.masteryLevel).toBe("intermediate");
    expect(mastery.find((m) => m.topic === "beginner")?.masteryLevel).toBe("beginner");
  });

  it("sorts by accuracy descending", () => {
    const sessions = [
      makeSession({ topic: "low", questionsAttempted: 10, questionsCorrect: 3 }),
      makeSession({ id: "s2", topic: "high", questionsAttempted: 10, questionsCorrect: 9 }),
    ];
    const mastery = buildTopicMastery(sessions);
    expect(mastery[0].topic).toBe("high");
    expect(mastery[1].topic).toBe("low");
  });

  it("computes recent trend for topics with enough data", () => {
    const now = Date.now();
    const sessions = Array.from({ length: 8 }, (_, i) => makeSession({
      id: `s${i}`,
      topic: "tax",
      startedAt: now - (8 - i) * 86_400_000,
      questionsAttempted: 10,
      questionsCorrect: 5 + i, // improving
    }));
    const mastery = buildTopicMastery(sessions);
    expect(mastery[0].recentTrend).toBe("improving");
  });
});

// ─── generateEfficiencyReport ──────────────────────────────────────────────

describe("generateEfficiencyReport", () => {
  it("returns starter recommendation for no sessions", () => {
    const report = generateEfficiencyReport([]);
    expect(report.overallScore).toBe(0);
    expect(report.recommendations).toHaveLength(1);
    expect(report.recommendations[0]).toContain("Start your first");
  });

  it("penalizes very short sessions", () => {
    const sessions = [makeSession({ durationSec: 120 })]; // 2 min
    const report = generateEfficiencyReport(sessions);
    expect(report.timeEfficiency).toBeLessThan(50);
  });

  it("rewards optimal session length", () => {
    const sessions = [makeSession({ durationSec: 1800 })]; // 30 min
    const report = generateEfficiencyReport(sessions);
    expect(report.timeEfficiency).toBeGreaterThanOrEqual(80);
  });

  it("penalizes very long sessions", () => {
    const sessions = [makeSession({ durationSec: 5400 })]; // 90 min
    const report = generateEfficiencyReport(sessions);
    expect(report.timeEfficiency).toBeLessThan(80);
  });

  it("computes accuracy efficiency weighted by difficulty", () => {
    const sessions = [
      makeSession({ questionsAttempted: 10, questionsCorrect: 10, difficulty: 5 }),
    ];
    const report = generateEfficiencyReport(sessions);
    expect(report.accuracyEfficiency).toBe(100);
  });

  it("provides relevant recommendations", () => {
    const sessions = [
      makeSession({
        durationSec: 300, // 5 min — too short
        questionsAttempted: 10,
        questionsCorrect: 4, // 40% — low accuracy
      }),
    ];
    const report = generateEfficiencyReport(sessions);
    expect(report.recommendations.some((r) => r.includes("longer study sessions"))).toBe(true);
    expect(report.recommendations.some((r) => r.includes("fundamentals"))).toBe(true);
  });

  it("overall score is between 0 and 100", () => {
    const sessions = makeSessions(30);
    const report = generateEfficiencyReport(sessions);
    expect(report.overallScore).toBeGreaterThanOrEqual(0);
    expect(report.overallScore).toBeLessThanOrEqual(100);
  });
});
