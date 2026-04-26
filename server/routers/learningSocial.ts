/**
 * Learning Social Router — CRUD for social/collaborative learning tables
 *
 * Covers 15 previously-orphaned schema tables:
 *   learningStudySessions, learningAchievements, learningSettings,
 *   learningAiQuizQuestions, learningStudyGroups, learningGroupMembers,
 *   learningSharedQuizzes, learningQuizChallenges, learningChallengeResults,
 *   learningBookmarks, learningPlaylists, learningPlaylistItems,
 *   learningPlaylistShares, learningPendingInvites, learningDiscoveryHistory
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, and, desc, inArray, sql, lte, isNotNull, asc, gte } from "drizzle-orm";
import {
  learningStudySessions, learningAchievements, learningSettings,
  learningAiQuizQuestions, learningStudyGroups, learningGroupMembers,
  learningSharedQuizzes, learningQuizChallenges, learningChallengeResults,
  learningBookmarks, learningPlaylists, learningPlaylistItems,
  learningPlaylistShares, learningPendingInvites, learningDiscoveryHistory,
  learningGroupGoals, learningGroupNotes, learningGroupActivity,
  learningMasteryProgress, learningStreaks, users,
  audioStudyProgress,
} from "../../drizzle/schema";

// ─── Audio Study Progress ────────────────────────────────────────────────────
// Granular segment-level tracking for audio study playback.
const audioProgressRouter = router({
  /** Record a completed audio segment */
  recordSegment: protectedProcedure
    .input(z.object({
      trackSlug: z.string().min(1).max(128),
      segmentId: z.string().min(1).max(255),
      segmentType: z.string().min(1).max(64),
      segmentTitle: z.string().min(1).max(512),
      durationMs: z.number().int().min(0).default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const now = new Date();
      const nextReview = new Date(now.getTime() + 86400000); // +1 day
      const [r] = await db.insert(audioStudyProgress).values({
        userId: ctx.user.id,
        trackSlug: input.trackSlug,
        segmentId: input.segmentId,
        segmentType: input.segmentType,
        segmentTitle: input.segmentTitle,
        durationMs: input.durationMs,
        nextReviewAt: nextReview,
        intervalDays: 1,
        easeFactor: 2.5,
        repetitions: 0,
      });
      return { id: Number(r.insertId) };
    }),

  /** Record a batch of completed segments (end-of-session flush) */
  recordBatch: protectedProcedure
    .input(z.object({
      segments: z.array(z.object({
        trackSlug: z.string().min(1).max(128),
        segmentId: z.string().min(1).max(255),
        segmentType: z.string().min(1).max(64),
        segmentTitle: z.string().min(1).max(512),
        durationMs: z.number().int().min(0).default(0),
      })).min(1).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const values = input.segments.map(s => ({
        userId: ctx.user.id,
        trackSlug: s.trackSlug,
        segmentId: s.segmentId,
        segmentType: s.segmentType,
        segmentTitle: s.segmentTitle,
        durationMs: s.durationMs,
      }));
      await db.insert(audioStudyProgress).values(values);
      return { recorded: values.length };
    }),

  /** Get progress for a specific track */
  getTrackProgress: protectedProcedure
    .input(z.object({ trackSlug: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { completedSegments: [], totalDurationMs: 0, uniqueSegments: 0, recentSegments: [] };
      const rows = await db.select().from(audioStudyProgress)
        .where(and(
          eq(audioStudyProgress.userId, ctx.user.id),
          eq(audioStudyProgress.trackSlug, input.trackSlug),
        ))
        .orderBy(desc(audioStudyProgress.completedAt));
      const uniqueIds = new Set(rows.map(r => r.segmentId));
      const totalMs = rows.reduce((sum, r) => sum + r.durationMs, 0);
      return {
        completedSegments: [...uniqueIds],
        totalDurationMs: totalMs,
        uniqueSegments: uniqueIds.size,
        recentSegments: rows.slice(0, 20).map(r => ({
          segmentId: r.segmentId,
          segmentTitle: r.segmentTitle,
          segmentType: r.segmentType,
          durationMs: r.durationMs,
          completedAt: r.completedAt,
        })),
      };
    }),

  /** Get aggregate audio study stats across all tracks */
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { totalSegments: 0, totalDurationMs: 0, tracksStudied: 0, streakDays: 0 };
    // Use SQL aggregation for counts/sums (avoids fetching all rows)
    const [agg] = await db.select({
      totalSegments: sql<number>`COUNT(*)`.as("totalSegments"),
      totalDurationMs: sql<number>`COALESCE(SUM(${audioStudyProgress.durationMs}), 0)`.as("totalDurationMs"),
      tracksStudied: sql<number>`COUNT(DISTINCT ${audioStudyProgress.trackSlug})`.as("tracksStudied"),
    }).from(audioStudyProgress)
      .where(eq(audioStudyProgress.userId, ctx.user.id));
    // Fetch only completedAt dates for streak calculation (lightweight)
    const dateRows = await db.select({ completedAt: audioStudyProgress.completedAt })
      .from(audioStudyProgress)
      .where(eq(audioStudyProgress.userId, ctx.user.id))
      .orderBy(desc(audioStudyProgress.completedAt))
      .limit(5000);
    const daySet = new Set(dateRows.map(r => {
      const d = new Date(r.completedAt);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }));
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (daySet.has(key)) streak++;
      else if (i > 0) break; // allow today to be missing
    }
    return {
      totalSegments: Number(agg.totalSegments),
      totalDurationMs: Number(agg.totalDurationMs),
      tracksStudied: Number(agg.tracksStudied),
      streakDays: streak,
    };
  }),
  /** Get segments due for spaced repetition review */
  getDueItems: protectedProcedure
    .input(z.object({
      trackSlug: z.string().min(1).optional(),
      limit: z.number().int().min(1).max(100).default(30),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { dueItems: [], totalDue: 0 };
      const now = new Date();
      const conditions = [
        eq(audioStudyProgress.userId, ctx.user.id),
        isNotNull(audioStudyProgress.nextReviewAt),
        lte(audioStudyProgress.nextReviewAt, now),
      ];
      if (input.trackSlug) {
        conditions.push(eq(audioStudyProgress.trackSlug, input.trackSlug));
      }
      const [countRow] = await db.select({
        total: sql<number>`COUNT(DISTINCT ${audioStudyProgress.segmentId})`.as("total"),
      }).from(audioStudyProgress)
        .where(and(...conditions));
      // Fetch rows ordered by soonest due, over-fetch to dedupe by segmentId
      const rows = await db.select().from(audioStudyProgress)
        .where(and(...conditions))
        .orderBy(asc(audioStudyProgress.nextReviewAt))
        .limit(input.limit * 3);
      const seen = new Set<string>();
      const deduped = rows.filter(r => {
        if (seen.has(r.segmentId)) return false;
        seen.add(r.segmentId);
        return true;
      }).slice(0, input.limit);
      return {
        dueItems: deduped.map(r => ({
          segmentId: r.segmentId,
          segmentTitle: r.segmentTitle,
          segmentType: r.segmentType,
          trackSlug: r.trackSlug,
          nextReviewAt: r.nextReviewAt,
          intervalDays: r.intervalDays ?? 1,
          easeFactor: r.easeFactor ?? 2.5,
          repetitions: r.repetitions ?? 0,
          lastListenedAt: r.completedAt,
        })),
        totalDue: Number(countRow.total),
      };
    }),
  /** Record a review with self-rating to update spaced repetition schedule */
  recordReview: protectedProcedure
    .input(z.object({
      trackSlug: z.string().min(1).max(128),
      segmentId: z.string().min(1).max(255),
      segmentType: z.string().min(1).max(64),
      segmentTitle: z.string().min(1).max(512),
      durationMs: z.number().int().min(0).default(0),
      rating: z.enum(["easy", "good", "hard"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Get the latest row for this segment to read current SR state
      const [latest] = await db.select().from(audioStudyProgress)
        .where(and(
          eq(audioStudyProgress.userId, ctx.user.id),
          eq(audioStudyProgress.segmentId, input.segmentId),
        ))
        .orderBy(desc(audioStudyProgress.completedAt))
        .limit(1);
      // SM-2 algorithm
      let interval = latest?.intervalDays ?? 1;
      let ef = latest?.easeFactor ?? 2.5;
      let reps = (latest?.repetitions ?? 0) + 1;
      switch (input.rating) {
        case "easy":
          interval = Math.min(interval * 2.5, 365);
          ef = Math.min(ef + 0.15, 3.0);
          break;
        case "good":
          interval = Math.min(interval * ef, 365);
          break;
        case "hard":
          interval = Math.max(interval * 0.5, 0.5);
          ef = Math.max(ef - 0.2, 1.3);
          break;
      }
      const now = new Date();
      const nextReview = new Date(now.getTime() + interval * 86400000);
      const [r] = await db.insert(audioStudyProgress).values({
        userId: ctx.user.id,
        trackSlug: input.trackSlug,
        segmentId: input.segmentId,
        segmentType: input.segmentType,
        segmentTitle: input.segmentTitle,
        durationMs: input.durationMs,
        nextReviewAt: nextReview,
        intervalDays: interval,
        easeFactor: ef,
        repetitions: reps,
      });
      return { id: Number(r.insertId), nextReviewAt: nextReview, intervalDays: interval };
    }),
  /** Get aggregate review stats for the user */
  getReviewStats: protectedProcedure
    .input(z.object({ trackSlug: z.string().min(1).optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { dueNow: 0, dueToday: 0, mastered: 0, totalReviewed: 0 };
      const now = new Date();
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      const baseConditions = [
        eq(audioStudyProgress.userId, ctx.user.id),
        isNotNull(audioStudyProgress.nextReviewAt),
      ];
      if (input?.trackSlug) {
        baseConditions.push(eq(audioStudyProgress.trackSlug, input.trackSlug));
      }
      const [dueNowRow] = await db.select({
        cnt: sql<number>`COUNT(DISTINCT ${audioStudyProgress.segmentId})`.as("cnt"),
      }).from(audioStudyProgress)
        .where(and(...baseConditions, lte(audioStudyProgress.nextReviewAt, now)));
      const [dueTodayRow] = await db.select({
        cnt: sql<number>`COUNT(DISTINCT ${audioStudyProgress.segmentId})`.as("cnt"),
      }).from(audioStudyProgress)
        .where(and(...baseConditions, lte(audioStudyProgress.nextReviewAt, endOfDay)));
      const [masteredRow] = await db.select({
        cnt: sql<number>`COUNT(DISTINCT ${audioStudyProgress.segmentId})`.as("cnt"),
      }).from(audioStudyProgress)
        .where(and(
          ...baseConditions,
          gte(audioStudyProgress.intervalDays, 21),
        ));
      const [totalRow] = await db.select({
        cnt: sql<number>`COUNT(DISTINCT ${audioStudyProgress.segmentId})`.as("cnt"),
      }).from(audioStudyProgress)
        .where(and(...baseConditions));
      return {
        dueNow: Number(dueNowRow.cnt),
        dueToday: Number(dueTodayRow.cnt),
        mastered: Number(masteredRow.cnt),
        totalReviewed: Number(totalRow.cnt),
      };
    }),
});

// ─── Study Sessions ─────────────────────────────────────────────────────────
// Schema: id, userId, discipline, trackKey, durationMinutes, itemsStudied, itemsMastered, quizScore, createdAt
const studySessionsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(learningStudySessions)
      .where(eq(learningStudySessions.userId, ctx.user.id))
      .orderBy(desc(learningStudySessions.createdAt))
      .limit(50);
  }),
  record: protectedProcedure
    .input(z.object({
      discipline: z.string().optional(),
      trackKey: z.string().optional(),
      durationMinutes: z.number().min(0).default(0),
      itemsStudied: z.number().min(0).default(0),
      itemsMastered: z.number().min(0).default(0),
      quizScore: z.number().min(0).max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [r] = await db.insert(learningStudySessions).values({
        userId: ctx.user.id,
        discipline: input.discipline ?? null,
        trackKey: input.trackKey ?? null,
        durationMinutes: input.durationMinutes,
        itemsStudied: input.itemsStudied,
        itemsMastered: input.itemsMastered,
        quizScore: input.quizScore != null ? String(input.quizScore) : null,
      });
      return { id: Number(r.insertId) };
    }),
});

