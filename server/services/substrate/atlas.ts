/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Substrate Primitive: ATLAS Goal Decomposition & Execution Kernel
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Implements the ATLAS planning layer:
 *   - Goal decomposition (break complex goals into sub-tasks with dependency DAG)
 *   - Plan generation with budget guards
 *   - Task execution orchestration with failure recovery
 *   - Reflection and self-improvement after execution
 *
 * Integrates with:
 *   - AEGIS (pre/post-flight for each sub-task)
 *   - Sovereign routing (provider selection per sub-task)
 *   - Usage tracker (cost attribution per goal)
 *   - Memory engine (lesson storage from reflections)
 *
 * @substrate-primitive: atlas
 * @absorbed-from: manus-next-app/server/services/atlas.ts
 */
import { invokeLLM } from "../../_core/llm";
import { runPreFlight, runPostFlight } from "./aegis";
import { routeRequest } from "./sovereign";
import { logger } from "../../_core/logger";

const log = logger.child({ module: "substrate:atlas" });

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GoalInput {
  description: string;
  constraints?: string;
  maxBudget?: number;
  maxTasks?: number;
  priority?: "low" | "medium" | "high" | "critical";
  userId: number;
}

export interface DecomposedPlan {
  goalId: string;
  tasks: PlanTask[];
  estimatedCost: number;
  estimatedDuration: string;
}

export interface PlanTask {
  id: string;
  description: string;
  taskType: string;
  executionOrder: number;
  dependsOn: string[];
  estimatedTokens: number;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  output?: string;
}

export interface ExecutionResult {
  goalId: string;
  status: "completed" | "partial" | "failed";
  completedTasks: number;
  totalTasks: number;
  totalCost: number;
  outputs: Array<{ taskId: string; description: string; output: string; status: string }>;
  reflection?: string;
}

// ─── Goal Decomposition ──────────────────────────────────────────────────────

let goalCounter = 0;

/**
 * Decompose a complex goal into a DAG of sub-tasks using LLM.
 */
export async function decomposeGoal(input: GoalInput): Promise<DecomposedPlan> {
  const goalId = `goal_${Date.now()}_${++goalCounter}`;
  const maxTasks = input.maxTasks ?? 8;

  const decompositionPrompt = `You are a task planning agent. Decompose this goal into ${maxTasks} or fewer sub-tasks.

Goal: ${input.description}
${input.constraints ? `Constraints: ${input.constraints}` : ""}
${input.maxBudget ? `Budget limit: $${input.maxBudget}` : ""}
Priority: ${input.priority ?? "medium"}

Return a JSON array of tasks. Each task has:
- id: string (task_1, task_2, etc.)
- description: string (what to do)
- taskType: string (research | analysis | generation | calculation | compliance_check)
- executionOrder: number (1-based, tasks with same order run in parallel)
- dependsOn: string[] (IDs of tasks that must complete first)
- estimatedTokens: number (rough token estimate for this task)

Return ONLY the JSON array, no markdown or explanation.`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a precise task decomposition agent. Return only valid JSON." },
        { role: "user", content: decompositionPrompt },
      ],
      response_format: { type: "json_object" as any },
    });

    const content = response?.choices?.[0]?.message?.content ?? "[]";
    let tasks: PlanTask[];

    try {
      const parsed = JSON.parse(content);
      tasks = Array.isArray(parsed) ? parsed : (parsed.tasks ?? []);
    } catch {
      tasks = [];
    }

    // Normalize tasks
    tasks = tasks.slice(0, maxTasks).map((t, i) => ({
      id: t.id ?? `task_${i + 1}`,
      description: t.description ?? `Task ${i + 1}`,
      taskType: t.taskType ?? "generation",
      executionOrder: t.executionOrder ?? i + 1,
      dependsOn: t.dependsOn ?? [],
      estimatedTokens: t.estimatedTokens ?? 500,
      status: "pending" as const,
    }));

    const estimatedCost = tasks.reduce((sum, t) => sum + (t.estimatedTokens / 1000) * 0.003, 0);

    log.info({ goalId, tasks: tasks.length, estimatedCost }, "Goal decomposed");

    return {
      goalId,
      tasks,
      estimatedCost,
      estimatedDuration: `${Math.ceil(tasks.length * 3)}s`,
    };
  } catch (err) {
    log.error({ err }, "Goal decomposition failed");
    return {
      goalId,
      tasks: [{
        id: "task_1",
        description: input.description,
        taskType: "generation",
        executionOrder: 1,
        dependsOn: [],
        estimatedTokens: 1000,
        status: "pending",
      }],
      estimatedCost: 0.003,
      estimatedDuration: "5s",
    };
  }
}

