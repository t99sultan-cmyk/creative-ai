// Quick diagnostic: show raw DB state for a creative so we can see whether
// its render is stuck, and how long ago it was started.
// Usage:  node scripts/diag-render.mjs <creativeId>
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const id = process.argv[2];
if (!id) {
  console.error('Usage: node scripts/diag-render.mjs <creativeId>');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set in .env / .env.local');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

// First: figure out the actual table name (drizzle sometimes uses camelCase)
const tables = await sql`
  select table_schema, table_name from information_schema.tables
  where table_schema not in ('pg_catalog','information_schema')
  order by table_schema, table_name
`;
console.log('Tables in DB:');
for (const t of tables) console.log(` - ${t.table_schema}.${t.table_name}`);
console.log('');

const creativesTable = tables.find(t => /creat/i.test(t.table_name));
if (!creativesTable) {
  console.error('No "creatives"-like table found. Check DATABASE_URL.');
  process.exit(1);
}
const tname = `"${creativesTable.table_schema}"."${creativesTable.table_name}"`;
console.log(`Using ${tname}`);
console.log('');

// Dynamic SQL. neon-serverless's sql.query takes text+params.
const result = await sql.query(
  `select * from ${tname} where id = $1 limit 1`,
  [id],
);
const rows = Array.isArray(result) ? result : (result.rows || []);

if (rows.length === 0) {
  console.log(`No creative with id=${id}`);
  console.log('');
  console.log('Recent creatives (last 5 by created_at) — sanity check:');
  const recentR = await sql.query(
    `select id, format, "videoUrl" as video_url, created_at from ${tname} order by created_at desc limit 5`,
  );
  const recent = Array.isArray(recentR) ? recentR : (recentR.rows || []);
  for (const r of recent) {
    const v = r.video_url || '';
    const flag = v.startsWith('http') ? '✅' : v.startsWith('rendering:') ? '🔄' : v.startsWith('failed:') ? '❌' : '—';
    console.log(` ${flag} ${r.id}  fmt=${r.format}  ${v.slice(0, 40)}  (${r.created_at})`);
  }
  process.exit(0);
}

if (rows.length === 0) {
  console.log(`No creative with id=${id}`);
  process.exit(0);
}

const r = rows[0];
console.log('Creative:', r.id);
console.log('  User:     ', r.userId);
console.log('  Format:   ', r.format);
console.log('  Created:  ', r.created_at);
const v = r.videoUrl || '';
console.log('  videoUrl: ', v);

if (v.startsWith('rendering:')) {
  const ts = parseInt(v.slice('rendering:'.length), 10);
  if (Number.isFinite(ts)) {
    const elapsedMs = Date.now() - ts;
    const elapsedMin = (elapsedMs / 60000).toFixed(1);
    console.log(`  → Rendering for ${elapsedMin} min (${elapsedMs} ms)`);
    if (elapsedMs > 10 * 60 * 1000) {
      console.log('  ⚠️ STUCK (past 10 min timeout)');
    } else if (elapsedMs < 45000) {
      console.log('  ℹ️  Still in early-exit window (<45s)');
    } else {
      console.log('  ℹ️  Past early-exit, polling GCS fallback');
    }
  }
} else if (v.startsWith('http')) {
  console.log('  ✅ Already has final URL');
} else if (v.startsWith('failed:')) {
  console.log('  ❌ Marked as failed');
} else {
  console.log('  ⚠️ videoUrl is empty/unknown — no render started or cleared');
}
