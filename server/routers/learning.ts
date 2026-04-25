/**
 * EMBA Learning — tRPC router (Task 2A + Task 7C).
 *
 * Single router that exposes every learning procedure under
 * `learning.*` in the root appRouter. Organized into subrouters:
 *
 *   learning.mastery.*            — SRS (review, summary, due, readiness)
 *   learning.licenses.*           — licensure CRUD + alerts + CE credits
 *   learning.content.*            — definitions, tracks, chapters, Q&A CRUD
 *   learning.freshness.*          — content versions + regulatory feed
 *   learning.recommendations.*    — fused study recommendations
 *   learning.seed                 — admin-only initial seed
 *
 * Permission checks use server/services/learning/permissions.ts.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "../_core/trpc";
import type { ActingUser } from "../services/learning/permissions";
import { assertCanEdit, canPublish, canSeedContent } from "../services/learning/permissions";

import {
  processReview as fsrs5ProcessReview,
  getDueCards as fsrs5GetDueCards,
  getReviewStats as fsrs5GetReviewStats,
} from "../services/learning/fsrsSrsService";
import {
  startSession as startAssessmentSession,
  getActiveSession,
  completeSession as completeAssessmentSession,
  abandonSession as abandonAssessmentSession,
  getSessionHistory,
  isAiBlocked,
  recordFocusLoss,
} from "../services/learning/assessmentSession";
import {
  recordActivity as recordStreakActivity,
  getOrCreateStreak,
  updateSettings as updateStreakSettings,
  isStreakAtRisk,
} from "../services/learning/streaks";
import {
  getLessonGraph,
  isChapterUnlocked,
  addPrerequisite,
  removePrerequisite,
  getNextUnlockable,
} from "../services/learning/lessonGraph";
import {
  createSession as createOfficeHour,
  listUpcoming as listUpcomingOfficeHours,
  listPast as listPastOfficeHours,
  register as registerForOfficeHour,
  cancelRegistration as cancelOfficeHourRegistration,
  getMyRegistrations as getMyOfficeHourRegistrations,
  updateSessionStatus as updateOfficeHourStatus,
  getRegistrations as getOfficeHourRegistrations,
} from "../services/learning/officeHours";
import {
  issueCeCredit,
  revokeCeCredit,
  listUserCredits,
  getCreditSummary,
  verifyCeCredit,
} from "../services/learning/ceCredits";
import {
  createGroup,
  joinGroup,
  leaveGroup,
  listGroups,
  getGroupMembers,
  postMessage as postGroupMessage,
  getMessages as getGroupMessages,
  getMyGroups,
} from "../services/learning/peerGroups";
import { generateCeCertificatePdf } from "../services/learning/ceCertificatePdf";
import { prescreenContent, isAdvisorOrAbove } from "../services/learning/compliancePrescreening";
import { recordConsent, checkAllConsented, persistTranscript } from "../services/learning/officeHoursConsent";
import {
  getUserMastery,
  upsertMastery,
  batchUpsertMastery,
  getDueItems,
  getMasterySummary,
  assessTrackReadiness,
  parseItemKey,
  listNewFlashcards,
  listNewQuestions,
  getNewItemCount,
  buildReviewSession,
  getReviewForecast,
  previewIntervals,
} from "../services/learning/mastery";

import { getDueReviewDeck } from "../services/learning/dueReview";

import {
  getUserLicenses,
  addLicense,
  updateLicense,
  deleteLicense,
  addCECredit,
  getCECreditsForLicense,
  getLicenseAlerts,
  getCEProgress,
} from "../services/learning/licenses";

import {
  listDefinitions,
  getDefinition,
  createDefinition,
  updateDefinition,
  archiveDefinition,
  listDisciplines,
  listTracks,
  getTrack,
  getTrackBySlug,
  createTrack,
  updateTrack,
  listChaptersForTrack,
  listSubsectionsForChapter,
  createChapter,
  createSubsection,
  listQuestionsForTrack,
  createPracticeQuestion,
  listFlashcardsForTrack,
  createFlashcard,
  getFlashcardsByIds,
  getQuestionsByIds,
  searchContent,
  explainConcept,
  getContentHistory,
  listCases,
  listFsApplications,
  listConnections,
  listFormulas,
  getHandsFreeContent,
} from "../services/learning/content";

import {
  getContentVersion,
  recordContentVersion,
  listPendingRegulatoryUpdates,
  reviewRegulatoryUpdate,
  recordRegulatoryUpdate,
  REGULATORY_SOURCES,
  onContentSourceUpdated,
} from "../services/learning/freshness";

import { recommendStudyContent } from "../services/learning/recommendations";
import { seedLearningContent } from "../services/learning/seed";
import { importEMBAFromGitHub } from "../services/learning/embaImport";
import {
  loadImportHistory,
  summarizeHistory,
} from "../services/learning/importHistory";

// ── Helpers ───────────────────────────────────────────────────────────────

function asActing(ctx: { user: { id: number; role: string } }): ActingUser {
  const role = (ctx.user.role as ActingUser["role"]) ?? "user";
  return { id: ctx.user.id, role };
}

// ── Mastery subrouter (SRS) ───────────────────────────────────────────────

const masteryRouter = router({
  getMine: protectedProcedure.query(async ({ ctx }) => {
    return getUserMastery(ctx.user.id);
  }),

  summary: protectedProcedure.query(async ({ ctx }) => {
    // Augment the mastery summary with a "new items" count so the
    // Learning Home can show a first-time "Start learning" CTA even
    // when the SRS due-count is 0 — without this, a fresh user who
    // just imported 366 flashcards sees "nothing due" and never finds
    // the review path.
    const [core, newItems] = await Promise.all([
      getMasterySummary(ctx.user.id),
      getNewItemCount(ctx.user.id),
    ]);
    return {
      ...core,
      newFlashcards: newItems.newFlashcards,
      newQuestions: newItems.newQuestions,
      newTotal: newItems.total,
    };
  }),

  recordReview: protectedProcedure
    .input(
      z.object({
        itemKey: z.string().min(1).max(255),
        itemType: z.string().min(1).max(64),
        correct: z.boolean(),
        difficulty: z.enum(["again", "hard", "good", "easy"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const row = await upsertMastery({
        userId: ctx.user.id,
        itemKey: input.itemKey,
        itemType: input.itemType,
        correct: input.correct,
        difficulty: input.difficulty,
      });
      // Also record streak activity and check for milestones
      const streakResult = await recordStreakActivity(ctx.user.id);
      const milestone = (streakResult as any)?.milestone ?? null;
      return {
        ok: row !== null,
        milestone: milestone ? {
          days: milestone.days,
          label: milestone.label,
          icon: milestone.icon,
          description: milestone.description,
        } : null,
      };
    }),

  syncBatch: protectedProcedure
    .input(
      z.object({
        items: z.array(
          z.object({
            itemKey: z.string().min(1).max(255),
            itemType: z.string().min(1).max(64),
            correct: z.boolean(),
          }),
        ).max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const written = await batchUpsertMastery(ctx.user.id, input.items);
      return { written };
    }),

  dueNow: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(500).default(50) }).optional())
    .query(async ({ ctx, input }) => {
      return getDueItems(ctx.user.id, input?.limit ?? 50);
    }),

  /** Alias for dueNow — used by StudyBuddy hub */
  dueItems: protectedProcedure
    .query(async ({ ctx }) => {
      return getDueItems(ctx.user.id, 50);
    }),

  /**
   * Returns a ready-to-render mixed-modality review session.
   *
   * Shape: the user's overdue flashcards + practice questions
   * (hydrated), interleaved most-overdue-first, OPTIONALLY padded
   * with "new cards" (items the user has never seen) up to `limit`
   * when the due queue is shorter than `limit`. The padding is what
   * turns this from "review only what's overdue" into a classical
   * Anki-style mixed queue that also works for first-time users.
   *
   * Pass `newQuota=0` to opt out of the new-card queue (strict
   * review-only mode).
   */
  dueReview: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(100).default(20),
          /** Max new-card items to include when the due queue is short. */
          newQuota: z.number().int().min(0).max(100).default(10),
          /** If true, ONLY return new cards (ignore due items). */
          studyAhead: z.boolean().default(false),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      // --- SRS Settings Enforcement (Pass 153) ---
      // Read user's saved settings as dynamic defaults when client doesn't override
      let settingsLimit = 20;
      let settingsNewQuota = 10;
      try {
        const { getDb: getDbFn } = await import("../db");
        const { learningSettings } = await import("../../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        const db = await getDbFn();
        if (db) {
          const rows = await db.select().from(learningSettings)
            .where(eq(learningSettings.userId, ctx.user.id));
          for (const r of rows) {
            const val = Number(r.settingValue);
            if (r.settingKey === "srs_daily_review_cap" && val > 0 && val <= 100) settingsLimit = val;
            if (r.settingKey === "srs_new_card_quota" && val >= 0 && val <= 100) settingsNewQuota = val;
          }
        }
      } catch { /* fallback to defaults */ }
      const limit = input?.limit ?? settingsLimit;
      const newQuota = input?.newQuota ?? settingsNewQuota;
      const studyAhead = input?.studyAhead ?? false;

      // 1. Hydrate the due queue (or skip it in studyAhead mode).
      const due = studyAhead ? [] : await getDueItems(ctx.user.id, limit * 2);
      const flashcardIds: number[] = [];
      const questionIds: number[] = [];
      for (const row of due) {
        const parsed = parseItemKey(row.itemKey);
        if (parsed.kind === "flashcard" && parsed.id != null) flashcardIds.push(parsed.id);
        else if (parsed.kind === "question" && parsed.id != null) questionIds.push(parsed.id);
      }
      const [flashcards, questions] = await Promise.all([
        getFlashcardsByIds(flashcardIds),
        getQuestionsByIds(questionIds),
      ]);
      const flashcardById = new Map<number, any>(flashcards.map((f: any) => [f.id, f]));
      const questionById = new Map<number, any>(questions.map((q: any) => [q.id, q]));

      // 2. Fetch new-card candidates. Worst case we fetch more than we
      //    need (when `due` already fills the limit), which is acceptable
      //    because both helpers have their own `limit` parameter and we
      //    cap at the right size inside `buildReviewSession`.
      const padTarget = studyAhead ? limit : Math.min(newQuota, limit);
      const [newFcs, newQs] = padTarget > 0
        ? await Promise.all([
            listNewFlashcards(ctx.user.id, Math.ceil(padTarget / 2)),
            listNewQuestions(ctx.user.id, Math.floor(padTarget / 2)),
          ])
        : [[], []];

      // 3. Assemble the final session via the pure helper (unit-tested).
      const session = buildReviewSession({
        due,
        flashcardById,
        questionById,
        newFlashcards: newFcs as any,
        newQuestions: newQs as any,
        limit,
        newQuota,
        studyAhead,
      });

      return {
        items: session.items,
        total: session.items.length,
        dueTotal: due.length,
        newItems: session.newItems,
        reviewItems: session.reviewItems,
      };
    }),

  assessReadiness: protectedProcedure
    .input(z.object({ trackSlug: z.string().min(1).max(128) }))
    .query(async ({ ctx, input }) => {
      return assessTrackReadiness(ctx.user.id, input.trackSlug);
    }),

  /**
   * Cross-track due-review deck (simplified variant).
   */
  dueReviewDeck: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(200).optional(),
          kind: z.enum(["flashcard", "question"]).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return getDueReviewDeck(ctx.user.id, {
        limit: input?.limit,
        kind: input?.kind,
      });
    }),
  /** SRS forecast — 30-day predicted review load timeline */
  forecast: protectedProcedure
    .input(z.object({ days: z.number().int().min(7).max(90).default(30) }).optional())
    .query(async ({ ctx, input }) => {
      return getReviewForecast(ctx.user.id, input?.days ?? 30);
    }),

  /** Preview SRS intervals for all 4 difficulty levels at a given confidence (Pass 154) */
  previewIntervals: publicProcedure
    .input(z.object({ confidence: z.number().int().min(0).max(5) }))
    .query(({ input }) => {
      return previewIntervals(input.confidence);
    }),
});

