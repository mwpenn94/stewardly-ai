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
  loadGitHubCredentialsFromEnv,
  getDefaultRepo,
  getRepoInfo,
  listOpenPullRequests,
  GitHubError,
} from "../services/codeChat/githubClient";
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

  // ─── GitHub self-update surface ────────────────────────────────
  // Exposes the read-side of server/services/codeChat/githubClient.ts
  // to the admin Code Chat UI. Credentials are loaded from the
  // GITHUB_TOKEN env var (PAT fallback); OAuth-per-user can still be
  // layered on via integration_connections without touching this
  // router. See docs/ENV_SETUP.md for token setup.

  /** Is the GitHub integration reachable right now? Returns config state without leaking the token. */
  githubStatus: adminProcedure.query(async () => {
    const creds = loadGitHubCredentialsFromEnv();
    const { owner, repo } = getDefaultRepo();
    if (!creds) {
      return {
        configured: false as const,
        source: null,
        owner,
        repo,
        error: "GITHUB_TOKEN env var not set — see docs/ENV_SETUP.md",
      };
    }
    try {
      const info = await getRepoInfo(creds, owner, repo);
      return {
        configured: true as const,
        source: "env" as const,
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
        source: "env" as const,
        owner,
        repo,
        error: `GitHub API returned ${status || "network error"}. Check token scope (needs repo).`,
      };
    }
  }),

  /** List open PRs on the configured repo. Admin only. */
  githubListOpenPRs: adminProcedure.query(async () => {
    const creds = loadGitHubCredentialsFromEnv();
    if (!creds) return { prs: [], error: "GITHUB_TOKEN not configured" };
    const { owner, repo } = getDefaultRepo();
    try {
      const prs = await listOpenPullRequests(creds, owner, repo);
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
});
