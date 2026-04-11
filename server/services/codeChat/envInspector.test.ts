import { describe, it, expect } from "vitest";
import {
  maskValue,
  categorizeEnvVar,
  buildEnvSnapshot,
  filterEntries,
} from "./envInspector";

describe("envInspector — maskValue", () => {
  it("reveals non-secret names fully", () => {
    const r = maskValue("NODE_ENV", "production");
    expect(r.revealed).toBe(true);
    expect(r.display).toBe("production");
  });

  it("masks short values completely", () => {
    const r = maskValue("MY_KEY", "abc");
    expect(r.revealed).toBe(false);
    expect(r.display).toBe("****");
  });

  it("shows a 3-char prefix for longer secrets", () => {
    const r = maskValue("MY_KEY", "secret-value-123456");
    expect(r.revealed).toBe(false);
    expect(r.display.startsWith("sec")).toBe(true);
    expect(r.display).toContain("••••");
    expect(r.display).toContain("19 chars");
  });

  it("handles empty values", () => {
    expect(maskValue("X", "")).toEqual({ display: "", revealed: false });
  });

  it("treats npm_* as non-secret", () => {
    expect(maskValue("npm_package_name", "my-app").revealed).toBe(true);
  });

  it("truncates long non-secret values", () => {
    const longPath = "x".repeat(200);
    const r = maskValue("PATH", longPath);
    expect(r.revealed).toBe(true);
    expect(r.display.endsWith("…")).toBe(true);
  });
});

describe("envInspector — categorizeEnvVar", () => {
  it("detects database vars", () => {
    expect(categorizeEnvVar("DATABASE_URL")).toBe("database");
    expect(categorizeEnvVar("DB_PASSWORD")).toBe("database");
    expect(categorizeEnvVar("POSTGRES_USER")).toBe("database");
    expect(categorizeEnvVar("TIDB_HOST")).toBe("database");
  });

  it("detects api keys", () => {
    expect(categorizeEnvVar("STRIPE_API_KEY")).toBe("api_key");
    expect(categorizeEnvVar("SOMETHING_TOKEN")).toBe("api_key");
    expect(categorizeEnvVar("MY_SECRET_KEY")).toBe("api_key");
  });

  it("detects auth vars", () => {
    expect(categorizeEnvVar("AUTH_SECRET")).toBe("auth");
    expect(categorizeEnvVar("JWT_SECRET")).toBe("auth");
    expect(categorizeEnvVar("SESSION_KEY")).toBe("auth");
  });

  it("detects aws vars", () => {
    expect(categorizeEnvVar("AWS_ACCESS_KEY_ID")).toBe("aws");
    expect(categorizeEnvVar("S3_BUCKET")).toBe("aws");
  });

  it("detects feature flags", () => {
    expect(categorizeEnvVar("FEATURE_NEW_UI")).toBe("feature_flag");
    expect(categorizeEnvVar("ENABLE_TESTING")).toBe("feature_flag");
  });

  it("detects mail service vars", () => {
    expect(categorizeEnvVar("SMTP_HOST")).toBe("mail");
    expect(categorizeEnvVar("SENDGRID_API_KEY")).toBe("mail");
  });

  it("detects observability vars", () => {
    expect(categorizeEnvVar("OTEL_EXPORTER")).toBe("observability");
    expect(categorizeEnvVar("SENTRY_DSN")).toBe("observability");
  });

  it("detects service URLs", () => {
    expect(categorizeEnvVar("API_URL")).toBe("service_url");
    expect(categorizeEnvVar("WEBHOOK_URI")).toBe("service_url");
    expect(categorizeEnvVar("SERVICE_ENDPOINT")).toBe("service_url");
  });

  it("falls back to general", () => {
    expect(categorizeEnvVar("RANDOM_VAR")).toBe("general");
  });
});

describe("envInspector — buildEnvSnapshot", () => {
  it("produces entries for every present var", () => {
    const snapshot = buildEnvSnapshot({
      NODE_ENV: "test",
      DATABASE_URL: "postgres://user:pass@host/db",
      RANDOM: "abc",
    });
    expect(snapshot.totalPresent).toBe(3);
    const names = snapshot.entries.map((e) => e.name);
    expect(names).toContain("NODE_ENV");
    expect(names).toContain("DATABASE_URL");
    expect(names).toContain("RANDOM");
  });

  it("includes missing expected vars by default", () => {
    const snapshot = buildEnvSnapshot({ PORT: "3000" });
    const missing = snapshot.entries.filter((e) => e.missing);
    expect(missing.some((m) => m.name === "DATABASE_URL")).toBe(true);
    expect(missing.some((m) => m.name === "NODE_ENV")).toBe(true);
    expect(snapshot.missingCount).toBeGreaterThan(0);
  });

  it("flags required missing vars", () => {
    const snapshot = buildEnvSnapshot({});
    expect(snapshot.requiredMissing).toBeGreaterThan(0);
    const dbUrl = snapshot.entries.find((e) => e.name === "DATABASE_URL");
    expect(dbUrl!.required).toBe(true);
    expect(dbUrl!.missing).toBe(true);
  });

  it("sorts missing required first, then present", () => {
    const snapshot = buildEnvSnapshot({
      NODE_ENV: "test",
      PORT: "3000",
    });
    // Missing DATABASE_URL (required) should sort first
    expect(snapshot.entries[0]!.name).toBe("DATABASE_URL");
  });

  it("respects allowList filter", () => {
    const snapshot = buildEnvSnapshot(
      { NODE_ENV: "test", DATABASE_URL: "x", SECRET: "y" },
      { allowList: ["NODE_ENV"] },
    );
    expect(snapshot.entries.map((e) => e.name)).toEqual(["NODE_ENV"]);
  });

  it("counts by category", () => {
    const snapshot = buildEnvSnapshot({
      DATABASE_URL: "postgres://",
      MY_API_KEY: "secret",
      NODE_ENV: "test",
    });
    expect(snapshot.byCategory.database).toBe(1);
    expect(snapshot.byCategory.api_key).toBe(1);
    expect(snapshot.byCategory.general).toBe(1);
  });

  it("respects includeMissing: false", () => {
    const snapshot = buildEnvSnapshot(
      { NODE_ENV: "test" },
      { includeMissing: false },
    );
    expect(snapshot.entries.every((e) => !e.missing)).toBe(true);
  });
});

describe("envInspector — filterEntries", () => {
  const snapshot = buildEnvSnapshot({
    DATABASE_URL: "postgres://user:pass@host/db",
    STRIPE_API_KEY: "sk_test_1234567890",
    NODE_ENV: "test",
  });

  it("filters by category", () => {
    const out = filterEntries(snapshot.entries, { category: "api_key" });
    expect(out.every((e) => e.category === "api_key")).toBe(true);
  });

  it("filters by onlyMissing", () => {
    const out = filterEntries(snapshot.entries, { onlyMissing: true });
    expect(out.every((e) => e.missing)).toBe(true);
  });

  it("filters by search", () => {
    const out = filterEntries(snapshot.entries, { search: "stripe" });
    expect(out.length).toBe(1);
    expect(out[0]!.name).toBe("STRIPE_API_KEY");
  });

  it("composes filters", () => {
    const out = filterEntries(snapshot.entries, {
      category: "database",
      search: "database",
    });
    expect(out).toHaveLength(1);
  });
});
