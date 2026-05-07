"use server";

import { auth } from "@clerk/nextjs/server";
import { listPublishedByUser, unpublishPage, type PublishedPage } from "@/lib/published-store";

/**
 * Server actions for the "Мои публикации" UI. Reads / unpublishes
 * the caller's own published pages — strict owner-only via Clerk auth.
 */

export async function listMyPublished(): Promise<{
  ok: true;
  pages: Array<Omit<PublishedPage, "html"> & { htmlSize: number }>;
} | { ok: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Не авторизован" };
  const pages = await listPublishedByUser(userId);
  // Strip the heavy `html` field — UI doesn't need it for the list.
  const stripped = pages.map((p) => ({
    slug: p.slug,
    kind: p.kind,
    userId: p.userId,
    createdAt: p.createdAt,
    htmlSize: p.html.length,
  }));
  return { ok: true, pages: stripped };
}

export async function softUnpublish(slug: string): Promise<{ ok: boolean; error?: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Не авторизован" };
  if (typeof slug !== "string" || slug.length < 4) {
    return { ok: false, error: "Неверный slug" };
  }
  return unpublishPage({ slug, userId });
}
