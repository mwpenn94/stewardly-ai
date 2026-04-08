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

// In-memory roadmap singleton for the running process. The full
// implementation will persist this in modelRuns (slug=roadmap), but
// for the foundation we keep it in-memory so the admin UI works
// immediately.
let _roadmap: Roadmap = emptyRoadmap();

const WORKSPACE_ROOT =
  process.env.CODE_CHAT_WORKSPACE_ROOT ?? path.resolve(process.cwd());

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
      _roadmap = addItem(_roadmap, {
        ...input,
        addedBy: `user-${ctx.user.id}`,
      });
      return { roadmap: _roadmap };
    }),

  iterateRoadmap: adminProcedure
    .input(z.object({ topN: z.number().min(1).max(20).optional().default(5) }))
    .mutation(({ input }) => {
      const result = iterateRoadmap(_roadmap, input.topN);
      _roadmap = result.newRoadmap;
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
      _roadmap = rescoreItem(_roadmap, input.id, input.scores);
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
      _roadmap = updateStatus(_roadmap, input.id, input.status as RoadmapStatus, input.note);
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
});
