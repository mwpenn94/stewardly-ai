/**
 * Unit tests for the EMBA content importer.
 *
 * We don't hit the real GitHub endpoint — the global `fetch` is
 * stubbed per-test to return canned payloads. This locks down:
 *
 *   1. The JSON shape we expect from emba_data.json + tracks_data.json
 *   2. The field normalization (category coercion, difficulty coercion,
 *      correct_index → correctIndex, intra-track dedup)
 *   3. Error aggregation (one bad track shouldn't nuke the whole run)
 *
 * Mocks are scoped to the `./content` module so we can assert how many
 * times each create* function fires without needing a live DB.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the content layer BEFORE importing the module under test.
// Every create* stub returns `{ id: N }` with an auto-incrementing id
// so the importer behaves as if inserts succeeded.
let _nextId = 1;
const nextId = () => ({ id: _nextId++ });

vi.mock("./content", () => {
  return {
    upsertDiscipline: vi.fn(async () => nextId()),
    createDefinition: vi.fn(async () => nextId()),
    createTrack: vi.fn(async () => nextId()),
    getTrackBySlug: vi.fn(async (_slug: string) => null),
    createChapter: vi.fn(async () => nextId()),
    createSubsection: vi.fn(async () => nextId()),
    createPracticeQuestion: vi.fn(async () => nextId()),
    createFlashcard: vi.fn(async () => nextId()),
    listDisciplines: vi.fn(async () => []),
    listChaptersForTrack: vi.fn(async () => []),
    listDefinitions: vi.fn(async () => []),
    listQuestionsForTrack: vi.fn(async () => []),
    listFlashcardsForTrack: vi.fn(async () => []),
  };
});

import { importEMBAFromGitHub } from "./embaImport";
import * as content from "./content";

// Pass 76: fixtures rewritten to match the REAL emba_modules JSON
// shape. Before pass 76 the importer assumed `disciplines` was an
// array of objects, but the live JSON ships it as an object keyed
// by display name. Tracks use `key` (not `slug`) and practice
// questions use `correct` (not `correct_index` / `correctIndex`).
// This test suite now locks in the authoritative shape so the
// "object is not iterable" bug can never reappear.
const FAKE_EMBA_DATA = {
  disciplines: {
    // Object keyed by display name — matches live mwpenn94/emba_modules
    Finance: { color: "#145A32", abbr: "FIN", icon: "trending-up" },
    "Markets & Economies": { color: "#1B4F72", abbr: "MKT", icon: "bar-chart" },
  },
  definitions: [
    { id: 1, term: "NPV", definition: "Net present value", discipline: "Finance", difficulty: "foundation" },
    { id: 2, term: "IRR", definition: "Internal rate of return", discipline: "Finance", difficulty: "foundation" },
    { id: 3, term: "WACC", definition: "Weighted average cost of capital", discipline: "Finance", difficulty: "intermediate" },
  ],
  // Real repo ships plain strings, not objects.
  specializations: ["Advanced Corporate-Level Strategy", "Advanced Finance"],
};

const FAKE_TRACKS_DATA = {
  schema_version: 2,
  // Real repo ships categories as an object keyed by slug.
  categories: {
    securities: { label: "Securities Licenses", color: "#3B82F6", icon: "shield-check" },
  },
  tracks: [
    {
      // Real repo uses `key`, not `slug`
      key: "sie",
      name: "Securities Industry Essentials (SIE)",
      category: "securities",
      title: "SIE",
      subtitle: "Foundation exam for all FINRA registrations",
      chapters: [
        {
          id: "1",
          title: "Chapter 1",
          intro: "Overview",
          is_practice: false,
          subsections: [
            { id: "1", title: "1.1", paragraphs: ["p1", "p2"], level: 2, is_question: false },
            { id: "2", title: "1.2", paragraphs: ["p3"], level: 2, is_question: false },
          ],
        },
      ],
      practice_questions: [
        {
          number: 1,
          prompt: "What is SIE?",
          options: ["A", "B", "C", "D"],
          correct: 0, // Real field name — NOT correct_index
          explanation: "FINRA co-req",
        },
      ],
      flashcards: [
        { id: 1, term: "ADR", definition: "American Depositary Receipt" },
        { id: 2, term: "IPO", definition: "Initial public offering" },
      ],
    },
  ],
};

function stubFetch(responses: Record<string, unknown>) {
  globalThis.fetch = vi.fn(async (url: any) => {
    const key = String(url);
    const body = Object.entries(responses).find(([needle]) =>
      key.includes(needle),
    )?.[1];
    if (body === undefined) {
      return { ok: false, status: 404, json: async () => ({}) } as any;
    }
    return {
      ok: true,
      status: 200,
      json: async () => body,
    } as any;
  }) as any;
}

describe("learning/embaImport", () => {
  beforeEach(() => {
    _nextId = 1;
    vi.clearAllMocks();
  });

  it("fetches both JSON files and seeds disciplines + definitions + tracks + chapters + subsections + questions + flashcards", async () => {
    stubFetch({
      emba_data: FAKE_EMBA_DATA,
      tracks_data: FAKE_TRACKS_DATA,
    });

    const result = await importEMBAFromGitHub();

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    // FAKE_EMBA_DATA.disciplines has 2 entries now (Finance + Markets)
    expect(result.counts.disciplines).toBe(2);
    expect(result.counts.definitions).toBe(3);
    expect(result.counts.tracks).toBe(1);
    expect(result.counts.chapters).toBe(1);
    expect(result.counts.subsections).toBe(2);
    expect(result.counts.questions).toBe(1);
    expect(result.counts.flashcards).toBe(2);

    // Spot-check one create call to confirm field mapping.
    const createQ = content.createPracticeQuestion as any;
    expect(createQ).toHaveBeenCalledTimes(1);
    expect(createQ.mock.calls[0][0]).toMatchObject({
      prompt: "What is SIE?",
      correctIndex: 0, // question.correct → correctIndex on the create call
      options: ["A", "B", "C", "D"],
    });

    const createFC = content.createFlashcard as any;
    expect(createFC).toHaveBeenCalledTimes(2);
  });

  it("coerces unknown difficulty values to 'medium' and unknown category to 'planning'", async () => {
    stubFetch({
      emba_data: { disciplines: {}, definitions: [] },
      tracks_data: {
        tracks: [
          {
            // Real repo uses `key` not `slug` — exercise that path here
            key: "odd",
            name: "Odd",
            category: "emba", // not in the 3-bucket schema enum
            chapters: [],
            practice_questions: [
              {
                prompt: "Q?",
                options: ["a", "b"],
                correct: 1, // real field name, but test also tolerates aliases
                difficulty: "galaxy-brain", // bogus
              },
            ],
            flashcards: [],
          },
        ],
      },
    });

    await importEMBAFromGitHub();

    const createTrack = content.createTrack as any;
    expect(createTrack.mock.calls[0][0].category).toBe("planning");
    expect(createTrack.mock.calls[0][0].slug).toBe("odd"); // slug derived from raw.key
    const createQ = content.createPracticeQuestion as any;
    expect(createQ.mock.calls[0][0].difficulty).toBe("medium");
    expect(createQ.mock.calls[0][0].correctIndex).toBe(1);
  });

  it("handles the real emba_modules shape where `disciplines` is an object keyed by display name", async () => {
    // This is the exact regression that broke the Import button in
    // production — `for...of` on an object throws "object is not
    // iterable". Locking it in so it can never come back.
    stubFetch({
      emba_data: {
        disciplines: {
          Accounting: { color: "#1B4F72", abbr: "ACC", icon: "calculator" },
          "Markets & Economies": { color: "#145A32", abbr: "MKT" },
        },
        definitions: [
          { id: 1, term: "GAAP", definition: "Generally Accepted Accounting Principles", discipline: "Accounting" },
        ],
      },
      tracks_data: { tracks: [] },
    });

    const result = await importEMBAFromGitHub();

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    // Slug must be derived from the object KEY (the display name).
    const upsertD = content.upsertDiscipline as any;
    const slugs = upsertD.mock.calls.map((c: any) => c[0].slug);
    expect(slugs).toContain("accounting");
    expect(slugs).toContain("markets_economies");
    expect(result.counts.disciplines).toBe(2);
    expect(result.counts.definitions).toBe(1);
  });

  it("records errors without throwing when a source file is unreachable", async () => {
    stubFetch({
      // tracks_data missing → 404
      emba_data: FAKE_EMBA_DATA,
    });

    const result = await importEMBAFromGitHub();

    expect(result.ok).toBe(false);
    expect(result.counts.definitions).toBe(3); // emba_data still succeeded
    expect(result.counts.tracks).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/tracks_data import failed/);
  });

  it("skips definitions whose term already exists in the same discipline", async () => {
    (content.listDefinitions as any).mockResolvedValueOnce([
      { term: "NPV" },
    ]);

    stubFetch({
      emba_data: FAKE_EMBA_DATA,
      tracks_data: { tracks: [] },
    });

    const result = await importEMBAFromGitHub();

    expect(result.counts.definitions).toBe(2); // NPV skipped
    expect(result.skipped.definitions).toBe(1);
  });

  it("reports zero-counts when both files succeed but carry no content", async () => {
    stubFetch({
      emba_data: { disciplines: {}, definitions: [] },
      tracks_data: { tracks: [] },
    });

    const result = await importEMBAFromGitHub();

    expect(result.ok).toBe(true);
    expect(result.counts.definitions).toBe(0);
    expect(result.counts.tracks).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it("tolerates legacy array-shaped disciplines without throwing", async () => {
    // If a future emba_modules release ships `disciplines` as an array
    // again (or a fork uses a different shape), the importer should
    // fall through gracefully — it shouldn't regress on the new shape.
    stubFetch({
      emba_data: {
        disciplines: [{ name: "Finance", color: "#145A32" }] as any,
        definitions: [],
      },
      tracks_data: { tracks: [] },
    });

    const result = await importEMBAFromGitHub();

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.counts.disciplines).toBe(1);
  });
});
