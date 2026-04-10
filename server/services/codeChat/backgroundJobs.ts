/**
 * Background jobs for Code Chat (Pass 201).
 *
 * The user asked for "continuous, autonomous, and/or background
 * processing as appropriate". This service provides:
 *
 *   - An in-memory job store for long-running Code Chat operations
 *   - A runner that executes jobs asynchronously so the HTTP request
 *     returns immediately with a jobId
 *   - Tail-able event logs per job (so the UI can show live progress)
 *   - Status, cancel, and listing APIs
 *
 * Job kinds:
 *   - `autonomous_code_chat` — runs `runAutonomousCoding` against a
 *     workspace goal with a per-subtask LLM planner
 *   - `github_push` — commits + pushes a multi-file changeset and
 *     optionally opens a PR against a user-selected repo
 *
 * Storage: intentionally in-memory. This keeps the surface simple,
 * avoids adding a new drizzle migration for what is a developer-tool
 * feature, and matches the "restart-tolerant via retry" contract the
 * rest of the Code Chat surface uses. If we later want persistence
 * across restarts, a `code_chat_jobs` table with JSON blob columns
 * would slot in cleanly behind the same API.
 *
 * Concurrency: we cap concurrent jobs per user at 2 to avoid
 * runaway spend or resource contention. Above the cap, new jobs are
 * queued and picked up as running jobs finish.
 */

import { randomUUID } from "crypto";
import { logger } from "../../_core/logger";

// ─── Types ────────────────────────────────────────────────────────────────

export type JobKind = "autonomous_code_chat" | "github_push" | "custom";

export type JobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface JobEvent {
  at: number; // epoch ms
  level: "info" | "warn" | "error";
  message: string;
  data?: Record<string, unknown>;
}

export interface BackgroundJob {
  id: string;
  userId: number;
  kind: JobKind;
  title: string;
  status: JobStatus;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  events: JobEvent[];
  /** Final result payload set when status transitions to succeeded */
  result?: unknown;
  /** Error message set when status transitions to failed */
  error?: string;
  /** Abort flag — cooperative; the runner checks it between steps */
  _cancelRequested?: boolean;
}

export interface JobRunnerContext {
  jobId: string;
  userId: number;
  append: (event: Omit<JobEvent, "at"> & { at?: number }) => void;
  isCancelled: () => boolean;
}

export type JobRunner = (ctx: JobRunnerContext) => Promise<unknown>;

// ─── Store ───────────────────────────────────────────────────────────────

const MAX_CONCURRENT_PER_USER = 2;
const MAX_HISTORY_PER_USER = 50;
const MAX_EVENTS_PER_JOB = 500;

const _jobs: Map<string, BackgroundJob> = new Map();
const _runningPerUser: Map<number, number> = new Map();
const _queue: Array<{ job: BackgroundJob; runner: JobRunner }> = [];

function incrementRunning(userId: number): void {
  _runningPerUser.set(userId, (_runningPerUser.get(userId) ?? 0) + 1);
}

function decrementRunning(userId: number): void {
  const n = _runningPerUser.get(userId) ?? 0;
  if (n <= 1) _runningPerUser.delete(userId);
  else _runningPerUser.set(userId, n - 1);
}

function countRunning(userId: number): number {
  return _runningPerUser.get(userId) ?? 0;
}

// ─── Scheduling ──────────────────────────────────────────────────────────

export interface EnqueueInput {
  userId: number;
  kind: JobKind;
  title: string;
  runner: JobRunner;
}

export function enqueueJob(input: EnqueueInput): BackgroundJob {
  const job: BackgroundJob = {
    id: randomUUID(),
    userId: input.userId,
    kind: input.kind,
    title: input.title,
    status: "queued",
    createdAt: Date.now(),
    events: [
      {
        at: Date.now(),
        level: "info",
        message: `Job enqueued: ${input.title}`,
      },
    ],
  };
  _jobs.set(job.id, job);
  // Trim history to avoid unbounded memory growth
  trimHistory(input.userId);

  _queue.push({ job, runner: input.runner });
  drainQueue();
  return job;
}

function drainQueue(): void {
  for (let i = 0; i < _queue.length; ) {
    const entry = _queue[i];
    const running = countRunning(entry.job.userId);
    if (running >= MAX_CONCURRENT_PER_USER) {
      i++;
      continue;
    }
    _queue.splice(i, 1);
    void runJob(entry.job, entry.runner);
  }
}

