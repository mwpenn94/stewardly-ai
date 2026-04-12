/**
 * Unit tests for the pure helpers in `importHistory.ts`. The
 * file-I/O surface (`loadImportHistory`, `persistImportHistory`,
 * `recordImportRun`) is exercised via a tmpdir round-trip.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  emptyHistory,
  appendRunToHistory,
  parseHistory,
  serializeHistory,
  entryFromResult,
  summarizeHistory,
  recordImportRun,
  MAX_HISTORY_ENTRIES,
  type ImportRunEntry,
} from "./importHistory";
import type { EMBAImportResult } from "./embaImport";

function fakeResult(over: Partial<EMBAImportResult> = {}): EMBAImportResult {
  return {
    ok: true,
    source: {
      embaDataUrl: "https://x/emba.json",
      tracksDataUrl: "https://x/tracks.json",
    },
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
    ...over,
  };
}

function fakeEntry(over: Partial<ImportRunEntry> = {}): ImportRunEntry {
  return entryFromResult(fakeResult(), new Date("2026-04-11T12:00:00Z"))
    .id == over.id
    ? entryFromResult(fakeResult(), new Date("2026-04-11T12:00:00Z"))
    : { ...entryFromResult(fakeResult(), new Date("2026-04-11T12:00:00Z")), ...over };
}

// ─── entryFromResult ─────────────────────────────────────────────────────

describe("learning/importHistory — entryFromResult", () => {
  it("derives id+startedAt+finishedAt from the result + finishedAt clock", () => {
    const finishedAt = new Date("2026-04-11T12:00:00.000Z");
    const e = entryFromResult(fakeResult({ durationMs: 5000 }), finishedAt);
    expect(e.id).toBe("2026-04-11T12:00:00.000Z");
    expect(e.finishedAt).toBe("2026-04-11T12:00:00.000Z");
    expect(e.startedAt).toBe("2026-04-11T11:59:55.000Z");
    expect(e.durationMs).toBe(5000);
  });

  it("computes totalInserted as sum of all count fields", () => {
    const e = entryFromResult(
      fakeResult({
        counts: {
          disciplines: 1,
          definitions: 10,
          tracks: 2,
          chapters: 5,
          subsections: 20,
          questions: 30,
          flashcards: 100,
        },
      }),
    );
    expect(e.totalInserted).toBe(1 + 10 + 2 + 5 + 20 + 30 + 100);
  });

  it("only retains the first 5 errors as samples", () => {
    const errors = ["a", "b", "c", "d", "e", "f", "g"];
    const e = entryFromResult(fakeResult({ errors }));
    expect(e.errorCount).toBe(7);
    expect(e.errorSamples).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("preserves ok=false on failed runs", () => {
    const e = entryFromResult(fakeResult({ ok: false, errors: ["boom"] }));
    expect(e.ok).toBe(false);
    expect(e.errorCount).toBe(1);
  });
});

// ─── appendRunToHistory ──────────────────────────────────────────────────

describe("learning/importHistory — appendRunToHistory", () => {
  it("inserts newest-first and does not mutate input", () => {
    const h0 = emptyHistory();
    const e1 = entryFromResult(fakeResult(), new Date("2026-04-11T10:00:00Z"));
    const e2 = entryFromResult(fakeResult(), new Date("2026-04-11T11:00:00Z"));
    const h1 = appendRunToHistory(h0, e1);
    const h2 = appendRunToHistory(h1, e2);
    expect(h0.runs).toHaveLength(0);
    expect(h1.runs).toHaveLength(1);
    expect(h2.runs).toHaveLength(2);
    expect(h2.runs[0]!.id).toBe(e2.id);
    expect(h2.runs[1]!.id).toBe(e1.id);
  });

  it("caps at MAX_HISTORY_ENTRIES dropping oldest", () => {
    let h = emptyHistory();
    for (let i = 0; i < MAX_HISTORY_ENTRIES + 10; i++) {
      const e = entryFromResult(
        fakeResult(),
        new Date(`2026-04-11T${String(10 + (i % 14)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}:00Z`),
      );
      // Force unique ids
      e.id = `id-${i}`;
      h = appendRunToHistory(h, e);
    }
    expect(h.runs).toHaveLength(MAX_HISTORY_ENTRIES);
    // Newest is the last appended
    expect(h.runs[0]!.id).toBe(`id-${MAX_HISTORY_ENTRIES + 9}`);
  });
});

// ─── parseHistory ────────────────────────────────────────────────────────

describe("learning/importHistory — parseHistory", () => {
  it("returns empty history for null/empty/undefined input", () => {
    expect(parseHistory(null).runs).toEqual([]);
    expect(parseHistory(undefined).runs).toEqual([]);
    expect(parseHistory("").runs).toEqual([]);
  });

  it("returns empty for malformed JSON", () => {
    expect(parseHistory("{not json").runs).toEqual([]);
    expect(parseHistory("[]").runs).toEqual([]);
    expect(parseHistory('{"version":1}').runs).toEqual([]);
  });

  it("round-trips a valid serialized history", () => {
    const h0 = appendRunToHistory(
      emptyHistory(),
      entryFromResult(fakeResult({ counts: { disciplines: 3, definitions: 10, tracks: 1, chapters: 2, subsections: 4, questions: 5, flashcards: 6 } })),
    );
    const raw = serializeHistory(h0);
    const h1 = parseHistory(raw);
    expect(h1.runs).toHaveLength(1);
    expect(h1.runs[0]!.counts.disciplines).toBe(3);
    expect(h1.runs[0]!.totalInserted).toBe(31);
  });

  it("silently drops malformed entries within an otherwise valid file", () => {
    const raw = JSON.stringify({
      version: 1,
      runs: [
        { id: "good", counts: { disciplines: 1, definitions: 0, tracks: 0, chapters: 0, subsections: 0, questions: 0, flashcards: 0 }, skipped: { disciplines: 0, definitions: 0, tracks: 0, chapters: 0, questions: 0, flashcards: 0 } },
        null,
        { id: 42 }, // bad id type
        "junk",
        { /* missing id */ },
      ],
    });
    const h = parseHistory(raw);
    expect(h.runs).toHaveLength(1);
    expect(h.runs[0]!.id).toBe("good");
  });

  it("clamps loaded runs to MAX_HISTORY_ENTRIES", () => {
    const runs = Array.from({ length: MAX_HISTORY_ENTRIES + 10 }, (_, i) => ({
      id: `r${i}`,
      counts: { disciplines: 0, definitions: 0, tracks: 0, chapters: 0, subsections: 0, questions: 0, flashcards: 0 },
      skipped: { disciplines: 0, definitions: 0, tracks: 0, chapters: 0, questions: 0, flashcards: 0 },
    }));
    const h = parseHistory(JSON.stringify({ version: 1, runs }));
    expect(h.runs).toHaveLength(MAX_HISTORY_ENTRIES);
  });

  it("normalizes negative count fields to 0", () => {
    const raw = JSON.stringify({
      version: 1,
      runs: [
        {
          id: "neg",
          counts: { disciplines: -5, definitions: 0, tracks: 0, chapters: 0, subsections: 0, questions: 0, flashcards: 0 },
          skipped: { disciplines: 0, definitions: 0, tracks: 0, chapters: 0, questions: 0, flashcards: 0 },
        },
      ],
    });
    const h = parseHistory(raw);
    expect(h.runs[0]!.counts.disciplines).toBe(0);
  });
});

