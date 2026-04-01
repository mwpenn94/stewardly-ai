/**
 * Finds TRULY missing tables and columns by checking both snake_case and camelCase variants.
 * The Drizzle schema defines SQL column names as snake_case, but some tables were created
 * with camelCase column names. This script checks both.
 */
import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function snakeToCamel(s) {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function parseSchemaFile(schemaContent) {
  const tables = [];
  const tableRegex = /export\s+const\s+\w+\s*=\s*mysqlTable\(\s*["']([^"']+)["']\s*,\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/g;
  let match;
  while ((match = tableRegex.exec(schemaContent)) !== null) {
    const tableName = match[1];
    const columnsBlock = match[2];
    const colRegex = /\w+\s*:\s*(?:int|varchar|text|boolean|mysqlEnum|json|float|double|bigint|timestamp|datetime|decimal|date)\s*\(\s*["']([^"']+)["']/g;
    const columns = [];
    let colMatch;
    while ((colMatch = colRegex.exec(columnsBlock)) !== null) {
      columns.push(colMatch[1]);
    }
    // Also match mysqlBoolean which is aliased from boolean
    const boolRegex = /\w+\s*:\s*mysqlBoolean\s*\(\s*["']([^"']+)["']/g;
    while ((colMatch = boolRegex.exec(columnsBlock)) !== null) {
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

  const url = new URL(process.env.DATABASE_URL);
  const conn = await mysql.createConnection({
    host: url.hostname, port: parseInt(url.port) || 3306,
    user: url.username, password: url.password,
    database: url.pathname.slice(1),
    ssl: { rejectUnauthorized: false },
    connectTimeout: 10000,
  });

  const dbName = url.pathname.slice(1);
  const [rows] = await conn.query(
    `SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    [dbName]
  );

  const dbTableCols = {};
  for (const row of rows) {
    if (!dbTableCols[row.TABLE_NAME]) dbTableCols[row.TABLE_NAME] = new Set();
    dbTableCols[row.TABLE_NAME].add(row.COLUMN_NAME);
  }

  const trulyMissingTables = [];
  const trulyMissingColumns = [];
  const falseAlarmColumns = [];

  for (const { tableName, columns } of schemaTables) {
    const dbCols = dbTableCols[tableName];

    if (!dbCols) {
      trulyMissingTables.push({ tableName, columns });
      continue;
    }

    for (const col of columns) {
      const camelVariant = snakeToCamel(col);
      if (dbCols.has(col)) {
        // Exact match - fine
      } else if (dbCols.has(camelVariant)) {
        // camelCase match - false alarm
        falseAlarmColumns.push({ table: tableName, schemaCol: col, dbCol: camelVariant });
      } else {
        // Truly missing
        trulyMissingColumns.push({ table: tableName, column: col, camelVariant });
      }
    }
  }

  console.log(`\n=== TRULY MISSING TABLES (${trulyMissingTables.length}) ===`);
  for (const { tableName, columns } of trulyMissingTables) {
    console.log(`  ${tableName} (${columns.length} columns)`);
  }

  console.log(`\n=== TRULY MISSING COLUMNS (${trulyMissingColumns.length}) ===`);
  const byTable = {};
  for (const { table, column, camelVariant } of trulyMissingColumns) {
    if (!byTable[table]) byTable[table] = [];
    byTable[table].push({ column, camelVariant });
  }
  for (const [table, cols] of Object.entries(byTable)) {
    console.log(`  ${table}:`);
    for (const { column, camelVariant } of cols) {
      console.log(`    - ${column} (also checked: ${camelVariant})`);
    }
  }

  console.log(`\n=== FALSE ALARMS (${falseAlarmColumns.length}) ===`);
  console.log(`  (columns exist with camelCase names instead of snake_case)`);
  const falseByTable = {};
  for (const { table, schemaCol, dbCol } of falseAlarmColumns) {
    if (!falseByTable[table]) falseByTable[table] = [];
    falseByTable[table].push({ schemaCol, dbCol });
  }
  for (const [table, cols] of Object.entries(falseByTable)) {
    console.log(`  ${table}: ${cols.map(c => `${c.schemaCol} → ${c.dbCol}`).join(', ')}`);
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`  Truly missing tables: ${trulyMissingTables.length}`);
  console.log(`  Truly missing columns: ${trulyMissingColumns.length}`);
  console.log(`  False alarm columns (camelCase): ${falseAlarmColumns.length}`);
  console.log(`  Total real issues: ${trulyMissingTables.length + trulyMissingColumns.length}`);

  // Save results
  const output = {
    trulyMissingTables,
    trulyMissingColumns,
    falseAlarmColumns: falseAlarmColumns.length,
    summary: {
      missingTables: trulyMissingTables.length,
      missingColumns: trulyMissingColumns.length,
      falseAlarms: falseAlarmColumns.length,
      totalRealIssues: trulyMissingTables.length + trulyMissingColumns.length
    }
  };
  fs.writeFileSync(path.resolve(__dirname, '../truly-missing.json'), JSON.stringify(output, null, 2));
  console.log('\nFull details written to truly-missing.json');

  await conn.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
