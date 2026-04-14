import 'dotenv/config';
import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }

const conn = await mysql.createConnection(url);

const sql = `
CREATE TABLE IF NOT EXISTS calculator_sessions (
  id int AUTO_INCREMENT NOT NULL,
  userId int NOT NULL,
  name varchar(256) NOT NULL,
  description text,
  inputs json NOT NULL,
  results json,
  scores json,
  overall_score float,
  is_auto_save boolean DEFAULT false,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  CONSTRAINT calculator_sessions_id PRIMARY KEY(id)
);
`;

try {
  await conn.execute(sql);
  console.log('Table calculator_sessions created (or already exists).');

  try { await conn.execute('CREATE INDEX idx_calc_sessions_user ON calculator_sessions (userId)'); } catch(e) { console.log('Index idx_calc_sessions_user:', e.message); }
  try { await conn.execute('CREATE INDEX idx_calc_sessions_created ON calculator_sessions (created_at)'); } catch(e) { console.log('Index idx_calc_sessions_created:', e.message); }

  console.log('Migration complete.');
} catch (err) {
  console.error('Migration error:', err.message);
} finally {
  await conn.end();
}
