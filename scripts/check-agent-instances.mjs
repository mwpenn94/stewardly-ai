import mysql from "mysql2/promise";
const conn = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [rows] = await conn.execute("DESCRIBE agent_instances");
  console.log("agent_instances columns:");
  rows.forEach(r => console.log(`  ${r.Field} (${r.Type})`));
} catch (e) {
  console.error("Error:", e.message);
}
await conn.end();
