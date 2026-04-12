/**
 * parallelFetch — pass 9, scope: browser/device automation parity.
 *
 * Concurrency-limited batch URL reader. Takes a list of URLs and an
 * `{ reader, concurrency }` config, then runs reads in parallel with
 * a bounded worker pool. Returns results IN INPUT ORDER regardless of
 * completion order, which is what every downstream consumer expects.
 *
 * Design choices:
 *   - Pure async function — no classes, no singletons. Reusable from
 *     the code chat dispatcher, the crawlSession BFS layer, or a
 *     future multi-agent orchestrator.
 *   - `reader` is duck-typed to `{readPage(url)}` so it works with
 *     both the live WebNavigator and stub readers in tests.
 *   - Each URL's fetch is isolated: one failure does NOT halt the
 *     batch. Errors are captured into the per-result `error` field
 *     and returned alongside successes.
 *   - Dedupe on input: if a URL appears twice, it's fetched once and
 *     its result broadcast to every duplicate slot (saves bandwidth
 *     on noisy inputs).
 *   - `onProgress` callback fires after every completion so callers
 *     can stream progress to a UI without awaiting the whole batch.
 *   - Hard cap on URLs per batch (default 50) to prevent runaway
 *     loops from blowing the rate limiter. Configurable via
 *     `maxUrls`.
 *   - Hard cap on concurrency (default 4, max 10) — we're bounded by
 *     the per-domain rate limiter anyway, so more workers just
 *     waste memory.
 */

import type { PageView } from "./webNavigator";

export interface ParallelFetchReader {
  readPage(url: string): Promise<PageView>;
}

export interface ParallelFetchOptions {
  /** Parallel worker count. Default 4, hard cap 10. */
  concurrency?: number;
  /** Max URLs per batch. Default 50, hard cap 200. */
  maxUrls?: number;
  /** Per-URL timeout (ms). If set, wraps each read in a race. */
  perUrlTimeoutMs?: number;
  /** Fires after each completion. */
  onProgress?: (entry: ParallelFetchEntry) => void | Promise<void>;
}

export interface ParallelFetchEntry {
  /** Original URL as passed in */
  url: string;
  /** Input index for order preservation */
  index: number;
  /** Populated on success */
  view?: PageView;
  /** Populated on failure */
  error?: string;
  /** Fetch duration (ms) */
  durationMs: number;
  /** Whether this entry shared a result with a prior duplicate */
  deduped: boolean;
}

export interface ParallelFetchSummary {
  entries: ParallelFetchEntry[];
  totalMs: number;
  uniqueRequests: number;
  successful: number;
  failed: number;
}

const HARD_MAX_CONCURRENCY = 10;
const HARD_MAX_URLS = 200;

/**
 * Run N URLs through `reader.readPage` with a bounded worker pool.
 * Returns entries in input order.
 */
export async function parallelFetch(
  reader: ParallelFetchReader,
  urls: string[],
  opts: ParallelFetchOptions = {},
): Promise<ParallelFetchSummary> {
  const startedAt = Date.now();
  const maxUrls = Math.min(Math.max(opts.maxUrls ?? 50, 1), HARD_MAX_URLS);
  const concurrency = Math.min(
    Math.max(opts.concurrency ?? 4, 1),
    HARD_MAX_CONCURRENCY,
  );
  const perUrlTimeoutMs = opts.perUrlTimeoutMs;

  const sliced = urls.slice(0, maxUrls);
  const entries: ParallelFetchEntry[] = sliced.map((url, index) => ({
    url,
    index,
    durationMs: 0,
    deduped: false,
  }));

  // Group duplicate URLs so a URL that appears twice only fetches once.
  const firstIndexByUrl = new Map<string, number>();
  const uniqueIndices: number[] = [];
  for (let i = 0; i < entries.length; i++) {
    const url = entries[i].url;
    const existing = firstIndexByUrl.get(url);
    if (existing === undefined) {
      firstIndexByUrl.set(url, i);
      uniqueIndices.push(i);
    } else {
      entries[i].deduped = true;
    }
  }

  // Worker pool — simple index-based queue so we don't need async
  // iterators / lib dependencies.
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= uniqueIndices.length) return;
      const entryIdx = uniqueIndices[i];
      const entry = entries[entryIdx];
      const t0 = Date.now();
      try {
        const readPromise = reader.readPage(entry.url);
        let view: PageView;
        if (perUrlTimeoutMs && perUrlTimeoutMs > 0) {
          view = await Promise.race([
            readPromise,
            new Promise<PageView>((_, reject) =>
              setTimeout(() => reject(new Error(`parallelFetch timeout after ${perUrlTimeoutMs}ms`)), perUrlTimeoutMs),
            ),
          ]);
        } else {
          view = await readPromise;
        }
        entry.view = view;
        entry.durationMs = Date.now() - t0;
      } catch (err) {
        entry.error = err instanceof Error ? err.message : String(err);
        entry.durationMs = Date.now() - t0;
      }
      // Broadcast to any duplicates of this URL
      for (let j = 0; j < entries.length; j++) {
        if (j === entryIdx) continue;
        if (entries[j].deduped && entries[j].url === entry.url) {
          entries[j].view = entry.view;
          entries[j].error = entry.error;
          entries[j].durationMs = entry.durationMs;
        }
      }
      if (opts.onProgress) {
        try {
          await opts.onProgress(entry);
        } catch {
          /* never let a progress callback break the pool */
        }
      }
    }
  }

  const workerCount = Math.min(concurrency, uniqueIndices.length);
  const workers: Promise<void>[] = [];
  for (let w = 0; w < workerCount; w++) workers.push(worker());
  await Promise.all(workers);

  const successful = entries.filter((e) => e.view !== undefined && !e.error).length;
  const failed = entries.filter((e) => e.error !== undefined).length;

  return {
    entries,
    totalMs: Date.now() - startedAt,
    uniqueRequests: uniqueIndices.length,
    successful,
    failed,
  };
}
