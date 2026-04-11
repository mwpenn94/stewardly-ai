import { describe, it, expect } from "vitest";
import {
  detectFormat,
  parseJson,
  parseNdjson,
  parseDelimited,
  parseRssOrAtom,
  parseHtmlFirstTable,
  parseHtmlJsonLd,
  probeBody,
} from "./sourceProber";

describe("detectFormat", () => {
  it("uses content-type when present", () => {
    expect(detectFormat("{}", "application/json")).toBe("json");
    expect(detectFormat("a,b", "text/csv")).toBe("csv");
    expect(detectFormat("<html/>", "text/html; charset=utf-8")).toBe("html");
  });
  it("detects ndjson when lines parse independently", () => {
    const body = '{"a":1}\n{"a":2}\n{"a":3}';
    expect(detectFormat(body)).toBe("ndjson");
  });
  it("detects json array", () => {
    expect(detectFormat("[1,2,3]")).toBe("json");
  });
  it("detects atom feed", () => {
    expect(detectFormat('<feed xmlns="http://www.w3.org/2005/Atom"><entry/></feed>')).toBe("atom");
  });
  it("detects rss feed", () => {
    expect(detectFormat("<rss version=\"2.0\"><channel></channel></rss>")).toBe("rss");
  });
  it("detects html", () => {
    expect(detectFormat("<html><body>hi</body></html>")).toBe("html");
  });
  it("detects csv when comma-delimited first line", () => {
    expect(detectFormat("a,b,c\n1,2,3")).toBe("csv");
  });
  it("detects tsv when tab-delimited", () => {
    expect(detectFormat("a\tb\n1\t2")).toBe("tsv");
  });
  it("returns unknown on empty", () => {
    expect(detectFormat("   ")).toBe("unknown");
  });
});

describe("parseJson", () => {
  it("parses an array directly", () => {
    const r = parseJson('[{"a":1},{"a":2}]');
    expect(r.records.length).toBe(2);
  });
  it("parses a top-level object as a single record", () => {
    const r = parseJson('{"a":1}');
    expect(r.records).toEqual([{ a: 1 }]);
  });
  it("unwraps common envelopes", () => {
    const r = parseJson('{"data":[{"a":1},{"a":2}]}');
    expect(r.records.length).toBe(2);
  });
  it("unwraps nested envelope {result:{items:[...]}}", () => {
    const r = parseJson('{"result":{"items":[{"a":1}]}}');
    expect(r.records.length).toBe(1);
  });
  it("warns on non-object array entries", () => {
    const r = parseJson("[1,2,{\"a\":1}]");
    expect(r.records.length).toBe(1);
    expect(r.warnings.length).toBe(1);
  });
  it("returns warning on invalid json", () => {
    const r = parseJson("not-json");
    expect(r.records).toEqual([]);
    expect(r.warnings[0]).toMatch(/json parse/);
  });
});

describe("parseNdjson", () => {
  it("parses multiple lines", () => {
    const r = parseNdjson('{"a":1}\n{"a":2}\n');
    expect(r.records.length).toBe(2);
  });
  it("skips invalid lines with warnings", () => {
    const r = parseNdjson('{"a":1}\nnope\n{"a":2}');
    expect(r.records.length).toBe(2);
    expect(r.warnings.length).toBe(1);
  });
});

