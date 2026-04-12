/**
 * Wealth-engine tool registration — Round A1.
 *
 * Registers every `we_*` and `chat_*` tool from aiToolCalling.ts into
 * the central aiToolsRegistry so they show up in `discoverTools()`
 * searches and the per-tool usage analytics.
 *
 * This module is idempotent: it checks `getToolByName` before each
 * insert, so it can be safely called on every server boot or via a
 * one-shot CLI.
 *
 * Why we need this even though aiToolCalling.ts already exports the
 * tools: aiToolsRegistry is the SQL-backed registry the chat UI uses
 * for tool discovery, usage stats, and the admin tool catalog. The
 * `Tool[]` arrays in aiToolCalling.ts are the LLM function-call
 * definitions consumed directly by the ReAct loop. The two coexist
 * intentionally; this file keeps them in sync.
 */

import {
  WEALTH_ENGINE_TOOLS,
  WEALTH_CHAT_TOOLS,
} from "../../aiToolCalling";
import {
  registerTool,
  getToolByName,
  updateTool,
} from "../aiToolsRegistry";
import { logger } from "../../_core/logger";

// ─── Tool → trpcProcedure mapping ──────────────────────────────────────────
// The aiToolsRegistry stores a `trpcProcedure` string that describes
// how an external caller would invoke the tool over tRPC. For
// LLM-only tools we still record a synthetic identifier so the
// analytics dashboard can group calls.
const TRPC_MAP: Record<string, string> = {
  // Phase 2C — wealth engine tools
  we_holistic_simulate: "wealthEngine.runPreset",
  we_compare_strategies: "wealthEngine.holisticCompare",
  we_project_biz_income: "wealthEngine.projectBizIncome",
  we_backplan_income: "wealthEngine.backPlanBizIncome",
  we_monte_carlo: "wealthEngine.monteCarloSim",
  we_detect_opportunities: "agent.calculatorOrchestrator.detectOpportunities",
  we_sensitivity_sweep: "wealthEngine.sensitivitySweep",
  we_guardrail_check: "wealthEngine.checkGuardrail",
  we_roll_up_team: "wealthEngine.rollUpTeam",

  // Phase 6A — chat tools (no direct tRPC, dispatched via aiToolCalling)
  chat_explain_number: "wealthChat.explainNumber",
  chat_modify_and_rerun: "wealthChat.modifyAndRerun",
  chat_compare_scenarios: "wealthChat.compareScenarios",
  chat_show_visualization: "wealthChat.showVisualization",
  chat_project_recruit_impact: "wealthChat.projectRecruitImpact",
};

// ─── Tool type classification ─────────────────────────────────────────────
function classifyToolType(
  name: string,
): "calculator" | "model" | "action" | "query" | "report" {
  if (name.startsWith("we_")) {
    if (name === "we_detect_opportunities") return "query";
    return "calculator";
  }
  if (name.startsWith("chat_")) {
    if (name === "chat_show_visualization") return "report";
    if (name === "chat_explain_number") return "query";
    return "action";
  }
  return "calculator";
}

// ─── Public API: register all wealth-engine tools ─────────────────────────

export interface RegistrationResult {
  registered: string[];
  updated: string[];
  skipped: string[];
  errors: Array<{ name: string; error: string }>;
}

export async function registerAllWealthEngineTools(): Promise<RegistrationResult> {
  const result: RegistrationResult = {
    registered: [],
    updated: [],
    skipped: [],
    errors: [],
  };

  const allTools = [...WEALTH_ENGINE_TOOLS, ...WEALTH_CHAT_TOOLS];
  for (const tool of allTools) {
    const fn = (tool as { function: { name: string; description: string; parameters: unknown } }).function;
    const name = fn.name;
    try {
      const existing = await getToolByName(name);
      const inputSchema = fn.parameters;
      if (existing) {
        // Idempotent update: refresh description + schema in case the
        // tool definition has shifted.
        await updateTool(existing.id, {
          description: fn.description,
          inputSchema,
          trpcProcedure: TRPC_MAP[name] ?? `aiToolCalling.${name}`,
          active: true,
        });
        result.updated.push(name);
      } else {
        const created = await registerTool({
          toolName: name,
          toolType: classifyToolType(name),
          description: fn.description,
          inputSchema,
          trpcProcedure: TRPC_MAP[name] ?? `aiToolCalling.${name}`,
          requiresAuth: true,
          requiresConfirmation: false,
        });
        if (created) result.registered.push(name);
        else result.skipped.push(name);
      }
    } catch (err) {
      result.errors.push({
        name,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  logger.info(
    {
      registered: result.registered.length,
      updated: result.updated.length,
      skipped: result.skipped.length,
      errors: result.errors.length,
    },
    "wealth-engine tool registration complete",
  );

  return result;
}

// ─── Counts (for tests / admin dashboard) ─────────────────────────────────

export function expectedToolCount(): number {
  return WEALTH_ENGINE_TOOLS.length + WEALTH_CHAT_TOOLS.length;
}

export function expectedToolNames(): string[] {
  return [
    ...WEALTH_ENGINE_TOOLS,
    ...WEALTH_CHAT_TOOLS,
  ].map((t) => (t as { function: { name: string } }).function.name);
}
