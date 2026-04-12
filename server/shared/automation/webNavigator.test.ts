import { describe, it, expect } from "vitest";
import {
  WebNavigator,
  NavigationError,
  validateUrl,
  isPrivateHost,
  tryConsume,
  createRateLimiter,
  stripHtmlBoilerplate,
  decodeEntities,
  stripTags,
  parseHtmlToPageView,
  extractLinks,
  summarizePageView,
  type PageFetcher,
} from "./webNavigator";

// ─── Stub adapter ─────────────────────────────────────────────────────
function stubAdapter(response: {
  status?: number;
  body?: string;
  finalUrl?: string;
  headers?: Record<string, string>;
  throws?: Error;
}): PageFetcher {
  return {
    async fetch(url) {
      if (response.throws) throw response.throws;
      const body = response.body ?? "<html><title>stub</title><body>ok</body></html>";
      return {
        status: response.status ?? 200,
        finalUrl: response.finalUrl ?? url,
        headers: response.headers ?? { "content-type": "text/html" },
        body,
        bytes: new TextEncoder().encode(body).length,
        truncated: false,
        redirects: 0,
      };
    },
  };
}

// ─── Host safety ──────────────────────────────────────────────────────
describe("isPrivateHost", () => {
  it("rejects localhost + rfc1918", () => {
    expect(isPrivateHost("localhost")).toBe(true);
    expect(isPrivateHost("127.0.0.1")).toBe(true);
    expect(isPrivateHost("10.0.0.1")).toBe(true);
    expect(isPrivateHost("192.168.1.1")).toBe(true);
    expect(isPrivateHost("172.16.0.1")).toBe(true);
    expect(isPrivateHost("169.254.169.254")).toBe(true);
    expect(isPrivateHost("intranet.local")).toBe(true);
    expect(isPrivateHost("corp.internal")).toBe(true);
  });
  it("allows public hosts", () => {
    expect(isPrivateHost("example.com")).toBe(false);
    expect(isPrivateHost("www.irs.gov")).toBe(false);
  });
});

describe("validateUrl", () => {
  it("rejects non-http(s) schemes", () => {
    expect(() => validateUrl("ftp://example.com/x", {})).toThrow(NavigationError);
    expect(() => validateUrl("file:///etc/passwd", {})).toThrow(NavigationError);
  });
  it("rejects private hosts", () => {
    expect(() => validateUrl("http://localhost", {})).toThrow(/private/);
    expect(() => validateUrl("http://192.168.0.1", {})).toThrow(/private/);
  });
  it("enforces deny list with suffix match", () => {
    expect(() =>
      validateUrl("https://a.evil.com/path", { denyHosts: ["evil.com"] }),
    ).toThrow(/denied/);
    // Unrelated host passes
    expect(() => validateUrl("https://example.com", { denyHosts: ["evil.com"] }))
      .not.toThrow();
  });
  it("enforces allow list", () => {
    expect(() =>
      validateUrl("https://example.com", { allowHosts: ["irs.gov", "sec.gov"] }),
    ).toThrow(/allow/);
    expect(() =>
      validateUrl("https://www.irs.gov/pub/1040.pdf", { allowHosts: ["irs.gov"] }),
    ).not.toThrow();
  });
  it("returns parsed URL on success", () => {
    const u = validateUrl("https://Example.com/a", {});
    expect(u.hostname).toBe("example.com");
  });
});

