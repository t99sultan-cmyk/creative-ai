"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Globe,
  Loader2,
  PieChart,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { listMyPublished, softUnpublish } from "@/actions/publishedActions";

/**
 * /published — owner-only list of published pages with soft-unpublish
 * action. Public visitors of /s/{slug} or /p/{slug} get a 404 once
 * the row's `unpublished_at` is set.
 *
 * Server actions are called directly from the client (Next.js RSC
 * pattern). The list is loaded on mount; unpublish triggers a
 * refetch instead of optimistic update — safer when DB is involved.
 */

type PublishedRow = {
  slug: string;
  kind: "site" | "presentation";
  createdAt: number;
  htmlSize: number;
};

function KindIcon({ kind }: { kind: PublishedRow["kind"] }) {
  if (kind === "site") return <Globe className="w-4 h-4 text-hermes-500" />;
  return <PieChart className="w-4 h-4 text-violet-500" />;
}

function publicUrl(row: PublishedRow): string {
  return row.kind === "site" ? `/s/${row.slug}` : `/p/${row.slug}`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PublishedPage() {
  const [rows, setRows] = useState<PublishedRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unpublishingSlug, setUnpublishingSlug] = useState<string | null>(null);

  async function load() {
    setError(null);
    const res = await listMyPublished();
    if (!res.ok) {
      setError(res.error);
      setRows([]);
      return;
    }
    setRows(
      res.pages
        .filter((p) => p.kind === "site" || p.kind === "presentation")
        .map((p) => ({
          slug: p.slug,
          kind: p.kind as PublishedRow["kind"],
          createdAt: p.createdAt,
          htmlSize: p.htmlSize,
        }))
        .sort((a, b) => b.createdAt - a.createdAt),
    );
  }

  useEffect(() => {
    load();
  }, []);

  async function handleUnpublish(slug: string) {
    if (!confirm("Снять с публикации? Ссылка перестанет открываться у всех, кому ты её отправлял.")) return;
    setUnpublishingSlug(slug);
    try {
      const res = await softUnpublish(slug);
      if (!res.ok) {
        alert(res.error ?? "Не удалось снять");
      } else {
        await load();
      }
    } finally {
      setUnpublishingSlug(null);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-50 to-white text-neutral-900 font-sans">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-white/80 border-b border-neutral-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-neutral-500 hover:text-neutral-900 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">AICreative</span>
          </Link>
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-emerald-500" />
            <span className="font-black text-base sm:text-lg">Мои публикации</span>
          </div>
          <Link href="/account" className="text-xs text-neutral-400 hover:text-neutral-700 transition-colors">
            Кабинет
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">
            Мои публикации
          </h1>
          <p className="text-neutral-500 text-sm sm:text-base">
            Сайты и презентации, которые ты опубликовал на нашем домене.
            Можно скопировать ссылку или снять с публикации.
          </p>
        </div>

        {rows === null && (
          <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-neutral-500">
            <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Загружаю…
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 mb-4">
            ⚠️ {error}
          </div>
        )}

        {rows !== null && rows.length === 0 && !error && (
          <div className="rounded-2xl border border-neutral-200 bg-white p-12 text-center">
            <p className="text-neutral-700 font-bold text-lg mb-2">Пока ничего не опубликовано</p>
            <p className="text-neutral-500 text-sm mb-6">
              Сделай сайт или презентацию и нажми «Опубликовать на aicreative.kz».
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link
                href="/sites/new"
                className="bg-hermes-500 hover:bg-hermes-600 text-white font-bold text-sm px-4 py-2 rounded-lg transition-colors"
              >
                Создать сайт
              </Link>
              <Link
                href="/presentations/new"
                className="bg-violet-500 hover:bg-violet-600 text-white font-bold text-sm px-4 py-2 rounded-lg transition-colors"
              >
                Создать презентацию
              </Link>
            </div>
          </div>
        )}

        {rows !== null && rows.length > 0 && (
          <div className="space-y-3">
            {rows.map((r) => {
              const url = publicUrl(r);
              const fullUrl = typeof window !== "undefined" ? `${window.location.origin}${url}` : url;
              const unpub = unpublishingSlug === r.slug;
              return (
                <div
                  key={r.slug}
                  className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-4 flex items-center gap-4 hover:border-neutral-300 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-neutral-50 border border-neutral-100 flex items-center justify-center shrink-0">
                    <KindIcon kind={r.kind} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm font-bold truncate">aicreative.kz{url}</div>
                    <div className="text-xs text-neutral-500 mt-0.5">
                      {r.kind === "site" ? "Сайт" : "Презентация"} · {formatDate(r.createdAt)} · {Math.round(r.htmlSize / 1024)} КБ
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => navigator.clipboard?.writeText(fullUrl)}
                      className="text-xs font-bold px-3 py-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-colors"
                      title="Копировать ссылку"
                    >
                      Скопировать
                    </button>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-1.5 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Открыть
                    </a>
                    <button
                      onClick={() => handleUnpublish(r.slug)}
                      disabled={unpub}
                      className="text-xs font-bold px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      {unpub ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      Снять
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