// ─── summarizeHistory ────────────────────────────────────────────────────

describe("learning/importHistory — summarizeHistory", () => {
  it("returns zero summary for empty history", () => {
    const s = summarizeHistory(emptyHistory());
    expect(s.totalRuns).toBe(0);
    expect(s.successfulRuns).toBe(0);
    expect(s.failedRuns).toBe(0);
    expect(s.lastRunAt).toBeNull();
    expect(s.lastSuccessAt).toBeNull();
    expect(s.lastInsertedTotal).toBe(0);
  });

  it("counts successful vs failed runs (failed = ok=false OR errorCount > 0)", () => {
    let h = emptyHistory();
    h = appendRunToHistory(
      h,
      entryFromResult(fakeResult({ ok: true }), new Date("2026-04-11T10:00:00Z")),
    );
    h = appendRunToHistory(
      h,
      entryFromResult(
        fakeResult({ ok: true, errors: ["track foo failed"] }),
        new Date("2026-04-11T11:00:00Z"),
      ),
    );
    h = appendRunToHistory(
      h,
      entryFromResult(
        fakeResult({ ok: false, errors: ["fetch failed"] }),
        new Date("2026-04-11T12:00:00Z"),
      ),
    );
    const s = summarizeHistory(h);
    expect(s.totalRuns).toBe(3);
    expect(s.successfulRuns).toBe(1);
    expect(s.failedRuns).toBe(2);
  });

  it("lastRunAt is the newest entry's finishedAt", () => {
    let h = emptyHistory();
    h = appendRunToHistory(
      h,
      entryFromResult(fakeResult(), new Date("2026-04-11T10:00:00Z")),
    );
    h = appendRunToHistory(
      h,
      entryFromResult(fakeResult(), new Date("2026-04-11T11:00:00Z")),
    );
    const s = summarizeHistory(h);
    expect(s.lastRunAt).toBe("2026-04-11T11:00:00.000Z");
  });

  it("lastSuccessAt is the newest clean run", () => {
    let h = emptyHistory();
    h = appendRunToHistory(
      h,
      entryFromResult(fakeResult(), new Date("2026-04-11T10:00:00Z")),
    );
    h = appendRunToHistory(
      h,
      entryFromResult(
        fakeResult({ ok: false, errors: ["x"] }),
        new Date("2026-04-11T11:00:00Z"),
      ),
    );
    const s = summarizeHistory(h);
    expect(s.lastSuccessAt).toBe("2026-04-11T10:00:00.000Z");
    expect(s.lastRunAt).toBe("2026-04-11T11:00:00.000Z");
  });

  it("aggregates totals across all runs in window", () => {
    let h = emptyHistory();
    h = appendRunToHistory(
      h,
      entryFromResult(
        fakeResult({
          counts: { disciplines: 1, definitions: 2, tracks: 0, chapters: 0, subsections: 0, questions: 0, flashcards: 0 },
        }),
        new Date("2026-04-11T10:00:00Z"),
      ),
    );
    h = appendRunToHistory(
      h,
      entryFromResult(
        fakeResult({
          counts: { disciplines: 4, definitions: 6, tracks: 0, chapters: 0, subsections: 0, questions: 0, flashcards: 0 },
        }),
        new Date("2026-04-11T11:00:00Z"),
      ),
    );
    const s = summarizeHistory(h);
    expect(s.totals.disciplines).toBe(5);
    expect(s.totals.definitions).toBe(8);
  });
});

