/**
 * Tests for the cache invalidation registry — Build-loop Pass 9 (G10).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  registerCacheSubscriber,
  unregisterCacheSubscriber,
  clearAllSubscribers,
  listSubscribers,
  notifyFileChanged,
  allChanges,
  byExtension,
  bySubtree,
} from "./cacheInvalidation";

// Snapshot every subscriber that's already registered (the cache
// modules self-register at module load) so we can restore the
// process-global state after each test.
const initialSubscribers: string[] = [];

beforeEach(() => {
  // Save the current set
  initialSubscribers.length = 0;
  initialSubscribers.push(...listSubscribers());
  clearAllSubscribers();
});

afterEach(() => {
  // We can't recreate the original subscribers from just their names
  // (we don't have their predicate/clear functions handy), so each
  // test that needs the production subscribers must re-register them
  // explicitly. Production code doesn't share state across tests so
  // this is fine — the production subscribers re-register themselves
  // on next module access.
});

describe("registerCacheSubscriber + listSubscribers", () => {
  it("registers and lists by name in sorted order", () => {
    registerCacheSubscriber({
      name: "beta",
      predicate: allChanges,
      clear: () => {},
    });
    registerCacheSubscriber({
      name: "alpha",
      predicate: allChanges,
      clear: () => {},
    });
    expect(listSubscribers()).toEqual(["alpha", "beta"]);
  });

  it("re-registering with the same name replaces the prior entry", () => {
    const a = vi.fn();
    const b = vi.fn();
    registerCacheSubscriber({ name: "x", predicate: allChanges, clear: a });
    registerCacheSubscriber({ name: "x", predicate: allChanges, clear: b });
    notifyFileChanged("foo.ts", "write");
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
    expect(listSubscribers()).toEqual(["x"]);
  });

  it("unregisterCacheSubscriber removes by name", () => {
    registerCacheSubscriber({
      name: "x",
      predicate: allChanges,
      clear: () => {},
    });
    expect(listSubscribers()).toContain("x");
    unregisterCacheSubscriber("x");
    expect(listSubscribers()).not.toContain("x");
  });
});

describe("notifyFileChanged", () => {
  it("returns empty array when there are no subscribers", () => {
    expect(notifyFileChanged("foo.ts", "write")).toEqual([]);
  });

  it("calls clear for matching subscribers and returns their names", () => {
    const clearA = vi.fn();
    const clearB = vi.fn();
    const clearC = vi.fn();
    registerCacheSubscriber({
      name: "alphaCache",
      predicate: byExtension([".ts"]),
      clear: clearA,
    });
    registerCacheSubscriber({
      name: "betaCache",
      predicate: byExtension([".md"]),
      clear: clearB,
    });
    registerCacheSubscriber({
      name: "gammaCache",
      predicate: allChanges,
      clear: clearC,
    });

    const cleared = notifyFileChanged("src/foo.ts", "write");
    expect(cleared.sort()).toEqual(["alphaCache", "gammaCache"]);
    expect(clearA).toHaveBeenCalledTimes(1);
    expect(clearB).not.toHaveBeenCalled();
    expect(clearC).toHaveBeenCalledTimes(1);
  });

  it("swallows errors thrown by clear callbacks", () => {
    const goodClear = vi.fn();
    registerCacheSubscriber({
      name: "bad",
      predicate: allChanges,
      clear: () => {
        throw new Error("boom");
      },
    });
    registerCacheSubscriber({
      name: "good",
      predicate: allChanges,
      clear: goodClear,
    });
    const cleared = notifyFileChanged("foo.ts", "write");
    // Bad subscriber's name is NOT in the cleared list (its clear threw)
    expect(cleared).toContain("good");
    expect(cleared).not.toContain("bad");
    expect(goodClear).toHaveBeenCalledTimes(1);
  });

  it("swallows errors thrown by predicates and treats as no-match", () => {
    const goodClear = vi.fn();
    registerCacheSubscriber({
      name: "buggy",
      predicate: () => {
        throw new Error("predicate boom");
      },
      clear: () => {},
    });
    registerCacheSubscriber({
      name: "ok",
      predicate: allChanges,
      clear: goodClear,
    });
    const cleared = notifyFileChanged("foo.ts", "write");
    expect(cleared).toEqual(["ok"]);
    expect(goodClear).toHaveBeenCalled();
  });

  it("forwards the change kind to the predicate", () => {
    const seen: string[] = [];
    registerCacheSubscriber({
      name: "spy",
      predicate: (_path, kind) => {
        seen.push(kind);
        return true;
      },
      clear: () => {},
    });
    notifyFileChanged("a.ts", "write");
    notifyFileChanged("b.ts", "edit");
    notifyFileChanged("c.ts", "delete");
    expect(seen).toEqual(["write", "edit", "delete"]);
  });
});

describe("allChanges predicate", () => {
  it("returns true for any input", () => {
    expect(allChanges()).toBe(true);
  });
});

describe("byExtension predicate", () => {
  it("matches case-insensitively", () => {
    const pred = byExtension([".ts", ".TSX"]);
    expect(pred("foo.ts", "write")).toBe(true);
    expect(pred("foo.TS", "write")).toBe(true);
    expect(pred("foo.tsx", "write")).toBe(true);
    expect(pred("foo.TSX", "write")).toBe(true);
  });

  it("rejects unsupported extensions", () => {
    const pred = byExtension([".ts"]);
    expect(pred("foo.md", "write")).toBe(false);
    expect(pred("foo.tsx", "write")).toBe(false); // .tsx is NOT .ts
  });

  it("rejects files without an extension", () => {
    const pred = byExtension([".ts"]);
    expect(pred("Makefile", "write")).toBe(false);
  });

  it("matches the LAST dot only", () => {
    const pred = byExtension([".ts"]);
    expect(pred("foo.test.ts", "write")).toBe(true);
    expect(pred("foo.ts.bak", "write")).toBe(false);
  });
});

describe("bySubtree predicate", () => {
  it("matches files inside the subtree", () => {
    const pred = bySubtree(["server"]);
    expect(pred("server/index.ts", "write")).toBe(true);
    expect(pred("server/services/foo.ts", "write")).toBe(true);
  });

  it("matches the subtree root itself", () => {
    const pred = bySubtree(["server"]);
    expect(pred("server", "write")).toBe(true);
  });

  it("does NOT match outside the subtree", () => {
    const pred = bySubtree(["server"]);
    expect(pred("client/foo.ts", "write")).toBe(false);
  });

  it("does NOT match a sibling with the same prefix", () => {
    const pred = bySubtree(["server"]);
    // "server-utils/foo.ts" must NOT match "server/" because the
    // subtree boundary requires a trailing slash.
    expect(pred("server-utils/foo.ts", "write")).toBe(false);
  });

  it("supports multiple subtrees", () => {
    const pred = bySubtree(["server", "shared"]);
    expect(pred("server/foo.ts", "write")).toBe(true);
    expect(pred("shared/foo.ts", "write")).toBe(true);
    expect(pred("client/foo.ts", "write")).toBe(false);
  });

  it("normalizes trailing slashes", () => {
    const pred = bySubtree(["server/"]);
    expect(pred("server/foo.ts", "write")).toBe(true);
  });
});
