/**
 * Tests for sessionLibrary.ts (Pass 212).
 */

import { describe, it, expect } from "vitest";
import {
  emptyLibrary,
  parseLibrary,
  upsertSession,
  deleteSession,
  renameSession,
  getSession,
  autoName,
  forkMessagesAt,
  searchSessions,
  shouldCheckpoint,
  aggregateSessions,
  type SessionSnapshot,
} from "./sessionLibrary";
import type { CodeChatMessage } from "@/hooks/useCodeChatStream";

const mkSession = (overrides: Partial<SessionSnapshot> = {}): SessionSnapshot => ({
  id: overrides.id ?? "s1",
  name: overrides.name ?? "Session 1",
  createdAt: overrides.createdAt ?? 1000,
  updatedAt: overrides.updatedAt ?? 1000,
  messages: overrides.messages ?? [],
});

const userMsg = (content: string): CodeChatMessage => ({
  id: `u-${content}`,
  role: "user",
  content,
  timestamp: new Date(),
});

describe("parseLibrary", () => {
  it("returns empty library for null", () => {
    expect(parseLibrary(null)).toEqual(emptyLibrary());
  });

  it("returns empty library for invalid JSON", () => {
    expect(parseLibrary("{broken")).toEqual(emptyLibrary());
  });

  it("returns empty library for wrong version", () => {
    const raw = JSON.stringify({ version: 99, sessions: [] });
    expect(parseLibrary(raw)).toEqual(emptyLibrary());
  });

  it("returns empty library when sessions is not an array", () => {
    const raw = JSON.stringify({ version: 1, sessions: "nope" });
    expect(parseLibrary(raw)).toEqual(emptyLibrary());
  });

  it("round-trips a valid library", () => {
    const lib = upsertSession(emptyLibrary(), mkSession({ id: "a", name: "Alpha" }));
    const raw = JSON.stringify(lib);
    expect(parseLibrary(raw)).toEqual(lib);
  });

  it("drops malformed sessions but keeps valid ones", () => {
    const raw = JSON.stringify({
      version: 1,
      sessions: [
        { id: "ok", name: "OK", createdAt: 1, updatedAt: 1, messages: [] },
        { id: "bad" }, // missing fields
        { /* empty */ },
      ],
    });
    const lib = parseLibrary(raw);
    expect(lib.sessions).toHaveLength(1);
    expect(lib.sessions[0].id).toBe("ok");
  });
});

describe("upsertSession", () => {
  it("inserts a new session at the top", () => {
    const lib = upsertSession(emptyLibrary(), mkSession({ id: "a", name: "A" }));
    expect(lib.sessions).toHaveLength(1);
    expect(lib.sessions[0].id).toBe("a");
  });

  it("replaces an existing session by id", () => {
    const lib1 = upsertSession(emptyLibrary(), mkSession({ id: "a", name: "A" }));
    const lib2 = upsertSession(
      lib1,
      mkSession({ id: "a", name: "A renamed", updatedAt: 2000 }),
    );
    expect(lib2.sessions).toHaveLength(1);
    expect(lib2.sessions[0].name).toBe("A renamed");
  });

  it("sorts newest-first by updatedAt", () => {
    let lib = upsertSession(emptyLibrary(), mkSession({ id: "old", updatedAt: 1000 }));
    lib = upsertSession(lib, mkSession({ id: "mid", updatedAt: 2000 }));
    lib = upsertSession(lib, mkSession({ id: "new", updatedAt: 3000 }));
    expect(lib.sessions.map((s) => s.id)).toEqual(["new", "mid", "old"]);
  });

  it("caps session count at MAX_SESSIONS (50)", () => {
    let lib = emptyLibrary();
    for (let i = 0; i < 60; i++) {
      lib = upsertSession(
        lib,
        mkSession({ id: `s${i}`, updatedAt: i }),
      );
    }
    expect(lib.sessions).toHaveLength(50);
    // Oldest sessions are dropped — s0..s9 gone, s10..s59 retained
    expect(lib.sessions.map((s) => s.id)).not.toContain("s0");
    expect(lib.sessions.map((s) => s.id)).toContain("s59");
  });
});

describe("deleteSession", () => {
  it("removes a session by id", () => {
    let lib = upsertSession(emptyLibrary(), mkSession({ id: "a" }));
    lib = upsertSession(lib, mkSession({ id: "b" }));
    const after = deleteSession(lib, "a");
    expect(after.sessions.map((s) => s.id)).toEqual(["b"]);
  });

  it("is a no-op when the id is missing", () => {
    const lib = upsertSession(emptyLibrary(), mkSession({ id: "a" }));
    expect(deleteSession(lib, "nope")).toEqual(lib);
  });
});

