#!/usr/bin/env node
/**
 * Deploy missing tables: agent_instances, agent_actions, gate_reviews,
 * insurance_quotes, insurance_applications, advisory_executions,
 * estate_documents, premium_finance_cases, carrier_connections,
 * lead_pipeline, coa_campaigns
 */
import { createConnection } from "mysql2/promise";
import { readFileSync } from "fs";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const url = new URL(DATABASE_URL);
const conn = await createConnection({
  host: url.hostname,
  port: parseInt(url.port || "3306"),
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false },
  multipleStatements: true,
});

const sql = readFileSync("/tmp/deploy_missing_tables.sql", "utf8");
const statements = sql
  .split(/;/)
  .map(s => s.trim())
  .filter(s => s.startsWith("CREATE TABLE"));

let created = 0;
let skipped = 0;

for (const stmt of statements) {
  const match = stmt.match(/CREATE TABLE IF NOT EXISTS `(\w+)`/);
  const tableName = match ? match[1] : "unknown";
  try {
    await conn.execute(stmt);
    console.log(`✓ ${tableName} — created or already exists`);
    created++;
  } catch (err) {
    if (err.code === "ER_TABLE_EXISTS_ERROR") {
      console.log(`○ ${tableName} — already exists, skipped`);
      skipped++;
    } else {
      console.error(`✗ ${tableName} — ERROR: ${err.message}`);
    }
  }
}

console.log(`\nDone: ${created} created/verified, ${skipped} skipped`);
await conn.end();
