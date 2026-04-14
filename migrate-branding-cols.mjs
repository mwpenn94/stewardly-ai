import 'dotenv/config';
import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) { console.error('No DATABASE_URL'); process.exit(1); }

const conn = await mysql.createConnection(url);

const cols = [
  ["secondaryColor", "VARCHAR(7) DEFAULT '#1E293B'"],
  ["fontFamily", "VARCHAR(128) DEFAULT 'Inter'"],
  ["heroImageUrl", "TEXT"],
  ["customCss", "TEXT"],
  ["backgroundPattern", "VARCHAR(64) DEFAULT 'mesh'"],
  ["faviconUrl", "TEXT"],
];

for (const [name, def] of cols) {
  try {
    await conn.execute(`ALTER TABLE organization_landing_page_config ADD COLUMN ${name} ${def}`);
    console.log(`Added column: ${name}`);
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log(`Column already exists: ${name}`);
    } else {
      console.error(`Error adding ${name}:`, e.message);
    }
  }
}

await conn.end();
console.log('Migration complete');
