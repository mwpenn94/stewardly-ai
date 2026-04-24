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
  createFormula,
  createCase,
  createFsApplication,
  createConnection,
  listFormulas,
  listCases,
  listFsApplications,
  listConnections,
  updateTrackExamOverview,
  updateTrackDiagrams,
  getTrack,
} from "./content";
import { recordImportRun } from "./importHistory";

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
//
// Pass 76 shape audit after the live fetch revealed the real JSON:
//   emba_data.json top-level:
//     disciplines: { "Accounting": { color, abbr, icon }, ... }   ← OBJECT
//     specializations: string[]                                    ← array of strings
//     definitions: [ { id, term, definition, discipline, ... }, ...] ← array
//
//   tracks_data.json top-level:
//     categories: { "emba": { label, desc, color, icon }, ... }   ← OBJECT
//     tracks: [ { key, name, category, chapters, ... }, ... ]      ← array
//
//   Per track:
//     key (not slug)
//     chapters: [ { id, title, intro, subsections, is_practice }, ... ]
//     subsections: [ { id, title, level, paragraphs, tables, is_question }, ... ]
//     practice_questions: [ { number, prompt, options, correct, explanation }, ... ]
//       correct is a plain integer — NOT correct_index or correctIndex
//     flashcards: [ { id, term, definition }, ... ]

interface EmbaDefinitionRaw {
  id?: number | string;
  term: string;
  definition: string;
  discipline?: string;
  difficulty?: string;
  tags?: string[];
}

/** Value shape for each entry in the `disciplines` object map. The map
 *  KEY is the discipline's display name (e.g. "Accounting"); we derive
 *  the slug from that. */
interface EmbaDisciplineValueRaw {
  color?: string;
  abbr?: string;
  icon?: string;
  description?: string;
}

interface EmbaFormulaRaw {
  id?: number;
  name: string;
  formula: string;
  discipline?: string;
  variables?: string[];
}

interface EmbaCaseRaw {
  id?: number;
  title: string;
  content: string;
  discipline?: string;
}

interface EmbaFsAppRaw {
  id?: number;
  title: string;
  content: string;
  discipline?: string;
}

interface EmbaConnectionRaw {
  from: string;
  to: string;
  concept_from?: string;
  concept_to?: string;
  relationship: string;
}

interface TrackDiagramRaw {
  id?: string;
  title: string;
  url: string;
  description?: string;
}

interface EmbaDataRaw {
  /** Object keyed by display name, not an array. */
  disciplines?: Record<string, EmbaDisciplineValueRaw>;
  definitions?: EmbaDefinitionRaw[];
  /** Array of plain strings in the real repo. */
  specializations?: string[];
  formulas?: EmbaFormulaRaw[];
  cases?: EmbaCaseRaw[];
  fs_applications?: EmbaFsAppRaw[];
  connections?: EmbaConnectionRaw[];
}

interface TrackSubsectionRaw {
  id?: number | string;
  title?: string;
  level?: number;
  paragraphs?: string[];
  tables?: unknown[];
  is_question?: boolean;
}

interface TrackChapterRaw {
  id?: number | string;
  title: string;
  intro?: string;
  is_practice?: boolean;
  isPractice?: boolean;
  subsections?: TrackSubsectionRaw[];
}

interface TrackPracticeQuestionRaw {
  number?: number;
  prompt: string;
  options: string[];
  /** The real field name in the emba_modules JSON. */
  correct?: number;
  /** Tolerated aliases from older / alternative exports. */
  correct_index?: number;
  correctIndex?: number;
  explanation?: string;
  difficulty?: "easy" | "medium" | "hard";
  tags?: string[];
}

interface TrackFlashcardRaw {
  id?: number | string;
  term: string;
  definition: string;
  source?: string;
  sourceLabel?: string;
  tags?: string[];
}

interface TrackRaw {
  /** The real field name in emba_modules — NOT `slug`. */
  key?: string;
  /** Tolerated alias. */
  slug?: string;
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
  diagrams?: TrackDiagramRaw[];
  exam_overview?: any;
}

