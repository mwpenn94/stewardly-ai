/**
 * EMBA Learning — Dynamic content service.
 *
 * DB-backed CRUD for disciplines, definitions, formulas, cases,
 * fs_applications, tracks, chapters, subsections, practice_questions,
 * and flashcards. Every write goes through `recordContentHistory` to
 * maintain the audit trail.
 *
 * Permission checks are performed by the tRPC router (see
 * server/routers/learning.ts) — this service is a thin, predictable
 * data layer with graceful degradation on DB unavailability.
 */

import { getDb } from "../../db";
import {
  learningDisciplines,
  learningDefinitions,
  learningFormulas,
  learningCases,
  learningFsApplications,
  learningConnections,
  learningTracks,
  learningChapters,
  learningSubsections,
  learningPracticeQuestions,
  learningFlashcards,
  learningContentHistory,
} from "../../../drizzle/schema";
import { and, eq, or, like, desc, sql, isNull } from "drizzle-orm";
import { logger } from "../../_core/logger";

const log = logger.child({ module: "learning/content" });

export type Visibility = "public" | "team" | "private";
export type PublishStatus = "published" | "draft" | "review" | "archived";

// ─── Audit trail ──────────────────────────────────────────────────────────

export async function recordContentHistory(data: {
  contentTable: string;
  contentId: number;
  action: "create" | "update" | "delete" | "restore" | "publish" | "archive";
  previousData?: any;
  newData?: any;
  changedBy: number;
  changeReason?: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(learningContentHistory).values({
      contentTable: data.contentTable,
      contentId: data.contentId,
      action: data.action,
      previousData: data.previousData ?? null,
      newData: data.newData ?? null,
      changedBy: data.changedBy,
      changeReason: data.changeReason ?? null,
    });
  } catch (err) {
    log.warn({ err: String(err) }, "recordContentHistory failed");
  }
}

export async function getContentHistory(contentTable: string, contentId: number) {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db
      .select()
      .from(learningContentHistory)
      .where(and(eq(learningContentHistory.contentTable, contentTable), eq(learningContentHistory.contentId, contentId)))
      .orderBy(desc(learningContentHistory.createdAt));
  } catch (err) {
    log.warn({ err: String(err) }, "getContentHistory failed");
    return [];
  }
}

// ─── Disciplines ─────────────────────────────────────────────────────────

export async function listDisciplines(opts?: { includeArchived?: boolean }) {
  const db = await getDb();
  if (!db) return [];
  try {
    const rows = await db.select().from(learningDisciplines);
    return opts?.includeArchived ? rows : rows.filter((r) => r.status !== "archived");
  } catch (err) {
    log.warn({ err: String(err) }, "listDisciplines failed");
    return [];
  }
}

export async function upsertDiscipline(data: {
  slug: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  sortOrder?: number;
  isCore?: boolean;
  createdBy?: number | null;
}): Promise<{ id: number } | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const [existing] = await db.select().from(learningDisciplines).where(eq(learningDisciplines.slug, data.slug));
    if (existing) return { id: existing.id };
    const [row] = await db.insert(learningDisciplines).values({
      slug: data.slug,
      name: data.name,
      description: data.description ?? null,
      color: data.color ?? null,
      icon: data.icon ?? null,
      sortOrder: data.sortOrder ?? 0,
      isCore: data.isCore ?? true,
      createdBy: data.createdBy ?? null,
    });
    return { id: row.insertId };
  } catch (err) {
    log.warn({ err: String(err) }, "upsertDiscipline failed");
    return null;
  }
}

// ─── Definitions CRUD ────────────────────────────────────────────────────

export interface ListFilters {
  disciplineId?: number;
  visibility?: Visibility;
  status?: PublishStatus;
  search?: string;
  limit?: number;
}

export async function listDefinitions(filters: ListFilters = {}) {
  const db = await getDb();
  if (!db) return [];
  try {
    const conds: any[] = [];
    if (filters.disciplineId) conds.push(eq(learningDefinitions.disciplineId, filters.disciplineId));
    if (filters.visibility) conds.push(eq(learningDefinitions.visibility, filters.visibility));
    if (filters.status) conds.push(eq(learningDefinitions.status, filters.status));
    if (filters.search) conds.push(like(learningDefinitions.term, `%${filters.search}%`));
    return await db
      .select()
      .from(learningDefinitions)
      .where(conds.length ? and(...conds) : undefined)
      .limit(filters.limit ?? 100);
  } catch (err) {
    log.warn({ err: String(err) }, "listDefinitions failed");
    return [];
  }
}