// ── Licensure subrouter ───────────────────────────────────────────────────

const LicenseInput = z.object({
  licenseType: z.string().min(1).max(128),
  licenseState: z.string().max(64).optional(),
  licenseNumber: z.string().max(128).optional(),
  issueDate: z.coerce.date().optional(),
  expirationDate: z.coerce.date().optional(),
  status: z.enum(["active", "expired", "pending", "suspended"]).optional(),
  ceCreditsRequired: z.number().int().min(0).max(1000).optional(),
  ceCreditsCompleted: z.number().int().min(0).max(1000).optional(),
  ceDeadline: z.coerce.date().optional(),
});

const licensesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return getUserLicenses(ctx.user.id);
  }),

  add: protectedProcedure.input(LicenseInput).mutation(async ({ ctx, input }) => {
    return addLicense({ userId: ctx.user.id, ...input });
  }),

  update: protectedProcedure
    .input(z.object({ id: z.number().int() }).merge(LicenseInput.partial()))
    .mutation(async ({ ctx, input }) => {
      const { id, ...patch } = input;
      const ok = await updateLicense(id, ctx.user.id, patch as any);
      return { ok };
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const ok = await deleteLicense(input.id, ctx.user.id);
      return { ok };
    }),

  alerts: protectedProcedure.query(async ({ ctx }) => {
    return getLicenseAlerts(ctx.user.id);
  }),

  ceProgress: protectedProcedure.query(async ({ ctx }) => {
    return getCEProgress(ctx.user.id);
  }),

  addCECredit: protectedProcedure
    .input(
      z.object({
        licenseId: z.number().int(),
        creditType: z.string().max(128).optional(),
        creditHours: z.number().min(0).max(100),
        completedDate: z.coerce.date().optional(),
        providerName: z.string().max(255).optional(),
        courseTitle: z.string().max(512).optional(),
        certificateUrl: z.string().url().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return addCECredit({ userId: ctx.user.id, ...input });
    }),

  ceCreditsForLicense: protectedProcedure
    .input(z.object({ licenseId: z.number().int() }))
    .query(async ({ input }) => {
      return getCECreditsForLicense(input.licenseId);
    }),
});

