/**
 * Plan Mode — pure planning state machine for Code Chat (Pass 236).
 *
 * Claude Code has a "plan mode" where the agent generates a step-by-step
 * plan first, lets the user review/edit/approve, and only then executes.
 * This module implements the pure logic side: parsing plans from markdown
 * output, tracking per-step status, mutating plans, and building the
 * execution prompt. The UI side lives in `PlanReviewPanel.tsx`.
 *
 * Design:
 *   - Plans are parsed from numbered lists or "Step N:" prefixes
 *   - Every mutation is a pure function that returns a new plan
 *   - Progress is derived, not stored, so status is the single source
 *   - Plans persist per-session in localStorage keyed by message id
 */

// ─── Types ──────────────────────────────────────────────────────────────

export type PlanStepStatus =
  | "pending"
  | "approved"
  | "executing"
  | "done"
  | "failed"
  | "skipped";

export interface PlanStep {
  id: string;
  description: string;
  status: PlanStepStatus;
  /** Optional hint about what tool this step will use (grep, read, edit) */
  toolHint?: string;
  /** Optional note captured after execution — e.g. error message */
  note?: string;
}

export type PlanStatus =
  | "draft"
  | "approved"
  | "executing"
  | "complete"
  | "aborted";

export interface Plan {
  id: string;
  title: string;
  steps: PlanStep[];
  createdAt: number;
  updatedAt: number;
  status: PlanStatus;
}

// ─── Parser ─────────────────────────────────────────────────────────────

const NUMBERED_RE = /^\s*(\d+)\s*[.)]\s+(.+)$/;
const BULLET_RE = /^\s*[-*•]\s+(.+)$/;
const STEP_PREFIX_RE = /^\s*(?:step|task|phase)\s+(\d+)\s*[:.)\-]\s*(.+)$/i;
const TITLE_RE = /^\s*#{1,6}\s+(.+)$/;

function stripCommonSuffixes(text: string): string {
  // Drop things like "(optional)" or trailing tool hints that muddy the
  // description but keep the readable part intact.
  return text.replace(/\s+$/, "").trim();
}

function extractToolHint(description: string): string | undefined {
  // Detect `[tool: x]`, `(uses X)`, `→ X`
  const bracketed = /\[tool:\s*([^\]]+)\]/i.exec(description);
  if (bracketed) return bracketed[1].trim().toLowerCase();
  const uses = /\(uses?\s+(read_file|grep_search|edit_file|write_file|list_directory|run_bash)\)/i.exec(
    description,
  );
  if (uses) return uses[1].trim().toLowerCase();
  return undefined;
}

/**
 * Parse a plan from free-form assistant output. Tries numbered lists
 * first, falls back to `Step N:` prefixes, then to bullets. If no
 * structure is found, returns null. Title is optionally seeded from
 * the first `#` heading in the text.
 */
export function parsePlanFromText(
  text: string,
  explicitTitle?: string,
): Plan | null {
  if (!text || typeof text !== "string") return null;
  const lines = text.split(/\r?\n/);
  const steps: PlanStep[] = [];
  let title = explicitTitle?.trim() ?? "";
  let counter = 0;
  let lastSeenDepth: "numbered" | "step" | "bullet" | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line) continue;

    if (!title) {
      const t = TITLE_RE.exec(line);
      if (t) {
        title = t[1].trim();
        continue;
      }
    }

    // Priority: numbered → step prefix → bullet
    const numbered = NUMBERED_RE.exec(line);
    if (numbered) {
      const desc = stripCommonSuffixes(numbered[2]);
      if (desc) {
        steps.push({
          id: `step-${++counter}`,
          description: desc,
          status: "pending",
          toolHint: extractToolHint(desc),
        });
        lastSeenDepth = "numbered";
      }
      continue;
    }

    const stepPrefix = STEP_PREFIX_RE.exec(line);
    if (stepPrefix) {
      const desc = stripCommonSuffixes(stepPrefix[2]);
      if (desc) {
        steps.push({
          id: `step-${++counter}`,
          description: desc,
          status: "pending",
          toolHint: extractToolHint(desc),
        });
        lastSeenDepth = "step";
      }
      continue;
    }

    // Only accept bullets as fallback if we haven't seen numbered/step
    // lines — otherwise a random bullet inside a paragraph would
    // pollute the plan.
    if (lastSeenDepth === "bullet" || lastSeenDepth === null) {
      const bullet = BULLET_RE.exec(line);
      if (bullet) {
        const desc = stripCommonSuffixes(bullet[1]);
        if (desc) {
          steps.push({
            id: `step-${++counter}`,
            description: desc,
            status: "pending",
            toolHint: extractToolHint(desc),
          });
          lastSeenDepth = "bullet";
        }
        continue;
      }
    }
  }

  if (steps.length === 0) return null;
  const now = Date.now();
  return {
    id: `plan-${now}`,
    title: title || "Execution Plan",
    steps,
    createdAt: now,
    updatedAt: now,
    status: "draft",
  };
}

