/**
 * analyticsAggregation — Pure-function study session analytics.
 *
 * Provides:
 *   1. Session-level statistics (duration, accuracy, pace).
 *   2. Cross-session trend analysis (improvement rate, streaks).
 *   3. Topic mastery heatmap data.
 *   4. Study efficiency scoring.
 *
 * All functions are PURE — no DB, no fetch.
 * Callers pass in session records fetched from the database.
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export interface StudySessionRecord {
  id: string;
  userId: number;
  /** ISO timestamp or epoch ms. */
  startedAt: string | number;
  /** Duration in seconds. */
  durationSec: number;
  /** Number of questions attempted. */
  questionsAttempted: number;
  /** Number of correct answers. */
  questionsCorrect: number;
  /** Topic or category identifier. */
  topic: string;
  /** Difficulty level (1–5). */
  difficulty?: number;
  /** Cards reviewed (for SRS sessions). */
  cardsReviewed?: number;
  /** Cards mastered (moved to long-term). */
  cardsMastered?: number;
}

export interface SessionStats {
  sessionId: string;
  /** Accuracy as decimal (0–1). */
  accuracy: number;
  /** Questions per minute. */
  pace: number;
  /** Efficiency score 0–100 combining accuracy and pace. */
  efficiencyScore: number;
  /** Duration in minutes. */
  durationMin: number;
  topic: string;
  difficulty: number;
}

export interface TrendAnalysis {
  /** Number of sessions analyzed. */
  totalSessions: number;
  /** Total study time in minutes. */
  totalStudyMinutes: number;
  /** Average session duration in minutes. */
  avgSessionMinutes: number;
  /** Overall accuracy across all sessions. */
  overallAccuracy: number;
  /** Accuracy trend: positive = improving, negative = declining. */
  accuracyTrend: number;
  /** Current consecutive-day study streak. */
  currentStreak: number;
  /** Longest consecutive-day streak. */
  longestStreak: number;
  /** Average sessions per week. */
  sessionsPerWeek: number;
  /** Improvement rate: accuracy delta between first and last quartile. */
  improvementRate: number;
  /** Best performing topic. */
  strongestTopic: string | null;
  /** Weakest performing topic. */
  weakestTopic: string | null;
}

export interface TopicMasteryEntry {
  topic: string;
  sessionsCount: number;
  totalQuestions: number;
  totalCorrect: number;
  accuracy: number;
  avgDifficulty: number;
  totalStudyMinutes: number;
  /** Mastery level: beginner (< 0.5), intermediate (0.5–0.75), advanced (0.75–0.9), mastered (> 0.9). */
  masteryLevel: "beginner" | "intermediate" | "advanced" | "mastered";
  /** Trend in accuracy over recent sessions. */
  recentTrend: "improving" | "stable" | "declining";
}

export interface EfficiencyReport {
  /** Overall efficiency score 0–100. */
  overallScore: number;
  /** Time efficiency: how well study time is used. */
  timeEfficiency: number;
  /** Accuracy efficiency: correctness weighted by difficulty. */
  accuracyEfficiency: number;
  /** Consistency: regularity of study habits. */
  consistencyScore: number;
  /** Recommendations based on patterns. */
  recommendations: string[];
}

// ─── Session-level statistics ──────────────────────────────────────────────

export function computeSessionStats(session: StudySessionRecord): SessionStats {
  const durationMin = session.durationSec / 60;
  const accuracy = session.questionsAttempted > 0
    ? session.questionsCorrect / session.questionsAttempted
    : 0;
  const pace = durationMin > 0 ? session.questionsAttempted / durationMin : 0;

  // Efficiency combines accuracy (70% weight) and pace (30% weight)
  // Pace is normalized: 5 questions/min = 100% pace score
  const paceScore = Math.min(1, pace / 5);
  const efficiencyScore = Math.round((accuracy * 0.7 + paceScore * 0.3) * 100);

  return {
    sessionId: session.id,
    accuracy: round3(accuracy),
    pace: round2(pace),
    efficiencyScore,
    durationMin: round2(durationMin),
    topic: session.topic,
    difficulty: session.difficulty ?? 3,
  };
}

// ─── Cross-session trend analysis ──────────────────────────────────────────

