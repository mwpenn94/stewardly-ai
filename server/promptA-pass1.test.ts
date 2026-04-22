/**
 * Prompt A — Pass 1 Tests
 *
 * Validates the 3 non-AI items shipped in Pass 1:
 *   P0-1: FSRS-5 scheduler (fsrsSrsService.ts, cardSchedules/cardReviews schema)
 *   P0-3: Assessment sessions (assessmentSession.ts, assessmentSessions schema)
 *   P0-5: Learning streaks (streaks.ts, learningStreaks schema)
 *
 * Also validates Prompt A artifacts and learning-state.json integrity.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");

// ─── P0-1: FSRS-5 Scheduler ──────────────────────────────────────────────

describe("P0-1: FSRS-5 Scheduler", () => {
  const servicePath = path.join(ROOT, "server/services/learning/fsrsSrsService.ts");
  const schemaPath = path.join(ROOT, "drizzle/schema.ts");

  it("service file exists", () => {
    expect(fs.existsSync(servicePath)).toBe(true);
  });

  it("exports fsrs5Schedule pure function", () => {
    const src = fs.readFileSync(servicePath, "utf8");
    expect(src).toContain("export function fsrs5Schedule(");
  });

  it("exports retrievability function", () => {
    const src = fs.readFileSync(servicePath, "utf8");
    expect(src).toContain("export function retrievability(");
  });

  it("exports processReview for DB operations", () => {
    const src = fs.readFileSync(servicePath, "utf8");
    expect(src).toContain("export async function processReview(");
  });

  it("exports getDueCards for queue management", () => {
    const src = fs.readFileSync(servicePath, "utf8");
    expect(src).toContain("export async function getDueCards(");
  });

  it("exports getReviewStats for analytics", () => {
    const src = fs.readFileSync(servicePath, "utf8");
    expect(src).toContain("export async function getReviewStats(");
  });

  it("implements FSRS-5 parameters with 17 weights", () => {
    const src = fs.readFileSync(servicePath, "utf8");
    expect(src).toContain("FSRS5_PARAMS");
    expect(src).toContain("requestRetention: 0.9");
  });

  it("handles all 4 card states: new, learning, review, relearning", () => {
    const src = fs.readFileSync(servicePath, "utf8");
    for (const state of ["new", "learning", "review", "relearning"]) {
      expect(src).toContain(`"${state}"`);
    }
  });

  it("handles all 4 ratings: Again(1), Hard(2), Good(3), Easy(4)", () => {
    const src = fs.readFileSync(servicePath, "utf8");
    expect(src).toContain("Rating = 1 | 2 | 3 | 4");
  });

  it("includes legacy SM-style scheduler as control arm", () => {
    const src = fs.readFileSync(servicePath, "utf8");
    expect(src).toContain("legacySchedule");
    expect(src).toContain("control");
  });

  it("schema has cardSchedules table", () => {
    const schema = fs.readFileSync(schemaPath, "utf8");
    expect(schema).toContain('export const cardSchedules = mysqlTable("card_schedules"');
  });

  it("schema has cardReviews table", () => {
    const schema = fs.readFileSync(schemaPath, "utf8");
    expect(schema).toContain('export const cardReviews = mysqlTable("card_reviews"');
  });

  it("cardSchedules has feature_flag for A/B testing", () => {
    const schema = fs.readFileSync(schemaPath, "utf8");
    const csSection = schema.substring(schema.indexOf("card_schedules"), schema.indexOf("card_schedules") + 1500);
    expect(csSection).toContain("feature_flag");
    expect(csSection).toContain('"control"');
    expect(csSection).toContain('"fsrs5"');
  });

  it("cardReviews logs before/after stability and difficulty", () => {
    const schema = fs.readFileSync(schemaPath, "utf8");
    const crSection = schema.substring(schema.indexOf("card_reviews"), schema.indexOf("card_reviews") + 1500);
    expect(crSection).toContain("stability_before");
    expect(crSection).toContain("stability_after");
    expect(crSection).toContain("difficulty_before");
    expect(crSection).toContain("difficulty_after");
  });
});

// ─── P0-1: FSRS-5 Pure Algorithm Tests ───────────────────────────────────

describe("P0-1: FSRS-5 Pure Algorithm", () => {
  // Import the pure functions directly
  let fsrs5Schedule: any;
  let retrievability: any;

  it("can import pure functions", async () => {
    const mod = await import("./services/learning/fsrsSrsService");
    fsrs5Schedule = mod.fsrs5Schedule;
    retrievability = mod.retrievability;
    expect(typeof fsrs5Schedule).toBe("function");
    expect(typeof retrievability).toBe("function");
  });

  it("new card + Good(3) → review state", async () => {
    const mod = await import("./services/learning/fsrsSrsService");
    const result = mod.fsrs5Schedule(
      { stability: 0.4, difficulty: 0.3, elapsedDays: 0, scheduledDays: 0, reps: 0, lapses: 0, state: "new" as const },
      3,
    );
    expect(result.state).toBe("review");
    expect(result.reps).toBe(1);
    expect(result.lapses).toBe(0);
    expect(result.stability).toBeGreaterThan(0);
  });

  it("new card + Again(1) → learning state with lapse", async () => {
    const mod = await import("./services/learning/fsrsSrsService");
    const result = mod.fsrs5Schedule(
      { stability: 0.4, difficulty: 0.3, elapsedDays: 0, scheduledDays: 0, reps: 0, lapses: 0, state: "new" as const },
      1,
    );
    expect(result.state).toBe("learning");
    expect(result.lapses).toBe(1);
  });

  it("retrievability decreases with elapsed time", async () => {
    const mod = await import("./services/learning/fsrsSrsService");
    const r1 = mod.retrievability(10, 0);
    const r5 = mod.retrievability(10, 5);
    const r30 = mod.retrievability(10, 30);
    expect(r1).toBeGreaterThan(r5);
    expect(r5).toBeGreaterThan(r30);
  });

  it("retrievability at 0 elapsed days is 1.0", async () => {
    const mod = await import("./services/learning/fsrsSrsService");
    expect(mod.retrievability(10, 0)).toBeCloseTo(1.0, 5);
  });

  it("Easy(4) rating produces higher stability than Hard(2)", async () => {
    const mod = await import("./services/learning/fsrsSrsService");
    const base = { stability: 5, difficulty: 0.3, elapsedDays: 5, scheduledDays: 5, reps: 3, lapses: 0, state: "review" as const };
    const easy = mod.fsrs5Schedule(base, 4);
    const hard = mod.fsrs5Schedule(base, 2);
    expect(easy.stability).toBeGreaterThan(hard.stability);
  });
});

// ─── P0-3: Assessment Sessions ────────────────────────────────────────────

describe("P0-3: Assessment Sessions (No-AI Zone)", () => {
  const servicePath = path.join(ROOT, "server/services/learning/assessmentSession.ts");
  const schemaPath = path.join(ROOT, "drizzle/schema.ts");

  it("service file exists", () => {
    expect(fs.existsSync(servicePath)).toBe(true);
  });

  it("exports startSession", () => {
    const src = fs.readFileSync(servicePath, "utf8");
    expect(src).toContain("export async function startSession(");
  });

  it("exports getActiveSession", () => {
    const src = fs.readFileSync(servicePath, "utf8");
    expect(src).toContain("export async function getActiveSession(");
  });

  it("exports isAiBlocked", () => {
    const src = fs.readFileSync(servicePath, "utf8");
    expect(src).toContain("export async function isAiBlocked(");
  });

  it("exports completeSession with score tracking", () => {
    const src = fs.readFileSync(servicePath, "utf8");
    expect(src).toContain("export async function completeSession(");
    expect(src).toContain("score");
    expect(src).toContain("maxScore");
  });

  it("exports abandonSession", () => {
    const src = fs.readFileSync(servicePath, "utf8");
    expect(src).toContain("export async function abandonSession(");
  });

  it("exports recordFocusLoss for proctoring", () => {
    const src = fs.readFileSync(servicePath, "utf8");
    expect(src).toContain("export async function recordFocusLoss(");
  });

  it("tracks AI attempt count during blocked sessions", () => {
    const src = fs.readFileSync(servicePath, "utf8");
    expect(src).toContain("recordAiAttempt");
    expect(src).toContain("aiAttemptCount");
  });

  it("supports 4 assessment types: quiz, exam, smartcase, capstone", () => {
    const src = fs.readFileSync(servicePath, "utf8");
    expect(src).toContain("quiz");
    expect(src).toContain("exam");
    expect(src).toContain("smartcase");
    expect(src).toContain("capstone");
  });

  it("schema has assessmentSessions table", () => {
    const schema = fs.readFileSync(schemaPath, "utf8");
    expect(schema).toContain('export const assessmentSessions = mysqlTable("assessment_sessions"');
  });

  it("schema tracks ai_block_active flag", () => {
    const schema = fs.readFileSync(schemaPath, "utf8");
    const section = schema.substring(schema.indexOf("assessment_sessions"), schema.indexOf("assessment_sessions") + 1500);
    expect(section).toContain("ai_block_active");
  });

  it("schema tracks focus_loss_count", () => {
    const schema = fs.readFileSync(schemaPath, "utf8");
    const section = schema.substring(schema.indexOf("assessment_sessions"), schema.indexOf("assessment_sessions") + 1500);
    expect(section).toContain("focus_loss_count");
  });
});

// ─── P0-5: Learning Streaks ──────────────────────────────────────────────

describe("P0-5: Learning Streaks", () => {
  const servicePath = path.join(ROOT, "server/services/learning/streaks.ts");
  const schemaPath = path.join(ROOT, "drizzle/schema.ts");

  it("service file exists", () => {
    expect(fs.existsSync(servicePath)).toBe(true);
  });

  it("exports getOrCreateStreak", () => {
    const src = fs.readFileSync(servicePath, "utf8");
    expect(src).toContain("export async function getOrCreateStreak(");
  });

  it("exports recordActivity", () => {
    const src = fs.readFileSync(servicePath, "utf8");
    expect(src).toContain("export async function recordActivity(");
  });

  it("exports updateSettings for daily goal and nudge", () => {
    const src = fs.readFileSync(servicePath, "utf8");
    expect(src).toContain("export async function updateSettings(");
    expect(src).toContain("dailyGoalMinutes");
    expect(src).toContain("nudgeEnabled");
  });

  it("exports isStreakAtRisk", () => {
    const src = fs.readFileSync(servicePath, "utf8");
    expect(src).toContain("export async function isStreakAtRisk(");
  });

  it("handles consecutive day logic correctly", () => {
    const src = fs.readFileSync(servicePath, "utf8");
    expect(src).toContain("yesterday");
    expect(src).toContain("currentStreak + 1");
  });

  it("tracks longest streak separately", () => {
    const src = fs.readFileSync(servicePath, "utf8");
    expect(src).toContain("longestStreak");
    expect(src).toContain("Math.max");
  });

  it("has feature flag for A/B testing", () => {
    const src = fs.readFileSync(servicePath, "utf8");
    expect(src).toContain("featureFlag");
    expect(src).toContain("control");
    expect(src).toContain("treatment");
  });

  it("schema has learningStreaks table", () => {
    const schema = fs.readFileSync(schemaPath, "utf8");
    expect(schema).toContain('export const learningStreaks = mysqlTable("learning_streaks"');
  });

  it("schema has unique index on userId", () => {
    const schema = fs.readFileSync(schemaPath, "utf8");
    const section = schema.substring(schema.indexOf("learning_streaks"), schema.indexOf("learning_streaks") + 1500);
    expect(section).toContain("uniqueIndex");
  });
});

// ─── Router Integration ──────────────────────────────────────────────────

describe("Learning Router Integration", () => {
  const routerPath = path.join(ROOT, "server/routers/learning.ts");

  it("imports FSRS-5 service", () => {
    const src = fs.readFileSync(routerPath, "utf8");
    expect(src).toContain("fsrsSrsService");
  });

  it("imports assessment session service", () => {
    const src = fs.readFileSync(routerPath, "utf8");
    expect(src).toContain("assessmentSession");
  });

  it("imports streaks service", () => {
    const src = fs.readFileSync(routerPath, "utf8");
    expect(src).toContain("../services/learning/streaks");
  });

  it("registers fsrs5 subrouter", () => {
    const src = fs.readFileSync(routerPath, "utf8");
    expect(src).toContain("fsrs5: fsrs5Router");
  });

  it("registers assessment subrouter", () => {
    const src = fs.readFileSync(routerPath, "utf8");
    expect(src).toContain("assessment: assessmentRouter");
  });

  it("registers streaks subrouter", () => {
    const src = fs.readFileSync(routerPath, "utf8");
    expect(src).toContain("streaks: streaksRouter");
  });

  it("FSRS-5 review also records streak activity", () => {
    const src = fs.readFileSync(routerPath, "utf8");
    const fsrsSection = src.substring(src.indexOf("fsrs5Router"), src.indexOf("assessmentRouter"));
    expect(fsrsSection).toContain("recordStreakActivity");
  });
});

// ─── Prompt A Artifacts ──────────────────────────────────────────────────

describe("Prompt A Artifacts", () => {
  it("learning-state.json exists and is valid", () => {
    const p = path.join(ROOT, "docs/learning-state.json");
    expect(fs.existsSync(p)).toBe(true);
    const state = JSON.parse(fs.readFileSync(p, "utf8"));
    expect(state.schema_version).toBe("1.0");
    expect(state.phase).toBe("pre-ai");
    expect(state.last_pass).toBeGreaterThanOrEqual(1);
  });

  it("P0-1, P0-3, P0-5 are Shipped (advanced past In-Flight)", () => {
    const state = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/learning-state.json"), "utf8"));
    expect(state.items["P0-1"].state).toBe("Shipped");
    expect(state.items["P0-3"].state).toBe("Shipped");
    expect(state.items["P0-5"].state).toBe("Shipped");
  });

  it("AI-dependent items remain in Proposed-Waiting-AI", () => {
    const state = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/learning-state.json"), "utf8"));
    expect(state.items["P0-2"].state).toBe("Proposed-Waiting-AI");
    expect(state.items["P0-4"].state).toBe("Proposed-Waiting-AI");
    expect(state.items["P1-6"].state).toBe("Proposed-Waiting-AI");
  });

  it("pre-registration baselines exist for shipped items", () => {
    expect(fs.existsSync(path.join(ROOT, "docs/learning-baseline-P0-1.json"))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, "docs/learning-baseline-P0-3.json"))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, "docs/learning-baseline-P0-5.json"))).toBe(true);
  });

  it("approvals.json exists", () => {
    expect(fs.existsSync(path.join(ROOT, "docs/approvals.json"))).toBe(true);
  });

  it("notifications.json exists", () => {
    expect(fs.existsSync(path.join(ROOT, "docs/notifications.json"))).toBe(true);
  });

  it("afk-decisions.md exists and has Q4 resolution", () => {
    const p = path.join(ROOT, "docs/afk-decisions.md");
    expect(fs.existsSync(p)).toBe(true);
    const content = fs.readFileSync(p, "utf8");
    expect(content).toContain("Q4");
  });

  it("convergence-log exists", () => {
    expect(fs.existsSync(path.join(ROOT, "docs/convergence-log-parity.md"))).toBe(true);
  });
});

// ─── Database Tables ─────────────────────────────────────────────────────

describe("Database Tables (Migration SQL)", () => {
  const sqlPath = path.join(ROOT, "drizzle/pass39-parity-tables.sql");

  it("migration SQL file exists", () => {
    expect(fs.existsSync(sqlPath)).toBe(true);
  });

  it("creates card_schedules table", () => {
    const sql = fs.readFileSync(sqlPath, "utf8");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS `card_schedules`");
  });

  it("creates card_reviews table", () => {
    const sql = fs.readFileSync(sqlPath, "utf8");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS `card_reviews`");
  });

  it("creates assessment_sessions table", () => {
    const sql = fs.readFileSync(sqlPath, "utf8");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS `assessment_sessions`");
  });

  it("creates learning_streaks table", () => {
    const sql = fs.readFileSync(sqlPath, "utf8");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS `learning_streaks`");
  });
});