// ─── Rate limiter ─────────────────────────────────────────────────────
describe("tryConsume / rate limiter", () => {
  it("allows up to perMinute tokens then rejects", () => {
    const state = createRateLimiter(3);
    const now = 1_000_000;
    expect(tryConsume(state, "a.com", now)).toBe(true);
    expect(tryConsume(state, "a.com", now)).toBe(true);
    expect(tryConsume(state, "a.com", now)).toBe(true);
    expect(tryConsume(state, "a.com", now)).toBe(false);
  });
  it("refills over time", () => {
    const state = createRateLimiter(60); // 1/sec
    const t0 = 1_000_000;
    for (let i = 0; i < 60; i++) expect(tryConsume(state, "a.com", t0)).toBe(true);
    expect(tryConsume(state, "a.com", t0)).toBe(false);
    // Advance 2 seconds → 2 tokens available
    expect(tryConsume(state, "a.com", t0 + 2000)).toBe(true);
    expect(tryConsume(state, "a.com", t0 + 2000)).toBe(true);
    expect(tryConsume(state, "a.com", t0 + 2000)).toBe(false);
  });
  it("tracks hosts independently", () => {
    const state = createRateLimiter(1);
    const now = 0;
    expect(tryConsume(state, "a.com", now)).toBe(true);
    expect(tryConsume(state, "a.com", now)).toBe(false);
    expect(tryConsume(state, "b.com", now)).toBe(true);
  });
});

