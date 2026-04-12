/**
 * dispatchIntent.test.ts — locks in the CustomEvent contract that both the
 * keyboard shortcut layer and the chat slash-command layer depend on. If
 * this contract changes, the IntentRouter bridge component needs an update.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { dispatchIntent, type IntentDetail } from "./useGlobalShortcuts";

// Minimal DOM stub: the module uses `window.dispatchEvent` + CustomEvent.
// We install a fake window and record every dispatch.
const events: IntentDetail[] = [];

class FakeCustomEvent<T> {
  type: string;
  detail: T;
  bubbles = false;
  cancelable = false;
  constructor(type: string, init?: { detail: T }) {
    this.type = type;
    this.detail = init?.detail as T;
  }
}

beforeEach(() => {
  events.length = 0;
  // @ts-expect-error — minimal globalThis.window shim
  globalThis.window = {
    dispatchEvent: (e: FakeCustomEvent<IntentDetail>) => {
      if (e.type === "multisensory-intent") events.push(e.detail);
      return true;
    },
  };
  // @ts-expect-error
  globalThis.CustomEvent = FakeCustomEvent;
});

describe("dispatchIntent", () => {
  it("fires a multisensory-intent custom event with the supplied detail", () => {
    dispatchIntent({
      intent: "nav.learning",
      source: "keyboard",
      shortcutId: "nav.learning",
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      intent: "nav.learning",
      source: "keyboard",
      shortcutId: "nav.learning",
    });
  });

  it("passes through the optional data payload", () => {
    dispatchIntent({
      intent: "chat.new",
      source: "chat",
      data: { from: "slash-command" },
    });
    expect(events[0].data).toEqual({ from: "slash-command" });
  });

  it("never throws when window is undefined (SSR safety)", () => {
    // @ts-expect-error — deliberately clear window
    globalThis.window = undefined;
    expect(() =>
      dispatchIntent({ intent: "palette.open", source: "api" }),
    ).not.toThrow();
  });

  it("allows every known source kind", () => {
    const sources: IntentDetail["source"][] = [
      "keyboard",
      "chord",
      "voice",
      "chat",
      "click",
      "api",
    ];
    for (const s of sources) {
      events.length = 0;
      dispatchIntent({ intent: "palette.open", source: s });
      expect(events[0].source).toBe(s);
    }
  });
});
