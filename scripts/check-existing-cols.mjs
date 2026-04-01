import mysql from 'mysql2/promise';

const url = new URL(process.env.DATABASE_URL);
const conn = await mysql.createConnection({
  host: url.hostname, port: parseInt(url.port) || 3306,
  user: url.username, password: url.password,
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false }
});

const tables = ['gate_reviews','agent_instances','agent_actions','insurance_quotes','insurance_applications','advisory_executions','estate_documents','premium_finance_cases','carrier_connections','data_sources','ingestion_jobs','ingested_records','web_scrape_results','document_extractions','onboarding_progress'];

for (const t of tables) {
  const [rows] = await conn.query(
    'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION',
    [url.pathname.slice(1), t]
  );
  console.log(`${t}: ${rows.map(r => r.COLUMN_NAME).join(', ')}`);
}

await conn.end();
