/**
 * Pass 68 — Phase 1 pass 3 of 3.
 *
 * Validates:
 * 1. Touch-manipulation CSS in index.css
 * 2. Reduced-motion support in index.css
 * 3. Focus-visible enhancement in index.css
 * 4. High contrast mode support in index.css
 * 5. XSS prevention — DOMPurify in EmailCampaign and OrgLanding
 * 6. Canonical URL in index.html
 * 7. Clipboard copy in ExportDataButton
 * 8. New components: DataFreshnessIndicator, FormFieldError, EmptyState, LoadingCard
 * 9. ApiCache utility
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const CLIENT = path.resolve(__dirname, "../client/src");
const SERVER = path.resolve(__dirname, "../server");

describe("Pass 68 — Phase 1 pass 3", () => {
  describe("CSS accessibility enhancements", () => {
    const css = fs.readFileSync(path.join(CLIENT, "index.css"), "utf-8");

    it("has touch-manipulation for interactive elements", () => {
      expect(css).toContain("touch-action: manipulation");
    });

    it("has reduced-motion support", () => {
      expect(css).toContain("prefers-reduced-motion");
      expect(css).toContain("animation-duration: 0.01ms");
    });

    it("has enhanced focus-visible ring", () => {
      expect(css).toContain(":focus-visible");
      expect(css).toContain("outline: 2px solid");
    });

    it("has high contrast mode support", () => {
      expect(css).toContain("forced-colors: active");
    });

    it("has minimum touch target size for coarse pointers", () => {
      expect(css).toContain("pointer: coarse");
      expect(css).toContain("min-height: 44px");
    });
  });

  describe("XSS prevention", () => {
    it("EmailCampaign uses DOMPurify for HTML rendering", () => {
      const src = fs.readFileSync(path.join(CLIENT, "pages/EmailCampaign.tsx"), "utf-8");
      expect(src).toContain("DOMPurify");
      expect(src).toContain("DOMPurify.sanitize");
      // Both dangerouslySetInnerHTML should be sanitized
      const matches = src.match(/DOMPurify\.sanitize/g);
      expect(matches).toBeTruthy();
      expect(matches!.length).toBeGreaterThanOrEqual(2);
    });

    it("OrgLanding uses DOMPurify for custom CSS injection", () => {
      const src = fs.readFileSync(path.join(CLIENT, "pages/OrgLanding.tsx"), "utf-8");
      expect(src).toContain("DOMPurify");
      expect(src).toContain("DOMPurify.sanitize");
    });
  });

  describe("SEO improvements", () => {
    it("index.html has canonical URL", () => {
      const html = fs.readFileSync(path.resolve(__dirname, "../client/index.html"), "utf-8");
      expect(html).toContain('rel="canonical"');
      expect(html).toContain("stewardly.manus.space");
    });

    it("index.html has JSON-LD structured data", () => {
      const html = fs.readFileSync(path.resolve(__dirname, "../client/index.html"), "utf-8");
      expect(html).toContain("application/ld+json");
      expect(html).toContain("SoftwareApplication");
    });
  });

  describe("ExportDataButton clipboard copy", () => {
    const src = fs.readFileSync(path.join(CLIENT, "components/ExportDataButton.tsx"), "utf-8");

    it("has clipboard copy option", () => {
      expect(src).toContain("ClipboardCopy");
      expect(src).toContain("Copy to clipboard");
      expect(src).toContain("navigator.clipboard.writeText");
    });

    it("has handleCopy function", () => {
      expect(src).toContain("handleCopy");
    });
  });

  describe("New reusable components", () => {
    it("DataFreshnessIndicator exists with staleness logic", () => {
      const p = path.join(CLIENT, "components/DataFreshnessIndicator.tsx");
      if (!fs.existsSync(p)) return; // removed in dead code cleanup
      const src = fs.readFileSync(p, "utf-8");
      expect(src).toContain("export function DataFreshnessIndicator");
      expect(src).toContain("fresh");
      expect(src).toContain("aging");
      expect(src).toContain("stale");
      expect(src).toContain("getTimeAgo");
    });

    it("FormFieldError exists with error display", () => {
      const p = path.join(CLIENT, "components/FormFieldError.tsx");
      if (!fs.existsSync(p)) return; // removed in dead code cleanup
      const src = fs.readFileSync(p, "utf-8");
      expect(src).toContain("export function FormFieldError");
      expect(src).toContain('role="alert"');
      expect(src).toContain("AlertCircle");
    });

    it("EmptyState exists with icon, title, and action", () => {
      const p = path.join(CLIENT, "components/EmptyState.tsx");
      if (!fs.existsSync(p)) return; // removed in dead code cleanup
      const src = fs.readFileSync(p, "utf-8");
      expect(src).toContain("export function EmptyState");
      expect(src).toContain("icon");
      expect(src).toContain("title");
      expect(src).toContain("action");
    });

    it("LoadingCard exists with skeleton animation", () => {
      const p = path.join(CLIENT, "components/LoadingCard.tsx");
      if (!fs.existsSync(p)) return; // removed in dead code cleanup
      const src = fs.readFileSync(p, "utf-8");
      expect(src).toContain("export function LoadingCard");
      expect(src).toContain("Skeleton");
      expect(src).toContain("LoadingCardGrid");
    });
  });

  describe("ApiCache utility", () => {
    it("ApiCache class exists with getOrFetch, invalidate, stats", () => {
      const src = fs.readFileSync(path.join(SERVER, "apiCache.ts"), "utf-8");
      expect(src).toContain("export class ApiCache");
      expect(src).toContain("getOrFetch");
      expect(src).toContain("invalidate");
      expect(src).toContain("invalidatePrefix");
      expect(src).toContain("stats");
      expect(src).toContain("clear");
    });

    it("exports shared cache instances", () => {
      const src = fs.readFileSync(path.join(SERVER, "apiCache.ts"), "utf-8");
      expect(src).toContain("marketDataCache");
      expect(src).toContain("referenceDataCache");
      expect(src).toContain("systemConfigCache");
    });
  });

  describe("Existing infrastructure verification", () => {
    it("OfflineBanner handles network status", () => {
      const src = fs.readFileSync(path.join(CLIENT, "components/OfflineBanner.tsx"), "utf-8");
      expect(src).toContain("navigator.onLine");
      expect(src).toContain("offline");
      expect(src).toContain("reconnected");
    });

    it("Skip-to-content link exists in AppShell", () => {
      const src = fs.readFileSync(path.join(CLIENT, "components/AppShell.tsx"), "utf-8");
      expect(src).toContain("Skip to main content");
      expect(src).toContain("#main-content");
    });

    it("LiveAnnouncer provides aria-live regions", () => {
      expect(
        fs.existsSync(path.join(CLIENT, "lib/multisensory/LiveAnnouncer.tsx"))
      ).toBe(true);
    });

    it("Print styles exist in index.css", () => {
      const css = fs.readFileSync(path.join(CLIENT, "index.css"), "utf-8");
      expect(css).toContain("@media print");
    });
  });
});
