/**
 * Dynamic Integration — Blueprint Scheduler
 *
 * Lightweight scheduler that periodically scans active blueprints with a
 * `scheduleCron` and runs the ones that are due. Uses a tiny cron parser
 * supporting the 5-field form (`m h dom mon dow`) with `*`, numeric literals,
 * ranges, steps, and comma lists. Good enough for the daily/hourly/weekly
 * cadences we need — not a full replacement for node-cron. Falls back safely
 * when a cron is malformed.
 *
 * The global tick runs every minute via a `setInterval` started by
 * `startBlueprintScheduler()`. Each tick:
 *   1. Loads all active blueprints with a non-empty `scheduleCron`.
 *   2. Computes `dueFromCron(cron, now, lastRunAt)`.
 *   3. Calls `executeBlueprint()` on every due blueprint (best-effort, caught).
 */

import { and, eq, isNotNull } from "drizzle-orm";
import { getDb } from "../../db";
import { integrationBlueprints } from "../../../drizzle/schema";
import { logger } from "../../_core/logger";
import { rowToBlueprint } from "./blueprintRegistry";
import { executeBlueprint } from "./blueprintExecutor";

let tickHandle: ReturnType<typeof setInterval> | null = null;
let running = false;

const TICK_INTERVAL_MS = 60 * 1000; // 1 minute
const MAX_CONCURRENT_RUNS = 4; // cap fan-out per tick to avoid stampede

/** Start the global scheduler tick. Idempotent. */
export function startBlueprintScheduler(): void {
  if (tickHandle) return;
  tickHandle = setInterval(() => {
    if (running) return;
    running = true;
    schedulerTick()
      .catch((e) => logger.error({ operation: "blueprintScheduler", err: e }, "scheduler tick failed"))
      .finally(() => {
        running = false;
      });
  }, TICK_INTERVAL_MS);
  logger.info({ operation: "blueprintScheduler" }, "blueprint scheduler started (60s tick)");
}

export function stopBlueprintScheduler(): void {
  if (tickHandle) {
    clearInterval(tickHandle);
    tickHandle = null;
  }
}

/** Tick body — exported for tests. */
export async function schedulerTick(now: Date = new Date()): Promise<{
  considered: number;
  triggered: number;
  failed: number;
}> {
  const db = await getDb();
  if (!db) return { considered: 0, triggered: 0, failed: 0 };

  // Pull every active blueprint with a schedule.
  const rows = await db
    .select()
    .from(integrationBlueprints)
    .where(
      and(
        eq(integrationBlueprints.status, "active"),
        isNotNull(integrationBlueprints.scheduleCron),
      ),
    );

  // Collect all due blueprints first, then run them with a concurrency cap
  // so a big tick doesn't stampede the DB + outbound network.
  const due: Array<ReturnType<typeof rowToBlueprint>> = [];
  for (const row of rows) {
    const bp = rowToBlueprint(row as unknown as Record<string, unknown>);
    if (!bp.scheduleCron) continue;
    if (!isDue(bp.scheduleCron, now, bp.lastRunAt ?? null)) continue;
    due.push(bp);
  }

  let triggered = 0;
  let failed = 0;
  // Process in chunks of MAX_CONCURRENT_RUNS.
  for (let i = 0; i < due.length; i += MAX_CONCURRENT_RUNS) {
    const chunk = due.slice(i, i + MAX_CONCURRENT_RUNS);
    const results = await Promise.allSettled(
      chunk.map((bp) =>
        executeBlueprint(bp, {
          dryRun: false,
          triggeredBy: bp.createdBy,
          triggerSource: "schedule",
        }),
      ),
    );
    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === "fulfilled") {
        triggered++;
      } else {
        failed++;
        logger.warn(
          {
            operation: "blueprintScheduler",
            blueprintId: chunk[j].id,
            err: String(result.reason),
          },
          `scheduled blueprint ${chunk[j].slug} failed`,
        );
      }
    }
  }
  return { considered: rows.length, triggered, failed };
}

