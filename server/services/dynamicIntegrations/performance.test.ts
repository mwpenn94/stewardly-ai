/**
 * Pass 21 — Performance benchmarks for hot paths.
 *
 * These tests lock in performance floors so regressions are caught. They
 * don't assert exact timings (those vary across machines) — instead they
 * assert reasonable upper bounds that a well-implemented algorithm should
 * comfortably satisfy.
 *
 * If any of these start failing it means a hot path has regressed.
 */

import { describe, it, expect } from "vitest";
import { inferSchema } from "./schemaInference";
import { generateAdapter } from "./adapterGenerator";
import { diffSchemas } from "./schemaDrift";
import { extractPersonalizationHints } from "./personalizationHints";
import { mapToCanonicalContact } from "./crmCanonicalMap";
import { distillConsensus } from "./crossModelDistillation";
import { redactRecords } from "./sensitiveRedaction";
import { runOnboardingWizard } from "./onboardingWizard";

function generateRecords(count: number): Array<Record<string, unknown>> {
  const records: Array<Record<string, unknown>> = [];
  for (let i = 0; i < count; i++) {
    records.push({
      id: `u${i}`,
      email: `user${i}@example.com`,
      first_name: `First${i}`,
      last_name: `Last${i}`,
      phone: `+1 415-555-${String(1000 + (i % 9000)).padStart(4, "0")}`,
      company: `Company ${i % 50}`,
      title: ["Director", "Manager", "VP", "Analyst"][i % 4],
      created_at: new Date(2024, 0, 1 + (i % 365)).toISOString(),
      roth_ira_balance: `$${1000 * (i % 100)}`,
      trust_type: ["revocable", "irrevocable"][i % 2],
      status: ["active", "inactive", "pending"][i % 3],
      net_worth: 100_000 + i * 1000,
    });
  }
  return records;
}

// ─── schemaInference ────────────────────────────────────────────────────

describe("performance — schemaInference", () => {
  it("handles 1000 records in under 500ms", () => {
    const records = generateRecords(1000);
    const t0 = performance.now();
    const schema = inferSchema(records);
    const elapsed = performance.now() - t0;
    expect(schema.fields.length).toBeGreaterThan(5);
    expect(elapsed).toBeLessThan(500);
  });

  it("handles 5000 records in under 2000ms", () => {
    const records = generateRecords(5000);
    const t0 = performance.now();
    inferSchema(records);
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(2000);
  });
});

// ─── adapterGenerator ──────────────────────────────────────────────────

describe("performance — generateAdapter", () => {
  it("generates adapter for 1000-record schema in under 300ms", () => {
    const schema = inferSchema(generateRecords(1000));
    const t0 = performance.now();
    generateAdapter(schema, {
      name: "Perf",
      baseUrl: "https://api.example.com",
      authHint: { type: "bearer" },
      listEndpoint: "/users",
    });
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(300);
  });
});

// ─── schemaDrift ───────────────────────────────────────────────────────

describe("performance — diffSchemas", () => {
  it("diffs two 1000-record schemas in under 100ms", () => {
    const baseline = inferSchema(generateRecords(1000));
    const modifiedRecords = generateRecords(1000).map((r) => ({ ...r, new_field: "x" }));
    const current = inferSchema(modifiedRecords);
    const t0 = performance.now();
    diffSchemas(baseline, current);
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(100);
  });
});

// ─── personalizationHints ──────────────────────────────────────────────

describe("performance — extractPersonalizationHints", () => {
  it("runs 11 trigger rules against 1000-record schema in under 50ms", () => {
    const schema = inferSchema(generateRecords(1000));
    const t0 = performance.now();
    extractPersonalizationHints(schema);
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(50);
  });
});

// ─── crmCanonicalMap ───────────────────────────────────────────────────

describe("performance — mapToCanonicalContact", () => {
  it("maps 1000-record schema in under 100ms", () => {
    const schema = inferSchema(generateRecords(1000));
    const t0 = performance.now();
    mapToCanonicalContact(schema);
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(100);
  });
});

// ─── sensitiveRedaction ────────────────────────────────────────────────

describe("performance — redactRecords", () => {
  it("redacts 1000 records in under 200ms", () => {
    const records = generateRecords(1000).map((r, i) => ({
      ...r,
      ssn: `${String(100 + (i % 900)).padStart(3, "0")}-${String(10 + (i % 90)).padStart(2, "0")}-${String(1000 + (i % 9000)).padStart(4, "0")}`,
      password: `pw-${i}`,
    }));
    const t0 = performance.now();
    redactRecords(records);
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(200);
  });

  it("tokenization shares tokens across records efficiently", () => {
    // 100 records all with the same SSN → should produce 1 token, not 100
    const records: Array<Record<string, unknown>> = [];
    for (let i = 0; i < 100; i++) {
      records.push({ id: i, ssn: "111-11-1111" });
    }
    const { records: redacted } = redactRecords(records, { strategy: "tokenize" });
    const uniqueTokens = new Set(redacted.map((r) => r.ssn));
    expect(uniqueTokens.size).toBe(1);
  });
});

// ─── crossModelDistillation ────────────────────────────────────────────

describe("performance — distillConsensus", () => {
  it("distills 10 model outputs with ~20 claims each in under 1000ms", () => {
    // Generate 10 paraphrased outputs
    const outputs = [];
    const templates = [
      "Diversification reduces portfolio risk significantly over long horizons.",
      "Retirement planning starts with setting clear goals and timelines.",
      "Tax-advantaged accounts like 401(k) and IRA are powerful wealth builders.",
      "Emergency funds should cover 3-6 months of living expenses.",
      "Index funds typically outperform actively managed funds after fees.",
      "Estate planning ensures your assets transfer smoothly to beneficiaries.",
      "Insurance is a foundational layer of any financial plan.",
      "Social security benefits should be integrated into retirement income.",
      "Asset allocation is more important than individual security selection.",
      "Dollar-cost averaging reduces timing risk over long periods.",
    ];
    for (let i = 0; i < 10; i++) {
      outputs.push({
        model: `model-${i}`,
        text: templates.join(" "),
      });
    }
    const t0 = performance.now();
    const result = distillConsensus(outputs);
    const elapsed = performance.now() - t0;
    expect(result.consensusClaims.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(1000);
  });
});

// ─── onboardingWizard ──────────────────────────────────────────────────

describe("performance — runOnboardingWizard", () => {
  it("completes full onboarding for 500 records in under 1000ms", async () => {
    const records = generateRecords(500);
    const t0 = performance.now();
    const result = await runOnboardingWizard({
      sampleRecords: records,
      name: "Benchmark",
      baseUrl: "https://api.example.com",
      listEndpoint: "/users",
      authHint: { type: "bearer" },
    });
    const elapsed = performance.now() - t0;
    expect(result.ready).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });
});