interface TracksDataRaw {
  schema_version?: number | string;
  generated_from?: string;
  /** Object keyed by category slug, not an array. */
  categories?: Record<string, { label?: string; desc?: string; color?: string; icon?: string }>;
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
    formulas: number;
    cases: number;
    fsApplications: number;
    connections: number;
    diagrams: number;
    examOverviews: number;
  };
  skipped: {
    disciplines: number;
    definitions: number;
    tracks: number;
    chapters: number;
    questions: number;
    flashcards: number;
    formulas: number;
    cases: number;
    fsApplications: number;
    connections: number;
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
      formulas: 0,
      cases: 0,
      fsApplications: 0,
      connections: 0,
      diagrams: 0,
      examOverviews: 0,
    },
    skipped: {
      disciplines: 0,
      definitions: 0,
      tracks: 0,
      chapters: 0,
      questions: 0,
      flashcards: 0,
      formulas: 0,
      cases: 0,
      fsApplications: 0,
      connections: 0,
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

  // The real emba_data.json ships `disciplines` as an OBJECT keyed by
  // display name (e.g. `{ "Accounting": { color, abbr, icon } }`),
  // NOT an array. Before pass 76 this loop used `for...of` which
  // threw "object is not iterable (cannot read property
  // Symbol(Symbol.iterator))" on the first call and aborted the
  // whole import. Pass 76 rewrites it to iterate Object.entries()
  // and derive the slug from the key.
  const disciplinesEntries: Array<[string, EmbaDisciplineValueRaw]> = Array.isArray(
    data.disciplines,
  )
    ? // Tolerate future formats where disciplines becomes an array.
      (data.disciplines as any[]).map((d) => [d?.name ?? d?.slug ?? "", d ?? {}])
    : Object.entries(data.disciplines ?? {});

  for (const [displayName, meta] of disciplinesEntries) {
    if (!displayName) continue;
    const slug = slugify(displayName);
    if (!slug) continue;
    if (bySlug.has(slug)) {
      result.skipped.disciplines += 1;
      continue;
    }
    const row = await upsertDiscipline({
      slug,
      name: displayName,
      description: meta.description ?? undefined,
      color: meta.color ?? undefined,
      icon: meta.icon ?? undefined,
      createdBy: null,
    });
    if (row) {
      bySlug.set(slug, row.id);
      result.counts.disciplines += 1;
    }
  }

  // 2. Formulas (dedup by name within discipline)
  const existingFormulas = await listFormulas();
  const seenFormulas = new Set<string>(
    existingFormulas.map((f: any) => `${f.disciplineId ?? 0}:${(f.name ?? "").toLowerCase()}`),
  );
  for (const f of data.formulas ?? []) {
    if (!f.name || !f.formula) continue;
    const disciplineSlug = f.discipline ? slugify(f.discipline) : null;
    const disciplineId = disciplineSlug ? bySlug.get(disciplineSlug) ?? null : null;
    const key = `${disciplineId ?? 0}:${f.name.toLowerCase()}`;
    if (seenFormulas.has(key)) {
      result.skipped.formulas += 1;
      continue;
    }
    const row = await createFormula({
      disciplineId,
      name: f.name,
      formula: f.formula,
      variables: f.variables ?? null,
      createdBy: null,
      sourceRef: "github:mwpenn94/emba_modules",
    });
    if (row) {
      seenFormulas.add(key);
      result.counts.formulas += 1;
    }
  }

  // 3. Cases (dedup by title within discipline)
  const existingCases = await listCases();
  const seenCases = new Set<string>(
    existingCases.map((c: any) => `${c.disciplineId ?? 0}:${(c.title ?? "").toLowerCase()}`),
  );
  for (const c of data.cases ?? []) {
    if (!c.title || !c.content) continue;
    const disciplineSlug = c.discipline ? slugify(c.discipline) : null;
    const disciplineId = disciplineSlug ? bySlug.get(disciplineSlug) ?? null : null;
    const key = `${disciplineId ?? 0}:${c.title.toLowerCase()}`;
    if (seenCases.has(key)) {
      result.skipped.cases += 1;
      continue;
    }
    const row = await createCase({
      disciplineId,
      title: c.title,
      content: c.content,
      createdBy: null,
      sourceRef: "github:mwpenn94/emba_modules",
    });
    if (row) {
      seenCases.add(key);
      result.counts.cases += 1;
    }
  }

  // 4. FS Applications (dedup by title within discipline)
  const existingFsApps = await listFsApplications();
  const seenFsApps = new Set<string>(
    existingFsApps.map((f: any) => `${f.disciplineId ?? 0}:${(f.title ?? "").toLowerCase()}`),
  );
  for (const f of data.fs_applications ?? []) {
    if (!f.title || !f.content) continue;
    const disciplineSlug = f.discipline ? slugify(f.discipline) : null;
    const disciplineId = disciplineSlug ? bySlug.get(disciplineSlug) ?? null : null;
    const key = `${disciplineId ?? 0}:${f.title.toLowerCase()}`;
    if (seenFsApps.has(key)) {
      result.skipped.fsApplications += 1;
      continue;
    }
    const row = await createFsApplication({
      disciplineId,
      title: f.title,
      content: f.content,
      createdBy: null,
      sourceRef: "github:mwpenn94/emba_modules",
    });
    if (row) {
      seenFsApps.add(key);
      result.counts.fsApplications += 1;
    }
  }

  // 5. Connections (dedup by from+to+relationship)
  const existingConns = await listConnections();
  // Build a lookup of existing definitions by term for resolving connection endpoints
  const allDefs = await listDefinitions({ limit: 5000 });
  const defByTerm = new Map<string, number>();
  for (const d of allDefs) {
    defByTerm.set((d as any).term?.toLowerCase() ?? "", (d as any).id);
  }
  const seenConns = new Set<string>(
    existingConns.map((c: any) => `${c.fromDefinitionId}:${c.toDefinitionId}:${(c.relationship ?? "").toLowerCase()}`),
  );
  for (const conn of data.connections ?? []) {
    if (!conn.from || !conn.to || !conn.relationship) continue;
    // Try to find definitions matching the concept names
    const fromTerm = (conn.concept_from ?? conn.from).toLowerCase();
    const toTerm = (conn.concept_to ?? conn.to).toLowerCase();
    // Find any definition whose term contains the concept
    let fromId: number | null = null;
    let toId: number | null = null;
    for (const [term, id] of defByTerm) {
      if (!fromId && term.includes(fromTerm.toLowerCase())) fromId = id;
      if (!toId && term.includes(toTerm.toLowerCase())) toId = id;
    }
    // If we can't find matching definitions, use discipline IDs as proxies
    if (!fromId) {
      const slug = slugify(conn.from);
      fromId = bySlug.get(slug) ?? 1;
    }
    if (!toId) {
      const slug = slugify(conn.to);
      toId = bySlug.get(slug) ?? 2;
    }
    const key = `${fromId}:${toId}:${conn.relationship.toLowerCase()}`;
    if (seenConns.has(key)) {
      result.skipped.connections += 1;
      continue;
    }
    const row = await createConnection({
      fromDefinitionId: fromId,
      toDefinitionId: toId,
      relationship: conn.relationship,
      createdBy: null,
    });
    if (row) {
      seenConns.add(key);
      result.counts.connections += 1;
    }
  }

  // 6. Definitions. Skip if a definition with the same term already
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
  // Real emba_modules tracks use `key` as the canonical identifier,
  // not `slug`. We tolerate both and fall back to a slugified name.
  const trackSlug = raw.key ?? raw.slug ?? slugify(raw.name);
  if (!trackSlug) return;

  // 1. Upsert track row. The create* helpers all return { id } on
  //    success, so we capture that directly rather than round-tripping
  //    through a second lookup — the lookup-by-slug path is still used
  //    for dedup on a second run, not for first-insert id discovery.
  let trackId: number | null = null;
  const existing = await getTrackBySlug(trackSlug);
  if (existing) {
    trackId = existing.id;
    result.skipped.tracks += 1;
  } else {
    const row = await createTrack({
      slug: trackSlug,
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
    // Real emba_modules JSON uses `correct` (just a number).
    // We tolerate `correct_index` / `correctIndex` for older exports.
    const correctIndex = q.correct ?? q.correctIndex ?? q.correct_index ?? 0;
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
    // Strip tab-separated metadata from definitions (e.g. "def text\tSourceManual\tCh.1")
    const rawDef = card.definition;
    const tabParts = rawDef.split("\t");
    const cleanDef = tabParts[0]!.trim();
    const inferredSource = tabParts.length > 1 ? tabParts[1]!.trim() : undefined;
    const row = await createFlashcard({
      trackId,
      term: card.term.trim(),
      definition: cleanDef,
      sourceLabel: card.sourceLabel ?? inferredSource ?? card.source ?? "emba_modules",
      createdBy: null,
      source: "manual",
      tags: card.tags ?? undefined,
    });
    if (row) {
      result.counts.flashcards += 1;
      seenTerms.add(card.term.toLowerCase());
    }
  }

  // 5. Diagrams (store in track's examOverview JSON)
  if (raw.diagrams && raw.diagrams.length > 0) {
    const diagrams = raw.diagrams.map((d) => ({
      title: d.title,
      url: d.url,
      description: d.description ?? "",
    }));
    const ok = await updateTrackDiagrams(trackId, diagrams);
    if (ok) result.counts.diagrams += diagrams.length;
  }

  // 6. Exam overview (store in track's examOverview JSON)
  if (raw.exam_overview) {
    const track = await getTrack(trackId);
    const existing = (track?.examOverview as any) ?? {};
    const merged = { ...existing, sections: raw.exam_overview };
    const ok = await updateTrackExamOverview(trackId, merged);
    if (ok) result.counts.examOverviews += 1;
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

  // 1. emba_data.json (disciplines, definitions, formulas, cases, fs_applications, connections)
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

  // Pass 4 (build loop) — persist the run to .stewardly/learning_import_history.json
  // so admins can see "last successful import" + per-run counts in the
  // Content Studio UI without redeploying. Best-effort: a failed
  // persist must NOT cause the import call to fail.
  try {
    await recordImportRun(result);
  } catch (err) {
    log.warn({ err: String(err) }, "recordImportRun failed (history not persisted)");
  }

  return result;
}
