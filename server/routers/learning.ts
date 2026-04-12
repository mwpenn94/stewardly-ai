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
import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import type { ActingUser } from "../services/learning/permissions";
import { assertCanEdit, canPublish, canSeedContent } from "../services/learning/permissions";

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
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const row = await upsertMastery({
        userId: ctx.user.id,
        itemKey: input.itemKey,
        itemType: input.itemType,
        correct: input.correct,
      });
      return { ok: row !== null };
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
      const limit = input?.limit ?? 20;
      const newQuota = input?.newQuota ?? 10;
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
  listTracks: protectedProcedure
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

  getTrack: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => getTrack(input.id)),

  getTrackBySlug: protectedProcedure
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
  listChapters: protectedProcedure
    .input(z.object({ trackId: z.number().int() }))
    .query(async ({ input }) => listChaptersForTrack(input.trackId)),

  listSubsections: protectedProcedure
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
  listQuestions: protectedProcedure
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
  listFlashcards: protectedProcedure
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

// ── Root learning router ─────────────────────────────────────────────────

export const learningRouter = router({
  mastery: masteryRouter,
  licenses: licensesRouter,
  content: contentRouter,
  freshness: freshnessRouter,
  recommendations: recommendationsRouter,

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
});
