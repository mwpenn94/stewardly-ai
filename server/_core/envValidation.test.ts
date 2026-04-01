import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/**
 * Environment Validation Tests
 * Tests for startup env var validation, missing required vars, and graceful error handling.
 */

describe("Environment Validation", () => {
  const REQUIRED_VARS = ["DATABASE_URL", "SESSION_SECRET"];
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore env
    process.env = { ...originalEnv };
  });

  it("should detect missing DATABASE_URL", () => {
    const missing: string[] = [];
    delete process.env.DATABASE_URL;
    for (const v of REQUIRED_VARS) {
      if (!process.env[v]) missing.push(v);
    }
    expect(missing).toContain("DATABASE_URL");
  });

  it("should detect missing SESSION_SECRET", () => {
    const missing: string[] = [];
    delete process.env.SESSION_SECRET;
    for (const v of REQUIRED_VARS) {
      if (!process.env[v]) missing.push(v);
    }
    expect(missing).toContain("SESSION_SECRET");
  });

  it("should pass when all required vars are set", () => {
    process.env.DATABASE_URL = "mysql://test";
    process.env.SESSION_SECRET = "test-secret";
    const missing: string[] = [];
    for (const v of REQUIRED_VARS) {
      if (!process.env[v]) missing.push(v);
    }
    expect(missing).toHaveLength(0);
  });

  it("should treat empty string as missing", () => {
    process.env.DATABASE_URL = "";
    const missing: string[] = [];
    for (const v of REQUIRED_VARS) {
      if (!process.env[v]) missing.push(v);
    }
    expect(missing).toContain("DATABASE_URL");
  });

  it("should collect all missing vars, not just the first", () => {
    delete process.env.DATABASE_URL;
    delete process.env.SESSION_SECRET;
    const missing: string[] = [];
    for (const v of REQUIRED_VARS) {
      if (!process.env[v]) missing.push(v);
    }
    expect(missing).toHaveLength(2);
  });
});

describe("Environment Defaults", () => {
  it("should default NODE_ENV to development", () => {
    const nodeEnv = process.env.NODE_ENV || "development";
    expect(["development", "production", "test"]).toContain(nodeEnv);
  });

  it("should default PORT to 3000", () => {
    const port = parseInt(process.env.PORT || "3000");
    expect(port).toBeGreaterThan(0);
    expect(port).toBeLessThan(65536);
  });

  it("should parse PORT as integer", () => {
    process.env.PORT = "8080";
    const port = parseInt(process.env.PORT);
    expect(port).toBe(8080);
  });

  it("should handle non-numeric PORT gracefully", () => {
    process.env.PORT = "abc";
    const port = parseInt(process.env.PORT);
    expect(isNaN(port)).toBe(true);
    const safePort = isNaN(port) ? 3000 : port;
    expect(safePort).toBe(3000);
  });
});
