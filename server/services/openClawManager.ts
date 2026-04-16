/**
 * OpenClaw Agent Manager — CRUD, setup, and launch agent instances
 * Agents can read, store, and train on compliance data.
 */
import { getDb } from "../db";
import { logger } from "../_core/logger";

const log = logger.child({ module: "openClawManager" });

export type AgentType = "compliance_monitor" | "lead_processor" | "report_generator" | "plan_analyzer" | "custom";

export interface AgentConfig {
  name: string;
  type: AgentType;
  description: string;
  instructions: string;
  model?: string;
  schedule?: string;
  maxBudgetPerRun: number;
  complianceAware: boolean;
  dataSources: string[];
  outputTargets: string[];
}

export async function createAgent(userId: number, config: AgentConfig): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const { agentInstances } = await import("../../drizzle/schema");
    const [result] = await db.insert(agentInstances).values({
      userId,
      workflowType: config.type,
      configJson: config as any,
      instanceStatus: "paused",
      budgetLimitUsd: String(config.maxBudgetPerRun),
      spawnedAt: Date.now(),
    }).$returningId();
    log.info({ userId, agentId: result.id, type: config.type }, "Agent created");
    return result.id;
  } catch (e: any) {
    log.error({ userId, error: e.message }, "Agent creation failed");
    return null;
  }
}

export async function listAgents(userId: number): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const { agentInstances } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const rows = await db.select().from(agentInstances).where(eq(agentInstances.userId, userId));
    return rows.map(r => ({
      id: r.id,
      userId: r.userId,
      config: r.configJson as AgentConfig,
      status: r.instanceStatus,
      totalRuns: r.totalActions || 0,
      totalCost: Number(r.totalCostUsd) || 0,
      createdAt: new Date(r.spawnedAt),
    }));
  } catch { return []; }
}

/**
 * List the recent action log for an agent the caller owns. Used by
 * the AgentManager "Recent runs" panel so users can actually see what
 * their agents produced (previously run results were stored only in
 * communicationArchive with no UI surface).
 */
export async function listAgentActions(
  agentId: number,
  userId: number,
  limit = 20,
): Promise<Array<{
  id: number;
  actionType: string;
  dataAccessed: string | null;
  dataModified: string | null;
  durationMs: number | null;
  error: string | null;
  createdAt: Date;
}>> {
  const db = await getDb();
  if (!db) return [];
  try {
    const { agentInstances, agentActions } = await import("../../drizzle/schema");
    const { eq, and, desc } = await import("drizzle-orm");
    // Authorization: confirm the agent belongs to this user before
    // leaking any action log rows.
    const [owner] = await db
      .select({ userId: agentInstances.userId })
      .from(agentInstances)
      .where(eq(agentInstances.id, agentId))
      .limit(1);
    if (!owner || owner.userId !== userId) return [];
    const rows = await db
      .select()
      .from(agentActions)
      .where(eq(agentActions.agentInstanceId, agentId))
      .orderBy(desc(agentActions.createdAt))
      .limit(limit);
    return rows.map(r => ({
      id: r.id,
      actionType: r.actionType,
      dataAccessed: r.dataAccessedSummary ?? null,
      dataModified: r.dataModifiedSummary ?? null,
      durationMs: r.durationMs ?? null,
      error: r.errorMessage ?? null,
      createdAt: new Date(r.createdAt),
    }));
  } catch {
    return [];
  }
}

export async function launchAgent(agentId: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    const { agentInstances } = await import("../../drizzle/schema");
    const { eq, and } = await import("drizzle-orm");
    const [agent] = await db.select().from(agentInstances)
      .where(and(eq(agentInstances.id, agentId), eq(agentInstances.userId, userId))).limit(1);
    if (!agent) return false;

    await db.update(agentInstances).set({ instanceStatus: "active" }).where(eq(agentInstances.id, agentId));

    const config = agent.configJson as AgentConfig;
    executeAgent(agentId, userId, config).catch(e => log.error({ agentId, error: e.message }, "Agent failed"));
    return true;
  } catch { return false; }
}

export async function stopAgent(agentId: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    const { agentInstances } = await import("../../drizzle/schema");
    const { eq, and } = await import("drizzle-orm");
    await db.update(agentInstances).set({ instanceStatus: "paused" })
      .where(and(eq(agentInstances.id, agentId), eq(agentInstances.userId, userId)));
    return true;
  } catch { return false; }
}

export async function deleteAgent(agentId: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    const { agentInstances } = await import("../../drizzle/schema");
    const { eq, and } = await import("drizzle-orm");
    await db.delete(agentInstances).where(and(eq(agentInstances.id, agentId), eq(agentInstances.userId, userId)));
    return true;
  } catch { return false; }
}

/**
 * Persist one row in `agent_actions` AND increment the totalActions
 * counter on `agent_instances`. This is the hook that lets the
 * AgentManager "Recent runs" panel + the "N runs" counter actually
 * reflect real activity. Before this was wired, the UI showed
 * permanent zeros even after successful launches.
 */
