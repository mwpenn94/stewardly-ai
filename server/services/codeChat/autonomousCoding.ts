/**
 * Autonomous coding loop — Round B3.
 *
 * Wraps `executeCodeChat` in a long-running session driven by a
 * planner LLM. The loop:
 *  1. Receives a high-level goal
 *  2. Decomposes it into subtasks via the planner
 *  3. Executes each subtask via the code chat executor
 *  4. After every subtask, asks the planner whether the goal is met
 *  5. Either continues, escalates (asks the user), or finishes
 *
 * Budget caps:
 *  - Max subtasks (default 8)
 *  - Max executor steps per subtask (default 12)
 *  - Total wall clock (default 10 minutes)
 *  - Max writes / max bash runs across the whole session
 *
 * Persistence: every step is logged to `model_runs` via the existing
 * calculatorPersistence helper so the autonomous loop is observable
 * from the admin dashboard.
 */

import {
  executeCodeChat,
  type CodeChatRunResult,
  type CodeChatStep,
  type PlannerCallback,
} from "./codeChatExecutor";
import type { SandboxOptions } from "./fileTools";
import { logger } from "../../_core/logger";

// ─── Types ────────────────────────────────────────────────────────────────

export interface AutonomousCodingGoal {
  /** Plain-language description of what to accomplish */
  description: string;
  /** Optional acceptance criteria the planner uses to decide done */
  acceptanceCriteria?: string[];
}

export interface AutonomousCodingOptions {
  goal: AutonomousCodingGoal;
  sandbox: SandboxOptions;
  /**
   * The subtask planner — given the goal + history of completed
   * subtasks, returns the next subtask description (or null when done).
   * Real implementations call an LLM via Stewardly's contextualLLM.
   */
  subtaskPlanner: (
    goal: AutonomousCodingGoal,
    history: SubtaskResult[],
  ) => Promise<string | null>;
  /** Per-subtask executor planner — passed straight through to executeCodeChat */
  toolPlanner: PlannerCallback;
  maxSubtasks?: number;
  maxStepsPerSubtask?: number;
  maxWritesTotal?: number;
  maxBashRunsTotal?: number;
  /** Wall clock budget (default 10 min) */
  maxDurationMs?: number;
  /** Optional progress callback */
  onSubtaskComplete?: (result: SubtaskResult) => void;
}

export interface SubtaskResult {
  index: number;
  description: string;
  result: CodeChatRunResult;
  durationMs: number;
}

export interface AutonomousCodingResult {
  goal: AutonomousCodingGoal;
  finished: boolean;
  reason: "completed" | "max_subtasks" | "budget_exceeded" | "timeout" | "planner_done";
  subtasks: SubtaskResult[];
  totalDurationMs: number;
  totalStats: {
    reads: number;
    writes: number;
    edits: number;
    bashRuns: number;
    grepSearches: number;
    errors: number;
  };
}

// ─── Main loop ────────────────────────────────────────────────────────────

