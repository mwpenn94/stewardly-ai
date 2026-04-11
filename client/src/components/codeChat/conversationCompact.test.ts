/**
 * Tests for conversationCompact.ts (Pass 232).
 */

import { describe, it, expect } from "vitest";
import {
  compactConversation,
  buildSummary,
} from "./conversationCompact";
import type { CodeChatMessage } from "@/hooks/useCodeChatStream";

const user = (id: string, content: string): CodeChatMessage => ({
  id,
  role: "user",
  content,
  timestamp: new Date("2026-04-10T00:00:00Z"),
});

const assistant = (
  id: string,
  content: string,
  overrides: Partial<CodeChatMessage> = {},
): CodeChatMessage => ({
  id,
  role: "assistant",
  content,
  timestamp: new Date("2026-04-10T00:00:05Z"),
  ...overrides,
});

describe("compactConversation", () => {
  it("no-ops when under the keepRecent threshold", () => {
    const msgs = [user("u1", "hello"), assistant("a1", "hi")];
    const r = compactConversation(msgs, 4);
    expect(r.compacted).toBe(false);
    expect(r.messages).toEqual(msgs);
    expect(r.collapsed).toBe(0);
  });

  it("collapses older turns into a single summary message", () => {
    const msgs = [
      user("u1", "first"),
      assistant("a1", "first reply"),
      user("u2", "second"),
      assistant("a2", "second reply"),
      user("u3", "third"),
      assistant("a3", "third reply"),
      user("u4", "fourth"),
      assistant("a4", "fourth reply"),
    ];
    const r = compactConversation(msgs, 4);
    expect(r.compacted).toBe(true);
    expect(r.collapsed).toBe(4);
    // Result: summary + 4 recent = 5
    expect(r.messages).toHaveLength(5);
    expect(r.messages[0].role).toBe("assistant");
    expect(r.messages[0].model).toBe("[compacted]");
    // The last 4 messages are preserved verbatim
    expect(r.messages[1].id).toBe("u3");
    expect(r.messages[4].id).toBe("a4");
  });

  it("keeps every recent message intact", () => {
    const msgs = Array.from({ length: 10 }, (_, i) =>
      i % 2 === 0
        ? user(`u${i}`, `prompt ${i}`)
        : assistant(`a${i}`, `reply ${i}`),
    );
    const r = compactConversation(msgs, 4);
    const recent = r.messages.slice(1); // skip the summary
    expect(recent.map((m) => m.id)).toEqual(["u6", "a7", "u8", "a9"]);
  });

  it("handles keepRecent = 0 by collapsing everything", () => {
    const msgs = [
      user("u1", "only prompt"),
      assistant("a1", "only reply"),
    ];
    const r = compactConversation(msgs, 0);
    expect(r.compacted).toBe(true);
    expect(r.messages).toHaveLength(1);
    expect(r.messages[0].role).toBe("assistant");
    expect(r.messages[0].model).toBe("[compacted]");
    expect(r.collapsed).toBe(2);
  });

  it("clamps negative keepRecent to 0", () => {
    const msgs = [user("u1", "x"), assistant("a1", "y")];
    const r = compactConversation(msgs, -5);
    expect(r.compacted).toBe(true);
    expect(r.messages).toHaveLength(1);
  });

  it("returns the original list when only the recent window exists", () => {
    const msgs = [user("u1", "first"), assistant("a1", "reply")];
    const r = compactConversation(msgs, 4);
    expect(r.compacted).toBe(false);
    expect(r.messages).toBe(msgs);
  });
});

describe("buildSummary", () => {
  it("includes a [compacted] marker and message count", () => {
    const summary = buildSummary([user("u1", "hi")]);
    expect(summary).toContain("[compacted]");
    expect(summary).toContain("1 earlier message");
  });

  it("lists every user prompt as a bullet", () => {
    const summary = buildSummary([
      user("u1", "explain the wealth engine"),
      user("u2", "where is auth handled"),
    ]);
    expect(summary).toContain("- explain the wealth engine");
    expect(summary).toContain("- where is auth handled");
  });

  it("truncates long prompts to 100 chars", () => {
    const long = "a".repeat(200);
    const summary = buildSummary([user("u1", long)]);
    const lines = summary.split("\n");
    const bullet = lines.find((l) => l.startsWith("- "));
    expect(bullet!.length).toBeLessThanOrEqual(105);
    expect(bullet).toContain("…");
  });

  it("aggregates tool-call activity across assistant turns", () => {
    const summary = buildSummary([
      user("u1", "explore"),
      assistant("a1", "done", {
        toolEvents: [
          { stepIndex: 1, toolName: "read_file", args: {}, status: "complete" },
          { stepIndex: 2, toolName: "grep_search", args: {}, status: "complete" },
        ],
      }),
    ]);
    expect(summary).toContain("Agent activity");
    expect(summary).toMatch(/read/);
    expect(summary).toMatch(/grep/);
  });

  it("reports distinct files touched", () => {
    const summary = buildSummary([
      assistant("a1", "done", {
        toolEvents: [
          { stepIndex: 1, toolName: "read_file", args: { path: "a.ts" }, status: "complete" },
          { stepIndex: 2, toolName: "edit_file", args: { path: "b.ts" }, status: "complete" },
        ],
      }),
    ]);
    expect(summary).toContain("Files touched:");
    expect(summary).toContain("a.ts");
    expect(summary).toContain("b.ts");
  });

  it("sums total duration across messages", () => {
    const summary = buildSummary([
      assistant("a1", "x", { totalDurationMs: 1200 }),
      assistant("a2", "y", { totalDurationMs: 800 }),
    ]);
    expect(summary).toContain("2.0s");
  });
});
