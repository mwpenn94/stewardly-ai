/**
 * Pass 69 — Database Error Fix + AI Studio Rebuild Tests
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
      // Check for the broken pattern: db.execute({ sql: ... })
      const matches = content.match(/db\.execute\(\s*\{\s*sql:/g);
      if (matches) {
        throw new Error(`Found broken db.execute pattern in ${file}`);
      }
    }
  });
});

// ─── AI Studio Rebuild ──────────────────────────────────────────────
describe("Pass 69: AI Studio (UnifiedAI) Rebuild", () => {
  const filePath = path.resolve("client/src/pages/UnifiedAI.tsx");
  let content: string;

  it("should exist and be readable", () => {
    expect(fs.existsSync(filePath)).toBe(true);
    content = fs.readFileSync(filePath, "utf-8");
    expect(content.length).toBeGreaterThan(1000);
  });

  it("should NOT embed full Chat/CodeChat/AgentManager pages", () => {
    content = content || fs.readFileSync(filePath, "utf-8");
    // Should not import the full Chat page component
    expect(content).not.toMatch(/import\s+Chat\s+from/);
    expect(content).not.toMatch(/import\s+CodeChat\s+from/);
    expect(content).not.toMatch(/import\s+AgentManager\s+from/);
    // Should not render h-screen inside the container
    expect(content).not.toMatch(/h-screen/);
  });

  it("should have a QuickChatPanel with streaming support", () => {
    content = content || fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("QuickChatPanel");
    expect(content).toContain("/api/chat/stream");
    expect(content).toContain("authFetch");
    // Should parse SSE events correctly
    expect(content).toContain('parsed.type === "token"');
    expect(content).toContain("parsed.content");
  });

  it("should have ModelPresetsPanel with CRUD operations", () => {
    content = content || fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("ModelPresetsPanel");
    expect(content).toContain("trpc.multiModel.perspectives");
    expect(content).toContain("trpc.multiModel.presets");
    expect(content).toContain("trpc.multiModel.listPresets");
    expect(content).toContain("trpc.multiModel.savePreset");
    expect(content).toContain("trpc.multiModel.deletePreset");
  });

  it("should have UsageAnalyticsPanel with stats and ratings", () => {
    content = content || fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("UsageAnalyticsPanel");
    expect(content).toContain("trpc.multiModel.usageStats");
    expect(content).toContain("trpc.multiModel.ratingSummary");
  });

  it("should have QuickActionsPanel with navigation to all AI features", () => {
    content = content || fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("QuickActionsPanel");
    // Should link to all major AI features
    expect(content).toContain('"/chat"');
    expect(content).toContain('"/code-chat"');
    expect(content).toContain('"/agents"');
    expect(content).toContain('"/documents"');
    expect(content).toContain('"/wealth-engine"');
    expect(content).toContain('"/workflows"');
  });

  it("should have AIConfigPreview showing resolved 5-layer config", () => {
    content = content || fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("AIConfigPreview");
    expect(content).toContain("trpc.aiLayers.previewConfig");
    expect(content).toContain("toneStyle");
    expect(content).toContain("responseFormat");
    expect(content).toContain("temperature");
    expect(content).toContain("guardrails");
  });

  it("should have proper tabs: Studio, Presets, Analytics", () => {
    content = content || fs.readFileSync(filePath, "utf-8");
    expect(content).toContain('"studio"');
    expect(content).toContain('"presets"');
    expect(content).toContain('"analytics"');
    expect(content).toContain("TabsList");
    expect(content).toContain("TabsContent");
  });

  it("should use correct SSE parsing format matching Chat.tsx", () => {
    content = content || fs.readFileSync(filePath, "utf-8");
    // Must parse type:"token" events, not raw token field
    expect(content).toContain('parsed.type === "token"');
    expect(content).toContain("parsed.content");
    // Must NOT use the old format
    expect(content).not.toMatch(/parsed\.token[^s]/);
  });

  it("should have proper layout without h-screen conflicts", () => {
    content = content || fs.readFileSync(filePath, "utf-8");
    // Should use flex layout that fits within DashboardLayout
    expect(content).toContain("flex flex-col h-full");
    expect(content).toContain("overflow-hidden");
    // Should NOT use h-screen which would conflict with parent layout
    expect(content).not.toContain("h-screen");
  });

  it("should have SEOHead for proper page metadata", () => {
    content = content || fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("SEOHead");
    expect(content).toContain('title="AI Studio"');
  });

  it("should handle empty states gracefully", () => {
    content = content || fs.readFileSync(filePath, "utf-8");
    // Quick Chat empty state
    expect(content).toContain("Ask anything");
    // Presets empty state
    expect(content).toContain("No presets yet");
    // Analytics empty state
    expect(content).toContain("No usage data yet");
  });

  it("should have abort/stop functionality for streaming", () => {
    content = content || fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("AbortController");
    expect(content).toContain("handleStop");
    expect(content).toContain("abortRef");
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
