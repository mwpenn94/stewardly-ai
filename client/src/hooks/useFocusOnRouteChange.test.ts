import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  describePath,
  focusMainRegion,
  announceRoute,
} from "./useFocusOnRouteChange";

describe("describePath", () => {
  it("returns the default name for known paths", () => {
    expect(describePath("/chat")).toBe("Chat");
    expect(describePath("/relationships")).toBe("Clients");
    expect(describePath("/compliance-audit")).toBe("Compliance Audit");
    expect(describePath("/wealth-engine")).toBe("Calculators");
    expect(describePath("/learning")).toBe("Learning Center");
  });

  it("matches the LONGEST prefix (so /settings/audio beats /settings)", () => {
    expect(describePath("/settings/audio")).toBe("Audio Preferences");
    expect(describePath("/settings")).toBe("Settings");
    expect(describePath("/settings/notifications")).toBe("Settings");
    expect(describePath("/settings/knowledge")).toBe("Knowledge & Documents");
  });

  it("matches prefixes on sub-routes", () => {
    expect(describePath("/chat/123")).toBe("Chat");
    expect(describePath("/learning/track/cfp")).toBe("Learning Center");
  });

  it("handles query strings", () => {
    expect(describePath("/chat?mode=loop")).toBe("Chat");
  });

  it("respects overrides", () => {
    expect(
      describePath("/chat", { "/chat": "Conversation" }),
    ).toBe("Conversation");
  });

  it("falls back to title-cased last segment for unknown paths", () => {
    expect(describePath("/foo-bar")).toBe("Foo Bar");
    expect(describePath("/deep/nested/route-name")).toBe("Route Name");
  });

  it("defaults to 'page' for empty input", () => {
    expect(describePath("")).toBe("page");
  });

  it("matches root as Home", () => {
    expect(describePath("/")).toBe("Home");
  });
});

/* ── focusMainRegion ───────────────────────────────────────────── */

function makeFakeDoc(config: {
  hasElement: boolean;
  hasActiveInput?: boolean;
}): Document {
  let focused: any = null;
  const fakeEl: any = {
    id: "main-content",
    scrollIntoView: vi.fn(),
    focus: vi.fn((opts?: any) => {
      focused = fakeEl;
    }),
    tagName: "MAIN",
    isContentEditable: false,
  };
  const fakeInput: any = {
    tagName: "INPUT",
    isContentEditable: false,
  };
  const getById = vi.fn((id: string) => {
    if (id === "main-content" && config.hasElement) return fakeEl;
    return null;
  });
  const doc: any = {
    getElementById: getById,
    get activeElement() {
      return focused || (config.hasActiveInput ? fakeInput : null);
    },
  };
  return doc as Document;
}

describe("focusMainRegion", () => {
  it("focuses an element when found and no conflicting active input", () => {
    const doc = makeFakeDoc({ hasElement: true });
    const result = focusMainRegion("main-content", doc);
    expect(result).toBe(true);
  });

  it("returns false when the element does not exist", () => {
    const doc = makeFakeDoc({ hasElement: false });
    expect(focusMainRegion("main-content", doc)).toBe(false);
  });

  it("does NOT steal focus from an active input", () => {
    const doc = makeFakeDoc({ hasElement: true, hasActiveInput: true });
    expect(focusMainRegion("main-content", doc)).toBe(false);
  });

  it("returns false when document is undefined (SSR)", () => {
    expect(focusMainRegion("main-content", undefined as any)).toBe(false);
  });
});

/* ── announceRoute ─────────────────────────────────────────────── */

describe("announceRoute", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("creates the live region on first call and sets text", () => {
    const created: any[] = [];
    const byId: any = { "stewardly-route-announcer": null };
    const doc: any = {
      getElementById: (id: string) => byId[id],
      createElement: (tag: string) => {
        const el: any = {
          tagName: tag.toUpperCase(),
          attributes: {} as Record<string, string>,
          setAttribute(k: string, v: string) {
            this.attributes[k] = v;
          },
          style: {
            cssText: "",
          },
          id: "",
          textContent: "",
        };
        created.push(el);
        return el;
      },
      body: {
        appendChild: (el: any) => {
          byId[el.id] = el;
        },
      },
    };

    announceRoute("Clients", doc);

    // Creation happens synchronously, text assignment happens in a 20ms timeout.
    expect(created.length).toBe(1);
    expect(created[0].attributes["role"]).toBe("status");
    expect(created[0].attributes["aria-live"]).toBe("polite");
    expect(created[0].attributes["aria-atomic"]).toBe("true");
    expect(created[0].style.cssText).toMatch(/position\s*:\s*absolute/);

    vi.advanceTimersByTime(25);
    expect(created[0].textContent).toBe("Clients");
  });

  it("reuses the live region on subsequent calls", () => {
    const region: any = {
      id: "stewardly-route-announcer",
      textContent: "first",
      setAttribute: vi.fn(),
      style: { cssText: "" },
    };
    const byId: any = { "stewardly-route-announcer": region };
    const doc: any = {
      getElementById: (id: string) => byId[id],
      createElement: vi.fn(),
      body: { appendChild: vi.fn() },
    };

    announceRoute("Second", doc);
    expect(doc.createElement).not.toHaveBeenCalled();
    expect(region.textContent).toBe(""); // cleared first
    vi.advanceTimersByTime(25);
    expect(region.textContent).toBe("Second");
  });

  it("is a no-op when document is undefined (SSR)", () => {
    expect(() => announceRoute("Clients", undefined as any)).not.toThrow();
  });
});