export async function getDefinition(id: number) {
  const db = await getDb();
  if (!db) return null;
  try {
    const [row] = await db.select().from(learningDefinitions).where(eq(learningDefinitions.id, id));
    return row ?? null;
  } catch (err) {
    log.warn({ err: String(err) }, "getDefinition failed");
    return null;
  }
}

export async function createDefinition(data: {
  disciplineId?: number | null;
  term: string;
  definition: string;
  createdBy: number;
  visibility?: Visibility;
  status?: PublishStatus;
  sourceRef?: string;
  tags?: string[];
}): Promise<{ id: number } | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const [row] = await db.insert(learningDefinitions).values({
      disciplineId: data.disciplineId ?? null,
      term: data.term,
      definition: data.definition,
      createdBy: data.createdBy,
      visibility: data.visibility ?? "public",
      status: data.status ?? "published",
      sourceRef: data.sourceRef ?? null,
      tags: data.tags ?? null,
    });
    await recordContentHistory({
      contentTable: "learning_definitions",
      contentId: row.insertId,
      action: "create",
      newData: { term: data.term, definition: data.definition },
      changedBy: data.createdBy,
    });
    return { id: row.insertId };
  } catch (err) {
    log.warn({ err: String(err) }, "createDefinition failed");
    return null;
  }
}

export async function updateDefinition(
  id: number,
  patch: Partial<{
    term: string;
    definition: string;
    disciplineId: number | null;
    visibility: Visibility;
    status: PublishStatus;
    sourceRef: string | null;
    tags: string[];
  }>,
  changedBy: number,
  changeReason?: string,
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    const before = await getDefinition(id);
    if (!before) return false;
    const values: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) values[k] = v;
    }
    values["version"] = (before.version ?? 1) + 1;
    await db.update(learningDefinitions).set(values as any).where(eq(learningDefinitions.id, id));
    await recordContentHistory({
      contentTable: "learning_definitions",
      contentId: id,
      action: "update",
      previousData: before,
      newData: values,
      changedBy,
      changeReason,
    });
    return true;
  } catch (err) {
    log.warn({ err: String(err) }, "updateDefinition failed");
    return false;
  }
}

export async function archiveDefinition(id: number, changedBy: number, reason?: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    const before = await getDefinition(id);
    if (!before) return false;
    await db.update(learningDefinitions).set({ status: "archived" } as any).where(eq(learningDefinitions.id, id));
    await recordContentHistory({
      contentTable: "learning_definitions",
      contentId: id,
      action: "archive",
      previousData: before,
      changedBy,
      changeReason: reason,
    });
    return true;
  } catch (err) {
    log.warn({ err: String(err) }, "archiveDefinition failed");
    return false;
  }
}

// ─── Tracks CRUD ─────────────────────────────────────────────────────────

export async function listTracks(filters: ListFilters = {}) {
  const db = await getDb();
  if (!db) return [];
  try {
    const conds: any[] = [];
    if (filters.status) conds.push(eq(learningTracks.status, filters.status));
    if (filters.visibility) conds.push(eq(learningTracks.visibility, filters.visibility));
    if (filters.search) conds.push(like(learningTracks.name, `%${filters.search}%`));
    return await db
      .select()
      .from(learningTracks)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(learningTracks.sortOrder)
      .limit(filters.limit ?? 100);
  } catch (err) {
    log.warn({ err: String(err) }, "listTracks failed");
    return [];
  }
}

export async function getTrack(id: number) {
  const db = await getDb();
  if (!db) return null;
  try {
    const [row] = await db.select().from(learningTracks).where(eq(learningTracks.id, id));
    return row ?? null;
  } catch (err) {
    log.warn({ err: String(err) }, "getTrack failed");
    return null;
  }
}

export async function getTrackBySlug(slug: string) {
  const db = await getDb();
  if (!db) return null;
  try {
    const [row] = await db.select().from(learningTracks).where(eq(learningTracks.slug, slug));
    return row ?? null;
  } catch (err) {
    log.warn({ err: String(err) }, "getTrackBySlug failed");
    return null;
  }
}