async function runJob(job: BackgroundJob, runner: JobRunner): Promise<void> {
  incrementRunning(job.userId);
  job.status = "running";
  job.startedAt = Date.now();
  appendEvent(job, { level: "info", message: "Job started" });

  try {
    const ctx: JobRunnerContext = {
      jobId: job.id,
      userId: job.userId,
      append: (event) => appendEvent(job, event),
      isCancelled: () => job._cancelRequested === true,
    };
    const result = await runner(ctx);
    if (job._cancelRequested) {
      job.status = "cancelled";
      appendEvent(job, { level: "warn", message: "Job cancelled by user" });
    } else {
      job.status = "succeeded";
      job.result = result;
      appendEvent(job, { level: "info", message: "Job succeeded" });
    }
  } catch (err) {
    job.status = "failed";
    job.error = err instanceof Error ? err.message : String(err);
    appendEvent(job, {
      level: "error",
      message: `Job failed: ${job.error}`,
    });
    logger.error(
      { jobId: job.id, userId: job.userId, err },
      "background job failed",
    );
  } finally {
    job.finishedAt = Date.now();
    decrementRunning(job.userId);
    drainQueue();
  }
}

function appendEvent(
  job: BackgroundJob,
  event: Omit<JobEvent, "at"> & { at?: number },
): void {
  job.events.push({
    at: event.at ?? Date.now(),
    level: event.level,
    message: event.message,
    data: event.data,
  });
  if (job.events.length > MAX_EVENTS_PER_JOB) {
    // Drop the oldest events but keep the first (enqueue) + last 499
    const head = job.events[0];
    job.events = [head, ...job.events.slice(-MAX_EVENTS_PER_JOB + 1)];
  }
}

function trimHistory(userId: number): void {
  const mine = Array.from(_jobs.values())
    .filter((j) => j.userId === userId)
    .sort((a, b) => a.createdAt - b.createdAt);
  const terminal = mine.filter(
    (j) =>
      j.status === "succeeded" ||
      j.status === "failed" ||
      j.status === "cancelled",
  );
  const excess = terminal.length - MAX_HISTORY_PER_USER;
  for (let i = 0; i < excess; i++) {
    _jobs.delete(terminal[i].id);
  }
}

// ─── Query API ───────────────────────────────────────────────────────────

export function listJobs(userId: number): BackgroundJob[] {
  return Array.from(_jobs.values())
    .filter((j) => j.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getJob(id: string, userId: number): BackgroundJob | null {
  const job = _jobs.get(id);
  if (!job || job.userId !== userId) return null;
  return job;
}

export function cancelJob(id: string, userId: number): boolean {
  const job = _jobs.get(id);
  if (!job || job.userId !== userId) return false;
  if (job.status !== "running" && job.status !== "queued") return false;
  job._cancelRequested = true;
  if (job.status === "queued") {
    // Drop from the pending queue immediately; runner will never see it.
    const idx = _queue.findIndex((e) => e.job.id === id);
    if (idx >= 0) _queue.splice(idx, 1);
    job.status = "cancelled";
    job.finishedAt = Date.now();
    appendEvent(job, {
      level: "warn",
      message: "Job cancelled before start",
    });
  }
  return true;
}

/** Snapshot used by the admin dashboard / tests. */
export function jobStats(): {
  total: number;
  running: number;
  queued: number;
  succeeded: number;
  failed: number;
  cancelled: number;
} {
  let running = 0;
  let queued = 0;
  let succeeded = 0;
  let failed = 0;
  let cancelled = 0;
  for (const job of Array.from(_jobs.values())) {
    switch (job.status) {
      case "running":
        running++;
        break;
      case "queued":
        queued++;
        break;
      case "succeeded":
        succeeded++;
        break;
      case "failed":
        failed++;
        break;
      case "cancelled":
        cancelled++;
        break;
    }
  }
  return {
    total: _jobs.size,
    running,
    queued,
    succeeded,
    failed,
    cancelled,
  };
}

// Test-only helper. Clears all in-memory state.
export function __resetBackgroundJobs(): void {
  _jobs.clear();
  _runningPerUser.clear();
  _queue.length = 0;
}