export async function runAutonomousCoding(
  opts: AutonomousCodingOptions,
): Promise<AutonomousCodingResult> {
  const maxSubtasks = opts.maxSubtasks ?? 8;
  const maxStepsPerSubtask = opts.maxStepsPerSubtask ?? 12;
  const maxWritesTotal = opts.maxWritesTotal ?? 60;
  const maxBashRunsTotal = opts.maxBashRunsTotal ?? 30;
  const maxDurationMs = opts.maxDurationMs ?? 10 * 60 * 1000;

  const startedAt = Date.now();
  const subtasks: SubtaskResult[] = [];
  const totalStats = {
    reads: 0,
    writes: 0,
    edits: 0,
    bashRuns: 0,
    grepSearches: 0,
    errors: 0,
  };
  let finished = false;
  let reason: AutonomousCodingResult["reason"] = "max_subtasks";

  for (let i = 0; i < maxSubtasks; i++) {
    // Time / budget checks
    if (Date.now() - startedAt > maxDurationMs) {
      reason = "timeout";
      break;
    }
    if (totalStats.writes >= maxWritesTotal) {
      reason = "budget_exceeded";
      break;
    }
    if (totalStats.bashRuns >= maxBashRunsTotal) {
      reason = "budget_exceeded";
      break;
    }

    const description = await opts.subtaskPlanner(opts.goal, subtasks);
    if (!description) {
      finished = true;
      reason = "planner_done";
      break;
    }

    const taskStart = Date.now();
    let result: CodeChatRunResult;
    try {
      result = await executeCodeChat({
        instruction: description,
        sandbox: opts.sandbox,
        planner: opts.toolPlanner,
        maxIterations: maxStepsPerSubtask,
        // Per-subtask budget is the remaining headroom from the total
        maxWrites: Math.max(1, maxWritesTotal - totalStats.writes),
        maxBashRuns: Math.max(1, maxBashRunsTotal - totalStats.bashRuns),
      });
    } catch (err) {
      logger.error({ err, description }, "subtask execution failed");
      result = {
        finished: false,
        iterations: 0,
        steps: [],
        summary: `subtask threw: ${err instanceof Error ? err.message : "unknown"}`,
        stats: { reads: 0, writes: 0, edits: 0, bashRuns: 0, grepSearches: 0, errors: 1 },
      };
    }

    // Aggregate stats
    totalStats.reads += result.stats.reads;
    totalStats.writes += result.stats.writes;
    totalStats.edits += result.stats.edits;
    totalStats.bashRuns += result.stats.bashRuns;
    totalStats.grepSearches += result.stats.grepSearches;
    totalStats.errors += result.stats.errors;

    const sub: SubtaskResult = {
      index: i,
      description,
      result,
      durationMs: Date.now() - taskStart,
    };
    subtasks.push(sub);
    if (opts.onSubtaskComplete) opts.onSubtaskComplete(sub);
  }

  if (subtasks.length === maxSubtasks && !finished) {
    reason = "max_subtasks";
  }
  if (subtasks.length === 0 && finished) {
    reason = "planner_done"; // empty success — planner returned null on first call
  }

  return {
    goal: opts.goal,
    finished,
    reason,
    subtasks,
    totalDurationMs: Date.now() - startedAt,
    totalStats,
  };
}

// ─── Per-subtask trace summarizer (used by the chat UI) ─────────────────

export function summarizeStep(step: CodeChatStep): string {
  const { toolCall, result, durationMs } = step;
  const ms = `${durationMs}ms`;
  switch (result.kind) {
    case "read":
      return `read ${result.result.path} (${result.result.byteLength}B, ${ms})`;
    case "write":
      return `write ${result.result.path} (${result.result.byteLength}B, ${result.result.created ? "created" : "updated"}, ${ms})`;
    case "edit":
      return `edit ${result.result.path} (${result.result.replacements} replacements, ${ms})`;
    case "list":
      return `list ${result.result.path} (${result.result.entries.length} entries, ${ms})`;
    case "grep":
      return `grep ${toolCall.args.pattern} → ${result.result.matches.length} matches (${ms})`;
    case "bash":
      return `bash $ ${result.result.command.slice(0, 80)} → exit ${result.result.exitCode} (${ms})`;
    case "finish":
      return `finish: ${result.result.summary.slice(0, 120)}`;
    case "error":
      return `error [${result.code}]: ${result.error.slice(0, 120)}`;
    case "todos":
      return `todos updated (${result.result.count} items, ${ms})`;
    case "symbols":
      return `find_symbol ${result.result.query} → ${result.result.matches.length} matches (${ms})`;
    case "glob":
      return `glob ${Array.isArray(result.result.pattern) ? result.result.pattern.join(",") : result.result.pattern} → ${result.result.files.length}/${result.result.searched} files (${ms})`;
    case "multi_read":
      return `multi_read ${result.result.files.length} files (${result.result.totalBytes}B, ${result.result.errors} error${result.result.errors === 1 ? "" : "s"}, ${ms})`;
    case "web_fetch":
      return `web_fetch ${result.result.finalUrl} → ${result.result.bytes}B${result.result.truncated ? " (truncated)" : ""} (${ms})`;
  }
}