// ─── File I/O round-trip via tmpdir ──────────────────────────────────────

describe("learning/importHistory — recordImportRun (file round-trip)", () => {
  let tmpDir: string;
  let envBackup: string | undefined;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "import-history-"));
    envBackup = process.env.LEARNING_IMPORT_HISTORY_PATH;
    process.env.LEARNING_IMPORT_HISTORY_PATH = path.join(tmpDir, "history.json");
  });

  afterEach(async () => {
    if (envBackup === undefined) delete process.env.LEARNING_IMPORT_HISTORY_PATH;
    else process.env.LEARNING_IMPORT_HISTORY_PATH = envBackup;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("persists a run to disk and reloads it on the next call", async () => {
    const r1 = await recordImportRun(
      fakeResult({
        counts: { disciplines: 1, definitions: 5, tracks: 1, chapters: 2, subsections: 3, questions: 4, flashcards: 6 },
      }),
      new Date("2026-04-11T10:00:00Z"),
    );
    expect(r1.history.runs).toHaveLength(1);

    // Second call should load the prior persisted state.
    const r2 = await recordImportRun(
      fakeResult(),
      new Date("2026-04-11T11:00:00Z"),
    );
    expect(r2.history.runs).toHaveLength(2);
    expect(r2.history.runs[0]!.finishedAt).toBe("2026-04-11T11:00:00.000Z");
    expect(r2.history.runs[1]!.finishedAt).toBe("2026-04-11T10:00:00.000Z");
  });

  it("creates the .stewardly directory if it doesn't exist", async () => {
    process.env.LEARNING_IMPORT_HISTORY_PATH = path.join(
      tmpDir,
      "deeper",
      "dir",
      "history.json",
    );
    const r = await recordImportRun(fakeResult(), new Date());
    expect(r.history.runs).toHaveLength(1);
    const stat = await fs.stat(path.join(tmpDir, "deeper", "dir", "history.json"));
    expect(stat.isFile()).toBe(true);
  });
});
