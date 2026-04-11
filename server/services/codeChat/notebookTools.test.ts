/**
 * Tests for notebookTools.ts (Pass 252).
 */

import { describe, it, expect } from "vitest";
import {
  parseNotebook,
  serializeNotebook,
  cellSourceToString,
  insertCell,
  replaceCellSource,
  deleteCell,
  editCellSource,
  NotebookError,
  type Notebook,
} from "./notebookTools";

const SAMPLE_NOTEBOOK: Notebook = {
  nbformat: 4,
  nbformat_minor: 5,
  metadata: { kernelspec: { name: "python3" } },
  cells: [
    {
      cell_type: "markdown",
      source: "# Header\nSome text",
      metadata: {},
    },
    {
      cell_type: "code",
      source: "print('hello')\nprint('world')",
      metadata: {},
      execution_count: 1,
      outputs: [{ output_type: "stream", text: "hello\nworld\n" }],
    },
  ],
};

const SAMPLE_RAW = JSON.stringify(SAMPLE_NOTEBOOK);

// ─── parseNotebook ───────────────────────────────────────────────────────

describe("parseNotebook", () => {
  it("parses a valid nbformat 4 notebook", () => {
    const nb = parseNotebook(SAMPLE_RAW);
    expect(nb.nbformat).toBe(4);
    expect(nb.cells).toHaveLength(2);
    expect(nb.cells[0].cell_type).toBe("markdown");
  });

  it("rejects invalid JSON", () => {
    expect(() => parseNotebook("{not json")).toThrow(NotebookError);
  });

  it("rejects non-object top-level", () => {
    expect(() => parseNotebook("[]")).toThrow(NotebookError);
    expect(() => parseNotebook('"hello"')).toThrow(NotebookError);
    expect(() => parseNotebook("42")).toThrow(NotebookError);
  });

  it("rejects documents without nbformat", () => {
    expect(() =>
      parseNotebook(JSON.stringify({ cells: [] })),
    ).toThrow(/not a Jupyter notebook/);
  });

  it("rejects nbformat < 4", () => {
    expect(() =>
      parseNotebook(JSON.stringify({ nbformat: 3, cells: [] })),
    ).toThrow(/unsupported/);
  });

  it("rejects non-array cells", () => {
    expect(() =>
      parseNotebook(JSON.stringify({ nbformat: 4, cells: "nope" })),
    ).toThrow(/must be an array/);
  });

  it("rejects cells missing cell_type", () => {
    expect(() =>
      parseNotebook(
        JSON.stringify({
          nbformat: 4,
          cells: [{ source: "x" }],
        }),
      ),
    ).toThrow(/cell_type/);
  });

  it("rejects cells with non-string/array source", () => {
    expect(() =>
      parseNotebook(
        JSON.stringify({
          nbformat: 4,
          cells: [{ cell_type: "code", source: 42 }],
        }),
      ),
    ).toThrow(/source/);
  });

  it("preserves unknown top-level fields", () => {
    const raw = JSON.stringify({
      nbformat: 4,
      nbformat_minor: 5,
      cells: [],
      metadata: {},
      custom_field: "keep me",
    });
    const nb = parseNotebook(raw);
    expect((nb as any).custom_field).toBe("keep me");
  });

  it("defaults missing nbformat_minor to 0", () => {
    const raw = JSON.stringify({ nbformat: 4, cells: [] });
    const nb = parseNotebook(raw);
    expect(nb.nbformat_minor).toBe(0);
  });
});

// ─── serializeNotebook ───────────────────────────────────────────────────

