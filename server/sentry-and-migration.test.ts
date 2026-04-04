import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

describe("Sentry integration", () => {
  it("@sentry/node is installed as a dependency", () => {
    const pkg = JSON.parse(
      readFileSync(resolve(__dirname, "../package.json"), "utf-8")
    );
    expect(pkg.dependencies["@sentry/node"]).toBeTruthy();
  });

  it("sentry.ts module exports initSentry, captureException, getSentry", async () => {
    const sentry = await import("./_core/sentry");
    expect(typeof sentry.initSentry).toBe("function");
    expect(typeof sentry.captureException).toBe("function");
    expect(typeof sentry.getSentry).toBe("function");
  });

  it("captureException is a no-op when SENTRY_DSN is not set", async () => {
    // Should not throw even without Sentry initialized
    const { captureException } = await import("./_core/sentry");
    expect(() => captureException(new Error("test"))).not.toThrow();
  });

  it("server startup imports and calls initSentry", () => {
    const indexContent = readFileSync(
      resolve(__dirname, "./_core/index.ts"),
      "utf-8"
    );
    expect(indexContent).toContain('import { initSentry');
    expect(indexContent).toContain("await initSentry()");
  });
});

describe("Database migration 0007", () => {
  it("migration file exists with 131 CREATE TABLE statements", () => {
    const migrationPath = resolve(
      __dirname,
      "../drizzle/0007_deploy_missing_tables.sql"
    );
    expect(existsSync(migrationPath)).toBe(true);
    const content = readFileSync(migrationPath, "utf-8");
    const createCount = (
      content.match(/CREATE TABLE IF NOT EXISTS/g) || []
    ).length;
    expect(createCount).toBe(131);
  });

  it("migration includes audit hash chain ALTER TABLE statements", () => {
    const content = readFileSync(
      resolve(__dirname, "../drizzle/0007_deploy_missing_tables.sql"),
      "utf-8"
    );
    expect(content).toContain("ALTER TABLE `audit_trail` ADD COLUMN IF NOT EXISTS `entryHash`");
    expect(content).toContain("ALTER TABLE `audit_trail` ADD COLUMN IF NOT EXISTS `previousHash`");
  });

  it("all tables use IF NOT EXISTS for idempotent execution", () => {
    const content = readFileSync(
      resolve(__dirname, "../drizzle/0007_deploy_missing_tables.sql"),
      "utf-8"
    );
    const createStatements = content.match(/CREATE TABLE\b/g) || [];
    const ifNotExistsStatements =
      content.match(/CREATE TABLE IF NOT EXISTS/g) || [];
    expect(createStatements.length).toBe(ifNotExistsStatements.length);
  });

  it("key domain tables are present in migration", () => {
    const content = readFileSync(
      resolve(__dirname, "../drizzle/0007_deploy_missing_tables.sql"),
      "utf-8"
    );
    const expectedTables = [
      "users",
      "integration_providers",
      "integration_connections",
      "suitability_profiles",
      "knowledge_articles",
      "compliance_prescreening",
      "mfa_secrets",
      "credit_profiles",
      "insurance_carriers",
      "insurance_products",
    ];
    for (const table of expectedTables) {
      expect(content).toContain(`CREATE TABLE IF NOT EXISTS \`${table}\``);
    }
  });
});
