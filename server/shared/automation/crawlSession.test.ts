import { describe, it, expect } from "vitest";
import {
  runCrawl,
  canonicalizeUrl,
  sameOrigin,
  type PageReader,
} from "./crawlSession";
import type { PageView } from "./webNavigator";

// ─── Stub reader fixture ─────────────────────────────────────────────
//
// Each "page" is a hardcoded PageView with a set of links. The reader
// returns 404-style empty views when asked for an unknown URL.

function makeView(
  url: string,
  title: string,
  links: string[],
): PageView {
  return {
    url,
    finalUrl: url,
    status: 200,
    title,
    description: "",
    canonical: null,
    language: null,
    text: title,
    headings: [],
    links: links.map((href) => ({ href, text: href, rel: null, nofollow: false })),
    images: [],
    forms: [],
    wordCount: 5,
    fetchedAt: new Date().toISOString(),
    fetchMs: 1,
    truncated: false,
  };
}

function stubReader(pages: Record<string, PageView>): PageReader {
  return {
    async readPage(url: string) {
      const page = pages[url] ?? pages[canonicalizeUrl(url)];
      if (!page) {
        const err = new Error(`not found: ${url}`);
        throw err;
      }
      return page;
    },
  };
}

// ─── URL helpers ─────────────────────────────────────────────────────
describe("canonicalizeUrl", () => {
  it("strips fragments", () => {
    expect(canonicalizeUrl("https://ex.com/a#foo")).toBe("https://ex.com/a");
  });
  it("strips trailing slash", () => {
    expect(canonicalizeUrl("https://ex.com/a/")).toBe("https://ex.com/a");
  });
  it("keeps root /", () => {
    expect(canonicalizeUrl("https://ex.com/")).toBe("https://ex.com/");
  });
  it("sorts query params", () => {
    expect(canonicalizeUrl("https://ex.com/x?b=2&a=1")).toBe(
      "https://ex.com/x?a=1&b=2",
    );
  });
  it("leaves malformed URLs alone", () => {
    expect(canonicalizeUrl("not a url")).toBe("not a url");
  });
});

describe("sameOrigin", () => {
  it("matches same host + protocol", () => {
    expect(sameOrigin("https://ex.com/a", "https://ex.com/b")).toBe(true);
  });
  it("rejects different host", () => {
    expect(sameOrigin("https://a.com/", "https://b.com/")).toBe(false);
  });
  it("rejects different protocol", () => {
    expect(sameOrigin("http://ex.com/", "https://ex.com/")).toBe(false);
  });
});

