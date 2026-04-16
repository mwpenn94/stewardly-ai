/**
 * Pass 82 — Client Error Observability
 *
 * Tests:
 * 1. clientErrors.report mutation exists in routers.ts
 * 2. ErrorBoundary reports errors to server via fetch
 * 3. SectionErrorBoundary reports errors to server via fetch
 * 4. clientErrors.report accepts message, stack, componentStack, url, userAgent
 * 5. Error reporting is best-effort (catch blocks ignore failures)
 * 6. clientErrors router is registered in appRouter
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf-8");
}

describe("Pass 82 — Client Error Observability", () => {
  const routersTs = read("server/routers.ts");
  const errorBoundary = read("client/src/components/ErrorBoundary.tsx");
  const sectionErrorBoundary = read("client/src/components/SectionErrorBoundary.tsx");

  describe("Server-side Error Reporting Endpoint", () => {
    it("clientErrors router is defined in routers.ts", () => {
      expect(routersTs).toContain("clientErrorsRouter");
    });

    it("clientErrors.report mutation exists", () => {
      expect(routersTs).toMatch(/clientErrors.*report|report.*publicProcedure/s);
    });

    it("clientErrors is registered in appRouter", () => {
      expect(routersTs).toContain("clientErrors: clientErrorsRouter");
    });

    it("accepts message field with max length", () => {
      expect(routersTs).toMatch(/message:\s*z\.string\(\)\.max\(2000\)/);
    });

    it("accepts optional stack field", () => {
      expect(routersTs).toMatch(/stack:\s*z\.string\(\)\.max\(5000\)\.optional\(\)/);
    });

    it("accepts optional componentStack field", () => {
      expect(routersTs).toMatch(/componentStack:\s*z\.string\(\)\.max\(5000\)\.optional\(\)/);
    });

    it("logs errors with logger.error", () => {
      expect(routersTs).toContain('logger.error("[ClientError]"');
    });
  });

  describe("ErrorBoundary Client-side Reporting", () => {
    it("ErrorBoundary sends errors to clientErrors.report endpoint", () => {
      expect(errorBoundary).toContain("clientErrors.report");
    });

    it("ErrorBoundary sends error message", () => {
      expect(errorBoundary).toContain("error?.message");
    });

    it("ErrorBoundary sends stack trace", () => {
      expect(errorBoundary).toContain("error?.stack");
    });

    it("ErrorBoundary sends component stack", () => {
      expect(errorBoundary).toContain("componentStack");
    });

    it("ErrorBoundary error reporting is best-effort", () => {
      expect(errorBoundary).toMatch(/\.catch\(\s*\(\)\s*=>/);
    });
  });

  describe("SectionErrorBoundary Client-side Reporting", () => {
    it("SectionErrorBoundary sends errors to clientErrors.report endpoint", () => {
      expect(sectionErrorBoundary).toContain("clientErrors.report");
    });

    it("SectionErrorBoundary includes section name in error message", () => {
      expect(sectionErrorBoundary).toMatch(/sectionName.*error\?\.message/);
    });

    it("SectionErrorBoundary error reporting is best-effort", () => {
      expect(sectionErrorBoundary).toMatch(/\.catch\(\s*\(\)\s*=>/);
    });
  });
});
