import mysql from 'mysql2/promise';
import fs from 'fs';

async function run() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const sql = fs.readFileSync('drizzle/0099_stripe_billing.sql', 'utf8');
  const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));
  for (const stmt of statements) {
    try {
      await conn.execute(stmt);
      console.log('OK:', stmt.substring(0, 80));
    } catch(e) {
      console.log('ERR:', e.message.substring(0, 120), '|', stmt.substring(0, 60));
    }
  }
  await conn.end();
  console.log('Migration complete');
}
run();
