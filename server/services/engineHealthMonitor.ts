/**
 * Engine Health Monitor — Cascading Failure Recovery
 *
 * Monitors the health of all 5 engines (Wealth, People, Learning, Data, Intelligence)
 * and provides graceful degradation when one engine fails, preventing cascade failures
 * from propagating across the system.
 *
 * Pattern: Circuit breaker per engine + dependency graph + fallback responses
 */

import { isRequestAllowed, recordSuccess, recordFailure, getCircuitState } from "../_core/circuitBreaker";

// ─── ENGINE DEFINITIONS ──────────────────────────────────────────

export type EngineId = "wealth" | "people" | "learning" | "data" | "intelligence";

interface EngineDependency {
  id: EngineId;
  name: string;
  /** Which other engines this engine depends on */
  dependencies: EngineId[];
  /** Which operations are critical (cannot degrade) */
  criticalOps: string[];
  /** Which operations can return cached/stale data on failure */
  degradableOps: string[];
}

const ENGINE_GRAPH: EngineDependency[] = [
  {
    id: "data",
    name: "Data Engine",
    dependencies: [],
    criticalOps: [],
    degradableOps: ["financialData.query", "governmentData.fetch", "marketData.stream"],
  },
  {
    id: "wealth",
    name: "Wealth Engine",
    dependencies: ["data"],
    criticalOps: ["portfolio.execute", "payment.process"],
    degradableOps: ["uwe.calculate", "bie.calculate", "he.calculate", "scui.calculate", "planning.optimize"],
  },
  {
    id: "people",
    name: "People Engine",
    dependencies: ["data"],
    criticalOps: ["crm.sync.write"],
    degradableOps: ["crm.sync.read", "lead.score", "enrichment.run", "propensity.calculate"],
  },
  {
    id: "learning",
    name: "Learning Engine",
    dependencies: [],
    criticalOps: [],
    degradableOps: ["srs.review", "exam.grade", "content.generate", "studyGroup.sync"],
  },
  {
    id: "intelligence",
    name: "Intelligence Engine",
    dependencies: ["data", "wealth", "people"],
    criticalOps: [],
    degradableOps: ["llm.invoke", "consensus.run", "improvement.analyze", "agent.execute"],
  },
];

// ─── ENGINE HEALTH STATE ─────────────────────────────────────────

interface EngineHealthState {
  id: EngineId;
  status: "healthy" | "degraded" | "down";
  lastCheck: number;
  consecutiveFailures: number;
  lastError?: string;
  degradedSince?: number;
}

const engineStates = new Map<EngineId, EngineHealthState>();

function getEngineState(id: EngineId): EngineHealthState {
  if (!engineStates.has(id)) {
    engineStates.set(id, {
      id,
      status: "healthy",
      lastCheck: Date.now(),
      consecutiveFailures: 0,
    });
  }
  return engineStates.get(id)!;
}

// ─── PUBLIC API ──────────────────────────────────────────────────

/**
 * Check if an engine operation should proceed or degrade.
 * Returns { proceed: true } or { proceed: false, reason, fallbackAllowed }
 */
export function checkEngineHealth(engineId: EngineId, operation: string): {
  proceed: boolean;
  reason?: string;
  fallbackAllowed?: boolean;
} {
  const state = getEngineState(engineId);
  const engineDef = ENGINE_GRAPH.find(e => e.id === engineId);

  // Check circuit breaker
  const circuitKey = `engine:${engineId}`;
  if (!isRequestAllowed(circuitKey)) {
    const isCritical = engineDef?.criticalOps.includes(operation) ?? false;
    const isDegradable = engineDef?.degradableOps.some(op => operation.startsWith(op)) ?? true;

    if (isCritical) {
      return { proceed: false, reason: `${engineId} engine circuit open — critical operation blocked`, fallbackAllowed: false };
    }
    if (isDegradable) {
      return { proceed: false, reason: `${engineId} engine circuit open — using fallback`, fallbackAllowed: true };
    }
    return { proceed: false, reason: `${engineId} engine circuit open`, fallbackAllowed: true };
  }

  // Check dependency health
  if (engineDef) {
    for (const depId of engineDef.dependencies) {
      const depState = getEngineState(depId);
      if (depState.status === "down") {
        const isDegradable = engineDef.degradableOps.some(op => operation.startsWith(op));
        return {
          proceed: false,
          reason: `${engineId} engine blocked — dependency '${depId}' is down`,
          fallbackAllowed: isDegradable,
        };
      }
    }
  }

  return { proceed: true };
}

