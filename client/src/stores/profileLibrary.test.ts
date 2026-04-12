/**
 * Tests for the profile library store.
 *
 * Cover parse tolerance (malformed JSON, non-object, unknown
 * shapes), save/rename/delete mutations, the 100-entry cap,
 * lookup/filter, and libraryStats aggregation.
 */

import { describe, it, expect } from "vitest";
import {
  EMPTY_LIBRARY,
  PROFILE_LIBRARY_MAX_ENTRIES,
  clearLibrary,
  deleteEntry,
  filterEntries,
  findEntry,
  libraryStats,
  parseLibrary,
  renameEntry,
  saveEntry,
  serializeLibrary,
  type ProfileLibrary,
} from "./profileLibrary";

describe("profileLibrary / parseLibrary", () => {
  it("returns empty library for null input", () => {
    expect(parseLibrary(null).entries).toEqual([]);
  });

  it("tolerates malformed JSON", () => {
    expect(parseLibrary("{not json").entries).toEqual([]);
  });

  it("tolerates non-object top-level shapes", () => {
    expect(parseLibrary("[]").entries).toEqual([]);
    expect(parseLibrary("42").entries).toEqual([]);
    expect(parseLibrary("null").entries).toEqual([]);
  });

  it("hydrates a valid saved library", () => {
    const raw = JSON.stringify({
      version: 1,
      entries: [
        {
          id: "e1",
          label: "Client A",
          profile: { age: 40, income: 120000 },
          savedAt: "2026-04-10T00:00:00.000Z",
        },
      ],
    });
    const lib = parseLibrary(raw);
    expect(lib.entries.length).toBe(1);
    expect(lib.entries[0].label).toBe("Client A");
    expect(lib.entries[0].profile.age).toBe(40);
  });

  it("drops entries missing required id/label", () => {
    const raw = JSON.stringify({
      version: 1,
      entries: [
        { id: "e1", label: "Valid", profile: { age: 40 }, savedAt: "now" },
        { profile: { age: 40 } }, // no id, no label
        { id: "e3", profile: { age: 40 } }, // no label
      ],
    });
    const lib = parseLibrary(raw);
    expect(lib.entries.length).toBe(1);
    expect(lib.entries[0].id).toBe("e1");
  });

  it("clamps oversized labels at 200 chars", () => {
    const raw = JSON.stringify({
      version: 1,
      entries: [
        { id: "e1", label: "x".repeat(500), profile: { age: 40 }, savedAt: "now" },
      ],
    });
    const lib = parseLibrary(raw);
    expect(lib.entries[0].label.length).toBe(200);
  });
});

