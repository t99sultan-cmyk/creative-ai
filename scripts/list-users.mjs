// Show all users with emails so we can pick which one goes into ADMIN_EMAILS.
// Usage:  node --env-file=.env.local scripts/list-users.mjs
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);

const rows = await sql.query(
  `select id, email, name, impulses, created_at from "public"."user" order by created_at desc limit 20`,
);
const users = Array.isArray(rows) ? rows : (rows.rows || []);

console.log(`Пользователи (последние ${users.length}):\n`);
for (const u of users) {
  console.log(`  ${u.email}   (id=${u.id.slice(0, 20)}...  impulses=${u.impulses})`);
}
