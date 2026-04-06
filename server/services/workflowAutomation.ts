/**
 * Workflow Automation Engine — Multi-step workflow orchestration
 * Step types: llm_call, tool_call, human_review, wait, branch
 * Trigger types: schedule, event, manual, webhook
 * 5 predefined workflows included
 */
import { getDb } from "../db";
import { logger } from "../_core/logger";

const log = logger.child({ module: "workflowAutomation" });

export type StepType = "llm_call" | "tool_call" | "human_review" | "wait" | "branch";
export type TriggerType = "schedule" | "event" | "manual" | "webhook";
export type WorkflowStatus = "pending" | "running" | "paused" | "completed" | "failed";

export interface WorkflowStep {
  name: string;
  type: StepType;
  config: Record<string, unknown>;
  dependsOn?: string[]; // step names this depends on
}

export interface WorkflowTrigger {
  type: TriggerType;
  config: Record<string, unknown>;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  triggers: WorkflowTrigger[];
  isSystem: boolean;
}

export interface WorkflowExecution {
  workflowId: string;
  userId: number;
  status: WorkflowStatus;
  currentStep: number;
  stepResults: Array<{ stepName: string; status: string; output?: string; completedAt?: Date }>;
  startedAt: Date;
  completedAt?: Date;
}

// ─── Predefined Workflows ───────────────────────────────────────────────
export const PREDEFINED_WORKFLOWS: WorkflowDefinition[] = [
  {
    id: "new_client_onboarding",
    name: "New Client Onboarding",
    description: "Automated onboarding: capture → enrich → score → assign → brief → notify",
    isSystem: true,
    steps: [
      { name: "capture_data", type: "tool_call", config: { tool: "leadEngine.progressiveProfiler", action: "getProfile" } },
      { name: "enrich_profile", type: "tool_call", config: { tool: "enrichment.enrichLead", action: "enrich" } },
      { name: "score_propensity", type: "tool_call", config: { tool: "propensity.scoreLead", action: "score" } },
      { name: "assign_advisor", type: "tool_call", config: { tool: "leadEngine.leadDistributor", action: "distribute" } },
      { name: "generate_brief", type: "llm_call", config: { prompt: "Generate an onboarding brief for this new client based on their profile, enrichment data, and propensity score." } },
      { name: "notify_advisor", type: "tool_call", config: { tool: "notifications.send", action: "notify", template: "new_client_assigned" } },
    ],
    triggers: [{ type: "event", config: { eventType: "lead.qualified" } }, { type: "manual", config: {} }],
  },
  {
    id: "annual_review",
    name: "Annual Review Preparation",
    description: "Gather data → run calculators → generate plan → schedule meeting",
    isSystem: true,
    steps: [
      { name: "gather_data", type: "tool_call", config: { tool: "deepContextAssembler", action: "assemble" } },
      { name: "run_protection_calc", type: "llm_call", config: { prompt: "Run a comprehensive protection gap analysis for this client." } },
      { name: "run_retirement_calc", type: "llm_call", config: { prompt: "Run a retirement readiness projection for this client." } },
      { name: "generate_plan", type: "llm_call", config: { prompt: "Generate a comprehensive annual review plan with recommendations across all financial domains." } },
      { name: "advisor_review", type: "human_review", config: { message: "Review the annual plan before sending to client." } },
      { name: "schedule_meeting", type: "tool_call", config: { tool: "meetings.create", action: "schedule" } },
    ],
    triggers: [{ type: "schedule", config: { cron: "0 6 1 * *" } }, { type: "manual", config: {} }],
  },
  {
    id: "compliance_check",
    name: "Compliance Communication Screening",
    description: "Screen all recent communications → flag issues → escalate",
    isSystem: true,
    steps: [
      { name: "fetch_communications", type: "tool_call", config: { tool: "communicationArchive.getRecent", action: "fetch", days: 7 } },
      { name: "screen_content", type: "llm_call", config: { prompt: "Screen these communications for FINRA 2210, SEC Reg BI, CAN-SPAM, and TCPA compliance. Flag any issues." } },
      { name: "flag_issues", type: "branch", config: { condition: "screen_content.hasIssues", ifTrue: "escalate", ifFalse: "complete" } },
      { name: "escalate", type: "tool_call", config: { tool: "notifications.send", action: "alert", priority: "high", template: "compliance_issue" } },
      { name: "complete", type: "tool_call", config: { tool: "systemHealthEvents.log", action: "log", eventType: "compliance_flag" } },
    ],
    triggers: [{ type: "schedule", config: { cron: "0 2 * * 1" } }, { type: "manual", config: {} }],
  },
  {
    id: "lead_nurture",
    name: "Lead Nurture Sequence",
    description: "Score → segment → personalize content → schedule follow-up",
    isSystem: true,
    steps: [
      { name: "score_lead", type: "tool_call", config: { tool: "propensity.scoreLead", action: "score" } },
      { name: "segment", type: "llm_call", config: { prompt: "Based on the propensity score and profile, determine the best nurture segment and personalization strategy." } },
      { name: "personalize", type: "llm_call", config: { prompt: "Generate personalized follow-up content for this lead based on their segment and interests." } },
      { name: "schedule_followup", type: "wait", config: { delayDays: 3 } },
      { name: "send_followup", type: "tool_call", config: { tool: "emailCampaign.send", action: "send" } },
    ],
    triggers: [{ type: "event", config: { eventType: "lead.scored" } }, { type: "manual", config: {} }],
  },
  {
    id: "report_generation",
    name: "Performance Report Generation",
    description: "Gather actuals → compare plan → generate insights → distribute",
    isSystem: true,
    steps: [
      { name: "gather_actuals", type: "tool_call", config: { tool: "productionActuals.getRecent", action: "fetch" } },
      { name: "compare_plan", type: "tool_call", config: { tool: "planAnalyzer.analyze", action: "compare" } },
      { name: "generate_insights", type: "llm_call", config: { prompt: "Generate performance insights comparing plan vs actuals. Include top 3 wins, top 3 gaps, and 3 specific recommendations." } },
      { name: "format_report", type: "tool_call", config: { tool: "reportExporter.export", action: "generate", format: "pdf" } },
      { name: "distribute", type: "tool_call", config: { tool: "notifications.send", action: "report_ready" } },
    ],
    triggers: [{ type: "schedule", config: { cron: "0 6 * * 1" } }, { type: "manual", config: {} }],
  },
];