describe("profileLibrary / saveEntry", () => {
  it("adds a new entry to an empty library", () => {
    const lib = saveEntry(EMPTY_LIBRARY, {
      label: "Client A",
      profile: { age: 40, income: 120000 },
      id: "e1",
    });
    expect(lib.entries.length).toBe(1);
    expect(lib.entries[0].label).toBe("Client A");
  });

  it("newest entry first", () => {
    let lib: ProfileLibrary = EMPTY_LIBRARY;
    lib = saveEntry(lib, { label: "A", profile: { age: 30 }, id: "e1" });
    lib = saveEntry(lib, { label: "B", profile: { age: 40 }, id: "e2" });
    expect(lib.entries[0].id).toBe("e2");
    expect(lib.entries[1].id).toBe("e1");
  });

  it("replaces an entry with the same id (update semantics)", () => {
    let lib: ProfileLibrary = EMPTY_LIBRARY;
    lib = saveEntry(lib, { label: "A", profile: { age: 30 }, id: "e1" });
    lib = saveEntry(lib, { label: "A v2", profile: { age: 31 }, id: "e1" });
    expect(lib.entries.length).toBe(1);
    expect(lib.entries[0].label).toBe("A v2");
    expect(lib.entries[0].profile.age).toBe(31);
  });

  it("sanitizes the profile on save", () => {
    const lib = saveEntry(EMPTY_LIBRARY, {
      label: "Bad Data",
      // @ts-expect-error — out-of-range values
      profile: { age: -50, marginalRate: 5, income: Number.NaN },
      id: "e1",
    });
    expect(lib.entries[0].profile.age).toBe(0);
    expect(lib.entries[0].profile.marginalRate).toBe(0.55);
    expect(lib.entries[0].profile.income).toBeUndefined();
  });

  it("trims the label", () => {
    const lib = saveEntry(EMPTY_LIBRARY, {
      label: "  Spaced  ",
      profile: { age: 40 },
      id: "e1",
    });
    expect(lib.entries[0].label).toBe("Spaced");
  });

  it("no-ops on empty label", () => {
    const lib = saveEntry(EMPTY_LIBRARY, {
      label: "",
      profile: { age: 40 },
      id: "e1",
    });
    expect(lib.entries.length).toBe(0);
  });

  it("drops oldest entries when over the cap", () => {
    let lib: ProfileLibrary = EMPTY_LIBRARY;
    for (let i = 0; i < PROFILE_LIBRARY_MAX_ENTRIES + 5; i++) {
      lib = saveEntry(lib, {
        label: `Client ${i}`,
        profile: { age: 30 + (i % 50) },
        id: `e${i}`,
      });
    }
    expect(lib.entries.length).toBe(PROFILE_LIBRARY_MAX_ENTRIES);
    // Newest is entry e104
    expect(lib.entries[0].label).toBe(
      `Client ${PROFILE_LIBRARY_MAX_ENTRIES + 4}`,
    );
  });
});

describe("profileLibrary / renameEntry", () => {
  it("updates the label + notes of an existing entry", () => {
    let lib: ProfileLibrary = EMPTY_LIBRARY;
    lib = saveEntry(lib, { label: "Old", profile: { age: 40 }, id: "e1" });
    lib = renameEntry(lib, "e1", { label: "New Label", notes: "Important" });
    expect(lib.entries[0].label).toBe("New Label");
    expect(lib.entries[0].notes).toBe("Important");
  });

  it("no-ops on unknown id", () => {
    let lib: ProfileLibrary = EMPTY_LIBRARY;
    lib = saveEntry(lib, { label: "Keep", profile: { age: 40 }, id: "e1" });
    lib = renameEntry(lib, "nonexistent", { label: "Nope" });
    expect(lib.entries[0].label).toBe("Keep");
  });

  it("keeps the original label when given an empty string", () => {
    let lib: ProfileLibrary = EMPTY_LIBRARY;
    lib = saveEntry(lib, { label: "Original", profile: { age: 40 }, id: "e1" });
    lib = renameEntry(lib, "e1", { label: "" });
    expect(lib.entries[0].label).toBe("Original");
  });
});

describe("profileLibrary / deleteEntry", () => {
  it("removes the matching entry", () => {
    let lib: ProfileLibrary = EMPTY_LIBRARY;
    lib = saveEntry(lib, { label: "A", profile: { age: 40 }, id: "e1" });
    lib = saveEntry(lib, { label: "B", profile: { age: 50 }, id: "e2" });
    lib = deleteEntry(lib, "e1");
    expect(lib.entries.length).toBe(1);
    expect(lib.entries[0].id).toBe("e2");
  });

  it("no-ops on unknown id", () => {
    let lib: ProfileLibrary = EMPTY_LIBRARY;
    lib = saveEntry(lib, { label: "Keep", profile: { age: 40 }, id: "e1" });
    lib = deleteEntry(lib, "missing");
    expect(lib.entries.length).toBe(1);
  });
});

describe("profileLibrary / clearLibrary", () => {
  it("returns an empty library", () => {
    const lib = clearLibrary();
    expect(lib.entries).toEqual([]);
  });
});

