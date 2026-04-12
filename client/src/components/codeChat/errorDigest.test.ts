/**
 * Tests for error digest — Pass 267.
 */

import { describe, it, expect } from "vitest";
import {
  buildDigest,
  classifyError,
  topErrorKeywords,
  formatDigestMarkdown,
} from "./errorDigest";

describe("classifyError", () => {
  it("detects rate limit", () => {
    expect(classifyError("hit rate-limit from provider")).toBe("rate_limit");
    expect(classifyError("429 Too Many Requests")).toBe("rate_limit");
  });

  it("detects bash exit code", () => {
    expect(classifyError("command failed: exit code 42")).toBe("bash_exit");
  });

  it("detects typescript diagnostic", () => {
    expect(classifyError("TS2304: Cannot find name 'Foo'")).toBe("diagnostic");
    expect(classifyError("Type 'X' is not assignable to 'Y'")).toBe("diagnostic");
  });

  it("detects tool error", () => {
    expect(classifyError("write_file error: permission denied")).toBe("tool_error");
  });

  it("falls back to unknown", () => {
    expect(classifyError("generic failure")).toBe("unknown");
  });
});

describe("buildDigest", () => {
  it("returns empty for empty messages", () => {
    const d = buildDigest([]);
    expect(d.totalCount).toBe(0);
  });

  it("extracts tool_result errors", () => {
    const d = buildDigest([
      {
        id: "m1",
        role: "assistant",
        content: "",
        toolEvents: [
          {
            stepIndex: 1,
            toolName: "read_file",
            kind: "error",
            preview: JSON.stringify({ error: "file not found" }),
          },
        ],
      },
    ]);
    expect(d.totalCount).toBe(1);
    expect(d.entries[0].source).toBe("tool_error");
    expect(d.entries[0].summary).toBe("file not found");
  });

  it("detects bash non-zero exit", () => {
    const d = buildDigest([
      {
        id: "m1",
        role: "assistant",
        content: "",
        toolEvents: [
          {
            stepIndex: 1,
            toolName: "run_bash",
            kind: "bash",
            preview: JSON.stringify({
              kind: "bash",
              result: { exitCode: 1, stderr: "boom" },
            }),
          },
        ],
      },
    ]);
    expect(d.entries[0].source).toBe("bash_exit");
    expect(d.entries[0].summary).toContain("exit 1");
  });

  it("extracts Error: lines from assistant content", () => {
    const d = buildDigest([
      {
        id: "m1",
        role: "assistant",
        content: "Doing work...\nError: Something broke\nContinuing anyway.",
      },
    ]);
    expect(d.totalCount).toBe(1);
    expect(d.entries[0].summary).toContain("Something broke");
  });

  it("detects rate limit mentions", () => {
    const d = buildDigest([
      {
        id: "m1",
        role: "assistant",
        content: "Got a 429 rate-limit from the model",
      },
    ]);
    expect(d.totalCount).toBe(1);
    expect(d.entries[0].source).toBe("rate_limit");
  });

  it("ignores user messages", () => {
    const d = buildDigest([
      {
        id: "m1",
        role: "user",
        content: "Error: I want you to fix this",
      },
    ]);
    expect(d.totalCount).toBe(0);
  });

  it("dedupes identical errors within the same message", () => {
    const d = buildDigest([
      {
        id: "m1",
        role: "assistant",
        content: "Error: same thing\nError: same thing",
      },
    ]);
    expect(d.totalCount).toBe(1);
  });

  it("counts per-source in bySource", () => {
    const d = buildDigest([
      {
        id: "m1",
        role: "assistant",
        content: "Error: boom",
        toolEvents: [
          {
            stepIndex: 1,
            toolName: "read_file",
            kind: "error",
            preview: JSON.stringify({ error: "tool fail" }),
          },
        ],
      },
    ]);
    expect(d.bySource.tool_error).toBe(1);
    expect(d.bySource.unknown).toBeGreaterThanOrEqual(1);
  });

  it("handles malformed tool preview gracefully", () => {
    const d = buildDigest([
      {
        id: "m1",
        role: "assistant",
        content: "",
        toolEvents: [
          {
            stepIndex: 1,
            toolName: "read_file",
            kind: "error",
            preview: "{oops",
          },
        ],
      },
    ]);
    expect(d.totalCount).toBe(1);
  });
});

describe("topErrorKeywords", () => {
  it("returns empty for empty entries", () => {
    expect(topErrorKeywords([])).toEqual([]);
  });

  it("extracts most frequent words", () => {
    const entries = [
      {
        id: "e1",
        source: "unknown" as const,
        summary: "connection timeout",
        detail: "",
        timestamp: 0,
      },
      {
        id: "e2",
        source: "unknown" as const,
        summary: "connection refused",
        detail: "",
        timestamp: 0,
      },
    ];
    const top = topErrorKeywords(entries);
    expect(top.some((t) => t.word === "connection")).toBe(true);
    expect(top.find((t) => t.word === "connection")?.count).toBe(2);
  });

  it("filters stopwords", () => {
    const entries = [
      {
        id: "e1",
        source: "unknown" as const,
        summary: "the thing failed in the network",
        detail: "",
        timestamp: 0,
      },
    ];
    const top = topErrorKeywords(entries);
    expect(top.some((t) => t.word === "the")).toBe(false);
    expect(top.some((t) => t.word === "error")).toBe(false);
  });

  it("respects limit parameter", () => {
    const entries = Array.from({ length: 20 }, (_, i) => ({
      id: `e${i}`,
      source: "unknown" as const,
      summary: `unique_keyword_${i} occurred`,
      detail: "",
      timestamp: 0,
    }));
    const top = topErrorKeywords(entries, 5);
    expect(top.length).toBeLessThanOrEqual(5);
  });
});

describe("formatDigestMarkdown", () => {
  it("returns 'no errors' message when empty", () => {
    const md = formatDigestMarkdown({
      entries: [],
      totalCount: 0,
      bySource: {
        tool_error: 0,
        bash_exit: 0,
        diagnostic: 0,
        assistant_error: 0,
        rate_limit: 0,
        unknown: 0,
      },
      topKeywords: [],
    });
    expect(md).toContain("No errors");
  });

  it("includes per-source counts", () => {
    const md = formatDigestMarkdown({
      entries: [
        {
          id: "e1",
          source: "tool_error",
          summary: "boom",
          detail: "",
          timestamp: 0,
        },
      ],
      totalCount: 1,
      bySource: {
        tool_error: 1,
        bash_exit: 0,
        diagnostic: 0,
        assistant_error: 0,
        rate_limit: 0,
        unknown: 0,
      },
      topKeywords: [],
    });
    expect(md).toContain("tool_error");
    expect(md).toContain("boom");
  });

  it("truncates to 20 entries with ellipsis", () => {
    const entries = Array.from({ length: 25 }, (_, i) => ({
      id: `e${i}`,
      source: "unknown" as const,
      summary: `error ${i}`,
      detail: "",
      timestamp: 0,
    }));
    const md = formatDigestMarkdown({
      entries,
      totalCount: 25,
      bySource: {
        tool_error: 0,
        bash_exit: 0,
        diagnostic: 0,
        assistant_error: 0,
        rate_limit: 0,
        unknown: 25,
      },
      topKeywords: [],
    });
    expect(md).toContain("and 5 more");
  });
});
