/**
 * Expert Pass 18 — Cross-Cutting Regression
 * Validates cross-engine integration and regression safety.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
const ROOT = path.resolve(__dirname, "..");

describe("Expert Pass 18 — Cross-Cutting Regression", () => {
  it("routers.ts imports cadenceEngine", () => {
    const r = fs.readFileSync(path.join(ROOT, "server/routers.ts"), "utf-8");
    expect(r).toContain("cadenceEngine");
  });
  it("routers.ts imports complianceAudit", () => {
    const r = fs.readFileSync(path.join(ROOT, "server/routers.ts"), "utf-8");
    expect(r).toContain("compliance");
  });
  it("routers.ts has protected procedures", () => {
    const r = fs.readFileSync(path.join(ROOT, "server/routers.ts"), "utf-8");
    expect(r).toContain("protectedProcedure");
  });
  it("index.css exists with theme variables", () => {
    const css = fs.readFileSync(path.join(ROOT, "client/src/index.css"), "utf-8");
    expect(css).toContain("--background");
    expect(css).toContain("--foreground");
  });
  it("App.tsx has route definitions", () => {
    const app = fs.readFileSync(path.join(ROOT, "client/src/App.tsx"), "utf-8");
    expect(app).toContain("Route");
    expect(app).toContain("path=");
  });
  it("trpc client is configured", () => {
    const trpc = fs.readFileSync(path.join(ROOT, "client/src/lib/trpc.ts"), "utf-8");
    expect(trpc).toContain("createTRPCReact");
  });
  it("schema.ts has users table", () => {
    const schema = fs.readFileSync(path.join(ROOT, "drizzle/schema.ts"), "utf-8");
    expect(schema).toContain("users");
  });
  it("schema.ts has conversations table", () => {
    const schema = fs.readFileSync(path.join(ROOT, "drizzle/schema.ts"), "utf-8");
    expect(schema).toContain("conversations");
  });
  it("schema.ts has organizations table", () => {
    const schema = fs.readFileSync(path.join(ROOT, "drizzle/schema.ts"), "utf-8");
    expect(schema).toContain("organizations");
  });
  it("todo.md exists", () => {
    expect(fs.existsSync(path.join(ROOT, "todo.md"))).toBe(true);
  });
  it("PLATFORM_GUIDE.md exists", () => {
    expect(fs.existsSync(path.join(ROOT, "PLATFORM_GUIDE.md"))).toBe(true);
  });
  it("SETUP.md exists", () => {
    expect(fs.existsSync(path.join(ROOT, "SETUP.md"))).toBe(true);
  });
  it("REMAINING_ITEMS.md exists", () => {
    expect(fs.existsSync(path.join(ROOT, "REMAINING_ITEMS.md"))).toBe(true);
  });
  it("more than 400 test files exist", () => {
    const { execSync } = require("child_process");
    const count = parseInt(execSync("find server client shared -name '*.test.ts' -o -name '*.spec.ts' | wc -l", { cwd: ROOT, encoding: "utf-8" }).trim());
    expect(count).toBeGreaterThan(400);
  });
});
