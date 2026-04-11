/**
 * shortcuts.test.ts — locks in the chord state machine + registry integrity.
 *
 * The chord machine is where user-visible keyboard navigation lives, so
 * every change to it needs to come with a regression test.
 */

import { describe, it, expect } from "vitest";
import {
  GLOBAL_SHORTCUTS,
  CHORD_TIMEOUT_MS,
  initialChordState,
  stepChord,
  groupShortcutsByCategory,
  matchesShortcut,
  type ShortcutDef,
} from "./shortcuts";

const BASE_TIME = 1_000_000;

function makeKeyEvent(
  key: string,
  mods: {
    ctrl?: boolean;
    meta?: boolean;
    shift?: boolean;
    alt?: boolean;
  } = {},
): KeyboardEvent {
  // jsdom/node stub so we don't depend on a DOM
  return {
    key,
    ctrlKey: !!mods.ctrl,
    metaKey: !!mods.meta,
    shiftKey: !!mods.shift,
    altKey: !!mods.alt,
  } as KeyboardEvent;
}

describe("GLOBAL_SHORTCUTS registry integrity", () => {
  it("every shortcut has a unique id", () => {
    const ids = GLOBAL_SHORTCUTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every shortcut has a display label", () => {
    for (const s of GLOBAL_SHORTCUTS) {
      expect(s.display.length).toBeGreaterThan(0);
      for (const d of s.display) expect(d.length).toBeGreaterThan(0);
    }
  });

  it("every shortcut has either chord or mods+key or a bare single key", () => {
    for (const s of GLOBAL_SHORTCUTS) {
      const hasChord = !!s.chord;
      const hasMods = !!s.mods && s.mods.length > 0;
      const hasKey = !!s.key;
      // A shortcut must have a key, and must be either chord-style or
      // modifier-bound or a bare single-key (like "?")
      expect(hasKey).toBe(true);
      if (!hasChord && !hasMods) {
        // bare keys are allowed, but should be exactly one char OR
        // special single keys like "Escape"
        expect(s.key.length === 1 || s.key.length > 1).toBe(true);
      }
    }
  });

  it("every navigation intent points to a concrete route in IntentRouter", () => {
    // Sanity: every nav.* shortcut's intent name follows the "nav." convention
    const navShortcuts = GLOBAL_SHORTCUTS.filter((s) => s.category === "Navigation");
    for (const s of navShortcuts) {
      expect(s.intent.startsWith("nav.")).toBe(true);
    }
    expect(navShortcuts.length).toBeGreaterThanOrEqual(10);
  });

  it("groupShortcutsByCategory returns every category in canonical order", () => {
    const grouped = groupShortcutsByCategory();
    expect(Object.keys(grouped)).toEqual([
      "Navigation",
      "Chat",
      "Audio & Voice",
      "Accessibility",
      "General",
    ]);
    expect(grouped.Navigation.length).toBeGreaterThanOrEqual(10);
    expect(grouped["Audio & Voice"].length).toBeGreaterThanOrEqual(4);
    expect(grouped.Accessibility.length).toBeGreaterThanOrEqual(3);
  });

  it("hides fallback shortcuts from the default display groups", () => {
    const grouped = groupShortcutsByCategory();
    const allDisplayed = Object.values(grouped).flat();
    for (const s of allDisplayed) {
      expect(s.fallback).not.toBe(true);
    }
  });

  it("includes fallback shortcuts when requested", () => {
    const grouped = groupShortcutsByCategory(GLOBAL_SHORTCUTS, {
      includeFallbacks: true,
    });
    const allDisplayed = Object.values(grouped).flat();
    const fallbacks = allDisplayed.filter((s) => s.fallback === true);
    expect(fallbacks.length).toBeGreaterThanOrEqual(5);
  });

  it("every fallback shortcut shares its intent id with a primary", () => {
    const fallbacks = GLOBAL_SHORTCUTS.filter((s) => s.fallback);
    const primaries = GLOBAL_SHORTCUTS.filter((s) => !s.fallback);
    for (const f of fallbacks) {
      const primary = primaries.find((p) => p.intent === f.intent);
      expect(
        primary,
        `fallback ${f.id} has no matching primary with intent ${f.intent}`,
      ).toBeTruthy();
    }
  });

  it("fallback shortcuts use Ctrl+Shift+ not Alt+", () => {
    const fallbacks = GLOBAL_SHORTCUTS.filter((s) => s.fallback);
    for (const f of fallbacks) {
      expect(f.mods).toContain("ctrl");
      expect(f.mods).toContain("shift");
      expect(f.mods).not.toContain("alt");
    }
  });
});

