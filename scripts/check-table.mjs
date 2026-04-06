import { db } from '../server/db.ts';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    const r = await db.execute(sql`DESCRIBE agent_instances`);
    console.log("agent_instances columns:", JSON.stringify(r.rows || r, null, 2));
  } catch (e) {
    console.error("Error:", e.message);
  }
  process.exit(0);
}
main();
