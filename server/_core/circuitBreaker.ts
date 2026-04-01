/**
 * Circuit Breaker for LLM Provider Calls
 *
 * States:
 *   CLOSED   – normal operation, requests pass through
 *   OPEN     – too many failures, requests are rejected immediately
 *   HALF_OPEN – after cooldown, allow a single probe request
 *
 * Transitions:
 *   CLOSED → OPEN        when consecutiveFailures >= threshold
 *   OPEN → HALF_OPEN     when cooldownMs has elapsed
 *   HALF_OPEN → CLOSED   when the probe request succeeds
 *   HALF_OPEN → OPEN     when the probe request fails
 */
import { createOperationLogger } from "./logger";

const log = createOperationLogger("circuitBreaker");

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface CircuitBreakerConfig {
  failureThreshold: number;   // consecutive failures before opening
  cooldownMs: number;         // time to wait before half-open probe
  successThreshold: number;   // consecutive successes to close from half-open
}

interface CircuitBreakerState {
  state: CircuitState;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailureAt: number;
  lastStateChange: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  cooldownMs: 30_000,       // 30 seconds
  successThreshold: 2,
};

// Per-provider circuit breaker state (in-memory, resets on restart)
const breakers = new Map<string, CircuitBreakerState>();

function getState(key: string): CircuitBreakerState {
  if (!breakers.has(key)) {
    breakers.set(key, {
      state: "CLOSED",
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      lastFailureAt: 0,
      lastStateChange: Date.now(),
    });
  }
  return breakers.get(key)!;
}

/**
 * Check if a request is allowed through the circuit breaker.
 * Returns true if the request should proceed, false if it should be rejected.
 */
export function isRequestAllowed(key: string, config: Partial<CircuitBreakerConfig> = {}): boolean {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const cb = getState(key);

  if (cb.state === "CLOSED") {
    return true;
  }

  if (cb.state === "OPEN") {
    const elapsed = Date.now() - cb.lastFailureAt;
    if (elapsed >= cfg.cooldownMs) {
      cb.state = "HALF_OPEN";
      cb.lastStateChange = Date.now();
      log.info({ key, elapsed }, "Circuit breaker transitioning to HALF_OPEN");
      return true; // allow probe request
    }
    return false;
  }

  // HALF_OPEN — allow probe
  return true;
}

/**
 * Record a successful request.
 */
export function recordSuccess(key: string, config: Partial<CircuitBreakerConfig> = {}): void {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const cb = getState(key);

  cb.consecutiveFailures = 0;
  cb.consecutiveSuccesses += 1;

  if (cb.state === "HALF_OPEN" && cb.consecutiveSuccesses >= cfg.successThreshold) {
    cb.state = "CLOSED";
    cb.consecutiveSuccesses = 0;
    cb.lastStateChange = Date.now();
    log.info({ key }, "Circuit breaker CLOSED (recovered)");
  }
}

/**
 * Record a failed request.
 */
export function recordFailure(key: string, config: Partial<CircuitBreakerConfig> = {}): void {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const cb = getState(key);

  cb.consecutiveSuccesses = 0;
  cb.consecutiveFailures += 1;
  cb.lastFailureAt = Date.now();

  if (cb.state === "HALF_OPEN") {
    cb.state = "OPEN";
    cb.lastStateChange = Date.now();
    log.warn({ key }, "Circuit breaker re-OPENED from HALF_OPEN (probe failed)");
  } else if (cb.state === "CLOSED" && cb.consecutiveFailures >= cfg.failureThreshold) {
    cb.state = "OPEN";
    cb.lastStateChange = Date.now();
    log.warn({ key, failures: cb.consecutiveFailures }, "Circuit breaker OPENED (threshold reached)");
  }
}

/**
 * Get the current state of a circuit breaker (for diagnostics).
 */
export function getCircuitState(key: string): CircuitBreakerState & { key: string } {
  const state = getState(key);
  return Object.assign(state, { key });
}

/**
 * Get all circuit breaker states (for health dashboard).
 */
export function getAllCircuitStates(): Array<CircuitBreakerState & { key: string }> {
  return Array.from(breakers.entries()).map(([key, state]) => ({ key, ...state }));
}

/**
 * Reset a circuit breaker (manual override).
 */
export function resetCircuitBreaker(key: string): void {
  breakers.delete(key);
  log.info({ key }, "Circuit breaker manually reset");
}
