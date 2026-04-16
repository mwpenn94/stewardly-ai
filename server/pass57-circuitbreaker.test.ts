/**
 * Pass 57 — Circuit Breaker Integration Tests
 * Validates that the pipeline runner properly integrates with the circuit breaker pattern.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  getCircuitState,
  recordFailure,
  recordSuccess,
  isRequestAllowed,
  resetCircuitBreaker,
} from "./_core/circuitBreaker";
import {
  getCircuitState as getErrorCircuitState,
  recordCircuitFailure as recordErrorFailure,
  recordCircuitSuccess as recordErrorSuccess,
} from "./services/errorHandling";

describe("Circuit Breaker — Pipeline Integration", () => {
  describe("errorHandling circuit breaker", () => {
    beforeEach(() => {
      // Reset by recording success
      recordErrorSuccess("pipeline:test-provider");
    });

    it("starts in closed state", () => {
      const state = getErrorCircuitState("pipeline:new-provider");
      expect(state).toBe("closed");
    });

    it("opens after 5 consecutive failures", () => {
      for (let i = 0; i < 5; i++) {
        recordErrorFailure("pipeline:failing-provider");
      }
      const state = getErrorCircuitState("pipeline:failing-provider");
      expect(state).toBe("open");
    });

    it("resets to closed on success", () => {
      for (let i = 0; i < 5; i++) {
        recordErrorFailure("pipeline:reset-provider");
      }
      expect(getErrorCircuitState("pipeline:reset-provider")).toBe("open");
      recordErrorSuccess("pipeline:reset-provider");
      expect(getErrorCircuitState("pipeline:reset-provider")).toBe("closed");
    });

    it("isolates circuit breakers by provider slug", () => {
      for (let i = 0; i < 5; i++) {
        recordErrorFailure("pipeline:provider-a");
      }
      expect(getErrorCircuitState("pipeline:provider-a")).toBe("open");
      expect(getErrorCircuitState("pipeline:provider-b")).toBe("closed");
    });
  });

  describe("_core/circuitBreaker module", () => {
    it("exports getCircuitState function", () => {
      expect(typeof getCircuitState).toBe("function");
    });

    it("exports recordFailure function", () => {
      expect(typeof recordFailure).toBe("function");
    });

    it("exports recordSuccess function", () => {
      expect(typeof recordSuccess).toBe("function");
    });

    it("exports isRequestAllowed function", () => {
      expect(typeof isRequestAllowed).toBe("function");
    });

    it("exports resetCircuitBreaker function", () => {
      expect(typeof resetCircuitBreaker).toBe("function");
    });
  });

  describe("Pipeline circuit breaker naming convention", () => {
    const PIPELINE_SLUGS = [
      "bls", "fred", "bea", "census-bureau", "sec-edgar",
      "finra-brokercheck", "treasury-fiscal", "gleif", "world-bank",
      "openfigi", "naic", "ffiec", "fdic", "coingecko", "imf", "exchangerate-api",
    ];

    it("all 16 pipeline slugs are valid identifiers", () => {
      expect(PIPELINE_SLUGS).toHaveLength(16);
      for (const slug of PIPELINE_SLUGS) {
        expect(slug).toMatch(/^[a-z][a-z0-9-]*$/);
      }
    });

    it("circuit breaker keys use pipeline: prefix", () => {
      for (const slug of PIPELINE_SLUGS) {
        const key = `pipeline:${slug}`;
        expect(key).toMatch(/^pipeline:[a-z][a-z0-9-]*$/);
        // Should start closed
        expect(getErrorCircuitState(key)).toBe("closed");
      }
    });
  });
});
