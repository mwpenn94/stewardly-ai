import mysql from "mysql2/promise";
const conn = await mysql.createConnection(process.env.DATABASE_URL);

const fixes = [
  // agent_instances: budgetLimitUsd → budget_limit_usd, totalCostUsd → total_cost_usd
  "ALTER TABLE agent_instances CHANGE budgetLimitUsd budget_limit_usd DECIMAL(10,2)",
  "ALTER TABLE agent_instances CHANGE totalCostUsd total_cost_usd DECIMAL(10,2) DEFAULT 0",
];

for (const sql of fixes) {
  try {
    await conn.execute(sql);
    console.log("OK:", sql.substring(0, 80));
  } catch (e) {
    console.error("SKIP:", e.message.substring(0, 100));
  }
}

// Also check for other tables with column mismatches
const tablesToCheck = [
  "agent_actions", "gate_reviews", "insurance_quotes", "insurance_applications",
  "advisory_executions", "estate_documents", "premium_finance_cases",
  "carrier_connections", "lead_pipeline", "coa_campaigns",
  "lead_profile_accumulator", "import_jobs"
];

for (const table of tablesToCheck) {
  try {
    const [cols] = await conn.execute(`DESCRIBE ${table}`);
    console.log(`\n${table}: ${cols.map(c => c.Field).join(", ")}`);
  } catch (e) {
    console.log(`${table}: NOT FOUND`);
  }
}

await conn.end();
process.exit(0);
