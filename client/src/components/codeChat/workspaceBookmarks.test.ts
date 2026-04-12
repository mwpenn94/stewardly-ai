/**
 * Tests for workspace bookmarks — Pass 259.
 */

import { describe, it, expect } from "vitest";
import {
  createBookmark,
  addBookmark,
  removeBookmark,
  updateBookmark,
  groupByFolder,
  filterBookmarks,
  allFolders,
  parseBookmarks,
  serializeBookmarks,
  MAX_BOOKMARKS,
  type WorkspaceBookmark,
} from "./workspaceBookmarks";

function makeBookmark(partial: Partial<WorkspaceBookmark> = {}): WorkspaceBookmark {
  return {
    id: partial.id ?? "b1",
    path: partial.path ?? "src/a.ts",
    label: partial.label,
    folder: partial.folder,
    line: partial.line,
    color: partial.color ?? "default",
    createdAt: partial.createdAt ?? 0,
  };
}

describe("createBookmark", () => {
  it("generates a stable id", () => {
    const b = createBookmark("a.ts");
    expect(b.id).toMatch(/^bm-/);
  });

  it("trims path + label + folder", () => {
    const b = createBookmark("  a.ts  ", {
      label: "  my label  ",
      folder: "  subfolder  ",
    });
    expect(b.path).toBe("a.ts");
    expect(b.label).toBe("my label");
    expect(b.folder).toBe("subfolder");
  });

  it("rejects zero / negative line numbers", () => {
    const a = createBookmark("a.ts", { line: 0 });
    const b = createBookmark("a.ts", { line: -5 });
    expect(a.line).toBeUndefined();
    expect(b.line).toBeUndefined();
  });

  it("defaults color to 'default'", () => {
    expect(createBookmark("a.ts").color).toBe("default");
  });
});

describe("addBookmark", () => {
  it("prepends to the list", () => {
    const existing = [makeBookmark({ id: "a" })];
    const added = makeBookmark({ id: "b", path: "b.ts" });
    const out = addBookmark(existing, added);
    expect(out[0].id).toBe("b");
    expect(out).toHaveLength(2);
  });

  it("dedupes by path + line, replacing the existing entry", () => {
    const existing = [makeBookmark({ id: "a", path: "same.ts", line: 5 })];
    const added = makeBookmark({ id: "b", path: "same.ts", line: 5 });
    const out = addBookmark(existing, added);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("b");
  });

  it("allows same path with different line", () => {
    const existing = [makeBookmark({ id: "a", path: "f.ts", line: 1 })];
    const added = makeBookmark({ id: "b", path: "f.ts", line: 2 });
    const out = addBookmark(existing, added);
    expect(out).toHaveLength(2);
  });

  it("caps at MAX_BOOKMARKS", () => {
    let list: WorkspaceBookmark[] = [];
    for (let i = 0; i < MAX_BOOKMARKS + 5; i++) {
      list = addBookmark(list, makeBookmark({ id: `b${i}`, path: `f${i}.ts` }));
    }
    expect(list.length).toBe(MAX_BOOKMARKS);
  });
});

describe("removeBookmark", () => {
  it("drops matching id", () => {
    const list = [
      makeBookmark({ id: "a" }),
      makeBookmark({ id: "b", path: "b.ts" }),
    ];
    const out = removeBookmark(list, "a");
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("b");
  });

  it("is a no-op for missing id", () => {
    const list = [makeBookmark({ id: "a" })];
    expect(removeBookmark(list, "z")).toHaveLength(1);
  });
});

describe("updateBookmark", () => {
  it("patches label + color", () => {
    const list = [makeBookmark({ id: "a", label: "old", color: "default" })];
    const out = updateBookmark(list, "a", { label: "new", color: "red" });
    expect(out[0].label).toBe("new");
    expect(out[0].color).toBe("red");
  });

  it("preserves unset fields", () => {
    const list = [makeBookmark({ id: "a", label: "keep" })];
    const out = updateBookmark(list, "a", { color: "green" });
    expect(out[0].label).toBe("keep");
    expect(out[0].color).toBe("green");
  });
});

describe("groupByFolder", () => {
  it("groups by folder with unsorted at the end", () => {
    const list = [
      makeBookmark({ id: "a", folder: "api", createdAt: 3 }),
      makeBookmark({ id: "b", folder: "api", createdAt: 2 }),
      makeBookmark({ id: "c", folder: "ui", createdAt: 1 }),
      makeBookmark({ id: "d", folder: undefined }),
    ];
    const groups = groupByFolder(list);
    expect(groups[0].folder).toBe("api");
    expect(groups[0].bookmarks.map((b) => b.id)).toEqual(["a", "b"]);
    expect(groups[1].folder).toBe("ui");
    expect(groups[2].folder).toBe("Unsorted");
  });

  it("handles empty list", () => {
    expect(groupByFolder([])).toEqual([]);
  });
});

describe("filterBookmarks", () => {
  const sample = [
    makeBookmark({ id: "a", path: "src/api/users.ts", label: "users list" }),
    makeBookmark({ id: "b", path: "client/components/Foo.tsx", folder: "ui" }),
  ];

  it("filters by path substring", () => {
    expect(filterBookmarks(sample, "api")).toHaveLength(1);
  });

  it("filters by label substring", () => {
    expect(filterBookmarks(sample, "users")).toHaveLength(1);
  });

  it("filters by folder substring", () => {
    expect(filterBookmarks(sample, "ui")).toHaveLength(1);
  });

  it("is case-insensitive", () => {
    expect(filterBookmarks(sample, "FOO")).toHaveLength(1);
  });

  it("empty query returns all", () => {
    expect(filterBookmarks(sample, "")).toHaveLength(2);
  });
});

describe("allFolders", () => {
  it("dedupes and sorts", () => {
    const list = [
      makeBookmark({ id: "a", folder: "z" }),
      makeBookmark({ id: "b", folder: "a" }),
      makeBookmark({ id: "c", folder: "a" }),
    ];
    expect(allFolders(list)).toEqual(["a", "z"]);
  });
});

describe("parseBookmarks / serializeBookmarks", () => {
  it("round-trips through JSON", () => {
    const list = [
      makeBookmark({ id: "a", path: "a.ts", label: "foo" }),
    ];
    const out = parseBookmarks(serializeBookmarks(list));
    expect(out[0].label).toBe("foo");
  });

  it("returns empty on null / malformed", () => {
    expect(parseBookmarks(null)).toEqual([]);
    expect(parseBookmarks("{oops")).toEqual([]);
  });

  it("drops entries with invalid color, falling back to default", () => {
    const raw = JSON.stringify([
      { id: "a", path: "a.ts", color: "bogus" },
    ]);
    const out = parseBookmarks(raw);
    expect(out[0].color).toBe("default");
  });

  it("drops entries with missing path", () => {
    const raw = JSON.stringify([{ id: "a" }]);
    expect(parseBookmarks(raw)).toEqual([]);
  });
});