describe("renameSession", () => {
  it("renames an existing session and updates updatedAt", () => {
    const lib = upsertSession(emptyLibrary(), mkSession({ id: "a", name: "Old", updatedAt: 1000 }));
    const after = renameSession(lib, "a", "New name");
    expect(after.sessions[0].name).toBe("New name");
    expect(after.sessions[0].updatedAt).toBeGreaterThan(1000);
  });

  it("trims whitespace", () => {
    const lib = upsertSession(emptyLibrary(), mkSession({ id: "a" }));
    const after = renameSession(lib, "a", "  Padded  ");
    expect(after.sessions[0].name).toBe("Padded");
  });

  it("refuses empty names", () => {
    const lib = upsertSession(emptyLibrary(), mkSession({ id: "a", name: "Keep" }));
    const after = renameSession(lib, "a", "   ");
    expect(after.sessions[0].name).toBe("Keep");
  });
});

describe("getSession", () => {
  it("returns the matching session", () => {
    const lib = upsertSession(emptyLibrary(), mkSession({ id: "a", name: "Alpha" }));
    expect(getSession(lib, "a")?.name).toBe("Alpha");
  });
  it("returns null when missing", () => {
    expect(getSession(emptyLibrary(), "missing")).toBeNull();
  });
});

describe("forkMessagesAt", () => {
  const mkMsg = (
    id: string,
    role: "user" | "assistant",
    content: string,
  ): CodeChatMessage => ({
    id,
    role,
    content,
    timestamp: new Date(),
  });

  it("returns the slice up to and including the target", () => {
    const msgs = [
      mkMsg("u1", "user", "first prompt"),
      mkMsg("a1", "assistant", "first reply"),
      mkMsg("u2", "user", "second prompt"),
      mkMsg("a2", "assistant", "second reply"),
    ];
    const forked = forkMessagesAt(msgs, "a1");
    expect(forked).toHaveLength(2);
    expect(forked[1].id).toBe("a1");
  });

  it("returns the original list when the id is missing", () => {
    const msgs = [mkMsg("u1", "user", "x")];
    expect(forkMessagesAt(msgs, "nope")).toEqual(msgs);
  });

  it("forks at a user message", () => {
    const msgs = [
      mkMsg("u1", "user", "first"),
      mkMsg("a1", "assistant", "reply"),
      mkMsg("u2", "user", "second"),
    ];
    const forked = forkMessagesAt(msgs, "u2");
    expect(forked).toHaveLength(3);
    expect(forked.map((m) => m.id)).toEqual(["u1", "a1", "u2"]);
  });
});

describe("searchSessions", () => {
  const mkSession = (
    id: string,
    name: string,
    updatedAt: number,
    contents: Array<{ role: "user" | "assistant"; text: string }>,
  ): SessionSnapshot => ({
    id,
    name,
    createdAt: updatedAt,
    updatedAt,
    messages: contents.map((c, i) => ({
      id: `${id}-${i}`,
      role: c.role,
      content: c.text,
      timestamp: new Date(updatedAt),
    })),
  });

  const lib = (() => {
    let l = emptyLibrary();
    l = upsertSession(
      l,
      mkSession("s1", "Wealth engine", 1000, [
        { role: "user", text: "explain the wealth engine architecture" },
        { role: "assistant", text: "The wealth engine is structured in 7 phases..." },
      ]),
    );
    l = upsertSession(
      l,
      mkSession("s2", "Auth", 2000, [
        { role: "user", text: "find authentication code" },
        { role: "assistant", text: "Authentication lives in server/_core/auth.ts" },
      ]),
    );
    l = upsertSession(
      l,
      mkSession("s3", "Empty", 3000, []),
    );
    return l;
  })();

  it("returns empty array for empty query", () => {
    expect(searchSessions(lib, "")).toEqual([]);
    expect(searchSessions(lib, "   ")).toEqual([]);
  });

  it("finds matches across sessions", () => {
    const r = searchSessions(lib, "authentication");
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((h) => h.sessionId === "s2")).toBe(true);
  });

  it("is case-insensitive", () => {
    const r = searchSessions(lib, "WEALTH ENGINE");
    expect(r.some((h) => h.sessionId === "s1")).toBe(true);
  });

  it("includes role + session metadata on each hit", () => {
    const r = searchSessions(lib, "phases");
    expect(r[0].sessionName).toBe("Wealth engine");
    expect(r[0].messageRole).toBe("assistant");
  });

  it("produces a snippet window around the match", () => {
    const r = searchSessions(lib, "wealth");
    expect(r[0].snippet.toLowerCase()).toContain("wealth");
    expect(r[0].snippet.length).toBeGreaterThan(0);
  });

  it("tracks match position for highlighting", () => {
    const r = searchSessions(lib, "wealth");
    expect(r[0].matchAt).toBeGreaterThanOrEqual(0);
    expect(r[0].matchLen).toBe("wealth".length);
  });

  it("orders by session updatedAt newest-first", () => {
    // Both sessions contain "the", newer session (s2, updatedAt 2000)
    // should appear first in the results
    const r = searchSessions(lib, "the");
    expect(r[0].sessionId).toBe("s2");
  });

  it("respects the limit argument", () => {
    // Force ≥ 2 matches then cap at 1
    const r = searchSessions(lib, "the", 1);
    expect(r).toHaveLength(1);
  });

  it("returns empty for no-match queries", () => {
    expect(searchSessions(lib, "xyz987-nothing")).toEqual([]);
  });
});

