/**
 * a11yAnnouncer.test.ts — Parity Pass 3.
 *
 * Locks in the pure string builders + the throttle reducer against
 * regressions so the screen-reader copy doesn't drift when we add
 * new tools or rename existing ones.
 */

import { describe, it, expect } from "vitest";
import {
  buildToolStartAnnouncement,
  buildToolFinishAnnouncement,
  buildMessageAnnouncement,
  buildAbortAnnouncement,
  buildStreamErrorAnnouncement,
  throttleAnnouncement,
  flushPending,
  trimPreview,
  emptyThrottleState,
} from "./a11yAnnouncer";

// ─── Tool start ───────────────────────────────────────────────────────

describe("buildToolStartAnnouncement", () => {
  it("announces read_file with path", () => {
    expect(buildToolStartAnnouncement("read_file", { path: "server/auth.ts" })).toBe(
      "Reading server/auth.ts",
    );
  });

  it("falls back to generic read when path missing", () => {
    expect(buildToolStartAnnouncement("read_file", {})).toBe("Reading file");
  });

  it("announces list_directory", () => {
    expect(buildToolStartAnnouncement("list_directory", { path: "server/" })).toBe(
      "Listing server/",
    );
  });

  it("announces grep_search with pattern", () => {
    expect(buildToolStartAnnouncement("grep_search", { pattern: "getUser" })).toBe(
      'Searching for "getUser"',
    );
  });

  it("announces write_file", () => {
    expect(buildToolStartAnnouncement("write_file", { path: "a.ts" })).toBe("Writing a.ts");
  });

  it("announces edit_file", () => {
    expect(buildToolStartAnnouncement("edit_file", { path: "a.ts" })).toBe("Editing a.ts");
  });

  it("announces multi_edit distinctly from edit_file", () => {
    const msg = buildToolStartAnnouncement("multi_edit", { path: "a.ts" });
    expect(msg).toContain("batch");
    expect(msg).toContain("a.ts");
  });

  it("announces run_bash with a trimmed command preview", () => {
    const long = "echo hello && " + "x".repeat(200);
    const msg = buildToolStartAnnouncement("run_bash", { command: long });
    expect(msg.startsWith("Running command:")).toBe(true);
    expect(msg.length).toBeLessThan(100);
  });

  it("announces web_fetch with url", () => {
    expect(
      buildToolStartAnnouncement("web_fetch", { url: "https://example.com/api" }),
    ).toBe("Fetching https://example.com/api");
  });

  it("announces find_symbol with name", () => {
    expect(buildToolStartAnnouncement("find_symbol", { name: "useAuth" })).toBe(
      "Finding symbol useAuth",
    );
  });

  it("announces update_todos as progress update", () => {
    expect(buildToolStartAnnouncement("update_todos", {})).toBe("Updating progress list");
  });

  it("announces finish", () => {
    expect(buildToolStartAnnouncement("finish", {})).toBe("Finishing up");
  });

  it("falls back for unknown tools", () => {
    expect(buildToolStartAnnouncement("custom_tool", {})).toBe("Running custom_tool");
  });
});

// ─── Tool finish ──────────────────────────────────────────────────────

describe("buildToolFinishAnnouncement", () => {
  it("announces read complete with path", () => {
    expect(
      buildToolFinishAnnouncement("read_file", { path: "a.ts" }, "read", undefined),
    ).toBe("Read a.ts");
  });

  it("announces multi_edit finish with path", () => {
    expect(
      buildToolFinishAnnouncement("multi_edit", { path: "a.ts" }, "multi_edit", undefined),
    ).toBe("Applied batch edits to a.ts");
  });

  it("surfaces error kind with a failure string", () => {
    expect(
      buildToolFinishAnnouncement("read_file", { path: "a.ts" }, "error", undefined),
    ).toBe("read file failed");
  });

  it("surfaces error message when provided", () => {
    const msg = buildToolFinishAnnouncement(
      "web_fetch",
      { url: "https://x" },
      "error",
      "HTTP 404 Not Found",
    );
    expect(msg).toContain("failed");
    expect(msg).toContain("404");
  });

  it("truncates long error messages", () => {
    const long = "a".repeat(500);
    const msg = buildToolFinishAnnouncement("run_bash", {}, "error", long);
    expect(msg.length).toBeLessThan(200);
    expect(msg.endsWith("…")).toBe(true);
  });
});

// ─── Other builders ───────────────────────────────────────────────────

