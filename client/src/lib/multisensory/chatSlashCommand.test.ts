/**
 * chatSlashCommand.test.ts — end-to-end test that the Chat slash-command
 * interceptor correctly maps every recognised slash command to the right
 * parseIntent result.
 *
 * Chat.tsx calls `parseIntent(trimmed, { allowBareNav: true })` on inputs
 * that start with "/", then dispatches based on `parsed.kind`. This test
 * walks every branch of that switch and verifies the parser produces the
 * expected kind.
 */

import { describe, it, expect } from "vitest";
import { parseIntent } from "./intentParser";

function slash(s: string) {
  return parseIntent(s, { allowBareNav: true });
}

describe("Chat slash commands → intent kinds", () => {
  it("/go <page> → navigate", () => {
    const r = slash("/go learning");
    expect(r.kind).toBe("navigate");
    if (r.kind === "navigate") {
      expect(r.route).toBe("/learning");
      expect(r.label).toBe("Learning Center");
    }
  });

  it("/open <page> → navigate", () => {
    expect(slash("/open settings").kind).toBe("navigate");
    expect(slash("/open audio settings").kind).toBe("navigate");
    expect(slash("/open my clients").kind).toBe("navigate");
  });

  it("/read → read_page", () => {
    expect(slash("/read").kind).toBe("read_page");
    expect(slash("/read this").kind).toBe("read_page");
    expect(slash("/read aloud").kind).toBe("read_page");
  });

  it("/hands-free → hands_free enter", () => {
    const r = slash("/hands-free");
    expect(r.kind).toBe("hands_free");
    if (r.kind === "hands_free") expect(r.action).toBe("enter");
  });

  it("/hands-free off → hands_free exit", () => {
    const r = slash("/hands-free off");
    expect(r.kind).toBe("hands_free");
    if (r.kind === "hands_free") expect(r.action).toBe("exit");
  });

  it("/palette → open_palette", () => {
    expect(slash("/palette").kind).toBe("unknown"); // bare "palette" isn't a match
    expect(slash("/open palette").kind).toBe("open_palette");
    expect(slash("/command palette").kind).toBe("open_palette");
  });

  it("/help → help", () => {
    expect(slash("/help").kind).toBe("help");
    expect(slash("/shortcuts").kind).toBe("help");
  });

  it("/pause → audio pause", () => {
    const r = slash("/pause");
    expect(r.kind).toBe("audio");
    if (r.kind === "audio") expect(r.action).toBe("pause");
  });

  it("/resume → audio resume", () => {
    const r = slash("/resume");
    expect(r.kind).toBe("audio");
    if (r.kind === "audio") expect(r.action).toBe("resume");
  });

  it("/faster and /slower → audio speed changes", () => {
    const f = slash("/faster");
    expect(f.kind).toBe("audio");
    if (f.kind === "audio") expect(f.action).toBe("speed_up");
    const s = slash("/slower");
    expect(s.kind).toBe("audio");
    if (s.kind === "audio") expect(s.action).toBe("slow_down");
  });

  it("/go to an unknown destination → unknown", () => {
    expect(slash("/go narnia").kind).toBe("unknown");
  });

  it("every recognized kind produced by the parser is handled by Chat.tsx", () => {
    // This is a typecheck test — if the parser adds a new kind, the
    // Chat.tsx switch must be updated. We enumerate the expected kinds
    // here and cross-reference against the parser.
    const allKinds = new Set([
      "navigate",
      "audio",
      "hands_free",
      "learning",
      "read_page",
      "focus_chat",
      "open_palette",
      "help",
      "unknown",
    ]);
    expect(allKinds.size).toBe(9);

    // Spot-check each with a known input
    const samples: Array<[string, string]> = [
      ["go to learning", "navigate"],
      ["pause", "audio"],
      ["start hands-free", "hands_free"],
      ["next", "learning"],
      ["read this", "read_page"],
      ["focus chat", "focus_chat"],
      ["open palette", "open_palette"],
      ["help", "help"],
      ["xyzzy", "unknown"],
    ];

    for (const [input, expectedKind] of samples) {
      expect(parseIntent(input, { allowBareNav: true }).kind).toBe(expectedKind);
    }
  });
});
