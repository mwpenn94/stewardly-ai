/**
 * EMBA Learning — content importer from mwpenn94/emba_modules.
 *
 * The seed module (`seed.ts`) only populates the structural catalog
 * (8 disciplines, 12 tracks). This module fetches the full content
 * payload (definitions, chapters, subsections, practice questions,
 * flashcards) from the public GitHub repository and inserts it into
 * the learning_* tables.
 *
 * Source: https://github.com/mwpenn94/emba_modules/tree/main/client/src/data
 *   - emba_data.json   — 8 disciplines + 14 specializations + 366+ definitions
 *   - tracks_data.json — 4 categories + 12 tracks, each with chapters,
 *                        subsections, practice questions, flashcards
 *
 * Design goals:
 *   1. Pure HTTP fetch (no git CLI, no clone) — runs in any sandbox
 *   2. Idempotent — checks for existing rows by slug/term before insert
 *   3. Resilient — any per-row failure is logged and skipped; the
 *      overall import always resolves with counts
 *   4. Admin-triggered — wired to `learning.seed.importFromGitHub`
 *      tRPC mutation so an operator can pull fresh content without
 *      redeploying the server
 *
 * Runtime is ~a few seconds against api.github.com. No auth is
 * required (the source repo is public) so no GITHUB_TOKEN dependency.
 */

import { logger } from "../../_core/logger";
import {
  upsertDiscipline,
  createDefinition,
  createTrack,
  getTrackBySlug,
  createChapter,
  createSubsection,
  createPracticeQuestion,
  createFlashcard,
  listDisciplines,
  listChaptersForTrack,
  listDefinitions,
  listQuestionsForTrack,
  listFlashcardsForTrack,
} from "./content";

const log = logger.child({ module: "learning/embaImport" });

// ─── Raw JSON fetch URLs ──────────────────────────────────────────────────
// These point at the `main` branch of the public emba_modules repo.
// Overridable via env for test fixtures or branch pinning.

const DEFAULT_EMBA_DATA_URL =
  "https://raw.githubusercontent.com/mwpenn94/emba_modules/main/client/src/data/emba_data.json";
const DEFAULT_TRACKS_DATA_URL =
  "https://raw.githubusercontent.com/mwpenn94/emba_modules/main/client/src/data/tracks_data.json";

function urls() {
  return {
    embaData: process.env.EMBA_DATA_URL ?? DEFAULT_EMBA_DATA_URL,
    tracksData: process.env.EMBA_TRACKS_URL ?? DEFAULT_TRACKS_DATA_URL,
  };
}

// ─── Source shape (loose — we validate at field level below) ─────────────

interface EmbaDefinitionRaw {
  id?: string;
  term: string;
  definition: string;
  discipline?: string;
  difficulty?: string;
  tags?: string[];
}

