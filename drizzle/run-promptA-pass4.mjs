import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");

  const conn = await mysql.createConnection(url);

  const sql = fs.readFileSync(path.join(__dirname, "promptA-pass4-tables.sql"), "utf-8");

  // Split on semicolons, filter empty
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  for (const stmt of statements) {
    try {
      await conn.execute(stmt);
      console.log("OK:", stmt.slice(0, 60));
    } catch (e) {
      // Ignore duplicate index/table errors
      if (e.code === "ER_DUP_KEYNAME" || e.code === "ER_TABLE_EXISTS_ERROR") {
        console.log("SKIP (exists):", stmt.slice(0, 60));
      } else {
        console.error("ERR:", e.message, "\n  SQL:", stmt.slice(0, 80));
      }
    }
  }

  await conn.end();
  console.log("Pass 4 migration complete");
}

run().catch(console.error);