// ─── Full crawl behavior ─────────────────────────────────────────────
describe("runCrawl", () => {
  it("crawls a 3-page tree with depth=2", async () => {
    const reader = stubReader({
      "https://ex.com/": makeView("https://ex.com/", "Home", [
        "https://ex.com/a",
        "https://ex.com/b",
      ]),
      "https://ex.com/a": makeView("https://ex.com/a", "A", [
        "https://ex.com/a/inner",
      ]),
      "https://ex.com/b": makeView("https://ex.com/b", "B", []),
      "https://ex.com/a/inner": makeView("https://ex.com/a/inner", "Inner", []),
    });
    const result = await runCrawl(reader, {
      startUrl: "https://ex.com/",
      maxDepth: 2,
      maxPages: 10,
    });
    expect(result.pages).toHaveLength(4);
    const titles = result.pages.map((p) => p.title);
    expect(titles).toContain("Home");
    expect(titles).toContain("A");
    expect(titles).toContain("B");
    expect(titles).toContain("Inner");
  });

  it("respects maxDepth", async () => {
    const reader = stubReader({
      "https://ex.com/": makeView("https://ex.com/", "Home", ["https://ex.com/a"]),
      "https://ex.com/a": makeView("https://ex.com/a", "A", ["https://ex.com/a/inner"]),
      "https://ex.com/a/inner": makeView("https://ex.com/a/inner", "Inner", []),
    });
    const result = await runCrawl(reader, {
      startUrl: "https://ex.com/",
      maxDepth: 1,
    });
    expect(result.pages.map((p) => p.title)).toEqual(["Home", "A"]);
  });

  it("respects maxPages budget", async () => {
    const links = Array.from({ length: 20 }, (_, i) => `https://ex.com/p${i}`);
    const pages: Record<string, PageView> = {
      "https://ex.com/": makeView("https://ex.com/", "Home", links),
    };
    for (const l of links) pages[l] = makeView(l, l, []);
    const result = await runCrawl(stubReader(pages), {
      startUrl: "https://ex.com/",
      maxPages: 5,
    });
    expect(result.pages.length).toBeLessThanOrEqual(5);
  });

  it("dedupes via canonicalization", async () => {
    const reader = stubReader({
      "https://ex.com/": makeView("https://ex.com/", "Home", [
        "https://ex.com/a",
        "https://ex.com/a/",
        "https://ex.com/a#frag",
        "https://ex.com/a?b=2&a=1",
      ]),
      "https://ex.com/a": makeView("https://ex.com/a", "A", []),
      "https://ex.com/a?a=1&b=2": makeView("https://ex.com/a?a=1&b=2", "A2", []),
    });
    const result = await runCrawl(reader, {
      startUrl: "https://ex.com/",
      maxDepth: 1,
    });
    // Home, /a (first), /a?a=1&b=2 (deduped vs ?b=2&a=1)
    const urls = result.pages.map((p) => p.url);
    expect(urls.filter((u) => u === "https://ex.com/a")).toHaveLength(1);
    expect(urls).toContain("https://ex.com/a?a=1&b=2");
  });

  it("enforces sameOriginOnly by default", async () => {
    const reader = stubReader({
      "https://ex.com/": makeView("https://ex.com/", "Home", [
        "https://ex.com/a",
        "https://other.com/x",
      ]),
      "https://ex.com/a": makeView("https://ex.com/a", "A", []),
    });
    const result = await runCrawl(reader, {
      startUrl: "https://ex.com/",
      maxDepth: 1,
    });
    expect(result.pages.map((p) => p.title)).toEqual(["Home", "A"]);
    expect(result.skipped.some((s) => s.reason === "cross-origin")).toBe(true);
  });

  it("allows cross-origin when sameOriginOnly=false + allowHosts", async () => {
    const reader = stubReader({
      "https://ex.com/": makeView("https://ex.com/", "Home", [
        "https://other.com/x",
      ]),
      "https://other.com/x": makeView("https://other.com/x", "X", []),
    });
    const result = await runCrawl(reader, {
      startUrl: "https://ex.com/",
      sameOriginOnly: false,
      allowHosts: ["ex.com", "other.com"],
      maxDepth: 1,
    });
    expect(result.pages).toHaveLength(2);
  });

  it("filters by includePatterns", async () => {
    const reader = stubReader({
      "https://ex.com/": makeView("https://ex.com/", "Home", [
        "https://ex.com/blog/post1",
        "https://ex.com/about",
      ]),
      "https://ex.com/blog/post1": makeView("https://ex.com/blog/post1", "Post", []),
      "https://ex.com/about": makeView("https://ex.com/about", "About", []),
    });
    const result = await runCrawl(reader, {
      startUrl: "https://ex.com/",
      maxDepth: 1,
      includePatterns: ["/blog/"],
    });
    expect(result.pages.map((p) => p.title).sort()).toEqual(["Home", "Post"]);
  });

  it("filters by excludePatterns", async () => {
    const reader = stubReader({
      "https://ex.com/": makeView("https://ex.com/", "Home", [
        "https://ex.com/a",
        "https://ex.com/private",
      ]),
      "https://ex.com/a": makeView("https://ex.com/a", "A", []),
      "https://ex.com/private": makeView("https://ex.com/private", "P", []),
    });
    const result = await runCrawl(reader, {
      startUrl: "https://ex.com/",
      maxDepth: 1,
      excludePatterns: ["/private"],
    });
    expect(result.pages.map((p) => p.title)).toEqual(["Home", "A"]);
  });

  it("skips non-http protocols (SSRF hardening)", async () => {
    const reader = stubReader({
      "https://ex.com/": makeView("https://ex.com/", "Home", [
        "javascript:alert(1)",
        "file:///etc/passwd",
        "https://ex.com/ok",
      ]),
      "https://ex.com/ok": makeView("https://ex.com/ok", "OK", []),
    });
    const result = await runCrawl(reader, {
      startUrl: "https://ex.com/",
      maxDepth: 1,
    });
    expect(result.pages.map((p) => p.title)).toEqual(["Home", "OK"]);
    expect(result.skipped.some((s) => s.reason.includes("protocol"))).toBe(true);
  });

  it("continues on read errors by default", async () => {
    const reader: PageReader = {
      async readPage(url: string) {
        if (url === "https://ex.com/a") throw new Error("boom");
        if (url === "https://ex.com/") {
          return makeView("https://ex.com/", "Home", ["https://ex.com/a", "https://ex.com/b"]);
        }
        if (url === "https://ex.com/b") return makeView("https://ex.com/b", "B", []);
        throw new Error("not found");
      },
    };
    const result = await runCrawl(reader, {
      startUrl: "https://ex.com/",
      maxDepth: 1,
    });
    expect(result.pagesFailed).toBeGreaterThanOrEqual(1);
    expect(result.pagesSuccessful).toBeGreaterThanOrEqual(2);
  });

  it("halts on error when continueOnError=false", async () => {
    const reader: PageReader = {
      async readPage(url: string) {
        if (url === "https://ex.com/") return makeView("https://ex.com/", "Home", ["https://ex.com/a"]);
        throw new Error("always fails");
      },
    };
    const result = await runCrawl(reader, {
      startUrl: "https://ex.com/",
      maxDepth: 1,
      continueOnError: false,
    });
    expect(result.pagesFailed).toBe(1);
    expect(result.pages).toHaveLength(2);
  });

  it("streams per-page callbacks", async () => {
    const reader = stubReader({
      "https://ex.com/": makeView("https://ex.com/", "Home", ["https://ex.com/a"]),
      "https://ex.com/a": makeView("https://ex.com/a", "A", []),
    });
    const seen: string[] = [];
    await runCrawl(reader, {
      startUrl: "https://ex.com/",
      maxDepth: 1,
      onPage: (p) => void seen.push(p.title),
    });
    expect(seen).toEqual(["Home", "A"]);
  });

  it("swallows onPage callback errors", async () => {
    const reader = stubReader({
      "https://ex.com/": makeView("https://ex.com/", "Home", []),
    });
    const result = await runCrawl(reader, {
      startUrl: "https://ex.com/",
      onPage: () => {
        throw new Error("oops");
      },
    });
    expect(result.pages).toHaveLength(1);
  });

  it("clamps maxPages + maxDepth to hard caps", async () => {
    const reader = stubReader({
      "https://ex.com/": makeView("https://ex.com/", "Home", []),
    });
    const result = await runCrawl(reader, {
      startUrl: "https://ex.com/",
      maxPages: 1000,
      maxDepth: 1000,
    });
    // Hard caps don't error out — they just clamp; single-page crawl still works.
    expect(result.pages).toHaveLength(1);
  });

  it("concurrency=3 processes a BFS level in parallel (faster than sequential)", async () => {
    // 1 root → 6 children, each with a 40ms fetch delay.
    // Sequential (concurrency=1): ~6*40 = 240ms+ for level 1
    // Parallel (concurrency=3):   ~2*40 = 80ms for level 1
    const childUrls = Array.from({ length: 6 }, (_, i) => `https://ex.com/c${i}`);
    const pagesMap: Record<string, PageView> = {
      "https://ex.com/": makeView("https://ex.com/", "Home", childUrls),
    };
    for (const c of childUrls) pagesMap[c] = makeView(c, c, []);
    const reader: PageReader = {
      async readPage(url: string) {
        await new Promise((r) => setTimeout(r, 40));
        return pagesMap[url] ?? makeView(url, "?", []);
      },
    };
    const t0 = Date.now();
    const result = await runCrawl(reader, {
      startUrl: "https://ex.com/",
      maxPages: 10,
      maxDepth: 1,
      concurrency: 3,
    });
    const elapsed = Date.now() - t0;
    expect(result.pages).toHaveLength(7);
    // Sequential would take ~240ms for level 1 alone; parallel ~80ms.
    // Allow generous slack for CI variance.
    expect(elapsed).toBeLessThan(200);
  });

  it("concurrency preserves dedupe invariants", async () => {
    // Two pages both link to the same child — the child must be fetched once.
    let childFetches = 0;
    const pagesMap: Record<string, PageView> = {
      "https://ex.com/": makeView("https://ex.com/", "Home", [
        "https://ex.com/a",
        "https://ex.com/b",
      ]),
      "https://ex.com/a": makeView("https://ex.com/a", "A", [
        "https://ex.com/shared",
      ]),
      "https://ex.com/b": makeView("https://ex.com/b", "B", [
        "https://ex.com/shared",
      ]),
      "https://ex.com/shared": makeView("https://ex.com/shared", "Shared", []),
    };
    const reader: PageReader = {
      async readPage(url: string) {
        if (url === "https://ex.com/shared") childFetches++;
        return pagesMap[url] ?? makeView(url, "?", []);
      },
    };
    const result = await runCrawl(reader, {
      startUrl: "https://ex.com/",
      maxDepth: 2,
      concurrency: 4,
    });
    expect(childFetches).toBe(1);
    // Home + A + B + Shared — shared appears exactly once
    const sharedCount = result.pages.filter(
      (p) => p.url === "https://ex.com/shared",
    ).length;
    expect(sharedCount).toBe(1);
  });
});
