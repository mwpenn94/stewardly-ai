import { describe, it, expect } from "vitest";
import { buildPages, WIRED_G_CHORDS, EXTRA_PAGES } from "./commandPaletteData";
import { TOOLS_NAV, ADMIN_NAV, UTILITY_NAV, hasMinRole } from "@/lib/navigation";

describe("CommandPalette buildPages", () => {
  it("includes every TOOLS_NAV / ADMIN_NAV / UTILITY_NAV href", () => {
    const pages = buildPages();
    const hrefs = new Set(pages.map((p) => p.href));
    for (const n of [...TOOLS_NAV, ...ADMIN_NAV, ...UTILITY_NAV]) {
      expect(hrefs.has(n.href), `missing sidebar href: ${n.href}`).toBe(true);
    }
  });

  it("includes every EXTRA_PAGES href", () => {
    const pages = buildPages();
    const hrefs = new Set(pages.map((p) => p.href));
    for (const e of EXTRA_PAGES) {
      expect(hrefs.has(e.href), `missing extra href: ${e.href}`).toBe(true);
    }
  });

  it("dedupes when a route appears in both sidebar and EXTRA_PAGES (sidebar wins)", () => {
    const pages = buildPages();
    const counts = new Map<string, number>();
    for (const p of pages) counts.set(p.href, (counts.get(p.href) ?? 0) + 1);
    for (const [href, count] of counts) {
      expect(count, `duplicate href: ${href}`).toBe(1);
    }
  });

  it("attaches shortcut hints ONLY for wired g-chords", () => {
    const pages = buildPages();
    for (const page of pages) {
      if (page.shortcut) {
        expect(
          WIRED_G_CHORDS[page.href],
          `shortcut hint on non-wired route ${page.href}`,
        ).toBe(page.shortcut);
      }
    }
  });

  it("exposes Pass 7 routes that Pass 2 palette missed", () => {
    const pages = buildPages();
    const hrefs = new Set(pages.map((p) => p.href));
    // Hand-picked per G52:
    expect(hrefs.has("/my-work")).toBe(true);
    expect(hrefs.has("/financial-twin")).toBe(true);
    expect(hrefs.has("/workflows")).toBe(true);
    expect(hrefs.has("/code-chat")).toBe(true);
    expect(hrefs.has("/consensus")).toBe(true);
    expect(hrefs.has("/learning/achievements")).toBe(true);
    expect(hrefs.has("/settings/audio")).toBe(true);
    expect(hrefs.has("/settings/appearance")).toBe(true);
  });

  it("every page has a minRole that's a valid role", () => {
    const pages = buildPages();
    for (const p of pages) {
      expect(["user", "advisor", "manager", "admin"]).toContain(p.minRole);
    }
  });
});

describe("CommandPalette role filtering (G67)", () => {
  it("regular 'user' role does NOT see admin-only pages", () => {
    const pages = buildPages().filter((p) => hasMinRole("user", p.minRole));
    const hrefs = new Set(pages.map((p) => p.href));
    // Admin-only routes:
    expect(hrefs.has("/admin")).toBe(false);
    expect(hrefs.has("/code-chat")).toBe(false);
    expect(hrefs.has("/admin/system-health")).toBe(false);
    expect(hrefs.has("/admin/data-freshness")).toBe(false);
    // But still sees user routes:
    expect(hrefs.has("/chat")).toBe(true);
    expect(hrefs.has("/learning")).toBe(true);
    expect(hrefs.has("/settings/appearance")).toBe(true);
  });

  it("'advisor' role sees advisor pages but not admin pages", () => {
    const pages = buildPages().filter((p) => hasMinRole("advisor", p.minRole));
    const hrefs = new Set(pages.map((p) => p.href));
    expect(hrefs.has("/admin")).toBe(false);
    expect(hrefs.has("/my-work")).toBe(true);
    expect(hrefs.has("/learning/studio")).toBe(true);
    expect(hrefs.has("/improvement")).toBe(true);
  });

  it("'manager' role sees manager pages AND advisor + user pages", () => {
    const pages = buildPages().filter((p) => hasMinRole("manager", p.minRole));
    const hrefs = new Set(pages.map((p) => p.href));
    expect(hrefs.has("/manager")).toBe(true);
    expect(hrefs.has("/my-work")).toBe(true);
    expect(hrefs.has("/admin")).toBe(false); // manager < admin
  });

  it("'admin' role sees everything", () => {
    const pages = buildPages().filter((p) => hasMinRole("admin", p.minRole));
    const hrefs = new Set(pages.map((p) => p.href));
    expect(hrefs.has("/admin")).toBe(true);
    expect(hrefs.has("/code-chat")).toBe(true);
    expect(hrefs.has("/manager")).toBe(true);
    expect(hrefs.has("/my-work")).toBe(true);
    expect(hrefs.has("/chat")).toBe(true);
  });
});