/**
 * Rough heuristic: does this text look like a plan? Used to auto-open
 * the Plan Panel on assistant messages that generated structured output.
 */
export function looksLikePlan(text: string): boolean {
  if (!text) return false;
  const parsed = parsePlanFromText(text);
  return parsed !== null && parsed.steps.length >= 2;
}

// ─── Progress + accessors ───────────────────────────────────────────────

export interface PlanProgress {
  done: number;
  failed: number;
  skipped: number;
  executing: number;
  total: number;
  pct: number;
  complete: boolean;
}

export function planProgress(plan: Plan): PlanProgress {
  let done = 0;
  let failed = 0;
  let skipped = 0;
  let executing = 0;
  for (const step of plan.steps) {
    switch (step.status) {
      case "done":
        done++;
        break;
      case "failed":
        failed++;
        break;
      case "skipped":
        skipped++;
        break;
      case "executing":
        executing++;
        break;
    }
  }
  const total = plan.steps.length;
  const finished = done + failed + skipped;
  const pct = total === 0 ? 0 : finished / total;
  return {
    done,
    failed,
    skipped,
    executing,
    total,
    pct,
    complete: total > 0 && finished === total,
  };
}

export function nextPendingStep(plan: Plan): PlanStep | null {
  for (const s of plan.steps) {
    if (s.status === "approved" || s.status === "pending") return s;
  }
  return null;
}

// ─── Mutations ──────────────────────────────────────────────────────────

function touch(plan: Plan): Plan {
  return { ...plan, updatedAt: Date.now() };
}

export function updateStepStatus(
  plan: Plan,
  stepId: string,
  status: PlanStepStatus,
  note?: string,
): Plan {
  let found = false;
  const steps = plan.steps.map((s) => {
    if (s.id !== stepId) return s;
    found = true;
    const next: PlanStep = { ...s, status };
    if (note !== undefined) next.note = note;
    return next;
  });
  if (!found) return plan;
  return touch({ ...plan, steps });
}

export function updateStepDescription(
  plan: Plan,
  stepId: string,
  description: string,
): Plan {
  const trimmed = description.trim();
  if (!trimmed) return plan;
  let found = false;
  const steps = plan.steps.map((s) => {
    if (s.id !== stepId) return s;
    found = true;
    return { ...s, description: trimmed, toolHint: extractToolHint(trimmed) };
  });
  if (!found) return plan;
  return touch({ ...plan, steps });
}

