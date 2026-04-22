import mysql from 'mysql2/promise';
import fs from 'fs';

const url = process.env.DATABASE_URL;
if (!url) { console.error("No DATABASE_URL"); process.exit(1); }

const sql = fs.readFileSync(new URL('./pass39-parity-tables.sql', import.meta.url), 'utf8');
const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));

const conn = await mysql.createConnection(url);
for (const stmt of statements) {
  try {
    await conn.execute(stmt);
    console.log(`OK: ${stmt.substring(0, 60)}...`);
  } catch (err) {
    console.error(`ERR: ${stmt.substring(0, 60)}... → ${err.message}`);
  }
}
await conn.end();
console.log("Migration complete.");
