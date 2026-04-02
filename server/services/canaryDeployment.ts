/**
 * Task #23 — Canary Deployment Service
 * Pre-deploy checklist, canary rollout with error-rate monitoring,
 * and automatic rollback if error rate exceeds threshold.
 */
import { getDb } from "../db";
import { deploymentChecks, deploymentHistory } from "../../drizzle/schema";
import { eq, desc, sql } from "drizzle-orm";

interface DeploymentCheckResult {
  checkType: string;
  passed: boolean;
  details: string;
  durationMs: number;
}

// ─── Pre-Deploy Checklist ────────────────────────────────────────────────
export async function runPreDeployChecklist(): Promise<{
  allPassed: boolean;
  results: DeploymentCheckResult[];
}> {
  const results: DeploymentCheckResult[] = [];

  // 1. Database connectivity check
  const dbStart = Date.now();
  try {
    const db = await getDb(); if (!db) return null as any;
    await db.execute(sql`SELECT 1`);
    results.push({ checkType: "database_connectivity", passed: true, details: "Database connection OK", durationMs: Date.now() - dbStart });
  } catch (e: any) {
    results.push({ checkType: "database_connectivity", passed: false, details: e.message, durationMs: Date.now() - dbStart });
  }

  // 2. Environment variables check
  const envStart = Date.now();
  const requiredEnvs = ["DATABASE_URL", "JWT_SECRET", "BUILT_IN_FORGE_API_KEY"];
  const missingEnvs = requiredEnvs.filter(e => !process.env[e]);
  results.push({
    checkType: "environment_variables",
    passed: missingEnvs.length === 0,
    details: missingEnvs.length === 0 ? "All required env vars present" : `Missing: ${missingEnvs.join(", ")}`,
    durationMs: Date.now() - envStart,
  });

  // 3. Memory usage check
  const memStart = Date.now();
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  const heapPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  results.push({
    checkType: "memory_usage",
    passed: heapPercent < 90,
    details: `Heap: ${heapUsedMB}MB / ${heapTotalMB}MB (${heapPercent.toFixed(1)}%)`,
    durationMs: Date.now() - memStart,
  });

  // 4. Schema migration check
  const schemaStart = Date.now();
  try {
    const db = await getDb(); if (!db) return null as any;
    await db.execute(sql`SELECT COUNT(*) FROM users`);
    results.push({ checkType: "schema_migration", passed: true, details: "Core tables accessible", durationMs: Date.now() - schemaStart });
  } catch (e: any) {
    results.push({ checkType: "schema_migration", passed: false, details: e.message, durationMs: Date.now() - schemaStart });
  }

  // Persist results
  const db = await getDb(); if (!db) return null as any;
  for (const r of results) {
    await db.insert(deploymentChecks).values({
      checkType: r.checkType,
      passed: r.passed,
      details: r.details,
      durationMs: r.durationMs,
    });
  }

  return {
    allPassed: results.every(r => r.passed),
    results,
  };
}

// ─── Create Deployment ───────────────────────────────────────────────────
export async function createDeployment(params: {
  version: string;
  description?: string;
  testsPassed?: number;
  testsTotal?: number;
  bundleSizeKb?: number;
  deployedBy?: number;
}): Promise<number> {
  const db = await getDb(); if (!db) return null as any;

  // Get previous version
  const [prev] = await db.select().from(deploymentHistory)
    .where(eq(deploymentHistory.status, "complete"))
    .orderBy(desc(deploymentHistory.deployedAt)).limit(1);

  const [result] = await db.insert(deploymentHistory).values({
    version: params.version,
    description: params.description,
    testsPassed: params.testsPassed,
    testsTotal: params.testsTotal,
    bundleSizeKb: params.bundleSizeKb,
    rolloutPercentage: 5,
    status: "canary",
    previousVersion: prev?.version,
    deployedBy: params.deployedBy,
  }).$returningId();

  return result.id;
}

// ─── Update Rollout ──────────────────────────────────────────────────────
export async function updateRollout(deploymentId: number, percentage: number, errorRate?: number): Promise<void> {
  const db = await getDb(); if (!db) return null as any;
  const updates: Record<string, any> = { rolloutPercentage: percentage };

  if (errorRate !== undefined) {
    updates.errorRate = errorRate;
    // Auto-rollback if error rate > 5%
    if (errorRate > 5) {
      updates.status = "rolled_back";
      updates.completedAt = new Date();
    } else if (percentage >= 100) {
      updates.status = "complete";
      updates.completedAt = new Date();
    } else if (percentage > 5) {
      updates.status = "rolling_out";
    }
  }

  await db.update(deploymentHistory).set(updates).where(eq(deploymentHistory.id, deploymentId));
}

// ─── Query Helpers ───────────────────────────────────────────────────────
export async function getDeploymentHistory(limit = 20) {
  const db = await getDb(); if (!db) return null as any;
  return db.select().from(deploymentHistory).orderBy(desc(deploymentHistory.deployedAt)).limit(limit);
}

export async function getLatestChecks() {
  const db = await getDb(); if (!db) return null as any;
  return db.select().from(deploymentChecks).orderBy(desc(deploymentChecks.runAt)).limit(20);
}

export async function getCurrentDeployment() {
  const db = await getDb(); if (!db) return null as any;
  const [current] = await db.select().from(deploymentHistory)
    .where(eq(deploymentHistory.status, "canary"))
    .orderBy(desc(deploymentHistory.deployedAt)).limit(1);
  return current;
}
