/**
 * Execute migration 0008: Add 5 missing tables and 6 missing columns
 */
import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const url = new URL(process.env.DATABASE_URL);
  const conn = await mysql.createConnection({
    host: url.hostname, port: parseInt(url.port) || 3306,
    user: url.username, password: url.password,
    database: url.pathname.slice(1),
    ssl: { rejectUnauthorized: false },
    connectTimeout: 10000,
    multipleStatements: false,
  });

  const sqlFile = fs.readFileSync(
    path.resolve(__dirname, '../migrations/0008_add_missing_tables_and_columns.sql'),
    'utf-8'
  );

  // Split by semicolons, filter out comments and empty lines
  const statements = sqlFile
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Found ${statements.length} SQL statements to execute\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.substring(0, 80).replace(/\n/g, ' ');
    try {
      await conn.query(stmt);
      success++;
      console.log(`✓ [${i + 1}/${statements.length}] ${preview}...`);
    } catch (err) {
      failed++;
      console.error(`✗ [${i + 1}/${statements.length}] ${preview}...`);
      console.error(`  Error: ${err.message}\n`);
    }
  }

  console.log(`\n=== MIGRATION COMPLETE ===`);
  console.log(`  Success: ${success}`);
  console.log(`  Failed: ${failed}`);

  await conn.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
