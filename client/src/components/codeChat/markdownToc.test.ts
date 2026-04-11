/**
 * Tests for markdown TOC generator — Pass 271.
 */

import { describe, it, expect } from "vitest";
import {
  slugify,
  parseMarkdownToc,
  countEntries,
  maxDepth,
  flattenToc,
} from "./markdownToc";

describe("slugify", () => {
  it("lowercases", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("strips punctuation", () => {
    expect(slugify("Hello, World!")).toBe("hello-world");
  });

  it("collapses whitespace to dashes", () => {
    expect(slugify("foo  bar   baz")).toBe("foo-bar-baz");
  });

  it("trims leading/trailing dashes", () => {
    expect(slugify("---foo---")).toBe("foo");
  });
});

describe("parseMarkdownToc", () => {
  it("returns empty for empty input", () => {
    expect(parseMarkdownToc("").flat).toEqual([]);
  });

  it("parses ATX headings", () => {
    const md = `# H1\n## H2\n### H3`;
    const toc = parseMarkdownToc(md);
    expect(toc.flat).toHaveLength(3);
    expect(toc.flat[0].level).toBe(1);
    expect(toc.flat[1].level).toBe(2);
    expect(toc.flat[2].level).toBe(3);
  });

  it("builds tree by level", () => {
    const md = `# Top\n## Sub\n## Sub2\n### Deep\n# Top2`;
    const toc = parseMarkdownToc(md);
    expect(toc.entries).toHaveLength(2);
    expect(toc.entries[0].children).toHaveLength(2);
    expect(toc.entries[0].children[1].children).toHaveLength(1);
  });

  it("parses setext h1 (===)", () => {
    const md = `Title\n=====`;
    const toc = parseMarkdownToc(md);
    expect(toc.flat).toHaveLength(1);
    expect(toc.flat[0].level).toBe(1);
    expect(toc.flat[0].title).toBe("Title");
  });

  it("parses setext h2 (---)", () => {
    const md = `Subtitle\n-------`;
    const toc = parseMarkdownToc(md);
    expect(toc.flat).toHaveLength(1);
    expect(toc.flat[0].level).toBe(2);
  });

  it("skips headings inside code fences", () => {
    const md = "```\n# Not a heading\n```\n# Real heading";
    const toc = parseMarkdownToc(md);
    expect(toc.flat).toHaveLength(1);
    expect(toc.flat[0].title).toBe("Real heading");
  });

  it("handles alternating code fences", () => {
    const md = "```\n# nope\n```\n# ok\n```\n# hidden\n```\n## deeper";
    const toc = parseMarkdownToc(md);
    expect(toc.flat.map((e) => e.title)).toEqual(["ok", "deeper"]);
  });

  it("strips trailing # from ATX closing", () => {
    const md = `# Title ##`;
    const toc = parseMarkdownToc(md);
    expect(toc.flat[0].title).toBe("Title");
  });

  it("assigns line numbers", () => {
    const md = `\n\n# Top\n\n## Sub`;
    const toc = parseMarkdownToc(md);
    expect(toc.flat[0].line).toBe(3);
    expect(toc.flat[1].line).toBe(5);
  });

  it("assigns slugs", () => {
    const md = `# Hello, World!`;
    const toc = parseMarkdownToc(md);
    expect(toc.flat[0].slug).toBe("hello-world");
  });
});

describe("countEntries", () => {
  it("counts nested entries", () => {
    const md = `# A\n## B\n## C\n### D`;
    const toc = parseMarkdownToc(md);
    expect(countEntries(toc.entries)).toBe(4);
  });

  it("returns 0 for empty", () => {
    expect(countEntries([])).toBe(0);
  });
});

describe("maxDepth", () => {
  it("returns max nesting depth", () => {
    const md = `# A\n## B\n### C`;
    const toc = parseMarkdownToc(md);
    expect(maxDepth(toc.entries)).toBe(3);
  });

  it("returns 0 for empty", () => {
    expect(maxDepth([])).toBe(0);
  });

  it("returns 1 for flat list", () => {
    const md = `# A\n# B\n# C`;
    const toc = parseMarkdownToc(md);
    expect(maxDepth(toc.entries)).toBe(1);
  });
});

describe("flattenToc", () => {
  it("returns entries in source order", () => {
    const md = `# A\n## B\n# C`;
    const toc = parseMarkdownToc(md);
    const flat = flattenToc(toc.entries);
    expect(flat.map((e) => e.title)).toEqual(["A", "B", "C"]);
  });
});