// ─── Achievements ───────────────────────────────────────────────────────────
// Schema: id, userId, achievementKey, unlockedAt
const achievementsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(learningAchievements)
      .where(eq(learningAchievements.userId, ctx.user.id))
      .orderBy(desc(learningAchievements.unlockedAt));
  }),
  award: protectedProcedure
    .input(z.object({ achievementKey: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Idempotent — skip if already awarded
      const existing = await db.select().from(learningAchievements)
        .where(and(eq(learningAchievements.userId, ctx.user.id), eq(learningAchievements.achievementKey, input.achievementKey)));
      if (existing.length > 0) return { id: existing[0].id, alreadyAwarded: true };
      const [r] = await db.insert(learningAchievements).values({
        userId: ctx.user.id,
        achievementKey: input.achievementKey,
      });
      return { id: Number(r.insertId), alreadyAwarded: false };
    }),
});

// ─── Settings ───────────────────────────────────────────────────────────────
// Schema: id, userId, settingKey, settingValue (json), updatedAt
const settingsRouter = router({
  get: protectedProcedure
    .input(z.object({ settingKey: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(learningSettings)
        .where(and(eq(learningSettings.userId, ctx.user.id), eq(learningSettings.settingKey, input.settingKey)))
        .limit(1);
      return rows[0] ?? null;
    }),
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(learningSettings)
      .where(eq(learningSettings.userId, ctx.user.id));
  }),
  upsert: protectedProcedure
    .input(z.object({ settingKey: z.string(), settingValue: z.any() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const existing = await db.select().from(learningSettings)
        .where(and(eq(learningSettings.userId, ctx.user.id), eq(learningSettings.settingKey, input.settingKey)))
        .limit(1);
      if (existing.length > 0) {
        await db.update(learningSettings).set({ settingValue: input.settingValue })
          .where(eq(learningSettings.id, existing[0].id));
        return { id: existing[0].id };
      }
      const [r] = await db.insert(learningSettings).values({
        userId: ctx.user.id,
        settingKey: input.settingKey,
        settingValue: input.settingValue,
      });
      return { id: Number(r.insertId) };
    }),
});