export function analyzeTrends(sessions: StudySessionRecord[]): TrendAnalysis {
  if (sessions.length === 0) {
    return {
      totalSessions: 0, totalStudyMinutes: 0, avgSessionMinutes: 0,
      overallAccuracy: 0, accuracyTrend: 0, currentStreak: 0,
      longestStreak: 0, sessionsPerWeek: 0, improvementRate: 0,
      strongestTopic: null, weakestTopic: null,
    };
  }

  // Sort by date ascending
  const sorted = [...sessions].sort((a, b) => toEpoch(a.startedAt) - toEpoch(b.startedAt));

  const totalStudyMinutes = sorted.reduce((s, sess) => s + sess.durationSec / 60, 0);
  const avgSessionMinutes = totalStudyMinutes / sorted.length;

  // Overall accuracy
  const totalQ = sorted.reduce((s, sess) => s + sess.questionsAttempted, 0);
  const totalC = sorted.reduce((s, sess) => s + sess.questionsCorrect, 0);
  const overallAccuracy = totalQ > 0 ? totalC / totalQ : 0;

  // Accuracy trend (linear regression slope on per-session accuracy)
  const accuracies = sorted.map((s) =>
    s.questionsAttempted > 0 ? s.questionsCorrect / s.questionsAttempted : 0,
  );
  const accuracyTrend = linearSlope(accuracies);

  // Improvement rate: compare first quartile vs last quartile
  const q1End = Math.max(1, Math.floor(sorted.length / 4));
  const q4Start = Math.max(q1End, sorted.length - Math.floor(sorted.length / 4));
  const q1Acc = meanArr(accuracies.slice(0, q1End));
  const q4Acc = meanArr(accuracies.slice(q4Start));
  const improvementRate = q4Acc - q1Acc;

  // Streaks (consecutive calendar days)
  const { currentStreak, longestStreak } = computeStreaks(sorted);

  // Sessions per week
  const spanMs = toEpoch(sorted[sorted.length - 1].startedAt) - toEpoch(sorted[0].startedAt);
  const spanWeeks = Math.max(1, spanMs / (7 * 86_400_000));
  const sessionsPerWeek = sorted.length / spanWeeks;

  // Topic performance
  const topicMap = new Map<string, { correct: number; total: number }>();
  for (const s of sorted) {
    const entry = topicMap.get(s.topic) ?? { correct: 0, total: 0 };
    entry.correct += s.questionsCorrect;
    entry.total += s.questionsAttempted;
    topicMap.set(s.topic, entry);
  }

  let strongestTopic: string | null = null;
  let weakestTopic: string | null = null;
  let bestAcc = -1;
  let worstAcc = 2;

  for (const [topic, { correct, total }] of topicMap) {
    if (total < 3) continue; // skip topics with too few questions
    const acc = correct / total;
    if (acc > bestAcc) { bestAcc = acc; strongestTopic = topic; }
    if (acc < worstAcc) { worstAcc = acc; weakestTopic = topic; }
  }

  return {
    totalSessions: sorted.length,
    totalStudyMinutes: round2(totalStudyMinutes),
    avgSessionMinutes: round2(avgSessionMinutes),
    overallAccuracy: round3(overallAccuracy),
    accuracyTrend: round4(accuracyTrend),
    currentStreak,
    longestStreak,
    sessionsPerWeek: round2(sessionsPerWeek),
    improvementRate: round3(improvementRate),
    strongestTopic,
    weakestTopic,
  };
}

// ─── Topic mastery heatmap ─────────────────────────────────────────────────

export function buildTopicMastery(sessions: StudySessionRecord[]): TopicMasteryEntry[] {
  const topicMap = new Map<string, StudySessionRecord[]>();
  for (const s of sessions) {
    const arr = topicMap.get(s.topic) ?? [];
    arr.push(s);
    topicMap.set(s.topic, arr);
  }

  const entries: TopicMasteryEntry[] = [];

  for (const [topic, topicSessions] of topicMap) {
    const sorted = [...topicSessions].sort((a, b) => toEpoch(a.startedAt) - toEpoch(b.startedAt));
    const totalQuestions = sorted.reduce((s, sess) => s + sess.questionsAttempted, 0);
    const totalCorrect = sorted.reduce((s, sess) => s + sess.questionsCorrect, 0);
    const accuracy = totalQuestions > 0 ? totalCorrect / totalQuestions : 0;
    const avgDifficulty = meanArr(sorted.map((s) => s.difficulty ?? 3));
    const totalStudyMinutes = sorted.reduce((s, sess) => s + sess.durationSec / 60, 0);

    let masteryLevel: TopicMasteryEntry["masteryLevel"] = "beginner";
    if (accuracy >= 0.9) masteryLevel = "mastered";
    else if (accuracy >= 0.75) masteryLevel = "advanced";
    else if (accuracy >= 0.5) masteryLevel = "intermediate";

    // Recent trend: compare last 3 sessions vs previous 3
    let recentTrend: TopicMasteryEntry["recentTrend"] = "stable";
    if (sorted.length >= 6) {
      const recent = sorted.slice(-3);
      const prior = sorted.slice(-6, -3);
      const recentAcc = meanArr(recent.map((s) => s.questionsAttempted > 0 ? s.questionsCorrect / s.questionsAttempted : 0));
      const priorAcc = meanArr(prior.map((s) => s.questionsAttempted > 0 ? s.questionsCorrect / s.questionsAttempted : 0));
      if (recentAcc - priorAcc > 0.05) recentTrend = "improving";
      else if (priorAcc - recentAcc > 0.05) recentTrend = "declining";
    }

    entries.push({
      topic,
      sessionsCount: sorted.length,
      totalQuestions,
      totalCorrect,
      accuracy: round3(accuracy),
      avgDifficulty: round2(avgDifficulty),
      totalStudyMinutes: round2(totalStudyMinutes),
      masteryLevel,
      recentTrend,
    });
  }

  return entries.sort((a, b) => b.accuracy - a.accuracy);
}

