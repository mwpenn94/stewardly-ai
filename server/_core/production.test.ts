import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Production Readiness Tests
 * Validates that critical production infrastructure files exist and contain required patterns.
 */

const SERVER_CORE = path.join(__dirname);
const SERVER_ROOT = path.join(__dirname, "..");

describe("Production Infrastructure Files", () => {
  it("should have a rate limiter module", () => {
    expect(fs.existsSync(path.join(SERVER_CORE, "rateLimiter.ts"))).toBe(true);
  });

  it("should have a logger module", () => {
    expect(fs.existsSync(path.join(SERVER_CORE, "logger.ts"))).toBe(true);
  });

  it("should have a circuit breaker module", () => {
    expect(fs.existsSync(path.join(SERVER_CORE, "circuitBreaker.ts"))).toBe(true);
  });

  it("should have a request ID middleware", () => {
    expect(fs.existsSync(path.join(SERVER_CORE, "requestId.ts"))).toBe(true);
  });

  it("should have environment configuration", () => {
    expect(fs.existsSync(path.join(SERVER_CORE, "env.ts"))).toBe(true);
  });
});

describe("Security Headers in index.ts", () => {
  let indexContent: string;

  it("should load index.ts", () => {
    indexContent = fs.readFileSync(path.join(SERVER_CORE, "index.ts"), "utf-8");
    expect(indexContent.length).toBeGreaterThan(0);
  });

  it("should use helmet for security headers", () => {
    indexContent = fs.readFileSync(path.join(SERVER_CORE, "index.ts"), "utf-8");
    expect(indexContent).toContain("helmet");
  });

  it("should have graceful shutdown handler", () => {
    indexContent = fs.readFileSync(path.join(SERVER_CORE, "index.ts"), "utf-8");
    expect(indexContent).toContain("SIGTERM");
    expect(indexContent).toContain("SIGINT");
  });

  it("should have logger.flush before process.exit", () => {
    indexContent = fs.readFileSync(path.join(SERVER_CORE, "index.ts"), "utf-8");
    expect(indexContent).toContain("flush");
  });

  it("should have force exit timeout for hung connections", () => {
    indexContent = fs.readFileSync(path.join(SERVER_CORE, "index.ts"), "utf-8");
    expect(indexContent).toMatch(/setTimeout.*process\.exit\(1\).*10000/s);
  });

  it("should have unhandledRejection handler", () => {
    indexContent = fs.readFileSync(path.join(SERVER_CORE, "index.ts"), "utf-8");
    expect(indexContent).toContain("unhandledRejection");
  });

  it("should have uncaughtException handler", () => {
    indexContent = fs.readFileSync(path.join(SERVER_CORE, "index.ts"), "utf-8");
    expect(indexContent).toContain("uncaughtException");
  });
});

describe("Circuit Breaker Configuration", () => {
  let cbContent: string;

  it("should load circuitBreaker.ts", () => {
    cbContent = fs.readFileSync(path.join(SERVER_CORE, "circuitBreaker.ts"), "utf-8");
    expect(cbContent.length).toBeGreaterThan(0);
  });

  it("should define CLOSED, OPEN, and HALF_OPEN states", () => {
    cbContent = fs.readFileSync(path.join(SERVER_CORE, "circuitBreaker.ts"), "utf-8");
    expect(cbContent).toContain("CLOSED");
    expect(cbContent).toContain("OPEN");
    expect(cbContent).toContain("HALF_OPEN");
  });

  it("should export isRequestAllowed function", () => {
    cbContent = fs.readFileSync(path.join(SERVER_CORE, "circuitBreaker.ts"), "utf-8");
    expect(cbContent).toContain("export function isRequestAllowed");
  });

  it("should export recordSuccess and recordFailure functions", () => {
    cbContent = fs.readFileSync(path.join(SERVER_CORE, "circuitBreaker.ts"), "utf-8");
    expect(cbContent).toContain("export function recordSuccess");
    expect(cbContent).toContain("export function recordFailure");
  });
});

describe("LLM Retry Configuration", () => {
  let llmContent: string;

  it("should load llm.ts", () => {
    llmContent = fs.readFileSync(path.join(SERVER_CORE, "llm.ts"), "utf-8");
    expect(llmContent.length).toBeGreaterThan(0);
  });

  it("should have retry logic with MAX_RETRIES", () => {
    llmContent = fs.readFileSync(path.join(SERVER_CORE, "llm.ts"), "utf-8");
    expect(llmContent).toMatch(/MAX_RETRIES|maxRetries|retry/i);
  });

  it("should import circuit breaker functions", () => {
    llmContent = fs.readFileSync(path.join(SERVER_CORE, "llm.ts"), "utf-8");
    expect(llmContent).toContain("circuitBreaker");
  });
});

describe("Shared Intelligence Platform", () => {
  it("should have intelligence directory with core files", () => {
    const intDir = path.join(SERVER_ROOT, "shared", "intelligence");
    expect(fs.existsSync(intDir)).toBe(true);
    expect(fs.existsSync(path.join(intDir, "types.ts"))).toBe(true);
    expect(fs.existsSync(path.join(intDir, "contextualLLM.ts"))).toBe(true);
  });

  it("should have config directory", () => {
    const cfgDir = path.join(SERVER_ROOT, "shared", "config");
    expect(fs.existsSync(cfgDir)).toBe(true);
    expect(fs.existsSync(path.join(cfgDir, "types.ts"))).toBe(true);
  });

  it("should have a wiring file", () => {
    const sharedDir = path.join(SERVER_ROOT, "shared");
    const wiringFiles = fs.readdirSync(sharedDir).filter(f => f.endsWith("Wiring.ts"));
    expect(wiringFiles.length).toBeGreaterThanOrEqual(1);
  });
});
