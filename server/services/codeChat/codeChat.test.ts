/**
 * Tests for the code chat foundation (Round B1-B4).
 *
 * Covers:
 *   - Sandbox path resolution + escape prevention
 *   - File read / write / edit / list against a tmp workspace
 *   - Bash safety denylist
 *   - Code chat executor multi-turn loop
 *   - Autonomous coding budget caps
 *   - Roadmap planner scoring + iteration
 *   - Synthesizer wordDiff + timeBudgetSelector + costEstimator
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock the webSearchTool service module so web_search dispatcher tests
// don't hit the network or require env vars. Must live at module top
// level to be hoisted before any dynamic import.
vi.mock("../webSearchTool", () => ({
  executeWebSearch: vi.fn(async (query: string) => {
    if (query === "fail") throw new Error("forced failure");
    return `**Result for ${query}**\nhttps://example.com/${encodeURIComponent(query)}\nSnippet here.\n`;
  }),
  getSearchProvider: vi.fn(() => "tavily" as const),
}));
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { mkdtempSync, rmSync } from "fs";
import os from "os";

import {
  resolveInside,
  readFile,
  writeFile,
  editFile,
  listDirectory,
  isBashCommandSafe,
  SandboxError,
  type SandboxOptions,
} from "./fileTools";
import {
  dispatchCodeTool,
  executeCodeChat,
  type CodeToolCall,
  type CodeChatStep,
} from "./codeChatExecutor";
import {
  runAutonomousCoding,
  summarizeStep,
} from "./autonomousCoding";
import {
  emptyRoadmap,
  addItem,
  computePriority,
  rescoreRoadmap,
  nextReadyItems,
  iterateRoadmap,
  computeHealth,
  updateStatus,
  rescoreItem,
} from "./roadmapPlanner";
import {
  wordDiff,
  tokenize,
  pairwiseSimilarities,
} from "../synthesizer/wordDiff";
import {
  selectModelsWithinTimeBudget,
  classifyLatency,
} from "../synthesizer/timeBudgetSelector";
import {
  estimateCost,
  modelsUnderCostCeiling,
  guessTaskType,
  TASK_MULTIPLIERS,
} from "../synthesizer/costEstimator";

// ─── Tmp workspace setup ─────────────────────────────────────────────────

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = mkdtempSync(path.join(os.tmpdir(), "stewardly-codechat-"));
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

const sandboxRO = (): SandboxOptions => ({
  workspaceRoot: tmpRoot,
  allowMutations: false,
});
const sandboxRW = (): SandboxOptions => ({
  workspaceRoot: tmpRoot,
  allowMutations: true,
});

// ═══════════════════════════════════════════════════════════════════════════
// fileTools
// ═══════════════════════════════════════════════════════════════════════════

describe("Round B1 — fileTools", () => {
  describe("resolveInside", () => {
    it("accepts a file inside the workspace", () => {
      const r = resolveInside("/tmp/work", "src/foo.ts");
      expect(r).toBe(path.resolve("/tmp/work/src/foo.ts"));
    });
    it("rejects parent escapes", () => {
      expect(() => resolveInside("/tmp/work", "../etc/passwd")).toThrow(
        SandboxError,
      );
    });
    it("rejects absolute paths outside workspace", () => {
      expect(() => resolveInside("/tmp/work", "/etc/passwd")).toThrow(
        SandboxError,
      );
    });
    it("accepts the workspace root itself", () => {
      const r = resolveInside("/tmp/work", ".");
      expect(r).toBe(path.resolve("/tmp/work"));
    });
  });

  describe("readFile / writeFile / editFile", () => {
    it("readFile returns content for a freshly written file", async () => {
      await writeFile(sandboxRW(), "hello.txt", "world");
      const r = await readFile(sandboxRO(), "hello.txt");
      expect(r.content).toBe("world");
      expect(r.byteLength).toBe(5);
      expect(r.truncated).toBe(false);
    });

    it("writeFile rejects mutations when disabled", async () => {
      await expect(writeFile(sandboxRO(), "x.txt", "y")).rejects.toThrow(
        /MUTATIONS_DISABLED|allowMutations/,
      );
    });

    it("editFile replaces a unique substring", async () => {
      await writeFile(sandboxRW(), "edit.txt", "alpha beta gamma");
      const r = await editFile(sandboxRW(), "edit.txt", "beta", "BETA");
      expect(r.replacements).toBe(1);
      const after = await readFile(sandboxRO(), "edit.txt");
      expect(after.content).toBe("alpha BETA gamma");
    });

    it("editFile rejects ambiguous match without replaceAll", async () => {
      await writeFile(sandboxRW(), "ed2.txt", "foo foo foo");
      await expect(editFile(sandboxRW(), "ed2.txt", "foo", "bar")).rejects.toThrow(
        /AMBIGUOUS|matches.*times/,
      );
    });

    it("editFile replaceAll handles multiple matches", async () => {
      await writeFile(sandboxRW(), "ed3.txt", "foo foo foo");
      const r = await editFile(sandboxRW(), "ed3.txt", "foo", "bar", true);
      expect(r.replacements).toBe(3);
      const after = await readFile(sandboxRO(), "ed3.txt");
      expect(after.content).toBe("bar bar bar");
    });

    it("editFile rejects when oldString missing", async () => {
      await writeFile(sandboxRW(), "ed4.txt", "alpha");
      await expect(editFile(sandboxRW(), "ed4.txt", "ZZZ", "x")).rejects.toThrow(
        /NO_MATCH|not found/,
      );
    });

    // ─── Pass 205: before/after snapshots for diff rendering ──────
    it("writeFile includes before/after snapshots for an overwrite", async () => {
      await writeFile(sandboxRW(), "snap.txt", "original content");
      const r = await writeFile(sandboxRW(), "snap.txt", "new content");
      expect(r.created).toBe(false);
      expect(r.before).toBe("original content");
      expect(r.after).toBe("new content");
      expect(r.diffTruncated).toBe(false);
    });

    it("writeFile reports empty before for a brand-new file", async () => {
      const r = await writeFile(sandboxRW(), "brand-new.txt", "hello");
      expect(r.created).toBe(true);
      expect(r.before).toBe("");
      expect(r.after).toBe("hello");
    });

    it("editFile includes before/after snapshots around the change", async () => {
      await writeFile(sandboxRW(), "edit-snap.txt", "line1\nOLD\nline3");
      const r = await editFile(
        sandboxRW(),
        "edit-snap.txt",
        "OLD",
        "NEW",
      );
      expect(r.before).toBe("line1\nOLD\nline3");
      expect(r.after).toBe("line1\nNEW\nline3");
      expect(r.replacements).toBe(1);
    });

    it("readFile truncates at maxReadBytes", async () => {
      const big = "x".repeat(2000);
      await writeFile(sandboxRW(), "big.txt", big);
      const r = await readFile(
        { ...sandboxRO(), maxReadBytes: 500 },
        "big.txt",
      );
      expect(r.truncated).toBe(true);
      expect(r.content.length).toBeLessThan(2000);
    });
  });

  describe("listDirectory", () => {
    it("lists files + dirs sorted with directories first", async () => {
      await writeFile(sandboxRW(), "z.txt", "z");
      await writeFile(sandboxRW(), "a.txt", "a");
      await fs.mkdir(path.join(tmpRoot, "subdir"));
      const r = await listDirectory(sandboxRO(), ".");
      const names = r.entries.map((e) => e.name);
      expect(names[0]).toBe("subdir");
      expect(names).toContain("a.txt");
      expect(names).toContain("z.txt");
    });
  });

  describe("isBashCommandSafe", () => {
    it("rejects fork bombs", () => {
      expect(isBashCommandSafe(":(){ :|:& };:").safe).toBe(false);
    });
    it("rejects rm -rf /", () => {
      expect(isBashCommandSafe("rm -rf /").safe).toBe(false);
    });
    it("rejects mkfs", () => {
      expect(isBashCommandSafe("mkfs.ext4 /dev/sda1").safe).toBe(false);
    });
    it("accepts a benign command", () => {
      expect(isBashCommandSafe("ls -la").safe).toBe(true);
      expect(isBashCommandSafe("pnpm tsc --noEmit").safe).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// codeChatExecutor
// ═══════════════════════════════════════════════════════════════════════════

describe("Round B1 — codeChatExecutor", () => {
  describe("dispatchCodeTool", () => {
    it("read_file dispatches successfully", async () => {
      await writeFile(sandboxRW(), "f.txt", "hello");
      const r = await dispatchCodeTool(
        { name: "read_file", args: { path: "f.txt" } },
        sandboxRO(),
      );
      expect(r.kind).toBe("read");
      if (r.kind === "read") expect(r.result.content).toBe("hello");
    });

    it("write_file requires mutations", async () => {
      const r = await dispatchCodeTool(
        { name: "write_file", args: { path: "x.txt", content: "y" } },
        sandboxRO(),
      );
      expect(r.kind).toBe("error");
      if (r.kind === "error") expect(r.code).toBe("MUTATIONS_DISABLED");
    });

    it("finish returns a summary", async () => {
      const r = await dispatchCodeTool(
        { name: "finish", args: { summary: "all done" } },
        sandboxRO(),
      );
      expect(r.kind).toBe("finish");
      if (r.kind === "finish") expect(r.result.summary).toBe("all done");
    });

    it("unknown tool returns error", async () => {
      const r = await dispatchCodeTool(
        { name: "bogus" as never, args: {} },
        sandboxRO(),
      );
      expect(r.kind).toBe("error");
    });

    // Pass 237: update_todos tool
    it("update_todos normalizes + returns a todos kind", async () => {
      const r = await dispatchCodeTool(
        {
          name: "update_todos",
          args: {
            todos: [
              { id: "a", content: "Read file", activeForm: "Reading file", status: "in_progress" },
              { content: "Run tests", activeForm: "Running tests", status: "pending" },
              { content: "" }, // dropped
            ],
          },
        },
        sandboxRO(),
      );
      expect(r.kind).toBe("todos");
      if (r.kind === "todos") {
        expect(r.result.count).toBe(2);
        expect(r.result.todos[0].id).toBe("a");
        expect(r.result.todos[0].status).toBe("in_progress");
        expect(r.result.todos[1].id).toBe("todo-2");
      }
    });

    it("update_todos rejects non-array payload", async () => {
      const r = await dispatchCodeTool(
        { name: "update_todos", args: { todos: "nope" } },
        sandboxRO(),
      );
      expect(r.kind).toBe("error");
      if (r.kind === "error") expect(r.code).toBe("BAD_ARGS");
    });

    it("update_todos caps at 50 items", async () => {
      const bigList = Array.from({ length: 60 }, (_, i) => ({
        content: `Item ${i}`,
        activeForm: `Doing ${i}`,
        status: "pending",
      }));
      const r = await dispatchCodeTool(
        { name: "update_todos", args: { todos: bigList } },
        sandboxRO(),
      );
      expect(r.kind).toBe("todos");
      if (r.kind === "todos") expect(r.result.count).toBe(50);
    });

    it("update_todos defaults invalid status to pending", async () => {
      const r = await dispatchCodeTool(
        {
          name: "update_todos",
          args: {
            todos: [{ content: "A", activeForm: "Doing A", status: "nope" }],
          },
        },
        sandboxRO(),
      );
      expect(r.kind).toBe("todos");
      if (r.kind === "todos") expect(r.result.todos[0].status).toBe("pending");
    });

    it("web_read rejects missing url", async () => {
      const r = await dispatchCodeTool(
        { name: "web_read", args: {} },
        sandboxRO(),
      );
      expect(r.kind).toBe("error");
      if (r.kind === "error") expect(r.code).toBe("BAD_ARGS");
    });

    it("web_read returns a structured page view via stub adapter", async () => {
      const { WebNavigator } = await import("../../shared/automation/webNavigator");
      const { __setWebNavigator, __resetWebNavigator } = await import("./webTool");
      const nav = new WebNavigator({
        adapter: {
          async fetch(url) {
            const body = `<html><head><title>Stub</title></head><body><h1>H</h1><a href="/x">link</a></body></html>`;
            return {
              status: 200,
              finalUrl: url,
              headers: { "content-type": "text/html" },
              body,
              bytes: new TextEncoder().encode(body).length,
              truncated: false,
              redirects: 0,
            };
          },
        },
        rateLimitPerMin: 100,
      });
      __setWebNavigator(nav);
      try {
        const r = await dispatchCodeTool(
          { name: "web_read", args: { url: "https://example.com/x" } },
          sandboxRO(),
        );
        expect(r.kind).toBe("web");
        if (r.kind === "web") {
          expect(r.result.title).toBe("Stub");
          expect(r.result.headings).toContainEqual({ level: 1, text: "H" });
          expect(r.result.links[0].href).toBe("https://example.com/x");
          expect(r.result.status).toBe(200);
          expect(r.result.wordCount).toBeGreaterThan(0);
        }
      } finally {
        __resetWebNavigator();
      }
    });

    it("web_read surfaces navigation errors (blocked private host)", async () => {
      const { __resetWebNavigator } = await import("./webTool");
      __resetWebNavigator(); // use default env singleton
      const r = await dispatchCodeTool(
        { name: "web_read", args: { url: "http://127.0.0.1:8080/x" } },
        sandboxRO(),
      );
      expect(r.kind).toBe("error");
      if (r.kind === "error") expect(r.code).toBe("BLOCKED_HOST");
    });

    it("web_extract rejects missing schema", async () => {
      const { __resetWebNavigator } = await import("./webTool");
      __resetWebNavigator();
      const r = await dispatchCodeTool(
        { name: "web_extract", args: { url: "https://example.com/" } },
        sandboxRO(),
      );
      expect(r.kind).toBe("error");
      if (r.kind === "error") expect(r.code).toBe("BAD_ARGS");
    });

    it("web_extract returns typed fields via stub adapter", async () => {
      const { WebNavigator } = await import("../../shared/automation/webNavigator");
      const { __setWebNavigator, __resetWebNavigator } = await import("./webTool");
      const nav = new WebNavigator({
        adapter: {
          async fetch(url) {
            const body = `<html><head><title>Doc</title></head><body>
<h2>A</h2><h2>B</h2>
<p>Price: $99.99</p>
</body></html>`;
            return {
              status: 200,
              finalUrl: url,
              headers: { "content-type": "text/html" },
              body,
              bytes: new TextEncoder().encode(body).length,
              truncated: false,
              redirects: 0,
            };
          },
        },
        rateLimitPerMin: 100,
      });
      __setWebNavigator(nav);
      try {
        const r = await dispatchCodeTool(
          {
            name: "web_extract",
            args: {
              url: "https://example.com/",
              schema: {
                t: { selector: "title" },
                subs: { selector: "h2", type: "string[]" },
                price: { selector: "regex:\\$([0-9.]+)", type: "number" },
              },
            },
          },
          sandboxRO(),
        );
        expect(r.kind).toBe("web_extract");
        if (r.kind === "web_extract") {
          expect(r.result.data.t).toBe("Doc");
          expect(r.result.data.subs).toEqual(["A", "B"]);
          expect(r.result.data.price).toBe(99.99);
          expect(r.result.fieldCount).toBe(3);
        }
      } finally {
        __resetWebNavigator();
      }
    });

    it("web_extract surfaces schema validation errors", async () => {
      const r = await dispatchCodeTool(
        {
          name: "web_extract",
          args: {
            url: "https://example.com/",
            schema: { bad: { selector: "regex:(unclosed" } },
          },
        },
        sandboxRO(),
      );
      expect(r.kind).toBe("error");
      if (r.kind === "error") expect(r.code).toBe("BAD_ARGS");
    });

    it("web_crawl rejects missing startUrl", async () => {
      const r = await dispatchCodeTool(
        { name: "web_crawl", args: {} },
        sandboxRO(),
      );
      expect(r.kind).toBe("error");
      if (r.kind === "error") expect(r.code).toBe("BAD_ARGS");
    });

    it("web_search rejects missing query", async () => {
      const r = await dispatchCodeTool(
        { name: "web_search", args: {} },
        sandboxRO(),
      );
      expect(r.kind).toBe("error");
      if (r.kind === "error") expect(r.code).toBe("BAD_ARGS");
    });

    it("web_search returns formatted results via mocked provider", async () => {
      const r = await dispatchCodeTool(
        { name: "web_search", args: { query: "IRA limits 2026" } },
        sandboxRO(),
      );
      expect(r.kind).toBe("web_search");
      if (r.kind === "web_search") {
        expect(r.result.query).toBe("IRA limits 2026");
        expect(r.result.provider).toBe("tavily");
        expect(r.result.results).toContain("example.com");
        expect(r.result.charCount).toBeGreaterThan(0);
      }
    });

    it("web_search surfaces provider errors", async () => {
      const r = await dispatchCodeTool(
        { name: "web_search", args: { query: "fail" } },
        sandboxRO(),
      );
      expect(r.kind).toBe("error");
      if (r.kind === "error") expect(r.code).toBe("SEARCH_FAILED");
    });

    it("web_crawl runs a 2-page BFS via stub adapter", async () => {
      const { WebNavigator } = await import("../../shared/automation/webNavigator");
      const { __setWebNavigator, __resetWebNavigator } = await import("./webTool");
      const pages: Record<string, string> = {
        "https://example.com/": `<html><head><title>Home</title></head><body><a href="/a">A</a></body></html>`,
        "https://example.com/a": `<html><head><title>Inner A</title></head><body></body></html>`,
      };
      const nav = new WebNavigator({
        adapter: {
          async fetch(url) {
            const body = pages[url] ?? "<html><title>404</title></html>";
            return {
              status: 200,
              finalUrl: url,
              headers: { "content-type": "text/html" },
              body,
              bytes: new TextEncoder().encode(body).length,
              truncated: false,
              redirects: 0,
            };
          },
        },
        rateLimitPerMin: 100,
      });
      __setWebNavigator(nav);
      try {
        const r = await dispatchCodeTool(
          {
            name: "web_crawl",
            args: {
              startUrl: "https://example.com/",
              maxPages: 5,
              maxDepth: 1,
            },
          },
          sandboxRO(),
        );
        expect(r.kind).toBe("web_crawl");
        if (r.kind === "web_crawl") {
          expect(r.result.pagesSuccessful).toBeGreaterThanOrEqual(2);
          const titles = r.result.pages.map((p) => p.title).sort();
          expect(titles).toContain("Home");
          expect(titles).toContain("Inner A");
        }
      } finally {
        __resetWebNavigator();
      }
    });
  });

  describe("executeCodeChat multi-turn", () => {
    it("runs a 3-step plan to completion", async () => {
      const calls: CodeToolCall[] = [
        { name: "write_file", args: { path: "a.txt", content: "alpha" } },
        { name: "read_file", args: { path: "a.txt" } },
        { name: "finish", args: { summary: "wrote and read" } },
      ];
      let i = 0;
      const result = await executeCodeChat({
        instruction: "create a.txt and read it back",
        sandbox: sandboxRW(),
        planner: async () => calls[i++] ?? null,
        maxIterations: 5,
      });
      expect(result.finished).toBe(true);
      expect(result.iterations).toBe(3);
      expect(result.stats.writes).toBe(1);
      expect(result.stats.reads).toBe(1);
    });

    it("stops at maxIterations when planner never finishes", async () => {
      const result = await executeCodeChat({
        instruction: "infinite",
        sandbox: sandboxRW(),
        planner: async () => ({ name: "list_directory", args: { path: "." } }),
        maxIterations: 3,
      });
      expect(result.finished).toBe(false);
      expect(result.iterations).toBe(3);
    });

    it("respects maxWrites budget", async () => {
      let i = 0;
      const result = await executeCodeChat({
        instruction: "write many",
        sandbox: sandboxRW(),
        planner: async () => ({
          name: "write_file",
          args: { path: `f${i++}.txt`, content: "x" },
        }),
        maxIterations: 10,
        maxWrites: 2,
      });
      expect(result.stats.writes).toBeLessThanOrEqual(2);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// autonomousCoding
// ═══════════════════════════════════════════════════════════════════════════

describe("Round B3 — autonomousCoding", () => {
  it("runs subtasks until planner returns null", async () => {
    const subtasks = ["create a.txt", "create b.txt"];
    let stIdx = 0;
    const result = await runAutonomousCoding({
      goal: { description: "make two files" },
      sandbox: sandboxRW(),
      subtaskPlanner: async () => subtasks[stIdx++] ?? null,
      toolPlanner: async (instruction, steps) => {
        if (steps.length === 0) {
          const filename = instruction.includes("a.txt") ? "a.txt" : "b.txt";
          return { name: "write_file", args: { path: filename, content: "x" } };
        }
        return { name: "finish", args: { summary: "done" } };
      },
      maxSubtasks: 5,
    });
    expect(result.subtasks.length).toBe(2);
    expect(result.totalStats.writes).toBe(2);
    expect(result.reason).toBe("planner_done");
  });

  it("stops at maxSubtasks", async () => {
    let stIdx = 0;
    const result = await runAutonomousCoding({
      goal: { description: "endless" },
      sandbox: sandboxRW(),
      subtaskPlanner: async () => `subtask ${stIdx++}`,
      toolPlanner: async () => ({
        name: "finish",
        args: { summary: "noop" },
      }),
      maxSubtasks: 2,
    });
    expect(result.subtasks.length).toBe(2);
    expect(result.reason).toBe("max_subtasks");
  });

  it("respects maxWritesTotal across subtasks", async () => {
    let stIdx = 0;
    let writeIdx = 0;
    const result = await runAutonomousCoding({
      goal: { description: "many writes" },
      sandbox: sandboxRW(),
      subtaskPlanner: async () => `subtask ${stIdx++}`,
      toolPlanner: async (_, steps) => {
        if (steps.length === 0) {
          return {
            name: "write_file",
            args: { path: `w${writeIdx++}.txt`, content: "x" },
          };
        }
        return { name: "finish", args: { summary: "ok" } };
      },
      maxSubtasks: 10,
      maxWritesTotal: 2,
    });
    expect(result.totalStats.writes).toBeLessThanOrEqual(2);
  });

  describe("summarizeStep", () => {
    it("formats a write step", () => {
      const step: CodeChatStep = {
        index: 0,
        toolCall: { name: "write_file", args: { path: "x.txt" } },
        result: {
          kind: "write",
          result: { path: "x.txt", byteLength: 100, created: true },
        },
        durationMs: 5,
      };
      expect(summarizeStep(step)).toContain("write x.txt");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// roadmapPlanner
// ═══════════════════════════════════════════════════════════════════════════

describe("Round B4 — roadmapPlanner", () => {
  describe("computePriority", () => {
    it("computes WSJF correctly", () => {
      expect(
        computePriority({
          businessValue: 8,
          timeCriticality: 5,
          riskReduction: 3,
          effort: 4,
        }),
      ).toBe(4);
    });
    it("clamps effort to minimum 1", () => {
      expect(
        computePriority({
          businessValue: 5,
          timeCriticality: 5,
          riskReduction: 5,
          effort: 0,
        }),
      ).toBe(15);
    });
  });

  describe("addItem + iterateRoadmap", () => {
    it("addItem increments version + sets priority", () => {
      const r = addItem(emptyRoadmap(), {
        title: "Add tests",
        description: "More test coverage",
        businessValue: 5,
        timeCriticality: 3,
        riskReduction: 2,
        effort: 2,
      });
      expect(r.items.length).toBe(1);
      expect(r.items[0].priority).toBe(5);
      expect(r.version).toBe(2);
    });

    it("iterateRoadmap promotes top items to ready", () => {
      let r = emptyRoadmap();
      r = addItem(r, {
        title: "low",
        description: "",
        businessValue: 1,
        timeCriticality: 1,
        riskReduction: 1,
        effort: 8,
      });
      r = addItem(r, {
        title: "high",
        description: "",
        businessValue: 8,
        timeCriticality: 8,
        riskReduction: 8,
        effort: 1,
      });
      const it = iterateRoadmap(r, 1);
      expect(it.promoted.length).toBe(1);
      expect(it.promoted[0].title).toBe("high");
    });

    it("rescoreRoadmap recomputes every priority", () => {
      let r = emptyRoadmap();
      r = addItem(r, {
        title: "x",
        description: "",
        businessValue: 5,
        timeCriticality: 5,
        riskReduction: 5,
        effort: 3,
      });
      const rescored = rescoreRoadmap(r.items);
      expect(rescored[0].priority).toBe(5);
    });

    it("nextReadyItems excludes blocked dependencies", () => {
      let r = emptyRoadmap();
      r = addItem(r, {
        title: "depended-on",
        description: "",
        businessValue: 5,
        timeCriticality: 5,
        riskReduction: 5,
        effort: 1,
      });
      const depId = r.items[0].id;
      r = addItem(r, {
        title: "depender",
        description: "",
        businessValue: 5,
        timeCriticality: 5,
        riskReduction: 5,
        effort: 1,
        dependencies: [depId],
      });
      const ready = nextReadyItems(r, 5);
      // Only the no-deps item should be ready
      expect(ready.length).toBe(1);
      expect(ready[0].title).toBe("depended-on");
    });

    it("updateStatus marks an item done", () => {
      let r = emptyRoadmap();
      r = addItem(r, {
        title: "x",
        description: "",
        businessValue: 1,
        timeCriticality: 1,
        riskReduction: 1,
        effort: 1,
      });
      const id = r.items[0].id;
      r = updateStatus(r, id, "done", "completed in pass 30");
      expect(r.items[0].status).toBe("done");
      expect(r.items[0].notes).toContain("pass 30");
    });

    it("rescoreItem updates priority", () => {
      let r = emptyRoadmap();
      r = addItem(r, {
        title: "x",
        description: "",
        businessValue: 1,
        timeCriticality: 1,
        riskReduction: 1,
        effort: 4,
      });
      const id = r.items[0].id;
      r = rescoreItem(r, id, { businessValue: 13 });
      expect(r.items[0].priority).toBeGreaterThan(0);
    });
  });

  describe("computeHealth", () => {
    it("computes status counts + average priority", () => {
      let r = emptyRoadmap();
      r = addItem(r, {
        title: "a",
        description: "",
        businessValue: 5,
        timeCriticality: 5,
        riskReduction: 5,
        effort: 3,
      });
      r = addItem(r, {
        title: "b",
        description: "",
        businessValue: 8,
        timeCriticality: 8,
        riskReduction: 8,
        effort: 2,
      });
      const h = computeHealth(r);
      expect(h.totalItems).toBe(2);
      expect(h.byStatus.backlog).toBe(2);
      expect(h.averagePriority).toBeGreaterThan(0);
      expect(h.highestPriority?.title).toBe("b");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// synthesizer pulls
// ═══════════════════════════════════════════════════════════════════════════

describe("Round A7 — synthesizer wordDiff", () => {
  it("tokenize splits on whitespace + punctuation", () => {
    expect(tokenize("hello, world!")).toEqual(["hello", ",", "world", "!"]);
  });

  it("identical strings produce all 'equal' segments", () => {
    const r = wordDiff("foo bar baz", "foo bar baz");
    expect(r.segments.every((s) => s.op === "equal")).toBe(true);
    expect(r.stats.similarity).toBe(1);
    expect(r.stats.uniqueToA).toBe(0);
    expect(r.stats.uniqueToB).toBe(0);
  });

  it("disjoint strings produce only delete + insert", () => {
    const r = wordDiff("alpha", "beta");
    const ops = new Set(r.segments.map((s) => s.op));
    expect(ops.has("equal")).toBe(false);
    expect(r.stats.shared).toBe(0);
  });

  it("partial overlap produces mixed segments", () => {
    const r = wordDiff("the quick brown fox", "the slow brown fox");
    expect(r.stats.shared).toBeGreaterThan(0);
    expect(r.stats.uniqueToA).toBeGreaterThan(0);
    expect(r.stats.uniqueToB).toBeGreaterThan(0);
  });

  it("similarity is between 0 and 1", () => {
    const r = wordDiff("alpha beta gamma", "alpha delta gamma");
    expect(r.stats.similarity).toBeGreaterThan(0);
    expect(r.stats.similarity).toBeLessThan(1);
  });

  it("pairwiseSimilarities returns N*(N-1)/2 pairs", () => {
    const out = pairwiseSimilarities(["a b", "a c", "a d"]);
    expect(out.length).toBe(3);
  });
});

describe("Round A7 — timeBudgetSelector", () => {
  const models = [
    { id: "fast-1", name: "Fast 1", estimatedResponseMs: 1000, speedRating: "fast" as const, qualityScore: 0.7 },
    { id: "fast-2", name: "Fast 2", estimatedResponseMs: 1500, speedRating: "fast" as const, qualityScore: 0.8 },
    { id: "slow-1", name: "Slow 1", estimatedResponseMs: 8000, speedRating: "slow" as const, qualityScore: 0.95 },
  ];

  it("selects models that fit the budget", () => {
    const r = selectModelsWithinTimeBudget(models, 8000);
    // 4000 overhead + 1000 + 1500 = 6500, fits 2 fast models
    expect(r.fits).toBe(true);
    expect(r.selected.map((m) => m.id)).toEqual(["fast-1", "fast-2"]);
  });

  it("returns fits=false when budget too tight", () => {
    const r = selectModelsWithinTimeBudget(models, 3000, { minModels: 2 });
    expect(r.fits).toBe(false);
  });

  it("respects maxModels cap", () => {
    const r = selectModelsWithinTimeBudget(models, 100_000, { maxModels: 1 });
    expect(r.selected.length).toBe(1);
  });

  it("classifyLatency buckets correctly", () => {
    expect(classifyLatency(800)).toBe("fast");
    expect(classifyLatency(4000)).toBe("moderate");
    expect(classifyLatency(9000)).toBe("slow");
  });
});

describe("Round A7 — costEstimator", () => {
  const pricing = [
    { id: "cheap", inputPer1M: 0.5, outputPer1M: 1.5, medianOutputTokens: 500 },
    { id: "expensive", inputPer1M: 15, outputPer1M: 75, medianOutputTokens: 2000 },
  ];

  it("estimateCost computes per-line and total", () => {
    const r = estimateCost({
      models: pricing,
      promptTokens: 1000,
      taskType: "chat",
    });
    expect(r.lines.length).toBe(2);
    expect(r.totalUSD).toBeGreaterThan(0);
    expect(r.taskMultiplier).toBe(1);
  });

  it("applies discovery multiplier", () => {
    const chat = estimateCost({
      models: pricing,
      promptTokens: 1000,
      taskType: "chat",
    });
    const discovery = estimateCost({
      models: pricing,
      promptTokens: 1000,
      taskType: "discovery",
    });
    expect(discovery.totalUSD).toBeGreaterThan(chat.totalUSD);
  });

  it("modelsUnderCostCeiling prefers cheapest", () => {
    const r = modelsUnderCostCeiling({
      models: pricing,
      promptTokens: 1_000_000,
      taskType: "chat",
      ceilingUSD: 1.0,
    });
    expect(r[0].id).toBe("cheap");
  });

  it("guessTaskType classifies obvious patterns", () => {
    expect(guessTaskType("write me a TypeScript function")).toBe("code");
    expect(guessTaskType("search the web for SOFR rates")).toBe("discovery");
    expect(guessTaskType("generate an image of a chart")).toBe("image");
    expect(guessTaskType("hello")).toBe("chat");
  });

  it("TASK_MULTIPLIERS exposes the canonical map", () => {
    expect(TASK_MULTIPLIERS.discovery).toBeGreaterThan(TASK_MULTIPLIERS.chat);
    expect(TASK_MULTIPLIERS.image).toBeGreaterThanOrEqual(TASK_MULTIPLIERS.discovery);
  });
});