// ── Content subrouter ─────────────────────────────────────────────────────

const Visibility = z.enum(["public", "team", "private"]);
const PubStatus = z.enum(["published", "draft", "review", "archived"]);

const contentRouter = router({
  // Disciplines
  listDisciplines: protectedProcedure.query(async () => listDisciplines()),

  // Definitions
  listDefinitions: protectedProcedure
    .input(
      z
        .object({
          disciplineId: z.number().int().optional(),
          visibility: Visibility.optional(),
          status: PubStatus.optional(),
          search: z.string().max(255).optional(),
          limit: z.number().int().min(1).max(500).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => listDefinitions(input ?? {})),

  getDefinition: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => getDefinition(input.id)),

  createDefinition: protectedProcedure
    .input(
      z.object({
        disciplineId: z.number().int().optional(),
        term: z.string().min(1).max(512),
        definition: z.string().min(1).max(50_000),
        visibility: Visibility.default("private"),
        status: PubStatus.default("draft"),
        sourceRef: z.string().max(2000).optional(),
        tags: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Publishing requires advisor+
      if (input.status === "published" && !canPublish(asActing(ctx))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only advisors can publish content" });
      }
      return createDefinition({ ...input, createdBy: ctx.user.id });
    }),

  updateDefinition: protectedProcedure
    .input(
      z.object({
        id: z.number().int(),
        term: z.string().min(1).max(512).optional(),
        definition: z.string().min(1).optional(),
        visibility: Visibility.optional(),
        status: PubStatus.optional(),
        sourceRef: z.string().max(2000).optional(),
        tags: z.array(z.string()).optional(),
        changeReason: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, changeReason, ...patch } = input;
      const existing = await getDefinition(id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Definition not found" });
      assertCanEditOrThrow(asActing(ctx), existing);
      if (patch.status === "published" && !canPublish(asActing(ctx))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only advisors can publish content" });
      }
      const ok = await updateDefinition(id, patch as any, ctx.user.id, changeReason);
      return { ok };
    }),

  archiveDefinition: protectedProcedure
    .input(z.object({ id: z.number().int(), reason: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await getDefinition(input.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Definition not found" });
      assertCanEditOrThrow(asActing(ctx), existing);
      const ok = await archiveDefinition(input.id, ctx.user.id, input.reason);
      return { ok };
    }),

  // Tracks
  listTracks: publicProcedure
    .input(
      z
        .object({
          visibility: Visibility.optional(),
          status: PubStatus.optional(),
          search: z.string().max(255).optional(),
          limit: z.number().int().min(1).max(200).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => listTracks(input ?? {})),

  getTrack: publicProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => getTrack(input.id)),

  getTrackBySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1).max(128) }))
    .query(async ({ input }) => getTrackBySlug(input.slug)),

  createTrack: protectedProcedure
    .input(
      z.object({
        slug: z.string().min(1).max(128),
        name: z.string().min(1).max(255),
        category: z.enum(["securities", "planning", "insurance", "custom"]).default("custom"),
        title: z.string().max(512).optional(),
        subtitle: z.string().max(2000).optional(),
        description: z.string().max(5000).optional(),
        color: z.string().max(32).optional(),
        emoji: z.string().max(8).optional(),
        tagline: z.string().max(500).optional(),
        visibility: Visibility.default("private"),
        status: PubStatus.default("draft"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!canPublish(asActing(ctx)) && input.status === "published") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only advisors can publish" });
      }
      return createTrack({ ...input, createdBy: ctx.user.id });
    }),

  updateTrack: protectedProcedure
    .input(
      z.object({
        id: z.number().int(),
        name: z.string().min(1).max(255).optional(),
        title: z.string().max(512).optional(),
        subtitle: z.string().max(2000).optional(),
        description: z.string().max(5000).optional(),
        status: PubStatus.optional(),
        visibility: Visibility.optional(),
        sortOrder: z.number().int().min(0).max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await getTrack(input.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
      assertCanEditOrThrow(asActing(ctx), existing);
      const { id, ...patch } = input;
      if (patch.status === "published" && !canPublish(asActing(ctx))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only advisors can publish content" });
      }
      const ok = await updateTrack(id, patch as any, ctx.user.id);
      return { ok };
    }),

  // Chapters / subsections
  listChapters: publicProcedure
    .input(z.object({ trackId: z.number().int() }))
    .query(async ({ input }) => listChaptersForTrack(input.trackId)),

  listSubsections: publicProcedure
    .input(z.object({ chapterId: z.number().int() }))
    .query(async ({ input }) => listSubsectionsForChapter(input.chapterId)),

  createChapter: protectedProcedure
    .input(
      z.object({
        trackId: z.number().int(),
        title: z.string().min(1).max(512),
        intro: z.string().max(5000).optional(),
        isPractice: z.boolean().default(false),
        sortOrder: z.number().int().min(0).max(1000).default(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const track = await getTrack(input.trackId);
      if (!track) throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
      assertCanEditOrThrow(asActing(ctx), track);
      return createChapter({ ...input, createdBy: ctx.user.id });
    }),

  createSubsection: protectedProcedure
    .input(
      z.object({
        chapterId: z.number().int(),
        title: z.string().max(512).optional(),
        level: z.number().int().min(1).max(6).default(2),
        paragraphs: z.array(z.string()).optional(),
        tables: z.array(z.any()).optional(),
        sortOrder: z.number().int().min(0).max(1000).default(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return createSubsection({ ...input, createdBy: ctx.user.id });
    }),

  // Practice questions
  listQuestions: publicProcedure
    .input(z.object({ trackId: z.number().int() }))
    .query(async ({ input }) => listQuestionsForTrack(input.trackId)),

  createQuestion: protectedProcedure
    .input(
      z.object({
        trackId: z.number().int().optional(),
        chapterId: z.number().int().optional(),
        prompt: z.string().min(1).max(5000),
        options: z.array(z.string()).min(2).max(6),
        correctIndex: z.number().int().min(0).max(5),
        explanation: z.string().max(5000).optional(),
        difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
        tags: z.array(z.string()).optional(),
        source: z.enum(["manual", "ai_generated", "user_authored"]).default("user_authored"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return createPracticeQuestion({ ...input, createdBy: ctx.user.id });
    }),

  // Flashcards
  listFlashcards: publicProcedure
    .input(z.object({ trackId: z.number().int() }))
    .query(async ({ input }) => listFlashcardsForTrack(input.trackId)),

  createFlashcard: protectedProcedure
    .input(
      z.object({
        trackId: z.number().int().optional(),
        chapterId: z.number().int().optional(),
        term: z.string().min(1).max(512),
        definition: z.string().min(1).max(5000),
        sourceLabel: z.string().max(255).optional(),
        source: z.enum(["manual", "ai_generated", "user_authored"]).default("user_authored"),
        tags: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return createFlashcard({ ...input, createdBy: ctx.user.id });
    }),

  // Cases
  listCases: protectedProcedure
    .input(z.object({ disciplineId: z.number().int().optional() }).optional())
    .query(async ({ input }) => listCases(input ?? {})),

  // FS Applications
  listFsApplications: protectedProcedure
    .input(z.object({ disciplineId: z.number().int().optional() }).optional())
    .query(async ({ input }) => listFsApplications(input ?? {})),

  // Connections (concept graph edges)
  listConnections: protectedProcedure
    .query(async () => listConnections()),

  // Formulas
  listFormulas: protectedProcedure
    .input(z.object({ disciplineId: z.number().int().optional() }).optional())
    .query(async ({ input }) => listFormulas(input ?? {})),

  // Unified search
  search: protectedProcedure
    .input(z.object({ query: z.string().min(1).max(255), limit: z.number().int().min(1).max(100).optional() }))
    .query(async ({ input }) => searchContent(input.query, input.limit)),

  // Explain concept (chat-friendly)
  explain: protectedProcedure
    .input(z.object({ concept: z.string().min(1).max(255) }))
    .query(async ({ input }) => explainConcept(input.concept)),

  // Content history (audit)
  history: protectedProcedure
    .input(z.object({ contentTable: z.string().max(128), contentId: z.number().int() }))
    .query(async ({ input }) => getContentHistory(input.contentTable, input.contentId)),

  // ── Hands-Free Study: Exhaustive content fetcher (Pass 157) ──
  getHandsFreeContent: protectedProcedure
    .input(
      z.object({
        sections: z.array(z.enum(["definitions", "formulas", "cases", "applications", "subsections", "flashcards", "questions"])).default(["definitions", "formulas", "cases", "applications", "subsections", "flashcards", "questions"]),
        limit: z.number().int().min(1).max(200).default(50),
        disciplineId: z.number().int().optional(),
        trackId: z.number().int().optional(),
      }).optional(),
    )
    .query(async ({ input }) => {
      return getHandsFreeContent({
        sections: input?.sections ?? ["definitions", "formulas", "cases", "applications", "subsections", "flashcards", "questions"],
        limit: input?.limit ?? 50,
        disciplineId: input?.disciplineId,
        trackId: input?.trackId,
      });
    }),
});

function assertCanEditOrThrow(user: ActingUser, row: any) {
  try {
    assertCanEdit(user, {
      createdBy: row.createdBy ?? null,
      visibility: row.visibility ?? "public",
      status: row.status ?? "published",
    });
  } catch {
    throw new TRPCError({ code: "FORBIDDEN", message: "You do not have permission to edit this content" });
  }
}

// ── Freshness + regulatory subrouter ─────────────────────────────────────

const freshnessRouter = router({
  sources: protectedProcedure.query(() => REGULATORY_SOURCES),

  getVersion: protectedProcedure
    .input(z.object({ contentSource: z.string().max(128), contentKey: z.string().max(255) }))
    .query(async ({ input }) => getContentVersion(input.contentSource, input.contentKey)),

  pendingUpdates: protectedProcedure.query(async () => listPendingRegulatoryUpdates()),

  review: adminProcedure
    .input(
      z.object({
        id: z.number().int(),
        decision: z.enum(["reviewed", "applied", "dismissed"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ok = await reviewRegulatoryUpdate(input.id, ctx.user.id, input.decision);
      return { ok };
    }),

  recordUpdate: adminProcedure
    .input(
      z.object({
        source: z.string().max(128),
        category: z.string().max(128),
        title: z.string().max(512),
        summary: z.string().max(5000),
        effectiveDate: z.coerce.date().optional(),
        affectedLicenses: z.array(z.string()),
        affectedContent: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ input }) => recordRegulatoryUpdate(input)),

  recordSourceUpdate: adminProcedure
    .input(
      z.object({
        source: z.string().max(128),
        key: z.string().max(255),
        rawContent: z.string().max(5_000_000),
        changelog: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return onContentSourceUpdated(input.source, input.key, input.rawContent, input.changelog);
    }),
});

// ── Recommendations subrouter ────────────────────────────────────────────

const recommendationsRouter = router({
  forMe: protectedProcedure
    .input(z.object({ recentCalculators: z.array(z.string().max(64)).max(20).optional() }).optional())
    .query(async ({ ctx, input }) => {
      return recommendStudyContent(ctx.user.id, input?.recentCalculators ?? []);
    }),
});

// ── FSRS-5 subrouter (P0-1) ──────────────────────────────────────────────
const fsrs5Router = router({
  review: protectedProcedure
    .input(z.object({
      itemKey: z.string(),
      itemType: z.enum(["flashcard", "question"]),
      rating: z.number().int().min(1).max(4),
    }))
    .mutation(async ({ ctx, input }) => {
      await recordStreakActivity(ctx.user.id);
      const result = await fsrs5ProcessReview(ctx.user.id, input.itemKey, input.itemType, input.rating as 1|2|3|4);
      if (!result) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Review failed" });
      return result;
    }),
  dueCards: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      return fsrs5GetDueCards(ctx.user.id, input?.limit ?? 20);
    }),
  stats: protectedProcedure.query(async ({ ctx }) => {
    return fsrs5GetReviewStats(ctx.user.id);
  }),
});

// ── Assessment subrouter (P0-3) ──────────────────────────────────────────
const assessmentRouter = router({
  start: protectedProcedure
    .input(z.object({
      assessmentType: z.enum(["quiz", "exam", "smartcase", "capstone"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const session = await startAssessmentSession(ctx.user.id, input.assessmentType);
      if (!session) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to start session" });
      return session;
    }),
  active: protectedProcedure.query(async ({ ctx }) => {
    return getActiveSession(ctx.user.id);
  }),
  complete: protectedProcedure
    .input(z.object({
      sessionId: z.number().int(),
      score: z.number(),
      maxScore: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const session = await completeAssessmentSession(ctx.user.id, input.sessionId, input.score, input.maxScore);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      return session;
    }),
  abandon: protectedProcedure
    .input(z.object({ sessionId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await abandonAssessmentSession(ctx.user.id, input.sessionId);
      return { ok: true };
    }),
  focusLoss: protectedProcedure.mutation(async ({ ctx }) => {
    await recordFocusLoss(ctx.user.id);
    return { ok: true };
  }),
  history: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      return getSessionHistory(ctx.user.id, input?.limit ?? 20);
    }),
  isBlocked: protectedProcedure.query(async ({ ctx }) => {
    return { blocked: await isAiBlocked(ctx.user.id) };
  }),
});

// ── Streaks subrouter (P0-5) ─────────────────────────────────────────────
const streaksRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    return getOrCreateStreak(ctx.user.id);
  }),
  record: protectedProcedure.mutation(async ({ ctx }) => {
    return recordStreakActivity(ctx.user.id);
  }),
  updateSettings: protectedProcedure
    .input(z.object({
      dailyGoalMinutes: z.number().int().min(1).max(480).optional(),
      nudgeEnabled: z.boolean().optional(),
      nudgeTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return updateStreakSettings(ctx.user.id, input);
    }),
  atRisk: protectedProcedure.query(async ({ ctx }) => {
    return { atRisk: await isStreakAtRisk(ctx.user.id) };
  }),
});

// ── P1-2: Lesson Graph + Mastery Gating subrouter ──────────────────────

const lessonGraphRouter = router({
  getGraph: protectedProcedure
    .input(z.object({ trackId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      return getLessonGraph(ctx.user.id, input.trackId);
    }),
  isUnlocked: protectedProcedure
    .input(z.object({ chapterId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      return { unlocked: await isChapterUnlocked(ctx.user.id, input.chapterId) };
    }),
  nextUnlockable: protectedProcedure
    .input(z.object({ trackId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      return getNextUnlockable(ctx.user.id, input.trackId);
    }),
  addPrerequisite: adminProcedure
    .input(z.object({
      chapterId: z.number().int().positive(),
      prerequisiteChapterId: z.number().int().positive(),
      minMasteryScore: z.number().min(0).max(1).default(0.7),
    }))
    .mutation(async ({ input }) => {
      await addPrerequisite(input.chapterId, input.prerequisiteChapterId, input.minMasteryScore);
      return { ok: true };
    }),
  removePrerequisite: adminProcedure
    .input(z.object({
      chapterId: z.number().int().positive(),
      prerequisiteChapterId: z.number().int().positive(),
    }))
    .mutation(async ({ input }) => {
      await removePrerequisite(input.chapterId, input.prerequisiteChapterId);
      return { ok: true };
    }),
});

// ── P1-5: Office Hours subrouter ───────────────────────────────────────

const officeHoursRouter = router({
  upcoming: protectedProcedure
    .input(z.object({ trackId: z.number().int().positive().optional(), limit: z.number().int().min(1).max(50).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      return listUpcomingOfficeHours({ trackId: input?.trackId, userId: ctx.user.id, limit: input?.limit });
    }),
  past: protectedProcedure
    .input(z.object({ trackId: z.number().int().positive().optional(), limit: z.number().int().min(1).max(50).default(20) }).optional())
    .query(async ({ input }) => {
      return listPastOfficeHours({ trackId: input?.trackId, limit: input?.limit });
    }),
  register: protectedProcedure
    .input(z.object({ officeHourId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      return registerForOfficeHour(input.officeHourId, ctx.user.id);
    }),
  cancelRegistration: protectedProcedure
    .input(z.object({ officeHourId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      return cancelOfficeHourRegistration(input.officeHourId, ctx.user.id);
    }),
  myRegistrations: protectedProcedure.query(async ({ ctx }) => {
    return getMyOfficeHourRegistrations(ctx.user.id);
  }),
  create: adminProcedure
    .input(z.object({
      title: z.string().min(1).max(256),
      description: z.string().optional(),
      trackId: z.number().int().positive().optional(),
      scheduledAt: z.coerce.date(),
      durationMinutes: z.number().int().min(15).max(480).default(60),
      maxAttendees: z.number().int().min(1).max(500).default(20),
      meetingUrl: z.string().url().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = await createOfficeHour({ ...input, hostUserId: ctx.user.id });
      return { id };
    }),
  updateStatus: adminProcedure
    .input(z.object({
      sessionId: z.number().int().positive(),
      status: z.enum(["scheduled", "live", "completed", "cancelled"]),
      meetingUrl: z.string().url().optional(),
      recordingUrl: z.string().url().optional(),
    }))
    .mutation(async ({ input }) => {
      await updateOfficeHourStatus(input.sessionId, input.status, { meetingUrl: input.meetingUrl, recordingUrl: input.recordingUrl });
      return { ok: true };
    }),
  registrations: adminProcedure
    .input(z.object({ officeHourId: z.number().int().positive() }))
    .query(async ({ input }) => {
      return getOfficeHourRegistrations(input.officeHourId);
    }),
  consent: protectedProcedure
    .input(z.object({
      sessionId: z.number().int().positive(),
      consentType: z.enum(["recording", "transcript", "both"]).default("both"),
      granted: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      return recordConsent({
        sessionId: input.sessionId,
        participantId: String(ctx.user.id),
        consentType: input.consentType,
        granted: input.granted,
        timestamp: Date.now(),
      });
    }),
  checkConsent: adminProcedure
    .input(z.object({ sessionId: z.number().int().positive() }))
    .query(async ({ input }) => {
      return checkAllConsented(input.sessionId);
    }),
  saveTranscript: adminProcedure
    .input(z.object({
      sessionId: z.number().int().positive(),
      segments: z.array(z.object({
        speaker: z.string(),
        text: z.string(),
        startMs: z.number(),
        endMs: z.number(),
      })),
      duration: z.number().int().positive(),
      participantCount: z.number().int().positive(),
      topic: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return persistTranscript(input.sessionId, input.segments, {
        duration: input.duration,
        participantCount: input.participantCount,
        topic: input.topic,
      });
    }),
});

// ── CE Credits subrouter (P1-3) ─────────────────────────────────────────

const ceCreditsRouter = router({
  issue: protectedProcedure
    .input(z.object({
      trackId: z.number().int(),
      creditsEarned: z.number().min(0).max(100),
      creditType: z.enum(["self_serve", "partnership"]).optional(),
      notes: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return issueCeCredit({ userId: ctx.user.id, ...input });
    }),
  revoke: adminProcedure
    .input(z.object({ creditId: z.number().int(), reason: z.string().min(1).max(500) }))
    .mutation(async ({ input }) => {
      return revokeCeCredit(input.creditId, input.reason);
    }),
  list: protectedProcedure.query(async ({ ctx }) => {
    return listUserCredits(ctx.user.id);
  }),
  summary: protectedProcedure.query(async ({ ctx }) => {
    return getCreditSummary(ctx.user.id);
  }),
  verify: protectedProcedure
    .input(z.object({ creditId: z.number().int() }))
    .query(async ({ input }) => {
      return verifyCeCredit(input.creditId);
    }),
  certificate: protectedProcedure
    .input(z.object({ creditId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const credit = await verifyCeCredit(input.creditId);
      if (!credit.valid || !credit.credit) throw new TRPCError({ code: "NOT_FOUND", message: "Credit not found or invalid" });
      if (credit.credit.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Not your credit" });
      return generateCeCertificatePdf({
        // @ts-expect-error — excess property in object literal
        creditId: input.creditId,
        userId: ctx.user.id,
        userName: ctx.user.name ?? "Learner",
        trackTitle: `Track #${credit.credit.trackId}`,
        creditsEarned: parseFloat(credit.credit.creditsEarned),
        issuedAt: credit.credit.issuedAt?.toISOString() ?? new Date().toISOString(),
        issuer: credit.credit.issuer ?? "Stewardly Learning Platform",
      });
    }),
});

// ── Peer Groups subrouter (P1-4) ────────────────────────────────────────

const peerGroupsRouter = router({
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(200),
      description: z.string().max(1000).optional(),
      trackId: z.number().int().optional(),
      maxMembers: z.number().int().min(2).max(100).optional(),
      requiredRole: z.string().max(30).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return createGroup({ ...input, createdBy: ctx.user.id });
    }),
  join: protectedProcedure
    .input(z.object({ groupId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      return joinGroup(input.groupId, ctx.user.id, ctx.user.role);
    }),
  leave: protectedProcedure
    .input(z.object({ groupId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      return leaveGroup(input.groupId, ctx.user.id);
    }),
  list: protectedProcedure
    .input(z.object({ trackId: z.number().int().optional() }).optional())
    .query(async ({ input }) => {
      return listGroups(input?.trackId);
    }),
  members: protectedProcedure
    .input(z.object({ groupId: z.number().int() }))
    .query(async ({ input }) => {
      return getGroupMembers(input.groupId);
    }),
  postMessage: protectedProcedure
    .input(z.object({ groupId: z.number().int(), content: z.string().min(1).max(5000) }))
    .mutation(async ({ ctx, input }) => {
      return postGroupMessage(input.groupId, ctx.user.id, input.content);
    }),
  messages: protectedProcedure
    .input(z.object({ groupId: z.number().int(), limit: z.number().int().min(1).max(200).optional() }))
    .query(async ({ input }) => {
      return getGroupMessages(input.groupId, input.limit);
    }),
  myGroups: protectedProcedure.query(async ({ ctx }) => {
    return getMyGroups(ctx.user.id);
  }),
  prescreen: protectedProcedure
    .input(z.object({ content: z.string().min(1).max(5000) }))
    .query(async ({ ctx, input }) => {
      const result = prescreenContent(input.content);
      return { ...result, isAdvisor: isAdvisorOrAbove(ctx.user.role ?? "user") };
    }),
});

// ── Root learning router ─────────────────────────────────────────────────

export const learningRouter = router({
  mastery: masteryRouter,
  licenses: licensesRouter,
  content: contentRouter,
  freshness: freshnessRouter,
  recommendations: recommendationsRouter,
  fsrs5: fsrs5Router,
  assessment: assessmentRouter,
  streaks: streaksRouter,
  lessonGraph: lessonGraphRouter,
  officeHours: officeHoursRouter,
  ceCredits: ceCreditsRouter,
  peerGroups: peerGroupsRouter,

  // ── Study Analytics (uses analyticsAggregation pure functions) ──────────
  studyAnalytics: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(500).default(100) }))
    .query(async ({ ctx, input }) => {
      const { getDb: getDbFn } = await import("../db");
      const { learningStudySessions } = await import("../../drizzle/schema");
      const { eq, desc } = await import("drizzle-orm");
      const db = await getDbFn();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const rows = await db
        .select()
        .from(learningStudySessions)
        .where(eq(learningStudySessions.userId, ctx.user.id))
        .orderBy(desc(learningStudySessions.createdAt))
        .limit(input.limit);

      // Map DB rows → StudySessionRecord shape expected by analyticsAggregation
      const sessions = rows.map((r: any) => ({
        id: String(r.id),
        userId: r.userId,
        startedAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
        durationSec: (r.durationMinutes ?? 0) * 60,
        questionsAttempted: r.itemsStudied ?? 0,
        questionsCorrect: r.itemsMastered ?? 0,
        topic: r.discipline ?? r.trackKey ?? "general",
        difficulty: 3,
      }));

      const {
        analyzeTrends,
        buildTopicMastery,
        generateEfficiencyReport,
      } = await import("../services/learning/analyticsAggregation");

      return {
        sessionCount: sessions.length,
        trends: analyzeTrends(sessions),
        topicMastery: buildTopicMastery(sessions),
        efficiency: generateEfficiencyReport(sessions),
      };
    }),

  /**
   * Activity Calendar — returns daily study session counts for the past N days.
   * Used by the GitHub-style contribution heatmap in StudyAnalytics.
   */
  activityCalendar: protectedProcedure
    .input(z.object({ days: z.number().int().min(30).max(400).default(365) }).optional())
    .query(async ({ ctx, input }) => {
      const { getDb: getDbFn } = await import("../db");
      const { learningStudySessions } = await import("../../drizzle/schema");
      const { sql } = await import("drizzle-orm");
      const db = await getDbFn();
      if (!db) return [];
      const days = input?.days ?? 365;
      const cutoff = new Date(Date.now() - days * 86400000);
      const rows = await db
        .select({
          date: sql<string>`DATE(${learningStudySessions.createdAt})`.as("date"),
          count: sql<number>`COUNT(*)`.as("count"),
          minutes: sql<number>`COALESCE(SUM(${learningStudySessions.durationMinutes}), 0)`.as("minutes"),
        })
        .from(learningStudySessions)
        .where(
          sql`${learningStudySessions.userId} = ${ctx.user.id} AND ${learningStudySessions.createdAt} >= ${cutoff}`,
        )
        .groupBy(sql`DATE(${learningStudySessions.createdAt})`)
        .orderBy(sql`DATE(${learningStudySessions.createdAt})`);
      return rows.map((r: any) => ({
        date: String(r.date),
        count: Number(r.count),
        minutes: Number(r.minutes),
      }));
    }),

  // Admin-only seed
  seed: adminProcedure.mutation(async ({ ctx }) => {
    if (!canSeedContent({ id: ctx.user.id, role: (ctx.user.role as any) ?? "user" })) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Seeding is admin-only" });
    }
    return seedLearningContent();
  }),

  // Admin-only full content import from the mwpenn94/emba_modules
  // GitHub repo. Idempotent — can be re-run safely to pick up new
  // definitions / questions / flashcards added to the source repo
  // without redeploying.
  importFromGitHub: adminProcedure.mutation(async ({ ctx }) => {
    if (!canSeedContent({ id: ctx.user.id, role: (ctx.user.role as any) ?? "user" })) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Import is admin-only" });
    }
    return importEMBAFromGitHub();
  }),

  // Pass 4 (build loop) — observability for admin Content Studio.
  //
  // Returns the persisted import-run history (newest first, capped at
  // 50 runs) plus an aggregate summary. Reads from
  // `.stewardly/learning_import_history.json` so it works whether or
  // not the DB is available.
  importHistory: adminProcedure.query(async ({ ctx }) => {
    if (!canSeedContent({ id: ctx.user.id, role: (ctx.user.role as any) ?? "user" })) {
      throw new TRPCError({ code: "FORBIDDEN", message: "History is admin-only" });
    }
    const history = await loadImportHistory();
    return {
      runs: history.runs,
      summary: summarizeHistory(history),
    };
  }),

  /**
   * AI Content Generation — bulk-generate practice questions and flashcards
   * for tracks with thin coverage. Admin-only, idempotent.
   */
  generateContent: adminProcedure
    .input(z.object({
      trackId: z.number().optional(),
      questionTarget: z.number().default(50),
      flashcardTarget: z.number().default(30),
    }).optional())
    .mutation(async ({ ctx }) => {
      const { generateQuestionsForTrack, generateFlashcardsForTrack } = await import("../services/learningContentGenerator");
      const { getDb: getDbFn } = await import("../db");
      const { learningTracks, learningChapters, learningPracticeQuestions, learningFlashcards } = await import("../../drizzle/schema");
      const { sql } = await import("drizzle-orm");
      const db = await getDbFn();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Get all tracks with their chapters and current counts
      const tracks = await db.select().from(learningTracks);
      const chapters = await db.select().from(learningChapters);
      const questions = await db.select({
        trackId: learningPracticeQuestions.trackId,
        count: sql<number>`COUNT(*)`,
      }).from(learningPracticeQuestions).groupBy(learningPracticeQuestions.trackId);
      const flashcards = await db.select({
        trackId: learningFlashcards.trackId,
        count: sql<number>`COUNT(*)`,
      }).from(learningFlashcards).groupBy(learningFlashcards.trackId);

      const qCountMap = Object.fromEntries(questions.map(q => [q.trackId, q.count]));
      const fcCountMap = Object.fromEntries(flashcards.map(f => [f.trackId, f.count]));
      const chaptersByTrack = chapters.reduce((acc, ch) => {
        const tid = ch.trackId;
        if (tid) { acc[tid] = acc[tid] || []; acc[tid].push(ch); }
        return acc;
      }, {} as Record<number, typeof chapters>);

      const results: { trackSlug: string; questionsAdded: number; flashcardsAdded: number }[] = [];

      for (const track of tracks) {
        const existingQ = qCountMap[track.id] || 0;
        const existingFC = fcCountMap[track.id] || 0;
        const trackChapters = chaptersByTrack[track.id] || [];
        const chapterNames = trackChapters.map(c => c.title || c.slug || `Chapter ${c.sortOrder}`);

        if (existingQ >= 50 && existingFC >= 30) {
          results.push({ trackSlug: track.slug, questionsAdded: 0, flashcardsAdded: 0 });
          continue;
        }

        let questionsAdded = 0;
        let flashcardsAdded = 0;

        // Generate questions if needed
        if (existingQ < 50) {
          const generated = await generateQuestionsForTrack(
            track.name || track.slug, track.slug, chapterNames, existingQ, 50,
          );
          if (generated.length > 0) {
            const chapterIds = trackChapters.map(c => c.id);
            for (const q of generated) {
              const chId = chapterIds.length > 0 ? chapterIds[Math.floor(Math.random() * chapterIds.length)] : null;
              await db.insert(learningPracticeQuestions).values({
                trackId: track.id,
                chapterId: chId,
                prompt: q.prompt,
                options: q.options,
                correctIndex: q.correctIndex,
                explanation: q.explanation,
                difficulty: q.difficulty,
                tags: q.tags,
                source: "ai_generated",
                status: "published",
              });
            }
            questionsAdded = generated.length;
          }
        }

        // Generate flashcards if needed
        if (existingFC < 30) {
          const generated = await generateFlashcardsForTrack(
            track.name || track.slug, track.slug, chapterNames, existingFC, 30,
          );
          if (generated.length > 0) {
            const chapterIds = trackChapters.map(c => c.id);
            for (const fc of generated) {
              const chId = chapterIds.length > 0 ? chapterIds[Math.floor(Math.random() * chapterIds.length)] : null;
              await db.insert(learningFlashcards).values({
                trackId: track.id,
                chapterId: chId,
                term: fc.term,
                definition: fc.definition,
                sourceLabel: `AI-generated for ${track.slug}`,
                source: "ai_generated",
                status: "published",
                tags: fc.tags,
              });
            }
            flashcardsAdded = generated.length;
          }
        }

        results.push({ trackSlug: track.slug, questionsAdded, flashcardsAdded });
      }

      return {
        totalQuestionsAdded: results.reduce((s, r) => s + r.questionsAdded, 0),
        totalFlashcardsAdded: results.reduce((s, r) => s + r.flashcardsAdded, 0),
        perTrack: results,
      };
    }),
});
