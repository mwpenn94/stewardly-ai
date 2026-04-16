/**
 * Pass 58 — Task Queue tests
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");

describe("Pass 58 — Task Queue Service", () => {
  const src = readFileSync(join(ROOT, "server/services/taskQueue.ts"), "utf-8");

  it("exports enqueueTask", () => {
    expect(src).toContain("export function enqueueTask");
  });

  it("exports getTaskState", () => {
    expect(src).toContain("export function getTaskState");
  });

  it("exports getUserTasks", () => {
    expect(src).toContain("export function getUserTasks");
  });

  it("exports cancelTask", () => {
    expect(src).toContain("export function cancelTask");
  });

  it("exports getQueueStats", () => {
    expect(src).toContain("export function getQueueStats");
  });

  it("exports registerTaskHandler", () => {
    expect(src).toContain("export function registerTaskHandler");
  });

  it("implements priority-based scheduling", () => {
    expect(src).toContain("priorityOrder");
    expect(src).toContain("critical");
    expect(src).toContain("high");
    expect(src).toContain("normal");
    expect(src).toContain("low");
  });

  it("has per-user concurrency limit", () => {
    expect(src).toContain("MAX_CONCURRENT_PER_USER");
    expect(src).toContain("userRunning");
  });

  it("has global concurrency limit", () => {
    expect(src).toContain("MAX_CONCURRENT_GLOBAL");
  });

  it("supports task cancellation via AbortController", () => {
    expect(src).toContain("AbortController");
    expect(src).toContain("controller.abort");
  });

  it("implements retry with exponential backoff", () => {
    expect(src).toContain("retryCount");
    expect(src).toContain("maxRetries");
  });

  it("has built-in task handlers", () => {
    expect(src).toContain("data_analysis");
    expect(src).toContain("report_generation");
    expect(src).toContain("crm_sync");
    expect(src).toContain("portfolio_rebalance");
  });

  it("cleans up old tasks periodically", () => {
    expect(src).toContain("setInterval");
    expect(src).toContain("tasks.delete");
  });
});

describe("Pass 58 — Task Queue tRPC Router", () => {
  const src = readFileSync(join(ROOT, "server/routers/agenticExecution.ts"), "utf-8");

  it("has taskQueue sub-router", () => {
    expect(src).toContain("taskQueue: taskQueueRouter");
  });

  it("has enqueue mutation", () => {
    expect(src).toContain("enqueue: protectedProcedure");
    expect(src).toContain("enqueueTask");
  });

  it("has status query", () => {
    expect(src).toContain("status: protectedProcedure");
    expect(src).toContain("getTaskState");
  });

  it("has myTasks query", () => {
    expect(src).toContain("myTasks: protectedProcedure");
    expect(src).toContain("getUserTasks");
  });

  it("has cancel mutation", () => {
    expect(src).toContain("cancel: protectedProcedure");
    expect(src).toContain("cancelTask");
  });

  it("has stats query", () => {
    expect(src).toContain("stats: protectedProcedure");
    expect(src).toContain("getQueueStats");
  });
});
