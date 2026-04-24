// One-off migration: add `phone` column to the `user` table.
// Idempotent — safe to re-run.
//
// Local:  node --env-file=.env.local scripts/add-phone-column.mjs
// Prod:   DATABASE_URL='<neon-prod-url>' node scripts/add-phone-column.mjs
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

const before = await sql.query(
  `SELECT column_name FROM information_schema.columns
   WHERE table_schema='public' AND table_name='user' AND column_name='phone'`
);
const beforeRows = Array.isArray(before) ? before : (before.rows || []);
if (beforeRows.length > 0) {
  console.log('Column "phone" already exists — nothing to do.');
  process.exit(0);
}

await sql.query(`ALTER TABLE "user" ADD COLUMN "phone" text`);
console.log('Added column "phone" to table "user".');