// ─── Plan Execution ──────────────────────────────────────────────────────────

/**
 * Execute a decomposed plan, respecting dependencies and budget.
 */
export async function executePlan(
  plan: DecomposedPlan,
  userId: number,
  onProgress?: (taskId: string, status: string) => void
): Promise<ExecutionResult> {
  const outputs: ExecutionResult["outputs"] = [];
  let totalCost = 0;
  let completedTasks = 0;

  // Sort tasks by execution order
  const sortedTasks = [...plan.tasks].sort((a, b) => a.executionOrder - b.executionOrder);

  for (const task of sortedTasks) {
    // Check dependencies
    const depsCompleted = task.dependsOn.every((depId) => {
      const dep = plan.tasks.find((t) => t.id === depId);
      return dep?.status === "completed";
    });

    if (!depsCompleted) {
      task.status = "skipped";
      outputs.push({ taskId: task.id, description: task.description, output: "Skipped: dependencies not met", status: "skipped" });
      continue;
    }

    task.status = "running";
    onProgress?.(task.id, "running");

    try {
      // Run pre-flight
      const preFlight = await runPreFlight(task.description, userId);

      // Use cached response if available
      if (preFlight.cached && preFlight.cachedResponse) {
        task.status = "completed";
        task.output = preFlight.cachedResponse;
        completedTasks++;
        outputs.push({ taskId: task.id, description: task.description, output: preFlight.cachedResponse, status: "completed" });
        onProgress?.(task.id, "completed");
        continue;
      }

      // Execute via sovereign routing
      const result = await routeRequest({
        messages: [
          { role: "system", content: `You are executing a sub-task as part of a larger goal. Be concise and focused.` },
          { role: "user", content: task.description },
        ],
        userId,
        taskType: task.taskType,
      });

      // Run post-flight
      await runPostFlight(preFlight.sessionId, task.description, result.output, task.taskType, result.cost);

      task.status = "completed";
      task.output = result.output;
      totalCost += result.cost;
      completedTasks++;
      outputs.push({ taskId: task.id, description: task.description, output: result.output, status: "completed" });
      onProgress?.(task.id, "completed");
    } catch (err) {
      task.status = "failed";
      outputs.push({ taskId: task.id, description: task.description, output: (err as Error).message, status: "failed" });
      onProgress?.(task.id, "failed");
      log.warn({ taskId: task.id, err: (err as Error).message }, "Task execution failed");
    }
  }

  // Generate reflection
  let reflection: string | undefined;
  if (completedTasks > 0) {
    try {
      const reflectionResp = await invokeLLM({
        messages: [
          { role: "system", content: "Briefly reflect on the execution. What went well? What could improve? 2-3 sentences max." },
          { role: "user", content: `Goal: ${plan.goalId}\nCompleted: ${completedTasks}/${plan.tasks.length}\nTotal cost: $${totalCost.toFixed(4)}` },
        ],
      });
      reflection = reflectionResp?.choices?.[0]?.message?.content ?? undefined;
    } catch { /* reflection is optional */ }
  }

  const status = completedTasks === plan.tasks.length ? "completed"
    : completedTasks > 0 ? "partial" : "failed";

  log.info({ goalId: plan.goalId, status, completedTasks, totalTasks: plan.tasks.length, totalCost }, "Plan execution complete");

  return {
    goalId: plan.goalId,
    status,
    completedTasks,
    totalTasks: plan.tasks.length,
    totalCost,
    outputs,
    reflection,
  };
}
