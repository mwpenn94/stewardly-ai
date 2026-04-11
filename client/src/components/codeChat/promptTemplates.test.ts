/**
 * Tests for promptTemplates.ts (Pass 214).
 */

import { describe, it, expect } from "vitest";
import {
  BUILTIN_TEMPLATES,
  emptyTemplateLibrary,
  parseTemplates,
  serializeTemplates,
  addTemplate,
  deleteTemplate,
  filterTemplates,
  extractTemplateVariables,
  applyTemplateVariables,
  exportTemplates,
  parseTemplateExport,
  importTemplates,
} from "./promptTemplates";

describe("BUILTIN_TEMPLATES", () => {
  it("ships with at least 5 built-ins", () => {
    expect(BUILTIN_TEMPLATES.length).toBeGreaterThanOrEqual(5);
  });
  it("every built-in is flagged", () => {
    for (const t of BUILTIN_TEMPLATES) {
      expect(t.builtin).toBe(true);
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.body.length).toBeGreaterThan(0);
    }
  });
});

describe("parseTemplates", () => {
  it("returns built-ins only for null input", () => {
    const out = parseTemplates(null);
    expect(out.length).toBe(BUILTIN_TEMPLATES.length);
    expect(out.every((t) => t.builtin)).toBe(true);
  });

  it("returns built-ins only for bad JSON", () => {
    expect(parseTemplates("{bad")).toEqual(BUILTIN_TEMPLATES);
  });

  it("returns built-ins only for non-array input", () => {
    expect(parseTemplates('{"not":"an array"}')).toEqual(BUILTIN_TEMPLATES);
  });

  it("appends user templates after built-ins", () => {
    const raw = JSON.stringify([
      { id: "u1", name: "Mine", body: "do the thing", createdAt: 1 },
    ]);
    const out = parseTemplates(raw);
    expect(out.length).toBe(BUILTIN_TEMPLATES.length + 1);
    expect(out[out.length - 1].id).toBe("u1");
  });

  it("refuses to let storage override built-ins", () => {
    const raw = JSON.stringify([
      { id: "builtin-review", name: "HACKED", body: "pwn", builtin: true },
    ]);
    const out = parseTemplates(raw);
    const review = out.find((t) => t.id === "builtin-review");
    expect(review?.name).not.toBe("HACKED");
  });

  it("drops malformed user entries", () => {
    const raw = JSON.stringify([
      { id: "u1", name: "OK", body: "OK body" },
      { id: "u2" }, // missing body + name
      null,
      "string",
    ]);
    const out = parseTemplates(raw);
    const userOnly = out.filter((t) => !t.builtin);
    expect(userOnly).toHaveLength(1);
    expect(userOnly[0].id).toBe("u1");
  });
});

describe("serializeTemplates", () => {
  it("only serializes user templates", () => {
    const lib = addTemplate(emptyTemplateLibrary(), {
      name: "Mine",
      body: "content",
    });
    const raw = serializeTemplates(lib);
    const parsed = JSON.parse(raw);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(1);
    expect(parsed[0].name).toBe("Mine");
  });
});

describe("addTemplate", () => {
  it("adds a user template", () => {
    const out = addTemplate(emptyTemplateLibrary(), {
      name: "Template A",
      body: "body A",
    });
    expect(out.length).toBe(BUILTIN_TEMPLATES.length + 1);
    const added = out[out.length - 1];
    expect(added.name).toBe("Template A");
    expect(added.body).toBe("body A");
    expect(added.builtin).toBeUndefined();
    expect(added.id.startsWith("user-")).toBe(true);
  });

  it("refuses empty name or body", () => {
    const start = emptyTemplateLibrary();
    expect(addTemplate(start, { name: "", body: "x" })).toEqual(start);
    expect(addTemplate(start, { name: "x", body: "" })).toEqual(start);
    expect(addTemplate(start, { name: "  ", body: "x" })).toEqual(start);
  });

  it("truncates very long names", () => {
    const out = addTemplate(emptyTemplateLibrary(), {
      name: "a".repeat(200),
      body: "x",
    });
    const added = out[out.length - 1];
    expect(added.name.length).toBeLessThanOrEqual(80);
  });
});

describe("deleteTemplate", () => {
  it("removes a user template", () => {
    let lib = addTemplate(emptyTemplateLibrary(), {
      name: "tmp",
      body: "x",
    });
    const userId = lib[lib.length - 1].id;
    lib = deleteTemplate(lib, userId);
    expect(lib.find((t) => t.id === userId)).toBeUndefined();
  });

  it("refuses to delete built-ins", () => {
    const lib = emptyTemplateLibrary();
    const out = deleteTemplate(lib, "builtin-review");
    expect(out.some((t) => t.id === "builtin-review")).toBe(true);
  });
});

describe("extractTemplateVariables", () => {
  it("returns empty array when there are no placeholders", () => {
    expect(extractTemplateVariables("plain text")).toEqual([]);
  });

  it("extracts unique names in order of first appearance", () => {
    const vars = extractTemplateVariables(
      "read {{file}} and find {{pattern}} in {{file}}",
    );
    expect(vars).toEqual(["file", "pattern"]);
  });

  it("tolerates whitespace inside the braces", () => {
    const vars = extractTemplateVariables("{{ file }} and {{  name  }}");
    expect(vars).toEqual(["file", "name"]);
  });

  it("ignores malformed placeholders", () => {
    expect(extractTemplateVariables("{{123}} {file} {{-bad}}")).toEqual([]);
  });
});