interface EmbaDisciplineRaw {
  slug?: string;
  id?: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

interface EmbaDataRaw {
  disciplines?: EmbaDisciplineRaw[];
  definitions?: EmbaDefinitionRaw[];
  specializations?: Array<{ name: string; description?: string }>;
}

interface TrackSubsectionRaw {
  title?: string;
  level?: number;
  paragraphs?: string[];
  tables?: unknown[];
}

interface TrackChapterRaw {
  title: string;
  intro?: string;
  is_practice?: boolean;
  isPractice?: boolean;
  subsections?: TrackSubsectionRaw[];
}

interface TrackPracticeQuestionRaw {
  prompt: string;
  options: string[];
  correct_index?: number;
  correctIndex?: number;
  explanation?: string;
  difficulty?: "easy" | "medium" | "hard";
  tags?: string[];
}

interface TrackFlashcardRaw {
  term: string;
  definition: string;
  source?: string;
  sourceLabel?: string;
  tags?: string[];
}

interface TrackRaw {
  slug: string;
  name: string;
  category?: "securities" | "planning" | "insurance" | "emba";
  title?: string;
  subtitle?: string;
  description?: string;
  color?: string;
  emoji?: string;
  tagline?: string;
  chapters?: TrackChapterRaw[];
  practice_questions?: TrackPracticeQuestionRaw[];
  practiceQuestions?: TrackPracticeQuestionRaw[];
  flashcards?: TrackFlashcardRaw[];
}

interface TracksDataRaw {
  schema_version?: string;
  generated_from?: string;
  categories?: Array<{ slug: string; name: string; description?: string }>;
  tracks?: TrackRaw[];
}

// ─── Result shape ─────────────────────────────────────────────────────────

export interface EMBAImportResult {
  ok: boolean;
  source: { embaDataUrl: string; tracksDataUrl: string };
  counts: {
    disciplines: number;
    definitions: number;
    tracks: number;
    chapters: number;
    subsections: number;
    questions: number;
    flashcards: number;
  };
  skipped: {
    disciplines: number;
    definitions: number;
    tracks: number;
    chapters: number;
    questions: number;
    flashcards: number;
  };
  errors: string[];
  durationMs: number;
}

function emptyResult(embaDataUrl: string, tracksDataUrl: string): EMBAImportResult {
  return {
    ok: true,
    source: { embaDataUrl, tracksDataUrl },
    counts: {
      disciplines: 0,
      definitions: 0,
      tracks: 0,
      chapters: 0,
      subsections: 0,
      questions: 0,
      flashcards: 0,
    },
    skipped: {
      disciplines: 0,
      definitions: 0,
      tracks: 0,
      chapters: 0,
      questions: 0,
      flashcards: 0,
    },
    errors: [],
    durationMs: 0,
  };
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json, */*" },
  });
  if (!res.ok) {
    throw new Error(`fetch ${url} → HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

// ─── Field normalizers ───────────────────────────────────────────────────

function slugify(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function ensureCategory(
  raw: string | undefined,
): "securities" | "planning" | "insurance" {
  if (raw === "securities" || raw === "planning" || raw === "insurance") return raw;
  // EMBA MBA tracks fall into the `planning` bucket in the Stewardly
  // schema, which currently enforces the three-bucket enum from the
  // original licensure-focused design. This is a pragmatic mapping;
  // the schema can grow an `emba` category in a later migration.
  return "planning";
}

function ensureDifficulty(raw: unknown): "easy" | "medium" | "hard" {
  if (raw === "easy" || raw === "medium" || raw === "hard") return raw;
  return "medium";
}

// ─── Importers ────────────────────────────────────────────────────────────

async function importDisciplinesAndDefinitions(
  data: EmbaDataRaw,
  result: EMBAImportResult,
): Promise<void> {
  // Build a slug → id lookup so definitions can be attached to the
  // right discipline FK.
  const bySlug = new Map<string, number>();

  // 1. Disciplines (EMBA payload ships its own discipline catalog; fall
  //    back to the seed.ts CORE_DISCIPLINES if absent — already handled
  //    by seedLearningContent() before this runs).
  const existing = await listDisciplines();
  for (const d of existing) bySlug.set(d.slug, d.id);

  for (const d of data.disciplines ?? []) {
    const slug = d.slug ?? slugify(d.name);
    if (bySlug.has(slug)) {
      result.skipped.disciplines += 1;
      continue;
    }
    const row = await upsertDiscipline({
      slug,
      name: d.name,
      description: d.description ?? undefined,
      color: d.color ?? undefined,
      icon: d.icon ?? undefined,
      createdBy: null,
    });
    if (row) {
      bySlug.set(slug, row.id);
      result.counts.disciplines += 1;
    }
  }

  // 2. Definitions. Skip if a definition with the same term already
  //    exists under the same discipline (term uniqueness is not
  //    enforced at the schema level so we do a listDefinitions lookup
  //    once per discipline).
  const seenTermsByDiscipline = new Map<number | null, Set<string>>();
  async function termsFor(disciplineId: number | null): Promise<Set<string>> {
    if (seenTermsByDiscipline.has(disciplineId)) {
      return seenTermsByDiscipline.get(disciplineId)!;
    }
    const rows = await listDefinitions({
      disciplineId: disciplineId ?? undefined,
      limit: 5000,
    });
    const set = new Set<string>(rows.map((r: any) => (r.term ?? "").toLowerCase()));
    seenTermsByDiscipline.set(disciplineId, set);
    return set;
  }

  for (const def of data.definitions ?? []) {
    if (!def.term || !def.definition) continue;
    const disciplineSlug = def.discipline ? slugify(def.discipline) : null;
    const disciplineId = disciplineSlug ? bySlug.get(disciplineSlug) ?? null : null;
    const terms = await termsFor(disciplineId);
    if (terms.has(def.term.toLowerCase())) {
      result.skipped.definitions += 1;
      continue;
    }
    const row = await createDefinition({
      disciplineId,
      term: def.term,
      definition: def.definition,
      createdBy: 0, // system
      sourceRef: "github:mwpenn94/emba_modules",
      tags: def.tags ?? undefined,
    });
    if (row) {
      terms.add(def.term.toLowerCase());
      result.counts.definitions += 1;
    }
  }
}

async function importTrack(
  raw: TrackRaw,
  result: EMBAImportResult,
): Promise<void> {
  // 1. Upsert track row. The create* helpers all return { id } on
  //    success, so we capture that directly rather than round-tripping
  //    through a second lookup — the lookup-by-slug path is still used
  //    for dedup on a second run, not for first-insert id discovery.
  let trackId: number | null = null;
  const existing = await getTrackBySlug(raw.slug);
  if (existing) {
    trackId = existing.id;
    result.skipped.tracks += 1;
  } else {
    const row = await createTrack({
      slug: raw.slug,
      name: raw.name,
      category: ensureCategory(raw.category),
      title: raw.title ?? raw.name,
      subtitle: raw.subtitle ?? undefined,
      description: raw.description ?? undefined,
      color: raw.color ?? undefined,
      emoji: raw.emoji ?? undefined,
      tagline: raw.tagline ?? undefined,
      createdBy: null,
    });
    if (row) {
      trackId = row.id;
      result.counts.tracks += 1;
    }
  }
  if (trackId == null) return;

  // 2. Chapters + subsections (skip chapters already present by title)
  const existingChapters = await listChaptersForTrack(trackId);
  const chapterTitles = new Set<string>(
    existingChapters.map((c: any) => (c.title ?? "").toLowerCase()),
  );
  let chapterOrder = existingChapters.length;

  for (const ch of raw.chapters ?? []) {
    if (chapterTitles.has(ch.title.toLowerCase())) {
      result.skipped.chapters += 1;
      continue;
    }
    const chapterRow = await createChapter({
      trackId,
      title: ch.title,
      intro: ch.intro ?? undefined,
      isPractice: ch.isPractice ?? ch.is_practice ?? false,
      sortOrder: chapterOrder++,
      createdBy: null,
    });
    if (!chapterRow) continue;
    result.counts.chapters += 1;
    chapterTitles.add(ch.title.toLowerCase());

    let subOrder = 0;
    for (const sub of ch.subsections ?? []) {
      const subRow = await createSubsection({
        chapterId: chapterRow.id,
        title: sub.title ?? undefined,
        level: sub.level ?? 2,
        paragraphs: sub.paragraphs ?? undefined,
        tables: (sub.tables as any[]) ?? undefined,
        sortOrder: subOrder++,
        createdBy: null,
      });
      if (subRow) result.counts.subsections += 1;
    }
  }

  // 3. Practice questions (dedup by prompt)
  const existingQuestions = await listQuestionsForTrack(trackId);
  const seenPrompts = new Set<string>(
    existingQuestions.map((q: any) => (q.prompt ?? "").toLowerCase()),
  );

  const rawQuestions = raw.practice_questions ?? raw.practiceQuestions ?? [];
  for (const q of rawQuestions) {
    if (seenPrompts.has(q.prompt.toLowerCase())) {
      result.skipped.questions += 1;
      continue;
    }
    const correctIndex = q.correctIndex ?? q.correct_index ?? 0;
    if (!q.options || q.options.length < 2) continue;
    const row = await createPracticeQuestion({
      trackId,
      prompt: q.prompt,
      options: q.options,
      correctIndex,
      explanation: q.explanation ?? undefined,
      difficulty: ensureDifficulty(q.difficulty),
      tags: q.tags ?? undefined,
      createdBy: null,
      source: "manual",
      status: "published",
    });
    if (row) {
      result.counts.questions += 1;
      seenPrompts.add(q.prompt.toLowerCase());
    }
  }

  // 4. Flashcards (dedup by term)
  const existingFlashcards = await listFlashcardsForTrack(trackId);
  const seenTerms = new Set<string>(
    existingFlashcards.map((f: any) => (f.term ?? "").toLowerCase()),
  );

  for (const card of raw.flashcards ?? []) {
    if (!card.term || !card.definition) continue;
    if (seenTerms.has(card.term.toLowerCase())) {
      result.skipped.flashcards += 1;
      continue;
    }
    const row = await createFlashcard({
      trackId,
      term: card.term,
      definition: card.definition,
      sourceLabel: card.sourceLabel ?? card.source ?? "emba_modules",
      createdBy: null,
      source: "manual",
      tags: card.tags ?? undefined,
    });
    if (row) {
      result.counts.flashcards += 1;
      seenTerms.add(card.term.toLowerCase());
    }
  }
}

// ─── Public entry point ──────────────────────────────────────────────────

/**
 * Fetch the two JSON files from `mwpenn94/emba_modules` (or the
 * override URLs) and hydrate the learning_* tables. Safe to call
 * multiple times — every insert is dedup-gated.
 *
 * Returns a detailed breakdown so the admin UI / bootstrap log can
 * show exactly what was added vs skipped vs failed.
 */
export async function importEMBAFromGitHub(): Promise<EMBAImportResult> {
  const started = Date.now();
  const { embaData: embaDataUrl, tracksData: tracksDataUrl } = urls();
  const result = emptyResult(embaDataUrl, tracksDataUrl);

  // 1. emba_data.json
  try {
    const embaData = await fetchJson<EmbaDataRaw>(embaDataUrl);
    await importDisciplinesAndDefinitions(embaData, result);
  } catch (err) {
    const msg = `emba_data import failed: ${String((err as Error).message ?? err)}`;
    log.warn({ err, embaDataUrl }, msg);
    result.ok = false;
    result.errors.push(msg);
  }

  // 2. tracks_data.json
  try {
    const tracksData = await fetchJson<TracksDataRaw>(tracksDataUrl);
    for (const track of tracksData.tracks ?? []) {
      try {
        await importTrack(track, result);
      } catch (err) {
        const msg = `track ${track.slug} failed: ${String((err as Error).message ?? err)}`;
        log.warn({ err, slug: track.slug }, msg);
        result.errors.push(msg);
      }
    }
  } catch (err) {
    const msg = `tracks_data import failed: ${String((err as Error).message ?? err)}`;
    log.warn({ err, tracksDataUrl }, msg);
    result.ok = false;
    result.errors.push(msg);
  }

  result.durationMs = Date.now() - started;
  log.info(result, "importEMBAFromGitHub complete");
  return result;
}
