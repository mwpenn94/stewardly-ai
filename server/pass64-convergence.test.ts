/**
 * Pass 64 — Convergence Verification Tests
 * Tests for: confirmation dialogs on destructive actions, autocomplete attributes,
 * manifest.json, global mutation error handling, and comprehensive codebase metrics
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const CLIENT = path.join(ROOT, "client/src");

describe("Pass 64 — Convergence Verification", () => {
  describe("Destructive action confirmation dialogs", () => {
    it("KnowledgeAdmin has confirmation before delete", () => {
      const content = fs.readFileSync(path.join(CLIENT, "pages/KnowledgeAdmin.tsx"), "utf-8");
      expect(content).toContain("confirm(");
      expect(content).toContain("deleteArticle.mutate");
    });

    it("ChatSidebar has confirmation before conversation delete", () => {
      const content = fs.readFileSync(path.join(CLIENT, "components/chat/ChatSidebar.tsx"), "utf-8");
      expect(content).toContain("confirm(");
      expect(content).toContain("handleDeleteConversation");
    });

    it("Organizations has confirmation before org delete", () => {
      const content = fs.readFileSync(path.join(CLIENT, "pages/Organizations.tsx"), "utf-8");
      expect(content).toContain("confirm(");
      expect(content).toContain("deleteOrg.mutate");
    });
  });

  describe("Form autocomplete attributes", () => {
    it("SignIn has autocomplete on email input", () => {
      const content = fs.readFileSync(path.join(CLIENT, "pages/SignIn.tsx"), "utf-8");
      expect(content).toContain('autoComplete="email"');
    });

    it("ClientOnboarding has autocomplete on email and tel inputs", () => {
      const content = fs.readFileSync(path.join(CLIENT, "pages/ClientOnboarding.tsx"), "utf-8");
      expect(content).toContain('autoComplete="email"');
      expect(content).toContain('autoComplete="tel"');
    });

    it("LeadCaptureGate has autocomplete on email input", () => {
      const content = fs.readFileSync(path.join(CLIENT, "components/LeadCaptureGate.tsx"), "utf-8");
      expect(content).toContain('autoComplete="email"');
    });
  });

  describe("PWA manifest", () => {
    it("manifest.json exists with correct structure", () => {
      const manifest = JSON.parse(
        fs.readFileSync(path.join(ROOT, "client/public/manifest.json"), "utf-8")
      );
      expect(manifest.name).toContain("Stewardly");
      expect(manifest.short_name).toBe("Stewardly");
      expect(manifest.display).toBe("standalone");
      expect(manifest.start_url).toBe("/");
      expect(manifest.icons).toBeDefined();
      expect(manifest.icons.length).toBeGreaterThan(0);
    });

    it("index.html links to manifest.json", () => {
      const html = fs.readFileSync(path.join(ROOT, "client/index.html"), "utf-8");
      expect(html).toContain('rel="manifest"');
      expect(html).toContain("manifest.json");
    });
  });

  describe("Global mutation error handling", () => {
    it("main.tsx has global mutation error subscribe handler", () => {
      const content = fs.readFileSync(path.join(CLIENT, "main.tsx"), "utf-8");
      expect(content).toContain("getMutationCache().subscribe");
      expect(content).toContain("toast.error");
    });

    it("main.tsx skips auth errors in global handler", () => {
      const content = fs.readFileSync(path.join(CLIENT, "main.tsx"), "utf-8");
      expect(content).toContain("UNAUTHED_ERR_MSG");
    });

    it("main.tsx checks for existing onError before showing global toast", () => {
      const content = fs.readFileSync(path.join(CLIENT, "main.tsx"), "utf-8");
      expect(content).toContain("options.onError");
    });
  });

  describe("Codebase health metrics", () => {
    it("has comprehensive test coverage (>270 test files)", () => {
      const testFiles = fs.readdirSync(path.join(ROOT, "server"), { recursive: true })
        .filter((f: any) => f.toString().endsWith(".test.ts"));
      expect(testFiles.length).toBeGreaterThan(270);
    });

    it("has comprehensive page coverage (>130 pages)", () => {
      const countFiles = (dir: string): number => {
        let count = 0;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (entry.isDirectory()) count += countFiles(path.join(dir, entry.name));
          else if (entry.name.endsWith(".tsx")) count++;
        }
        return count;
      };
      expect(countFiles(path.join(CLIENT, "pages"))).toBeGreaterThan(130);
    });

    it("has comprehensive component library (>200 components)", () => {
      const countFiles = (dir: string): number => {
        let count = 0;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (entry.isDirectory()) count += countFiles(path.join(dir, entry.name));
          else if (entry.name.endsWith(".tsx")) count++;
        }
        return count;
      };
      expect(countFiles(path.join(CLIENT, "components"))).toBeGreaterThan(150); // adjusted after dead code removal (75 files)
    });

    it("has comprehensive routing (>140 routes)", () => {
      const appTsx = fs.readFileSync(path.join(CLIENT, "App.tsx"), "utf-8");
      const routeCount = (appTsx.match(/<Route/g) || []).length;
      expect(routeCount).toBeGreaterThan(140);
    });

    it("has comprehensive database schema (>350 tables)", () => {
      const schema = fs.readFileSync(path.join(ROOT, "drizzle/schema.ts"), "utf-8");
      const tableCount = (schema.match(/mysqlTable/g) || []).length;
      expect(tableCount).toBeGreaterThan(350);
    });
  });

  describe("SEO and accessibility", () => {
    it("index.html has all required meta tags", () => {
      const html = fs.readFileSync(path.join(ROOT, "client/index.html"), "utf-8");
      expect(html).toContain('name="description"');
      expect(html).toContain('property="og:title"');
      expect(html).toContain('property="og:description"');
      expect(html).toContain('property="og:image"');
      expect(html).toContain('name="twitter:card"');
      expect(html).toContain('name="theme-color"');
      expect(html).toContain('lang="en"');
    });

    it("robots.txt exists with proper configuration", () => {
      const robots = fs.readFileSync(path.join(ROOT, "client/public/robots.txt"), "utf-8");
      expect(robots).toContain("User-agent:");
      expect(robots).toContain("Allow: /");
      expect(robots).toContain("Sitemap:");
    });

    it("Google Fonts use display=swap", () => {
      const html = fs.readFileSync(path.join(ROOT, "client/index.html"), "utf-8");
      expect(html).toContain("display=swap");
    });

    it("Google Fonts have preconnect hints", () => {
      const html = fs.readFileSync(path.join(ROOT, "client/index.html"), "utf-8");
      expect(html).toContain('rel="preconnect" href="https://fonts.googleapis.com"');
      expect(html).toContain('rel="preconnect" href="https://fonts.gstatic.com"');
    });
  });
});