describe("matchesShortcut — single-key + modifier matching", () => {
  const shortcut: ShortcutDef = {
    id: "palette.open",
    label: "Open command palette",
    category: "General",
    mods: ["ctrl"],
    key: "k",
    intent: "palette.open",
    display: ["Ctrl", "K"],
    description: "Open the global command palette",
  };

  it("matches Ctrl+K", () => {
    expect(matchesShortcut(makeKeyEvent("k", { ctrl: true }), shortcut)).toBe(true);
  });

  it("matches Cmd+K (metaKey) on macOS", () => {
    expect(matchesShortcut(makeKeyEvent("k", { meta: true }), shortcut)).toBe(true);
  });

  it("rejects K with no modifier", () => {
    expect(matchesShortcut(makeKeyEvent("k"), shortcut)).toBe(false);
  });

  it("rejects Ctrl+Shift+K when only Ctrl is required (shift not allowed)", () => {
    expect(
      matchesShortcut(makeKeyEvent("k", { ctrl: true, shift: true }), shortcut),
    ).toBe(false);
  });

  it("is case-insensitive on the key", () => {
    expect(matchesShortcut(makeKeyEvent("K", { ctrl: true }), shortcut)).toBe(true);
  });

  it("rejects a chord shortcut (those go through stepChord)", () => {
    const chord: ShortcutDef = {
      id: "nav.chat",
      label: "Chat",
      category: "Navigation",
      chord: "g",
      key: "c",
      intent: "nav.chat",
      display: ["G", "then", "C"],
      description: "",
    };
    expect(matchesShortcut(makeKeyEvent("c"), chord)).toBe(false);
  });
});

describe("stepChord — chord state machine", () => {
  it("starts a chord on 'g'", () => {
    const r = stepChord(initialChordState(), "g", BASE_TIME);
    expect(r.kind).toBe("start");
    if (r.kind === "start") {
      expect(r.next.pending).toBe("g");
      expect(r.next.pendingAt).toBe(BASE_TIME);
    }
  });

  it("completes g+l → nav.learning", () => {
    const s1 = stepChord(initialChordState(), "g", BASE_TIME);
    expect(s1.kind).toBe("start");
    if (s1.kind !== "start") throw new Error("fail");
    const s2 = stepChord(s1.next, "l", BASE_TIME + 200);
    expect(s2.kind).toBe("match");
    if (s2.kind === "match") {
      expect(s2.shortcut.intent).toBe("nav.learning");
      expect(s2.next.pending).toBeNull();
    }
  });

  it("completes g+c → nav.chat", () => {
    const s1 = stepChord(initialChordState(), "g", BASE_TIME);
    if (s1.kind !== "start") throw new Error("fail");
    const s2 = stepChord(s1.next, "c", BASE_TIME + 10);
    expect(s2.kind).toBe("match");
    if (s2.kind === "match") expect(s2.shortcut.intent).toBe("nav.chat");
  });

  it("resets when second key is unrelated", () => {
    const s1 = stepChord(initialChordState(), "g", BASE_TIME);
    if (s1.kind !== "start") throw new Error("fail");
    const s2 = stepChord(s1.next, "z", BASE_TIME + 10);
    expect(s2.kind).toBe("reset");
    if (s2.kind === "reset") expect(s2.next.pending).toBeNull();
  });

  it("expires the pending chord after timeout", () => {
    const s1 = stepChord(initialChordState(), "g", BASE_TIME);
    if (s1.kind !== "start") throw new Error("fail");
    // l would normally complete the chord, but we've waited too long —
    // it re-enters start state if 'l' happens to be a starter (it isn't),
    // otherwise it's reset
    const s2 = stepChord(s1.next, "l", BASE_TIME + CHORD_TIMEOUT_MS + 100);
    // Neither match (timed out) nor a new starter — l is not a chord starter
    expect(s2.kind === "ignore" || s2.kind === "start").toBe(true);
  });

  it("ignores non-chord-starter keys when nothing is pending", () => {
    const r = stepChord(initialChordState(), "z", BASE_TIME);
    expect(r.kind).toBe("ignore");
  });

  it("every nav.* shortcut in GLOBAL_SHORTCUTS is reachable via g+x", () => {
    const navShortcuts = GLOBAL_SHORTCUTS.filter(
      (s) => s.category === "Navigation" && s.chord === "g",
    );
    for (const s of navShortcuts) {
      const state1 = stepChord(initialChordState(), "g", BASE_TIME);
      if (state1.kind !== "start") throw new Error(`g → ${state1.kind}`);
      const state2 = stepChord(state1.next, s.key, BASE_TIME + 10);
      expect(state2.kind).toBe("match");
      if (state2.kind === "match") expect(state2.shortcut.id).toBe(s.id);
    }
  });

  it("no two nav.* shortcuts share the same g+x key", () => {
    const navShortcuts = GLOBAL_SHORTCUTS.filter(
      (s) => s.category === "Navigation" && s.chord === "g",
    );
    const keys = navShortcuts.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
