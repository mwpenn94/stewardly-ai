import 'dotenv/config';
import mysql from 'mysql2/promise';
import fs from 'fs';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Get all tables
const [tables] = await conn.query("SHOW TABLES");
const dbName = Object.keys(tables[0])[0];
const tableNames = tables.map(t => t[dbName]);

// Read the schema file
const schema = fs.readFileSync('drizzle/schema.ts', 'utf8');

// For each table, find columns in DB and compare with Drizzle schema
const mismatches = [];
let totalMismatchedCols = 0;

for (const tableName of tableNames) {
  const [cols] = await conn.query(`SHOW COLUMNS FROM \`${tableName}\``);
  const dbCols = cols.map(c => c.Field);
  
  // Find the Drizzle table definition
  const tableRegex = new RegExp(`mysqlTable\\("${tableName}"`, 'g');
  if (!tableRegex.test(schema)) continue;
  
  // Extract column SQL names from Drizzle schema
  // Pattern: columnName: type("sql_name"...)
  const tableStart = schema.indexOf(`mysqlTable("${tableName}"`);
  if (tableStart === -1) continue;
  
  // Find the closing of the table definition
  let depth = 0;
  let tableEnd = tableStart;
  let foundFirst = false;
  for (let i = tableStart; i < schema.length; i++) {
    if (schema[i] === '(') { depth++; foundFirst = true; }
    if (schema[i] === ')') { depth--; }
    if (foundFirst && depth === 0) { tableEnd = i; break; }
  }
  
  const tableDef = schema.substring(tableStart, tableEnd);
  
  // Extract SQL column names from patterns like: type("column_name"
  const colNameRegex = /(?:int|varchar|text|boolean|mysqlEnum|float|bigint|json|timestamp|datetime|mysqlBoolean)\("([^"]+)"/g;
  const drizzleCols = [];
  let match;
  while ((match = colNameRegex.exec(tableDef)) !== null) {
    drizzleCols.push(match[1]);
  }
  
  // Find mismatches: columns in Drizzle schema that don't exist in DB
  const tableMismatches = [];
  for (const drizzleCol of drizzleCols) {
    if (!dbCols.includes(drizzleCol)) {
      // Check if camelCase version exists
      const camelVersion = drizzleCol.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      if (dbCols.includes(camelVersion)) {
        tableMismatches.push({ drizzle: drizzleCol, db: camelVersion, type: 'snake_to_camel' });
      } else {
        tableMismatches.push({ drizzle: drizzleCol, db: null, type: 'missing' });
      }
    }
  }
  
  if (tableMismatches.length > 0) {
    mismatches.push({ table: tableName, mismatches: tableMismatches });
    totalMismatchedCols += tableMismatches.length;
  }
}

console.log(`\n=== Column Name Mismatches ===`);
console.log(`Total tables with mismatches: ${mismatches.length}`);
console.log(`Total mismatched columns: ${totalMismatchedCols}\n`);

for (const { table, mismatches: cols } of mismatches) {
  console.log(`\n--- ${table} (${cols.length} mismatches) ---`);
  for (const col of cols) {
    if (col.type === 'snake_to_camel') {
      console.log(`  "${col.drizzle}" → DB has "${col.db}"`);
    } else {
      console.log(`  "${col.drizzle}" → MISSING from DB`);
    }
  }
}

// Generate fix: for each mismatch, output the sed command to fix the schema
console.log(`\n\n=== Fix Commands (update Drizzle schema to match DB) ===\n`);
for (const { table, mismatches: cols } of mismatches) {
  for (const col of cols) {
    if (col.type === 'snake_to_camel') {
      console.log(`Table ${table}: change "${col.drizzle}" to "${col.db}"`);
    }
  }
}

await conn.end();
