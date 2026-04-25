"use client";

import { useEffect, useState } from "react";
import { getPublicGallery } from "@/actions/galleryActions";
import { Wand2, Loader2 } from "lucide-react";

/**
 * Inspiration gallery shown on the editor canvas when nothing is
 * generated yet. Pulls public, non-deleted, non-disliked creatives
 * from across all users (anonymized — no author info), renders each
 * as a sandboxed iframe / video tile, and lets the user pick one as
 * a remix template with a single click.
 *
 * Why iframe instead of a screenshot URL: htmlCode is what we already
 * have in DB; rendering on demand is free. Going through Cloud Run
 * /screenshot for every tile would burn 2-3s per render and queue
 * traffic. iframes with sandbox="" are safe for arbitrary HTML.
 */
type Item = {
  id: string;
  format: string | null;
  cost: number | null;
  htmlCode: string | null;
  videoUrl: string | null;
  prompt: string | null;
  feedbackScore: number | null;
};

export function PublicGallery({
  onPickAsTemplate,
}: {
  onPickAsTemplate: (item: Item) => void;
}) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getPublicGallery(12);
      if (cancelled) return;
      if (res.success) {
        setItems(res.items as Item[]);
      } else {
        setError(res.error ?? "Не удалось загрузить");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (items === null && !error) {
    return (
      <div className="mt-8 flex items-center justify-center text-neutral-400 gap-2 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Загружаем шаблоны…
      </div>
    );
  }
  if (error) return null; // silently hide if gallery can't load
  if (items && items.length === 0) return null;

  return (
    <section className="mt-10 w-full">
      <div className="flex items-baseline justify-between mb-4 px-1">
        <h2 className="text-base md:text-lg font-black text-neutral-900">
          🎨 Шаблоны от наших клиентов
        </h2>
        <span className="text-[11px] text-neutral-500 font-medium">
          Кликни на любой — откроется в редакторе как ремикс
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {items?.map((item) => (
          <GalleryTile
            key={item.id}
            item={item}
            onClick={() => onPickAsTemplate(item)}
          />
        ))}
      </div>
    </section>
  );
}

function GalleryTile({ item, onClick }: { item: Item; onClick: () => void }) {
  const isVertical = item.format === "9:16" || !item.format;
  const isAnimated = (item.cost ?? 0) > 3;
  const aspect = isVertical ? "aspect-[9/16]" : "aspect-square";

  return (
    <button
      onClick={onClick}
      className="group relative bg-white rounded-2xl border border-neutral-200 overflow-hidden hover:border-hermes-400 hover:shadow-xl transition-all text-left"
      title={item.prompt ?? "Шаблон"}
    >
      <div className={`relative ${aspect} bg-neutral-100 overflow-hidden`}>
        {isAnimated && item.videoUrl && !/^(rendering|failed):/.test(item.videoUrl) ? (
          <video
            src={item.videoUrl}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />
        ) : item.htmlCode ? (
          <iframe
            srcDoc={item.htmlCode}
            sandbox=""
            scrolling="no"
            className="absolute inset-0 origin-top-left pointer-events-none"
            style={{
              width: isVertical ? "400px" : "500px",
              height: isVertical ? "711px" : "500px",
              transform: `scale(${isVertical ? 0.42 : 0.5})`,
            }}
          />
        ) : null}

        {item.feedbackScore === 1 && (
          <span className="absolute top-2 left-2 bg-green-500/90 text-white text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded">
            👍
          </span>
        )}
        {isAnimated && (
          <span className="absolute top-2 right-2 bg-amber-400 text-neutral-900 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded">
            ANIM
          </span>
        )}

        {/* Hover overlay with CTA */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <span className="bg-white text-neutral-900 text-xs font-black px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1">
            <Wand2 className="w-3.5 h-3.5 text-hermes-500" />
            Использовать
          </span>
        </div>
      </div>
    </button>
  );
}
