/**
 * Standalone script to find ALL schema mismatches between Drizzle schema and DB.
 * Run with: node scripts/find-schema-issues.mjs
 */
import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseSchemaFile(schemaContent) {
  const tables = [];

  // Match: export const X = mysqlTable("table_name", { ...columns... })
  const tableRegex = /export\s+const\s+\w+\s*=\s*mysqlTable\(\s*["']([^"']+)["']\s*,\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/g;

  let match;
  while ((match = tableRegex.exec(schemaContent)) !== null) {
    const tableName = match[1];
    const columnsBlock = match[2];

    // Match column declarations: propName: type("dbColumnName", ...)
    const colRegex = /\w+\s*:\s*(?:int|varchar|text|boolean|mysqlEnum|json|float|double|bigint|timestamp|datetime|decimal)\s*\(\s*["']([^"']+)["']/g;
    const columns = [];
    let colMatch;
    while ((colMatch = colRegex.exec(columnsBlock)) !== null) {
      columns.push(colMatch[1]);
    }

    if (columns.length > 0) {
      tables.push({ tableName, columns });
    }
  }

  return tables;
}

async function main() {
  const schemaPath = path.resolve(__dirname, '../drizzle/schema.ts');
  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
  const schemaTables = parseSchemaFile(schemaContent);

  console.log(`Parsed ${schemaTables.length} tables from Drizzle schema`);

  // Read DATABASE_URL from process env (loaded by tsx/dotenv)
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const url = new URL(DATABASE_URL);
  const conn = await mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    ssl: { rejectUnauthorized: false },
    connectTimeout: 10000,
  });

  const dbName = url.pathname.slice(1);

  const [rows] = await conn.query(
    `SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    [dbName]
  );

  // Group by table
  const dbTableCols = {};
  for (const row of rows) {
    if (!dbTableCols[row.TABLE_NAME]) dbTableCols[row.TABLE_NAME] = new Set();
    dbTableCols[row.TABLE_NAME].add(row.COLUMN_NAME);
  }

  console.log(`Found ${Object.keys(dbTableCols).length} tables in database\n`);

  // Compare
  let missingTables = 0;
  let missingColumns = 0;
  const missingTablesList = [];
  const missingColumnsList = [];

  for (const { tableName, columns } of schemaTables) {
    const dbCols = dbTableCols[tableName];

    if (!dbCols) {
      missingTables++;
      missingTablesList.push(tableName);
      // Also list all columns for this table
      for (const col of columns) {
        missingColumnsList.push({ table: tableName, column: col, isNewTable: true });
      }
      continue;
    }

    for (const col of columns) {
      if (!dbCols.has(col)) {
        missingColumns++;
        missingColumnsList.push({ table: tableName, column: col, isNewTable: false });
      }
    }
  }

  console.log(`=== MISSING TABLES (${missingTables}) ===`);
  for (const t of missingTablesList) {
    console.log(`  - ${t}`);
  }

  console.log(`\n=== MISSING COLUMNS (${missingColumns}) ===`);
  // Group by table for readability
  const byTable = {};
  for (const { table, column, isNewTable } of missingColumnsList) {
    if (isNewTable) continue; // skip columns from missing tables
    if (!byTable[table]) byTable[table] = [];
    byTable[table].push(column);
  }
  for (const [table, cols] of Object.entries(byTable)) {
    console.log(`  ${table}:`);
    for (const col of cols) {
      console.log(`    - ${col}`);
    }
  }

  console.log(`\nTotal: ${missingTables} missing tables, ${missingColumns} missing columns`);
  console.log(`Grand total: ${missingTables + missingColumns} issues`);

  // Also output as JSON for programmatic use
  const output = {
    missingTables: missingTablesList,
    missingColumns: missingColumnsList,
    summary: { missingTables, missingColumns, total: missingTables + missingColumns }
  };
  fs.writeFileSync(path.resolve(__dirname, '../schema-issues.json'), JSON.stringify(output, null, 2));
  console.log('\nFull details written to schema-issues.json');

  await conn.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