// ─── AI Quiz Questions ──────────────────────────────────────────────────────
// Schema: id, discipline, topic, difficulty, questionType, prompt, options, correctAnswer, explanation, usageCount, qualityScore, createdAt
const aiQuizRouter = router({
  list: protectedProcedure
    .input(z.object({ discipline: z.string().optional(), topic: z.string().optional(), limit: z.number().min(1).max(100).default(20) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      let q = db.select().from(learningAiQuizQuestions).limit(input.limit);
      if (input.discipline) {
        q = q.where(eq(learningAiQuizQuestions.discipline, input.discipline)) as any;
      }
      return q;
    }),
  create: protectedProcedure
    .input(z.object({
      discipline: z.string().optional(),
      topic: z.string().optional(),
      difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
      questionType: z.enum(["multiple_choice", "free_response", "cloze"]).default("multiple_choice"),
      prompt: z.string(),
      options: z.array(z.string()).optional(),
      correctAnswer: z.string().optional(),
      explanation: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [r] = await db.insert(learningAiQuizQuestions).values({
        discipline: input.discipline ?? null,
        topic: input.topic ?? null,
        difficulty: input.difficulty,
        questionType: input.questionType,
        prompt: input.prompt,
        options: input.options ? JSON.stringify(input.options) : null,
        correctAnswer: input.correctAnswer ?? null,
        explanation: input.explanation ?? null,
      });
      return { id: Number(r.insertId) };
    }),
});

// ─── Study Groups ───────────────────────────────────────────────────────────
const groupsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const memberships = await db.select().from(learningGroupMembers)
      .where(eq(learningGroupMembers.userId, ctx.user.id));
    if (memberships.length === 0) return [];
    const groupIds = memberships.map(m => m.groupId);
    const groups = await db.select().from(learningStudyGroups);
    return groups.filter(g => groupIds.includes(g.id));
  }),
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(255), description: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      const [r] = await db.insert(learningStudyGroups).values({
        name: input.name,
        description: input.description ?? null,
        inviteCode,
        ownerUserId: ctx.user.id,
      });
      const groupId = Number(r.insertId);
      await db.insert(learningGroupMembers).values({ groupId, userId: ctx.user.id, role: "owner" });
      return { id: groupId, inviteCode };
    }),
  join: protectedProcedure
    .input(z.object({ inviteCode: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const groups = await db.select().from(learningStudyGroups)
        .where(eq(learningStudyGroups.inviteCode, input.inviteCode));
      if (groups.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Invalid invite code" });
      const group = groups[0];
      const existing = await db.select().from(learningGroupMembers)
        .where(and(eq(learningGroupMembers.groupId, group.id), eq(learningGroupMembers.userId, ctx.user.id)));
      if (existing.length > 0) return { id: group.id, alreadyMember: true };
      await db.insert(learningGroupMembers).values({ groupId: group.id, userId: ctx.user.id, role: "member" });
      return { id: group.id, alreadyMember: false };
    }),
  members: protectedProcedure
    .input(z.object({ groupId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(learningGroupMembers)
        .where(eq(learningGroupMembers.groupId, input.groupId));
    }),

  // ─── Goals ───
  listGoals: protectedProcedure
    .input(z.object({ groupId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(learningGroupGoals)
        .where(eq(learningGroupGoals.groupId, input.groupId))
        .orderBy(desc(learningGroupGoals.createdAt));
    }),
  addGoal: protectedProcedure
    .input(z.object({ groupId: z.number(), title: z.string().min(1).max(255), description: z.string().optional(), targetDate: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [r] = await db.insert(learningGroupGoals).values({
        groupId: input.groupId, title: input.title, description: input.description ?? null,
        targetDate: input.targetDate ? new Date(input.targetDate) : null, createdBy: ctx.user.id,
      });
      await db.insert(learningGroupActivity).values({ groupId: input.groupId, userId: ctx.user.id, action: "added_goal", detail: input.title });
      return { id: Number(r.insertId) };
    }),
  toggleGoal: protectedProcedure
    .input(z.object({ goalId: z.number(), status: z.enum(["active", "completed", "abandoned"]) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(learningGroupGoals).set({
        status: input.status, completedAt: input.status === "completed" ? new Date() : null,
      }).where(eq(learningGroupGoals.id, input.goalId));
      return { ok: true };
    }),

  // ─── Notes ───
  listNotes: protectedProcedure
    .input(z.object({ groupId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(learningGroupNotes)
        .where(eq(learningGroupNotes.groupId, input.groupId))
        .orderBy(desc(learningGroupNotes.updatedAt));
    }),
  addNote: protectedProcedure
    .input(z.object({ groupId: z.number(), title: z.string().min(1).max(255), content: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [r] = await db.insert(learningGroupNotes).values({
        groupId: input.groupId, userId: ctx.user.id, title: input.title, content: input.content,
      });
      await db.insert(learningGroupActivity).values({ groupId: input.groupId, userId: ctx.user.id, action: "added_note", detail: input.title });
      return { id: Number(r.insertId) };
    }),
  updateNote: protectedProcedure
    .input(z.object({ noteId: z.number(), title: z.string().optional(), content: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const updates: Record<string, any> = {};
      if (input.title) updates.title = input.title;
      if (input.content) updates.content = input.content;
      if (Object.keys(updates).length === 0) return { ok: true };
      await db.update(learningGroupNotes).set(updates).where(eq(learningGroupNotes.id, input.noteId));
      return { ok: true };
    }),

  // ─── Leave Group ───
  leave: protectedProcedure
    .input(z.object({ groupId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(learningGroupMembers)
        .where(and(eq(learningGroupMembers.groupId, input.groupId), eq(learningGroupMembers.userId, ctx.user.id)));
      return { success: true };
    }),
  // ─── Activity Feed ───
  listActivity: protectedProcedure
    .input(z.object({ groupId: z.number(), limit: z.number().min(1).max(100).default(50) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(learningGroupActivity)
        .where(eq(learningGroupActivity.groupId, input.groupId))
        .orderBy(desc(learningGroupActivity.createdAt))
        .limit(input.limit);
    }),
});

// ─── Shared Quizzes ─────────────────────────────────────────────────────────
const sharedQuizzesRouter = router({
  list: protectedProcedure
    .input(z.object({ groupId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(learningSharedQuizzes)
        .where(eq(learningSharedQuizzes.groupId, input.groupId))
        .orderBy(desc(learningSharedQuizzes.createdAt));
    }),
  create: protectedProcedure
    .input(z.object({
      groupId: z.number(),
      title: z.string(),
      questionIds: z.array(z.number()),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [r] = await db.insert(learningSharedQuizzes).values({
        groupId: input.groupId,
        title: input.title,
        questionIds: JSON.stringify(input.questionIds),
        createdBy: ctx.user.id,
      });
      return { id: Number(r.insertId) };
    }),
});

// ─── Quiz Challenges ────────────────────────────────────────────────────────
const challengesRouter = router({
  list: protectedProcedure
    .input(z.object({ groupId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(learningQuizChallenges)
        .where(eq(learningQuizChallenges.groupId, input.groupId))
        .orderBy(desc(learningQuizChallenges.createdAt));
    }),
  create: protectedProcedure
    .input(z.object({
      groupId: z.number(),
      title: z.string(),
      sharedQuizId: z.number().optional(),
      timeLimitSeconds: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [r] = await db.insert(learningQuizChallenges).values({
        groupId: input.groupId,
        title: input.title,
        sharedQuizId: input.sharedQuizId ?? null,
        timeLimitSeconds: input.timeLimitSeconds ?? null,
        createdBy: ctx.user.id,
      });
      return { id: Number(r.insertId) };
    }),
  submitResult: protectedProcedure
    .input(z.object({ challengeId: z.number(), score: z.number().min(0).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [r] = await db.insert(learningChallengeResults).values({
        challengeId: input.challengeId,
        userId: ctx.user.id,
        score: String(input.score),
      });
      return { id: Number(r.insertId) };
    }),
  leaderboard: protectedProcedure
    .input(z.object({ challengeId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(learningChallengeResults)
        .where(eq(learningChallengeResults.challengeId, input.challengeId))
        .orderBy(desc(learningChallengeResults.score));
    }),
});

// ─── Bookmarks ──────────────────────────────────────────────────────────────
const bookmarksRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(learningBookmarks)
      .where(eq(learningBookmarks.userId, ctx.user.id))
      .orderBy(desc(learningBookmarks.createdAt));
  }),
  add: protectedProcedure
    .input(z.object({
      contentType: z.string(),
      contentId: z.string(),
      note: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [r] = await db.insert(learningBookmarks).values({
        userId: ctx.user.id,
        contentType: input.contentType,
        contentId: input.contentId,
        note: input.note ?? null,
      });
      return { id: Number(r.insertId) };
    }),
  remove: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(learningBookmarks)
        .where(and(eq(learningBookmarks.id, input.id), eq(learningBookmarks.userId, ctx.user.id)));
      return { success: true };
    }),
  check: protectedProcedure
    .input(z.object({ contentType: z.string(), contentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { bookmarked: false, bookmark: null };
      const [row] = await db.select().from(learningBookmarks)
        .where(and(
          eq(learningBookmarks.userId, ctx.user.id),
          eq(learningBookmarks.contentType, input.contentType),
          eq(learningBookmarks.contentId, input.contentId),
        ))
        .limit(1);
      return { bookmarked: !!row, bookmark: row ?? null };
    }),
  updateNote: protectedProcedure
    .input(z.object({ id: z.number(), note: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(learningBookmarks)
        .set({ note: input.note })
        .where(and(eq(learningBookmarks.id, input.id), eq(learningBookmarks.userId, ctx.user.id)));
      return { success: true };
    }),
});

// ─── Playlists ──────────────────────────────────────────────────────────────
const playlistsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(learningPlaylists)
      .where(eq(learningPlaylists.ownerUserId, ctx.user.id))
      .orderBy(desc(learningPlaylists.updatedAt));
  }),
  create: protectedProcedure
    .input(z.object({ title: z.string(), description: z.string().optional(), isPublic: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const shareToken = Math.random().toString(36).substring(2, 18);
      const [r] = await db.insert(learningPlaylists).values({
        ownerUserId: ctx.user.id,
        title: input.title,
        description: input.description ?? null,
        isPublic: input.isPublic,
        shareToken,
      });
      return { id: Number(r.insertId), shareToken };
    }),
  addItem: protectedProcedure
    .input(z.object({ playlistId: z.number(), contentType: z.string(), contentId: z.string(), sortOrder: z.number().default(0) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [r] = await db.insert(learningPlaylistItems).values({
        playlistId: input.playlistId,
        contentType: input.contentType,
        contentId: input.contentId,
        sortOrder: input.sortOrder,
      });
      return { id: Number(r.insertId) };
    }),
  items: protectedProcedure
    .input(z.object({ playlistId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(learningPlaylistItems)
        .where(eq(learningPlaylistItems.playlistId, input.playlistId))
        .orderBy(learningPlaylistItems.sortOrder);
    }),
  removeItem: protectedProcedure
    .input(z.object({ itemId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(learningPlaylistItems).where(eq(learningPlaylistItems.id, input.itemId));
      return { success: true };
    }),
  share: protectedProcedure
    .input(z.object({ playlistId: z.number(), sharedWithUserId: z.number(), permission: z.enum(["view", "edit"]).default("view") }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [r] = await db.insert(learningPlaylistShares).values({
        playlistId: input.playlistId,
        sharedWithUserId: input.sharedWithUserId,
        permission: input.permission,
      });
      return { id: Number(r.insertId) };
    }),
  inviteByEmail: protectedProcedure
    .input(z.object({ playlistId: z.number(), email: z.string().email(), permission: z.enum(["view", "edit"]).default("view") }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [r] = await db.insert(learningPendingInvites).values({
        playlistId: input.playlistId,
        email: input.email,
        permission: input.permission,
      });
      return { id: Number(r.insertId) };
    }),
  update: protectedProcedure
    .input(z.object({ id: z.number(), name: z.string().optional(), description: z.string().optional(), isPublic: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const sets: Record<string, any> = { updatedAt: new Date() };
      if (input.name !== undefined) sets.title = input.name;
      if (input.description !== undefined) sets.description = input.description;
      if (input.isPublic !== undefined) sets.isPublic = input.isPublic;
      await db.update(learningPlaylists).set(sets)
        .where(and(eq(learningPlaylists.id, input.id), eq(learningPlaylists.ownerUserId, ctx.user.id)));
      return { success: true };
    }),
  remove: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(learningPlaylistItems).where(eq(learningPlaylistItems.playlistId, input.id));
      await db.delete(learningPlaylists)
        .where(and(eq(learningPlaylists.id, input.id), eq(learningPlaylists.ownerUserId, ctx.user.id)));
      return { success: true };
    }),
  getShared: publicProcedure
    .input(z.object({ shareToken: z.string().min(1).max(64) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [playlist] = await db.select().from(learningPlaylists)
        .where(eq(learningPlaylists.shareToken, input.shareToken))
        .limit(1);
      if (!playlist) throw new TRPCError({ code: "NOT_FOUND", message: "Playlist not found or not shared" });
      const items = await db.select().from(learningPlaylistItems)
        .where(eq(learningPlaylistItems.playlistId, playlist.id))
        .orderBy(learningPlaylistItems.sortOrder);
      return { ...playlist, items };
    }),
});

// ─── Discovery History ──────────────────────────────────────────────────────
const discoveryRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(learningDiscoveryHistory)
      .where(eq(learningDiscoveryHistory.userId, ctx.user.id))
      .orderBy(desc(learningDiscoveryHistory.createdAt))
      .limit(50);
  }),
  record: protectedProcedure
    .input(z.object({ seedQuery: z.string(), followUps: z.array(z.string()).optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [r] = await db.insert(learningDiscoveryHistory).values({
        userId: ctx.user.id,
        seedQuery: input.seedQuery,
        followUps: input.followUps ? JSON.stringify(input.followUps) : null,
      });
      return { id: Number(r.insertId) };
    }),
});

// ─── Group Mastery Comparison (Pass 154) ──────────────────────────────────────
const groupMasteryRouter = router({
  /** Compare mastery progress across all members of a study group */
  compare: protectedProcedure
    .input(z.object({ groupId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      // 1. Get all members of this group
      const members = await db.select().from(learningGroupMembers)
        .where(eq(learningGroupMembers.groupId, input.groupId));
      if (members.length === 0) return [];

      // Verify caller is a member
      const isMember = members.some(m => m.userId === ctx.user.id);
      if (!isMember) throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this group" });

      const memberIds = members.map(m => m.userId);

      // 2. Get user info for all members
      const memberUsers = await db.select({
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
      }).from(users).where(inArray(users.id, memberIds));

      // 3. Get mastery data for all members (aggregated)
      const masteryRows = await db.select({
        userId: learningMasteryProgress.userId,
        totalItems: sql<number>`COUNT(*)`,
        masteredItems: sql<number>`SUM(CASE WHEN ${learningMasteryProgress.mastered} = 1 THEN 1 ELSE 0 END)`,
        avgConfidence: sql<number>`AVG(${learningMasteryProgress.confidence})`,
        totalReviews: sql<number>`SUM(${learningMasteryProgress.reviewCount})`,
      }).from(learningMasteryProgress)
        .where(inArray(learningMasteryProgress.userId, memberIds))
        .groupBy(learningMasteryProgress.userId);

      // 4. Get streak data for all members
      const streakRows = await db.select().from(learningStreaks)
        .where(inArray(learningStreaks.userId, memberIds));

      // 5. Get study session totals for all members
      const sessionRows = await db.select({
        userId: learningStudySessions.userId,
        totalMinutes: sql<number>`SUM(${learningStudySessions.durationMinutes})`,
        totalSessions: sql<number>`COUNT(*)`,
      }).from(learningStudySessions)
        .where(inArray(learningStudySessions.userId, memberIds))
        .groupBy(learningStudySessions.userId);

      // 6. Compose ranked results
      const userMap = new Map(memberUsers.map(u => [u.id, u]));
      const masteryMap = new Map(masteryRows.map(m => [m.userId, m]));
      const streakMap = new Map(streakRows.map(s => [s.userId, s]));
      const sessionMap = new Map(sessionRows.map(s => [s.userId, s]));
      const memberRoleMap = new Map(members.map(m => [m.userId, m.role]));

      const results = memberIds.map(uid => {
        const user = userMap.get(uid);
        const mastery = masteryMap.get(uid);
        const streak = streakMap.get(uid);
        const session = sessionMap.get(uid);
        const role = memberRoleMap.get(uid) ?? "member";

        const totalItems = Number(mastery?.totalItems ?? 0);
        const masteredItems = Number(mastery?.masteredItems ?? 0);
        const avgConfidence = Number(mastery?.avgConfidence ?? 0);
        const totalReviews = Number(mastery?.totalReviews ?? 0);
        const currentStreak = streak?.currentStreak ?? 0;
        const longestStreak = streak?.longestStreak ?? 0;
        const totalMinutes = Number(session?.totalMinutes ?? 0);
        const totalSessions = Number(session?.totalSessions ?? 0);

        // Composite score: weighted blend prioritizing knowledge depth (mastery rate 40%),
        // retention quality (avg confidence 30%), consistency (streak 20%), and effort (study time 10%).
        // Weights chosen to reward actual learning outcomes over raw time investment.
        const masteryRate = totalItems > 0 ? masteredItems / totalItems : 0;
        const normalizedConfidence = avgConfidence / 5;
        const normalizedStreak = Math.min(currentStreak / 30, 1); // cap at 30 days
        const normalizedTime = Math.min(totalMinutes / 600, 1); // cap at 10 hours
        const compositeScore = Math.round(
          (masteryRate * 40 + normalizedConfidence * 30 + normalizedStreak * 20 + normalizedTime * 10) * 10
        ) / 10;

        return {
          userId: uid,
          name: user?.name ?? `User ${uid}`,
          avatarUrl: user?.avatarUrl ?? null,
          role,
          isCurrentUser: uid === ctx.user.id,
          totalItems,
          masteredItems,
          masteryRate: Math.round(masteryRate * 100),
          avgConfidence: Math.round(avgConfidence * 10) / 10,
          totalReviews,
          currentStreak,
          longestStreak,
          totalMinutes,
          totalSessions,
          compositeScore,
        };
      });

      // Sort by composite score descending
      results.sort((a, b) => b.compositeScore - a.compositeScore);

      // Add rank
      return results.map((r, i) => ({ ...r, rank: i + 1 }));
    }),
});

// ─── Combined Social Learning Router ────────────────────────────────────────
export const learningSocialRouter = router({
  studySessions: studySessionsRouter,
  achievements: achievementsRouter,
  settings: settingsRouter,
  aiQuiz: aiQuizRouter,
  groups: groupsRouter,
  sharedQuizzes: sharedQuizzesRouter,
  challenges: challengesRouter,
  bookmarks: bookmarksRouter,
  playlists: playlistsRouter,
  discovery: discoveryRouter,
  groupMastery: groupMasteryRouter,
  audioProgress: audioProgressRouter,
});
