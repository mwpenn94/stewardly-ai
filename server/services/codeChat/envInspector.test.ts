/**
 * Tests for env inspector — Pass 263.
 */

import { describe, it, expect } from "vitest";
import {
  parseEnvFile,
  isSecretKey,
  maskValue,
  buildReport,
} from "./envInspector";

describe("parseEnvFile", () => {
  it("returns empty for empty input", () => {
    expect(parseEnvFile(".env", "")).toEqual([]);
  });

  it("parses a simple KEY=value", () => {
    const out = parseEnvFile(".env.example", "FOO=bar");
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ key: "FOO", exampleValue: "bar" });
  });

  it("strips double quotes from values", () => {
    const out = parseEnvFile(".env", 'FOO="quoted value"');
    expect(out[0].exampleValue).toBe("quoted value");
  });

  it("strips single quotes from values", () => {
    const out = parseEnvFile(".env", "FOO='single'");
    expect(out[0].exampleValue).toBe("single");
  });

  it("handles export prefix", () => {
    const out = parseEnvFile(".env", "export FOO=bar");
    expect(out[0].key).toBe("FOO");
  });

  it("attaches preceding comments to declarations", () => {
    const raw = `# GitHub personal access token\nGITHUB_TOKEN=...`;
    const out = parseEnvFile(".env", raw);
    expect(out[0].comment).toBe("GitHub personal access token");
  });

  it("concatenates multi-line comments", () => {
    const raw = `# line one\n# line two\nFOO=bar`;
    const out = parseEnvFile(".env", raw);
    expect(out[0].comment).toBe("line one line two");
  });

  it("resets comment on blank line", () => {
    const raw = `# orphan\n\nFOO=bar`;
    const out = parseEnvFile(".env", raw);
    expect(out[0].comment).toBeUndefined();
  });

  it("skips lines without equals sign", () => {
    const raw = `FOO=bar\nNOTEQUAL\nBAZ=qux`;
    const out = parseEnvFile(".env", raw);
    expect(out).toHaveLength(2);
    expect(out.map((d) => d.key)).toEqual(["FOO", "BAZ"]);
  });

  it("rejects invalid identifier keys", () => {
    const raw = `FOO-BAR=bad\n123=also-bad\nVALID=ok`;
    const out = parseEnvFile(".env", raw);
    expect(out).toHaveLength(1);
    expect(out[0].key).toBe("VALID");
  });

  it("preserves line numbers", () => {
    const raw = `# header\n\nFOO=bar\n\nBAZ=qux`;
    const out = parseEnvFile(".env", raw);
    expect(out[0].line).toBe(3);
    expect(out[1].line).toBe(5);
  });
});

describe("isSecretKey", () => {
  it("flags KEY/SECRET/TOKEN/PASSWORD/HASH", () => {
    expect(isSecretKey("API_KEY")).toBe(true);
    expect(isSecretKey("JWT_SECRET")).toBe(true);
    expect(isSecretKey("ACCESS_TOKEN")).toBe(true);
    expect(isSecretKey("DB_PASSWORD")).toBe(true);
    expect(isSecretKey("PASSWORD_HASH")).toBe(true);
  });

  it("does not flag normal keys", () => {
    expect(isSecretKey("PORT")).toBe(false);
    expect(isSecretKey("DATABASE_URL")).toBe(false);
    expect(isSecretKey("NODE_ENV")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isSecretKey("api_key")).toBe(true);
  });
});

describe("maskValue", () => {
  it("returns '(unset)' for empty", () => {
    expect(maskValue("FOO", "")).toBe("(unset)");
    expect(maskValue("FOO", undefined)).toBe("(unset)");
  });

  it("masks secret keys fully", () => {
    expect(maskValue("API_KEY", "abcdefghijk")).toBe("***");
  });

  it("masks short non-secret values fully", () => {
    expect(maskValue("PORT", "3000")).toBe("***");
  });

  it("shows first + last for longer non-secret values", () => {
    const out = maskValue("DATABASE_URL", "postgres://user@host:5432/db");
    expect(out.startsWith("po")).toBe(true);
    expect(out.endsWith("db")).toBe(true);
    expect(out).toContain("*");
  });
});

describe("buildReport", () => {
  it("flags declared-but-missing", () => {
    const declared = [
      { key: "FOO", exampleValue: "", source: ".env", line: 1 },
      { key: "BAR", exampleValue: "", source: ".env", line: 2 },
    ];
    const report = buildReport(declared, { FOO: "set-value-long-enough" });
    expect(report.missing).toEqual(["BAR"]);
    expect(report.summary.totalSet).toBe(1);
    expect(report.summary.totalMissing).toBe(1);
  });

  it("finds extras with common prefixes", () => {
    const declared = [
      { key: "FOO", exampleValue: "", source: ".env", line: 1 },
    ];
    const report = buildReport(declared, {
      FOO: "x",
      APP_BAR: "y",
      PATH: "/usr/bin",
    });
    expect(report.extras).toContain("APP_BAR");
    expect(report.extras).not.toContain("PATH");
  });

  it("deduplicates keys declared in multiple templates", () => {
    const declared = [
      { key: "FOO", exampleValue: "one", source: ".env.example", line: 1 },
      { key: "FOO", exampleValue: "two", source: ".env.sample", line: 5 },
    ];
    const report = buildReport(declared, {});
    expect(report.status).toHaveLength(1);
    expect(report.status[0].source).toBe(".env.example");
  });

  it("masks set values safely in status", () => {
    const declared = [
      { key: "API_KEY", exampleValue: "", source: ".env", line: 1 },
      { key: "PORT", exampleValue: "", source: ".env", line: 2 },
    ];
    const report = buildReport(declared, {
      API_KEY: "actual-secret-value",
      PORT: "3000",
    });
    const apiKey = report.status.find((s) => s.key === "API_KEY");
    const port = report.status.find((s) => s.key === "PORT");
    expect(apiKey?.preview).toBe("***");
    expect(port?.preview).toBe("***"); // short, masked fully
  });

  it("marks unset values with (unset)", () => {
    const declared = [
      { key: "MISSING", exampleValue: "", source: ".env", line: 1 },
    ];
    const report = buildReport(declared, {});
    expect(report.status[0].preview).toBe("(unset)");
  });
});
