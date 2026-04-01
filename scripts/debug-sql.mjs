import 'dotenv/config';
import { drizzle } from 'drizzle-orm/mysql2';
import { sql, eq, desc } from 'drizzle-orm';
import mysql from 'mysql2/promise';
import { conversations, messages } from '../drizzle/schema.ts';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(conn);

// Build the query and log it
const query = db.select({
  id: conversations.id,
  title: conversations.title,
  messageCount: sql`(SELECT COUNT(*) FROM \`messages\` WHERE \`messages\`.\`conversationId\` = \`conversations\`.\`id\`)`.as('messageCount'),
}).from(conversations).where(eq(conversations.userId, 1)).limit(5);

const sqlStr = query.toSQL();
console.log('Generated SQL:', sqlStr.sql);
console.log('Params:', sqlStr.params);

const result = await query;
console.log('Result:', JSON.stringify(result, null, 2));

await conn.end();
