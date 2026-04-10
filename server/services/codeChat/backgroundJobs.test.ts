/**
 * Tests for the Code Chat background jobs store (Pass 201).
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  enqueueJob,
  listJobs,
  getJob,
  cancelJob,
  jobStats,
  __resetBackgroundJobs,
} from "./backgroundJobs";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

beforeEach(() => {
  __resetBackgroundJobs();
});

describe("backgroundJobs — enqueue + run", () => {
  it("runs a queued job to success", async () => {
    const job = enqueueJob({
      userId: 1,
      kind: "custom",
      title: "quick",
      runner: async (ctx) => {
        ctx.append({ level: "info", message: "step 1" });
        ctx.append({ level: "info", message: "step 2" });
        return { ok: true };
      },
    });
    // Job may already be running synchronously after enqueue (drainQueue is sync)
    expect(["queued", "running"]).toContain(job.status);
    // Wait for the runner to finish
    await sleep(20);
    const fresh = getJob(job.id, 1);
    expect(fresh?.status).toBe("succeeded");
    expect(fresh?.result).toEqual({ ok: true });
    // Events: enqueue + start + 2 custom + success
    expect(fresh?.events.length).toBeGreaterThanOrEqual(4);
  });

  it("captures errors as failed jobs", async () => {
    const job = enqueueJob({
      userId: 1,
      kind: "custom",
      title: "crash",
      runner: async () => {
        throw new Error("boom");
      },
    });
    await sleep(20);
    const fresh = getJob(job.id, 1);
    expect(fresh?.status).toBe("failed");
    expect(fresh?.error).toBe("boom");
  });

  it("isolates jobs per user — getJob refuses cross-user access", async () => {
    const job = enqueueJob({
      userId: 1,
      kind: "custom",
      title: "owned by 1",
      runner: async () => ({ done: true }),
    });
    await sleep(20);
    expect(getJob(job.id, 1)).not.toBeNull();
    expect(getJob(job.id, 999)).toBeNull();
  });

  it("listJobs returns only the caller's jobs, newest first", async () => {
    enqueueJob({
      userId: 1,
      kind: "custom",
      title: "u1-a",
      runner: async () => null,
    });
    await sleep(5);
    enqueueJob({
      userId: 1,
      kind: "custom",
      title: "u1-b",
      runner: async () => null,
    });
    enqueueJob({
      userId: 2,
      kind: "custom",
      title: "u2-a",
      runner: async () => null,
    });
    await sleep(20);
    const list1 = listJobs(1);
    expect(list1.length).toBe(2);
    expect(list1[0].title).toBe("u1-b");
    expect(list1[1].title).toBe("u1-a");
    const list2 = listJobs(2);
    expect(list2.length).toBe(1);
    expect(list2[0].title).toBe("u2-a");
  });
});

describe("backgroundJobs — cancellation", () => {
  it("cooperatively cancels a running job via the isCancelled flag", async () => {
    let checkedCancel = false;
    let finishedNaturally = false;
    const job = enqueueJob({
      userId: 1,
      kind: "custom",
      title: "long",
      runner: async (ctx) => {
        // Poll for cancellation for up to 500ms
        for (let i = 0; i < 50; i++) {
          if (ctx.isCancelled()) {
            checkedCancel = true;
            return { cancelled: true };
          }
          await sleep(10);
        }
        finishedNaturally = true;
        return { ok: true };
      },
    });
    // Give the runner a moment to start
    await sleep(30);
    const ok = cancelJob(job.id, 1);
    expect(ok).toBe(true);
    await sleep(60);
    const fresh = getJob(job.id, 1);
    expect(fresh?.status).toBe("cancelled");
    expect(checkedCancel).toBe(true);
    expect(finishedNaturally).toBe(false);
  });

  it("cancelJob refuses cross-user", () => {
    const job = enqueueJob({
      userId: 1,
      kind: "custom",
      title: "t",
      runner: async () => null,
    });
    expect(cancelJob(job.id, 999)).toBe(false);
  });
});

describe("backgroundJobs — concurrency cap", () => {
  it("caps concurrent running jobs per user at MAX_CONCURRENT_PER_USER", async () => {
    let running = 0;
    let maxRunning = 0;
    const promise = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const runner = async () => {
      running++;
      if (running > maxRunning) maxRunning = running;
      await promise(50);
      running--;
      return null;
    };
    for (let i = 0; i < 6; i++) {
      enqueueJob({
        userId: 1,
        kind: "custom",
        title: `job-${i}`,
        runner,
      });
    }
    // Wait for all to finish
    await sleep(500);
    expect(maxRunning).toBeLessThanOrEqual(2);
    const stats = jobStats();
    expect(stats.succeeded).toBe(6);
  });
});

describe("backgroundJobs — jobStats", () => {
  it("reports counts across statuses", async () => {
    enqueueJob({
      userId: 1,
      kind: "custom",
      title: "a",
      runner: async () => null,
    });
    enqueueJob({
      userId: 1,
      kind: "custom",
      title: "b",
      runner: async () => {
        throw new Error("nope");
      },
    });
    await sleep(40);
    const stats = jobStats();
    expect(stats.total).toBe(2);
    expect(stats.succeeded).toBe(1);
    expect(stats.failed).toBe(1);
  });
});
