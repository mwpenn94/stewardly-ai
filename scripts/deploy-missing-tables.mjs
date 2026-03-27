#!/usr/bin/env node
/**
 * Deploy Missing Tables Script
 *
 * Reads the migration SQL file and executes it against the live database.
 * Requires DATABASE_URL environment variable.
 *
 * Usage:
 *   DATABASE_URL=mysql://... node scripts/deploy-missing-tables.mjs
 *
 * Or with pnpm:
 *   pnpm run db:deploy-missing
 */

import { createConnection } from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is required");
  process.exit(1);
}

// Parse DATABASE_URL
function parseUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: parseInt(u.port) || 4000,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password || ""),
    database: u.pathname.slice(1),
    ssl: { rejectUnauthorized: true },
    connectTimeout: 30000,
  };
}

async function main() {
  const fs = await import("fs");
  const path = await import("path");

  const sqlFile = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    "..",
    "drizzle",
    "0007_deploy_missing_tables.sql"
  );

  if (!fs.existsSync(sqlFile)) {
    console.error(`ERROR: Migration file not found: ${sqlFile}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlFile, "utf-8");
  const statements = sql
    .split(";")
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith("--"));

  console.log(`[Deploy] Found ${statements.length} SQL statements to execute`);
  console.log(`[Deploy] Connecting to database...`);

  const config = parseUrl(DATABASE_URL);
  const conn = await createConnection(config);

  console.log(`[Deploy] Connected to ${config.host}:${config.port}/${config.database}`);

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const tableName = stmt.match(/(?:CREATE TABLE|ALTER TABLE).*?`(\w+)`/i)?.[1] || `statement_${i}`;

    try {
      await conn.execute(stmt);
      success++;
      if ((i + 1) % 20 === 0) {
        console.log(`[Deploy] Progress: ${i + 1}/${statements.length}`);
      }
    } catch (err) {
      if (err.code === "ER_TABLE_EXISTS_ERROR" || err.message?.includes("already exists")) {
        skipped++;
      } else {
        failed++;
        console.error(`[Deploy] FAILED on ${tableName}: ${err.message?.substring(0, 100)}`);
      }
    }
  }

  await conn.end();

  console.log(`\n[Deploy] Complete:`);
  console.log(`  Created: ${success}`);
  console.log(`  Skipped (already exist): ${skipped}`);
  console.log(`  Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error("[Deploy] Fatal error:", err.message);
  process.exit(1);
});