export function addStep(
  plan: Plan,
  description: string,
  afterId?: string,
): Plan {
  const trimmed = description.trim();
  if (!trimmed) return plan;
  const newStep: PlanStep = {
    id: `step-new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    description: trimmed,
    status: "pending",
    toolHint: extractToolHint(trimmed),
  };
  if (!afterId) {
    return touch({ ...plan, steps: [...plan.steps, newStep] });
  }
  const idx = plan.steps.findIndex((s) => s.id === afterId);
  if (idx === -1) {
    return touch({ ...plan, steps: [...plan.steps, newStep] });
  }
  const next = [...plan.steps];
  next.splice(idx + 1, 0, newStep);
  return touch({ ...plan, steps: next });
}

export function removeStep(plan: Plan, stepId: string): Plan {
  const next = plan.steps.filter((s) => s.id !== stepId);
  if (next.length === plan.steps.length) return plan;
  return touch({ ...plan, steps: next });
}

export function reorderStep(
  plan: Plan,
  stepId: string,
  direction: "up" | "down",
): Plan {
  const idx = plan.steps.findIndex((s) => s.id === stepId);
  if (idx === -1) return plan;
  const newIdx = direction === "up" ? idx - 1 : idx + 1;
  if (newIdx < 0 || newIdx >= plan.steps.length) return plan;
  const next = [...plan.steps];
  [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
  return touch({ ...plan, steps: next });
}

export function approveAllSteps(plan: Plan): Plan {
  return touch({
    ...plan,
    status: "approved",
    steps: plan.steps.map((s) =>
      s.status === "pending" ? { ...s, status: "approved" } : s,
    ),
  });
}

export function rejectPlan(plan: Plan): Plan {
  return touch({ ...plan, status: "aborted" });
}

/**
 * Unapprove an approved plan — flip it back to draft mode so the user
 * can edit / reorder / add / remove steps again. Refuses if any step
 * is currently `executing` (the ReAct loop is mid-flight); refuses if
 * any step is already `done`/`failed` (the user should start a fresh
 * plan instead). Pass v5 #83.
 */
export function unapprovePlan(plan: Plan): Plan {
  // Can't flip back if we're running or if results already landed
  for (const s of plan.steps) {
    if (
      s.status === "executing" ||
      s.status === "done" ||
      s.status === "failed"
    ) {
      return plan;
    }
  }
  const steps = plan.steps.map((s) =>
    s.status === "approved" ? { ...s, status: "pending" as const } : s,
  );
  return touch({ ...plan, status: "draft", steps });
}

/**
 * Discard a plan completely. Returns `null` so callers can drop the
 * plan from their message→plan map on a single round trip. Pass v5 #83.
 */
export function discardPlan(_plan: Plan): null {
  return null;
}

/**
 * Build the execution prompt for an approved plan. Instructs the agent
 * to report per-step progress with parseable markers so the UI can
 * correlate assistant output back to plan steps.
 */
export function buildExecutionPrompt(plan: Plan): string {
  const stepList = plan.steps
    .map((s, i) => `${i + 1}. ${s.description}`)
    .join("\n");
  return [
    `Execute the following approved plan step by step.`,
    `Plan: ${plan.title}`,
    ``,
    stepList,
    ``,
    `After each step, output one of:`,
    `  ✓ Step N complete — <one-line summary>`,
    `  ✗ Step N failed: <reason>`,
    `  — Step N skipped: <reason>`,
    ``,
    `Use your available tools. Do not invent files or APIs. If the plan`,
    `needs revision partway through, say so and stop.`,
  ].join("\n");
}

// ─── Serialization for persistence ──────────────────────────────────────

export interface PlanSnapshot {
  /** Minimal snapshot for localStorage. Title/steps/status only. */
  id: string;
  title: string;
  status: PlanStatus;
  steps: Array<Pick<PlanStep, "id" | "description" | "status" | "note">>;
  createdAt: number;
  updatedAt: number;
}

export function snapshotPlan(plan: Plan): PlanSnapshot {
  return {
    id: plan.id,
    title: plan.title,
    status: plan.status,
    steps: plan.steps.map((s) => ({
      id: s.id,
      description: s.description,
      status: s.status,
      ...(s.note !== undefined ? { note: s.note } : {}),
    })),
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
}

export function restorePlan(snapshot: PlanSnapshot): Plan {
  return {
    id: snapshot.id,
    title: snapshot.title,
    status: snapshot.status,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
    steps: snapshot.steps.map((s) => ({
      id: s.id,
      description: s.description,
      status: s.status,
      note: s.note,
      toolHint: extractToolHint(s.description),
    })),
  };
}