describe("buildMessageAnnouncement", () => {
  it("returns a default when preview is empty", () => {
    expect(buildMessageAnnouncement(undefined)).toBe("Agent reply ready");
    expect(buildMessageAnnouncement("")).toBe("Agent reply ready");
    expect(buildMessageAnnouncement("   ")).toBe("Agent reply ready");
  });

  it("embeds a trimmed preview in the announcement", () => {
    const result = buildMessageAnnouncement("Here is my answer to your question.");
    expect(result).toContain("Agent reply ready");
    expect(result).toContain("answer");
  });

  it("collapses runs of whitespace in the preview", () => {
    const result = buildMessageAnnouncement("a   b\n\n\nc");
    expect(result).toContain("a b c");
  });

  it("clips very long previews", () => {
    const long = "word ".repeat(200);
    const result = buildMessageAnnouncement(long);
    expect(result.length).toBeLessThan(220);
    expect(result.endsWith("…")).toBe(true);
  });
});

describe("buildAbortAnnouncement", () => {
  it("returns a fixed string", () => {
    expect(buildAbortAnnouncement()).toBe("Agent run aborted");
  });
});

describe("buildStreamErrorAnnouncement", () => {
  it("uses default when message missing", () => {
    expect(buildStreamErrorAnnouncement(undefined)).toBe("Agent stream error");
    expect(buildStreamErrorAnnouncement("")).toBe("Agent stream error");
  });

  it("embeds and trims provided message", () => {
    expect(buildStreamErrorAnnouncement("network timeout")).toContain("network timeout");
  });
});

// ─── Throttle reducer ─────────────────────────────────────────────────

describe("throttleAnnouncement", () => {
  it("emits on first event", () => {
    const { emit, next } = throttleAnnouncement(emptyThrottleState, "hello", 1000, 300);
    expect(emit).toBe("hello");
    expect(next.lastEmitted).toBe("hello");
    expect(next.lastEmittedAt).toBe(1000);
  });

  it("queues subsequent events inside the window", () => {
    const s1 = throttleAnnouncement(emptyThrottleState, "one", 1000, 300).next;
    const r2 = throttleAnnouncement(s1, "two", 1100, 300);
    expect(r2.emit).toBeNull();
    expect(r2.next.pending).toBe("two");
  });

  it("emits when the window has passed", () => {
    const s1 = throttleAnnouncement(emptyThrottleState, "one", 1000, 300).next;
    const r2 = throttleAnnouncement(s1, "two", 1400, 300);
    expect(r2.emit).toBe("two");
    expect(r2.next.pending).toBeNull();
    expect(r2.next.lastEmitted).toBe("two");
  });

  it("does not re-emit the same text", () => {
    const s1 = throttleAnnouncement(emptyThrottleState, "hi", 1000, 300).next;
    const r2 = throttleAnnouncement(s1, "hi", 2000, 300);
    expect(r2.emit).toBeNull();
    expect(r2.next).toEqual(s1);
  });

  it("ignores empty text", () => {
    const r = throttleAnnouncement(emptyThrottleState, "", 1000, 300);
    expect(r.emit).toBeNull();
  });

  it("pending updates overwrite earlier pending within the window", () => {
    const s1 = throttleAnnouncement(emptyThrottleState, "a", 0, 300).next;
    const s2 = throttleAnnouncement(s1, "b", 100, 300).next;
    const s3 = throttleAnnouncement(s2, "c", 200, 300).next;
    expect(s3.pending).toBe("c");
  });
});

describe("flushPending", () => {
  it("is a no-op with no pending", () => {
    expect(flushPending(emptyThrottleState, 1000, 300)).toEqual({
      emit: null,
      next: emptyThrottleState,
    });
  });

  it("is a no-op while still inside the window", () => {
    const queued = { lastEmitted: "a", pending: "b", lastEmittedAt: 900 };
    const r = flushPending(queued, 1000, 300);
    expect(r.emit).toBeNull();
  });

  it("emits pending once the window passes", () => {
    const queued = { lastEmitted: "a", pending: "b", lastEmittedAt: 0 };
    const r = flushPending(queued, 400, 300);
    expect(r.emit).toBe("b");
    expect(r.next.pending).toBeNull();
    expect(r.next.lastEmitted).toBe("b");
  });
});

// ─── trimPreview ──────────────────────────────────────────────────────

describe("trimPreview", () => {
  it("returns input unchanged when short", () => {
    expect(trimPreview("abc", 10)).toBe("abc");
  });

  it("clips at word boundary when possible", () => {
    const result = trimPreview("hello world foo bar", 12);
    expect(result.endsWith("…")).toBe(true);
    expect(result.length).toBeLessThanOrEqual(13);
  });

  it("falls back to hard cut when no good word boundary", () => {
    const result = trimPreview("onelongunbrokenstring", 10);
    expect(result.endsWith("…")).toBe(true);
    expect(result.length).toBeLessThanOrEqual(11);
  });
});