describe("profileLibrary / findEntry + filterEntries", () => {
  const sample: ProfileLibrary = {
    version: 1,
    entries: [
      {
        id: "e1",
        label: "Jane Doe — Retirement Plan",
        profile: { age: 40 },
        savedAt: "2026-04-10",
        notes: "Priority client",
      },
      {
        id: "e2",
        label: "Acme Industries — Business Income",
        profile: { age: 50 },
        savedAt: "2026-04-11",
      },
      {
        id: "e3",
        label: "John Smith — Estate",
        profile: { age: 65 },
        savedAt: "2026-04-09",
      },
    ],
  };

  it("findEntry returns the matching entry", () => {
    expect(findEntry(sample, "e2")?.label).toContain("Acme");
  });

  it("findEntry returns undefined for unknown id", () => {
    expect(findEntry(sample, "nope")).toBeUndefined();
  });

  it("filterEntries returns all entries for empty query", () => {
    expect(filterEntries(sample, "")).toHaveLength(3);
  });

  it("filterEntries matches on label", () => {
    const result = filterEntries(sample, "retire");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("e1");
  });

  it("filterEntries matches on notes", () => {
    const result = filterEntries(sample, "priority");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("e1");
  });

  it("filterEntries is case-insensitive", () => {
    expect(filterEntries(sample, "ACME")).toHaveLength(1);
  });
});

describe("profileLibrary / libraryStats", () => {
  it("returns zero stats for empty library", () => {
    const stats = libraryStats(EMPTY_LIBRARY);
    expect(stats.count).toBe(0);
    expect(stats.avgCompleteness).toBe(0);
    expect(stats.newest).toBeNull();
  });

  it("counts fully-populated entries", () => {
    let lib: ProfileLibrary = EMPTY_LIBRARY;
    lib = saveEntry(lib, {
      label: "Full",
      profile: {
        age: 40,
        income: 120000,
        savings: 50000,
        monthlySavings: 1500,
        dependents: 2,
        marginalRate: 0.25,
        netWorth: 500000,
        mortgage: 250000,
        debts: 10000,
        stateOfResidence: "TX",
        filingStatus: "mfj",
        isBizOwner: false,
        hasHomeowner: true,
        lifeInsuranceCoverage: 500000,
      },
      id: "e1",
    });
    const stats = libraryStats(lib);
    expect(stats.count).toBe(1);
    expect(stats.fullCount).toBe(1);
    expect(stats.avgCompleteness).toBeCloseTo(1, 4);
  });

  it("counts empty entries", () => {
    let lib: ProfileLibrary = EMPTY_LIBRARY;
    lib = saveEntry(lib, { label: "Empty", profile: {}, id: "e1" });
    const stats = libraryStats(lib);
    expect(stats.emptyCount).toBe(1);
  });

  it("tracks newest and oldest timestamps", () => {
    const lib: ProfileLibrary = {
      version: 1,
      entries: [
        { id: "e1", label: "A", profile: { age: 40 }, savedAt: "2026-04-11" },
        { id: "e2", label: "B", profile: { age: 50 }, savedAt: "2026-04-09" },
        { id: "e3", label: "C", profile: { age: 60 }, savedAt: "2026-04-10" },
      ],
    };
    const stats = libraryStats(lib);
    expect(stats.newest).toBe("2026-04-11");
    expect(stats.oldest).toBe("2026-04-09");
  });
});

describe("profileLibrary / serializeLibrary round-trip", () => {
  it("round-trips a saved library", () => {
    let lib: ProfileLibrary = EMPTY_LIBRARY;
    lib = saveEntry(lib, {
      label: "Round-trip",
      profile: { age: 40, income: 120000 },
      id: "e1",
    });
    const raw = serializeLibrary(lib);
    const rehydrated = parseLibrary(raw);
    expect(rehydrated.entries.length).toBe(1);
    expect(rehydrated.entries[0].label).toBe("Round-trip");
    expect(rehydrated.entries[0].profile.age).toBe(40);
  });
});
