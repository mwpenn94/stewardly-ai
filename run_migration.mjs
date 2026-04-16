import mysql from 'mysql2/promise';
import fs from 'fs';

const sql = fs.readFileSync('/home/ubuntu/wealthbridge-ai/drizzle/migrations/pass59_permissions_sharing.sql', 'utf8');
const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));

const conn = await mysql.createConnection(process.env.DATABASE_URL);
for (const stmt of statements) {
  try {
    await conn.execute(stmt);
    console.log('OK:', stmt.substring(0, 60) + '...');
  } catch (e) {
    if (e.code === 'ER_TABLE_EXISTS_ERROR' || e.code === 'ER_DUP_KEYNAME') {
      console.log('SKIP (already exists):', stmt.substring(0, 60) + '...');
    } else {
      console.error('ERR:', e.message, '\nSQL:', stmt.substring(0, 80));
    }
  }
}
await conn.end();
console.log('Migration complete');
