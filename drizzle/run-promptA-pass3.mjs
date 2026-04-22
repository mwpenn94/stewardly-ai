import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    // Try to read from .env
    const envPath = path.join(__dirname, "..", ".env");
    if (fs.existsSync(envPath)) {
      const env = fs.readFileSync(envPath, "utf8");
      const match = env.match(/DATABASE_URL=(.+)/);
      if (match) process.env.DATABASE_URL = match[1].trim();
    }
  }
  
  const conn = await mysql.createConnection(process.env.DATABASE_URL || "");
  const sql = fs.readFileSync(path.join(__dirname, "promptA-pass3-tables.sql"), "utf8");
  
  // Split by semicolons and execute each statement
  const statements = sql.split(";").map(s => s.trim()).filter(s => s.length > 0);
  
  for (const stmt of statements) {
    try {
      await conn.execute(stmt);
      console.log("OK:", stmt.substring(0, 60) + "...");
    } catch (e) {
      if (e.code === "ER_TABLE_EXISTS_ERROR" || e.code === "ER_DUP_KEYNAME") {
        console.log("SKIP (already exists):", stmt.substring(0, 60) + "...");
      } else {
        console.error("ERR:", e.message, "\n  SQL:", stmt.substring(0, 80));
      }
    }
  }
  
  await conn.end();
  console.log("\nDone.");
}

run().catch(console.error);
