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

async function executeAgent(agentId: number, userId: number, config: AgentConfig): Promise<void> {
  const { contextualLLM } = await import("../shared/stewardlyWiring");

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
    const response = await contextualLLM({
      userId, contextType: "analysis" as any, model: config.model,
      messages: [{ role: "user", content: `${config.instructions}\n\nAgent: ${config.type}\n${context}\n\nExecute and provide findings.` }],
    });
    const result = response.choices?.[0]?.message?.content || "";

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

    try { const { learn } = await import("./ragTrainer"); await learn({ userId, query: `Agent ${config.name}`, response: result }); } catch {}
    log.info({ agentId, type: config.type }, "Agent execution completed");
  } catch (e: any) {
    log.error({ agentId, error: e.message }, "Agent execution error");
  }
}
