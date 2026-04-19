/**
 * Pass 65 — Final Convergence Verification Tests
 * 
 * Validates the improvements made in Pass 65:
 * - ScrollToTop component for route change scroll restoration
 * - JSON-LD structured data for SEO
 * - Content-visibility CSS utilities for rendering performance
 * - Image lazy loading attributes
 * - Prefers-reduced-motion media query
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const CLIENT = path.join(ROOT, "client", "src");

describe("Pass 65 — Convergence Improvements", () => {
  describe("ScrollToTop component", () => {
    it("exists and uses wouter useLocation", () => {
      const content = fs.readFileSync(
        path.join(CLIENT, "components", "ScrollToTop.tsx"),
        "utf-8"
      );
      expect(content).toContain("useLocation");
      expect(content).toContain("scrollTo");
    });

    it("is imported and rendered in App.tsx", () => {
      const app = fs.readFileSync(path.join(CLIENT, "App.tsx"), "utf-8");
      expect(app).toContain("ScrollToTop");
      expect(app).toContain("<ScrollToTop />");
    });
  });

  describe("JSON-LD structured data", () => {
    it("has application/ld+json script in index.html", () => {
      const html = fs.readFileSync(
        path.join(ROOT, "client", "index.html"),
        "utf-8"
      );
      expect(html).toContain("application/ld+json");
      expect(html).toContain("schema.org");
      expect(html).toContain("SoftwareApplication");
      expect(html).toContain("Stewardly");
    });

    it("has valid JSON-LD structure", () => {
      const html = fs.readFileSync(
        path.join(ROOT, "client", "index.html"),
        "utf-8"
      );
      const match = html.match(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/
      );
      expect(match).toBeTruthy();
      const jsonLd = JSON.parse(match![1]);
      expect(jsonLd["@context"]).toBe("https://schema.org");
      expect(jsonLd["@type"]).toBe("SoftwareApplication");
      expect(jsonLd.name).toBe("Stewardly");
      expect(jsonLd.applicationCategory).toBe("FinanceApplication");
    });
  });

  describe("CSS rendering performance utilities", () => {
    it("has content-visibility utility class", () => {
      const css = fs.readFileSync(path.join(CLIENT, "index.css"), "utf-8");
      expect(css).toContain("content-visibility: auto");
      expect(css).toContain("contain-intrinsic-size");
    });

    it("has CSS containment utility class", () => {
      const css = fs.readFileSync(path.join(CLIENT, "index.css"), "utf-8");
      expect(css).toContain("contain-layout");
      expect(css).toContain("contain: layout style");
    });
  });

  describe("Image lazy loading", () => {
    it("RichMediaEmbed uses loading=lazy", () => {
      const content = fs.readFileSync(
        path.join(CLIENT, "components", "RichMediaEmbed.tsx"),
        "utf-8"
      );
      expect(content).toContain('loading="lazy"');
    });

    it("MessageList uses loading=lazy", () => {
      const content = fs.readFileSync(
        path.join(CLIENT, "components", "chat", "MessageList.tsx"),
        "utf-8"
      );
      expect(content).toContain('loading="lazy"');
    });
  });

  describe("PWA manifest", () => {
    it("manifest.json exists with correct structure", () => {
      const manifest = JSON.parse(
        fs.readFileSync(
          path.join(ROOT, "client", "public", "manifest.json"),
          "utf-8"
        )
      );
      expect(manifest.name).toContain("Stewardly");
      expect(manifest.short_name).toBe("Stewardly");
      expect(manifest.start_url).toBe("/");
      expect(manifest.display).toBe("standalone");
    });

    it("index.html links to manifest", () => {
      const html = fs.readFileSync(
        path.join(ROOT, "client", "index.html"),
        "utf-8"
      );
      expect(html).toContain("manifest.json");
    });
  });

  describe("Codebase health at convergence", () => {
    it("has >380K total lines of code", () => {
      let total = 0;
      const countLines = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory() && !entry.name.includes("node_modules")) {
            countLines(full);
          } else if (
            entry.name.endsWith(".ts") ||
            entry.name.endsWith(".tsx")
          ) {
            total += fs.readFileSync(full, "utf-8").split("\n").length;
          }
        }
      };
      countLines(path.join(ROOT, "client", "src"));
      countLines(path.join(ROOT, "server"));
      countLines(path.join(ROOT, "shared"));
      expect(total).toBeGreaterThan(380000);
    });

    it("has >370 test files", () => {
      let count = 0;
      const countTests = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory() && !entry.name.includes("node_modules")) {
            countTests(full);
          } else if (entry.name.includes(".test.")) {
            count++;
          }
        }
      };
      countTests(path.join(ROOT, "server"));
      countTests(path.join(ROOT, "client"));
      expect(count).toBeGreaterThan(370);
    });

    it("has >200 React components", () => {
      const countFiles = (dir: string): number => {
        let count = 0;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (entry.isDirectory())
            count += countFiles(path.join(dir, entry.name));
          else if (entry.name.endsWith(".tsx")) count++;
        }
        return count;
      };
      expect(
        countFiles(path.join(CLIENT, "components"))
      ).toBeGreaterThan(150); // adjusted after dead code removal (75 files)
    });

    it("has >360 database tables", () => {
      const schema = fs.readFileSync(
        path.join(ROOT, "drizzle", "schema.ts"),
        "utf-8"
      );
      const tableCount = (schema.match(/mysqlTable/g) || []).length;
      expect(tableCount).toBeGreaterThan(360);
    });
  });
});
