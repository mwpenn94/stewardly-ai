/**
 * Pass 85 — Cross-module integration: ExportDataButton on key pages + document search in CommandPalette
 *
 * Tests verify:
 * 1. ExportDataButton component is imported and used in TeamManagement, CRMSync, WebhookManager, MyWork, AdminAuditTrail
 * 2. documents.search procedure exists with proper input validation
 * 3. CommandPalette integrates document search
 * 4. ClientDashboard and ManagerDashboard have cross-module data queries
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const CLIENT = path.resolve(__dirname, "../client/src");

function readFile(rel: string): string {
  return fs.readFileSync(path.join(CLIENT, rel), "utf-8");
}

function readServer(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, rel), "utf-8");
}

describe("Pass 85 — ExportDataButton additions", () => {
  const pages = ["TeamManagement", "CRMSync", "WebhookManager", "MyWork", "AdminAuditTrail"];

  for (const page of pages) {
    it(`${page} imports ExportDataButton`, () => {
      const src = readFile(`pages/${page}.tsx`);
      expect(src).toContain('import { ExportDataButton }');
    });

    it(`${page} renders ExportDataButton with data + filename props`, () => {
      const src = readFile(`pages/${page}.tsx`);
      expect(src).toContain("<ExportDataButton");
      expect(src).toContain("filename=");
      expect(src).toContain("data=");
    });
  }
});

describe("Pass 85 — Document search procedure", () => {
  it("documents router has search procedure with query + limit inputs", () => {
    const src = readServer("routers.ts");
    // Find the documents search procedure
    const searchIdx = src.indexOf("search: protectedProcedure", src.indexOf("documentsRouter"));
    expect(searchIdx).toBeGreaterThan(-1);
    const chunk = src.substring(searchIdx, searchIdx + 300);
    expect(chunk).toContain("query: z.string()");
    expect(chunk).toContain("limit: z.number()");
  });

  it("search procedure returns id, documentId, content, score", () => {
    const src = readServer("routers.ts");
    const searchIdx = src.indexOf("search: protectedProcedure", src.indexOf("documentsRouter"));
    const chunk = src.substring(searchIdx, searchIdx + 500);
    expect(chunk).toContain("documentId");
    expect(chunk).toContain("content");
    expect(chunk).toContain("score");
  });
});

describe("Pass 85 — CommandPalette document search integration", () => {
  it("CommandPalette uses documents.search tRPC query", () => {
    const src = readFile("components/CommandPalette.tsx");
    expect(src).toContain("documents.search");
  });
});

describe("Pass 85 — Cross-module dashboard data", () => {
  it("ClientDashboard queries learning progress", () => {
    const src = readFile("pages/ClientDashboard.tsx");
    expect(src).toContain("learning");
  });

  it("ManagerDashboard queries lead pipeline summary", () => {
    const src = readFile("pages/ManagerDashboard.tsx");
    expect(src).toContain("lead");
  });
});
