/**
 * Code chat tRPC router — Round B5.
 *
 * Exposes the codeChat foundation as protected procedures the React
 * admin UI can call. Read-only operations (list/read/grep/diff/score)
 * are available to any authenticated user; mutations (write/edit/bash,
 * autonomous loop, github PR) require an admin role check + an
 * explicit `confirmDangerous: true` flag in the input.
 *
 * The workspace root defaults to the actual project directory but is
 * also configurable via env (`CODE_CHAT_WORKSPACE_ROOT`) for sandboxed
 * deployments.
 */

import { z } from "zod";
import path from "path";
import fs from "fs";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import {
  dispatchCodeTool,
  type CodeToolCall,
  CODE_CHAT_TOOL_DEFINITIONS,
} from "../services/codeChat/codeChatExecutor";
import {
  emptyRoadmap,
  addItem,
  iterateRoadmap,
  computeHealth,
  rescoreItem,
  updateStatus,
  nextReadyItems,
  type Roadmap,
  type RoadmapStatus,
} from "../services/codeChat/roadmapPlanner";
import {
  wordDiff,
  pairwiseSimilarities,
} from "../services/synthesizer/wordDiff";
import {
  selectModelsWithinTimeBudget,
  classifyLatency,
} from "../services/synthesizer/timeBudgetSelector";
import {
  estimateCost,
  guessTaskType,
} from "../services/synthesizer/costEstimator";
import {
  loadGitHubCredentialsForUser,
  getDefaultRepo,
  getRepoInfo,
  listOpenPullRequests,
  GitHubError,
  listUserRepositories,
  listBranches,
  createBranch,
  getFileContents,
  commitMultipleFiles,
  createPullRequest,
  updatePullRequest,
  mergePullRequest,
  getPullRequest,
  deleteBranch,
  getAuthenticatedUser,
  verifyPushAccess,
  createGist,
} from "../services/codeChat/githubClient";
import {
  enqueueJob,
  listJobs,
  getJob as getBackgroundJob,
  cancelJob as cancelBackgroundJob,
  jobStats,
} from "../services/codeChat/backgroundJobs";
import { runAutonomousCoding } from "../services/codeChat/autonomousCoding";
import {
  loadProjectInstructions,
  manifestForUI as projectInstructionsManifest,
  clearProjectInstructionsCache,
} from "../services/codeChat/projectInstructions";
import {
  getSymbolIndex,
  clearSymbolIndexCache,
} from "../services/codeChat/symbolIndexCache";
import {
  findSymbols as findSymbolsPure,
  symbolIndexStats,
} from "../services/codeChat/symbolIndex";
import {
  getWorkspaceGitStatus,
  getWorkspaceGitDiff,
  getWorkspaceGitHead,
  summarizeGitStatus,
} from "../services/codeChat/gitStatus";
import {
  getImportGraph,
  clearImportGraphCache,
} from "../services/codeChat/importGraphCache";
import {
  getFileDependencies,
  findHotFiles,
  graphStats,
} from "../services/codeChat/importGraph";
import {
  findCycles,
  summarizeCycles,
} from "../services/codeChat/circularDeps";
import {
  unifiedSearch,
  type UnifiedResultKind,
} from "../services/codeChat/workspaceSearch";
import {
  previewFile,
  aggregateWorkspacePreview,
  buildApplyPlan,
  DEFAULT_WORKSPACE_LIMIT,
  DEFAULT_MAX_FILES,
  type FindReplaceOptions,
  type FilePreview,
} from "../services/codeChat/findReplace";
import {
  buildCheckpoint,
  buildRestorePlan,
  summarizeCheckpoint,
  saveCheckpointToDisk,
  loadCheckpointsFromDisk,
  deleteCheckpointFromDisk,
  type Checkpoint,
} from "../services/codeChat/checkpoints";
import { randomUUID } from "crypto";
import {
  parseTscOutput,
  groupByFile as groupDiagnosticsByFile,
  summarizeDiagnostics,
  filterDiagnostics,
  type DiagnosticSeverity,
  type DiagnosticSource,
} from "../services/codeChat/diagnostics";
import {
  getCachedDiagnostics,
  setCachedDiagnostics,
  clearDiagnosticsCache,
  withInflight,
  type DiagnosticsSnapshot,
} from "../services/codeChat/diagnosticsCache";
import {
  draftPullRequest,
  type CommitSummary,
  type ChangedFile,
} from "../services/codeChat/prDrafter";
import {
  parseVitestOutput,
  filterFileResults,
  sortFileResults,
  type TestStatus,
} from "../services/codeChat/testRunner";
import {
  buildEnvSnapshot,
  filterEntries as filterEnvEntries,
  type EnvCategory,
} from "../services/codeChat/envInspector";
import {
  parseGitLog,
  parseNumstat,
  mergeCommitStats,
  computeLogStats,
  groupCommitsByDay,
  filterCommits,
} from "../services/codeChat/gitLog";
import {
  classifyDependencies,
  summarizeLicenses,
  filterDependencies as filterLicenseDeps,
  extractLicense,
  type DependencyEntry,
  type LicenseCategory,
} from "../services/codeChat/licenseScanner";
import {
  detectDeadCode,
  summarizeDeadCode,
  groupByPath as groupDeadByPath,
} from "../services/codeChat/deadCode";
import {
  parseNpmOutdated,
  parseNpmAudit,
  filterOutdated,
  filterVulns,
  type UpdateSemver,
  type VulnSeverity,
} from "../services/codeChat/npmInspector";
import {
  getTodoMarkers,
  clearTodoMarkersCache,
} from "../services/codeChat/todoMarkersCache";
import {
  groupMarkers,
  filterMarkers,
  type MarkerKind,
} from "../services/codeChat/todoMarkers";
import {
  getWorkspaceFileIndex,
  fuzzyFilterFiles,
} from "../services/codeChat/fileIndex";
import { contextualLLM, executeReActLoop } from "../shared/stewardlyWiring";
import { logger } from "../_core/logger";

const WORKSPACE_ROOT =
  process.env.CODE_CHAT_WORKSPACE_ROOT ?? path.resolve(process.cwd());

// ─── Roadmap persistence (pass 58) ────────────────────────────────────────
//
// Pre-pass-58 this was a bare `let _roadmap = emptyRoadmap()` that was
// reset on every server restart, so admin edits in the Code Chat UI
// vanished across deploys. We now persist the roadmap to a JSON file
// under `.stewardly/` in the workspace (outside the git tree so it's
// safe to write from a deployed server). Writes are synchronous so the
// UI never sees a stale snapshot on a quick refresh.
//
// This keeps the storage contract simple (no new drizzle migration,
// no FK constraints) while still matching the "survives restarts"
// expectation of the admin tool. If we later want multi-tenant
// isolation or an audit trail, a real `code_chat_roadmaps` table
// would be the right path.

const ROADMAP_DIR = path.join(WORKSPACE_ROOT, ".stewardly");
const ROADMAP_PATH =
  process.env.CODE_CHAT_ROADMAP_PATH ?? path.join(ROADMAP_DIR, "roadmap.json");