async function logAgentAction(
  agentId: number,
  userId: number,
  params: {
    actionType: string;
    dataAccessed?: string;
    dataModified?: string;
    durationMs?: number;
    errorMessage?: string;
    costUsd?: number;
  },
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    const { agentInstances, agentActions } = await import("../../drizzle/schema");
    const { eq, sql } = await import("drizzle-orm");
    await db.insert(agentActions).values({
      agentInstanceId: agentId,
      actionType: params.actionType,
      dataAccessedSummary: params.dataAccessed?.slice(0, 5000) ?? null,
      dataModifiedSummary: params.dataModified?.slice(0, 5000) ?? null,
      durationMs: params.durationMs ?? null,
      errorMessage: params.errorMessage ?? null,
      createdAt: Date.now(),
    });
    await db
      .update(agentInstances)
      .set({
        totalActions: sql`COALESCE(${agentInstances.totalActions}, 0) + 1`,
        totalCostUsd: sql`COALESCE(${agentInstances.totalCostUsd}, 0) + ${params.costUsd ?? 0}`,
      })
      .where(eq(agentInstances.id, agentId));
  } catch (err) {
    log.warn({ agentId, userId, err: String(err) }, "logAgentAction failed");
  }
}

async function executeAgent(agentId: number, userId: number, config: AgentConfig): Promise<void> {
  const { contextualLLM, executeReActLoop } = await import("../shared/stewardlyWiring");
  const { executeAITool, ALL_AI_TOOLS } = await import("../aiToolCalling");
  const startedAt = Date.now();

  let context = "";
  if (config.complianceAware) {
    try {
      const db = await getDb();
      if (db) {
        const { complianceRules, communicationArchive } = await import("../../drizzle/schema");
        const { desc } = await import("drizzle-orm");
        const rules = await db.select().from(complianceRules).limit(20);
        context += `\nCompliance Rules:\n${rules.map(r => `- ${r.ruleName}: ${r.description}`).join("\n")}`;
        const recent = await db.select().from(communicationArchive).orderBy(desc(communicationArchive.generatedAt)).limit(10);
        context += `\n\nRecent Communications:\n${recent.map(c => `- [${c.contentType}] ${c.contentText?.slice(0, 100)}`).join("\n")}`;
      }
    } catch { /* optional */ }
  }

  try {
    // ── Multi-step ReAct loop with tool calling ──────────────────
    // Agents now use the same ReAct loop as the main chat, giving
    // them access to all 43 AI tools (calculators, models, wealth
    // engine, search, blueprints) for autonomous multi-step reasoning.
    const reactResult = await executeReActLoop({
      messages: [
        { role: "system" as const, content: `You are an autonomous agent named "${config.name}" of type "${config.type}". ${config.description || ""}\n\nYou have access to financial calculators, wealth engine simulations, risk models, and search tools. Use them proactively to gather data and produce thorough findings.${context}` },
        { role: "user" as const, content: `${config.instructions}\n\nExecute your task and provide comprehensive findings. Use available tools to gather data, run calculations, and validate your analysis.` },
      ],
      userId,
      tools: ALL_AI_TOOLS,
      maxIterations: 8,
      model: config.model,
      contextualLLM,
      executeTool: async (toolName: string, args: any) => {
        return executeAITool(toolName, args);
      },
      db: await getDb(),
      onProgress: async (step, iteration, maxIterations) => {
        // Log each ReAct step as an agent_action so the UI can poll for live progress
        try {
          await logAgentAction(agentId, userId, {
            actionType: `step:${iteration}/${maxIterations}${step.toolName ? `:${step.toolName}` : ""}`,
            dataAccessed: step.toolName || undefined,
            dataModified: step.thought?.slice(0, 500) || undefined,
            durationMs: step.durationMs,
          });
        } catch { /* best-effort progress logging */ }
      },
    });
    const result = reactResult.response || "";
    const durationMs = Date.now() - startedAt;

    if (config.complianceAware && result) {
      const db = await getDb();
      if (db) {
        const { communicationArchive } = await import("../../drizzle/schema");
        const threeYears = new Date(); threeYears.setFullYear(threeYears.getFullYear() + 3);
        await db.insert(communicationArchive).values({
          userId, contentType: "plan_analysis",
          contentText: `[Agent:${config.name}] ${result.slice(0, 5000)}`,
          retentionExpiresAt: threeYears,
        });
      }
    }

    // Log the run so the AgentManager UI can surface it to the owner.
    await logAgentAction(agentId, userId, {
      actionType: `${config.type}:run`,
      dataAccessed: config.complianceAware
        ? "compliance_rules + communication_archive"
        : undefined,
      dataModified: result ? result.slice(0, 5000) : undefined,
      durationMs,
    });

    // Flip status back to paused so "Recent runs" reflects completion.
    try {
      const db = await getDb();
      if (db) {
        const { agentInstances } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await db.update(agentInstances).set({ instanceStatus: "paused" }).where(eq(agentInstances.id, agentId));
      }
    } catch { /* best-effort status flip */ }

    try { const { learn } = await import("./ragTrainer"); await learn({ userId, query: `Agent ${config.name}`, response: result }); } catch {}
    log.info({ agentId, type: config.type, durationMs }, "Agent execution completed");
  } catch (e: any) {
    const durationMs = Date.now() - startedAt;
    await logAgentAction(agentId, userId, {
      actionType: `${config.type}:error`,
      durationMs,
      errorMessage: e.message ?? String(e),
    });
    try {
      const db = await getDb();
      if (db) {
        const { agentInstances } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await db.update(agentInstances).set({ instanceStatus: "error" }).where(eq(agentInstances.id, agentId));
      }
    } catch { /* best-effort */ }
    log.error({ agentId, error: e.message }, "Agent execution error");
  }
}