// ─── HTML parsing helpers ─────────────────────────────────────────────
describe("stripHtmlBoilerplate", () => {
  it("removes scripts, styles, and comments", () => {
    const html =
      "<!-- hi --><script>bad()</script><style>.x{}</style><p>keep</p>";
    const out = stripHtmlBoilerplate(html);
    expect(out).not.toMatch(/bad/);
    expect(out).not.toMatch(/\.x\{/);
    expect(out).not.toMatch(/hi/);
    expect(out).toContain("<p>keep</p>");
  });
});

describe("decodeEntities", () => {
  it("decodes named + numeric entities", () => {
    expect(decodeEntities("A &amp; B")).toBe("A & B");
    expect(decodeEntities("1 &lt; 2")).toBe("1 < 2");
    expect(decodeEntities("&#65;&#x42;")).toBe("AB");
    expect(decodeEntities("&nbsp;")).toBe(" ");
    expect(decodeEntities("&unknown;")).toBe("&unknown;");
  });
});

describe("stripTags", () => {
  it("removes tags and collapses whitespace", () => {
    const html = "<p>Hello <b>world</b></p>\n\n<p>Second</p>";
    expect(stripTags(html)).toBe("Hello world Second");
  });
});

describe("parseHtmlToPageView", () => {
  const sample = `
    <!doctype html>
    <html lang="en">
      <head>
        <title>Stewardly &mdash; Test Page</title>
        <meta name="description" content="A test page">
        <link rel="canonical" href="https://example.com/canonical">
      </head>
      <body>
        <h1>Welcome</h1>
        <h2>Section</h2>
        <p>Body <b>text</b> with <a href="/link1">inline link</a> and
        <a href="https://other.com/" rel="nofollow">external</a>.</p>
        <img src="/img1.png" alt="Image one">
        <form action="/submit" method="POST">
          <input name="q" type="text" required>
          <textarea name="body">hi</textarea>
          <select name="type"><option value="a">A</option></select>
        </form>
      </body>
    </html>
  `;

  it("extracts title, meta, canonical, lang", () => {
    const v = parseHtmlToPageView(sample, "https://example.com/", "https://example.com/", 200);
    expect(v.title).toBe("Stewardly - Test Page");
    expect(v.description).toBe("A test page");
    expect(v.canonical).toBe("https://example.com/canonical");
    expect(v.language).toBe("en");
  });

  it("extracts headings", () => {
    const v = parseHtmlToPageView(sample, "https://example.com/", "https://example.com/", 200);
    expect(v.headings).toEqual([
      { level: 1, text: "Welcome" },
      { level: 2, text: "Section" },
    ]);
  });

  it("resolves relative links against finalUrl", () => {
    const v = parseHtmlToPageView(sample, "https://example.com/x/", "https://example.com/x/", 200);
    const hrefs = v.links.map((l) => l.href);
    expect(hrefs).toContain("https://example.com/link1");
    expect(hrefs).toContain("https://other.com/");
    const ext = v.links.find((l) => l.href === "https://other.com/");
    expect(ext?.nofollow).toBe(true);
  });

  it("extracts images with alt", () => {
    const v = parseHtmlToPageView(sample, "https://example.com/", "https://example.com/", 200);
    expect(v.images).toEqual([{ src: "https://example.com/img1.png", alt: "Image one" }]);
  });

  it("extracts forms + fields", () => {
    const v = parseHtmlToPageView(sample, "https://example.com/", "https://example.com/", 200);
    expect(v.forms).toHaveLength(1);
    const f = v.forms[0];
    expect(f.action).toBe("/submit");
    expect(f.method).toBe("POST");
    expect(f.fields.map((x) => x.name)).toEqual(["q", "body", "type"]);
    expect(f.fields.find((x) => x.name === "q")?.required).toBe(true);
  });

  it("computes word count from visible text", () => {
    const v = parseHtmlToPageView(sample, "https://example.com/", "https://example.com/", 200);
    expect(v.wordCount).toBeGreaterThan(5);
    expect(v.text).toContain("Welcome");
    expect(v.text).not.toContain("<b>");
  });
});

describe("extractLinks", () => {
  const view = parseHtmlToPageView(
    `<a href="https://a.com/x">Apple</a><a href="https://b.com/y" rel="nofollow">Banana</a><a href="https://a.com/z">Another apple</a>`,
    "https://x/",
    "https://x/",
    200,
  );
  it("filters by text", () => {
    const r = extractLinks(view, { textContains: "apple" });
    expect(r).toHaveLength(2);
  });
  it("filters by host", () => {
    const r = extractLinks(view, { hosts: ["a.com"] });
    expect(r).toHaveLength(2);
  });
  it("excludes nofollow", () => {
    const r = extractLinks(view, { excludeNofollow: true });
    expect(r.find((l) => l.href.includes("b.com"))).toBeUndefined();
  });
  it("respects limit", () => {
    const r = extractLinks(view, { limit: 1 });
    expect(r).toHaveLength(1);
  });
});

describe("summarizePageView", () => {
  it("builds a bounded summary", () => {
    const view = parseHtmlToPageView(
      `<html><head><title>T</title><meta name="description" content="D"></head><body><h1>H1</h1><p>body text</p></body></html>`,
      "https://x/",
      "https://x/",
      200,
    );
    const s = summarizePageView(view, 500);
    expect(s).toContain("# T");
    expect(s).toContain("D");
    expect(s).toContain("H1");
    expect(s.length).toBeLessThanOrEqual(500);
  });
});

// ─── Full WebNavigator integration ────────────────────────────────────
describe("WebNavigator", () => {
  it("reads a stubbed HTML page end-to-end", async () => {
    const nav = new WebNavigator({
      adapter: stubAdapter({
        body: `<html><head><title>Hi</title></head><body><h1>Yo</h1><a href="/z">z</a></body></html>`,
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
      rateLimitPerMin: 1000,
    });
    const view = await nav.readPage("https://example.com/");
    expect(view.title).toBe("Hi");
    expect(view.headings[0]).toEqual({ level: 1, text: "Yo" });
    expect(view.links[0].href).toBe("https://example.com/z");
    expect(nav.getHistory()).toHaveLength(1);
  });

  it("enforces allow-list at fetchPage level", async () => {
    const nav = new WebNavigator({
      adapter: stubAdapter({}),
      allowHosts: ["irs.gov"],
    });
    await expect(nav.fetchPage("https://example.com/")).rejects.toThrow(/allow/);
  });

  it("enforces rate limit", async () => {
    let now = 0;
    const nav = new WebNavigator({
      adapter: stubAdapter({}),
      rateLimitPerMin: 1,
      now: () => now,
    });
    await nav.fetchPage("https://example.com/a");
    await expect(nav.fetchPage("https://example.com/b")).rejects.toThrow(/rate limit/);
    // Advance 65s → one token back
    now = 65_000;
    await expect(nav.fetchPage("https://example.com/c")).resolves.toBeDefined();
  });

  it("truncates oversized response body", async () => {
    const big = "x".repeat(5000);
    const nav = new WebNavigator({
      adapter: stubAdapter({ body: big }),
      maxBytes: 1000,
      rateLimitPerMin: 100,
    });
    const raw = await nav.fetchPage("https://example.com/");
    expect(raw.truncated).toBe(true);
    expect(raw.bytes).toBeLessThanOrEqual(1000);
  });

  it("degrades to text-only view for non-HTML content", async () => {
    const nav = new WebNavigator({
      adapter: stubAdapter({
        body: "Plain text content",
        headers: { "content-type": "text/plain" },
      }),
      rateLimitPerMin: 100,
    });
    const view = await nav.readPage("https://example.com/file.txt");
    expect(view.title).toBe("");
    expect(view.text).toBe("Plain text content");
  });

  it("records navigation history", async () => {
    const nav = new WebNavigator({
      adapter: stubAdapter({}),
      rateLimitPerMin: 100,
    });
    await nav.fetchPage("https://a.com/");
    await nav.fetchPage("https://b.com/");
    expect(nav.getHistory().map((h) => h.url)).toEqual([
      "https://a.com/",
      "https://b.com/",
    ]);
    nav.clearHistory();
    expect(nav.getHistory()).toHaveLength(0);
  });

  it("honors a robots checker decision (blocked)", async () => {
    const nav = new WebNavigator({
      adapter: stubAdapter({}),
      rateLimitPerMin: 100,
      robotsChecker: {
        async check() {
          return { allowed: false, matchedRule: { type: "disallow", path: "/" } };
        },
      },
    });
    await expect(nav.fetchPage("https://ex.com/private")).rejects.toThrow(/robots/);
  });

  it("allows a request when the robots checker says allowed", async () => {
    const nav = new WebNavigator({
      adapter: stubAdapter({}),
      rateLimitPerMin: 100,
      robotsChecker: {
        async check() {
          return { allowed: true, matchedRule: null };
        },
      },
    });
    const r = await nav.fetchPage("https://ex.com/public");
    expect(r.status).toBe(200);
  });

  it("uses a ResponseCache: fresh hit skips network", async () => {
    const { ResponseCache } = await import("./responseCache");
    let fetches = 0;
    const adapter: PageFetcher = {
      async fetch(url) {
        fetches++;
        const body = "<html><title>Cached</title></html>";
        return {
          status: 200,
          finalUrl: url,
          headers: { "content-type": "text/html" },
          body,
          bytes: body.length,
          truncated: false,
          redirects: 0,
        };
      },
    };
    const cache = new ResponseCache({ defaultMaxAgeMs: 60_000, defaultStaleMs: 60_000 });
    const nav = new WebNavigator({ adapter, rateLimitPerMin: 100, cache });
    const r1 = await nav.fetchPage("https://ex.com/");
    const r2 = await nav.fetchPage("https://ex.com/");
    expect(fetches).toBe(1);
    expect(r1.body).toBe(r2.body);
    expect(cache.getStats().hitFresh).toBeGreaterThanOrEqual(1);
  });

  it("emits telemetry events across lifecycle", async () => {
    const events: Array<{ type: string }> = [];
    const nav = new WebNavigator({
      adapter: stubAdapter({}),
      rateLimitPerMin: 100,
      telemetry: {
        onEvent(e) {
          events.push(e);
        },
      },
    });
    await nav.fetchPage("https://ex.com/");
    const types = events.map((e) => e.type);
    expect(types).toContain("request.start");
    expect(types).toContain("request.network");
  });

  it("emits request.blocked when robots denies", async () => {
    const events: Array<{ type: string }> = [];
    const nav = new WebNavigator({
      adapter: stubAdapter({}),
      rateLimitPerMin: 100,
      robotsChecker: {
        async check() {
          return { allowed: false, matchedRule: { type: "disallow", path: "/" } };
        },
      },
      telemetry: {
        onEvent(e) {
          events.push(e);
        },
      },
    });
    await expect(nav.fetchPage("https://ex.com/private")).rejects.toThrow();
    const blocked = events.find((e) => e.type === "request.blocked");
    expect(blocked).toBeDefined();
  });

  it("swallows telemetry sink errors", async () => {
    const nav = new WebNavigator({
      adapter: stubAdapter({}),
      rateLimitPerMin: 100,
      telemetry: {
        onEvent() {
          throw new Error("oops");
        },
      },
    });
    await expect(nav.fetchPage("https://ex.com/")).resolves.toBeDefined();
  });
});
