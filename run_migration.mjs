import 'dotenv/config';
import { readFileSync } from 'fs';
import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }

const conn = await mysql.createConnection(url);
const sql = readFileSync('drizzle/planning_architecture_migration.sql', 'utf8');
const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));

for (const stmt of statements) {
  try {
    await conn.execute(stmt);
    console.log('OK:', stmt.substring(0, 60) + '...');
  } catch (e) {
    if (e.code === 'ER_TABLE_EXISTS_ERROR' || e.code === 'ER_DUP_KEYNAME') {
      console.log('SKIP (exists):', stmt.substring(0, 60) + '...');
    } else {
      console.error('ERR:', e.message, '\nSQL:', stmt.substring(0, 100));
    }
  }
}

await conn.end();
console.log('\nMigration complete.');
