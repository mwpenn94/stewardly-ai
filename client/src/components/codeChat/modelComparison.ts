/**
 * Model comparison runner — Build-loop Pass 15 (G12).
 *
 * Cursor Composer's killer differentiator: run the same prompt against
 * 2+ models in parallel, render the responses side-by-side, and let
 * the user pick the winner. This module is the pure-function core
 * (state machine + reducers); the live runner lives in
 * `ModelComparisonPopover.tsx` which fans out to the existing
 * `useCodeChatStream` hook with a `model` override.
 *
 * Design decisions:
 *
 *   - **Up to 4 models per comparison.** More than that and the side-
 *     by-side view becomes unreadable; pricing also stacks linearly.
 *   - **Independent state per slot.** Each model has its own
 *     `pending|running|done|error` status + response so a slow model
 *     never blocks the UI for a fast one.
 *   - **No special transport.** Reuses the same SSE endpoint with a
 *     `model` field — the parent fans out N parallel POSTs.
 *   - **Pick winner is informational.** Marking a model as "winner"
 *     is purely UI feedback; this module just tracks the choice so
 *     a future pass can persist preferences for routing decisions.
 */

export type ComparisonStatus =
  | "pending"
  | "running"
  | "done"
  | "error"
  | "aborted";

export interface ComparisonSlot {
  id: string;
  model: string;
  status: ComparisonStatus;
  /** The full response text once `status === "done"`. */
  response?: string;
  /** Number of ReAct iterations the run took. */
  iterations?: number;
  /** Number of tool calls. */
  toolCallCount?: number;
  /** Total wall-clock duration in ms. */
  durationMs?: number;
  /** Estimated input + output tokens. */
  inputTokens?: number;
  outputTokens?: number;
  /** Estimated USD cost. Null when the model has no pricing entry. */
  costUSD?: number | null;
  /** Error message when `status === "error"`. */
  error?: string;
}

export interface ComparisonRun {
  id: string;
  prompt: string;
  startedAt: number;
  slots: ComparisonSlot[];
  /** Slot id the user marked as the winner, or null. */
  winnerSlotId: string | null;
}

const MAX_SLOTS = 4;

/**
 * Construct a fresh comparison run with one slot per requested model.
 * Models are deduped (case-insensitive) so the user can't accidentally
 * compare claude-sonnet-4-6 against itself, and the count is capped
 * at MAX_SLOTS.
 */
export function startComparisonRun(
  prompt: string,
  models: string[],
): ComparisonRun {
  const seen = new Set<string>();
  const slots: ComparisonSlot[] = [];
  for (const raw of models) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    slots.push({
      id: `slot-${slots.length + 1}`,
      model: trimmed,
      status: "pending",
    });
    if (slots.length >= MAX_SLOTS) break;
  }
  return {
    id: `cmp-${Date.now()}`,
    prompt: prompt.trim(),
    startedAt: Date.now(),
    slots,
    winnerSlotId: null,
  };
}

/**
 * Immutable update — flip a slot's status (or merge in result fields)
 * by id. Returns a new ComparisonRun. No-op if the id isn't in the
 * run.
 */
export function updateSlot(
  run: ComparisonRun,
  slotId: string,
  patch: Partial<ComparisonSlot>,
): ComparisonRun {
  const idx = run.slots.findIndex((s) => s.id === slotId);
  if (idx === -1) return run;
  const next = [...run.slots];
  next[idx] = { ...next[idx], ...patch };
  return { ...run, slots: next };
}

/** Mark a slot as the winner (or unset by passing null). */
export function setWinner(
  run: ComparisonRun,
  slotId: string | null,
): ComparisonRun {
  if (slotId !== null && !run.slots.some((s) => s.id === slotId)) {
    return run;
  }
  return { ...run, winnerSlotId: slotId };
}

/**
 * Aggregate stats over the run for the summary strip.
 */
export interface ComparisonSummary {
  total: number;
  pending: number;
  running: number;
  done: number;
  errored: number;
  fastest: ComparisonSlot | null;
  cheapest: ComparisonSlot | null;
  totalCostUSD: number;
  hasUnpriced: boolean;
}

export function summarizeRun(run: ComparisonRun): ComparisonSummary {
  let pending = 0;
  let running = 0;
  let done = 0;
  let errored = 0;
  let fastest: ComparisonSlot | null = null;
  let cheapest: ComparisonSlot | null = null;
  let totalCostUSD = 0;
  let hasUnpriced = false;
  for (const slot of run.slots) {
    if (slot.status === "pending") pending++;
    else if (slot.status === "running") running++;
    else if (slot.status === "done") done++;
    else if (slot.status === "error" || slot.status === "aborted") errored++;
    if (slot.status === "done") {
      if (
        slot.durationMs !== undefined &&
        (fastest === null ||
          (fastest.durationMs !== undefined &&
            slot.durationMs < fastest.durationMs))
      ) {
        fastest = slot;
      }
      if (slot.costUSD === null) {
        hasUnpriced = true;
      } else if (slot.costUSD !== undefined) {
        totalCostUSD += slot.costUSD;
        if (
          cheapest === null ||
          (cheapest.costUSD !== undefined &&
            cheapest.costUSD !== null &&
            slot.costUSD < cheapest.costUSD)
        ) {
          cheapest = slot;
        }
      }
    }
  }
  return {
    total: run.slots.length,
    pending,
    running,
    done,
    errored,
    fastest,
    cheapest,
    totalCostUSD,
    hasUnpriced,
  };
}

/**
 * Pure helper: are all slots in a terminal state?
 */
export function isComparisonComplete(run: ComparisonRun): boolean {
  return run.slots.every(
    (s) => s.status === "done" || s.status === "error" || s.status === "aborted",
  );
}
