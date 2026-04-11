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