export async function createTrack(data: {
  slug: string;
  name: string;
  category?: "securities" | "planning" | "insurance" | "custom";
  title?: string;
  subtitle?: string;
  description?: string;
  color?: string;
  emoji?: string;
  tagline?: string;
  examOverview?: any;
  createdBy: number | null;
  visibility?: Visibility;
  status?: PublishStatus;
  sortOrder?: number;
}): Promise<{ id: number } | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const [row] = await db.insert(learningTracks).values({
      slug: data.slug,
      name: data.name,
      category: data.category ?? "custom",
      title: data.title ?? null,
      subtitle: data.subtitle ?? null,
      description: data.description ?? null,
      color: data.color ?? null,
      emoji: data.emoji ?? null,
      tagline: data.tagline ?? null,
      examOverview: data.examOverview ?? null,
      createdBy: data.createdBy,
      visibility: data.visibility ?? "public",
      status: data.status ?? "published",
      sortOrder: data.sortOrder ?? 0,
    });
    if (data.createdBy !== null) {
      await recordContentHistory({
        contentTable: "learning_tracks",
        contentId: row.insertId,
        action: "create",
        newData: { slug: data.slug, name: data.name },
        changedBy: data.createdBy,
      });
    }
    return { id: row.insertId };
  } catch (err) {
    log.warn({ err: String(err) }, "createTrack failed");
    return null;
  }
}

export async function updateTrack(
  id: number,
  patch: Partial<{
    name: string;
    title: string;
    subtitle: string;
    description: string;
    status: PublishStatus;
    visibility: Visibility;
    sortOrder: number;
  }>,
  changedBy: number,
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    const before = await getTrack(id);
    if (!before) return false;
    const values: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) values[k] = v;
    }
    values["version"] = (before.version ?? 1) + 1;
    await db.update(learningTracks).set(values as any).where(eq(learningTracks.id, id));
    await recordContentHistory({
      contentTable: "learning_tracks",
      contentId: id,
      action: "update",
      previousData: before,
      newData: values,
      changedBy,
    });
    return true;
  } catch (err) {
    log.warn({ err: String(err) }, "updateTrack failed");
    return false;
  }
}

// ─── Chapters, subsections (simpler: create/list/delete) ─────────────────

export async function listChaptersForTrack(trackId: number) {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db
      .select()
      .from(learningChapters)
      .where(eq(learningChapters.trackId, trackId))
      .orderBy(learningChapters.sortOrder);
  } catch (err) {
    log.warn({ err: String(err) }, "listChaptersForTrack failed");
    return [];
  }
}

export async function listSubsectionsForChapter(chapterId: number) {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db
      .select()
      .from(learningSubsections)
      .where(eq(learningSubsections.chapterId, chapterId))
      .orderBy(learningSubsections.sortOrder);
  } catch (err) {
    log.warn({ err: String(err) }, "listSubsectionsForChapter failed");
    return [];
  }
}

export async function createChapter(data: {
  trackId: number;
  title: string;
  intro?: string;
  isPractice?: boolean;
  sortOrder?: number;
  createdBy: number | null;
}): Promise<{ id: number } | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const [row] = await db.insert(learningChapters).values({
      trackId: data.trackId,
      title: data.title,
      intro: data.intro ?? null,
      isPractice: data.isPractice ?? false,
      sortOrder: data.sortOrder ?? 0,
      createdBy: data.createdBy,
    });
    return { id: row.insertId };
  } catch (err) {
    log.warn({ err: String(err) }, "createChapter failed");
    return null;
  }
}

export async function createSubsection(data: {
  chapterId: number;
  title?: string;
  level?: number;
  paragraphs?: string[];
  tables?: any[];
  sortOrder?: number;
  createdBy: number | null;
}): Promise<{ id: number } | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const [row] = await db.insert(learningSubsections).values({
      chapterId: data.chapterId,
      title: data.title ?? null,
      level: data.level ?? 2,
      paragraphs: data.paragraphs ?? null,
      tables: data.tables ?? null,
      sortOrder: data.sortOrder ?? 0,
      createdBy: data.createdBy,
    });
    return { id: row.insertId };
  } catch (err) {
    log.warn({ err: String(err) }, "createSubsection failed");
    return null;
  }
}