describe("serializeNotebook", () => {
  it("round-trips with parseNotebook", () => {
    const nb = parseNotebook(SAMPLE_RAW);
    const out = serializeNotebook(nb);
    const nb2 = parseNotebook(out);
    expect(nb2.cells).toHaveLength(nb.cells.length);
    expect(nb2.nbformat).toBe(nb.nbformat);
  });

  it("uses 1-space indent (Jupyter default)", () => {
    const nb = parseNotebook(SAMPLE_RAW);
    const out = serializeNotebook(nb);
    // First line after `{` should be `\n "cells":` with exactly one space
    expect(out).toMatch(/^\{\n "cells"/);
    // Top-level keys should be 1-space indented
    expect(out).toMatch(/\n "metadata":/);
    expect(out).toMatch(/\n "nbformat":/);
  });

  it("ends with a trailing newline", () => {
    const nb = parseNotebook(SAMPLE_RAW);
    const out = serializeNotebook(nb);
    expect(out.endsWith("\n")).toBe(true);
  });

  it("preserves custom top-level fields on round-trip", () => {
    const raw = JSON.stringify({
      nbformat: 4,
      nbformat_minor: 5,
      cells: [],
      metadata: {},
      strange_field: { nested: "value" },
    });
    const nb = parseNotebook(raw);
    const out = serializeNotebook(nb);
    expect(out).toContain("strange_field");
    expect(out).toContain("nested");
  });
});

// ─── cellSourceToString ──────────────────────────────────────────────────

describe("cellSourceToString", () => {
  it("passes through a string", () => {
    expect(cellSourceToString("hello")).toBe("hello");
  });

  it("joins a string array", () => {
    expect(cellSourceToString(["line1\n", "line2\n", "line3"])).toBe(
      "line1\nline2\nline3",
    );
  });

  it("returns empty string for empty array", () => {
    expect(cellSourceToString([])).toBe("");
  });
});

// ─── insertCell ──────────────────────────────────────────────────────────

describe("insertCell", () => {
  it("inserts at position 0", () => {
    const nb = parseNotebook(SAMPLE_RAW);
    const out = insertCell(nb, {
      position: 0,
      cellType: "markdown",
      source: "# New",
    });
    expect(out.cells).toHaveLength(3);
    expect(out.cells[0].source).toBe("# New");
  });

  it("inserts at 'start' alias", () => {
    const nb = parseNotebook(SAMPLE_RAW);
    const out = insertCell(nb, {
      position: "start",
      cellType: "markdown",
      source: "starter",
    });
    expect(out.cells[0].source).toBe("starter");
  });

  it("inserts at 'end' alias", () => {
    const nb = parseNotebook(SAMPLE_RAW);
    const out = insertCell(nb, {
      position: "end",
      cellType: "code",
      source: "print('tail')",
    });
    expect(out.cells).toHaveLength(3);
    expect(out.cells[2].source).toBe("print('tail')");
  });

  it("code cells get null execution_count + empty outputs", () => {
    const nb = parseNotebook(SAMPLE_RAW);
    const out = insertCell(nb, {
      position: "end",
      cellType: "code",
      source: "x = 1",
    });
    const added = out.cells[2];
    expect(added.execution_count).toBeNull();
    expect(added.outputs).toEqual([]);
  });

  it("markdown cells don't get execution_count/outputs", () => {
    const nb = parseNotebook(SAMPLE_RAW);
    const out = insertCell(nb, {
      position: "end",
      cellType: "markdown",
      source: "## H2",
    });
    const added = out.cells[2];
    expect("execution_count" in added).toBe(false);
    expect("outputs" in added).toBe(false);
  });

  it("throws out-of-range on bad position", () => {
    const nb = parseNotebook(SAMPLE_RAW);
    expect(() =>
      insertCell(nb, { position: 99, cellType: "code", source: "x" }),
    ).toThrow(NotebookError);
    expect(() =>
      insertCell(nb, { position: -1, cellType: "code", source: "x" }),
    ).toThrow(NotebookError);
  });

  it("allows insert at exactly cells.length (append)", () => {
    const nb = parseNotebook(SAMPLE_RAW);
    const out = insertCell(nb, {
      position: nb.cells.length,
      cellType: "code",
      source: "y",
    });
    expect(out.cells).toHaveLength(3);
  });

  it("does not mutate the original notebook", () => {
    const nb = parseNotebook(SAMPLE_RAW);
    const before = nb.cells.length;
    insertCell(nb, { position: 0, cellType: "code", source: "x" });
    expect(nb.cells.length).toBe(before);
  });
});

// ─── replaceCellSource ───────────────────────────────────────────────────

describe("replaceCellSource", () => {
  it("replaces the source at a valid index", () => {
    const nb = parseNotebook(SAMPLE_RAW);
    const out = replaceCellSource(nb, 1, "print('replaced')");
    expect(out.cells[1].source).toBe("print('replaced')");
  });

  it("clears execution_count + outputs for code cells", () => {
    const nb = parseNotebook(SAMPLE_RAW);
    const out = replaceCellSource(nb, 1, "new");
    expect(out.cells[1].execution_count).toBeNull();
    expect(out.cells[1].outputs).toEqual([]);
  });

  it("preserves execution_count on non-code cells", () => {
    const nb: Notebook = {
      ...parseNotebook(SAMPLE_RAW),
      cells: [
        {
          cell_type: "markdown",
          source: "old",
          metadata: {},
          execution_count: 5 as any,
        },
      ],
    };
    const out = replaceCellSource(nb, 0, "new");
    expect(out.cells[0].execution_count).toBe(5);
  });

  it("throws on out-of-range", () => {
    const nb = parseNotebook(SAMPLE_RAW);
    expect(() => replaceCellSource(nb, 99, "x")).toThrow(NotebookError);
    expect(() => replaceCellSource(nb, -1, "x")).toThrow(NotebookError);
  });

  it("does not mutate the original", () => {
    const nb = parseNotebook(SAMPLE_RAW);
    replaceCellSource(nb, 0, "new");
    expect(cellSourceToString(nb.cells[0].source)).not.toBe("new");
  });
});

// ─── deleteCell ──────────────────────────────────────────────────────────

describe("deleteCell", () => {
  it("removes a cell by index", () => {
    const nb = parseNotebook(SAMPLE_RAW);
    const out = deleteCell(nb, 0);
    expect(out.cells).toHaveLength(1);
    expect(out.cells[0].cell_type).toBe("code");
  });

  it("throws on out-of-range", () => {
    const nb = parseNotebook(SAMPLE_RAW);
    expect(() => deleteCell(nb, 99)).toThrow(NotebookError);
    expect(() => deleteCell(nb, -1)).toThrow(NotebookError);
  });
});

// ─── editCellSource ──────────────────────────────────────────────────────

describe("editCellSource", () => {
  it("replaces a unique substring", () => {
    const nb = parseNotebook(SAMPLE_RAW);
    const { notebook, replacements } = editCellSource(
      nb,
      1,
      "'hello'",
      "'hi'",
    );
    expect(cellSourceToString(notebook.cells[1].source)).toContain("'hi'");
    expect(cellSourceToString(notebook.cells[1].source)).not.toContain("'hello'");
    expect(replacements).toBe(1);
  });

  it("throws NO_MATCH when substring missing", () => {
    const nb = parseNotebook(SAMPLE_RAW);
    expect(() => editCellSource(nb, 0, "NOPE", "x")).toThrow(NotebookError);
  });

  it("throws AMBIGUOUS on multi-match without replaceAll", () => {
    const nb: Notebook = {
      ...parseNotebook(SAMPLE_RAW),
      cells: [
        {
          cell_type: "code",
          source: "x = 1; x = 2; x = 3",
          metadata: {},
        },
      ],
    };
    expect(() => editCellSource(nb, 0, "x = ", "y = ")).toThrow(/replaceAll/);
  });

  it("replaces all occurrences with replaceAll", () => {
    const nb: Notebook = {
      ...parseNotebook(SAMPLE_RAW),
      cells: [
        {
          cell_type: "code",
          source: "x = 1; x = 2; x = 3",
          metadata: {},
        },
      ],
    };
    const { notebook, replacements } = editCellSource(
      nb,
      0,
      "x = ",
      "y = ",
      true,
    );
    expect(cellSourceToString(notebook.cells[0].source)).toBe(
      "y = 1; y = 2; y = 3",
    );
    expect(replacements).toBe(3);
  });

  it("throws out-of-range", () => {
    const nb = parseNotebook(SAMPLE_RAW);
    expect(() => editCellSource(nb, 99, "x", "y")).toThrow(NotebookError);
  });

  it("clears execution_count + outputs on code cell edits", () => {
    const nb = parseNotebook(SAMPLE_RAW);
    const { notebook } = editCellSource(nb, 1, "'hello'", "'hi'");
    expect(notebook.cells[1].execution_count).toBeNull();
    expect(notebook.cells[1].outputs).toEqual([]);
  });

  it("handles array source cells", () => {
    const nb: Notebook = {
      ...parseNotebook(SAMPLE_RAW),
      cells: [
        {
          cell_type: "code",
          source: ["print('a')\n", "print('b')\n"],
          metadata: {},
        },
      ],
    };
    const { notebook, replacements } = editCellSource(nb, 0, "'a'", "'A'");
    expect(replacements).toBe(1);
    expect(cellSourceToString(notebook.cells[0].source)).toContain("'A'");
  });
});
