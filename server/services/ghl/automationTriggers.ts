/**
 * GHL automation triggers — Phase 3D.
 *
 * Five workflow entry points exactly matching the spec:
 *
 *  1. triggerNurtureSequence(contactId, planType)
 *  2. checkStrategyComparer(email, runCount, lastRunDate)    (runCount ≥ 2 in 7 days)
 *  3. checkHighValue(contactId, totalValue30yr)              (> $1M)
 *  4. onPlanShared(contactId, shareUrl)
 *  5. checkReengagement()                                    (cron daily)
 *
 * Each trigger is pure — given inputs, it calls ghlClient to fire the
 * appropriate side effect (add to workflow / create task / update contact).
 * The caller decides WHEN to fire; this module decides WHAT to do.
 */

import {
  addContactToWorkflow,
  createTask,
  loadGHLConfig,
  type GHLConfig,
} from "./ghlClient";
import { logger } from "../../_core/logger";

// ─── Workflow registry ─────────────────────────────────────────────────────
// Workflow IDs vary per GHL sub-account and should be configured via env
// or the integration connection's configJson blob. For Phase 3D we
// expose a resolver the caller can override.

export interface WorkflowRegistry {
  nurture: {
    basic: string;
    growth: string;
    premium: string;
    custom: string;
  };
  reengagement: string;
}

// Default env-sourced registry — prod deployments override via
// config.json on the integration connection.
export function loadWorkflowRegistry(
  overrides?: Partial<WorkflowRegistry>,
): WorkflowRegistry {
  return {
    nurture: {
      basic: overrides?.nurture?.basic ?? process.env.GHL_WORKFLOW_NURTURE_BASIC ?? "",
      growth:
        overrides?.nurture?.growth ?? process.env.GHL_WORKFLOW_NURTURE_GROWTH ?? "",
      premium:
        overrides?.nurture?.premium ?? process.env.GHL_WORKFLOW_NURTURE_PREMIUM ?? "",
      custom:
        overrides?.nurture?.custom ?? process.env.GHL_WORKFLOW_NURTURE_CUSTOM ?? "",
    },
    reengagement:
      overrides?.reengagement ??
      process.env.GHL_WORKFLOW_REENGAGEMENT ??
      "",
  };
}

// ─── Date helpers (spec uses date-fns semantics) ──────────────────────────

