/**
 * Tests for conversationExport.ts (Pass 208).
 */

import { describe, it, expect } from "vitest";
import {
  exportConversationAsMarkdown,
  exportSingleMessageAsMarkdown,
} from "./conversationExport";
import type { CodeChatMessage } from "@/hooks/useCodeChatStream";

const user = (content: string): CodeChatMessage => ({
  id: "u1",
  role: "user",
  content,
  timestamp: new Date("2026-04-10T00:00:00Z"),
});

const assistant = (
  content: string,
  extras: Partial<CodeChatMessage> = {},
): CodeChatMessage => ({
  id: "a1",
  role: "assistant",
  content,
  timestamp: new Date("2026-04-10T00:00:05Z"),
  model: "claude-sonnet-4-6",
  iterations: 2,
  toolCallCount: 1,
  totalDurationMs: 3200,
  ...extras,
});

describe("exportConversationAsMarkdown", () => {
  it("emits a title header and per-message blocks", () => {
    const md = exportConversationAsMarkdown([
      user("what is 2+2"),
      assistant("4"),
    ]);
    expect(md).toContain("# Code Chat transcript");
    expect(md).toContain("▸ User");
    expect(md).toContain("◂ Assistant");
    expect(md).toContain("what is 2+2");
    expect(md).toContain("4");
  });

  it("includes metadata footer by default", () => {
    const md = exportConversationAsMarkdown([assistant("hi")]);
    expect(md).toMatch(/claude-sonnet-4-6/);
    expect(md).toMatch(/1 tool calls/);
    expect(md).toMatch(/2 iterations/);
    expect(md).toMatch(/3\.2s/);
  });

  it("omits metadata when includeMetadata:false", () => {
    const md = exportConversationAsMarkdown([assistant("hi")], {
      includeMetadata: false,
    });
    expect(md).not.toContain("claude-sonnet-4-6");
    expect(md).not.toContain("iterations");
  });

  it("includes tool call trace as a collapsible details block", () => {
    const md = exportConversationAsMarkdown([
      assistant("done", {
        toolEvents: [
          {
            stepIndex: 1,
            toolName: "read_file",
            args: { path: "server/index.ts" },
            status: "complete",
            durationMs: 42,
          },
          {
            stepIndex: 2,
            toolName: "grep_search",
            args: { pattern: "getDb" },
            status: "complete",
            durationMs: 18,
          },
        ],
      }),
    ]);
    expect(md).toContain("<details>");
    expect(md).toContain("2 tool calls</summary>");
    expect(md).toContain("`read_file`");
    expect(md).toContain("path=");
    expect(md).toContain("`grep_search`");
    expect(md).toContain("42ms");
  });

  it("truncates long tool argument values", () => {
    const md = exportConversationAsMarkdown([
      assistant("done", {
        toolEvents: [
          {
            stepIndex: 1,
            toolName: "write_file",
            args: { content: "x".repeat(200) },
            status: "complete",
            durationMs: 10,
          },
        ],
      }),
    ]);
    expect(md).toContain("…");
    expect(md).not.toContain("x".repeat(200));
  });

  it("omits traces when includeTraces:false", () => {
    const md = exportConversationAsMarkdown(
      [
        assistant("done", {
          toolEvents: [
            {
              stepIndex: 1,
              toolName: "read_file",
              args: {},
              status: "complete",
            },
          ],
        }),
      ],
      { includeTraces: false },
    );
    expect(md).not.toContain("<details>");
  });

  it("uses a custom title when provided", () => {
    const md = exportConversationAsMarkdown([user("hi")], {
      title: "My Session",
    });
    expect(md).toContain("# My Session");
  });
});

describe("exportSingleMessageAsMarkdown", () => {
  it("wraps a single assistant message in the response title", () => {
    const md = exportSingleMessageAsMarkdown(assistant("42"));
    expect(md).toContain("# Code Chat — response");
    expect(md).toContain("42");
  });
  it("wraps a single user message in the prompt title", () => {
    const md = exportSingleMessageAsMarkdown(user("what is 42"));
    expect(md).toContain("# Code Chat — user prompt");
    expect(md).toContain("what is 42");
  });
});