/**
 * Record a successful engine operation.
 */
export function recordEngineSuccess(engineId: EngineId): void {
  const state = getEngineState(engineId);
  state.consecutiveFailures = 0;
  state.lastCheck = Date.now();
  state.lastError = undefined;

  if (state.status !== "healthy") {
    state.status = "healthy";
    state.degradedSince = undefined;
  }

  recordSuccess(`engine:${engineId}`);
}

/**
 * Record a failed engine operation.
 */
export function recordEngineFailure(engineId: EngineId, error: string): void {
  const state = getEngineState(engineId);
  state.consecutiveFailures++;
  state.lastCheck = Date.now();
  state.lastError = error;

  if (state.consecutiveFailures >= 3 && state.status === "healthy") {
    state.status = "degraded";
    state.degradedSince = Date.now();
  }

  if (state.consecutiveFailures >= 10) {
    state.status = "down";
  }

  recordFailure(`engine:${engineId}`);
}

/**
 * Get the health status of all engines.
 */
export function getAllEngineHealth(): {
  engines: EngineHealthState[];
  systemStatus: "healthy" | "degraded" | "critical";
  affectedOperations: string[];
} {
  const engines = ENGINE_GRAPH.map(e => getEngineState(e.id));
  const downEngines = engines.filter(e => e.status === "down");
  const degradedEngines = engines.filter(e => e.status === "degraded");

  let systemStatus: "healthy" | "degraded" | "critical" = "healthy";
  if (degradedEngines.length > 0) systemStatus = "degraded";
  if (downEngines.length > 0) systemStatus = "critical";

  // Calculate affected operations
  const affectedOperations: string[] = [];
  for (const engine of downEngines) {
    const def = ENGINE_GRAPH.find(e => e.id === engine.id);
    if (def) {
      affectedOperations.push(...def.criticalOps.map(op => `BLOCKED: ${op}`));
      affectedOperations.push(...def.degradableOps.map(op => `DEGRADED: ${op}`));
    }
    // Check downstream engines that depend on this one
    for (const downstream of ENGINE_GRAPH) {
      if (downstream.dependencies.includes(engine.id)) {
        affectedOperations.push(`CASCADE: ${downstream.id} engine affected by ${engine.id} outage`);
      }
    }
  }

  return { engines, systemStatus, affectedOperations };
}

/**
 * Execute an engine operation with automatic health tracking and fallback.
 */
export async function withEngineProtection<T>(
  engineId: EngineId,
  operation: string,
  fn: () => Promise<T>,
  fallback?: () => T,
): Promise<T> {
  const health = checkEngineHealth(engineId, operation);

  if (!health.proceed) {
    if (health.fallbackAllowed && fallback) {
      return fallback();
    }
    throw new Error(health.reason || `${engineId} engine unavailable`);
  }

  try {
    const result = await fn();
    recordEngineSuccess(engineId);
    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    recordEngineFailure(engineId, errorMsg);

    if (fallback) {
      return fallback();
    }
    throw err;
  }
}

/**
 * Reset engine health state (useful for testing or manual recovery).
 */
export function resetEngineHealth(engineId?: EngineId): void {
  if (engineId) {
    engineStates.delete(engineId);
  } else {
    engineStates.clear();
  }
}