// ─── Cron parser (minimal) ──────────────────────────────────────────────

/**
 * Is this blueprint due to run right now?
 *
 * Decision rules (deliberately conservative):
 *   - If cron is invalid, return false.
 *   - If `lastRunAt` is within the last 60 seconds, return false (dedup).
 *   - Otherwise, return true iff the cron expression matches `now`
 *     at minute granularity.
 */
export function isDue(cron: string, now: Date, lastRunAt: number | null): boolean {
  // Dedup a just-finished run.
  if (lastRunAt && now.getTime() - lastRunAt < 55_000) return false;
  const parsed = parseCron(cron);
  if (!parsed) return false;
  return cronMatchesDate(parsed, now);
}

/** Parse a 5-field cron expression. */
export interface ParsedCron {
  minute: Set<number>;
  hour: Set<number>;
  dayOfMonth: Set<number>;
  month: Set<number>;
  dayOfWeek: Set<number>;
  rawDom: string; // for POSIX-style DOM/DOW OR-ing
  rawDow: string;
}

export function parseCron(expression: string): ParsedCron | null {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  try {
    return {
      minute: expandRange(parts[0], 0, 59),
      hour: expandRange(parts[1], 0, 23),
      dayOfMonth: expandRange(parts[2], 1, 31),
      month: expandRange(parts[3], 1, 12),
      dayOfWeek: expandRange(parts[4], 0, 7, normalizeDayOfWeek),
      rawDom: parts[2],
      rawDow: parts[4],
    };
  } catch {
    return null;
  }
}

function normalizeDayOfWeek(v: number): number {
  // POSIX supports 0 or 7 for Sunday.
  return v === 7 ? 0 : v;
}

function expandRange(
  field: string,
  min: number,
  max: number,
  normalize?: (n: number) => number,
): Set<number> {
  const out = new Set<number>();
  for (const piece of field.split(",")) {
    // Split step
    const [rangePart, stepRaw] = piece.split("/");
    const step = stepRaw ? parseInt(stepRaw, 10) : 1;
    if (!Number.isFinite(step) || step <= 0) throw new Error("bad step");
    let start = min;
    let end = max;
    if (rangePart !== "*") {
      if (rangePart.includes("-")) {
        const [s, e] = rangePart.split("-").map((n) => parseInt(n, 10));
        if (!Number.isFinite(s) || !Number.isFinite(e)) throw new Error("bad range");
        start = s;
        end = e;
      } else {
        const n = parseInt(rangePart, 10);
        if (!Number.isFinite(n)) throw new Error("bad literal");
        start = n;
        end = n;
      }
    }
    if (start < min || end > max || start > end) throw new Error("range out of bounds");
    for (let i = start; i <= end; i += step) {
      out.add(normalize ? normalize(i) : i);
    }
  }
  return out;
}

export function cronMatchesDate(parsed: ParsedCron, date: Date): boolean {
  const minute = date.getMinutes();
  const hour = date.getHours();
  const dom = date.getDate();
  const month = date.getMonth() + 1;
  const dow = date.getDay();

  if (!parsed.minute.has(minute)) return false;
  if (!parsed.hour.has(hour)) return false;
  if (!parsed.month.has(month)) return false;

  // POSIX: when both dom and dow are unrestricted (*), both must match
  // their usual sets (always true). When one is restricted, OR them.
  const domRestricted = parsed.rawDom !== "*";
  const dowRestricted = parsed.rawDow !== "*";
  if (domRestricted && dowRestricted) {
    return parsed.dayOfMonth.has(dom) || parsed.dayOfWeek.has(dow);
  }
  if (domRestricted) return parsed.dayOfMonth.has(dom);
  if (dowRestricted) return parsed.dayOfWeek.has(dow);
  return true;
}
