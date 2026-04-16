/**
 * Pass 69 — Database Error Fix + AI Studio Rebuild Tests
 * Updated for the new unified Chat/Dev/Auto mode architecture
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// ─── Database Error Fix ─────────────────────────────────────────────
describe("Pass 69: Database Error Fix (query.getSQL)", () => {
  it("should use sql template literal in infrastructureResilience instead of raw object", async () => {
    const filePath = path.resolve("server/services/infrastructureResilience.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    // Should NOT use the old { sql, params } pattern
    expect(content).not.toMatch(/db\.execute\(\s*\{\s*sql:/);
    // Should import sql from drizzle-orm
    expect(content).toMatch(/import.*\bsql\b.*from\s+["']drizzle-orm["']/);
    // Should use sql`SELECT 1` template literal pattern
    expect(content).toMatch(/sql`SELECT 1`/);
  });

  it("should not have any other db.execute with raw object pattern", async () => {
    const serverDir = path.resolve("server");
    const files = getAllTsFiles(serverDir);
    for (const file of files) {
      if (file.includes("node_modules") || file.includes(".test.")) continue;
      const content = fs.readFileSync(file, "utf-8");
      const matches = content.match(/db\.execute\(\s*\{\s*sql:/g);
      if (matches) {
        throw new Error(`Found broken db.execute pattern in ${file}`);
      }
    }
  });
});

// ─── AI Studio Rebuild (Unified Chat/Dev/Auto) ─────────────────────
describe("Pass 69+70: AI Studio — Unified Surface", () => {
  const filePath = path.resolve("client/src/pages/UnifiedAI.tsx");
  let content: string;

  it("should exist and be readable", () => {
    expect(fs.existsSync(filePath)).toBe(true);
    content = fs.readFileSync(filePath, "utf-8");
    expect(content.length).toBeGreaterThan(1000);
  });

  it("should NOT embed full standalone pages (Chat/CodeChat/AgentManager)", () => {
    content = content || fs.readFileSync(filePath, "utf-8");
    expect(content).not.toMatch(/import\s+Chat\s+from/);
    expect(content).not.toMatch(/import\s+CodeChat\s+from/);
    expect(content).not.toMatch(/import\s+AgentManager\s+from/);
    expect(content).not.toMatch(/h-screen/);
  });

  // ─── Mode 1: Chat ─────────────────────────────────────────────
  it("should have ChatPanel with streaming SSE support", () => {
    content = content || fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("ChatPanel");
    expect(content).toContain("/api/chat/stream");
    expect(content).toContain("authFetch");
    expect(content).toContain('parsed.type === "token"');
    expect(content).toContain("parsed.content");
  });

  it("should have chat conversation history and clear functionality", () => {
    content = content || fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("handleClear");
    expect(content).toContain("Conversation cleared");
    expect(content).toContain("messages.map");
  });

  it("should have chat suggestion chips for quick start", () => {
    content = content || fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("CHAT_SUGGESTIONS");
    expect(content).toContain("Start a conversation");
  });

  // ─── Mode 2: Dev ──────────────────────────────────────────────
  it("should have DevPanel with codeChat.chat mutation (ReAct loop)", () => {
    content = content || fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("DevPanel");
    expect(content).toContain("trpc.codeChat.chat.useMutation");
    expect(content).toContain("allowMutations");
    expect(content).toContain("maxIterations");
  });

  it("should have terminal-style aesthetic for Dev mode", () => {
    content = content || fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("font-mono");
    expect(content).toContain("emerald");
    expect(content).toContain("Code Assistant");
  });

  it("should display tool traces with expand/collapse", () => {
    content = content || fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("traces");
    expect(content).toContain("expandedTraces");
    expect(content).toContain("toggleTrace");
    expect(content).toContain("toolName");
    expect(content).toContain("observation");
  });

  it("should have Dev suggestion chips", () => {
    content = content || fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("DEV_SUGGESTIONS");
    expect(content).toContain("codebase");
  });

  // ─── Mode 3: Auto ─────────────────────────────────────────────
  it("should have AutoPanel with agent CRUD (openClaw)", () => {
    content = content || fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("AutoPanel");
    expect(content).toContain("trpc.openClaw.list");
    expect(content).toContain("trpc.openClaw.create");
    expect(content).toContain("trpc.openClaw.launch");
    expect(content).toContain("trpc.openClaw.stop");
    expect(content).toContain("trpc.openClaw.delete");
  });

  it("should have agent creation form with type selection", () => {
    content = content || fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("AGENT_TYPES");
    expect(content).toContain("compliance_monitor");
    expect(content).toContain("lead_processor");
    expect(content).toContain("report_generator");
    expect(content).toContain("handleCreate");
  });

  it("should have task templates for quick agent creation", () => {
    content = content || fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("TASK_TEMPLATES");
    expect(content).toContain("Quick Start Templates");
    expect(content).toContain("applyTemplate");
  });

  it("should show agent action log for selected agents", () => {
    content = content || fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("trpc.openClaw.listActions");
    expect(content).toContain("Recent Actions");
    expect(content).toContain("selectedAgent");
  });

  // ─── Mode Switching ───────────────────────────────────────────
  it("should have mode switching: chat, dev, auto", () => {
    content = content || fs.readFileSync(filePath, "utf-8");
    expect(content).toContain('"chat"');
    expect(content).toContain('"dev"');
    expect(content).toContain('"auto"');
    expect(content).toContain("StudioMode");
    expect(content).toContain("setMode");
  });

  it("should have mode tab buttons with distinct colors", () => {
    content = content || fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("text-blue-400");
    expect(content).toContain("text-emerald-400");
    expect(content).toContain("text-purple-400");
  });

  // ─── Layout & Infrastructure ──────────────────────────────────
  it("should have proper layout without h-screen conflicts", () => {
    content = content || fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("flex flex-col h-full");
    expect(content).toContain("overflow-hidden");
    expect(content).not.toContain("h-screen");
  });

  it("should have SEOHead for proper page metadata", () => {
    content = content || fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("SEOHead");
    expect(content).toContain('title="AI Studio"');
  });

  it("should use correct SSE parsing format matching Chat.tsx", () => {
    content = content || fs.readFileSync(filePath, "utf-8");
    expect(content).toContain('parsed.type === "token"');
    expect(content).toContain("parsed.content");
    expect(content).not.toMatch(/parsed\.token[^s]/);
  });

  it("should have abort/stop functionality for streaming", () => {
    content = content || fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("AbortController");
    expect(content).toContain("handleStop");
    expect(content).toContain("abortRef");
  });

  it("should have ServiceDegradedFallback wrapping AI panels", () => {
    content = content || fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("ServiceDegradedFallback");
  });

  it("should handle empty states for all modes", () => {
    content = content || fs.readFileSync(filePath, "utf-8");
    // Chat empty state
    expect(content).toContain("Start a conversation");
    // Dev empty state
    expect(content).toContain("Code Assistant");
    // Auto empty state
    expect(content).toContain("No Agents Yet");
  });

  it("should have links to full-page experiences (Chat, Settings)", () => {
    content = content || fs.readFileSync(filePath, "utf-8");
    expect(content).toContain('"/chat"');
    expect(content).toContain('"/settings/ai-tuning"');
  });
});

// ─── Route Registration ─────────────────────────────────────────────
describe("Pass 69: AI Studio Route", () => {
  it("should be registered at /ai in App.tsx", () => {
    const appPath = path.resolve("client/src/App.tsx");
    const content = fs.readFileSync(appPath, "utf-8");
    expect(content).toMatch(/["']\/ai["']/);
    expect(content).toContain("UnifiedAI");
  });
});

// ─── Helper ─────────────────────────────────────────────────────────
function getAllTsFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        results.push(...getAllTsFiles(fullPath));
      } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
        results.push(fullPath);
      }
    }
  } catch { /* ignore */ }
  return results;
}
