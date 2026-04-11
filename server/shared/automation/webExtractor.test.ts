import { describe, it, expect } from "vitest";
import {
  validateSchema,
  extractFromPageView,
  extractTables,
  type ExtractSchema,
} from "./webExtractor";
import { parseHtmlToPageView } from "./webNavigator";

const SAMPLE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Stewardly Extract Test</title>
    <meta name="description" content="Extractor sample">
  </head>
  <body>
    <h1>Main</h1>
    <h2>Alpha</h2>
    <h2>Beta</h2>
    <p>The price is $1,234.56 today.</p>
    <p>Published on 2026-04-11.</p>
    <a href="/learn/intro">Intro</a>
    <a href="https://irs.gov/pub/1040.pdf">IRS 1040</a>
    <img src="/logo.png" alt="Stewardly logo">
    <table>
      <thead><tr><th>Year</th><th>Limit</th></tr></thead>
      <tbody>
        <tr><td>2025</td><td>$23,500</td></tr>
        <tr><td>2026</td><td>$24,000</td></tr>
      </tbody>
    </table>
    <table>
      <tr><td>no</td><td>header</td></tr>
      <tr><td>row</td><td>two</td></tr>
    </table>
  </body>
</html>
`;

const VIEW = parseHtmlToPageView(
  SAMPLE_HTML,
  "https://example.com/",
  "https://example.com/",
  200,
);
(VIEW as any).raw = { body: SAMPLE_HTML };

describe("validateSchema", () => {
  it("accepts a valid schema", () => {
    const s: ExtractSchema = {
      title: { selector: "title" },
      prices: { selector: "regex:\\$([0-9,]+\\.[0-9]+)", type: "number[]" },
    };
    expect(validateSchema(s)).toHaveLength(0);
  });
  it("rejects unknown type", () => {
    const s = { bad: { selector: "title", type: "float" as any } };
    const errs = validateSchema(s);
    expect(errs).toHaveLength(1);
    expect(errs[0].field).toBe("bad");
  });
  it("rejects invalid regex", () => {
    const s: ExtractSchema = { bad: { selector: "regex:(unclosed" } };
    const errs = validateSchema(s);
    expect(errs).toHaveLength(1);
    expect(errs[0].message).toMatch(/invalid regex/);
  });
  it("rejects missing selector", () => {
    const s = { bad: { type: "string" as const } as any };
    const errs = validateSchema(s);
    expect(errs.length).toBeGreaterThan(0);
  });
});

describe("extractTables", () => {
  it("reads header + rows from a thead-driven table", () => {
    const tables = extractTables(SAMPLE_HTML);
    expect(tables).toHaveLength(2);
    expect(tables[0].headers).toEqual(["Year", "Limit"]);
    expect(tables[0].rows).toEqual([
      ["2025", "$23,500"],
      ["2026", "$24,000"],
    ]);
  });
  it("reads a headerless table", () => {
    const tables = extractTables(SAMPLE_HTML);
    expect(tables[1].headers).toEqual([]);
    expect(tables[1].rows).toEqual([
      ["no", "header"],
      ["row", "two"],
    ]);
  });
});

describe("extractFromPageView", () => {
  it("pulls title + description", () => {
    const r = extractFromPageView(VIEW, {
      t: { selector: "title" },
      d: { selector: "description" },
    });
    expect(r.data.t).toBe("Stewardly Extract Test");
    expect(r.data.d).toBe("Extractor sample");
    expect(r.warnings).toHaveLength(0);
  });
  it("pulls all h2 headings as string[]", () => {
    const r = extractFromPageView(VIEW, {
      subs: { selector: "h2", type: "string[]" },
    });
    expect(r.data.subs).toEqual(["Alpha", "Beta"]);
  });
  it("coerces regex capture to number", () => {
    const r = extractFromPageView(VIEW, {
      price: { selector: "regex:\\$([0-9,]+(?:\\.[0-9]+)?)", type: "number" },
    });
    expect(r.data.price).toBe(1234.56);
  });
  it("coerces date", () => {
    const r = extractFromPageView(VIEW, {
      published: { selector: "regex:(\\d{4}-\\d{2}-\\d{2})", type: "date" },
    });
    expect(typeof r.data.published).toBe("string");
    expect(String(r.data.published)).toContain("2026-04-11");
  });
  it("pulls links as url[] with host filter", () => {
    const r = extractFromPageView(VIEW, {
      irs: {
        selector: "link",
        type: "url[]",
        where: { hrefContains: "irs.gov" },
      },
    });
    expect(r.data.irs).toEqual(["https://irs.gov/pub/1040.pdf"]);
  });
  it("returns a table", () => {
    const r = extractFromPageView(VIEW, {
      limits: { selector: "table", type: "table" },
    });
    const t = r.data.limits as { headers: string[]; rows: string[][] };
    expect(t.headers).toEqual(["Year", "Limit"]);
    expect(t.rows).toHaveLength(2);
  });
  it("returns all tables as table[]", () => {
    const r = extractFromPageView(VIEW, {
      all: { selector: "tables", type: "table[]" },
    });
    expect(Array.isArray(r.data.all)).toBe(true);
    expect((r.data.all as unknown[]).length).toBe(2);
  });
  it("applies fallback when no match", () => {
    const r = extractFromPageView(VIEW, {
      nope: { selector: "regex:NO_SUCH_PATTERN", fallback: "default" },
    });
    expect(r.data.nope).toBe("default");
  });
  it("warns on invalid schema without throwing", () => {
    const r = extractFromPageView(VIEW, {
      bad: { selector: "" } as any,
    });
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.fieldCount).toBe(0);
  });
  it("css: selector pulls tag content", () => {
    const r = extractFromPageView(VIEW, {
      paras: { selector: "css:p", type: "string[]" },
    });
    const list = r.data.paras as string[];
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list.join(" ")).toContain("price");
  });
  it("respects per-field limit", () => {
    const r = extractFromPageView(VIEW, {
      first: { selector: "h2", type: "string[]", limit: 1 },
    });
    expect((r.data.first as string[]).length).toBe(1);
  });
});