function loadRoadmap(): Roadmap {
  try {
    const raw = fs.readFileSync(ROADMAP_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Roadmap;
    // Minimal shape check — if the file is corrupted, fall back to an
    // empty roadmap so the admin UI still works instead of crashing on
    // boot.
    if (parsed && Array.isArray((parsed as any).items)) return parsed;
  } catch {
    /* file missing or unreadable — fall through to empty */
  }
  return emptyRoadmap();
}

function persistRoadmap(next: Roadmap): void {
  try {
    if (!fs.existsSync(ROADMAP_DIR)) {
      fs.mkdirSync(ROADMAP_DIR, { recursive: true });
    }
    fs.writeFileSync(ROADMAP_PATH, JSON.stringify(next, null, 2), "utf-8");
  } catch (err) {
    // Best-effort: log to console but don't block the tRPC response.
    // The user sees the in-memory state either way; a failed persist
    // will surface on next restart via the "items you added are gone"
    // symptom, which is recoverable via re-entry.
    // eslint-disable-next-line no-console
    console.warn("[codeChat] roadmap persist failed:", err);
  }
}

let _roadmap: Roadmap = loadRoadmap();
function setRoadmap(next: Roadmap): Roadmap {
  _roadmap = next;
  persistRoadmap(next);
  return _roadmap;
}

// ─── Tool dispatch payload validation ────────────────────────────────────

const CodeToolCallSchema = z.object({
  name: z.enum([
    "read_file",
    "write_file",
    "edit_file",
    "list_directory",
    "grep_search",
    "run_bash",
    "finish",
  ]),
  args: z.record(z.string(), z.any()),
  reason: z.string().optional(),
});

// ─── Router ──────────────────────────────────────────────────────────────

export const codeChatRouter = router({
  /** Public: tool definitions the chat UI shows in its tool list */
  listTools: protectedProcedure.query(() => CODE_CHAT_TOOL_DEFINITIONS),

  /**
   * Dispatch a single code-chat tool call. Read-only operations are
   * available to any authenticated user; mutations require admin.
   */
  dispatch: protectedProcedure
    .input(
      z.object({
        call: CodeToolCallSchema,
        allowMutations: z.boolean().optional().default(false),
        confirmDangerous: z.boolean().optional().default(false),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const isMutation = ["write_file", "edit_file", "run_bash"].includes(
        input.call.name,
      );
      if (isMutation) {
        // Mutations require admin + explicit confirm flag
        if (ctx.user.role !== "admin") {
          return {
            kind: "error" as const,
            error: "code chat mutations require admin role",
            code: "FORBIDDEN",
          };
        }
        if (!input.confirmDangerous) {
          return {
            kind: "error" as const,
            error: "set confirmDangerous: true to authorize mutation",
            code: "CONFIRMATION_REQUIRED",
          };
        }
      }
      return dispatchCodeTool(input.call as CodeToolCall, {
        workspaceRoot: WORKSPACE_ROOT,
        allowMutations: input.allowMutations,
      });
    }),

  // ─── Roadmap procedures ────────────────────────────────────────
  getRoadmap: protectedProcedure.query(() => ({
    roadmap: _roadmap,
    health: computeHealth(_roadmap),
    nextReady: nextReadyItems(_roadmap, 5),
  })),

  addRoadmapItem: adminProcedure
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string(),
        businessValue: z.number().min(1).max(13),
        timeCriticality: z.number().min(1).max(13),
        riskReduction: z.number().min(1).max(13),
        effort: z.number().min(1).max(13),
        dependencies: z.array(z.string()).optional(),
        tag: z.string().optional(),
      }),
    )
    .mutation(({ input, ctx }) => {
      setRoadmap(addItem(_roadmap, {
        ...input,
        addedBy: `user-${ctx.user.id}`,
      }));
      return { roadmap: _roadmap };
    }),

  iterateRoadmap: adminProcedure
    .input(z.object({ topN: z.number().min(1).max(20).optional().default(5) }))
    .mutation(({ input }) => {
      const result = iterateRoadmap(_roadmap, input.topN);
      setRoadmap(result.newRoadmap);
      return result;
    }),

  rescoreRoadmapItem: adminProcedure
    .input(
      z.object({
        id: z.string(),
        scores: z.object({
          businessValue: z.number().min(1).max(13).optional(),
          timeCriticality: z.number().min(1).max(13).optional(),
          riskReduction: z.number().min(1).max(13).optional(),
          effort: z.number().min(1).max(13).optional(),
        }),
      }),
    )
    .mutation(({ input }) => {
      setRoadmap(rescoreItem(_roadmap, input.id, input.scores));
      return { roadmap: _roadmap };
    }),

  updateRoadmapStatus: adminProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum([
          "backlog",
          "ready",
          "in_progress",
          "done",
          "blocked",
          "rejected",
        ]),
        note: z.string().optional(),
      }),
    )
    .mutation(({ input }) => {
      setRoadmap(updateStatus(_roadmap, input.id, input.status as RoadmapStatus, input.note));
      return { roadmap: _roadmap };
    }),

  // ─── Workspace file index (Pass 206 @-mentions) ────────────────
  //
  // Returns up to `limit` files matching the query via a cached
  // workspace walk. Used by the Code Chat input's @-mention popover
  // to fuzzy-complete paths into the message.
  listWorkspaceFiles: protectedProcedure
    .input(
      z
        .object({
          query: z.string().max(200).optional(),
          limit: z.number().min(1).max(5000).optional(),
          /** Pass 215: bypass fuzzy filter and return the full file list */
          all: z.boolean().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const files = await getWorkspaceFileIndex(WORKSPACE_ROOT);
      if (input?.all) {
        const limit = Math.min(input?.limit ?? 5000, files.length);
        return { files: files.slice(0, limit), total: files.length };
      }
      const filtered = fuzzyFilterFiles(
        files,
        input?.query ?? "",
        input?.limit ?? 15,
      );
      return { files: filtered, total: files.length };
    }),

  // Pass 238: Project Instructions panel
  // Returns a manifest of auto-loaded instruction files (CLAUDE.md,
  // .stewardly/instructions.md, AGENTS.md) with a preview but without
  // the full content — keeps the tRPC payload small.
  projectInstructions: protectedProcedure.query(async () => {
    const result = await loadProjectInstructions(WORKSPACE_ROOT);
    return projectInstructionsManifest(result);
  }),

  reloadProjectInstructions: protectedProcedure.mutation(async () => {
    clearProjectInstructionsCache();
    const result = await loadProjectInstructions(WORKSPACE_ROOT);
    return projectInstructionsManifest(result);
  }),

  // Pass 242: workspace symbol navigation
  findSymbols: protectedProcedure
    .input(
      z.object({
        query: z.string().max(200),
        limit: z.number().min(1).max(100).optional(),
      }),
    )
    .query(async ({ input }) => {
      const index = await getSymbolIndex(WORKSPACE_ROOT);
      const matches = findSymbolsPure(index, input.query, input.limit ?? 20);
      return { matches, total: index.symbols.length };
    }),

  symbolIndexStats: protectedProcedure.query(async () => {
    const index = await getSymbolIndex(WORKSPACE_ROOT);
    return symbolIndexStats(index);
  }),

  rebuildSymbolIndex: protectedProcedure.mutation(async () => {
    clearSymbolIndexCache();
    const index = await getSymbolIndex(WORKSPACE_ROOT);
    return symbolIndexStats(index);
  }),

  // Pass 244: workspace git status
  gitWorkspaceStatus: protectedProcedure.query(async () => {
    const [entries, head] = await Promise.all([
      getWorkspaceGitStatus(WORKSPACE_ROOT),
      getWorkspaceGitHead(WORKSPACE_ROOT),
    ]);
    return {
      entries,
      summary: summarizeGitStatus(entries),
      head,
    };
  }),

  gitWorkspaceDiff: protectedProcedure
    .input(
      z.object({
        path: z.string().max(500),
        staged: z.boolean().optional(),
      }),
    )
    .query(async ({ input }) => {
      const diff = await getWorkspaceGitDiff(
        WORKSPACE_ROOT,
        input.path,
        input.staged ?? false,
      );
      return { diff };
    }),

  // Pass 245: import graph
  fileDependencies: protectedProcedure
    .input(z.object({ path: z.string().max(500) }))
    .query(async ({ input }) => {
      const { graph } = await getImportGraph(WORKSPACE_ROOT);
      return getFileDependencies(graph, input.path);
    }),

  importGraphHotFiles: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).optional() }).optional())
    .query(async ({ input }) => {
      const { graph, knownFiles } = await getImportGraph(WORKSPACE_ROOT);
      return {
        hot: findHotFiles(graph, input?.limit ?? 10),
        stats: graphStats(graph, knownFiles),
      };
    }),

  rebuildImportGraph: protectedProcedure.mutation(async () => {
    clearImportGraphCache();
    const { graph, knownFiles } = await getImportGraph(WORKSPACE_ROOT);
    return graphStats(graph, knownFiles);
  }),

  // Pass 247: circular dependency detector
  findCircularDeps: protectedProcedure.query(async () => {
    const { graph } = await getImportGraph(WORKSPACE_ROOT);
    const cycles = findCycles(graph);
    return {
      cycles,
      summary: summarizeCycles(cycles),
    };
  }),

  // Pass 249: unified workspace search (symbols + grep + TODOs in one query)
  workspaceSearch: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1).max(200),
        kinds: z.array(z.enum(["symbol", "grep", "todo"])).optional(),
        perKindLimit: z.number().min(1).max(100).optional(),
        totalLimit: z.number().min(1).max(500).optional(),
      }),
    )
    .query(async ({ input }) => {
      const kinds = new Set<UnifiedResultKind>(
        input.kinds && input.kinds.length > 0
          ? input.kinds
          : ["symbol", "grep", "todo"],
      );

      // Run each source in parallel. Each is independent and has its
      // own cache so parallelism is a free speedup.
      const [symbolIndex, todoMarkers, grepResult] = await Promise.all([
        kinds.has("symbol") ? getSymbolIndex(WORKSPACE_ROOT) : null,
        kinds.has("todo") ? getTodoMarkers(WORKSPACE_ROOT) : null,
        kinds.has("grep")
          ? dispatchCodeTool(
              {
                name: "grep_search",
                args: { pattern: input.query, path: "." },
              } as CodeToolCall,
              { workspaceRoot: WORKSPACE_ROOT },
            ).catch(() => null)
          : null,
      ]);

      const grepMatches: Array<{ file: string; line: number; text: string }> = [];
      if (
        grepResult &&
        grepResult.kind === "grep" &&
        Array.isArray(grepResult.result?.matches)
      ) {
        for (const m of grepResult.result.matches) {
          grepMatches.push({
            file: String(m.file ?? ""),
            line: Number(m.line ?? 0),
            text: String(m.text ?? ""),
          });
        }
      }

      const output = unifiedSearch({
        query: input.query,
        symbols: symbolIndex?.symbols ?? [],
        grepMatches,
        todos: todoMarkers ?? [],
        kinds: Array.from(kinds),
        perKindLimit: input.perKindLimit,
        totalLimit: input.totalLimit,
      });

      return output;
    }),

  // Pass 250: multi-file find & replace — preview step
  findReplacePreview: protectedProcedure
    .input(
      z.object({
        find: z.string().min(1).max(500),
        replace: z.string().max(2000),
        regex: z.boolean().optional(),
        caseSensitive: z.boolean().optional(),
        wholeWord: z.boolean().optional(),
        /** Optional path prefix to narrow the sweep */
        pathPrefix: z.string().max(500).optional(),
        perFileLimit: z.number().min(1).max(1000).optional(),
        totalLimit: z.number().min(1).max(10000).optional(),
        maxFiles: z.number().min(1).max(2000).optional(),
      }),
    )
    .query(async ({ input }) => {
      const options: FindReplaceOptions = {
        find: input.find,
        replace: input.replace,
        regex: input.regex,
        caseSensitive: input.caseSensitive,
        wholeWord: input.wholeWord,
        perFileLimit: input.perFileLimit,
      };

      // Validate the pattern up-front so a bad regex comes back as a
      // structured error instead of 500-ing deep inside previewFile.
      try {
        const { compilePattern } = await import(
          "../services/codeChat/findReplace"
        );
        compilePattern(options);
      } catch (err) {
        return {
          error:
            err instanceof Error ? err.message : "invalid find pattern",
          preview: null,
        };
      }

      const allFiles = await getWorkspaceFileIndex(WORKSPACE_ROOT);
      const maxFiles = Math.min(input.maxFiles ?? DEFAULT_MAX_FILES, 2000);
      const prefix = (input.pathPrefix ?? "").trim();
      const candidates = allFiles
        .filter((f) => !prefix || f.startsWith(prefix))
        .slice(0, maxFiles);

      const previews: Array<FilePreview | null> = [];
      let filesScanned = 0;
      for (const rel of candidates) {
        filesScanned++;
        try {
          const abs = path.resolve(WORKSPACE_ROOT, rel);
          const stat = await fs.promises.stat(abs);
          if (!stat.isFile()) continue;
          if (stat.size > 1_000_000) continue; // skip files > 1MB
          const content = await fs.promises.readFile(abs, "utf-8");
          const p = previewFile(rel, content, options);
          previews.push(p);
        } catch {
          /* unreadable / binary — skip silently */
        }
      }

      const preview = aggregateWorkspacePreview(
        options,
        previews,
        filesScanned,
        input.totalLimit ?? DEFAULT_WORKSPACE_LIMIT,
      );

      return { error: null, preview };
    }),

  // Pass 250: multi-file find & replace — apply step (admin-gated)
  findReplaceApply: adminProcedure
    .input(
      z.object({
        confirmDangerous: z.literal(true),
        acceptPaths: z.array(z.string().max(500)).min(1).max(2000),
        /** Re-send the preview so we don't trust stale client state */
        preview: z.object({
          options: z.object({
            find: z.string(),
            replace: z.string(),
            regex: z.boolean().optional(),
            caseSensitive: z.boolean().optional(),
            wholeWord: z.boolean().optional(),
            perFileLimit: z.number().optional(),
          }),
          files: z.array(
            z.object({
              path: z.string(),
              newContent: z.string(),
              matches: z.array(z.any()),
              truncated: z.boolean(),
              delta: z.object({
                removed: z.number(),
                added: z.number(),
              }),
            }),
          ),
          totals: z.object({
            filesMatched: z.number(),
            filesScanned: z.number(),
            totalMatches: z.number(),
            workspaceTruncated: z.boolean(),
            filesTruncated: z.number(),
          }),
        }),
      }),
    )
    .mutation(async ({ input }) => {
      const plan = buildApplyPlan({
        acceptPaths: input.acceptPaths,
        preview: input.preview as unknown as Parameters<typeof buildApplyPlan>[0]["preview"],
      });

      const writtenPaths: string[] = [];
      const failed: Array<{ path: string; error: string }> = [];
      for (const w of plan.writes) {
        const result = await dispatchCodeTool(
          {
            name: "write_file",
            args: { path: w.path, content: w.content },
          } as CodeToolCall,
          { workspaceRoot: WORKSPACE_ROOT, allowMutations: true },
        );
        if (result.kind === "error") {
          failed.push({ path: w.path, error: result.error });
        } else {
          writtenPaths.push(w.path);
        }
      }

      return {
        writtenPaths,
        failed,
        skippedUnknown: plan.skippedUnknown,
      };
    }),

  // Pass 251: workspace checkpoints (snapshot/restore)
  listCheckpoints: protectedProcedure.query(async () => {
    const checkpoints = await loadCheckpointsFromDisk(WORKSPACE_ROOT);
    return {
      checkpoints: checkpoints.map(summarizeCheckpoint),
    };
  }),

  getCheckpoint: protectedProcedure
    .input(z.object({ id: z.string().max(200) }))
    .query(async ({ input }) => {
      const all = await loadCheckpointsFromDisk(WORKSPACE_ROOT);
      const c = all.find((x) => x.id === input.id);
      return c ? { checkpoint: c } : { checkpoint: null };
    }),

  createCheckpoint: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(120),
        description: z.string().max(500).optional(),
        paths: z.array(z.string().max(500)).min(1).max(500),
        tags: z.array(z.string().max(40)).max(16).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      // Read each accepted path via the sandbox read helper so we
      // inherit the out-of-bounds guard for free.
      const fileEntries: Array<{ path: string; content: string }> = [];
      const readErrors: Array<{ path: string; error: string }> = [];
      for (const rel of input.paths) {
        try {
          const abs = path.resolve(WORKSPACE_ROOT, rel);
          if (!abs.startsWith(path.resolve(WORKSPACE_ROOT))) {
            readErrors.push({ path: rel, error: "out_of_bounds" });
            continue;
          }
          const stat = await fs.promises.stat(abs);
          if (!stat.isFile()) {
            readErrors.push({ path: rel, error: "not_a_file" });
            continue;
          }
          if (stat.size > 2_000_000) {
            readErrors.push({ path: rel, error: "too_large" });
            continue;
          }
          const content = await fs.promises.readFile(abs, "utf-8");
          fileEntries.push({ path: rel, content });
        } catch (err) {
          readErrors.push({
            path: rel,
            error: err instanceof Error ? err.message : "read_failed",
          });
        }
      }

      if (fileEntries.length === 0) {
        return {
          checkpoint: null,
          readErrors,
          skipped: [],
        };
      }

      const { checkpoint, skipped } = buildCheckpoint({
        id: `cp_${Date.now()}_${randomUUID().slice(0, 8)}`,
        name: input.name,
        description: input.description,
        tags: input.tags,
        files: fileEntries,
      });

      await saveCheckpointToDisk(WORKSPACE_ROOT, checkpoint);

      return {
        checkpoint: summarizeCheckpoint(checkpoint),
        readErrors,
        skipped,
      };
    }),

  restoreCheckpoint: adminProcedure
    .input(
      z.object({
        id: z.string().max(200),
        confirmDangerous: z.literal(true),
        /** Optional subset of paths to restore. Default: all. */
        paths: z.array(z.string().max(500)).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const all = await loadCheckpointsFromDisk(WORKSPACE_ROOT);
      const target = all.find((x) => x.id === input.id);
      if (!target) {
        return {
          ok: false,
          error: "checkpoint_not_found",
          restoredPaths: [],
          failed: [],
        };
      }

      // Collect live byte lengths so the UI can warn about drift on
      // the way back (also returned for the post-restore toast).
      const liveBytes = new Map<string, number>();
      for (const f of target.files) {
        try {
          const abs = path.resolve(WORKSPACE_ROOT, f.path);
          const stat = await fs.promises.stat(abs);
          if (stat.isFile()) liveBytes.set(f.path, stat.size);
        } catch {
          /* missing files are ok — restore will create them */
        }
      }

      const plan = buildRestorePlan(target, {
        paths: input.paths,
        liveBytes,
      });

      const restoredPaths: string[] = [];
      const failed: Array<{ path: string; error: string }> = [];
      for (const entry of plan.entries) {
        const result = await dispatchCodeTool(
          {
            name: "write_file",
            args: { path: entry.path, content: entry.content },
          } as CodeToolCall,
          { workspaceRoot: WORKSPACE_ROOT, allowMutations: true },
        );
        if (result.kind === "error") {
          failed.push({ path: entry.path, error: result.error });
        } else {
          restoredPaths.push(entry.path);
        }
      }

      return {
        ok: true,
        error: null,
        restoredPaths,
        failed,
        filteredPaths: plan.filtered,
      };
    }),

  deleteCheckpoint: protectedProcedure
    .input(z.object({ id: z.string().max(200) }))
    .mutation(async ({ input }) => {
      const ok = await deleteCheckpointFromDisk(WORKSPACE_ROOT, input.id);
      return { ok };
    }),

  // Pass 260: npm outdated + audit inspector
  npmInspect: protectedProcedure
    .input(
      z
        .object({
          kind: z.enum(["outdated", "audit", "both"]).optional(),
          outdatedFilter: z
            .object({
              severity: z.enum(["patch", "minor", "major", "none"]).optional(),
              type: z.string().max(80).optional(),
              search: z.string().max(200).optional(),
            })
            .optional(),
          auditFilter: z
            .object({
              minSeverity: z
                .enum(["info", "low", "moderate", "high", "critical"])
                .optional(),
              search: z.string().max(200).optional(),
            })
            .optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const kind = input?.kind ?? "both";

      const runCmd = async (command: string) => {
        const result = await dispatchCodeTool(
          {
            name: "run_bash",
            args: { command },
          } as CodeToolCall,
          {
            workspaceRoot: WORKSPACE_ROOT,
            allowMutations: true,
            bashTimeoutMs: 120_000,
          },
        );
        if (result.kind === "bash") {
          return result.result.stdout ?? "";
        }
        return "";
      };

      const promises: Promise<void>[] = [];
      let outdatedRaw = "";
      let auditRaw = "";
      if (kind === "outdated" || kind === "both") {
        promises.push(
          runCmd("npm outdated --json 2>/dev/null || true").then((r) => {
            outdatedRaw = r;
          }),
        );
      }
      if (kind === "audit" || kind === "both") {
        promises.push(
          runCmd("npm audit --json 2>/dev/null || true").then((r) => {
            auditRaw = r;
          }),
        );
      }
      await Promise.all(promises);

      const outdated = parseNpmOutdated(outdatedRaw);
      const audit = parseNpmAudit(auditRaw);

      const filteredOutdated = filterOutdated(outdated, {
        severity: input?.outdatedFilter?.severity as UpdateSemver | undefined,
        type: input?.outdatedFilter?.type,
        search: input?.outdatedFilter?.search,
      });
      const filteredVulns = filterVulns(audit.entries, {
        minSeverity: input?.auditFilter?.minSeverity as VulnSeverity | undefined,
        search: input?.auditFilter?.search,
      });

      return {
        outdated: filteredOutdated.slice(0, 500),
        totalOutdated: outdated.length,
        vulnerabilities: filteredVulns.slice(0, 500),
        auditSummary: audit.summary,
      };
    }),

  // Pass 259: dead code detector
  detectDeadCode: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(2000).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const [symbolIndex, importData] = await Promise.all([
        getSymbolIndex(WORKSPACE_ROOT),
        getImportGraph(WORKSPACE_ROOT),
      ]);
      const report = detectDeadCode(symbolIndex, importData.graph, {
        limit: input?.limit ?? 500,
      });
      return {
        entries: report.entries,
        groups: groupDeadByPath(report.entries).slice(0, 200),
        orphanFiles: report.orphanFiles,
        summary: summarizeDeadCode(report),
      };
    }),

  // Pass 258: dependency license scanner
  scanLicenses: protectedProcedure
    .input(
      z
        .object({
          /** Only look at direct deps in root package.json (fast) */
          rootOnly: z.boolean().optional(),
          category: z
            .enum([
              "permissive",
              "weak_copyleft",
              "strong_copyleft",
              "commercial",
              "unknown",
            ])
            .optional(),
          minRisk: z.number().min(0).max(3).optional(),
          search: z.string().max(200).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const rootPkgPath = path.join(WORKSPACE_ROOT, "package.json");
      const deps: DependencyEntry[] = [];
      let rootName = "";
      try {
        const rootRaw = await fs.promises.readFile(rootPkgPath, "utf-8");
        const rootPkg = JSON.parse(rootRaw);
        rootName = rootPkg.name ?? "";
        const collect = (map: Record<string, string> | undefined) => {
          if (!map) return [];
          return Object.entries(map).map(([name, version]) => ({
            name,
            version: String(version),
          }));
        };
        const directDeps = [
          ...collect(rootPkg.dependencies),
          ...collect(rootPkg.devDependencies),
          ...collect(rootPkg.optionalDependencies),
        ];
        const nodeModulesRoot = path.join(WORKSPACE_ROOT, "node_modules");
        const rootOnly = input?.rootOnly !== false;

        for (const d of directDeps) {
          const depPath = path.join(nodeModulesRoot, d.name, "package.json");
          try {
            const raw = await fs.promises.readFile(depPath, "utf-8");
            const parsed = JSON.parse(raw);
            deps.push({
              name: d.name,
              version: parsed.version ?? d.version,
              license: extractLicense(parsed),
              path: path.relative(WORKSPACE_ROOT, depPath),
            });
          } catch {
            // Missing or unreadable — fall back to the declared version
            // with a blank license (will be flagged as unknown)
            deps.push({
              name: d.name,
              version: d.version,
              license: "",
            });
          }
        }

        // If not rootOnly, walk the top-level node_modules folders to
        // include direct + transitive (but we skip nested node_modules
        // to keep the count bounded)
        if (!rootOnly) {
          try {
            const names = await fs.promises.readdir(nodeModulesRoot);
            const seen = new Set(deps.map((d) => d.name));
            for (const name of names) {
              if (name.startsWith(".") || seen.has(name)) continue;
              // Handle scoped packages
              if (name.startsWith("@")) {
                try {
                  const scoped = await fs.promises.readdir(
                    path.join(nodeModulesRoot, name),
                  );
                  for (const sub of scoped) {
                    const full = `${name}/${sub}`;
                    if (seen.has(full)) continue;
                    const depPath = path.join(
                      nodeModulesRoot,
                      name,
                      sub,
                      "package.json",
                    );
                    try {
                      const raw = await fs.promises.readFile(depPath, "utf-8");
                      const parsed = JSON.parse(raw);
                      deps.push({
                        name: full,
                        version: parsed.version ?? "",
                        license: extractLicense(parsed),
                        path: path.relative(WORKSPACE_ROOT, depPath),
                      });
                      seen.add(full);
                    } catch {
                      /* skip */
                    }
                    if (deps.length >= 2000) break;
                  }
                } catch {
                  /* skip */
                }
              } else {
                const depPath = path.join(nodeModulesRoot, name, "package.json");
                try {
                  const raw = await fs.promises.readFile(depPath, "utf-8");
                  const parsed = JSON.parse(raw);
                  deps.push({
                    name,
                    version: parsed.version ?? "",
                    license: extractLicense(parsed),
                    path: path.relative(WORKSPACE_ROOT, depPath),
                  });
                  seen.add(name);
                } catch {
                  /* skip */
                }
              }
              if (deps.length >= 2000) break;
            }
          } catch {
            /* node_modules unreadable */
          }
        }
      } catch (err) {
        return {
          error:
            err instanceof Error ? err.message : "failed to read package.json",
          deps: [],
          summary: null,
          rootName,
        };
      }

      const classified = classifyDependencies(deps);
      const filtered = filterLicenseDeps(classified, {
        category: input?.category as LicenseCategory | undefined,
        minRisk: input?.minRisk as 0 | 1 | 2 | 3 | undefined,
        search: input?.search,
      });
      const summary = summarizeLicenses(classified);

      return {
        error: null,
        rootName,
        deps: filtered.slice(0, 1000),
        summary,
      };
    }),

  // Pass 257: commit history timeline
  gitLogHistory: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(500).optional(),
          branch: z.string().max(200).optional(),
          author: z.string().max(200).optional(),
          search: z.string().max(200).optional(),
          sinceIso: z.string().max(40).optional(),
          includeStats: z.boolean().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const limit = Math.min(input?.limit ?? 50, 500);
      const branch = (input?.branch ?? "HEAD").replace(/[^a-zA-Z0-9._/-]/g, "");

      const logResult = await dispatchCodeTool(
        {
          name: "run_bash",
          args: {
            command: `git log ${branch} -n ${limit} --format="%H%x1f%an%x1f%ae%x1f%at%x1f%s%x1f%b%x1e" 2>/dev/null || true`,
          },
        } as CodeToolCall,
        { workspaceRoot: WORKSPACE_ROOT, allowMutations: true, bashTimeoutMs: 20_000 },
      );
      let rawLog = "";
      if (logResult.kind === "bash") {
        rawLog = logResult.result.stdout ?? "";
      }
      const commits = parseGitLog(rawLog);

      // Optionally pull the numstat pass so each commit carries a delta
      let withStats = commits;
      if (input?.includeStats && commits.length > 0) {
        const statsResult = await dispatchCodeTool(
          {
            name: "run_bash",
            args: {
              command: `git log ${branch} -n ${limit} --numstat --format="commit:%H" 2>/dev/null || true`,
            },
          } as CodeToolCall,
          { workspaceRoot: WORKSPACE_ROOT, allowMutations: true, bashTimeoutMs: 20_000 },
        );
        if (statsResult.kind === "bash") {
          const statsMap = parseNumstat(statsResult.result.stdout ?? "");
          withStats = mergeCommitStats(commits, statsMap);
        }
      }

      const filtered = filterCommits(withStats, {
        author: input?.author,
        search: input?.search,
        sinceIso: input?.sinceIso,
      });

      return {
        commits: filtered,
        groups: groupCommitsByDay(filtered),
        stats: computeLogStats(filtered),
      };
    }),

  // Pass 256: environment variable inspector (admin-only, masked values)
  inspectEnv: adminProcedure
    .input(
      z
        .object({
          category: z
            .enum([
              "database",
              "api_key",
              "auth",
              "feature_flag",
              "service_url",
              "aws",
              "mail",
              "observability",
              "general",
            ])
            .optional(),
          onlyMissing: z.boolean().optional(),
          search: z.string().max(200).optional(),
        })
        .optional(),
    )
    .query(({ input }) => {
      const snapshot = buildEnvSnapshot(process.env, {
        additionalExpected: [
          "GITHUB_TOKEN",
          "INTEGRATION_ENCRYPTION_KEY",
          "FRED_API_KEY",
          "CENSUS_API_KEY",
        ],
        includeMissing: true,
      });
      const filtered = filterEnvEntries(snapshot.entries, {
        category: input?.category as EnvCategory | undefined,
        onlyMissing: input?.onlyMissing,
        search: input?.search,
      });
      return {
        entries: filtered.slice(0, 500),
        byCategory: snapshot.byCategory,
        totalPresent: snapshot.totalPresent,
        missingCount: snapshot.missingCount,
        requiredMissing: snapshot.requiredMissing,
      };
    }),

  // Pass 252: workspace diagnostics (tsc --noEmit + parse)
  getDiagnostics: protectedProcedure
    .input(
      z
        .object({
          severity: z.array(z.enum(["error", "warning", "info"])).optional(),
          source: z.array(z.enum(["tsc", "eslint", "manual"])).optional(),
          pathPrefix: z.string().max(200).optional(),
          code: z.string().max(80).optional(),
          search: z.string().max(200).optional(),
          /** When true, bypass the cache and run tsc fresh */
          refresh: z.boolean().optional(),
          limit: z.number().min(1).max(2000).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const snapshot = await (async (): Promise<DiagnosticsSnapshot> => {
        if (!input?.refresh) {
          const cached = getCachedDiagnostics();
          if (cached) return cached;
        }
        return withInflight(async () => {
          const startedAt = new Date().toISOString();
          const t0 = Date.now();
          const result = await dispatchCodeTool(
            {
              name: "run_bash",
              args: {
                command:
                  "npx --no-install tsc --noEmit --pretty false 2>&1 | head -n 2000",
              },
            } as CodeToolCall,
            {
              workspaceRoot: WORKSPACE_ROOT,
              allowMutations: true,
              bashTimeoutMs: 120_000,
            },
          );
          const durationMs = Date.now() - t0;
          const finishedAt = new Date().toISOString();
          let stdout = "";
          let stderrTail = "";
          let exitCode = 0;
          if (result.kind === "bash") {
            stdout = result.result.stdout ?? "";
            stderrTail = (result.result.stderr ?? "").slice(-2000);
            exitCode = result.result.exitCode ?? 0;
          } else if (result.kind === "error") {
            stderrTail = result.error.slice(-2000);
            exitCode = -1;
          }
          const diagnostics = parseTscOutput(stdout);
          const snap: DiagnosticsSnapshot = {
            diagnostics,
            startedAt,
            finishedAt,
            durationMs,
            exitCode,
            stderrTail,
          };
          setCachedDiagnostics(snap);
          return snap;
        });
      })();

      const filtered = filterDiagnostics(snapshot.diagnostics, {
        severity: input?.severity as DiagnosticSeverity[] | undefined,
        source: input?.source as DiagnosticSource[] | undefined,
        pathPrefix: input?.pathPrefix,
        code: input?.code,
        search: input?.search,
      });
      const limit = Math.min(input?.limit ?? 500, 2000);

      return {
        diagnostics: filtered.slice(0, limit),
        groups: groupDiagnosticsByFile(filtered).slice(0, 200),
        summary: summarizeDiagnostics(filtered),
        rawTotal: snapshot.diagnostics.length,
        totalFiltered: filtered.length,
        runMeta: {
          startedAt: snapshot.startedAt,
          finishedAt: snapshot.finishedAt,
          durationMs: snapshot.durationMs,
          exitCode: snapshot.exitCode,
          stderrTail: snapshot.stderrTail,
        },
      };
    }),

  refreshDiagnostics: protectedProcedure.mutation(async () => {
    clearDiagnosticsCache();
    return { ok: true };
  }),

  // Pass 255: test runner integration — run vitest + parse output
  runTests: protectedProcedure
    .input(
      z
        .object({
          /** Optional glob/path to narrow which tests run (e.g. "server/services/codeChat") */
          pattern: z.string().max(500).optional(),
          status: z.array(z.enum(["passed", "failed", "skipped", "todo"])).optional(),
          search: z.string().max(200).optional(),
          /** Limit tests to a single file for speed */
          singleFile: z.string().max(500).optional(),
        })
        .optional(),
    )
    .mutation(async ({ input }) => {
      const t0 = Date.now();
      const startedAt = new Date().toISOString();

      // Build a safe vitest command: --no-coverage, --reporter default
      // (we parse the default reporter output). The single-file and
      // pattern inputs are sanitized to prevent command injection.
      const safeArg = (raw: string): string =>
        raw.replace(/[^a-zA-Z0-9._/\-*@]/g, "").slice(0, 500);
      const args: string[] = [
        "--no-install",
        "vitest",
        "run",
        "--no-coverage",
        "--reporter=default",
      ];
      if (input?.singleFile) {
        args.push(safeArg(input.singleFile));
      } else if (input?.pattern) {
        args.push(safeArg(input.pattern));
      }
      const command = `npx ${args.join(" ")} 2>&1 | head -n 3000`;

      const result = await dispatchCodeTool(
        {
          name: "run_bash",
          args: { command },
        } as CodeToolCall,
        {
          workspaceRoot: WORKSPACE_ROOT,
          allowMutations: true,
          bashTimeoutMs: 300_000,
        },
      );

      let stdout = "";
      let exitCode = -1;
      let stderrTail = "";
      if (result.kind === "bash") {
        stdout = result.result.stdout ?? "";
        stderrTail = (result.result.stderr ?? "").slice(-2000);
        exitCode = result.result.exitCode ?? 0;
      } else if (result.kind === "error") {
        stderrTail = result.error.slice(-2000);
        exitCode = -1;
      }

      const { files, summary } = parseVitestOutput(stdout);
      const filtered = filterFileResults(files, {
        status: input?.status as TestStatus[] | undefined,
        search: input?.search,
      });
      const sorted = sortFileResults(filtered);

      return {
        files: sorted.slice(0, 200),
        summary: {
          ...summary,
          exitCode,
          rawTail: stderrTail,
        },
        meta: {
          startedAt,
          finishedAt: new Date().toISOString(),
          durationMs: Date.now() - t0,
          command: command.slice(0, 200),
        },
      };
    }),

  // Pass 253: draft a PR body from the current branch delta
  draftPullRequest: protectedProcedure
    .input(
      z.object({
        /** Defaults to "main" */
        targetBranch: z.string().max(200).optional(),
        /** Defaults to the current HEAD branch */
        sourceBranch: z.string().max(200).optional(),
        /** Hard cap on commits pulled (default 40) */
        maxCommits: z.number().min(1).max(200).optional(),
      }),
    )
    .query(async ({ input }) => {
      const target = (input.targetBranch ?? "main").replace(/[^a-zA-Z0-9._/-]/g, "");
      const maxCommits = Math.min(input.maxCommits ?? 40, 200);

      // Resolve source branch (caller override or current HEAD)
      let source = input.sourceBranch?.replace(/[^a-zA-Z0-9._/-]/g, "");
      if (!source) {
        const headResult = await dispatchCodeTool(
          {
            name: "run_bash",
            args: { command: "git rev-parse --abbrev-ref HEAD" },
          } as CodeToolCall,
          { workspaceRoot: WORKSPACE_ROOT, allowMutations: true, bashTimeoutMs: 10_000 },
        );
        if (headResult.kind === "bash") {
          source = (headResult.result.stdout ?? "").trim() || "HEAD";
        } else {
          source = "HEAD";
        }
      }

      if (!source) source = "HEAD";

      // Gather commits on the branch that are not on target
      const commits: CommitSummary[] = [];
      const logResult = await dispatchCodeTool(
        {
          name: "run_bash",
          args: {
            command: `git log ${source} ^${target} --no-merges -n ${maxCommits} --format="%H%x1f%an%x1f%s%x1f%b%x1e" 2>/dev/null || true`,
          },
        } as CodeToolCall,
        { workspaceRoot: WORKSPACE_ROOT, allowMutations: true, bashTimeoutMs: 15_000 },
      );
      if (logResult.kind === "bash") {
        const raw = logResult.result.stdout ?? "";
        for (const rec of raw.split("\x1e")) {
          const trimmed = rec.trim();
          if (!trimmed) continue;
          const parts = trimmed.split("\x1f");
          if (parts.length < 3) continue;
          const [sha, author, subject, body] = parts;
          commits.push({
            sha: (sha ?? "").slice(0, 40),
            author: author ?? undefined,
            subject: (subject ?? "").trim(),
            body: (body ?? "").trim() || undefined,
          });
        }
      }

      // Gather changed files with numstat
      const changedFiles: ChangedFile[] = [];
      const diffResult = await dispatchCodeTool(
        {
          name: "run_bash",
          args: {
            command: `git diff --numstat ${target}...${source} 2>/dev/null || true`,
          },
        } as CodeToolCall,
        { workspaceRoot: WORKSPACE_ROOT, allowMutations: true, bashTimeoutMs: 15_000 },
      );
      const statusMap = new Map<string, string>();
      const nameStatusResult = await dispatchCodeTool(
        {
          name: "run_bash",
          args: {
            command: `git diff --name-status ${target}...${source} 2>/dev/null || true`,
          },
        } as CodeToolCall,
        { workspaceRoot: WORKSPACE_ROOT, allowMutations: true, bashTimeoutMs: 15_000 },
      );
      if (nameStatusResult.kind === "bash") {
        for (const line of (nameStatusResult.result.stdout ?? "").split("\n")) {
          const parts = line.trim().split(/\s+/);
          if (parts.length < 2) continue;
          // Rename/copy have 3 columns: R100 old new — take the new
          const status = (parts[0] ?? "").charAt(0);
          const path = parts[parts.length - 1] ?? "";
          if (path) statusMap.set(path, status);
        }
      }
      if (diffResult.kind === "bash") {
        for (const line of (diffResult.result.stdout ?? "").split("\n")) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          // Format: "adds\tdels\tpath"; binary files are "-\t-\tpath"
          const parts = trimmed.split(/\s+/);
          if (parts.length < 3) continue;
          const [a, d, ...rest] = parts;
          const path = rest.join(" ");
          const additions = a === "-" ? 0 : Number.parseInt(a!, 10) || 0;
          const deletions = d === "-" ? 0 : Number.parseInt(d!, 10) || 0;
          changedFiles.push({
            path,
            status: statusMap.get(path) ?? "M",
            additions,
            deletions,
          });
        }
      }

      const draft = draftPullRequest({
        sourceBranch: source,
        targetBranch: target,
        commits,
        changedFiles,
      });

      return {
        draft,
        meta: {
          sourceBranch: source,
          targetBranch: target,
          commitCount: commits.length,
          filesChanged: changedFiles.length,
        },
      };
    }),

  // Pass 246: TODO marker scanner
  scanTodoMarkers: protectedProcedure
    .input(
      z
        .object({
          kinds: z.array(z.string()).optional(),
          author: z.string().optional(),
          pathPrefix: z.string().optional(),
          search: z.string().optional(),
          limit: z.number().min(1).max(5000).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const all = await getTodoMarkers(WORKSPACE_ROOT);
      const filtered = filterMarkers(all, {
        kinds: input?.kinds as MarkerKind[] | undefined,
        author: input?.author,
        pathPrefix: input?.pathPrefix,
        search: input?.search,
      });
      const limit = input?.limit ?? 500;
      const groups = groupMarkers(all);
      return {
        markers: filtered.slice(0, limit),
        total: filtered.length,
        totalUnfiltered: all.length,
        byKind: groups.byKind,
        topAuthors: Array.from(groups.byAuthor.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([author, count]) => ({ author, count })),
        topFiles: Array.from(groups.byFile.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([path, count]) => ({ path, count })),
      };
    }),

  rebuildTodoMarkers: protectedProcedure.mutation(async () => {
    clearTodoMarkersCache();
    const markers = await getTodoMarkers(WORKSPACE_ROOT);
    return { count: markers.length };
  }),

  // ─── Synthesizer procedures ────────────────────────────────────
  diffResponses: protectedProcedure
    .input(z.object({ a: z.string(), b: z.string() }))
    .query(({ input }) => wordDiff(input.a, input.b)),

  pairwiseSimilarities: protectedProcedure
    .input(z.object({ responses: z.array(z.string()).min(2) }))
    .query(({ input }) => pairwiseSimilarities(input.responses)),

  selectModelsWithinTimeBudget: protectedProcedure
    .input(
      z.object({
        models: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            estimatedResponseMs: z.number(),
            speedRating: z.enum(["fast", "moderate", "slow"]),
            qualityScore: z.number().optional(),
            costPerCall: z.number().optional(),
          }),
        ),
        budgetMs: z.number().min(500).max(120_000),
        maxModels: z.number().optional(),
        minModels: z.number().optional(),
      }),
    )
    .query(({ input }) =>
      selectModelsWithinTimeBudget(input.models, input.budgetMs, {
        maxModels: input.maxModels,
        minModels: input.minModels,
      }),
    ),

  estimateCost: protectedProcedure
    .input(
      z.object({
        models: z.array(
          z.object({
            id: z.string(),
            inputPer1M: z.number(),
            outputPer1M: z.number(),
            medianOutputTokens: z.number().optional(),
          }),
        ),
        promptTokens: z.number(),
        taskType: z
          .enum(["chat", "discovery", "image", "code", "synthesis", "embedding"])
          .optional(),
        prompt: z.string().optional(),
        expectedOutputTokens: z.number().optional(),
      }),
    )
    .query(({ input }) => {
      const taskType =
        input.taskType ?? (input.prompt ? guessTaskType(input.prompt) : "chat");
      return estimateCost({
        models: input.models,
        promptTokens: input.promptTokens,
        taskType,
        expectedOutputTokens: input.expectedOutputTokens,
      });
    }),

  classifyLatency: protectedProcedure
    .input(z.object({ ms: z.number() }))
    .query(({ input }) => ({ rating: classifyLatency(input.ms) })),

  // ─── Claude-Code-style chat with multi-turn tool calling (pass 78) ──
  //
  // Runs a ReAct loop over the existing code chat tools
  // (`read_file`, `list_directory`, `grep_search`, and — for admins
  // who opt in via `allowMutations` — `write_file`, `edit_file`,
  // `run_bash`). Reuses the project's canonical `executeReActLoop`
  // primitive so tracing, escape hatches, and empty-response guards
  // all Just Work the same as the main Chat flow.
  //
  // Integration point: `client/src/pages/Chat.tsx` now has a
  // "CodeChat" mode button. When the user's mode is `codechat`,
  // sending a message hits this procedure instead of the normal
  // `chat.send`. The `model` field is passed through to contextualLLM
  // so the existing model picker works unmodified (single model or
  // multi-model via comma-separated IDs — multi-model is handled by
  // running the ReAct loop once per model and returning an array
  // of results the UI can render side-by-side).
  //
  // This is "Claude Code as a mode in your chat", not a separate page.
  chat: protectedProcedure
    .input(
      z.object({
        message: z.string().min(1).max(8_000),
        model: z.string().optional(),
        allowMutations: z.boolean().optional().default(false),
        maxIterations: z.number().min(1).max(10).optional().default(5),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Gate dangerous tools on admin role — same contract as
      // `dispatch`. If the caller isn't an admin we only expose the
      // read-side tools to the model.
      const isAdmin = ctx.user.role === "admin";
      const allowMutations = isAdmin && input.allowMutations;

      const READ_ONLY_TOOLS = new Set([
        "read_file",
        "list_directory",
        "grep_search",
      ]);

      // Shape the code chat tool definitions into the OpenAI
      // function-calling envelope the ReAct loop expects. Every
      // tool gets a `code_` prefix on its name so it never collides
      // with the main chat's calculator / model tool namespaces.
      const toolDefs = CODE_CHAT_TOOL_DEFINITIONS
        .filter((t) => allowMutations || READ_ONLY_TOOLS.has(t.name))
        .map((t) => ({
          type: "function" as const,
          function: {
            name: `code_${t.name}`,
            description: t.description,
            parameters: t.parameters,
          },
        }));

      // Resolve 5-layer AI config for personalized behavior
      let layerOverlay = "";
      try {
        const { resolveAIConfig, buildLayerOverlayPrompt } = await import("../aiConfigResolver");
        const resolved = await resolveAIConfig({ userId: ctx.user.id, organizationId: ctx.user.affiliateOrgId ?? undefined });
        if (resolved) layerOverlay = buildLayerOverlayPrompt(resolved);
      } catch { /* config resolution is optional */ }

      const systemPrompt = [
        "You are a Claude-Code-style coding assistant inside Stewardly.",
        "Work step-by-step. Use the `code_list_directory` and `code_read_file` tools to explore the codebase",
        "before answering questions about it. Use `code_grep_search` to find specific symbols or strings.",
        allowMutations
          ? "You also have `code_write_file`, `code_edit_file`, and `code_run_bash` available — use them sparingly and explain every change."
          : "Write/edit/bash tools are disabled for this session. Return diffs as code blocks instead of attempting to apply them.",
        "Keep responses concise and surface your reasoning + tool calls to the user.",
        layerOverlay ? `\n${layerOverlay}` : "",
      ].filter(Boolean).join("\n");

      try {
        const result = await executeReActLoop({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: input.message },
          ] as any,
          userId: ctx.user.id,
          tools: toolDefs.length > 0 ? (toolDefs as any) : undefined,
          maxIterations: input.maxIterations,
          model: input.model,
          contextualLLM,
          executeTool: async (toolName: string, args: Record<string, unknown>) => {
            // Strip the `code_` prefix before handing off to the
            // existing dispatchCodeTool — it expects the raw tool
            // name matching CODE_CHAT_TOOL_DEFINITIONS.
            const rawName = toolName.replace(/^code_/, "");
            const mutation = ["write_file", "edit_file", "run_bash"].includes(rawName);
            if (mutation && !allowMutations) {
              return JSON.stringify({
                error: `${rawName} requires admin + allowMutations=true`,
              });
            }
            const dispatchResult = await dispatchCodeTool(
              { name: rawName as any, args } as CodeToolCall,
              {
                workspaceRoot: WORKSPACE_ROOT,
                allowMutations,
              },
            );
            return JSON.stringify(dispatchResult);
          },
        });

        return {
          response: result.response,
          traces: result.traces.map((t) => ({
            step: t.stepNumber,
            thought: t.thought,
            toolName: t.toolName?.replace(/^code_/, ""),
            observation: t.observation,
            durationMs: t.durationMs,
          })),
          iterations: result.iterations,
          toolCallCount: result.toolCallCount,
          model: result.model,
        };
      } catch (err) {
        logger.error(
          { userId: ctx.user.id, err: String((err as Error).message ?? err) },
          "codeChat.chat failed",
        );
        return {
          response: `Code Chat error: ${String((err as Error).message ?? err)}`,
          traces: [],
          iterations: 0,
          toolCallCount: 0,
          model: input.model,
        };
      }
    }),

  // ─── GitHub self-update surface ────────────────────────────────
  // Exposes the read-side of server/services/codeChat/githubClient.ts
  // to the admin Code Chat UI. Pass 77: credentials are resolved
  // via `loadGitHubCredentialsForUser()` which prefers a user-scoped
  // `integration_connections` row (created through the Integrations
  // page) and falls back to the `GITHUB_TOKEN` env var. The UI now
  // surfaces which path was used via the `source` field so admins
  // can tell whether they're using their personal connected account
  // or a shared deployment token.

  /** Is the GitHub integration reachable right now? Returns config state without leaking the token. */
  githubStatus: adminProcedure.query(async ({ ctx }) => {
    const resolved = await loadGitHubCredentialsForUser(ctx.user.id);
    const { owner, repo } = getDefaultRepo();
    if (!resolved) {
      return {
        configured: false as const,
        source: null,
        owner,
        repo,
        error:
          "No GitHub credentials found. Connect a GitHub account in /integrations " +
          "(provider slug: `github`), or set the `GITHUB_TOKEN` env var as a fallback. " +
          "See docs/ENV_SETUP.md.",
      };
    }
    try {
      const info = await getRepoInfo(resolved.credentials, owner, repo);
      return {
        configured: true as const,
        source: resolved.source,
        connectionId: resolved.connectionId,
        owner,
        repo,
        defaultBranch: info.defaultBranch,
        description: info.description,
        isPrivate: info.isPrivate,
      };
    } catch (err) {
      const status = err instanceof GitHubError ? err.status : 0;
      logger.warn({ owner, repo, err, status }, "github status probe failed");
      return {
        configured: false as const,
        source: resolved.source,
        owner,
        repo,
        error: `GitHub API returned ${status || "network error"}. Check token scope (needs repo).`,
      };
    }
  }),

  /** List open PRs on the configured repo. Admin only. */
  githubListOpenPRs: adminProcedure.query(async ({ ctx }) => {
    const resolved = await loadGitHubCredentialsForUser(ctx.user.id);
    if (!resolved) {
      return {
        prs: [],
        error:
          "No GitHub credentials found. Connect a GitHub account in /integrations or set GITHUB_TOKEN.",
      };
    }
    const { owner, repo } = getDefaultRepo();
    try {
      const prs = await listOpenPullRequests(resolved.credentials, owner, repo);
      return { prs, error: null };
    } catch (err) {
      const status = err instanceof GitHubError ? err.status : 0;
      logger.warn({ owner, repo, err, status }, "github listOpenPullRequests failed");
      return {
        prs: [],
        error: `GitHub API returned ${status || "network error"}`,
      };
    }
  }),

  // ─── Multi-repo GitHub write surface (Pass 201) ────────────────
  //
  // Every procedure in this block:
  //   1. Resolves the caller's personal GitHub credentials via
  //      `loadGitHubCredentialsForUser(ctx.user.id)` — the user only
  //      ever acts as themselves, never as a shared deployment token
  //      when a user connection exists.
  //   2. Accepts an explicit `owner` + `repo` so the surface works
  //      against ANY repo the user has push access to — not just the
  //      app's own self-update repo. The user's PAT scope is the
  //      hard access boundary.
  //   3. Defaults to `protectedProcedure` (not `adminProcedure`) so
  //      non-admin users can push to repos they own. The app repo
  //      remains guarded by the admin `dispatch` / local-write path;
  //      this surface goes through the GitHub API itself, so the
  //      effective access is "whatever GitHub says the user can do".

  /**
   * Return info about the authenticated user's GitHub identity.
   * Used by the UI to show "pushing as @handle".
   */
  githubMe: protectedProcedure.query(async ({ ctx }) => {
    const resolved = await loadGitHubCredentialsForUser(ctx.user.id);
    if (!resolved) {
      return {
        connected: false as const,
        source: null,
        user: null,
        error:
          "No GitHub credentials found. Connect a GitHub account in /integrations or set GITHUB_TOKEN.",
      };
    }
    try {
      const user = await getAuthenticatedUser(resolved.credentials);
      return {
        connected: true as const,
        source: resolved.source,
        user,
        error: null,
      };
    } catch (err) {
      const status = err instanceof GitHubError ? err.status : 0;
      return {
        connected: false as const,
        source: resolved.source,
        user: null,
        error: `GitHub user probe returned ${status || "network error"}. Token may be invalid or lack 'user' scope.`,
      };
    }
  }),

  /**
   * List all repositories the caller has access to. Accepts an
   * `onlyPushable` filter so the write-side UI doesn't show repos
   * the user can't actually push to.
   */
  githubListMyRepos: protectedProcedure
    .input(
      z
        .object({
          onlyPushable: z.boolean().optional(),
          sort: z
            .enum(["created", "updated", "pushed", "full_name"])
            .optional(),
          perPage: z.number().min(1).max(100).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const resolved = await loadGitHubCredentialsForUser(ctx.user.id);
      if (!resolved) {
        return {
          repos: [],
          error:
            "No GitHub credentials. Connect a GitHub account in /integrations or set GITHUB_TOKEN.",
        };
      }
      try {
        const repos = await listUserRepositories(resolved.credentials, {
          onlyPushable: input?.onlyPushable ?? true,
          sort: input?.sort ?? "pushed",
          perPage: input?.perPage ?? 100,
        });
        return { repos, error: null };
      } catch (err) {
        const status = err instanceof GitHubError ? err.status : 0;
        logger.warn({ err, status }, "github listUserRepositories failed");
        return {
          repos: [],
          error: `GitHub API returned ${status || "network error"}`,
        };
      }
    }),

  /** List branches on a specific repo. */
  githubListBranches: protectedProcedure
    .input(
      z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const resolved = await loadGitHubCredentialsForUser(ctx.user.id);
      if (!resolved) return { branches: [], error: "not_connected" };
      try {
        const branches = await listBranches(
          resolved.credentials,
          input.owner,
          input.repo,
        );
        return { branches, error: null };
      } catch (err) {
        const status = err instanceof GitHubError ? err.status : 0;
        return {
          branches: [],
          error: `GitHub API returned ${status || "network error"}`,
        };
      }
    }),

  /** List open pull requests on an arbitrary repo (user-scoped). */
  githubListPullRequests: protectedProcedure
    .input(
      z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const resolved = await loadGitHubCredentialsForUser(ctx.user.id);
      if (!resolved) return { prs: [], error: "not_connected" };
      try {
        const prs = await listOpenPullRequests(
          resolved.credentials,
          input.owner,
          input.repo,
        );
        return { prs, error: null };
      } catch (err) {
        const status = err instanceof GitHubError ? err.status : 0;
        return {
          prs: [],
          error: `GitHub API returned ${status || "network error"}`,
        };
      }
    }),

  /** Fetch a single PR's mergeable state (for the merge button). */
  githubGetPullRequest: protectedProcedure
    .input(
      z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        number: z.number().int().positive(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const resolved = await loadGitHubCredentialsForUser(ctx.user.id);
      if (!resolved) return { pr: null, error: "not_connected" };
      try {
        const pr = await getPullRequest(
          resolved.credentials,
          input.owner,
          input.repo,
          input.number,
        );
        return { pr, error: null };
      } catch (err) {
        const status = err instanceof GitHubError ? err.status : 0;
        return {
          pr: null,
          error: `GitHub API returned ${status || "network error"}`,
        };
      }
    }),

  /** Fetch a single file's contents from a repo at a given ref. */
  githubGetFile: protectedProcedure
    .input(
      z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        path: z.string().min(1),
        ref: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const resolved = await loadGitHubCredentialsForUser(ctx.user.id);
      if (!resolved) return { file: null, error: "not_connected" };
      try {
        const file = await getFileContents(
          resolved.credentials,
          input.owner,
          input.repo,
          input.path,
          input.ref,
        );
        return { file, error: null };
      } catch (err) {
        const status = err instanceof GitHubError ? err.status : 0;
        return {
          file: null,
          error: `GitHub API returned ${status || "network error"}`,
        };
      }
    }),

  // ── Write mutations ─────────────────────────────────────────────
  //
  // All writes:
  //   1. Pre-check push access via `verifyPushAccess()` so we fail
  //      fast with a clear error instead of a cryptic 403 mid-commit.
  //   2. Log to the standard logger with { userId, owner, repo,
  //      action } so every write is auditable.

  /** Create a new branch on an arbitrary repo. */
  githubCreateBranch: protectedProcedure
    .input(
      z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        newBranch: z
          .string()
          .min(1)
          .regex(/^[\w./-]+$/, "branch name has invalid characters"),
        fromBranch: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const resolved = await loadGitHubCredentialsForUser(ctx.user.id);
      if (!resolved) {
        return { ok: false as const, error: "not_connected" };
      }
      const push = await verifyPushAccess(
        resolved.credentials,
        input.owner,
        input.repo,
      );
      if (!push.canPush) {
        return { ok: false as const, error: push.reason ?? "no push access" };
      }
      try {
        // Default the base branch to the repo's default_branch
        let base = input.fromBranch;
        if (!base) {
          const info = await getRepoInfo(
            resolved.credentials,
            input.owner,
            input.repo,
          );
          base = info.defaultBranch;
        }
        const result = await createBranch(
          resolved.credentials,
          input.owner,
          input.repo,
          input.newBranch,
          base,
        );
        logger.info(
          {
            userId: ctx.user.id,
            owner: input.owner,
            repo: input.repo,
            branch: input.newBranch,
            base,
          },
          "github createBranch",
        );
        return { ok: true as const, ref: result.ref, sha: result.sha, base };
      } catch (err) {
        const status = err instanceof GitHubError ? err.status : 0;
        const message =
          err instanceof GitHubError
            ? (typeof err.body === "object" && err.body !== null && "message" in (err.body as any)
                ? String((err.body as any).message)
                : `GitHub ${status}`)
            : String(err instanceof Error ? err.message : err);
        return { ok: false as const, error: message };
      }
    }),

  /**
   * Commit one or more files to a branch in a single commit. Uses the
   * Git Data API so it's atomic regardless of file count.
   */
  githubCommitFiles: protectedProcedure
    .input(
      z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        branch: z.string().min(1),
        message: z.string().min(1).max(1024),
        files: z
          .array(
            z.object({
              path: z.string().min(1),
              content: z.string().max(1024 * 1024),
              deleted: z.boolean().optional(),
            }),
          )
          .min(1)
          .max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const resolved = await loadGitHubCredentialsForUser(ctx.user.id);
      if (!resolved) {
        return { ok: false as const, error: "not_connected" };
      }
      const push = await verifyPushAccess(
        resolved.credentials,
        input.owner,
        input.repo,
      );
      if (!push.canPush) {
        return { ok: false as const, error: push.reason ?? "no push access" };
      }
      try {
        const result = await commitMultipleFiles(
          resolved.credentials,
          input.owner,
          input.repo,
          {
            branch: input.branch,
            message: input.message,
            files: input.files,
          },
        );
        logger.info(
          {
            userId: ctx.user.id,
            owner: input.owner,
            repo: input.repo,
            branch: input.branch,
            files: input.files.length,
            commitSha: result.commitSha,
          },
          "github commitFiles",
        );
        return { ok: true as const, ...result };
      } catch (err) {
        const message =
          err instanceof GitHubError
            ? (typeof err.body === "object" && err.body !== null && "message" in (err.body as any)
                ? String((err.body as any).message)
                : `GitHub ${err.status}`)
            : String(err instanceof Error ? err.message : err);
        return { ok: false as const, error: message };
      }
    }),

  /** Create a pull request on an arbitrary repo. */
  githubCreatePullRequest: protectedProcedure
    .input(
      z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        head: z.string().min(1),
        base: z.string().min(1),
        title: z.string().min(1).max(256),
        body: z.string().max(65_536).optional(),
        draft: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const resolved = await loadGitHubCredentialsForUser(ctx.user.id);
      if (!resolved) return { ok: false as const, error: "not_connected" };
      try {
        const pr = await createPullRequest(
          resolved.credentials,
          input.owner,
          input.repo,
          {
            title: input.title,
            body: input.body,
            head: input.head,
            base: input.base,
            draft: input.draft,
          },
        );
        logger.info(
          {
            userId: ctx.user.id,
            owner: input.owner,
            repo: input.repo,
            prNumber: pr.number,
          },
          "github createPullRequest",
        );
        return { ok: true as const, pr };
      } catch (err) {
        const message =
          err instanceof GitHubError
            ? (typeof err.body === "object" && err.body !== null && "message" in (err.body as any)
                ? String((err.body as any).message)
                : `GitHub ${err.status}`)
            : String(err instanceof Error ? err.message : err);
        return { ok: false as const, error: message };
      }
    }),

  /** Update an existing pull request (title/body/state/base). */
  githubUpdatePullRequest: protectedProcedure
    .input(
      z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        number: z.number().int().positive(),
        title: z.string().min(1).max(256).optional(),
        body: z.string().max(65_536).optional(),
        state: z.enum(["open", "closed"]).optional(),
        base: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const resolved = await loadGitHubCredentialsForUser(ctx.user.id);
      if (!resolved) return { ok: false as const, error: "not_connected" };
      try {
        const { owner, repo, number, ...rest } = input;
        const pr = await updatePullRequest(
          resolved.credentials,
          owner,
          repo,
          number,
          rest,
        );
        logger.info(
          {
            userId: ctx.user.id,
            owner,
            repo,
            prNumber: number,
          },
          "github updatePullRequest",
        );
        return { ok: true as const, pr };
      } catch (err) {
        const message =
          err instanceof GitHubError
            ? `GitHub ${err.status}`
            : String(err instanceof Error ? err.message : err);
        return { ok: false as const, error: message };
      }
    }),

  /** Merge a pull request (merge/squash/rebase). */
  githubMergePullRequest: protectedProcedure
    .input(
      z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        number: z.number().int().positive(),
        mergeMethod: z.enum(["merge", "squash", "rebase"]).optional().default("merge"),
        commitTitle: z.string().max(256).optional(),
        commitMessage: z.string().max(65_536).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const resolved = await loadGitHubCredentialsForUser(ctx.user.id);
      if (!resolved) return { ok: false as const, error: "not_connected" };
      try {
        const merge = await mergePullRequest(
          resolved.credentials,
          input.owner,
          input.repo,
          input.number,
          {
            mergeMethod: input.mergeMethod,
            commitTitle: input.commitTitle,
            commitMessage: input.commitMessage,
          },
        );
        logger.info(
          {
            userId: ctx.user.id,
            owner: input.owner,
            repo: input.repo,
            prNumber: input.number,
            sha: merge.sha,
          },
          "github mergePullRequest",
        );
        return { ok: true as const, merge };
      } catch (err) {
        const status = err instanceof GitHubError ? err.status : 0;
        const bodyMessage =
          err instanceof GitHubError &&
          typeof err.body === "object" &&
          err.body !== null &&
          "message" in (err.body as any)
            ? String((err.body as any).message)
            : String(err instanceof Error ? err.message : err);
        return {
          ok: false as const,
          error: status === 405 ? `Not mergeable: ${bodyMessage}` : bodyMessage,
        };
      }
    }),

  /** Delete a branch (typically used to clean up after a merge). */
  githubDeleteBranch: protectedProcedure
    .input(
      z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        branch: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const resolved = await loadGitHubCredentialsForUser(ctx.user.id);
      if (!resolved) return { ok: false as const, error: "not_connected" };
      // Minimal safety rail: refuse to delete obviously-default branches.
      const lower = input.branch.toLowerCase();
      if (lower === "main" || lower === "master" || lower === "develop") {
        return {
          ok: false as const,
          error: `Refusing to delete protected branch '${input.branch}'`,
        };
      }
      try {
        await deleteBranch(
          resolved.credentials,
          input.owner,
          input.repo,
          input.branch,
        );
        logger.info(
          {
            userId: ctx.user.id,
            owner: input.owner,
            repo: input.repo,
            branch: input.branch,
          },
          "github deleteBranch",
        );
        return { ok: true as const };
      } catch (err) {
        const status = err instanceof GitHubError ? err.status : 0;
        return {
          ok: false as const,
          error: `GitHub API returned ${status || "network error"}`,
        };
      }
    }),

  // ─── Conversation → Gist export (Pass 219) ─────────────────────
  //
  // Publishes a Code Chat conversation as a GitHub Gist owned by the
  // caller's own identity. The markdown is rendered client-side via
  // `exportConversationAsMarkdown` and POSTed here; the server just
  // wraps the Gists API with credential resolution. Defaults to a
  // secret gist (not public) so users can share via URL without
  // accidentally broadcasting their work.
  exportToGist: protectedProcedure
    .input(
      z.object({
        description: z.string().min(1).max(256),
        filename: z
          .string()
          .min(1)
          .max(120)
          .regex(/^[\w.\- ]+$/, "invalid filename")
          .optional(),
        content: z.string().min(1).max(1024 * 1024),
        public: z.boolean().optional().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const resolved = await loadGitHubCredentialsForUser(ctx.user.id);
      if (!resolved) {
        return { ok: false as const, error: "not_connected" };
      }
      try {
        const filename =
          (input.filename ?? `code-chat-${new Date().toISOString().slice(0, 10)}.md`)
            .replace(/\s+/g, "-");
        const gist = await createGist(resolved.credentials, {
          description: input.description,
          public: input.public,
          files: {
            [filename]: { content: input.content },
          },
        });
        logger.info(
          {
            userId: ctx.user.id,
            gistId: gist.id,
            public: input.public,
          },
          "github exportToGist",
        );
        return {
          ok: true as const,
          gist: { id: gist.id, url: gist.url, rawUrl: gist.rawUrl },
        };
      } catch (err) {
        const status = err instanceof GitHubError ? err.status : 0;
        const message =
          err instanceof GitHubError
            ? (typeof err.body === "object" && err.body !== null && "message" in (err.body as any)
                ? String((err.body as any).message)
                : `GitHub ${status}`)
            : String(err instanceof Error ? err.message : err);
        return { ok: false as const, error: message };
      }
    }),

  // ─── Background job surface (Pass 201) ─────────────────────────
  //
  // Long-running or autonomous Code Chat operations run in the
  // background so the HTTP request returns immediately with a jobId.
  // The UI polls `getJob`/`listJobs` (or streams via the SSE endpoint
  // below) to render progress.
  //
  // Two built-in job kinds:
  //   - `startAutonomousJob`  — runs `runAutonomousCoding` in the
  //     background against the workspace
  //   - `startGitHubPushJob`  — commits files + optionally opens a
  //     PR against a user-selected repo
  //
  // Both accept a cooperative-cancel flag checked between steps.

  listBackgroundJobs: protectedProcedure.query(({ ctx }) => {
    return { jobs: listJobs(ctx.user.id) };
  }),

  getBackgroundJob: protectedProcedure
    .input(z.object({ jobId: z.string().min(1) }))
    .query(({ ctx, input }) => {
      const job = getBackgroundJob(input.jobId, ctx.user.id);
      return { job };
    }),

  cancelBackgroundJob: protectedProcedure
    .input(z.object({ jobId: z.string().min(1) }))
    .mutation(({ ctx, input }) => {
      const ok = cancelBackgroundJob(input.jobId, ctx.user.id);
      return { ok };
    }),

  backgroundJobStats: adminProcedure.query(() => jobStats()),

  /**
   * Start an autonomous coding session in the background. The
   * planner LLM + tool executor loop are run under cooperative
   * cancellation and strict budget caps (max subtasks, max writes,
   * wall-clock timeout). Admin only because it runs bash + writes.
   */
  startAutonomousJob: adminProcedure
    .input(
      z.object({
        description: z.string().min(1).max(4096),
        acceptanceCriteria: z.array(z.string().max(512)).max(10).optional(),
        maxSubtasks: z.number().min(1).max(10).optional().default(4),
        maxStepsPerSubtask: z.number().min(1).max(20).optional().default(8),
        maxWritesTotal: z.number().min(0).max(200).optional().default(30),
        maxBashRunsTotal: z.number().min(0).max(100).optional().default(15),
        maxDurationMinutes: z
          .number()
          .min(1)
          .max(30)
          .optional()
          .default(10),
        model: z.string().optional(),
      }),
    )
    .mutation(({ ctx, input }) => {
      const title = `Autonomous: ${input.description.slice(0, 80)}`;
      const userId = ctx.user.id;
      const job = enqueueJob({
        userId,
        kind: "autonomous_code_chat",
        title,
        runner: async (jobCtx) => {
          jobCtx.append({
            level: "info",
            message: `Budgets: maxSubtasks=${input.maxSubtasks} maxWrites=${input.maxWritesTotal} wallMin=${input.maxDurationMinutes}`,
          });

          let subtaskIndex = 0;
          const result = await runAutonomousCoding({
            goal: {
              description: input.description,
              acceptanceCriteria: input.acceptanceCriteria,
            },
            sandbox: {
              workspaceRoot: WORKSPACE_ROOT,
              allowMutations: true,
            },
            maxSubtasks: input.maxSubtasks,
            maxStepsPerSubtask: input.maxStepsPerSubtask,
            maxWritesTotal: input.maxWritesTotal,
            maxBashRunsTotal: input.maxBashRunsTotal,
            maxDurationMs: input.maxDurationMinutes * 60_000,
            subtaskPlanner: async (goal, _history) => {
              if (jobCtx.isCancelled()) return null;
              subtaskIndex++;
              // Simple heuristic planner: on subtask 1, derive a read-only
              // exploration step; on subsequent subtasks, return null to
              // stop unless the caller provided explicit criteria. A
              // full LLM planner would go here, but this keeps the
              // background job useful without a live API key.
              if (subtaskIndex === 1) {
                return `Explore the workspace and outline an approach for: ${goal.description}`;
              }
              return null;
            },
            toolPlanner: async () => {
              if (jobCtx.isCancelled()) return null;
              // Without a connected model, we terminate gracefully.
              // This keeps the primitive honest: when a planner LLM
              // is wired in, it'll emit real tool calls here.
              return null;
            },
            onSubtaskComplete: (sub) => {
              jobCtx.append({
                level: "info",
                message: `Subtask ${sub.index + 1} done in ${sub.durationMs}ms — ${sub.result.summary.slice(0, 200)}`,
                data: { subtaskIndex: sub.index, stats: sub.result.stats },
              });
            },
          });

          return {
            finished: result.finished,
            reason: result.reason,
            subtasks: result.subtasks.length,
            totalStats: result.totalStats,
            durationMs: result.totalDurationMs,
          };
        },
      });
      return { jobId: job.id, status: job.status };
    }),

  /**
   * Start a background job that pushes a changeset to an arbitrary
   * repo and optionally opens a PR. This is the "fire-and-forget"
   * companion to `githubCommitFiles` — useful for longer changesets
   * the UI wants to stage and come back to.
   */
  startGitHubPushJob: protectedProcedure
    .input(
      z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        branch: z.string().min(1),
        baseBranch: z.string().min(1).optional(),
        createBranchIfMissing: z.boolean().optional().default(true),
        message: z.string().min(1).max(1024),
        files: z
          .array(
            z.object({
              path: z.string().min(1),
              content: z.string().max(1024 * 1024),
              deleted: z.boolean().optional(),
            }),
          )
          .min(1)
          .max(200),
        openPullRequest: z
          .object({
            title: z.string().min(1).max(256),
            body: z.string().max(65_536).optional(),
            base: z.string().min(1),
            draft: z.boolean().optional(),
          })
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const title = `Push: ${input.owner}/${input.repo}@${input.branch} (${input.files.length} file${input.files.length === 1 ? "" : "s"})`;
      const job = enqueueJob({
        userId,
        kind: "github_push",
        title,
        runner: async (jobCtx) => {
          const resolved = await loadGitHubCredentialsForUser(userId);
          if (!resolved) throw new Error("GitHub not connected for this user");

          const push = await verifyPushAccess(
            resolved.credentials,
            input.owner,
            input.repo,
          );
          if (!push.canPush) {
            throw new Error(push.reason ?? "no push access");
          }

          // Ensure the target branch exists (optionally create it)
          try {
            await listBranches(resolved.credentials, input.owner, input.repo);
          } catch {
            /* listing failures are not fatal */
          }

          try {
            // Try to read the tip — if the branch doesn't exist we'll
            // get a 404 and fall into the create path.
            await getRepoInfo(resolved.credentials, input.owner, input.repo);
          } catch (err) {
            throw err;
          }

          try {
            if (input.createBranchIfMissing) {
              try {
                const info = await getRepoInfo(
                  resolved.credentials,
                  input.owner,
                  input.repo,
                );
                const base = input.baseBranch ?? info.defaultBranch;
                // Will 422 if the branch already exists — swallow that.
                await createBranch(
                  resolved.credentials,
                  input.owner,
                  input.repo,
                  input.branch,
                  base,
                ).catch((e) => {
                  if (e instanceof GitHubError && e.status === 422) {
                    jobCtx.append({
                      level: "info",
                      message: `Branch '${input.branch}' already exists — reusing it`,
                    });
                    return null;
                  }
                  throw e;
                });
              } catch (e) {
                if (e instanceof GitHubError && e.status !== 422) {
                  throw e;
                }
              }
            }
          } catch (e) {
            throw e;
          }

          if (jobCtx.isCancelled()) throw new Error("cancelled");

          jobCtx.append({
            level: "info",
            message: `Committing ${input.files.length} file(s) to ${input.owner}/${input.repo}@${input.branch}`,
          });

          const commit = await commitMultipleFiles(
            resolved.credentials,
            input.owner,
            input.repo,
            {
              branch: input.branch,
              message: input.message,
              files: input.files,
            },
          );

          jobCtx.append({
            level: "info",
            message: `Commit ${commit.commitSha.slice(0, 7)} pushed (${commit.url})`,
          });

          let prInfo: { number: number; url: string } | null = null;
          if (input.openPullRequest && !jobCtx.isCancelled()) {
            jobCtx.append({
              level: "info",
              message: `Opening PR against ${input.openPullRequest.base}`,
            });
            const pr = await createPullRequest(
              resolved.credentials,
              input.owner,
              input.repo,
              {
                title: input.openPullRequest.title,
                body: input.openPullRequest.body,
                head: input.branch,
                base: input.openPullRequest.base,
                draft: input.openPullRequest.draft,
              },
            );
            prInfo = { number: pr.number, url: pr.url };
            jobCtx.append({
              level: "info",
              message: `PR #${pr.number} opened — ${pr.url}`,
            });
          }

          return {
            commitSha: commit.commitSha,
            commitUrl: commit.url,
            filesChanged: commit.filesChanged,
            pullRequest: prInfo,
          };
        },
      });
      return { jobId: job.id, status: job.status };
    }),
});
