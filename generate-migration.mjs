// generate-migration.mjs
// Compares Drizzle schema column names against actual DB columns.
// Generates ALTER TABLE RENAME COLUMN for snake_case→camelCase mismatches.

import { createConnection } from 'mysql2/promise';
import { readFileSync, writeFileSync } from 'fs';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

const url = new URL(DATABASE_URL);
const conn = await createConnection({
  host: url.hostname, port: parseInt(url.port) || 3306,
  user: url.username, password: url.password,
  database: url.pathname.slice(1), ssl: { rejectUnauthorized: false },
});

const dbName = url.pathname.slice(1);

// Read Drizzle schema
const schemaContent = readFileSync('drizzle/schema.ts', 'utf-8');

// Parse table definitions
const tableRegex = /export\s+const\s+(\w+)\s*=\s*mysqlTable\(\s*["']([^"']+)["']\s*,\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/gs;

const schemaTables = {};
let match;
while ((match = tableRegex.exec(schemaContent)) !== null) {
  const [, varName, tableName, columnsBlock] = match;
  const colRegex = /(\w+)\s*:\s*(?:int|varchar|text|boolean|mysqlEnum|json|float|double|bigint|timestamp|datetime|decimal)\s*\(\s*["']([^"']+)["']/g;
  const columns = {};
  let colMatch;
  while ((colMatch = colRegex.exec(columnsBlock)) !== null) {
    columns[colMatch[1]] = colMatch[2];
  }
  if (Object.keys(columns).length > 0) {
    schemaTables[tableName] = columns;
  }
}

// Get actual DB columns
const [dbRows] = await conn.query(`
  SELECT TABLE_NAME, COLUMN_NAME
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = ?
  ORDER BY TABLE_NAME, ORDINAL_POSITION
`, [dbName]);

const dbTableCols = {};
for (const row of dbRows) {
  if (!dbTableCols[row.TABLE_NAME]) dbTableCols[row.TABLE_NAME] = new Set();
  dbTableCols[row.TABLE_NAME].add(row.COLUMN_NAME);
}

function camelToSnake(str) {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

const allStatements = [];
let tablesFixed = 0;
let totalRenames = 0;

for (const [tableName, schemaColumns] of Object.entries(schemaTables)) {
  const dbCols = dbTableCols[tableName];
  if (!dbCols) continue;

  const tableStmts = [];
  for (const [propName, expectedCol] of Object.entries(schemaColumns)) {
    if (dbCols.has(expectedCol)) continue;

    const snakeVersion = camelToSnake(expectedCol);
    if (dbCols.has(snakeVersion) && snakeVersion !== expectedCol) {
      tableStmts.push(`ALTER TABLE \`${tableName}\` RENAME COLUMN \`${snakeVersion}\` TO \`${expectedCol}\`;`);
    }
  }

  if (tableStmts.length > 0) {
    tablesFixed++;
    totalRenames += tableStmts.length;
    allStatements.push(`-- ${tableName} (${tableStmts.length} columns)`);
    allStatements.push(...tableStmts);
    allStatements.push('');
  }
}

console.log(`=== MIGRATION SUMMARY ===`);
console.log(`Tables in schema: ${Object.keys(schemaTables).length}`);
console.log(`Tables needing renames: ${tablesFixed}`);
console.log(`Total columns to rename: ${totalRenames}`);
console.log('');

const sql = allStatements.join('\n');
writeFileSync('/tmp/schema-migration.sql', sql);
console.log('Migration SQL written to /tmp/schema-migration.sql');
console.log('');
console.log(sql);

await conn.end();
