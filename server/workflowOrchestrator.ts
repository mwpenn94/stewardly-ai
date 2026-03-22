import { getDb } from "./db";
import { workflowEventChains, workflowExecutionLog } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";

// ─── Types ─────────────────────────────────────────────────────
export type EventType =
  | "new_client"
  | "client_milestone"
  | "plan_deviation"
  | "market_event"
  | "compliance_due"
  | "annual_review_due"
  | "referral_received"
  | "document_uploaded"
  | "life_event_detected";

export interface WorkflowAction {
  type: "notification" | "task_create" | "in_app_message" | "flag" | "escalate" | "schedule_meeting";
  target: "client" | "advisor" | "admin" | "system";
  config: Record<string, unknown>;
}

export interface EventChain {
  id?: number;
  name: string;
  eventType: EventType;
  actions: WorkflowAction[];
  isActive: boolean;
}

export interface ExecutionResult {
  chainId: number;
  eventSource: string;
  actionsExecuted: number;
  actionsFailed: number;
  results: ActionResult[];
  status: "completed" | "failed" | "partial";
}

export interface ActionResult {
  actionType: string;
  success: boolean;
  message: string;
}

// ─── Default Event Chains ──────────────────────────────────────
export const DEFAULT_CHAINS: EventChain[] = [
  {
    name: "New Client Onboarding",
    eventType: "new_client",
    actions: [
      { type: "notification", target: "advisor", config: { title: "New Client Onboarded", template: "welcome_advisor" } },
      { type: "task_create", target: "advisor", config: { title: "Schedule initial discovery meeting", dueInDays: 3 } },
      { type: "task_create", target: "advisor", config: { title: "Send welcome packet", dueInDays: 1 } },
      { type: "task_create", target: "system", config: { title: "Run suitability assessment", dueInDays: 7 } },
    ],
    isActive: true,
  },
  {
    name: "Plan Deviation Alert",
    eventType: "plan_deviation",
    actions: [
      { type: "notification", target: "client", config: { title: "Plan Check-In", template: "plan_deviation" } },
      { type: "flag", target: "advisor", config: { flagType: "review_needed", priority: "medium" } },
    ],
    isActive: true,
  },
  {
    name: "Annual Review Preparation",
    eventType: "annual_review_due",
    actions: [
      { type: "task_create", target: "advisor", config: { title: "Prepare annual review materials", dueInDays: 14 } },
      { type: "notification", target: "client", config: { title: "Annual Review Coming Up", template: "annual_review_reminder" } },
      { type: "schedule_meeting", target: "system", config: { meetingType: "annual_review", dueInDays: 30 } },
    ],
    isActive: true,
  },
  {
    name: "Compliance Due Date",
    eventType: "compliance_due",
    actions: [
      { type: "notification", target: "advisor", config: { title: "Compliance Action Required", template: "compliance_due" } },
      { type: "escalate", target: "admin", config: { escalateAfterDays: 3, reason: "Compliance deadline approaching" } },
    ],
    isActive: true,
  },
  {
    name: "Life Event Response",
    eventType: "life_event_detected",
    actions: [
      { type: "notification", target: "advisor", config: { title: "Life Event Detected", template: "life_event" } },
      { type: "task_create", target: "advisor", config: { title: "Review plan impact of life event", dueInDays: 5 } },
      { type: "notification", target: "client", config: { title: "We noticed a change", template: "life_event_client" } },
    ],
    isActive: true,
  },
];

// ─── Execution Engine ──────────────────────────────────────────
export async function executeChain(chain: EventChain, eventSource: string): Promise<ExecutionResult> {
  const results: ActionResult[] = [];
  let executed = 0;
  let failed = 0;

  for (const action of chain.actions) {
    try {
      // In production, each action type would dispatch to its handler
      // For now, we simulate execution
      const result = await executeAction(action, eventSource);
      results.push(result);
      if (result.success) executed++;
      else failed++;
    } catch (err) {
      failed++;
      results.push({
        actionType: action.type,
        success: false,
        message: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    }
  }

  const status = failed === 0 ? "completed" : executed === 0 ? "failed" : "partial";

  // Log execution
  if (chain.id) {
    const db = await getDb();
    if (db) {
      await db.insert(workflowExecutionLog).values({
        chainId: chain.id,
        eventSource,
        actionsExecuted: executed,
        actionsFailed: failed,
        resultJson: JSON.stringify(results),
        status,
      });
    }
  }

  return { chainId: chain.id || 0, eventSource, actionsExecuted: executed, actionsFailed: failed, results, status };
}

async function executeAction(action: WorkflowAction, eventSource: string): Promise<ActionResult> {
  // Simulated execution — in production, each type dispatches to real handlers
  switch (action.type) {
    case "notification":
      return { actionType: "notification", success: true, message: `Notification queued: ${(action.config as Record<string, string>).title}` };
    case "task_create":
      return { actionType: "task_create", success: true, message: `Task created: ${(action.config as Record<string, string>).title}` };
    case "in_app_message":
      return { actionType: "in_app_message", success: true, message: `In-app message queued to ${action.target}` };
    case "flag":
      return { actionType: "flag", success: true, message: `Flag set: ${(action.config as Record<string, string>).flagType}` };
    case "escalate":
      return { actionType: "escalate", success: true, message: `Escalation created for ${action.target}` };
    case "schedule_meeting":
      return { actionType: "schedule_meeting", success: true, message: `Meeting scheduling initiated` };
    default:
      return { actionType: action.type, success: false, message: "Unknown action type" };
  }
}

// ─── DB Helpers ────────────────────────────────────────────────
export async function saveEventChain(chain: EventChain) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(workflowEventChains).values({
    name: chain.name,
    eventType: chain.eventType,
    actionsJson: JSON.stringify(chain.actions),
    isActive: chain.isActive,
  });
}

export async function getEventChains() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(workflowEventChains).orderBy(desc(workflowEventChains.createdAt));
}

export async function getChainsByEvent(eventType: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(workflowEventChains)
    .where(eq(workflowEventChains.eventType, eventType));
}

export async function getExecutionLog(limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(workflowExecutionLog)
    .orderBy(desc(workflowExecutionLog.triggeredAt))
    .limit(limit);
}