export function daysSince(date: Date | string): number {
  const ms = Date.now() - new Date(date).getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

// ═══════════════════════════════════════════════════════════════════════════
// Trigger 1 — Calculator completed → nurture sequence
// ═══════════════════════════════════════════════════════════════════════════

export async function triggerNurtureSequence(
  cfg: GHLConfig,
  contactId: string,
  planType: keyof WorkflowRegistry["nurture"],
  registry: WorkflowRegistry = loadWorkflowRegistry(),
): Promise<{ ok: boolean; workflowId?: string; error?: string }> {
  const workflowId = registry.nurture[planType];
  if (!workflowId) {
    logger.warn({ planType }, "no GHL nurture workflow configured for plan type");
    return { ok: false, error: "workflow_id_not_configured" };
  }
  try {
    await addContactToWorkflow(cfg, contactId, workflowId);
    return { ok: true, workflowId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Trigger 2 — Strategy comparer detected (runCount ≥ 2 within 7 days)
// ═══════════════════════════════════════════════════════════════════════════

export interface StrategyComparerInput {
  contactId: string;
  runCount: number;
  lastRunDate: Date | string;
  advisorId?: string;
}

/**
 * Returns a task payload if the contact qualifies, or null to skip.
 * Pure decision function — the caller fires `createTask` with the
 * result so unit tests can assert on the decision without network.
 */
export function evaluateStrategyComparer(input: StrategyComparerInput): {
  shouldAlert: boolean;
  task?: Parameters<typeof createTask>[2];
} {
  if (input.runCount < 2) return { shouldAlert: false };
  if (daysSince(input.lastRunDate) > 7) return { shouldAlert: false };
  return {
    shouldAlert: true,
    task: {
      title: "Strategy Comparer — High Priority Follow-up",
      description:
        "This prospect has run multiple strategy comparisons within 7 days. High-intent signal — follow up within 4 hours.",
      dueDate: addHours(new Date(), 4).toISOString(),
      assignedTo: input.advisorId,
      priority: "high",
    },
  };
}

export async function checkStrategyComparer(
  cfg: GHLConfig,
  input: StrategyComparerInput,
): Promise<{ fired: boolean; error?: string }> {
  const decision = evaluateStrategyComparer(input);
  if (!decision.shouldAlert || !decision.task) return { fired: false };
  try {
    await createTask(cfg, input.contactId, decision.task);
    return { fired: true };
  } catch (err) {
    return {
      fired: false,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Trigger 3 — High-value prospect (> $1M projected value)
// ═══════════════════════════════════════════════════════════════════════════

export const HIGH_VALUE_THRESHOLD = 1_000_000;

export function evaluateHighValue(totalValue30yr: number): {
  shouldAlert: boolean;
  task?: Parameters<typeof createTask>[2];
} {
  if (totalValue30yr <= HIGH_VALUE_THRESHOLD) return { shouldAlert: false };
  return {
    shouldAlert: true,
    task: {
      title: "High-Value Prospect — Phone Call Within 4 Hours",
      description: `Projected 30-year value: $${totalValue30yr.toLocaleString()}. Prospect qualifies for personal outreach.`,
      dueDate: addHours(new Date(), 4).toISOString(),
      priority: "urgent",
    },
  };
}

export async function checkHighValue(
  cfg: GHLConfig,
  contactId: string,
  totalValue30yr: number,
): Promise<{ fired: boolean; error?: string }> {
  const decision = evaluateHighValue(totalValue30yr);
  if (!decision.shouldAlert || !decision.task) return { fired: false };
  try {
    await createTask(cfg, contactId, decision.task);
    return { fired: true };
  } catch (err) {
    return {
      fired: false,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Trigger 4 — Plan shared (planShareUrl populated)
// ═══════════════════════════════════════════════════════════════════════════

export async function onPlanShared(
  cfg: GHLConfig,
  contactId: string,
  shareUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await createTask(cfg, contactId, {
      title: "Plan Shared — Follow Up",
      description: `Client shared their plan: ${shareUrl}`,
      dueDate: addHours(new Date(), 24).toISOString(),
      priority: "normal",
    });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Trigger 5 — Re-engagement (no activity 14+ days, cron daily)
// ═══════════════════════════════════════════════════════════════════════════

export interface ReengagementCandidate {
  contactId: string;
  email: string;
  lastActivityDate: Date | string;
}

/**
 * Pure filter: given a list of candidate contacts, return the subset
 * that meet the re-engagement criteria (stale 14+ days, not already in
 * the re-engagement workflow).
 */
export function filterReengagementCandidates(
  candidates: ReengagementCandidate[],
  activeWorkflowContactIds: Set<string>,
  staleDays = 14,
): ReengagementCandidate[] {
  return candidates.filter(
    (c) =>
      daysSince(c.lastActivityDate) >= staleDays &&
      !activeWorkflowContactIds.has(c.contactId),
  );
}

export async function checkReengagement(
  cfg: GHLConfig,
  candidates: ReengagementCandidate[],
  activeWorkflowContactIds: Set<string>,
  registry: WorkflowRegistry = loadWorkflowRegistry(),
): Promise<{ fired: number; errors: string[] }> {
  const stale = filterReengagementCandidates(candidates, activeWorkflowContactIds);
  const errors: string[] = [];
  let fired = 0;
  for (const c of stale) {
    if (!registry.reengagement) {
      errors.push("reengagement_workflow_id_not_configured");
      break;
    }
    try {
      await addContactToWorkflow(cfg, c.contactId, registry.reengagement);
      fired++;
    } catch (err) {
      errors.push(
        err instanceof Error ? `${c.contactId}: ${err.message}` : "unknown",
      );
    }
  }
  return { fired, errors };
}

// ═══════════════════════════════════════════════════════════════════════════
// Convenience: all-triggers runner (called after onCalculatorCompletion)
// ═══════════════════════════════════════════════════════════════════════════

export interface PostCompletionTriggerInput {
  connectionId: string;
  contactId: string;
  email: string;
  advisorId?: string;
  planType: keyof WorkflowRegistry["nurture"];
  totalValue30yr: number;
  runCount: number;
  lastRunDate: Date | string;
}

export async function runPostCompletionTriggers(
  input: PostCompletionTriggerInput,
): Promise<{
  nurture: Awaited<ReturnType<typeof triggerNurtureSequence>>;
  comparer: Awaited<ReturnType<typeof checkStrategyComparer>>;
  highValue: Awaited<ReturnType<typeof checkHighValue>>;
}> {
  const cfg = await loadGHLConfig(input.connectionId);
  const empty = { ok: false, error: "no_connection" } as const;
  if (!cfg) {
    return {
      nurture: empty,
      comparer: { fired: false, error: "no_connection" },
      highValue: { fired: false, error: "no_connection" },
    };
  }

  const nurture = await triggerNurtureSequence(cfg, input.contactId, input.planType);
  const comparer = await checkStrategyComparer(cfg, {
    contactId: input.contactId,
    runCount: input.runCount,
    lastRunDate: input.lastRunDate,
    advisorId: input.advisorId,
  });
  const highValue = await checkHighValue(cfg, input.contactId, input.totalValue30yr);
  return { nurture, comparer, highValue };
}
