import { describe, expect, it, beforeEach } from "vitest";
import {
  isRequestAllowed,
  recordSuccess,
  recordFailure,
  getCircuitState,
  getAllCircuitStates,
  resetCircuitBreaker,
} from "./circuitBreaker";

describe("Circuit Breaker", () => {
  const KEY = "test-provider";

  beforeEach(() => {
    resetCircuitBreaker(KEY);
    resetCircuitBreaker("other-provider");
  });

  // ── State Machine Tests ──────────────────────────────────────────

  it("should start in CLOSED state and allow requests", () => {
    expect(isRequestAllowed(KEY)).toBe(true);
    const state = getCircuitState(KEY);
    expect(state.state).toBe("CLOSED");
    expect(state.consecutiveFailures).toBe(0);
  });

  it("should remain CLOSED after failures below threshold", () => {
    recordFailure(KEY, { failureThreshold: 5 });
    recordFailure(KEY, { failureThreshold: 5 });
    recordFailure(KEY, { failureThreshold: 5 });
    recordFailure(KEY, { failureThreshold: 5 });
    const state = getCircuitState(KEY);
    expect(state.state).toBe("CLOSED");
    expect(state.consecutiveFailures).toBe(4);
    expect(isRequestAllowed(KEY)).toBe(true);
  });

  it("should transition to OPEN after reaching failure threshold", () => {
    for (let i = 0; i < 5; i++) {
      recordFailure(KEY, { failureThreshold: 5 });
    }
    const state = getCircuitState(KEY);
    expect(state.state).toBe("OPEN");
    expect(isRequestAllowed(KEY)).toBe(false);
  });

  it("should reject requests when OPEN and cooldown not elapsed", () => {
    for (let i = 0; i < 5; i++) {
      recordFailure(KEY, { failureThreshold: 5 });
    }
    // Cooldown is 30s by default, so request should be blocked
    expect(isRequestAllowed(KEY)).toBe(false);
  });

  it("should transition to HALF_OPEN after cooldown expires", () => {
    for (let i = 0; i < 5; i++) {
      recordFailure(KEY, { failureThreshold: 5 });
    }
    // Manually set lastFailureAt to past
    const state = getCircuitState(KEY);
    (state as any).lastFailureAt = Date.now() - 31_000;
    expect(isRequestAllowed(KEY, { cooldownMs: 30_000 })).toBe(true);
    expect(getCircuitState(KEY).state).toBe("HALF_OPEN");
  });

  it("should transition from HALF_OPEN to CLOSED on sufficient successes", () => {
    // Force into HALF_OPEN
    for (let i = 0; i < 5; i++) {
      recordFailure(KEY, { failureThreshold: 5 });
    }
    const state = getCircuitState(KEY);
    (state as any).lastFailureAt = Date.now() - 31_000;
    isRequestAllowed(KEY, { cooldownMs: 30_000 }); // triggers HALF_OPEN

    recordSuccess(KEY, { successThreshold: 2 });
    expect(getCircuitState(KEY).state).toBe("HALF_OPEN");
    recordSuccess(KEY, { successThreshold: 2 });
    expect(getCircuitState(KEY).state).toBe("CLOSED");
  });

  it("should transition from HALF_OPEN back to OPEN on failure", () => {
    for (let i = 0; i < 5; i++) {
      recordFailure(KEY, { failureThreshold: 5 });
    }
    const state = getCircuitState(KEY);
    (state as any).lastFailureAt = Date.now() - 31_000;
    isRequestAllowed(KEY, { cooldownMs: 30_000 }); // triggers HALF_OPEN

    recordFailure(KEY);
    expect(getCircuitState(KEY).state).toBe("OPEN");
  });

  // ── Success/Failure Counter Tests ────────────────────────────────

  it("should reset consecutive failures on success", () => {
    recordFailure(KEY);
    recordFailure(KEY);
    expect(getCircuitState(KEY).consecutiveFailures).toBe(2);
    recordSuccess(KEY);
    expect(getCircuitState(KEY).consecutiveFailures).toBe(0);
  });

  it("should reset consecutive successes on failure", () => {
    recordSuccess(KEY);
    recordSuccess(KEY);
    expect(getCircuitState(KEY).consecutiveSuccesses).toBe(2);
    recordFailure(KEY);
    expect(getCircuitState(KEY).consecutiveSuccesses).toBe(0);
  });

  // ── Isolation Tests ──────────────────────────────────────────────

  it("should isolate circuit breakers by key", () => {
    for (let i = 0; i < 5; i++) {
      recordFailure(KEY, { failureThreshold: 5 });
    }
    expect(isRequestAllowed(KEY)).toBe(false);
    expect(isRequestAllowed("other-provider")).toBe(true);
  });

  // ── Reset Tests ──────────────────────────────────────────────────

  it("should reset circuit breaker to initial state", () => {
    for (let i = 0; i < 5; i++) {
      recordFailure(KEY, { failureThreshold: 5 });
    }
    expect(getCircuitState(KEY).state).toBe("OPEN");
    resetCircuitBreaker(KEY);
    expect(getCircuitState(KEY).state).toBe("CLOSED");
    expect(getCircuitState(KEY).consecutiveFailures).toBe(0);
  });

  // ── getAllCircuitStates Tests ─────────────────────────────────────

  it("should return all circuit breaker states", () => {
    isRequestAllowed(KEY);
    isRequestAllowed("other-provider");
    const states = getAllCircuitStates();
    expect(states.length).toBeGreaterThanOrEqual(2);
    expect(states.some(s => s.key === KEY)).toBe(true);
    expect(states.some(s => s.key === "other-provider")).toBe(true);
  });

  // ── Custom Config Tests ──────────────────────────────────────────

  it("should respect custom failure threshold", () => {
    for (let i = 0; i < 2; i++) {
      recordFailure(KEY, { failureThreshold: 2 });
    }
    expect(getCircuitState(KEY).state).toBe("OPEN");
  });

  it("should respect custom success threshold in HALF_OPEN", () => {
    for (let i = 0; i < 3; i++) {
      recordFailure(KEY, { failureThreshold: 3 });
    }
    const state = getCircuitState(KEY);
    (state as any).lastFailureAt = Date.now() - 31_000;
    isRequestAllowed(KEY, { cooldownMs: 30_000 });

    recordSuccess(KEY, { successThreshold: 1 });
    expect(getCircuitState(KEY).state).toBe("CLOSED");
  });
});
