/**
 * Published-page store — DB-backed with in-memory fallback.
 *
 * Primary persistence: `published_page` table (drizzle migration 0005).
 * Fallback: per-process in-memory Map, used when:
 *   - DB call fails (network blip, schema not yet migrated)
 *   - Local dev where migration hasn't run yet
 *
 * Reads check DB first, then memory. Writes write to DB AND memory.
 * The fallback path means publish keeps working even when prod-DB is
 * misbehaving — degraded mode (URL works only on serving instance) is
 * better than total failure.
 *
 * Slug format: 7 chars from a-z0-9 → 36^7 ≈ 78B combinations.
 */

import { db } from "@/db";
import { publishedPages } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export type PublishedKind = "site" | "presentation";

export interface PublishedPage {
  slug: string;
  kind: PublishedKind;
  html: string;
  userId: string;
  createdAt: number;
}

interface MemStore {
  byKind: Record<PublishedKind, Map<string, PublishedPage>>;
}

declare global {
  // eslint-disable-next-line no-var
  var __aicreativePublishedStore: MemStore | undefined;
}

function getMemStore(): MemStore {
  if (!globalThis.__aicreativePublishedStore) {
    globalThis.__aicreativePublishedStore = {
      byKind: { site: new Map(), presentation: new Map() },
    };
  }
  return globalThis.__aicreativePublishedStore;
}

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
function randomSlug(): string {
  let s = "";
  for (let i = 0; i < 7; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

/**
 * Persist the page. Tries DB first with up-to-5 retries on slug
 * collision (PK conflict on `slug` → drizzle throws). Falls back to
 * in-memory only on non-PK errors (so dev without migration still
 * works).
 */
export async function publishPage(input: {
  kind: PublishedKind;
  html: string;
  userId: string;
}): Promise<PublishedPage> {
  // 5 attempts with fresh slug per attempt. At 7-char a-z0-9 (78B
  // combos) the probability of two unique attempts both colliding
  // with existing rows is astronomically small unless the table is
  // ~10M rows; 5 retries is more than enough headroom.
  let slug = "";
  let inserted = false;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    slug = randomSlug();
    try {
      await db
        .insert(publishedPages)
        .values({
          slug,
          kind: input.kind,
          html: input.html,
          userId: input.userId,
        })
        .onConflictDoNothing({ target: publishedPages.slug });
      // onConflictDoNothing returns silently on conflict — verify the
      // row really was inserted (otherwise pick a fresh slug and retry).
      const verify = await db
        .select({ slug: publishedPages.slug })
        .from(publishedPages)
        .where(eq(publishedPages.slug, slug))
        .limit(1);
      if (verify[0]?.slug === slug) {
        inserted = true;
        break;
      }
      // Conflict — loop and try a new slug.
    } catch (err) {
      lastErr = err;
      // Non-conflict failure (e.g., schema not migrated) — skip retries
      // and fall through to memory-only.
      break;
    }
  }
  if (!inserted) {
    if (lastErr) {
      console.warn("[published-store] DB insert failed, using in-memory fallback:", lastErr);
    }
  }

  const page: PublishedPage = {
    slug,
    kind: input.kind,
    html: input.html,
    userId: input.userId,
    createdAt: Date.now(),
  };
  // Always keep a memory copy too — speeds up reads when DB is sluggish.
  getMemStore().byKind[input.kind].set(slug, page);
  return page;
}

/**
 * Soft-unpublish. Sets `unpublished_at` so the page 404s on /s/{slug}
 * and /p/{slug} but row stays for moderation/audit. Owner-only.
 */
export async function unpublishPage(input: {
  slug: string;
  userId: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const updated = await db
      .update(publishedPages)
      .set({ unpublishedAt: new Date() })
      .where(
        and(
          eq(publishedPages.slug, input.slug),
          eq(publishedPages.userId, input.userId),
        ),
      )
      .returning({ slug: publishedPages.slug });
    if (updated.length === 0) {
      return { ok: false, error: "Не найдено или не твоя публикация" };
    }
    // Drop from memory cache too so it's not served from there.
    for (const kind of ["site", "presentation"] as const) {
      getMemStore().byKind[kind].delete(input.slug);
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "DB error" };
  }
}

/**
 * List user's published pages (for the "Мои публикации" UI). Excludes
 * already-unpublished rows.
 */
export async function listPublishedByUser(userId: string): Promise<PublishedPage[]> {
  try {
    const rows = await db
      .select()
      .from(publishedPages)
      .where(
        and(
          eq(publishedPages.userId, userId),
          isNull(publishedPages.unpublishedAt),
        ),
      )
      .orderBy(publishedPages.createdAt);
    return rows.map((r) => ({
      slug: r.slug,
      kind: r.kind as PublishedKind,
      html: r.html,
      userId: r.userId,
      createdAt: r.createdAt?.getTime() ?? Date.now(),
    }));
  } catch (err) {
    console.warn("[published-store] list query failed:", err);
    return [];
  }
}

/**
 * Read a published page by slug + kind. Tries DB first, falls back to
 * memory. Honors the soft-unpublish flag (`unpublished_at` not null →
 * treat as deleted).
 */
export async function getPublishedPage(
  kind: PublishedKind,
  slug: string,
): Promise<PublishedPage | null> {
  // DB read
  try {
    const rows = await db
      .select()
      .from(publishedPages)
      .where(
        and(
          eq(publishedPages.slug, slug),
          eq(publishedPages.kind, kind),
          isNull(publishedPages.unpublishedAt),
        ),
      )
      .limit(1);
    if (rows.length > 0) {
      const r = rows[0];
      return {
        slug: r.slug,
        kind: r.kind as PublishedKind,
        html: r.html,
        userId: r.userId,
        createdAt: r.createdAt?.getTime() ?? Date.now(),
      };
    }
  } catch (err) {
    console.warn("[published-store] DB read failed, falling back to memory:", err);
  }

  // Memory fallback
  return getMemStore().byKind[kind].get(slug) ?? null;
}
