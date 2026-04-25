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
import { eq, and, desc } from "drizzle-orm";
import {
  learningStudySessions, learningAchievements, learningSettings,
  learningAiQuizQuestions, learningStudyGroups, learningGroupMembers,
  learningSharedQuizzes, learningQuizChallenges, learningChallengeResults,
  learningBookmarks, learningPlaylists, learningPlaylistItems,
  learningPlaylistShares, learningPendingInvites, learningDiscoveryHistory,
} from "../../drizzle/schema";

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
});