describe("parseDelimited", () => {
  it("parses CSV with headers", () => {
    const r = parseDelimited("name,age\nAlice,30\nBob,25");
    expect(r.records.length).toBe(2);
    expect(r.records[0]).toEqual({ name: "Alice", age: "30" });
  });
  it("auto-detects delimiter — semicolon", () => {
    const r = parseDelimited("a;b\n1;2");
    expect(r.delimiter).toBe(";");
    expect(r.records[0]).toEqual({ a: "1", b: "2" });
  });
  it("handles quoted fields with commas", () => {
    const r = parseDelimited('a,b\n"one, two",three');
    expect(r.records[0].a).toBe("one, two");
  });
  it("handles escaped double-quotes", () => {
    const r = parseDelimited('a\n"she said ""hi"""');
    expect(r.records[0].a).toBe('she said "hi"');
  });
  it("sanitizes header characters", () => {
    const r = parseDelimited("first name,email-address\nA,a@b.com");
    expect(Object.keys(r.records[0])).toEqual(["first_name", "email_address"]);
  });
  it("returns warning on empty body", () => {
    const r = parseDelimited("");
    expect(r.records.length).toBe(0);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("parseRssOrAtom", () => {
  it("extracts RSS items", () => {
    const rss = `<?xml version="1.0"?><rss><channel>
      <item><title>First</title><link>http://a.com/1</link><pubDate>Wed, 01 Jan 2026</pubDate></item>
      <item><title>Second</title><link>http://a.com/2</link></item>
    </channel></rss>`;
    const r = parseRssOrAtom(rss);
    expect(r.records.length).toBe(2);
    expect(r.records[0].title).toBe("First");
    expect(r.records[0].link).toBe("http://a.com/1");
  });
  it("handles CDATA in title", () => {
    const rss = `<rss><item><title><![CDATA[Hello & World]]></title></item></rss>`;
    const r = parseRssOrAtom(rss);
    expect(r.records[0].title).toBe("Hello & World");
  });
  it("extracts Atom entries with link href", () => {
    const atom = `<feed xmlns="http://www.w3.org/2005/Atom">
      <entry><title>A</title><link href="http://x.com/a"/><id>1</id></entry>
    </feed>`;
    const r = parseRssOrAtom(atom);
    expect(r.records[0].title).toBe("A");
    expect(r.records[0].link).toBe("http://x.com/a");
    expect(r.records[0].guid).toBe("1");
  });
});

describe("parseHtmlFirstTable", () => {
  it("extracts a simple <th> table", () => {
    const html = `<table>
      <tr><th>Name</th><th>Age</th></tr>
      <tr><td>Alice</td><td>30</td></tr>
      <tr><td>Bob</td><td>25</td></tr>
    </table>`;
    const r = parseHtmlFirstTable(html);
    expect(r.records.length).toBe(2);
    expect(r.records[0]).toEqual({ Name: "Alice", Age: "30" });
  });
  it("synthesizes headers from first td row", () => {
    const html = `<table><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></table>`;
    const r = parseHtmlFirstTable(html);
    expect(r.records.length).toBe(1);
    expect(r.records[0]).toEqual({ col_1: "c", col_2: "d" });
  });
  it("warns when no table", () => {
    const r = parseHtmlFirstTable("<p>hi</p>");
    expect(r.records.length).toBe(0);
    expect(r.warnings.length).toBe(1);
  });
});

describe("parseHtmlJsonLd", () => {
  it("extracts a single JSON-LD block", () => {
    const html = `<html><head><script type="application/ld+json">{"@type":"Product","name":"Widget"}</script></head></html>`;
    const r = parseHtmlJsonLd(html);
    expect(r.records.length).toBe(1);
    expect(r.records[0]).toMatchObject({ "@type": "Product", name: "Widget" });
  });
  it("extracts multiple blocks and arrays", () => {
    const html = `
      <script type="application/ld+json">{"@type":"A"}</script>
      <script type="application/ld+json">[{"@type":"B"},{"@type":"C"}]</script>
    `;
    const r = parseHtmlJsonLd(html);
    expect(r.records.length).toBe(3);
  });
  it("warns on invalid block", () => {
    const html = `<script type="application/ld+json">{not json}</script>`;
    const r = parseHtmlJsonLd(html);
    expect(r.records.length).toBe(0);
    expect(r.warnings.length).toBe(1);
  });
});

describe("probeBody", () => {
  it("detects and parses JSON", () => {
    const r = probeBody('{"data":[{"a":1}]}');
    expect(r.detectedFormat).toBe("json");
    expect(r.records.length).toBe(1);
  });
  it("detects and parses CSV", () => {
    const r = probeBody("a,b\n1,2\n3,4");
    expect(r.detectedFormat).toBe("csv");
    expect(r.records.length).toBe(2);
  });
  it("detects and parses NDJSON", () => {
    const r = probeBody('{"a":1}\n{"a":2}');
    expect(r.detectedFormat).toBe("ndjson");
    expect(r.records.length).toBe(2);
  });
  it("detects HTML and prefers JSON-LD", () => {
    const html = `<html><script type="application/ld+json">{"@type":"Product"}</script><table><tr><th>x</th></tr><tr><td>1</td></tr></table></html>`;
    const r = probeBody(html);
    expect(r.detectedFormat).toBe("html");
    expect(r.records.length).toBe(1);
    expect(r.notes.some((n) => n.includes("JSON-LD"))).toBe(true);
  });
  it("caps raw at MAX_RAW_BYTES", () => {
    const big = "a".repeat(2_000_000);
    const r = probeBody(big);
    expect(r.raw.length).toBeLessThanOrEqual(1_000_000);
    expect(r.notes.some((n) => n.includes("truncated"))).toBe(true);
  });
  it("handles unknown format", () => {
    const r = probeBody("");
    expect(r.detectedFormat).toBe("unknown");
    expect(r.records.length).toBe(0);
  });
});
