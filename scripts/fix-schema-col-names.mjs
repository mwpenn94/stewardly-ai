import 'dotenv/config';
import mysql from 'mysql2/promise';
import fs from 'fs';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Get all tables
const [tables] = await conn.query("SHOW TABLES");
const dbName = Object.keys(tables[0])[0];
const tableNames = tables.map(t => t[dbName]);

// Read the schema file
let schema = fs.readFileSync('drizzle/schema.ts', 'utf8');
let totalFixes = 0;

for (const tableName of tableNames) {
  const [cols] = await conn.query(`SHOW COLUMNS FROM \`${tableName}\``);
  const dbCols = cols.map(c => c.Field);
  
  // Find the Drizzle table definition
  const tableStart = schema.indexOf(`mysqlTable("${tableName}"`);
  if (tableStart === -1) continue;
  
  // Find the closing of the table definition - find the matching closing paren
  let depth = 0;
  let tableEnd = tableStart;
  let foundFirst = false;
  for (let i = tableStart; i < schema.length; i++) {
    if (schema[i] === '(') { depth++; foundFirst = true; }
    if (schema[i] === ')') { depth--; }
    if (foundFirst && depth === 0) { tableEnd = i + 1; break; }
  }
  
  const tableDef = schema.substring(tableStart, tableEnd);
  
  // Extract SQL column names from patterns like: type("column_name"
  const colNameRegex = /(?:int|varchar|text|boolean|mysqlEnum|float|bigint|json|timestamp|datetime|mysqlBoolean)\("([^"]+)"/g;
  let match;
  let newTableDef = tableDef;
  
  while ((match = colNameRegex.exec(tableDef)) !== null) {
    const drizzleCol = match[1];
    if (!dbCols.includes(drizzleCol)) {
      // Check if camelCase version exists
      const camelVersion = drizzleCol.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      if (dbCols.includes(camelVersion)) {
        // Replace the SQL column name in the type definition
        // Be very precise: replace only within the type("...") pattern
        const oldPattern = match[0]; // e.g., varchar("action_id"
        const newPattern = oldPattern.replace(`"${drizzleCol}"`, `"${camelVersion}"`);
        newTableDef = newTableDef.replace(oldPattern, newPattern);
        totalFixes++;
      }
    }
  }
  
  if (newTableDef !== tableDef) {
    schema = schema.replace(tableDef, newTableDef);
  }
}

// Write the fixed schema
fs.writeFileSync('drizzle/schema.ts', schema);
console.log(`Fixed ${totalFixes} column name mismatches in drizzle/schema.ts`);

await conn.end();
