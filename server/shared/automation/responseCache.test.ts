import { describe, it, expect } from "vitest";
import {
  ResponseCache,
  parseCacheControl,
  deriveFreshness,
} from "./responseCache";

describe("parseCacheControl", () => {
  it("parses max-age + stale-while-revalidate", () => {
    const cc = parseCacheControl("public, max-age=60, stale-while-revalidate=120");
    expect(cc.maxAgeMs).toBe(60_000);
    expect(cc.staleMs).toBe(120_000);
  });
  it("parses no-store", () => {
    expect(parseCacheControl("no-store").noStore).toBe(true);
  });
  it("parses no-cache", () => {
    expect(parseCacheControl("no-cache").noCache).toBe(true);
  });
  it("tolerates empty + undefined", () => {
    expect(parseCacheControl(undefined)).toEqual({});
    expect(parseCacheControl("")).toEqual({});
  });
});

describe("deriveFreshness", () => {
  const defaults = { defaultMaxAgeMs: 300_000, defaultStaleMs: 600_000 };
  it("falls back to defaults", () => {
    const f = deriveFreshness({}, defaults);
    expect(f).toEqual({ maxAgeMs: 300_000, staleMs: 600_000 });
  });
  it("respects max-age override", () => {
    const f = deriveFreshness(
      { "cache-control": "public, max-age=10" },
      defaults,
    );
    expect(f?.maxAgeMs).toBe(10_000);
    expect(f?.staleMs).toBe(600_000);
  });
  it("returns null for no-store", () => {
    expect(deriveFreshness({ "cache-control": "no-store" }, defaults)).toBeNull();
  });
  it("returns zero-fresh window for no-cache", () => {
    const f = deriveFreshness({ "cache-control": "no-cache" }, defaults);
    expect(f).toEqual({ maxAgeMs: 0, staleMs: 0 });
  });
});

describe("ResponseCache", () => {
  const baseResponse = {
    status: 200,
    finalUrl: "https://example.com/",
    headers: {
      "content-type": "text/html",
      etag: '"abc"',
      "last-modified": "Mon, 10 Apr 2026 00:00:00 GMT",
    },
    body: "<html>ok</html>",
    bytes: 15,
  };

  it("returns miss on empty cache", () => {
    const c = new ResponseCache();
    expect(c.lookup("https://ex.com/").state).toBe("miss");
  });

  it("stores and returns hit-fresh inside max-age", () => {
    let now = 1000;
    const c = new ResponseCache({ defaultMaxAgeMs: 5000, defaultStaleMs: 5000, now: () => now });
    c.absorbResponse("https://ex.com/", baseResponse);
    now = 2000;
    const r = c.lookup("https://ex.com/");
    expect(r.state).toBe("hit-fresh");
  });

  it("returns hit-stale inside stale window", () => {
    let now = 1000;
    const c = new ResponseCache({ defaultMaxAgeMs: 100, defaultStaleMs: 10_000, now: () => now });
    c.absorbResponse("https://ex.com/", baseResponse);
    now = 1500; // past max-age, inside stale
    const r = c.lookup("https://ex.com/");
    expect(r.state).toBe("hit-stale");
  });

  it("returns miss past stale window", () => {
    let now = 1000;
    const c = new ResponseCache({ defaultMaxAgeMs: 100, defaultStaleMs: 100, now: () => now });
    c.absorbResponse("https://ex.com/", baseResponse);
    now = 5000;
    expect(c.lookup("https://ex.com/").state).toBe("miss");
  });

  it("refuses to store no-store responses", () => {
    const c = new ResponseCache();
    const result = c.absorbResponse("https://ex.com/", {
      ...baseResponse,
      headers: { ...baseResponse.headers, "cache-control": "no-store" },
    });
    expect(result).toBeNull();
    expect(c.size).toBe(0);
  });

  it("refuses to store non-2xx responses", () => {
    const c = new ResponseCache();
    const result = c.absorbResponse("https://ex.com/", { ...baseResponse, status: 500 });
    expect(result).toBeNull();
    expect(c.size).toBe(0);
  });

  it("builds revalidation headers from ETag + Last-Modified", () => {
    const c = new ResponseCache();
    c.absorbResponse("https://ex.com/", baseResponse);
    const h = c.buildRevalidationHeaders("https://ex.com/");
    expect(h["if-none-match"]).toBe('"abc"');
    expect(h["if-modified-since"]).toBeDefined();
  });

  it("304 refreshes fetchedAt of the existing entry", () => {
    let now = 1000;
    const c = new ResponseCache({ defaultMaxAgeMs: 100, defaultStaleMs: 100, now: () => now });
    c.absorbResponse("https://ex.com/", baseResponse);
    now = 500_000;
    // Entry is way past stale — 304 should still refresh
    const entry = c.absorbResponse("https://ex.com/", {
      ...baseResponse,
      status: 304,
      body: "",
      bytes: 0,
    });
    expect(entry).not.toBeNull();
    expect(entry?.fetchedAt).toBe(now);
    expect(c.lookup("https://ex.com/").state).toBe("hit-fresh");
  });

  it("304 with no prior cached entry is a no-op", () => {
    const c = new ResponseCache();
    const entry = c.absorbResponse("https://ex.com/", {
      ...baseResponse,
      status: 304,
    });
    expect(entry).toBeNull();
    expect(c.size).toBe(0);
  });

  it("evicts oldest entries past maxEntries", () => {
    const c = new ResponseCache({ maxEntries: 2 });
    c.absorbResponse("https://a.com/", baseResponse);
    c.absorbResponse("https://b.com/", baseResponse);
    c.absorbResponse("https://c.com/", baseResponse);
    expect(c.size).toBe(2);
    expect(c.lookup("https://a.com/").state).toBe("miss");
    expect(c.lookup("https://c.com/").state).toBe("hit-fresh");
  });

  it("touching an entry keeps it from being evicted", () => {
    const c = new ResponseCache({ maxEntries: 2 });
    c.absorbResponse("https://a.com/", baseResponse);
    c.absorbResponse("https://b.com/", baseResponse);
    // Touch a by looking it up
    c.lookup("https://a.com/");
    c.absorbResponse("https://c.com/", baseResponse);
    // b should be gone, a + c present
    expect(c.lookup("https://a.com/").state).toBe("hit-fresh");
    expect(c.lookup("https://b.com/").state).toBe("miss");
    expect(c.lookup("https://c.com/").state).toBe("hit-fresh");
  });

  it("keyFor strips fragments and is idempotent", () => {
    expect(ResponseCache.keyFor("https://ex.com/a#frag")).toBe("https://ex.com/a");
  });

  it("tracks hit/miss stats", () => {
    const c = new ResponseCache();
    c.absorbResponse("https://ex.com/", baseResponse);
    c.lookup("https://ex.com/");
    c.lookup("https://ex.com/");
    c.lookup("https://no.com/");
    const s = c.getStats();
    expect(s.hitFresh).toBe(2);
    expect(s.miss).toBe(1);
    expect(s.size).toBe(1);
  });
});