describe("shouldCheckpoint", () => {
  const state = (lastSavedCount: number) => ({
    lastSavedCount,
    sessionId: "auto",
  });

  const mkMsgs = (count: number, withAssistant = true): CodeChatMessage[] => {
    const out: CodeChatMessage[] = [];
    for (let i = 0; i < count; i++) {
      out.push({
        id: `m${i}`,
        role: i === 1 && withAssistant ? "assistant" : "user",
        content: `msg ${i}`,
        timestamp: new Date(),
      });
    }
    return out;
  };

  it("returns false for empty messages", () => {
    expect(shouldCheckpoint([], state(0), 4)).toBe(false);
  });

  it("returns false until there is at least one assistant reply", () => {
    const userOnly: CodeChatMessage[] = Array.from({ length: 6 }, (_, i) => ({
      id: `u${i}`,
      role: "user" as const,
      content: `x${i}`,
      timestamp: new Date(),
    }));
    expect(shouldCheckpoint(userOnly, state(0), 4)).toBe(false);
  });

  it("returns true when delta reaches everyN", () => {
    expect(shouldCheckpoint(mkMsgs(4), state(0), 4)).toBe(true);
  });

  it("returns false when delta is below everyN", () => {
    expect(shouldCheckpoint(mkMsgs(3), state(0), 4)).toBe(false);
  });

  it("returns false when there has been no new activity", () => {
    expect(shouldCheckpoint(mkMsgs(4), state(4), 4)).toBe(false);
  });

  it("returns false for everyN <= 0 (disabled)", () => {
    expect(shouldCheckpoint(mkMsgs(100), state(0), 0)).toBe(false);
    expect(shouldCheckpoint(mkMsgs(100), state(0), -1)).toBe(false);
  });
});

describe("aggregateSessions", () => {
  it("returns zero stats for empty library", () => {
    const s = aggregateSessions(emptyLibrary());
    expect(s.totalSessions).toBe(0);
    expect(s.totalMessages).toBe(0);
    expect(s.oldestAt).toBeNull();
    expect(s.newestAt).toBeNull();
    expect(s.modelsUsed).toEqual([]);
  });

  it("counts sessions and messages across the library", () => {
    let lib = emptyLibrary();
    lib = upsertSession(lib, {
      id: "a",
      name: "A",
      createdAt: 100,
      updatedAt: 200,
      messages: [
        { id: "m1", role: "user", content: "hi", timestamp: new Date() },
        {
          id: "m2",
          role: "assistant",
          content: "hello",
          model: "claude-opus-4-6",
          timestamp: new Date(),
          toolEvents: [
            {
              stepIndex: 1,
              toolName: "read_file",
              args: {},
              status: "complete",
            },
            {
              stepIndex: 2,
              toolName: "grep_search",
              args: {},
              status: "complete",
            },
          ],
        },
      ],
    });
    lib = upsertSession(lib, {
      id: "b",
      name: "B",
      createdAt: 300,
      updatedAt: 400,
      messages: [
        { id: "m3", role: "user", content: "hey", timestamp: new Date() },
        {
          id: "m4",
          role: "assistant",
          content: "reply",
          model: "gpt-5",
          timestamp: new Date(),
          toolEvents: [
            {
              stepIndex: 1,
              toolName: "read_file",
              args: {},
              status: "complete",
            },
          ],
        },
      ],
    });
    const s = aggregateSessions(lib);
    expect(s.totalSessions).toBe(2);
    expect(s.totalMessages).toBe(4);
    expect(s.totalUserMessages).toBe(2);
    expect(s.totalAssistantMessages).toBe(2);
    expect(s.totalToolCalls).toBe(3);
    expect(s.toolCallsByKind.read_file).toBe(2);
    expect(s.toolCallsByKind.grep_search).toBe(1);
    expect(s.modelsUsed.sort()).toEqual(["claude-opus-4-6", "gpt-5"]);
    expect(s.oldestAt).toBe(100);
    expect(s.newestAt).toBe(400);
  });

  it("handles sessions with no toolEvents gracefully", () => {
    const lib = upsertSession(emptyLibrary(), {
      id: "a",
      name: "A",
      createdAt: 1,
      updatedAt: 1,
      messages: [
        { id: "m1", role: "assistant", content: "hi", timestamp: new Date() },
      ],
    });
    const s = aggregateSessions(lib);
    expect(s.totalToolCalls).toBe(0);
    expect(s.toolCallsByKind).toEqual({});
  });
});

describe("autoName", () => {
  it("returns a timestamp when there are no user messages", () => {
    const name = autoName([]);
    expect(name.length).toBeGreaterThan(0);
  });

  it("returns the first user message line verbatim when short", () => {
    expect(autoName([userMsg("what is 2 + 2")])).toBe("what is 2 + 2");
  });

  it("truncates long first lines with an ellipsis", () => {
    const long = "a".repeat(80);
    const name = autoName([userMsg(long)]);
    expect(name.length).toBeLessThanOrEqual(60);
    expect(name.endsWith("…")).toBe(true);
  });

  it("uses only the first line of multi-line prompts", () => {
    expect(autoName([userMsg("hello\nmore stuff")])).toBe("hello");
  });
});