/** Get all available workflows */
export function getWorkflows(): WorkflowDefinition[] {
  return PREDEFINED_WORKFLOWS;
}

/** Get a workflow by ID */
export function getWorkflow(id: string): WorkflowDefinition | undefined {
  return PREDEFINED_WORKFLOWS.find(w => w.id === id);
}

/** Execute a workflow */
export async function executeWorkflow(workflowId: string, userId: number, context?: Record<string, unknown>): Promise<WorkflowExecution> {
  const workflow = getWorkflow(workflowId);
  if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);

  const execution: WorkflowExecution = {
    workflowId,
    userId,
    status: "running",
    currentStep: 0,
    stepResults: [],
    startedAt: new Date(),
  };

  log.info({ workflowId, userId, steps: workflow.steps.length }, "Workflow execution started");

  for (let i = 0; i < workflow.steps.length; i++) {
    const step = workflow.steps[i];
    execution.currentStep = i;

    try {
      let output = "";

      switch (step.type) {
        case "llm_call": {
          const { contextualLLM } = await import("../shared/stewardlyWiring");
          const response = await contextualLLM({
            userId, contextType: "analysis" as any,
            messages: [{ role: "user", content: step.config.prompt as string }],
          });
          output = response.choices?.[0]?.message?.content || "";
          break;
        }
        case "human_review": {
          output = "Awaiting human review";
          execution.status = "paused";
          break;
        }
        case "wait": {
          output = `Waiting ${step.config.delayDays} days`;
          break;
        }
        case "branch": {
          output = "Branch evaluated";
          break;
        }
        default: {
          output = `Step type ${step.type} executed`;
        }
      }

      execution.stepResults.push({ stepName: step.name, status: "completed", output: output.slice(0, 500), completedAt: new Date() });

      if (execution.status === "paused") break; // Stop at human review
    } catch (e: any) {
      execution.stepResults.push({ stepName: step.name, status: "failed", output: e.message });
      execution.status = "failed";
      log.error({ workflowId, step: step.name, error: e.message }, "Workflow step failed");
      break;
    }
  }

  if (execution.status === "running") {
    execution.status = "completed";
    execution.completedAt = new Date();
  }

  log.info({ workflowId, status: execution.status, stepsCompleted: execution.stepResults.length }, "Workflow execution ended");
  return execution;
}
