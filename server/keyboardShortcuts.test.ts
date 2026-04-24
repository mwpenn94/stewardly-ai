/**
 * keyboardShortcuts.test.ts — Parity convergence tests for keyboard shortcuts
 * 
 * Validates:
 * 1. Overlay SHORTCUTS array matches hook wired shortcuts (no stale entries)
 * 2. Search/filter functionality in overlay
 * 3. Category ordering and descriptions
 * 4. G13/G14/G15 guardrail compliance
 * 5. A11y attributes present
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "..");
const overlayPath = resolve(ROOT, "client/src/components/KeyboardShortcuts.tsx");
const hookPath = resolve(ROOT, "client/src/hooks/useKeyboardShortcuts.ts");

const overlaySrc = readFileSync(overlayPath, "utf-8");
const hookSrc = readFileSync(hookPath, "utf-8");

describe("Keyboard Shortcuts — Overlay ↔ Hook Parity", () => {
  it("every G-chord in the overlay has a matching handler in the hook", () => {
    // Extract overlay G-chords: "G", "then", "X"
    const overlayChords = [...overlaySrc.matchAll(/"G",\s*"then",\s*"([A-Z])"/g)]
      .map(m => m[1].toLowerCase())
      .sort();
    
    // Extract hook G-chords: key: "x", chord: "g"
    const hookChords = [...hookSrc.matchAll(/key:\s*"([a-z])",\s*chord:\s*"g"/g)]
      .map(m => m[1])
      .sort();
    
    expect(overlayChords.length).toBeGreaterThan(10);
    expect(hookChords.length).toBeGreaterThan(10);
    
    // Every overlay chord must be wired in the hook
    for (const chord of overlayChords) {
      expect(hookChords).toContain(chord);
    }
  });

  it("no hook G-chord is missing from the overlay display", () => {
    const overlayChords = [...overlaySrc.matchAll(/"G",\s*"then",\s*"([A-Z])"/g)]
      .map(m => m[1].toLowerCase())
      .sort();
    
    const hookChords = [...hookSrc.matchAll(/key:\s*"([a-z])",\s*chord:\s*"g"/g)]
      .map(m => m[1])
      .sort();
    
    for (const chord of hookChords) {
      expect(overlayChords).toContain(chord);
    }
  });

  it("overlay and hook have the same number of G-chords", () => {
    const overlayCount = [...overlaySrc.matchAll(/"G",\s*"then",\s*"[A-Z]"/g)].length;
    const hookCount = [...hookSrc.matchAll(/key:\s*"[a-z]",\s*chord:\s*"g"/g)].length;
    expect(overlayCount).toBe(hookCount);
  });
});

describe("Keyboard Shortcuts — Overlay Features", () => {
  it("has search/filter input with aria-label", () => {
    expect(overlaySrc).toContain('aria-label="Filter keyboard shortcuts"');
  });

  it("has empty state for no search results", () => {
    expect(overlaySrc).toContain("filtered.length === 0");
    expect(overlaySrc).toContain("No shortcuts match");
  });

  it("has clear search button", () => {
    expect(overlaySrc).toContain('aria-label="Clear search"');
  });

  it("uses useMemo for filtered shortcuts", () => {
    expect(overlaySrc).toContain("useMemo");
    expect(overlaySrc).toMatch(/const filtered = useMemo/);
  });

  it("uses stable CATEGORY_ORDER for consistent display", () => {
    expect(overlaySrc).toContain("CATEGORY_ORDER");
    expect(overlaySrc).toMatch(/const CATEGORY_ORDER\s*=/);
  });

  it("has total shortcut count badge in header", () => {
    expect(overlaySrc).toContain("SHORTCUTS.length");
  });

  it("resets search when modal closes", () => {
    expect(overlaySrc).toMatch(/if\s*\(!open\)\s*setSearch\(""\)/);
  });

  it("auto-focuses search input on open", () => {
    expect(overlaySrc).toContain("searchRef.current?.focus");
  });
});

describe("Keyboard Shortcuts — Accessibility", () => {
  it("overlay has role=dialog and aria-modal", () => {
    expect(overlaySrc).toContain('role="dialog"');
    expect(overlaySrc).toContain('aria-modal="true"');
    expect(overlaySrc).toContain('aria-label="Keyboard shortcuts"');
  });

  it("close button has aria-label", () => {
    expect(overlaySrc).toContain('aria-label="Close"');
  });

  it("uses focus trap", () => {
    expect(overlaySrc).toContain("useFocusTrap");
    expect(overlaySrc).toContain("focusTrapRef");
  });

  it("Escape key closes the modal", () => {
    expect(overlaySrc).toMatch(/e\.key\s*===\s*"Escape"/);
  });
});

describe("Keyboard Shortcuts — Hook Wiring", () => {
  it("hook skips input/textarea/contentEditable targets", () => {
    expect(hookSrc).toContain('target.tagName === "INPUT"');
    expect(hookSrc).toContain('target.tagName === "TEXTAREA"');
    expect(hookSrc).toContain("target.isContentEditable");
  });

  it("hook has chord timeout to prevent stale chords", () => {
    expect(hookSrc).toContain("chordTimeout");
    expect(hookSrc).toMatch(/setTimeout.*500/);
  });

  it("hook handles Ctrl/Cmd+K for command palette", () => {
    expect(hookSrc).toContain("toggle-command-palette");
  });

  it("hook has Shift+V for voice and Shift+R for read-aloud", () => {
    expect(hookSrc).toMatch(/key:\s*"v",\s*\n\s*shift:\s*true/);
    expect(hookSrc).toMatch(/key:\s*"r",\s*\n\s*shift:\s*true/);
  });

  it("hook respects defaultPrevented to avoid double-fire", () => {
    expect(hookSrc).toContain("e.defaultPrevented");
  });
});

describe("Keyboard Shortcuts — Guardrail Compliance", () => {
  it("G13: no user-specific data in overlay", () => {
    expect(overlaySrc).not.toMatch(/userId|ctx\.user|session\./);
  });

  it("G14: no external outreach in shortcuts", () => {
    expect(overlaySrc).not.toMatch(/mailto:|sendEmail|outreach/);
    expect(hookSrc).not.toMatch(/mailto:|sendEmail|outreach/);
  });

  it("G15: SHORTCUTS is module-level const (no test pollution)", () => {
    expect(overlaySrc).toMatch(/^const SHORTCUTS: Shortcut\[\] = \[/m);
  });
});
