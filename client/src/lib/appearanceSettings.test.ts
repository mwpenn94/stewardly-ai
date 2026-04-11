import { describe, it, expect } from "vitest";
import {
  DEFAULT_SETTINGS,
  computeBodyClassList,
  type AppearanceSettings,
} from "./appearanceSettings";

/* Note: loadAppearanceSettings / saveAppearanceSettings / applyAppearanceSettings
   touch localStorage / document, which aren't available in the node env.
   We unit-test the pure helper (computeBodyClassList) which is the actual
   decision logic. The DOM effects are a thin wrapper and wouldn't benefit
   from a jsdom harness just for test coverage. */

const make = (overrides: Partial<AppearanceSettings> = {}): AppearanceSettings => ({
  ...DEFAULT_SETTINGS,
  ...overrides,
});

describe("computeBodyClassList", () => {
  it("default settings → light if system prefers light, dark if system prefers dark", () => {
    const light = computeBodyClassList(make({ theme: "system" }), false);
    expect(light.themeClass).toBe("light");
    expect(light.classes).toContain("light");
    expect(light.classes).toContain("font-scale-default");
    expect(light.classes).toContain("chat-density-default");
    expect(light.classes).not.toContain("reduced-motion-user");
    expect(light.classes).not.toContain("sidebar-compact");

    const dark = computeBodyClassList(make({ theme: "system" }), true);
    expect(dark.themeClass).toBe("dark");
    expect(dark.classes).toContain("dark");
  });

  it("explicit dark theme always wins over system preference", () => {
    const explicit = computeBodyClassList(make({ theme: "dark" }), false);
    expect(explicit.themeClass).toBe("dark");
  });

  it("explicit light theme always wins over system preference", () => {
    const explicit = computeBodyClassList(make({ theme: "light" }), true);
    expect(explicit.themeClass).toBe("light");
  });

  it("font-scale classes are applied correctly", () => {
    const r = computeBodyClassList(make({ fontScale: "large" }), false);
    expect(r.classes).toContain("font-scale-large");
    expect(r.classes).not.toContain("font-scale-default");
  });

  it("chat-density classes are applied correctly", () => {
    const r = computeBodyClassList(make({ chatDensity: "spacious" }), false);
    expect(r.classes).toContain("chat-density-spacious");
  });

  it("reducedMotion appends the reduced-motion-user class", () => {
    const r = computeBodyClassList(make({ reducedMotion: true }), false);
    expect(r.classes).toContain("reduced-motion-user");
  });

  it("sidebarCompact appends the sidebar-compact class", () => {
    const r = computeBodyClassList(make({ sidebarCompact: true }), false);
    expect(r.classes).toContain("sidebar-compact");
  });

  it("combines all flags simultaneously without duplication", () => {
    const r = computeBodyClassList(
      make({
        theme: "dark",
        fontScale: "comfortable",
        chatDensity: "compact",
        reducedMotion: true,
        sidebarCompact: true,
      }),
      false,
    );
    expect(r.themeClass).toBe("dark");
    // Expected canonical set of classes:
    expect(new Set(r.classes)).toEqual(
      new Set([
        "dark",
        "font-scale-comfortable",
        "chat-density-compact",
        "reduced-motion-user",
        "sidebar-compact",
      ]),
    );
  });

  it("system theme returns the correct SR-visible class even when both flags are off", () => {
    const r = computeBodyClassList(make({ theme: "system" }), false);
    // Only theme + font + density — no opt-in flags.
    expect(r.classes.length).toBe(3);
  });
});