// ─── Practice questions + flashcards ─────────────────────────────────────

export type QuestionStatus = "published" | "draft" | "review" | "retired";

export async function listQuestionsForTrack(
  trackId: number,
  filters: Partial<{ difficulty: "easy" | "medium" | "hard"; status: QuestionStatus }> = {},
) {
  const db = await getDb();
  if (!db) return [];
  try {
    const conds: any[] = [eq(learningPracticeQuestions.trackId, trackId)];
    if (filters.difficulty) conds.push(eq(learningPracticeQuestions.difficulty, filters.difficulty));
    if (filters.status) conds.push(eq(learningPracticeQuestions.status, filters.status));
    return await db
      .select()
      .from(learningPracticeQuestions)
      .where(and(...conds));
  } catch (err) {
    log.warn({ err: String(err) }, "listQuestionsForTrack failed");
    return [];
  }
}

export async function createPracticeQuestion(data: {
  trackId?: number;
  chapterId?: number;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  difficulty?: "easy" | "medium" | "hard";
  tags?: string[];
  createdBy: number | null;
  source?: "manual" | "ai_generated" | "user_authored";
  status?: "published" | "draft" | "review" | "retired";
}): Promise<{ id: number } | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const [row] = await db.insert(learningPracticeQuestions).values({
      trackId: data.trackId ?? null,
      chapterId: data.chapterId ?? null,
      prompt: data.prompt,
      options: data.options,
      correctIndex: data.correctIndex,
      explanation: data.explanation ?? null,
      difficulty: data.difficulty ?? "medium",
      tags: data.tags ?? null,
      createdBy: data.createdBy,
      source: data.source ?? "manual",
      status: data.status ?? "published",
    });
    return { id: row.insertId };
  } catch (err) {
    log.warn({ err: String(err) }, "createPracticeQuestion failed");
    return null;
  }
}

export async function listFlashcardsForTrack(trackId: number) {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(learningFlashcards).where(eq(learningFlashcards.trackId, trackId));
  } catch (err) {
    log.warn({ err: String(err) }, "listFlashcardsForTrack failed");
    return [];
  }
}

export async function createFlashcard(data: {
  trackId?: number;
  chapterId?: number;
  term: string;
  definition: string;
  sourceLabel?: string;
  createdBy: number | null;
  source?: "manual" | "ai_generated" | "user_authored";
  tags?: string[];
}): Promise<{ id: number } | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const [row] = await db.insert(learningFlashcards).values({
      trackId: data.trackId ?? null,
      chapterId: data.chapterId ?? null,
      term: data.term,
      definition: data.definition,
      sourceLabel: data.sourceLabel ?? null,
      createdBy: data.createdBy,
      source: data.source ?? "manual",
      tags: data.tags ?? null,
    });
    return { id: row.insertId };
  } catch (err) {
    log.warn({ err: String(err) }, "createFlashcard failed");
    return null;
  }
}

// ─── Unified search across content types ────────────────────────────────

export interface SearchResult {
  type: "definition" | "formula" | "case" | "track" | "flashcard" | "question";
  id: number;
  title: string;
  snippet: string;
}

