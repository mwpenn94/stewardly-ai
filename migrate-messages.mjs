import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

async function run() {
  const conn = await mysql.createConnection(url);
  
  // Check which columns exist
  const [cols] = await conn.query("SHOW COLUMNS FROM `messages`");
  const colNames = cols.map(c => c.Field);
  
  console.log("Existing columns:", colNames.join(", "));
  
  if (!colNames.includes("modelVersion")) {
    console.log("Adding modelVersion column...");
    await conn.query("ALTER TABLE `messages` ADD COLUMN `modelVersion` varchar(64) DEFAULT NULL");
    console.log("  Done.");
  } else {
    console.log("modelVersion already exists, skipping.");
  }
  
  if (!colNames.includes("parentMessageId")) {
    console.log("Adding parentMessageId column...");
    await conn.query("ALTER TABLE `messages` ADD COLUMN `parentMessageId` int DEFAULT NULL");
    console.log("  Done.");
  } else {
    console.log("parentMessageId already exists, skipping.");
  }
  
  // Also check for rich_media_embeds table
  try {
    const [tables] = await conn.query("SHOW TABLES LIKE 'rich_media_embeds'");
    if (tables.length === 0) {
      console.log("Creating rich_media_embeds table...");
      await conn.query(`
        CREATE TABLE IF NOT EXISTS \`rich_media_embeds\` (
          \`id\` int AUTO_INCREMENT NOT NULL,
          \`messageId\` int NOT NULL,
          \`mediaType\` enum('video','audio','image','document','shopping','link') NOT NULL,
          \`url\` text NOT NULL,
          \`title\` varchar(512),
          \`thumbnailUrl\` text,
          \`metadata\` json,
          \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT \`rich_media_embeds_id\` PRIMARY KEY(\`id\`),
          INDEX \`idx_rich_media_embeds_message_id\` (\`messageId\`)
        )
      `);
      console.log("  Done.");
    } else {
      console.log("rich_media_embeds table already exists.");
    }
  } catch (e) {
    console.log("rich_media_embeds check:", e.message);
  }
  
  // Verify
  const [finalCols] = await conn.query("SHOW COLUMNS FROM `messages`");
  console.log("\nFinal messages columns:", finalCols.map(c => c.Field).join(", "));
  
  await conn.end();
  console.log("\nMigration complete.");
}

run().catch(e => { console.error(e); process.exit(1); });