// ─── Efficiency report ─────────────────────────────────────────────────────

export function generateEfficiencyReport(sessions: StudySessionRecord[]): EfficiencyReport {
  if (sessions.length === 0) {
    return {
      overallScore: 0, timeEfficiency: 0, accuracyEfficiency: 0,
      consistencyScore: 0, recommendations: ["Start your first study session to get personalized insights."],
    };
  }

  const stats = sessions.map(computeSessionStats);
  const trends = analyzeTrends(sessions);

  // Time efficiency: optimal session length is 20–45 minutes
  const avgDuration = trends.avgSessionMinutes;
  let timeEfficiency = 100;
  if (avgDuration < 5) timeEfficiency = 30;
  else if (avgDuration < 15) timeEfficiency = 60;
  else if (avgDuration < 20) timeEfficiency = 80;
  else if (avgDuration > 60) timeEfficiency = 70;
  else if (avgDuration > 45) timeEfficiency = 85;

  // Accuracy efficiency: weighted by difficulty
  const weightedAcc = stats.reduce((s, st) => s + st.accuracy * st.difficulty, 0);
  const totalDiff = stats.reduce((s, st) => s + st.difficulty, 0);
  const accuracyEfficiency = totalDiff > 0 ? Math.round((weightedAcc / totalDiff) * 100) : 0;

  // Consistency: based on streak and sessions per week
  let consistencyScore = 0;
  if (trends.sessionsPerWeek >= 5) consistencyScore = 100;
  else if (trends.sessionsPerWeek >= 3) consistencyScore = 80;
  else if (trends.sessionsPerWeek >= 1) consistencyScore = 50;
  else consistencyScore = 20;
  if (trends.currentStreak >= 7) consistencyScore = Math.min(100, consistencyScore + 10);

  const overallScore = Math.round(timeEfficiency * 0.25 + accuracyEfficiency * 0.5 + consistencyScore * 0.25);

  // Recommendations
  const recommendations: string[] = [];
  if (avgDuration < 15) recommendations.push("Try longer study sessions (20–45 minutes) for better retention.");
  if (avgDuration > 60) recommendations.push("Consider shorter, more focused sessions. Research shows diminishing returns after 45 minutes.");
  if (trends.overallAccuracy < 0.6) recommendations.push("Focus on reviewing fundamentals before advancing to harder topics.");
  if (trends.accuracyTrend < -0.01) recommendations.push("Your accuracy is declining. Consider revisiting topics you've already covered.");
  if (trends.sessionsPerWeek < 3) recommendations.push("Increase study frequency to at least 3 sessions per week for optimal retention.");
  if (trends.currentStreak === 0) recommendations.push("Start a daily study streak — even 10 minutes a day builds strong habits.");
  if (trends.weakestTopic) recommendations.push(`Focus extra time on "${trends.weakestTopic}" — it's your weakest area.`);
  if (recommendations.length === 0) recommendations.push("Excellent work! Maintain your current study habits for continued growth.");

  return { overallScore, timeEfficiency, accuracyEfficiency, consistencyScore, recommendations };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function toEpoch(ts: string | number): number {
  return typeof ts === "number" ? ts : new Date(ts).getTime();
}

function meanArr(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function linearSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }
  const denom = n * sumX2 - sumX * sumX;
  return denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
}

function computeStreaks(sorted: StudySessionRecord[]): { currentStreak: number; longestStreak: number } {
  if (sorted.length === 0) return { currentStreak: 0, longestStreak: 0 };

  const days = new Set<string>();
  for (const s of sorted) {
    const d = new Date(toEpoch(s.startedAt));
    days.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }

  const sortedDays = [...days].sort();
  let longest = 1;
  let current = 1;

  for (let i = 1; i < sortedDays.length; i++) {
    const prev = new Date(sortedDays[i - 1]);
    const curr = new Date(sortedDays[i]);
    const diffDays = (curr.getTime() - prev.getTime()) / 86_400_000;

    if (Math.abs(diffDays - 1) < 0.01) {
      current++;
    } else {
      current = 1;
    }
    if (current > longest) longest = current;
  }

  // Check if current streak includes today
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const yesterdayDate = new Date(today.getTime() - 86_400_000);
  const yesterdayStr = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, "0")}-${String(yesterdayDate.getDate()).padStart(2, "0")}`;

  const lastDay = sortedDays[sortedDays.length - 1];
  if (lastDay !== todayStr && lastDay !== yesterdayStr) {
    current = 0; // streak broken
  }

  return { currentStreak: current, longestStreak: longest };
}

function round2(n: number): number { return Math.round(n * 100) / 100; }
function round3(n: number): number { return Math.round(n * 1000) / 1000; }
function round4(n: number): number { return Math.round(n * 10000) / 10000; }