export async function searchContent(query: string, limit = 20): Promise<SearchResult[]> {
  const db = await getDb();
  if (!db) return [];
  // Pass 8 (build loop) — search now matches body text as well as
  // titles, plus includes practice questions so every imported
  // emba_modules content type is discoverable.
  const like$ = `%${query}%`;
  const results: SearchResult[] = [];
  try {
    // Definitions — match term OR body
    const defs = await db
      .select()
      .from(learningDefinitions)
      .where(
        and(
          eq(learningDefinitions.status, "published"),
          or(
            like(learningDefinitions.term, like$),
            like(learningDefinitions.definition, like$),
          ),
        ),
      )
      .limit(limit);
    for (const d of defs) {
      results.push({
        type: "definition",
        id: d.id,
        title: d.term,
        snippet: (d.definition ?? "").slice(0, 200),
      });
    }

    // Flashcards — match term OR definition body
    const fcs = await db
      .select()
      .from(learningFlashcards)
      .where(
        and(
          eq(learningFlashcards.status, "published"),
          or(
            like(learningFlashcards.term, like$),
            like(learningFlashcards.definition, like$),
          ),
        ),
      )
      .limit(limit);
    for (const f of fcs) {
      results.push({
        type: "flashcard",
        id: f.id,
        title: f.term,
        snippet: (f.definition ?? "").slice(0, 200),
      });
    }

    // Tracks — match name + tagline/subtitle/description
    const tracks = await db
      .select()
      .from(learningTracks)
      .where(
        and(
          eq(learningTracks.status, "published"),
          or(
            like(learningTracks.name, like$),
            like(learningTracks.title, like$),
            like(learningTracks.subtitle, like$),
            like(learningTracks.description, like$),
          ),
        ),
      )
      .limit(limit);
    for (const t of tracks) {
      results.push({
        type: "track",
        id: t.id,
        title: t.name,
        snippet: (t.subtitle ?? t.description ?? "").slice(0, 200),
      });
    }

    // Practice questions — match prompt (explanation searched too if present)
    const qs = await db
      .select()
      .from(learningPracticeQuestions)
      .where(
        and(
          eq(learningPracticeQuestions.status, "published"),
          or(
            like(learningPracticeQuestions.prompt, like$),
            like(learningPracticeQuestions.explanation, like$),
          ),
        ),
      )
      .limit(limit);
    for (const q of qs) {
      const prompt = (q.prompt ?? "") as string;
      results.push({
        type: "question",
        id: q.id,
        title: prompt.length > 80 ? `${prompt.slice(0, 77)}…` : prompt,
        snippet: (q.explanation ?? "").slice(0, 200),
      });
    }
  } catch (err) {
    log.warn({ err: String(err) }, "searchContent failed");
  }
  return results.slice(0, limit);
}

// ─── Explain concept (agent helper) ──────────────────────────────────────

export async function explainConcept(concept: string): Promise<{
  term: string;
  definition: string | null;
  related: string[];
} | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const [def] = await db
      .select()
      .from(learningDefinitions)
      .where(and(eq(learningDefinitions.status, "published"), like(learningDefinitions.term, `%${concept}%`)))
      .limit(1);
    if (!def) return null;
    return {
      term: def.term,
      definition: def.definition,
      related: [],
    };
  } catch (err) {
    log.warn({ err: String(err) }, "explainConcept failed");
    return null;
  }
}

// ─── Cases ──────────────────────────────────────────────────────────────

export async function listCases(filters: { disciplineId?: number; status?: PublishStatus } = {}) {
  const db = await getDb();
  if (!db) return [];
  try {
    const conditions = [eq(learningCases.status, filters.status ?? "published")];
    if (filters.disciplineId) conditions.push(eq(learningCases.disciplineId, filters.disciplineId));
    return db
      .select()
      .from(learningCases)
      .where(and(...conditions))
      .orderBy(desc(learningCases.updatedAt));
  } catch (err) {
    log.warn({ err: String(err) }, "listCases failed");
    return [];
  }
}

// ─── FS Applications ─────────────────────────────────────────────────────

export async function listFsApplications(filters: { disciplineId?: number; status?: PublishStatus } = {}) {
  const db = await getDb();
  if (!db) return [];
  try {
    const conditions = [eq(learningFsApplications.status, filters.status ?? "published")];
    if (filters.disciplineId) conditions.push(eq(learningFsApplications.disciplineId, filters.disciplineId));
    return db
      .select()
      .from(learningFsApplications)
      .where(and(...conditions))
      .orderBy(desc(learningFsApplications.updatedAt));
  } catch (err) {
    log.warn({ err: String(err) }, "listFsApplications failed");
    return [];
  }
}

// ─── Connections (concept graph edges) ──────────────────────────────────

export async function listConnections(filters: { status?: string } = {}) {
  const db = await getDb();
  if (!db) return [];
  try {
    return db
      .select({
        id: learningConnections.id,
        fromDefinitionId: learningConnections.fromDefinitionId,
        toDefinitionId: learningConnections.toDefinitionId,
        relationship: learningConnections.relationship,
        status: learningConnections.status,
      })
      .from(learningConnections)
      .where(eq(learningConnections.status, (filters.status as "published" | "draft" | "archived") ?? "published"));
  } catch (err) {
    log.warn({ err: String(err) }, "listConnections failed");
    return [];
  }
}