describe("applyTemplateVariables", () => {
  it("replaces known variables", () => {
    expect(
      applyTemplateVariables("read {{file}} twice", { file: "a.ts" }),
    ).toBe("read a.ts twice");
  });

  it("leaves unknown variables as placeholders", () => {
    expect(
      applyTemplateVariables("read {{file}} and {{other}}", { file: "a.ts" }),
    ).toBe("read a.ts and {{other}}");
  });

  it("replaces every occurrence", () => {
    expect(
      applyTemplateVariables("{{x}} and {{x}} and {{x}}", { x: "Y" }),
    ).toBe("Y and Y and Y");
  });

  it("tolerates whitespace inside the braces", () => {
    expect(
      applyTemplateVariables("{{  file  }}", { file: "a.ts" }),
    ).toBe("a.ts");
  });

  it("is a no-op when the template has no placeholders", () => {
    expect(applyTemplateVariables("plain", { file: "a.ts" })).toBe("plain");
  });
});

describe("exportTemplates", () => {
  it("serializes only user templates inside a version wrapper", () => {
    const lib = addTemplate(emptyTemplateLibrary(), {
      name: "Mine",
      body: "content",
    });
    const raw = exportTemplates(lib);
    const parsed = JSON.parse(raw);
    expect(parsed.version).toBe(1);
    expect(Array.isArray(parsed.templates)).toBe(true);
    expect(parsed.templates).toHaveLength(1);
    expect(parsed.templates[0].name).toBe("Mine");
  });
});

describe("parseTemplateExport", () => {
  it("parses the {version, templates} wrapper", () => {
    const raw = JSON.stringify({
      version: 1,
      templates: [{ id: "u1", name: "A", body: "b" }],
    });
    const out = parseTemplateExport(raw);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("A");
  });

  it("also accepts a bare array payload", () => {
    const raw = JSON.stringify([{ id: "u1", name: "A", body: "b" }]);
    const out = parseTemplateExport(raw);
    expect(out).toHaveLength(1);
  });

  it("strips builtin: true overrides", () => {
    const raw = JSON.stringify({
      version: 1,
      templates: [{ id: "builtin-review", name: "fake", body: "b", builtin: true }],
    });
    const out = parseTemplateExport(raw);
    // The builtin flag is dropped; the entry is treated as a plain user template
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("fake");
    expect(out[0].builtin).toBeUndefined();
  });

  it("drops entries missing required fields", () => {
    const raw = JSON.stringify({
      version: 1,
      templates: [
        { id: "u1", name: "A", body: "b" },
        { id: "u2", name: "" },
        null,
      ],
    });
    expect(parseTemplateExport(raw)).toHaveLength(1);
  });

  it("returns empty on malformed JSON", () => {
    expect(parseTemplateExport("{bad")).toEqual([]);
  });
});

describe("importTemplates", () => {
  const userA: { name: string; body: string } = { name: "A", body: "body A" };
  const userB: { name: string; body: string } = { name: "B", body: "body B" };

  it("returns ok:false when there are no valid templates", () => {
    const r = importTemplates(emptyTemplateLibrary(), "{bad", "merge");
    expect(r.ok).toBe(false);
    expect(r.imported).toBe(0);
  });

  it("merges new user templates and preserves built-ins", () => {
    const existing = addTemplate(emptyTemplateLibrary(), userA);
    const raw = JSON.stringify({
      version: 1,
      templates: [userB],
    });
    const r = importTemplates(existing, raw, "merge");
    expect(r.ok).toBe(true);
    expect(r.imported).toBe(1);
    const userCount = r.templates.filter((t) => !t.builtin).length;
    expect(userCount).toBe(2);
    // built-ins still present
    expect(r.templates.filter((t) => t.builtin).length).toBe(
      BUILTIN_TEMPLATES.length,
    );
  });

  it("dedupes by (name, body) in merge mode", () => {
    const existing = addTemplate(emptyTemplateLibrary(), userA);
    const raw = JSON.stringify({
      version: 1,
      templates: [userA, userB],
    });
    const r = importTemplates(existing, raw, "merge");
    expect(r.imported).toBe(1);
    expect(r.skipped).toBe(1);
  });

  it("replace mode drops existing user templates but keeps built-ins", () => {
    const existing = addTemplate(emptyTemplateLibrary(), userA);
    const raw = JSON.stringify({ version: 1, templates: [userB] });
    const r = importTemplates(existing, raw, "replace");
    expect(r.ok).toBe(true);
    expect(r.imported).toBe(1);
    // Only the imported user template remains (A is gone)
    const userTemplates = r.templates.filter((t) => !t.builtin);
    expect(userTemplates).toHaveLength(1);
    expect(userTemplates[0].name).toBe("B");
    // Built-ins are still there
    expect(r.templates.filter((t) => t.builtin).length).toBe(
      BUILTIN_TEMPLATES.length,
    );
  });
});

describe("filterTemplates", () => {
  const lib = addTemplate(
    emptyTemplateLibrary(),
    { name: "Unique foo", body: "nothing special" },
  );

  it("returns everything for empty query", () => {
    expect(filterTemplates(lib, "").length).toBe(lib.length);
  });

  it("matches by name substring", () => {
    const r = filterTemplates(lib, "foo");
    expect(r.some((t) => t.name === "Unique foo")).toBe(true);
  });

  it("matches by body substring", () => {
    const r = filterTemplates(lib, "nothing");
    expect(r.some((t) => t.name === "Unique foo")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(filterTemplates(lib, "REVIEW").length).toBeGreaterThan(0);
  });
});
