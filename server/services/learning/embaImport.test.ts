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

const FAKE_EMBA_DATA = {
  disciplines: [
    { slug: "finance", name: "Finance", description: "TVM + capital" },
  ],
  definitions: [
    { term: "NPV", definition: "Net present value", discipline: "finance" },
    { term: "IRR", definition: "Internal rate of return", discipline: "finance" },
    { term: "WACC", definition: "Weighted average cost of capital", discipline: "finance" },
  ],
  specializations: [],
};

const FAKE_TRACKS_DATA = {
  schema_version: "1.0",
  tracks: [
    {
      slug: "sie",
      name: "SIE",
      category: "securities",
      title: "Securities Industry Essentials",
      chapters: [
        {
          title: "Chapter 1",
          intro: "Overview",
          subsections: [
            { title: "1.1", paragraphs: ["p1", "p2"], level: 2 },
            { title: "1.2", paragraphs: ["p3"], level: 2 },
          ],
        },
      ],
      practice_questions: [
        {
          prompt: "What is SIE?",
          options: ["A", "B", "C", "D"],
          correct_index: 0,
          explanation: "FINRA co-req",
          difficulty: "easy",
        },
      ],
      flashcards: [
        { term: "ADR", definition: "American Depositary Receipt" },
        { term: "IPO", definition: "Initial public offering" },
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
    expect(result.counts.disciplines).toBe(1);
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
      correctIndex: 0, // correct_index → correctIndex
      options: ["A", "B", "C", "D"],
      difficulty: "easy",
    });

    const createFC = content.createFlashcard as any;
    expect(createFC).toHaveBeenCalledTimes(2);
  });

  it("coerces unknown difficulty values to 'medium' and unknown category to 'planning'", async () => {
    stubFetch({
      emba_data: { disciplines: [], definitions: [] },
      tracks_data: {
        tracks: [
          {
            slug: "odd",
            name: "Odd",
            category: "emba", // not in the 3-bucket schema enum
            chapters: [],
            practice_questions: [
              {
                prompt: "Q?",
                options: ["a", "b"],
                correctIndex: 1,
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
    const createQ = content.createPracticeQuestion as any;
    expect(createQ.mock.calls[0][0].difficulty).toBe("medium");
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
      emba_data: { disciplines: [], definitions: [] },
      tracks_data: { tracks: [] },
    });

    const result = await importEMBAFromGitHub();

    expect(result.ok).toBe(true);
    expect(result.counts.definitions).toBe(0);
    expect(result.counts.tracks).toBe(0);
    expect(result.errors).toEqual([]);
  });
});
