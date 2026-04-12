import { describe, it, expect } from "vitest";
import { parallelFetch, type ParallelFetchReader } from "./parallelFetch";
import type { PageView } from "./webNavigator";

function makeView(url: string, title = "ok"): PageView {
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
    links: [],
    images: [],
    forms: [],
    wordCount: 1,
    fetchedAt: new Date().toISOString(),
    fetchMs: 1,
    truncated: false,
  };
}

function delayReader(delayMs: number, failFor: string[] = []): ParallelFetchReader {
  return {
    async readPage(url: string) {
      await new Promise((r) => setTimeout(r, delayMs));
      if (failFor.includes(url)) throw new Error(`boom: ${url}`);
      return makeView(url);
    },
  };
}

describe("parallelFetch", () => {
  it("reads every URL in input order", async () => {
    const reader = delayReader(5);
    const summary = await parallelFetch(reader, [
      "https://a.com/",
      "https://b.com/",
      "https://c.com/",
    ]);
    expect(summary.entries.map((e) => e.url)).toEqual([
      "https://a.com/",
      "https://b.com/",
      "https://c.com/",
    ]);
    expect(summary.entries.every((e) => !!e.view)).toBe(true);
    expect(summary.successful).toBe(3);
    expect(summary.failed).toBe(0);
  });

  it("isolates per-URL failures (one fails, others succeed)", async () => {
    const reader = delayReader(5, ["https://b.com/"]);
    const summary = await parallelFetch(reader, [
      "https://a.com/",
      "https://b.com/",
      "https://c.com/",
    ]);
    expect(summary.successful).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.entries[1].error).toContain("boom");
    expect(summary.entries[0].view).toBeDefined();
    expect(summary.entries[2].view).toBeDefined();
  });

  it("respects concurrency cap (detected via max-in-flight counter)", async () => {
    let inFlight = 0;
    let peak = 0;
    const reader: ParallelFetchReader = {
      async readPage(url: string) {
        inFlight++;
        if (inFlight > peak) peak = inFlight;
        await new Promise((r) => setTimeout(r, 20));
        inFlight--;
        return makeView(url);
      },
    };
    const urls = Array.from({ length: 10 }, (_, i) => `https://ex.com/p${i}`);
    await parallelFetch(reader, urls, { concurrency: 3 });
    expect(peak).toBeLessThanOrEqual(3);
  });

  it("dedupes duplicate URLs in the input (one fetch, broadcast result)", async () => {
    let calls = 0;
    const reader: ParallelFetchReader = {
      async readPage(url: string) {
        calls++;
        return makeView(url);
      },
    };
    const summary = await parallelFetch(reader, [
      "https://ex.com/",
      "https://ex.com/",
      "https://ex.com/",
    ]);
    expect(calls).toBe(1);
    expect(summary.uniqueRequests).toBe(1);
    expect(summary.entries.every((e) => e.view?.url === "https://ex.com/")).toBe(true);
    expect(summary.entries.slice(1).every((e) => e.deduped)).toBe(true);
  });

  it("clamps maxUrls to HARD_MAX_URLS (200)", async () => {
    const urls = Array.from({ length: 500 }, (_, i) => `https://ex.com/p${i}`);
    const reader = delayReader(0);
    const summary = await parallelFetch(reader, urls, { maxUrls: 500 });
    expect(summary.entries).toHaveLength(200);
  });

  it("clamps concurrency to HARD_MAX_CONCURRENCY (10)", async () => {
    let peak = 0;
    let inFlight = 0;
    const reader: ParallelFetchReader = {
      async readPage(url: string) {
        inFlight++;
        if (inFlight > peak) peak = inFlight;
        await new Promise((r) => setTimeout(r, 10));
        inFlight--;
        return makeView(url);
      },
    };
    const urls = Array.from({ length: 30 }, (_, i) => `https://ex.com/p${i}`);
    await parallelFetch(reader, urls, { concurrency: 999 });
    expect(peak).toBeLessThanOrEqual(10);
  });

  it("per-URL timeout marks the slow fetch as an error", async () => {
    const reader: ParallelFetchReader = {
      async readPage(url: string) {
        if (url === "https://slow.com/") {
          await new Promise((r) => setTimeout(r, 200));
        }
        return makeView(url);
      },
    };
    const summary = await parallelFetch(
      reader,
      ["https://fast.com/", "https://slow.com/"],
      { perUrlTimeoutMs: 30 },
    );
    expect(summary.entries[0].view).toBeDefined();
    expect(summary.entries[1].error).toMatch(/timeout/);
  });

  it("fires onProgress for each completion", async () => {
    const seen: string[] = [];
    const reader = delayReader(5);
    await parallelFetch(reader, ["https://a.com/", "https://b.com/"], {
      onProgress: (e) => void seen.push(e.url),
    });
    expect(seen.sort()).toEqual(["https://a.com/", "https://b.com/"]);
  });

  it("swallows onProgress errors without halting the batch", async () => {
    const reader = delayReader(5);
    const summary = await parallelFetch(
      reader,
      ["https://a.com/", "https://b.com/"],
      {
        onProgress: () => {
          throw new Error("nope");
        },
      },
    );
    expect(summary.successful).toBe(2);
  });

  it("handles an empty input array", async () => {
    const reader = delayReader(5);
    const summary = await parallelFetch(reader, []);
    expect(summary.entries).toEqual([]);
    expect(summary.successful).toBe(0);
    expect(summary.failed).toBe(0);
    expect(summary.uniqueRequests).toBe(0);
  });

  it("is strictly faster than sequential for N > concurrency", async () => {
    // This is a timing test — we give it slack. Concurrency=4 with 8
    // tasks of 40ms each should take ~2 batches ≈ 80ms. Sequential
    // would take 320ms. If we see > 200ms the pool is broken.
    const reader = delayReader(40);
    const urls = Array.from({ length: 8 }, (_, i) => `https://ex.com/p${i}`);
    const t0 = Date.now();
    await parallelFetch(reader, urls, { concurrency: 4 });
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(200);
  });
});
